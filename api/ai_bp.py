"""
AI Blueprint - Franck chatbot and AI-powered routes.
Handles: chat, zen, briefing, greeting, suggestions, media processing,
         notes/ai, logo generation, meeting analysis, file dispatch,
         QR generation, Gemini setup.
"""

import os
import sys
import json
import re
import inspect
import uuid
from services.logger import get_logger

logger = get_logger('api.ai')
import time
import base64
import io
from pathlib import Path
from typing import Optional

from flask import Blueprint, request, jsonify, Response
from PIL import Image, ImageOps, ImageDraw
from config import get_current_config

import services.claude_service as claude_svc
from services.gemini_service import (
    get_client, init_client, set_api_key, remove_api_key, is_configured,
    ai_status_payload, resolve_ai_prefs, is_local_available, get_default_ai_mode,
    generate_grounded_json, get_flash_model, get_pro_model,
    format_gemini_error,
    FRANCK_SYSTEM_PROMPT, COACH_FRANCK_SYSTEM_PROMPT,
    load_franck_memory, save_franck_memory, get_time_greeting,
    set_context, get_context,
    franck_todos, franck_events, franck_invoices, franck_emails, franck_actions,
    clear_franck_data as svc_clear_franck_data,
    get_proactive_suggestions, execute_tool, TOOLS_LIST, TOOLS_MAP,
)
from services.ai_provider_service import (
    generate_text_with_fallback,
    generate_json_with_fallback,
    generate_multimodal_with_fallback,
    stream_text_with_fallback,
)
from services.meeting_transcription_service import transcribe_audio_fallback
from database.db import create_activity_event, get_workspace_settings, update_workspace_settings
from api.shared import DESKTOP_PATH, get_safe_path, error_response

try:
    import segno
except ImportError:
    segno = None

if segno is None:
    logger.warning(
        "Swiss QR disabled: Python package 'segno' missing. Run: pip install segno "
        "(or rerun INSTALLER.command)."
    )

cfg = get_current_config()

ai_bp = Blueprint('ai', __name__, url_prefix='/api/v1')

CONFIRM_RE = re.compile(
    r"\b("
    r"oui|ok|d'accord|vas[- ]?y|go|confirm|confirme|"
    r"tu peux|lance|execute|fais[- ]?le|fait[- ]?le|"
    r"yes|proceed|do it"
    r")\b",
    re.IGNORECASE,
)

PII_REPLACERS = [
    (re.compile(r"\b[\w\.-]+@[\w\.-]+\.\w+\b"), "[REDACTED_EMAIL]"),
    (re.compile(r"\+?\d[\d\s\-\(\)]{7,}\d"), "[REDACTED_PHONE]"),
]

MEETING_METRICS = {
    "analyze_total": 0,
    "analyze_failed": 0,
    "coach_total": 0,
    "coach_failed": 0,
    "fallback_transcription_used": 0,
}


def _request_id():
    rid = request.headers.get("X-Request-ID")
    if rid:
        return rid.strip()[:80]
    return f"req-{uuid.uuid4().hex[:12]}"


def _redact_pii(text: str):
    redacted = text or ""
    hit = False
    for pattern, token in PII_REPLACERS:
        new_value = pattern.sub(token, redacted)
        if new_value != redacted:
            hit = True
        redacted = new_value
    return redacted, hit


def _dedupe_lines(values, limit=20):
    seen = set()
    out = []
    for raw in values or []:
        val = str(raw or "").strip()
        if not val:
            continue
        key = val.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(val)
        if len(out) >= limit:
            break
    return out


def _normalize_followup(payload):
    subject = str(payload.get("subject") or "").strip()
    body = str(payload.get("body") or payload.get("followUpDraft") or "").strip()
    if not body:
        return None
    return (f"Sujet: {subject}\n\n{body}" if subject else body)[:2200]


def _rank_cues(cues):
    rank = {"high": 0, "medium": 1, "low": 2}
    # Deduplicate by cue text first, then sort by priority rank.
    seen = set()
    deduped = []
    for cue in cues:
        key = str(cue.get("cue", "")).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(cue)
    deduped.sort(key=lambda c: rank.get(c.get("priority", "medium"), 1))
    return deduped[:3]


def _audit_meeting(event_type: str, title: str, metadata: dict, project_name: str = None):
    try:
        create_activity_event(
            workspace_id=1,
            event_type=event_type,
            title=title,
            description=title,
            project_name=project_name,
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning("meeting.audit.write_failed: %s", exc)


def _is_scalar_json(value):
    return value is None or isinstance(value, (str, int, float, bool))


def _validate_json_shape(value, depth=0):
    if depth > 4:
        return False
    if _is_scalar_json(value):
        return True
    if isinstance(value, list):
        if len(value) > 50:
            return False
        return all(_validate_json_shape(v, depth + 1) for v in value)
    if isinstance(value, dict):
        if len(value) > 30:
            return False
        return all(
            isinstance(k, str) and _validate_json_shape(v, depth + 1)
            for k, v in value.items()
        )
    return False


def _validate_local_tool_calls(tool_calls, user_text: str, max_rounds: int):
    """Validate local tool calls before executing side-effect actions."""
    valid_calls = []
    rejected = []

    if not isinstance(tool_calls, list):
        return valid_calls, ["tool_calls_not_a_list"]

    if tool_calls and not CONFIRM_RE.search(user_text or ""):
        return valid_calls, ["confirmation_required"]

    for idx, raw_call in enumerate(tool_calls[:max_rounds]):
        if not isinstance(raw_call, dict):
            rejected.append(f"call_{idx}:invalid_object")
            continue

        fname = raw_call.get("name")
        if not isinstance(fname, str) or fname not in TOOLS_MAP:
            rejected.append(f"call_{idx}:unknown_tool:{fname}")
            continue

        raw_args = raw_call.get("args", {})
        if not isinstance(raw_args, dict) or not _validate_json_shape(raw_args):
            rejected.append(f"call_{idx}:{fname}:invalid_args")
            continue

        signature = inspect.signature(TOOLS_MAP[fname])
        allowed_params = set(signature.parameters.keys())
        required_params = {
            p.name
            for p in signature.parameters.values()
            if p.default is inspect._empty
            and p.kind in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
        }
        safe_args = {k: v for k, v in raw_args.items() if k in allowed_params}
        missing = [k for k in required_params if k not in safe_args]
        if missing:
            rejected.append(f"call_{idx}:{fname}:missing:{','.join(sorted(missing))}")
            continue

        valid_calls.append({"name": fname, "args": safe_args})

    return valid_calls, rejected


def _extract_json_candidate(text: str):
    """Best-effort extraction of a JSON object from mixed local model output."""
    if not text:
        return None

    stripped = text.strip()
    # 1) Direct JSON object
    if stripped.startswith("{") and stripped.endswith("}"):
        try:
            return json.loads(stripped)
        except Exception:
            pass

    # 2) ```json ... ``` fenced block
    fence = re.search(r"```json\s*({[\s\S]*?})\s*```", text, re.IGNORECASE)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass

    # 3) Generic fenced block containing JSON
    generic_fence = re.search(r"```\s*({[\s\S]*?})\s*```", text, re.IGNORECASE)
    if generic_fence:
        try:
            return json.loads(generic_fence.group(1))
        except Exception:
            pass

    # 4) Fallback: largest JSON-looking object in text
    obj_match = re.search(r"({[\s\S]*})", text)
    if obj_match:
        try:
            return json.loads(obj_match.group(1))
        except Exception:
            return None

    return None


def _normalize_meeting_tasks(tasks):
    normalized = []
    if not isinstance(tasks, list):
        return normalized
    for idx, task in enumerate(tasks[:30]):
        if isinstance(task, str):
            title = task.strip()
            if title:
                normalized.append({
                    "id": f"mt-{idx + 1}",
                    "title": title,
                    "owner": "Non assigne",
                    "deadline": None,
                    "priority": "Medium",
                })
            continue
        if not isinstance(task, dict):
            continue
        title = str(task.get("title", "")).strip()
        if not title:
            continue
        priority = str(task.get("priority", "Medium")).capitalize()
        if priority not in ("Low", "Medium", "High"):
            priority = "Medium"
        normalized.append({
            "id": str(task.get("id") or f"mt-{idx + 1}"),
            "title": title,
            "owner": str(task.get("owner") or "Non assigne"),
            "deadline": str(task.get("deadline")) if task.get("deadline") else None,
            "priority": priority,
        })
    return normalized


def _normalize_meeting_score(raw):
    """Validate and normalize meetingScore from AI response."""
    if not isinstance(raw, dict):
        return None
    try:
        score = int(raw.get("score", 0))
        score = max(1, min(10, score))
    except (TypeError, ValueError):
        return None
    rationale = str(raw.get("rationale", "")).strip()[:300]
    if not rationale:
        return None
    return {"score": score, "rationale": rationale}


def _validate_meeting_report(payload: dict, client_name: str, duration_seconds, consent_accepted=False, retention_days=30):
    if not isinstance(payload, dict):
        payload = {}
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%S')
    summary = str(payload.get("summary", "")).strip() or "Compte-rendu indisponible."
    key_points = payload.get("keyPoints") or payload.get("key_points") or []
    decisions = payload.get("decisions") or []
    risks = payload.get("risks") or []
    objections = payload.get("objections") or []
    next_steps = payload.get("nextSteps") or payload.get("next_steps") or []
    transcript_excerpt = payload.get("transcriptExcerpt") or payload.get("transcript_excerpt")
    evidence = payload.get("evidence") or []
    follow_up_draft = _normalize_followup(payload)

    def _norm_list(value):
        if not isinstance(value, list):
            return []
        return [str(v).strip() for v in value if str(v).strip()][:20]

    return {
        "id": str(payload.get("id") or f"meeting-{int(time.time() * 1000)}"),
        "clientName": client_name,
        "generatedAt": str(payload.get("generatedAt") or now_iso),
        "durationSeconds": duration_seconds,
        "objective": str(payload.get("objective", "")).strip() or None,
        "summary": summary,
        "keyPoints": _dedupe_lines(_norm_list(key_points), 20),
        "decisions": _dedupe_lines(_norm_list(decisions), 20),
        "risks": _dedupe_lines(_norm_list(risks), 20),
        "objections": _dedupe_lines(_norm_list(objections), 20),
        "nextSteps": _dedupe_lines(_norm_list(next_steps), 20),
        "tasks": _normalize_meeting_tasks(payload.get("tasks")),
        "coachingMoments": [
            {
                "timestampSec": int(m.get("timestampSec", 0)) if isinstance(m, dict) and str(m.get("timestampSec", "")).strip() else None,
                "cue": str(m.get("cue", "")).strip(),
                "rationale": str(m.get("rationale", "")).strip() or None,
            }
            for m in (payload.get("coachingMoments") or payload.get("coaching_moments") or [])
            if isinstance(m, dict) and str(m.get("cue", "")).strip()
        ][:15],
        "evidence": [
            {
                "speaker": str(item.get("speaker", "")).strip() or None,
                "timestampSec": int(item.get("timestampSec", 0)) if str(item.get("timestampSec", "")).strip() else None,
                "quote": str(item.get("quote", "")).strip()[:260],
            }
            for item in evidence
            if isinstance(item, dict) and str(item.get("quote", "")).strip()
        ][:8],
        "followUpDraft": follow_up_draft,
        "transcriptExcerpt": str(transcript_excerpt).strip()[:3000] if transcript_excerpt else None,
        "consentAccepted": bool(consent_accepted),
        "retentionDays": max(1, min(365, int(retention_days or 30))),
        "meetingScore": _normalize_meeting_score(payload.get("meetingScore")),
    }


# ============================================================================
# Gemini Setup / Status
# ============================================================================

@ai_bp.route('/ai/check-status', methods=['GET'])
def check_status():
    """Check AI configuration/provider status."""
    prefs = resolve_ai_prefs(request.args.to_dict() if request.args else {})
    return jsonify(ai_status_payload(prefs))


@ai_bp.route('/ai/setup', methods=['POST', 'DELETE'])
def setup():
    """Configure / remove the Gemini API key.

    POST  body: { api_key, ai_mode? }   → validate, persist (DB + .env.local)
    DELETE                              → wipe the persisted key everywhere
    """
    if request.method == 'DELETE':
        try:
            remove_api_key()
            return jsonify({"success": True})
        except Exception as e:
            return error_response(e, 500, "Suppression impossible.")

    data = request.get_json(silent=True) or {}
    api_key = (data.get('api_key') or '').strip()
    ai_mode = (data.get("ai_mode") or get_default_ai_mode()).lower()
    if ai_mode == "local":
        return jsonify({"success": True, "message": "Local mode does not require a Gemini key."})
    if not api_key:
        return jsonify({"error": "API Key required"}), 400
    try:
        from google import genai
        test_client = genai.Client(api_key=api_key)
        test_models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-pro"]
        test_success = False
        last_error: Optional[Exception] = None
        for model_name in test_models:
            try:
                test_client.models.generate_content(model=model_name, contents="Hello")
                test_success = True
                break
            except Exception as e:
                last_error = e
                continue

        if not test_success:
            return jsonify({"error": format_gemini_error(last_error)}), 400

        set_api_key(api_key)
        return jsonify({"success": True, "recommended_ai_mode": "cloud"})
    except Exception as e:
        return error_response(e, 400, "Requête invalide.")


@ai_bp.route('/ai/transcribe', methods=['POST'])
def transcribe_voice():
    """Transcribe a short voice note for Franck (MediaRecorder blob)."""
    init_client()
    client = get_client()
    if not client:
        return jsonify({"error": "Gemini non configuré — ajoute ta clé API dans Paramètres → IA."}), 503

    audio = request.files.get('audio')
    if not audio:
        return jsonify({"error": "Fichier audio manquant"}), 400

    audio_bytes = audio.read()
    if not audio_bytes or len(audio_bytes) < 64:
        return jsonify({"error": "Audio trop court — reparle un peu plus longtemps."}), 400

    mime_type = (audio.mimetype or request.form.get('mime_type') or 'audio/webm').split(';')[0].strip()
    if mime_type not in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/mp3'):
        mime_type = 'audio/webm'

    ai_prefs = resolve_ai_prefs(request.form.to_dict() if request.form else {})
    if ai_prefs["ai_mode"] == "local" and not is_local_available() and client:
        ai_prefs = {**ai_prefs, "ai_mode": "cloud"}

    prompt = (
        "Transcris fidèlement cet message vocal en français.\n"
        "Retourne uniquement le texte dit, sans markdown, sans guillemets, sans commentaire.\n"
        "Si l'audio est inaudible, réponds exactement : (inaudible)"
    )
    try:
        text = generate_multimodal_with_fallback(
            gemini_client=client,
            file_bytes=audio_bytes,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model=get_flash_model(),
            mime_type=mime_type,
            response_mime_type="text/plain",
        )
        cleaned = (text or "").strip().strip('"').strip("'")
        if not cleaned or cleaned.lower() in ("(inaudible)", "inaudible"):
            return jsonify({"error": "Rien entendu clairement — réessaie en parlant plus près du micro."}), 422
        return jsonify({"text": cleaned})
    except Exception as e:
        logger.error("Voice transcription failed: %s", e, exc_info=True)
        return jsonify({"error": format_gemini_error(e)}), 500


@ai_bp.route('/ai/status', methods=['GET'])
def ai_status():
    """Check if the AI (Franck) is configured and available."""
    prefs = resolve_ai_prefs(request.args.to_dict() if request.args else {})
    payload = ai_status_payload(prefs)
    payload["providerDefault"] = get_default_ai_mode()
    payload["localAvailable"] = is_local_available()
    return jsonify(payload)


# ============================================================================
# Franck Chat
# ============================================================================

def _response_text(response) -> str:
    """Extract text from a Gemini response without assuming tool-call shape."""
    text = getattr(response, "text", None)
    if text:
        return text
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return ""
    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []
    for part in parts:
        part_text = getattr(part, "text", None)
        if part_text:
            chunks.append(part_text)
    return "".join(chunks)


def _cloud_chat_plain(client, model: str, history_contents, user_text: str) -> str:
    """Fallback chat without function-calling (more compatible across Gemini keys/SDKs)."""
    from google.genai import types

    contents = list(history_contents)
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_text)]))
    response = client.models.generate_content(model=model, contents=contents)
    reply = _response_text(response)
    if not reply.strip():
        raise RuntimeError("Gemini n'a renvoyé aucune réponse.")
    return reply


def _cloud_chat_with_tools(client, model: str, history_contents, user_text: str, max_rounds: int = 5) -> str:
    """Primary Franck path: Gemini chat session with tool calling."""
    from google.genai import types

    chat_session = client.chats.create(
        model=model,
        history=history_contents[:-1],
        config=types.GenerateContentConfig(tools=TOOLS_LIST),
    )
    response = chat_session.send_message(user_text)

    for _round in range(max_rounds):
        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            break
        parts = getattr(candidates[0].content, "parts", None) or []
        if not parts:
            break
        part = parts[0]
        if not (hasattr(part, "function_call") and part.function_call):
            reply = _response_text(response)
            logger.info("Franck final text (round %d, no tool call): %.200s", _round, reply or "(empty)")
            return reply or "Je n'ai pas de réponse pour l'instant, ma belle."
        func_name = part.function_call.name
        func_args = dict(part.function_call.args) if part.function_call.args else {}
        logger.info("Franck EXECUTING tool [round %d]: %s(%s)", _round + 1, func_name, func_args)
        res = execute_tool(func_name, func_args)
        logger.info("Franck tool result [%s]: %.300s", func_name, str(res))
        response = chat_session.send_message(
            types.Part.from_function_response(name=func_name, response={"result": res})
        )

    return _response_text(response) or "Je n'ai pas de réponse pour l'instant, ma belle."


@ai_bp.route('/chat', methods=['POST'])
def chat():
    """Main Franck chat endpoint with function-calling."""
    init_client()
    client = get_client()
    data = request.json or {}
    ai_prefs = resolve_ai_prefs(data)
    # If Ollama is down but Gemini is configured, use cloud instead of failing silently.
    if ai_prefs["ai_mode"] == "local" and not is_local_available() and client:
        ai_prefs = {**ai_prefs, "ai_mode": "cloud"}
    if ai_prefs["ai_mode"] == "cloud" and not client:
        return jsonify({"error": "Gemini non configuré — ajoute ta clé API dans Paramètres → IA."}), 503

    from google.genai import types

    def _is_project_active(project: dict) -> bool:
        status = str(project.get('status', '') or '').strip().lower()
        phase = str(project.get('phase', '') or '').strip().lower()

        # Explicit active markers used across app variants / languages
        active_markers = (
            'active', 'en cours', 'in progress', 'ongoing', 'en_cours'
        )
        if any(marker in status for marker in active_markers):
            return True

        # Explicit inactive markers
        inactive_markers = (
            'archive', 'archiv', 'closed', 'done', 'termin', 'lost', 'won', 'cancel'
        )
        if any(marker in status for marker in inactive_markers):
            return False
        if any(marker in phase for marker in inactive_markers):
            return False

        # Fallback heuristic: a project with pending tasks is considered active.
        tasks = project.get('tasks') or []
        if any(not t.get('completed', False) for t in tasks if isinstance(t, dict)):
            return True

        # If uncertain, keep it as active for safer assistant answers.
        return True

    app_context = data.get('context', {})
    projects = app_context.get('projects', [])
    events = app_context.get('events', [])

    # Extract todos from both standalone and project tasks
    todos = list(app_context.get('todos', []))
    for p in projects:
        for task in p.get('tasks', []):
            todos.append({
                'title': task.get('title', ''),
                'completed': task.get('completed', False),
                'priority': task.get('priority', 'Medium'),
                'dueDate': task.get('dueDate'),
                'projectName': p.get('clientName', 'Projet inconnu'),
            })

    set_context({"projects": projects, "events": events, "todos": todos})

    # Load memory
    memory = load_franck_memory()

    # Calculate financial stats
    total_paid = sum(
        sum(i.get('amount', 0) for i in p.get('invoices', []) if i.get('status') == 'Paid')
        for p in projects
    )
    total_pending = sum(
        sum(i.get('amount', 0) for i in p.get('invoices', [])
            if i.get('status') in ['Pending', 'Draft', 'Partial'])
        for p in projects
    )

    today = time.strftime('%Y-%m-%d')
    today_events = [e for e in events if e.get('date', '') == today]
    pending_todos = [t for t in todos if not t.get('completed', False)]
    high_priority_todos = [t for t in pending_todos if t.get('priority') == 'High']
    active_projects = [p for p in projects if _is_project_active(p)]

    context_info = f"""
CONTEXTE ACTUEL ({time.strftime('%A %d %B %Y, %H:%M')}):

VUE D'ENSEMBLE:
- {len(projects)} clients/projets au total
- {len(active_projects)} projets actifs
- Revenus encaisses: {total_paid:.0f} CHF
- En attente de paiement: {total_pending:.0f} CHF

EVENEMENTS D'AUJOURD'HUI:
{chr(10).join(['- ' + e.get('startTime', '?') + ' : ' + e.get('title', '?') for e in today_events]) if today_events else '- Aucun evenement prevu'}

TACHES EN COURS ({len(pending_todos)} taches non terminees):
{chr(10).join(['- [' + t.get('priority', 'Medium') + '] ' + t.get('title', '?') + ' (' + t.get('projectName', '?') + ')' for t in pending_todos[:10]]) if pending_todos else '- Aucune tache en attente'}

TACHES PRIORITAIRES ({len(high_priority_todos)} haute priorite):
{chr(10).join(['- ' + t.get('title', '?') + ' (' + t.get('projectName', '?') + ')' for t in high_priority_todos[:5]]) if high_priority_todos else '- Aucune tache urgente'}

CLIENTS ACTIFS:
{chr(10).join(['- ' + p.get('clientName', '?') + ' (' + p.get('phase', '?') + ')' for p in active_projects][:8]) or '- Aucun projet actif'}

SUGGESTIONS POSSIBLES:
- Si Marion demande "quoi de neuf" ou semble chercher quoi faire, suggere-lui des actions utiles
- Celebre si des factures ont ete payees recemment
- Alerte gentiment si des factures sont en retard
"""
    active_client = app_context.get('activeClient')
    route_path = app_context.get('routePath') or ''
    if route_path or active_client:
        context_info += "\nNAVIGATION / FOCUS:\n"
        if route_path:
            context_info += f"- Ecran actif (chemin): {route_path}\n"
        if isinstance(active_client, dict) and active_client:
            context_info += (
                f"- Client au premier plan: {active_client.get('clientName', '?')}\n"
                f"  Factures ouvertes: {active_client.get('openInvoices', 0)}, "
                f"en retard: {active_client.get('overdueInvoices', 0)}, "
                f"taches urgentes: {active_client.get('urgentTasks', 0)}\n"
            )

    if memory.get('facts_about_marion'):
        context_info += "\nCE QUE TU SAIS SUR MARION:\n"
        for fact in memory['facts_about_marion'][-5:]:
            context_info += f"- {fact}\n"

    full_system = FRANCK_SYSTEM_PROMPT + context_info

    history_contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=f"[SYSTEME - NE PAS REPETER]: {full_system}")]),
        types.Content(role="model", parts=[types.Part.from_text(text="Compris ma belle, je suis operationnel !")])
    ]

    for m in data.get('history', []):
        history_contents.append(
            types.Content(
                role="user" if m['role'] == 'user' else "model",
                parts=[types.Part.from_text(text=m['text'])],
            )
        )

    MAX_TOOL_ROUNDS = 5

    def generate():
        try:
            # Local/hybrid path with JSON tool calls, fallback to cloud when needed.
            if ai_prefs["ai_mode"] in ("local", "hybrid"):
                user_text = history_contents[-1].parts[0].text
                local_prompt = (
                    f"{full_system}\n\n"
                    "If NO tool is required, answer with plain text only (no JSON, no code block).\n"
                    "If a tool is required and user explicitly confirmed action, return strict JSON only with keys:\n"
                    '{"reply":"...", "tool_calls":[{"name":"...", "args":{...}}]}\n'
                    "Use tool_calls only when a user confirmed an action. Never return both plain text and JSON."
                    f"\n\nUser message:\n{user_text}"
                )
                local_raw = ""
                try:
                    local_raw = generate_text_with_fallback(
                        gemini_client=client,
                        prompt=local_prompt,
                        prefs=ai_prefs,
                        cloud_model="gemini-2.5-flash",
                        task="chat",
                    )
                except Exception as e:
                    logger.warning("Local chat failed prior to fallback: %s", e)
                    if ai_prefs["ai_mode"] == "local" and not ai_prefs.get("fallback_enabled"):
                        raise

                if local_raw:
                    # Try JSON tool-calling contract first
                    try:
                        parsed = _extract_json_candidate(local_raw)
                        if not isinstance(parsed, dict):
                            raise ValueError("No valid JSON contract in local response")
                        tool_calls = parsed.get("tool_calls") or []
                        reply = parsed.get("reply", "")
                        valid_calls, rejected_calls = _validate_local_tool_calls(
                            tool_calls, user_text, MAX_TOOL_ROUNDS
                        )
                        if rejected_calls:
                            logger.warning(
                                "Rejected local tool calls (mode=%s): %s",
                                ai_prefs["ai_mode"],
                                rejected_calls,
                            )
                        for i, call in enumerate(valid_calls):
                            fname = call["name"]
                            fargs = call["args"]
                            logger.info("Local tool call [round %d]: %s(%s)", i + 1, fname, fargs)
                            tool_result = execute_tool(fname, fargs)
                            if not reply:
                                reply = f"{reply}\n{tool_result}".strip()
                        if tool_calls and not valid_calls and not reply and ai_prefs["ai_mode"] == "local":
                            yield "Mode local sécurisé: confirme l'action explicitement (ex: 'oui, tu peux le faire')."
                            memory['last_seen'] = time.strftime('%Y-%m-%d %H:%M')
                            save_franck_memory(memory)
                            return
                        if reply:
                            yield reply
                            memory['last_seen'] = time.strftime('%Y-%m-%d %H:%M')
                            save_franck_memory(memory)
                            return
                    except Exception:
                        # If local didn't emit JSON, we still stream natural text as valid fallback behavior.
                        if local_raw.strip():
                            yield local_raw
                            memory['last_seen'] = time.strftime('%Y-%m-%d %H:%M')
                            save_franck_memory(memory)
                            return

                # Local/hybrid fallback to cloud function-calling path
                if ai_prefs["ai_mode"] == "local" and not local_raw and not client:
                    raise RuntimeError("Local mode did not return a response")

            if not client:
                yield "Gemini n'est pas configure — ajoute ta cle API dans Parametres → IA & Assistant."
                return

            flash_model = get_flash_model()
            user_text = history_contents[-1].parts[0].text
            try:
                reply = _cloud_chat_with_tools(client, flash_model, history_contents, user_text, MAX_TOOL_ROUNDS)
            except Exception as tool_err:
                logger.warning("Tool chat failed, plain fallback: %s", tool_err, exc_info=True)
                try:
                    reply = _cloud_chat_plain(client, flash_model, history_contents[:-1], user_text)
                except Exception as plain_err:
                    logger.error("Plain chat failed: %s", plain_err, exc_info=True)
                    yield format_gemini_error(plain_err)
                    return
            yield reply

            memory['last_seen'] = time.strftime('%Y-%m-%d %H:%M')
            save_franck_memory(memory)
        except Exception as e:
            logger.error("Chat error: %s", e, exc_info=True)
            yield format_gemini_error(e)

    return Response(generate(), mimetype='text/plain')


@ai_bp.route('/chat/zen', methods=['POST'])
def chat_zen():
    """Coach Franck endpoint for Focus Mode."""
    client = get_client()

    try:
        data = request.json
        ai_prefs = resolve_ai_prefs(data)
        if ai_prefs["ai_mode"] == "cloud" and not client:
            return jsonify({"error": "Server not configured"}), 503
        message = data.get('message', '')
        history = data.get('history', [])
        focus_ctx = data.get('focus_context', {}) or {}

        # Lightweight command intents for execution-oriented coaching.
        normalized = (message or '').strip().lower()
        intents = []
        if normalized.startswith('plan') or 'plan' in normalized:
            intents.append('plan')
        if 'bloque' in normalized or 'blocage' in normalized:
            intents.append('bloque')
        if normalized.startswith('pause') or 'pause' in normalized:
            intents.append('pause')
        if 'reprendre' in normalized or 'reprise' in normalized:
            intents.append('reprendre')
        if 'bilan' in normalized or 'retro' in normalized or 'rétro' in normalized:
            intents.append('bilan')

        focus_context_text = ""
        if isinstance(focus_ctx, dict):
            phase = str(focus_ctx.get('phase', 'focus'))
            state = str(focus_ctx.get('state', 'idle'))
            objective = str(focus_ctx.get('objective', '')).strip()
            remaining = focus_ctx.get('remaining_seconds')
            remaining_display = f"{int(remaining // 60)}m{int(remaining % 60):02d}s" if isinstance(remaining, (int, float)) else "n/a"
            focus_context_text = (
                "CONTEXTE FOCUS:\n"
                f"- Etat session: {state}\n"
                f"- Phase: {phase}\n"
                f"- Objectif courant: {objective or 'non defini'}\n"
                f"- Temps restant: {remaining_display}\n"
            )
            if intents:
                focus_context_text += f"- Intentions detectees: {', '.join(intents)}\n"

        contents = [
            {"role": "user", "parts": [{"text": COACH_FRANCK_SYSTEM_PROMPT}]},
            {"role": "model", "parts": [{"text": "Compris. Je suis Coach Franck, pret a accompagner Marion avec bienveillance et expertise."}]},
        ]

        for msg in history:
            role = msg.get('role', 'user')
            text = msg.get('parts', [msg.get('text', '')])[0] if isinstance(msg.get('parts'), list) else msg.get('text', '')
            contents.append({"role": role, "parts": [{"text": text}]})

        if focus_context_text:
            contents.append({"role": "user", "parts": [{"text": focus_context_text}]})

        contents.append({"role": "user", "parts": [{"text": message}]})

        def generate():
            try:
                for chunk in stream_text_with_fallback(
                    gemini_client=client,
                    contents=contents,
                    prefs=ai_prefs,
                    cloud_model="gemini-2.5-flash",
                    task="chat",
                    system_prompt=COACH_FRANCK_SYSTEM_PROMPT,
                    temperature=0.8,
                ):
                    yield chunk
            except Exception:
                yield "Oups, petit bug technique. Respire et reessaie."

        return Response(generate(), mimetype='text/plain')
    except Exception as e:
        return str(e), 500


# ============================================================================
# Franck Data & Greetings
# ============================================================================

@ai_bp.route('/franck/greeting', methods=['GET'])
def franck_greeting():
    """Get a contextual greeting from Franck."""
    memory = load_franck_memory()
    greeting = get_time_greeting()
    last_seen = memory.get('last_seen', '')
    today = time.strftime('%Y-%m-%d')
    if not last_seen or not last_seen.startswith(today):
        greeting = greeting + " Premier cafe de la journee ensemble !"
    return jsonify({"greeting": greeting})


@ai_bp.route('/franck/data', methods=['GET'])
def get_franck_data():
    """Get Franck's stored data (todos, events, invoices, emails) and action signals."""
    return jsonify({
        "todos": franck_todos,
        "events": franck_events,
        "invoices": franck_invoices,
        "emails": franck_emails,
        "actions_performed": list(franck_actions),
    })


@ai_bp.route('/franck/clear', methods=['POST'])
def clear_franck_data():
    """Clear Franck's data after frontend syncs."""
    svc_clear_franck_data()
    return jsonify({"success": True})


@ai_bp.route('/franck/suggestions', methods=['GET', 'POST'])
def franck_suggestions():
    """Get proactive structured suggestions. Accepts GET (uses cached context) or POST (with data)."""
    if request.method == 'POST':
        data = request.json or {}
        projects = data.get('projects', [])
        events_list = data.get('events', [])
        todos_list = data.get('todos', [])
    else:
        ctx = get_context()
        projects = ctx.get('projects', [])
        events_list = ctx.get('events', [])
        todos_list = ctx.get('todos', [])

    suggestions = get_proactive_suggestions(projects, events_list, todos_list)
    return jsonify({"suggestions": suggestions})


# ============================================================================
# AI-powered endpoints
# ============================================================================

@ai_bp.route('/briefing', methods=['POST'])
def briefing():
    """Generate the weekly briefing."""
    client = get_client()
    data = request.json or {}
    ai_prefs = resolve_ai_prefs(data)
    if ai_prefs["ai_mode"] == "cloud" and not client:
        return jsonify({"error": "Server not configured"}), 503
    try:
        prompt = f"""
            Tu es le Redacteur en Chef de "Eonora Tech OS News", l'assistant personnel de Marion.
            Ton objectif : Rediger un briefing hebdomadaire structure, elegant et ultra-motivant.

            CONTEXTE ACTUEL :
            {data.get('context','')}

            CONSIGNES DE REDACTION :
            - Format : HTML brut (compatible Tailwind).
            - Ton : Chaleureux, professionnel, un peu "coach de vie" mais tres concret.
            - Pas de markdown, juste le code HTML pur.

            STRUCTURE DU BRIEFING :
            - L'Edito de la Semaine (intro motivante)
            - Cap sur le Yacht (finances, metaphore maritime, objectif 300k)
            - Meteo de l'Agenda (densite de la semaine)
            - Le Big Rock (priorite absolue)
            - Citation inspirante
            """
        html = generate_text_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-pro",
            task="reasoning",
        )
        return jsonify({"html": html})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/analyze', methods=['POST'])
def analyze_project():
    """Analyze a project with AI."""
    client = get_client()
    data = request.json or {}
    ai_prefs = resolve_ai_prefs(data)
    if ai_prefs["ai_mode"] == "cloud" and not client:
        return jsonify({"error": "Server not configured"}), 503
    try:
        prompt = f"Analyze project {data.get('clientName')} and tasks {data.get('tasks')}. Return HTML."
        html = generate_text_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-pro",
            task="reasoning",
        )
        return jsonify({"html": html})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/notes/ai', methods=['POST'])
def ai_note_action():
    """AI-powered note actions (improve, summarize, tasks, continue)."""
    client = get_client()
    try:
        data = request.json or {}
        ai_prefs = resolve_ai_prefs(data)
        if ai_prefs["ai_mode"] == "cloud" and not client:
            return jsonify({"error": "Server configuration error: Gemini Client is None"}), 503
        if not data:
            return jsonify({"error": "No JSON data received"}), 400

        action = data.get('action')
        text = data.get('text', '')
        if not text:
            return jsonify({"error": "Texte vide"}), 400

        prompts = {
            'improve': f"Reformule ce texte de maniere plus professionnelle et claire :\n\n{text}",
            'summarize': f"Resume concis :\n\n{text}",
            'tasks': f"Checklist des taches :\n\n{text}",
            'continue': f"Suite logique :\n\n{text}",
        }
        prompt = prompts.get(action, f"Ameliore ce texte :\n\n{text}")

        result = generate_text_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-pro",
            task="reasoning",
        )
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/invoices/remind', methods=['POST'])
def generate_invoice_reminder():
    """Generate an invoice reminder email with AI."""
    client = get_client()
    data = request.json or {}
    ai_prefs = resolve_ai_prefs(data)
    if ai_prefs["ai_mode"] == "cloud" and not client:
        return jsonify({"error": "Server not configured"}), 503
    try:
        payload = generate_json_with_fallback(
            gemini_client=client,
            prompt=(
                f"Write invoice reminder for {data.get('clientName')} {data.get('amount')}. "
                "Return JSON with keys: subject, body."
            ),
            prefs=ai_prefs,
            cloud_model="gemini-2.5-pro",
            task="reasoning",
        )
        return jsonify(payload)
    except Exception as e:
        return error_response(e)


@ai_bp.route('/logo/generate', methods=['POST'])
def generate_logo():
    """Generate an SVG logo with AI."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"Generate SVG logo for {request.json.get('clientName')}",
        )
        return jsonify({"svg": resp.text})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/meeting/policy', methods=['GET', 'POST'])
def meeting_policy():
    """Get or update workspace meeting policy (retention/consent flags)."""
    key = "meetingPolicy"
    workspace_id = 1
    if request.method == "GET":
        settings = get_workspace_settings(workspace_id)
        policy = settings.get(key) or {"retentionDays": 30, "requireConsent": True}
        return jsonify(policy)

    data = request.json or {}
    retention_days = max(1, min(365, int(data.get("retentionDays") or 30)))
    require_consent = bool(data.get("requireConsent", True))
    settings = get_workspace_settings(workspace_id)
    settings[key] = {"retentionDays": retention_days, "requireConsent": require_consent}
    update_workspace_settings(workspace_id, settings)
    _audit_meeting(
        event_type="meeting_policy_updated",
        title="Meeting policy updated",
        metadata={"retentionDays": retention_days, "requireConsent": require_consent},
    )
    return jsonify({"success": True, **settings[key]})


@ai_bp.route('/meeting/analyze', methods=['POST'])
def analyze_meeting():
    """Analyze a meeting transcription and return a structured meeting report."""
    MEETING_METRICS["analyze_total"] += 1
    started = time.time()
    rid = _request_id()
    try:
        audio_bytes = b""
        if request.is_json:
            data = request.json or {}
            raw_transcription = str(data.get("rawTranscription") or data.get("transcript") or "").strip()
            client_name = str(data.get("clientName") or "Client").strip()
            duration_seconds = data.get("durationSeconds")
        else:
            data = request.form.to_dict() if request.form else {}
            raw_transcription = str(data.get("rawTranscription") or data.get("transcript") or "").strip()
            client_name = str(data.get("clientName") or "Client").strip()
            duration_raw = data.get("durationSeconds")
            duration_seconds = int(duration_raw) if str(duration_raw or "").isdigit() else None
            audio = request.files.get("audio")
            if audio:
                try:
                    audio_bytes = audio.read()
                except Exception:
                    audio_bytes = b""

        policy = (get_workspace_settings(1).get("meetingPolicy") or {"retentionDays": 30, "requireConsent": True})
        consent_accepted = str(data.get("consentAccepted", "false")).lower() == "true"
        retention_days = int(data.get("retentionDays") or policy.get("retentionDays") or 30)
        if bool(policy.get("requireConsent", True)) and not consent_accepted:
            return jsonify({"error": "Consentement requis pour analyser la reunion."}), 400

        # Parse historical meeting context (last N summaries from client)
        meeting_context_raw = data.get("meetingContext") or ""
        meeting_context_items = []
        if meeting_context_raw:
            try:
                import json as _json
                parsed_ctx = _json.loads(meeting_context_raw)
                if isinstance(parsed_ctx, list):
                    meeting_context_items = parsed_ctx[:3]
            except Exception:
                pass

        ai_prefs = resolve_ai_prefs({
            **data,
            "ai_mode": data.get("ai_mode") or "cloud",
        })
        client = get_client()
        if ai_prefs["ai_mode"] == "cloud" and not client:
            return jsonify({"error": "Server not configured"}), 503

        # Server-side transcript fallback when browser transcript is weak.
        if len(raw_transcription) < 50 and audio_bytes:
            fallback_text = transcribe_audio_fallback(audio_bytes=audio_bytes, ai_prefs=ai_prefs, gemini_client=client)
            if fallback_text:
                raw_transcription = fallback_text
                MEETING_METRICS["fallback_transcription_used"] += 1

        if not raw_transcription:
            return jsonify({"error": "Transcription manquante"}), 400

        transcript_redacted, redaction_hit = _redact_pii(raw_transcription)

        # Build historical context block
        history_block = ""
        if meeting_context_items:
            lines = []
            for i, item in enumerate(meeting_context_items, 1):
                date_str = str(item.get("date", ""))[:10]
                summary_str = str(item.get("summary", ""))[:300]
                next_steps = item.get("nextSteps") or []
                lines.append(f"  Appel {i} ({date_str}): {summary_str}")
                if next_steps:
                    unresolved = " | ".join(str(s)[:80] for s in next_steps[:5])
                    lines.append(f"    Prochaines etapes non verifiees: {unresolved}")
            history_block = "HISTORIQUE DES APPELS PRECEDENTS AVEC CE CLIENT:\n" + "\n".join(lines) + "\n"

        prompt = f"""
Tu es un assistant de reunion expert.
Analyse la transcription suivante et retourne UNIQUEMENT un JSON valide.

CLIENT: {client_name}
{history_block}
Schema JSON attendu:
{{
  "summary": "string",
  "keyPoints": ["string"],
  "decisions": ["string"],
  "risks": ["string"],
  "objections": ["string"],
  "nextSteps": ["string"],
  "tasks": [
    {{
      "title": "string",
      "owner": "string",
      "deadline": "YYYY-MM-DD ou null",
      "priority": "Low|Medium|High"
    }}
  ],
  "coachingMoments": [
    {{
      "timestampSec": 0,
      "cue": "string",
      "rationale": "string"
    }}
  ],
  "transcriptExcerpt": "string",
  "evidence": [
    {{"speaker":"string|null","timestampSec":0,"quote":"string"}}
  ],
  "subject": "string",
  "body": "string",
  "meetingScore": {{"score": 0, "rationale": "string"}}
}}

Regles:
- Sois factuel, utile, actionnable.
- Taches concretes, pas de doublons.
- Limite transcriptExcerpt a 5-8 phrases.
- Inclus 2 a 6 evidence items si possible.
- Si une information manque, laisse un tableau vide ou null.
- Si l'historique montre des nextSteps non resolus, verifie s'ils ont ete abordes et mentionne-les dans nextSteps ou decisions.
- meetingScore.score: note de 1 a 10 (objectif atteint, decisions prises, actions claires). meetingScore.rationale: 1 phrase explicative.

TRANSCRIPTION:
{transcript_redacted[:16000]}
        """.strip()

        # Use a more capable model for longer meetings (>=15 min)
        duration_for_model = duration_seconds if isinstance(duration_seconds, (int, float)) else 0
        analyze_model = "gemini-2.5-pro" if duration_for_model >= 900 else "gemini-2.5-flash"

        payload = generate_json_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model=analyze_model,
            task="reasoning",
        )

        if not isinstance(payload, dict):
            if isinstance(payload, str):
                parsed = _extract_json_candidate(payload)
                payload = parsed if isinstance(parsed, dict) else {}
            else:
                payload = {}

        report = _validate_meeting_report(payload, client_name, duration_seconds, consent_accepted, retention_days)
        # Retention policy: don't keep transcriptExcerpt beyond short retention windows.
        if report.get("retentionDays", 30) <= 7:
            report["transcriptExcerpt"] = None

        report["requestId"] = rid
        latency_ms = int((time.time() - started) * 1000)
        logger.info(
            "meeting.analyze.ok rid=%s client=%s mode=%s model=%s latency_ms=%s tasks=%s redacted=%s",
            rid,
            client_name,
            ai_prefs.get("ai_mode"),
            analyze_model,
            latency_ms,
            len(report.get("tasks", [])),
            redaction_hit,
        )
        _audit_meeting(
            event_type="meeting_analyze",
            title=f"Meeting analyze {client_name}",
            project_name=client_name,
            metadata={
                "requestId": rid,
                "latencyMs": latency_ms,
                "aiMode": ai_prefs.get("ai_mode"),
                "retentionDays": report.get("retentionDays"),
                "redacted": redaction_hit,
                "taskCount": len(report.get("tasks", [])),
            },
        )
        response = jsonify(report)
        response.headers["X-Request-ID"] = rid
        return response
    except Exception as e:
        MEETING_METRICS["analyze_failed"] += 1
        logger.error("meeting.analyze.failed rid=%s: %s", rid, e, exc_info=True)
        return error_response(e)


@ai_bp.route('/meeting/coach', methods=['POST'])
def coach_meeting():
    """Provide short live coaching cues from rolling transcript context."""
    MEETING_METRICS["coach_total"] += 1
    started = time.time()
    rid = _request_id()
    try:
        data = request.json or {}
        transcript = str(data.get("transcript") or "").strip()
        if not transcript:
            return jsonify({"cues": []})

        objective = str(data.get("objective") or "").strip()
        ai_prefs = resolve_ai_prefs({
            **data,
            "ai_mode": data.get("ai_mode") or "cloud",
        })
        client = get_client()
        if ai_prefs["ai_mode"] == "cloud" and not client:
            return jsonify({"error": "Server not configured"}), 503
        transcript_redacted, redaction_hit = _redact_pii(transcript)

        prompt = f"""
Tu es un coach d'appel en direct.
A partir du contexte ci-dessous, retourne UNIQUEMENT un JSON:
{{"cues":[{{"cue":"string","rationale":"string","priority":"low|medium|high"}}]}}

Contraintes:
- 1 a 3 cues max
- cues tres courts, directement utilisables en live
- couvre si possible: prochaine question, risque a clarifier, reformulation utile
- pas de blabla

OBJECTIF:
{objective or "N/A"}

TRANSCRIPT (fenetre recente):
{transcript_redacted[-7000:]}
        """.strip()

        payload = generate_json_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-flash",
            task="chat",
        )

        if not isinstance(payload, dict):
            payload = _extract_json_candidate(str(payload)) or {}
        cues_raw = payload.get("cues") if isinstance(payload, dict) else []
        cues = []
        if isinstance(cues_raw, list):
            for item in cues_raw[:8]:
                if not isinstance(item, dict):
                    continue
                cue = str(item.get("cue", "")).strip()
                if not cue:
                    continue
                priority = str(item.get("priority", "medium")).lower()
                if priority not in ("low", "medium", "high"):
                    priority = "medium"
                cues.append({
                    "cue": cue,
                    "rationale": str(item.get("rationale", "")).strip()[:220] or None,
                    "priority": priority,
                })
        cues = _rank_cues(cues)

        latency_ms = int((time.time() - started) * 1000)
        logger.info(
            "meeting.coach.ok rid=%s mode=%s latency_ms=%s cues=%s redacted=%s",
            rid,
            ai_prefs.get("ai_mode"),
            latency_ms,
            len(cues),
            redaction_hit,
        )
        response = jsonify({"cues": cues, "requestId": rid})
        response.headers["X-Request-ID"] = rid
        return response
    except Exception as e:
        MEETING_METRICS["coach_failed"] += 1
        logger.error("meeting.coach.failed rid=%s: %s", rid, e, exc_info=True)
        return error_response(e)


@ai_bp.route('/meeting/metrics', methods=['GET'])
def meeting_metrics():
    """Operational metrics snapshot for meeting copilot."""
    analyze_total = max(1, MEETING_METRICS["analyze_total"])
    coach_total = max(1, MEETING_METRICS["coach_total"])
    return jsonify({
        "metrics": MEETING_METRICS,
        "slo": {
            "analyze_failure_rate": MEETING_METRICS["analyze_failed"] / analyze_total,
            "coach_failure_rate": MEETING_METRICS["coach_failed"] / coach_total,
            "fallback_rate": MEETING_METRICS["fallback_transcription_used"] / analyze_total,
        },
    })


@ai_bp.route('/meeting/audit/export', methods=['POST'])
def meeting_audit_export():
    """Write an audit event when a meeting report is exported."""
    data = request.json or {}
    client_name = str(data.get("clientName") or "Client").strip()
    variant = str(data.get("variant") or "internal").strip()
    report_id = str(data.get("reportId") or "").strip()
    _audit_meeting(
        event_type="meeting_export",
        title=f"Meeting report exported ({variant})",
        project_name=client_name,
        metadata={"variant": variant, "reportId": report_id},
    )
    return jsonify({"success": True})


@ai_bp.route('/meeting/audit/lifecycle', methods=['POST'])
def meeting_audit_lifecycle():
    """Write lifecycle audit events (start/stop/share/save)."""
    data = request.json or {}
    event = str(data.get("event") or "meeting_event").strip()[:64]
    client_name = str(data.get("clientName") or "Client").strip()
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    _audit_meeting(
        event_type=f"meeting_{event}",
        title=f"Meeting {event}",
        project_name=client_name,
        metadata=metadata,
    )
    return jsonify({"success": True})


# ============================================================================
# Media Processing
# ============================================================================

@ai_bp.route('/media/vectorize', methods=['POST'])
def vectorize_media():
    """Vectorize an image into SVG using contour tracing."""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    try:
        import numpy as np

        # Load and prepare image
        img = Image.open(request.files['file'].stream).convert('L')
        threshold = int(request.form.get('threshold', 128))
        max_dim = 800
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)

        w, h = img.size
        arr = np.array(img)

        # Binarize
        binary = (arr < threshold).astype(np.uint8)

        # Simple contour extraction using edge detection
        # Detect edges: a pixel is an edge if it differs from any neighbor
        padded = np.pad(binary, 1, mode='constant', constant_values=0)
        edges = np.zeros_like(binary)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            shifted = padded[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
            edges |= (binary != shifted)

        # Convert edge pixels to SVG paths using scanline approach
        # Group consecutive edge pixels per row into horizontal line segments
        paths = []
        for y in range(h):
            x = 0
            while x < w:
                if edges[y, x]:
                    x_start = x
                    while x < w and edges[y, x]:
                        x += 1
                    paths.append(f"M{x_start},{y}h{x - x_start}")
                else:
                    x += 1

        # Also add filled rectangles for solid regions (better visual quality)
        rects = []
        for y in range(0, h, 2):  # Sample every 2 rows for performance
            x = 0
            while x < w:
                if binary[y, x]:
                    x_start = x
                    while x < w and binary[y, x]:
                        x += 1
                    rects.append(f'<rect x="{x_start}" y="{y}" width="{x - x_start}" height="2" />')
                else:
                    x += 1

        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            '<g fill="#000" stroke="none">',
        ]
        svg_parts.extend(rects)
        svg_parts.append('</g>')

        if paths:
            svg_parts.append(f'<path d="{" ".join(paths)}" fill="none" stroke="#000" stroke-width="0.5" opacity="0.3" />')

        svg_parts.append('</svg>')
        svg = '\n'.join(svg_parts)

        return jsonify({
            "success": True,
            "image": f"data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}",
            "format": "svg",
            "width": w,
            "height": h,
        })
    except ImportError:
        # numpy not available — minimal fallback
        return jsonify({"error": "numpy is required for vectorization. Install with: pip install numpy"}), 500
    except Exception as e:
        return error_response(e)


@ai_bp.route('/media/remove_bg', methods=['POST'])
def remove_background():
    """Remove background from an image."""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    try:
        file = request.files['file']
        img_data = file.read()
        try:
            from rembg import remove
            output = remove(img_data)
            img = Image.open(io.BytesIO(output))
        except ImportError:
            return jsonify({"error": "Module 'rembg' non installe sur le serveur."}), 501

        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return jsonify({"success": True, "image": f"data:image/png;base64,{img_str}"})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/media/upscale', methods=['POST'])
def upscale_media():
    """Upscale an image 2x using Lanczos."""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    try:
        img = Image.open(request.files['file'].stream)
        new_size = (int(img.width * 2), int(img.height * 2))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        buffered = io.BytesIO()
        fmt = img.format if img.format else 'PNG'
        img.save(buffered, format=fmt)
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return jsonify({"success": True, "image": f"data:image/{fmt.lower()};base64,{img_str}"})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/media/palette', methods=['POST'])
def extract_palette():
    """Extract a 6-color palette from an image."""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    try:
        num_colors = int(request.form.get('colors', 6))
        num_colors = max(2, min(12, num_colors))
        img = Image.open(request.files['file'].stream).convert('RGB')
        # Resize for speed if very large
        if img.width * img.height > 500_000:
            img.thumbnail((500, 500), Image.Resampling.LANCZOS)
        quantized = img.quantize(colors=num_colors, method=Image.Quantize.MEDIANCUT)
        palette_data = quantized.getpalette()
        hex_colors = []
        if palette_data:
            for i in range(0, num_colors * 3, 3):
                r, g, b = palette_data[i], palette_data[i + 1], palette_data[i + 2]
                hex_colors.append(f"#{r:02x}{g:02x}{b:02x}")
        return jsonify({"success": True, "palette": hex_colors})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/media/compress', methods=['POST'])
def compress_media():
    """Compress an image for web. Accepts optional quality (1-100) and format (jpeg/webp)."""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    try:
        quality = int(request.form.get('quality', 80))
        quality = max(1, min(100, quality))
        out_format = request.form.get('format', 'webp').lower()
        if out_format not in ('jpeg', 'webp'):
            out_format = 'webp'

        img = Image.open(request.files['file'].stream)
        if img.mode == 'RGBA' and out_format == 'jpeg':
            img = img.convert('RGB')

        buffered = io.BytesIO()
        save_fmt = 'JPEG' if out_format == 'jpeg' else 'WEBP'
        img.save(buffered, format=save_fmt, quality=quality, optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        mime = 'image/jpeg' if out_format == 'jpeg' else 'image/webp'
        return jsonify({
            "success": True,
            "image": f"data:{mime};base64,{img_str}",
            "size_bytes": buffered.tell(),
        })
    except Exception as e:
        return error_response(e)


# ============================================================================
# File Dispatch (AI-powered)
# ============================================================================

@ai_bp.route('/files/dispatch', methods=['POST'])
def dispatch_file():
    """Dispatch a file to the right client folder using AI."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        temp_dir = DESKTOP_PATH / ".99_Admin" / "temp_dispatch"
        if not temp_dir.exists():
            os.makedirs(temp_dir)
        temp_path = temp_dir / f"dispatch_{int(time.time())}{Path(file.filename).suffix}"
        file_content = file.read()
        with open(temp_path, "wb") as f:
            f.write(file_content)

        clients = []
        for status in ["1. En cours", "2. Maintenances", "3. Associations", "4. Prospects", "5. Archivés",
                       "Prospect", "Actif", "Archivé", "Pro bono", "Perso"]:
            p = DESKTOP_PATH / status
            if p.exists():
                clients.extend([d.name for d in p.iterdir() if d.is_dir() and not d.name.startswith('.')])

        suggestion = {
            "client": "Unknown",
            "folder": "0- Admin/2. Factures",
            "newName": file.filename,
            "reason": "AI not available",
        }

        data = request.form.to_dict() if request.form else {}
        ai_prefs = resolve_ai_prefs(data)
        client = get_client()
        if client or ai_prefs.get("ai_mode") in ("local", "hybrid"):
            try:
                mime_type = "application/pdf" if temp_path.suffix.lower() == '.pdf' else "image/jpeg"
                suffix = temp_path.suffix.lower()
                if suffix in (".png", ".webp"):
                    mime_type = f"image/{suffix[1:]}"
                prompt = f"""
                You are Franck.
                KNOWN CLIENTS: {json.dumps(clients)}.
                KNOWN FOLDERS inside each client:
                  - "0- Admin/0. Offre"
                  - "0- Admin/1. Contrat"
                  - "0- Admin/2. Factures"
                  - "1. Charte graphique"
                  - "2. Logo"
                  - "3. Site internet/1. Textes"
                  - "3. Site internet/2. Visuels"
                  - "3. Site internet/3. Commentaires"

                Task: Identify the most appropriate client and folder for this file, and suggest a clean professional filename.
                Return JSON ONLY: {{ "client": "...", "folder": "...", "newName": "...", "reason": "..." }}
                """
                raw = generate_multimodal_with_fallback(
                    gemini_client=client,
                    file_bytes=file_content,
                    prompt=prompt,
                    prefs=ai_prefs,
                    cloud_model="gemini-2.5-pro",
                    mime_type=mime_type,
                    response_mime_type="application/json",
                )
                ai_result = json.loads(raw.replace("```json", "").replace("```", "").strip())
                suggestion.update({k: v for k, v in ai_result.items() if k in suggestion})
            except Exception:
                pass

        return jsonify({
            "success": True,
            "tempPath": str(temp_path.relative_to(DESKTOP_PATH)),
            "suggestion": suggestion,
        })
    except Exception as e:
        return error_response(e)


# ============================================================================
# Email AI (Phase 5)
# ============================================================================

@ai_bp.route('/email/ai/reply', methods=['POST'])
def email_ai_reply():
    """Generate an AI-powered reply to an email."""
    client = get_client()
    data = request.json or {}
    ai_prefs = resolve_ai_prefs(data)
    if ai_prefs["ai_mode"] == "cloud" and not client:
        return jsonify({"error": "Server not configured"}), 503
    original_body = data.get('originalBody', '')
    original_from = data.get('originalFrom', '')
    original_subject = data.get('originalSubject', '')
    client_name = data.get('clientName', '')
    user_name = data.get('userName', 'Marion')
    tone = data.get('tone', 'professionnel')

    prompt = f"""Tu es Franck, l'assistant IA de {user_name}. Tu dois rediger une reponse email professionnelle.

CONTEXTE:
- Email original de : {original_from}
- Sujet : {original_subject}
- Client : {client_name or 'Inconnu'}
- Ton souhaite : {tone}

CONTENU DE L'EMAIL ORIGINAL:
{original_body[:3000]}

CONSIGNES:
- Redige une reponse claire, {tone} et concise
- Ne repete pas l'integralite de l'email original
- Signe avec le prenom de l'utilisateur ({user_name})
- Retourne UNIQUEMENT le texte de la reponse, sans balises HTML
- En francais, sauf si l'email original est en anglais
"""

    try:
        reply = generate_text_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-flash",
            task="chat",
        )
        return jsonify({"success": True, "reply": reply})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/email/ai/summarize', methods=['POST'])
def email_ai_summarize():
    """Summarize an email or email thread."""
    client = get_client()
    data = request.json or {}
    ai_prefs = resolve_ai_prefs(data)
    if ai_prefs["ai_mode"] == "cloud" and not client:
        return jsonify({"error": "Server not configured"}), 503
    body = data.get('body', '')
    subject = data.get('subject', '')

    if not body:
        return jsonify({"error": "Contenu de l'email requis."}), 400

    prompt = f"""Resume cet email de maniere concise en 2-3 phrases maximum.

Sujet : {subject}

Contenu :
{body[:5000]}

CONSIGNES :
- Resume les points cles uniquement
- En francais
- Format texte simple, pas de HTML
- Si c'est un fil de discussion, resume l'ensemble du fil
"""

    try:
        summary = generate_text_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-flash",
            task="chat",
        )
        return jsonify({"success": True, "summary": summary})
    except Exception as e:
        return error_response(e)


# ============================================================================
# QR Code Generation (Swiss QR-bill)
# ============================================================================

@ai_bp.route('/generate-qr', methods=['POST'])
def generate_qr():
    """
    Generate a Swiss QR-bill QR code (spec v2.0 / Implementation Guidelines v2.3).

    Body JSON :
      - iban            : str (IBAN ou QR-IBAN, espaces autorisés)
      - amount          : float
      - currency        : 'CHF' | 'EUR'
      - reference_type  : 'QRR' | 'SCOR' | 'NON'   (default: 'NON')
      - reference       : str — QR Reference (27 digits) OU Creditor Reference (RF…)
      - message         : str (max 140 chars, unstructured message)
      - additional_info : str (max 140 chars, structured "billing information")
      - creditor / debtor : { name, address, zip, city, country }

    Validation côté serveur :
      - QRR : 27 chiffres
      - SCOR : commence par "RF" + 2 digits + 1..21 alphanum
      - NON : reference doit être vide

    Si le type n'est pas conforme à l'IBAN (QRR sans QR-IBAN ou inverse), on
    retourne 400 avec un message explicite.
    """
    if not segno:
        return jsonify({"error": "Segno manquant"}), 500
    data = request.json or {}
    try:
        raw_iban = str(data.get('iban', '')).replace(" ", "").upper()

        # Detect QR-IBAN (IID positions 5-9 entre 30000-31999)
        is_qr_iban = False
        if len(raw_iban) >= 9 and raw_iban[:2] in ('CH', 'LI'):
            try:
                iid = int(raw_iban[4:9])
                is_qr_iban = 30000 <= iid <= 31999
            except ValueError:
                is_qr_iban = False

        # Creditor (Marion). Read from payload, fallback only if frontend omits it.
        creditor = data.get('creditor', {}) or {}
        c_name = (creditor.get('name') or 'Marion Kindynis').strip()
        c_addr = (creditor.get('address') or '4A chemin du Port').strip()
        c_zip = (creditor.get('zip') or '1246').strip()
        c_city = (creditor.get('city') or 'Corsier').strip()
        c_country = (creditor.get('country') or 'CH').strip().upper()

        debtor = data.get('debtor', {}) or {}
        d_name = (debtor.get('name') or 'Client').strip()
        d_addr = (debtor.get('address') or '').strip()
        d_zip = (debtor.get('zip') or '').strip()
        d_city = (debtor.get('city') or '').strip()
        d_country = (debtor.get('country') or 'CH').strip().upper()

        amount = f"{float(data.get('amount', 0.0)):.2f}"
        currency = (data.get('currency') or 'CHF').upper()
        if currency not in ('CHF', 'EUR'):
            currency = 'CHF'

        # --- Reference handling (Phase 3 of Swiss-grade invoicing) ---
        ref_type_raw = (data.get('reference_type') or data.get('referenceType') or 'NON').upper()
        if ref_type_raw not in ('QRR', 'SCOR', 'NON'):
            ref_type_raw = 'NON'
        ref_value = (data.get('reference') or '').strip().replace(' ', '')

        # Cross-check IBAN/QRR consistency (QR-bill v2.0 spec)
        if ref_type_raw == 'QRR' and not is_qr_iban:
            return jsonify({"error": "QRR requires a QR-IBAN (IID 30000-31999). Use SCOR or NON with this IBAN."}), 400
        if ref_type_raw != 'QRR' and is_qr_iban:
            return jsonify({"error": "QR-IBAN requires QRR reference type."}), 400

        # Validate structure of the reference
        if ref_type_raw == 'QRR':
            if not (ref_value.isdigit() and len(ref_value) == 27):
                return jsonify({"error": "QRR reference must be exactly 27 digits."}), 400
        elif ref_type_raw == 'SCOR':
            import re as _re
            if not _re.match(r'^RF\d{2}[A-Z0-9]{1,21}$', ref_value):
                return jsonify({"error": "SCOR reference must match RF + 2 check digits + 1..21 alphanumeric."}), 400
        elif ref_type_raw == 'NON':
            ref_value = ''  # NON ⇒ champ référence vide

        ref_msg = (data.get('message') or '')[:140]
        add_info = (data.get('additional_info') or data.get('additionalInfo') or '')[:140]

        # Swiss QR-bill v2.0 — only emit a debtor block if zip+city are usable.
        # Otherwise leave the debtor block empty (the bank/payer fills it in).
        if d_zip and d_city:
            d_zip_city = f"{d_zip} {d_city}"
            debtor_block = ["K", d_name, d_addr or d_city, d_zip_city, "", "", d_country]
        else:
            debtor_block = ["", "", "", "", "", "", ""]

        lines = [
            "SPC", "0200", "1", raw_iban,
            "K", c_name, c_addr, f"{c_zip} {c_city}", "", "", c_country,
            "", "", "", "", "", "", "",
            amount, currency,
        ] + debtor_block + [
            ref_type_raw, ref_value, ref_msg, "EPD",
            add_info,
        ]

        payload = "\r\n".join(lines)
        payload_bytes = payload.encode('iso-8859-1', errors='replace')
        qr = segno.make(payload_bytes, error='M', micro=False)

        buff = io.BytesIO()
        qr.save(buff, kind='png', scale=10, border=4)
        buff.seek(0)

        qr_img = Image.open(buff).convert("RGBA")
        width, height = qr_img.size
        cross_size = int(width * 0.14)

        logo = Image.new("RGBA", (cross_size, cross_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(logo)
        draw.rectangle([(0, 0), (cross_size - 1, cross_size - 1)], fill="black")
        gap = int(cross_size * 0.08)
        draw.rectangle([(gap, gap), (cross_size - gap - 1, cross_size - gap - 1)], fill="white")
        red_inset = int(cross_size * 0.16)
        draw.rectangle([(red_inset, red_inset), (cross_size - red_inset - 1, cross_size - red_inset - 1)], fill="#FF0000")
        c = cross_size // 2
        thick = int((cross_size - 2 * red_inset) * 0.33)
        length = int((cross_size - 2 * red_inset) * 0.85) // 2
        draw.rectangle([(c - thick // 2, c - length), (c + thick // 2, c + length)], fill="white")
        draw.rectangle([(c - length, c - thick // 2), (c + length, c + thick // 2)], fill="white")

        pos = ((width - cross_size) // 2, (height - cross_size) // 2)
        qr_img.paste(logo, pos, logo)

        final_buff = io.BytesIO()
        qr_img.save(final_buff, format="PNG")
        final_buff.seek(0)
        img_str = base64.b64encode(final_buff.getvalue()).decode('utf-8')
        return jsonify({"success": True, "image": f"data:image/png;base64,{img_str}"})
    except Exception as e:
        return error_response(e, 400, "Requête invalide.")


# ===========================================================================
# Claude (Anthropic) API key management
# ===========================================================================
@ai_bp.route('/ai/claude/setup', methods=['POST', 'DELETE'])
def claude_setup():
    if request.method == 'DELETE':
        try:
            claude_svc.remove_api_key()
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        return jsonify({"success": True})

    body = request.get_json(silent=True) or {}
    api_key = (body.get('api_key') or '').strip()
    if len(api_key) < 10:
        return jsonify({"error": "Clé trop courte"}), 400
    try:
        claude_svc.save_api_key(api_key)
        client_c = claude_svc.get_client()
        if not client_c:
            return jsonify({"error": "Impossible d'initialiser le client Claude"}), 500
        client_c.messages.create(
            model=claude_svc.FAST_MODEL,
            max_tokens=5,
            messages=[{"role": "user", "content": "Hi"}],
        )
    except Exception as e:
        return jsonify({"error": f"Clé invalide : {e}"}), 400
    return jsonify({"success": True, "message": "Clé Claude enregistrée"})


@ai_bp.route('/ai/claude/status', methods=['GET'])
def claude_status():
    return jsonify({"configured": claude_svc.is_configured()})


@ai_bp.route('/ai/gemini/status', methods=['GET'])
def gemini_status():
    """Lightweight Gemini configuration check (DB + env aware)."""
    return jsonify({"configured": get_client() is not None})


# ===========================================================================
# Competitor analysis
# ===========================================================================
@ai_bp.route('/ai/competitor-analysis', methods=['POST'])
def competitor_analysis():
    body = request.get_json(silent=True) or {}
    urls = [u.strip() for u in (body.get('urls') or []) if u.strip()]
    client_description = body.get('client_description', '')
    if not urls:
        return jsonify({"error": "Au moins une URL est requise"}), 400
    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."}), 503

    url_list = "\n".join(f"- {u}" for u in urls)
    prompt = f"""Tu es un expert en web design et marketing digital. Analyse les sites web concurrents suivants pour un client dont l'activité est : {client_description or 'non précisée'}.

Sites à analyser :
{url_list}

Pour chaque site, visite-le avec Google Search et évalue :
1. Forces design et UX (navigation, visuels, modernité)
2. Faiblesses exploitables (CRO, mobile, vitesse, contenu)
3. Score global de qualité web /100

Puis donne 3 opportunités concrètes pour se démarquer et une recommandation stratégique.

Retourne en JSON strict :
{{
  "competitors": [
    {{"url": "...", "name": "...", "strengths": ["...", "..."], "weaknesses": ["...", "..."], "score": 65, "summary": "..."}}
  ],
  "opportunities": ["...", "...", "..."],
  "recommendation": "..."
}}"""

    gemini_client = get_client()
    try:
        from google.genai import types as genai_types
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                temperature=0.3,
            ),
        )
        raw = (response.text or "").strip().replace("```json", "").replace("```", "").strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        result = json.loads(raw[start:end])
        return jsonify(result)
    except Exception as e:
        logger.error("Competitor analysis failed: %s", e)
        return jsonify({"error": "Analyse impossible pour le moment"}), 500


# ===========================================================================
# Pricing intelligence
# ===========================================================================
@ai_bp.route('/ai/pricing-intelligence', methods=['POST'])
def pricing_intelligence():
    body = request.get_json(silent=True) or {}
    project_type = body.get('project_type', 'Site web')
    pages = body.get('pages', 5)
    industry = body.get('industry', '')
    country = body.get('country', 'France')
    complexity = body.get('complexity', 'medium')
    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."}), 503

    prompt = f"""Tu es un expert en tarification pour freelances web designer en {country}.

Recherche les tarifs actuels du marché pour le projet suivant :
- Type : {project_type}
- Nombre de pages : {pages}
- Secteur client : {industry or 'non précisé'}
- Complexité : {complexity}
- Pays : {country}

Analyse les tarifs pratiqués par les freelances web designers dans ce pays en 2025-2026.
Propose une fourchette réaliste et un tarif recommandé avec justification.

Retourne en JSON strict :
{{
  "range_low": 1500,
  "range_high": 4000,
  "recommended": 2500,
  "currency": "EUR",
  "justification": "...",
  "comparable_projects": ["Exemple 1 : ...", "Exemple 2 : ..."],
  "tips": ["Conseil pour maximiser la valeur perçue..."]
}}"""

    gemini_client = get_client()
    try:
        from google.genai import types as genai_types
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                temperature=0.3,
            ),
        )
        raw = (response.text or "").strip().replace("```json", "").replace("```", "").strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        result = json.loads(raw[start:end])
        return jsonify(result)
    except Exception as e:
        logger.error("Pricing intelligence failed: %s", e)
        return jsonify({"error": "Estimation impossible"}), 500


# ===========================================================================
# Project progress report
# ===========================================================================
@ai_bp.route('/ai/project-progress-report', methods=['POST'])
def project_progress_report():
    body = request.get_json(silent=True) or {}
    project = body.get('project', {})
    if not project:
        return jsonify({"error": "Données projet manquantes"}), 400
    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."}), 503

    tasks = project.get('tasks', [])
    completed = [t for t in tasks if t.get('completed')]
    in_progress_tasks = [t for t in tasks if not t.get('completed') and t.get('column') == 'doing']
    todo_tasks = [t for t in tasks if not t.get('completed') and t.get('column') != 'doing']
    invoices = project.get('invoices', [])
    phase = project.get('phase', 'Inconnu')
    created_at = project.get('createdAt', '')
    client_name = project.get('clientName', 'ce client')

    prompt = f"""Tu es l'assistante IA de Marion, une web designer freelance. Analyse l'avancement du projet pour {client_name}.

DONNÉES DU PROJET :
- Phase actuelle : {phase}
- Créé le : {created_at[:10] if created_at else 'inconnu'}
- Tâches complétées ({len(completed)}) : {', '.join(t.get('title','') for t in completed[:10]) or 'aucune'}
- Tâches en cours ({len(in_progress_tasks)}) : {', '.join(t.get('title','') for t in in_progress_tasks[:5]) or 'aucune'}
- Tâches à faire ({len(todo_tasks)}) : {', '.join(t.get('title','') for t in todo_tasks[:10]) or 'aucune'}
- Factures : {len(invoices)} ({sum(1 for i in invoices if i.get('status') == 'paid')} payées)

Génère un rapport d'avancement structuré et actionnable pour Marion (usage interne).

Retourne en JSON strict :
{{
  "summary": "Résumé exécutif en 2-3 phrases",
  "health": "on_track",
  "percentage": 67,
  "completed_highlights": ["Point fort 1", "Point fort 2"],
  "next_steps": ["Prochaine action prioritaire", "Action 2", "Action 3"],
  "blockers": ["Risque ou bloqueur potentiel"],
  "phase_assessment": "Évaluation de la phase actuelle",
  "financial_status": "Statut des paiements"
}}

Valeurs possibles pour health : "on_track", "at_risk", "delayed", "completed"."""

    gemini_client = get_client()
    prefs = resolve_ai_prefs(get_workspace_settings(1).get('aiPreferences'))
    try:
        result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=prompt,
            prefs=prefs,
            cloud_model="gemini-2.5-flash",
        )
        return jsonify(result)
    except Exception as e:
        logger.error("Progress report failed: %s", e)
        return jsonify({"error": "Rapport impossible"}), 500


# ===========================================================================
# Case study generator
# ===========================================================================
@ai_bp.route('/ai/case-study', methods=['POST'])
def generate_case_study():
    body = request.get_json(silent=True) or {}
    project = body.get('project', {})
    if not project:
        return jsonify({"error": "Données projet manquantes"}), 400
    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."}), 503

    client_name = project.get('clientName', 'le client')
    tasks = project.get('tasks', [])
    completed_tasks = [t.get('title', '') for t in tasks if t.get('completed')]
    phase = project.get('phase', '')
    profile = project.get('profile', {})
    industry = next((f['value'] for f in profile.get('customFields', []) if f.get('key') == 'Secteur'), '')
    website = profile.get('website', '')
    created_at = project.get('createdAt', '')[:10]

    prompt = f"""Tu es Marion, une web designer freelance experte. Rédige une étude de cas professionnelle pour ton portfolio.

INFORMATIONS DU PROJET :
- Client : {client_name}
- Secteur : {industry or 'non précisé'}
- Site web livré : {website or 'non précisé'}
- Date de début : {created_at}
- Phase finale : {phase}
- Livrables réalisés : {', '.join(completed_tasks[:15]) or 'site web complet'}

Rédige une étude de cas percutante, réelle et vendable pour ton portfolio et LinkedIn.

Retourne en JSON strict :
{{
  "title": "Titre accrocheur (max 10 mots)",
  "tagline": "Sous-titre percutant",
  "context": "Contexte et problématique client (2-3 phrases)",
  "problem": "Problème principal que tu as résolu",
  "solution": "Ta solution et approche créative (3-4 phrases)",
  "results": "Résultats mesurables ou qualitatifs obtenus",
  "tech_stack": ["React", "Tailwind", "Figma"],
  "duration": "Durée estimée du projet",
  "linkedin_post": "Post LinkedIn prêt à publier (300 mots max, avec emojis, hashtags)",
  "portfolio_blurb": "Description courte pour le portfolio (80 mots max)"
}}"""

    gemini_client = get_client()
    prefs = resolve_ai_prefs(get_workspace_settings(1).get('aiPreferences'))
    try:
        result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=prompt,
            prefs=prefs,
            cloud_model="gemini-2.5-flash",
        )
        return jsonify(result)
    except Exception as e:
        logger.error("Case study failed: %s", e)
        return jsonify({"error": "Génération impossible"}), 500


# ===========================================================================
# Market watch (weekly trend digest)
# ===========================================================================
@ai_bp.route('/ai/market-watch', methods=['POST'])
def market_watch():
    body = request.get_json(silent=True) or {}
    focus = body.get('focus', 'web design et développement front-end')
    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."}), 503

    prompt = f"""Tu es un expert en veille technologique pour les professionnels du web design et du développement front-end.

Recherche et identifie les 6 tendances majeures de la semaine en {focus} ({time.strftime('%B %Y')}).

Pour chaque tendance, fournis des informations concrètes et sourcées issues du web.

Catégories possibles : "ui-ux", "technologie", "ia", "outils", "business", "inspiration"

Retourne en JSON strict :
{{
  "generated_at": "{time.strftime('%Y-%m-%d')}",
  "trends": [
    {{
      "title": "Titre court et accrocheur",
      "summary": "Résumé de 2-3 phrases expliquant pourquoi c'est important pour une web designer freelance",
      "source_url": "https://...",
      "category": "ui-ux",
      "impact": "high",
      "action": "Ce que Marion devrait faire concrètement avec cette tendance"
    }}
  ]
}}

Valeurs impact : "high", "medium", "low"."""

    gemini_client = get_client()
    try:
        result = generate_grounded_json(prompt, temperature=0.4)
        return jsonify(result)
    except Exception as e:
        logger.error("Market watch failed: %s", e)
        return jsonify({"error": "Veille impossible pour le moment"}), 500


# ===========================================================================
# Image generation via Imagen
# ===========================================================================
@ai_bp.route('/ai/generate-image', methods=['POST'])
def ai_generate_image():
    body = request.get_json(silent=True) or {}
    prompt_text = (body.get('prompt') or '').strip()
    style = body.get('style', 'photorealistic')
    ratio = body.get('ratio', '16:9')

    if not prompt_text:
        return jsonify({"error": "Prompt requis"}), 400

    style_map = {
        'photorealistic': 'professional photo, high quality, sharp',
        'illustration': 'digital illustration, flat vector art style',
        'flat': 'flat design, minimalist, clean vector graphics',
        'mockup': 'UI mockup, web design screenshot, clean interface',
        'watercolor': 'watercolor painting, artistic, soft colors',
    }
    style_suffix = style_map.get(style, style)
    full_prompt = f"{prompt_text}, {style_suffix}"

    aspect_map = {'16:9': '16:9', '1:1': '1:1', '9:16': '9:16', '4:3': '4:3'}
    aspect_ratio = aspect_map.get(ratio, '16:9')

    gemini_client = get_client()
    if not gemini_client:
        return jsonify({"error": "Gemini non configuré"}), 503

    # Try the most recent Imagen model first, fall back to older versions if unavailable
    candidate_models = [
        "imagen-3.0-generate-002",
        "imagen-3.0-generate-001",
    ]
    last_err: Optional[Exception] = None
    for model_name in candidate_models:
        try:
            response = gemini_client.models.generate_images(
                model=model_name,
                prompt=full_prompt,
                config={"number_of_images": 1, "aspect_ratio": aspect_ratio},
            )
            if response.generated_images:
                image_bytes = response.generated_images[0].image.image_bytes
                img_b64 = base64.b64encode(image_bytes).decode('utf-8')
                return jsonify({"success": True, "image": f"data:image/png;base64,{img_b64}"})
        except Exception as e:
            last_err = e
            logger.warning("Imagen model %s failed: %s", model_name, e)
            continue

    err_msg = str(last_err) if last_err else "Aucune image générée"
    logger.error("Image generation failed (all models): %s", err_msg)
    return jsonify({"error": f"Génération échouée : {err_msg}"}), 500


# ===========================================================================
# Prompt improvement (for Prompt Library)
# ===========================================================================
@ai_bp.route('/ai/improve-prompt', methods=['POST'])
def improve_prompt():
    body = request.get_json(silent=True) or {}
    original = (body.get('prompt') or '').strip()
    category = body.get('category', 'cursor')
    if not original:
        return jsonify({"error": "Prompt requis"}), 400
    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."}), 503

    meta_prompt = f"""Tu es un expert en prompt engineering pour Cursor/Claude et le développement web.
Améliore ce prompt pour le rendre plus précis, plus actionnable et plus efficace pour générer du code React/Tailwind.
Catégorie : {category}

Prompt original :
{original}

Retourne en JSON :
{{"improved_prompt": "...", "changes_made": ["Changement 1", "Changement 2"]}}"""

    gemini_client = get_client()
    prefs = resolve_ai_prefs(get_workspace_settings(1).get('aiPreferences'))
    try:
        result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=meta_prompt,
            prefs=prefs,
            cloud_model="gemini-2.5-flash",
        )
        return jsonify(result)
    except Exception as e:
        logger.error("Prompt improvement failed: %s", e)
        return jsonify({"error": "Amélioration impossible"}), 500


# ===========================================================================
# Marion 2030 Atelier — additional endpoints (v2.6.0)
# ===========================================================================


@ai_bp.route('/ai/code-review', methods=['POST'])
def code_review():
    """Marion pastes JSX/Tailwind code, Claude Opus 4.7 reviews it.

    Body JSON:
      code:        str (required) — the snippet to review
      framework:   "react"|"vue"|"svelte"|... (default react)
      focus:       optional list of categories to prioritise

    Categories evaluated: a11y, dry, responsive, dark_mode, performance, naming.
    """
    body = request.get_json(silent=True) or {}
    code = (body.get('code') or '').strip()
    if not code:
        return jsonify({"error": "Aucun code fourni"}), 400
    if len(code) > 16000:
        return jsonify({"error": "Code trop long (max ~16 000 caractères)"}), 400
    framework = (body.get('framework') or 'react').strip()
    focus = body.get('focus') or []

    if not claude_svc.is_configured():
        return jsonify({
            "error": "Claude n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé Anthropic."
        }), 503

    focus_str = ", ".join(focus) if focus else "tout"
    prompt = f"""Tu es un senior frontend engineer (10+ ans React/Tailwind).

Marion te montre un snippet ({framework}) qu'elle a généré avec Cursor. Tu dois faire une code review constructive et didactique pour l'aider à progresser.

Code à reviewer :
```
{code}
```

Évalue selon ces 6 dimensions (concentre-toi en priorité sur : {focus_str}) :
1. accessibility (a11y) — rôles ARIA, contraste, focus, sémantique HTML
2. dry — duplication, abstractions manquantes
3. responsive — mobile-first, breakpoints, débordements
4. dark_mode — classes dark:, contrastes
5. performance — re-renders, useMemo, images, bundle
6. naming — clarté des variables/composants

Pour chaque issue trouvée :
- severity: high|medium|low
- category: a11y|dry|responsive|dark_mode|performance|naming
- title: court (≤ 80 chars)
- explanation: pédagogique (2-4 phrases, en français)
- suggested_fix: extrait de code corrigé (max 15 lignes)

Termine par un overall_score /100 et un mot d'encouragement.

JSON strict :
{{
  "overall_score": 78,
  "summary": "Bon code, mais 3 problèmes d'a11y faciles à corriger.",
  "issues": [
    {{
      "severity": "high",
      "category": "a11y",
      "title": "Bouton sans label accessible",
      "explanation": "Le bouton ne contient qu'une icône. Les lecteurs d'écran ne sauront pas ce qu'il fait. Ajoute un aria-label ou un texte visuellement caché.",
      "suggested_fix": "<button aria-label=\\"Fermer\\"><X /></button>"
    }}
  ],
  "encouragement": "Tu progresses vite, continue !"
}}"""

    try:
        result = claude_svc.generate_json(prompt=prompt, model=claude_svc.POWER_MODEL)
        return jsonify(result)
    except Exception as e:
        logger.error("Code review failed: %s", e)
        return jsonify({"error": "Review impossible pour le moment"}), 500


@ai_bp.route('/ai/stack-picker', methods=['POST'])
def stack_picker():
    """Stack picker wizard — 3 questions in, recommended stack out.

    Body JSON:
      cms:           "headless"|"none"|"editable_by_client"|"unsure"
      ecommerce:     "none"|"few_products"|"catalog"|"subscriptions"
      multilingual:  "no"|"2"|"3+"
      project_name:  optional, used in tone of recommendation
      complexity:    optional, "simple"|"standard"|"complex"
    """
    body = request.get_json(silent=True) or {}
    cms = body.get('cms') or 'unsure'
    ecommerce = body.get('ecommerce') or 'none'
    multi = body.get('multilingual') or 'no'
    project = (body.get('project_name') or '').strip() or 'le projet'
    complexity = body.get('complexity') or 'standard'

    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré."}), 503

    prompt = f"""Tu es un consultant tech qui aide une freelance designer (Marion) à choisir une stack pour {project}.

Réponses au questionnaire :
- CMS : {cms} (none = en dur dans le code, headless = Sanity/Contentful, editable_by_client = il faut un éditeur visuel)
- E-commerce : {ecommerce}
- Multilingue : {multi}
- Complexité ressentie : {complexity}

Recommande UNE stack principale (la plus pragmatique) et UNE alternative.
Sois concrète, mentionne les versions actuelles (Next.js 15, React 19, Tailwind v4, etc).

Inclut :
- la commande de scaffold complète
- les libs additionnelles à installer
- 3 raisons clés (en français, percutantes)
- 1 piège à éviter

JSON strict :
{{
  "primary": {{
    "name": "Next.js 15 + Sanity + Stripe",
    "framework": "Next.js 15",
    "ui": "Tailwind v4 + shadcn/ui",
    "cms": "Sanity",
    "ecommerce": "Stripe Checkout",
    "deploy": "Vercel",
    "scaffold_command": "npx create-next-app@latest mon-projet --typescript --tailwind --app",
    "extra_install": "npm i sanity @sanity/client stripe",
    "why": ["...", "...", "..."],
    "pitfall": "..."
  }},
  "alternative": {{
    "name": "Astro 5 + MDX + Snipcart",
    "framework": "Astro 5",
    "ui": "Tailwind v4",
    "cms": "MDX local",
    "ecommerce": "Snipcart",
    "deploy": "Netlify",
    "scaffold_command": "npm create astro@latest mon-projet -- --template minimal",
    "extra_install": "npx astro add tailwind mdx react",
    "why": ["...", "...", "..."],
    "pitfall": "..."
  }},
  "reasoning": "1-2 phrases pédagogiques expliquant pourquoi le primary l'emporte sur l'alternative ici."
}}"""

    gemini_client = get_client()
    prefs = resolve_ai_prefs(get_workspace_settings(1).get('aiPreferences'))
    try:
        result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=prompt,
            prefs=prefs,
            cloud_model="gemini-2.5-flash",
        )
        return jsonify(result)
    except Exception as e:
        logger.error("Stack picker failed: %s", e)
        return jsonify({"error": "Suggestion impossible pour le moment"}), 500


@ai_bp.route('/ai/wp-glossary/lookup', methods=['POST'])
def wp_glossary_lookup():
    """Look up a WordPress term and return its modern equivalent.

    Body JSON:
      term: str (required)  e.g. "ACF", "wp_query", "shortcode"
    """
    body = request.get_json(silent=True) or {}
    term = (body.get('term') or '').strip()
    if not term:
        return jsonify({"error": "Terme requis"}), 400
    if len(term) > 80:
        return jsonify({"error": "Terme trop long"}), 400

    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré."}), 503

    prompt = f"""Marion connaît bien WordPress et apprend React/Next.js/Tailwind avec Cursor.
Elle te demande l'équivalent moderne du terme WordPress suivant : "{term}".

Donne :
- définition courte du terme WP (1 phrase)
- équivalent moderne (lib / pattern / API)
- exemple de code minimal (10-20 lignes max)
- 1 piège classique à éviter
- lien officiel le plus utile

JSON strict :
{{
  "wp_term": "{term}",
  "wp_definition": "Plugin permettant d'ajouter des champs personnalisés.",
  "modern_equivalent": "Sanity references + groq / Schéma TypeScript",
  "code_example": "// types/page.ts\\nexport interface Page {{ title: string; hero_image: string; }}",
  "code_lang": "ts",
  "pitfall": "Ne mélange pas tes types frontend avec ton schéma CMS, garde 1 source de vérité.",
  "doc_url": "https://www.sanity.io/docs/schema-types"
}}"""

    gemini_client = get_client()
    prefs = resolve_ai_prefs(get_workspace_settings(1).get('aiPreferences'))
    try:
        result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=prompt,
            prefs=prefs,
            cloud_model="gemini-2.5-flash",
        )
        return jsonify(result)
    except Exception as e:
        logger.error("WP glossary lookup failed: %s", e)
        return jsonify({"error": "Recherche impossible"}), 500


@ai_bp.route('/ai/daily-lesson', methods=['POST'])
def daily_lesson():
    """Generate a 3-5 minute daily lesson tailored to Marion's level.

    Body JSON:
      level: "debutant"|"intermediaire"|"avance" (default intermediaire)
      topic: optional — explicit topic to cover
      avoid: optional list of recent topic ids to avoid repeating
    """
    body = request.get_json(silent=True) or {}
    level = body.get('level') or 'intermediaire'
    topic = (body.get('topic') or '').strip()
    avoid = body.get('avoid') or []

    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré."}), 503

    avoid_str = ", ".join(avoid[:10]) if avoid else "aucune"
    topic_directive = (
        f"Le sujet est imposé : {topic}."
        if topic
        else "Choisis un sujet utile et pratique parmi : Tailwind, React Hooks, Next.js routing, Server Components, animations Framer Motion, Cursor mastery, Git/Vercel, accessibilité, performance, dark mode, design tokens."
    )

    prompt = f"""Tu es le coach de Marion. Elle a 5 minutes pour apprendre un truc concret aujourd'hui.

Niveau de Marion : {level}.
{topic_directive}

Sujets déjà vus récemment (à éviter) : {avoid_str}.

Produis une mini-leçon :
- titre court et accrocheur
- 1 phrase explicative (le "quoi" + le "pourquoi c'est utile")
- 1 exemple de code de 5-15 lignes (Tailwind / React / TypeScript)
- 1 challenge Cursor : un mini exercice qu'elle fait dans Cursor en 5 minutes pour assimiler

JSON strict :
{{
  "id": "cursor-keyboard-shortcuts",
  "topic": "Cursor mastery",
  "title": "3 raccourcis Cursor que personne n'utilise (et tu devrais)",
  "explanation": "Cmd+K te génère du code inline, Cmd+L ouvre le chat, Cmd+I lance Composer multi-fichiers. Tu doubleras ta vitesse.",
  "code_lang": "tsx",
  "code_example": "// Sélectionne ce bloc, Cmd+K, et tape :\\n// 'rends ce composant responsive et ajoute le dark mode'\\nfunction Card({{ title }}: {{ title: string }}) {{\\n  return <div className=\\"p-4 bg-white rounded\\">{{title}}</div>;\\n}}",
  "cursor_challenge": "Ouvre un de tes composants existants. Sélectionne tout, Cmd+K, demande à Cursor d'ajouter le dark mode. Compare avant/après.",
  "estimated_minutes": 4
}}"""

    gemini_client = get_client()
    prefs = resolve_ai_prefs(get_workspace_settings(1).get('aiPreferences'))
    try:
        result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=prompt,
            prefs=prefs,
            cloud_model="gemini-2.5-flash",
        )
        return jsonify(result)
    except Exception as e:
        logger.error("Daily lesson failed: %s", e)
        return jsonify({"error": "Leçon indisponible pour le moment"}), 500
