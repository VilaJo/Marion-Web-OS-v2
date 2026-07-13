"""
WP Studio Blueprint - Atelier Refonte WordPress -> Cursor/Tailwind

Endpoints to help Marion analyze her existing WordPress sites and recreate them
with Cursor/AI:
  POST /ai/wp-studio/analyze-site         — uploaded screenshots -> structured refonte plan
  POST /ai/wp-studio/screenshot-to-prompt — single image -> Cursor-ready prompt
  POST /ai/wp-studio/compare-screenshots  — original WP vs Cursor recreation -> fidelity score
  POST /ai/wp-studio/import-tasks         — push generated tasks into a project's Kanban

All visual analysis goes through Gemini multimodal — no scraping/headless browser.
Pattern mirrors competitor_analysis in api/ai_bp.py (is_configured check, JSON-strict
prompts, uniform error handling).
"""

from __future__ import annotations

import base64
import json
import re
import time
import uuid
from typing import Any, Optional

from flask import Blueprint, request, jsonify

from services.gemini_service import get_client, is_configured
from services.logger import get_logger
from database.db import (
    get_project,
    create_task,
    get_workspace_settings,
    update_workspace_settings,
)

logger = get_logger('api.wp_studio')

wp_studio_bp = Blueprint('wp_studio', __name__, url_prefix='/api/v1')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB per screenshot, plenty for sections


def _parse_data_url(data_url: str) -> tuple[bytes, str]:
    """Parse a `data:image/png;base64,xxx` URL into (bytes, mime).

    Falls back to image/jpeg if mime cannot be extracted.
    """
    if not data_url or not isinstance(data_url, str):
        raise ValueError("Image data URL is required")
    m = re.match(r'^data:(image/[a-zA-Z+.-]+);base64,(.+)$', data_url, re.DOTALL)
    if not m:
        # Maybe it's raw base64 without the data: prefix
        try:
            raw = base64.b64decode(data_url, validate=True)
            return raw, "image/jpeg"
        except Exception as e:
            raise ValueError(f"Unsupported image format: {e}") from None
    mime = m.group(1)
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception as e:
        raise ValueError(f"Invalid base64 image: {e}") from None
    if len(raw) > _MAX_IMAGE_BYTES:
        raise ValueError(f"Image too large ({len(raw)} bytes, max {_MAX_IMAGE_BYTES})")
    return raw, mime


def _gemini_multimodal_json(parts: list[dict[str, Any]], prompt: str) -> dict:
    """Call Gemini with several inline images + a text prompt, expect JSON back.

    `parts` is a list of `{bytes, mime}` dicts — each becomes an inline image.
    """
    client = get_client()
    if client is None:
        raise RuntimeError("Gemini client not initialised")

    from google.genai import types as genai_types

    content_parts = []
    for p in parts:
        content_parts.append(genai_types.Part.from_bytes(data=p["bytes"], mime_type=p["mime"]))
    content_parts.append(genai_types.Part.from_text(text=prompt))

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[genai_types.Content(role="user", parts=content_parts)],
        config=genai_types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )
    raw = (response.text or "").strip().replace("```json", "").replace("```", "").strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError(f"Gemini returned no JSON: {raw[:200]}")
    return json.loads(raw[start:end])


def _gemini_check() -> Optional[tuple]:
    """Standard guard returning a 503 response if Gemini isn't configured."""
    if not is_configured() or get_client() is None:
        return jsonify({
            "error": "Gemini n'est pas configuré. Va dans Settings → IA & Assistants pour ajouter ta clé."
        }), 503
    return None


def _save_refonte(workspace_id: int, refonte: dict) -> None:
    """Persist a refonte run in workspace_settings.wpStudioRefontes (kept last 20)."""
    try:
        settings = get_workspace_settings(workspace_id) or {}
        history = settings.get('wpStudioRefontes') or []
        history.insert(0, refonte)
        settings['wpStudioRefontes'] = history[:20]
        update_workspace_settings(workspace_id, settings)
    except Exception as e:
        logger.warning("Could not persist refonte history: %s", e)


# ---------------------------------------------------------------------------
# /ai/wp-studio/analyze-site
# ---------------------------------------------------------------------------

@wp_studio_bp.route('/ai/wp-studio/analyze-site', methods=['POST'])
def analyze_site():
    """Analyze a WordPress site via uploaded section screenshots.

    Body JSON:
      site_url:    str (informational, optional)
      site_name:   str (informational, optional)
      industry:    str (helps tailor design tokens / suggestions)
      screenshots: [{ name: "Hero", data: "data:image/png;base64,..." }, ...]

    Response: structured refonte plan with sections, design tokens, Cursor prompts,
    and ready-to-import Kanban tasks.
    """
    guard = _gemini_check()
    if guard:
        return guard

    body = request.get_json(silent=True) or {}
    site_url = (body.get('site_url') or '').strip()
    site_name = (body.get('site_name') or '').strip() or 'Site sans nom'
    industry = (body.get('industry') or '').strip() or 'non précisé'
    raw_screenshots = body.get('screenshots') or []
    if not isinstance(raw_screenshots, list) or not raw_screenshots:
        return jsonify({"error": "Au moins un screenshot est requis"}), 400
    if len(raw_screenshots) > 12:
        return jsonify({"error": "Maximum 12 sections par analyse"}), 400

    parts = []
    section_names = []
    for idx, item in enumerate(raw_screenshots):
        if not isinstance(item, dict):
            continue
        name = (item.get('name') or f"Section {idx + 1}").strip()
        try:
            raw, mime = _parse_data_url(item.get('data') or '')
        except ValueError as e:
            return jsonify({"error": f"Image '{name}' invalide: {e}"}), 400
        parts.append({"bytes": raw, "mime": mime})
        section_names.append(name)

    if not parts:
        return jsonify({"error": "Aucun screenshot exploitable"}), 400

    sections_listing = "\n".join(f"- Image {i + 1} : {n}" for i, n in enumerate(section_names))

    prompt = f"""Tu es un senior web designer en 2030, expert React + Tailwind CSS et coach Cursor.

Marion va te montrer {len(parts)} screenshot(s) d'un site WordPress qu'elle veut refaire avec Cursor.
Site : "{site_name}"{f' ({site_url})' if site_url else ''}
Secteur : {industry}

Sections fournies dans l'ordre :
{sections_listing}

Pour chaque image, identifie :
- Le rôle (hero / services / témoignages / pricing / contact / footer / autre)
- La structure (layout, colonnes, alignements)
- Les couleurs dominantes (en hex)
- La typographie probable (famille, poids, tailles approximatives)
- L'espacement général (compact / normal / aéré)
- Un prompt Cursor prêt à coller pour la recréer en React + Tailwind (français, 4-7 lignes,
  inclut composants à utiliser, classes Tailwind clés, breakpoints, dark mode si pertinent).

Puis produis un plan de refonte complet : design tokens globaux (palette + typo + spacings),
suggestion de stack (Next.js / Astro / Remix), liste de tâches Kanban à créer pour Marion
(titre, priorité High|Medium|Low, phase suggérée parmi Discovery|Design|Development|QA),
estimation de difficulté globale (1-5) et d'heures de travail.

Réponds UNIQUEMENT en JSON strict, structure exacte :
{{
  "site_name": "{site_name}",
  "industry": "{industry}",
  "design_tokens": {{
    "colors": {{
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "neutral_dark": "#hex",
      "neutral_light": "#hex"
    }},
    "typography": {{
      "heading_family": "Inter",
      "body_family": "Inter",
      "scale": "modular 1.25"
    }},
    "spacing": "compact|normal|aéré",
    "radius": "sharp|soft|rounded"
  }},
  "stack_suggestion": {{
    "framework": "Next.js 15",
    "ui": "Tailwind + shadcn/ui",
    "cms": "Sanity (optionnel)",
    "deploy": "Vercel"
  }},
  "sections": [
    {{
      "index": 1,
      "name": "Hero",
      "role": "hero",
      "structure": "...",
      "colors": ["#...","#..."],
      "typography": "...",
      "spacing": "...",
      "cursor_prompt": "Recrée cette section Hero en React + Tailwind...",
      "estimated_minutes": 45
    }}
  ],
  "kanban_tasks": [
    {{ "title": "Hero + navigation", "priority": "High", "phase": "Development" }}
  ],
  "difficulty": 3,
  "estimated_hours": 12,
  "battle_plan": "Phrase courte qui motive Marion à attaquer."
}}"""

    try:
        result = _gemini_multimodal_json(parts, prompt)
    except json.JSONDecodeError as e:
        logger.error("WP Studio analyze: invalid JSON from Gemini: %s", e)
        return jsonify({"error": "Réponse IA non exploitable, retente."}), 502
    except Exception as e:
        logger.error("WP Studio analyze failed: %s", e)
        return jsonify({"error": "Analyse impossible pour le moment"}), 500

    # Stamp the result so it's stable on the frontend / for history
    result["id"] = uuid.uuid4().hex[:12]
    result["created_at"] = int(time.time())
    if site_url:
        result["site_url"] = site_url

    _save_refonte(1, {
        "id": result["id"],
        "created_at": result["created_at"],
        "site_name": site_name,
        "site_url": site_url,
        "industry": industry,
        "sections_count": len(result.get("sections") or []),
        "difficulty": result.get("difficulty"),
        "estimated_hours": result.get("estimated_hours"),
    })

    return jsonify(result)


# ---------------------------------------------------------------------------
# /ai/wp-studio/screenshot-to-prompt
# ---------------------------------------------------------------------------

@wp_studio_bp.route('/ai/wp-studio/screenshot-to-prompt', methods=['POST'])
def screenshot_to_prompt():
    """Take a single image and return a Cursor-ready prompt + design specs.

    Body JSON:
      image:    "data:image/...;base64,..."
      context:  optional free-form context ("section pricing pour SaaS B2B")
      style:    optional preferred style ("minimaliste, dark mode, accent violet")
    """
    guard = _gemini_check()
    if guard:
        return guard

    body = request.get_json(silent=True) or {}
    try:
        raw, mime = _parse_data_url(body.get('image') or '')
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    context = (body.get('context') or '').strip()
    style = (body.get('style') or '').strip()

    # f-string expressions ne tolèrent pas les backslashes avant Python 3.12
    # (PEP 701). On pré-calcule les valeurs pour rester compatible 3.9.
    context_label = context or 'aucun'
    style_label = style or "fidèle à l'image"

    prompt = f"""Tu es un senior web designer expert React + Tailwind CSS.

Voici une capture d'écran d'une section de site web.
Contexte fourni : {context_label}
Style souhaité : {style_label}

Analyse l'image et produis :
1. Un prompt Cursor prêt à coller (français, 5-10 lignes, mentionne les composants,
   classes Tailwind clés, layout grid/flex, responsive breakpoints, dark mode si visible).
2. Les design tokens détectés.
3. Un titre court et actionnable pour la prompt library.
4. Des tags utiles (hero, pricing, footer, dark, gradient...).

Réponds UNIQUEMENT en JSON strict :
{{
  "title": "Section pricing 3-tiers minimaliste",
  "tags": ["pricing", "3-cards", "minimal"],
  "category": "landing-page|ecommerce|portfolio|composant|autre",
  "cursor_prompt": "Build a 3-tier pricing section in React + Tailwind...",
  "design_tokens": {{
    "colors": ["#hex","#hex"],
    "typography": "Inter, semibold headings, regular body",
    "spacing": "aéré",
    "radius": "rounded-2xl"
  }},
  "notes": "Astuce ou subtilité visible (ex: badge 'Popular' sur la card centrale)."
}}"""

    try:
        result = _gemini_multimodal_json([{"bytes": raw, "mime": mime}], prompt)
    except json.JSONDecodeError:
        return jsonify({"error": "Réponse IA non exploitable, retente."}), 502
    except Exception as e:
        logger.error("Screenshot-to-prompt failed: %s", e)
        return jsonify({"error": "Génération impossible pour le moment"}), 500

    return jsonify(result)


# ---------------------------------------------------------------------------
# /ai/wp-studio/compare-screenshots
# ---------------------------------------------------------------------------

@wp_studio_bp.route('/ai/wp-studio/compare-screenshots', methods=['POST'])
def compare_screenshots():
    """Compare an original WP screenshot against a Cursor recreation.

    Body JSON:
      original:    "data:image/...;base64,..."  (the WP source)
      recreation:  "data:image/...;base64,..."  (Marion's Cursor preview)
      focus:       optional "hero" / "footer" — narrows the analysis
    """
    guard = _gemini_check()
    if guard:
        return guard

    body = request.get_json(silent=True) or {}
    try:
        orig_bytes, orig_mime = _parse_data_url(body.get('original') or '')
        new_bytes, new_mime = _parse_data_url(body.get('recreation') or '')
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    focus = (body.get('focus') or '').strip() or 'la section entière'

    prompt = f"""Tu es un design QA reviewer méticuleux.

Marion te montre 2 images :
- Image 1 = ORIGINAL (site WordPress)
- Image 2 = SA RECRÉATION (Cursor + Tailwind)

Focus de l'analyse : {focus}

Évalue la fidélité visuelle de la recréation par rapport à l'original.

Note 4 dimensions de 0 à 100 :
- couleurs (palette respectée ?)
- typographie (familles, tailles, poids)
- espacement (paddings, gaps, alignements)
- responsive (proportions, débordements, lisibilité)

Calcule un score global = moyenne des 4 dimensions.

Liste les écarts visibles, classés par sévérité (high/medium/low), avec une suggestion
de correction concrète et idéalement les classes Tailwind à utiliser.

Termine par un commentaire encourageant en 1 phrase pour Marion.

Réponds UNIQUEMENT en JSON strict :
{{
  "score_global": 87,
  "scores": {{
    "couleurs": 90,
    "typographie": 85,
    "espacement": 80,
    "responsive": 92
  }},
  "issues": [
    {{
      "severity": "high|medium|low",
      "title": "La couleur du CTA est trop claire",
      "detail": "Original = #FF6B35 ; recréation = #FFB088. Manque ~30% de saturation.",
      "fix": "Remplacer bg-orange-300 par bg-[#FF6B35]"
    }}
  ],
  "wins": [
    "La grille des cards est parfaitement alignée."
  ],
  "encouragement": "Tu y es presque, plus que la palette à ajuster."
}}"""

    try:
        result = _gemini_multimodal_json(
            [
                {"bytes": orig_bytes, "mime": orig_mime},
                {"bytes": new_bytes, "mime": new_mime},
            ],
            prompt,
        )
    except json.JSONDecodeError:
        return jsonify({"error": "Réponse IA non exploitable, retente."}), 502
    except Exception as e:
        logger.error("Compare screenshots failed: %s", e)
        return jsonify({"error": "Comparaison impossible pour le moment"}), 500

    result["compared_at"] = int(time.time())
    return jsonify(result)


# ---------------------------------------------------------------------------
# /ai/wp-studio/import-tasks
# ---------------------------------------------------------------------------

@wp_studio_bp.route('/ai/wp-studio/import-tasks', methods=['POST'])
def import_tasks():
    """Push generated Kanban tasks into a project.

    Body JSON:
      project_id: int (required)
      tasks: [{ title, priority, phase, description? }, ...]
    """
    body = request.get_json(silent=True) or {}
    try:
        project_id = int(body.get('project_id') or 0)
    except (TypeError, ValueError):
        project_id = 0
    if project_id <= 0:
        return jsonify({"error": "project_id requis"}), 400

    project = get_project(project_id)
    if not project:
        return jsonify({"error": "Projet introuvable"}), 404

    raw_tasks = body.get('tasks') or []
    if not isinstance(raw_tasks, list) or not raw_tasks:
        return jsonify({"error": "Aucune tâche à importer"}), 400

    created_ids: list[int] = []
    for idx, t in enumerate(raw_tasks):
        if not isinstance(t, dict):
            continue
        title = (t.get('title') or '').strip()
        if not title:
            continue
        priority = t.get('priority') or 'Medium'
        if priority not in ('Low', 'Medium', 'High'):
            priority = 'Medium'
        task_data = {
            'id': uuid.uuid4().hex[:12],
            'title': title[:200],
            'description': (t.get('description') or '').strip() or None,
            'completed': False,
            'column': 'todo',
            'priority': priority,
            'phase': (t.get('phase') or '').strip() or None,
            'sortOrder': idx,
        }
        try:
            created_ids.append(create_task(project_id, task_data))
        except Exception as e:
            logger.warning("Failed to create WP Studio task '%s': %s", title, e)
            continue

    return jsonify({
        "success": True,
        "imported": len(created_ids),
        "task_ids": created_ids,
    })


# ---------------------------------------------------------------------------
# /ai/wp-studio/history
# ---------------------------------------------------------------------------

@wp_studio_bp.route('/ai/wp-studio/history', methods=['GET'])
def refonte_history():
    """Return the most recent refonte runs (max 20)."""
    try:
        settings = get_workspace_settings(1) or {}
        history = settings.get('wpStudioRefontes') or []
    except Exception:
        history = []
    return jsonify({"history": history})
