"""
AI Blueprint - Franck chatbot and AI-powered routes.
Handles: chat, zen, briefing, greeting, suggestions, media processing,
         notes/ai, logo generation, meeting analysis, file dispatch,
         QR generation, Gemini setup.
"""

import os
import sys
import json
from services.logger import get_logger

logger = get_logger('api.ai')
import time
import base64
import io
from pathlib import Path

from flask import Blueprint, request, jsonify, Response
from PIL import Image, ImageOps, ImageDraw
from config import get_current_config

from services.gemini_service import (
    get_client, init_client, set_api_key, is_configured,
    FRANCK_SYSTEM_PROMPT, COACH_FRANCK_SYSTEM_PROMPT,
    load_franck_memory, save_franck_memory, get_time_greeting,
    set_context, get_context,
    franck_todos, franck_events, franck_invoices, franck_emails, franck_actions,
    clear_franck_data as svc_clear_franck_data,
    get_proactive_suggestions, execute_tool, TOOLS_LIST,
)
from api.shared import DESKTOP_PATH, get_safe_path, error_response

try:
    import segno
except ImportError:
    segno = None

cfg = get_current_config()

ai_bp = Blueprint('ai', __name__, url_prefix='/api/v1')


# ============================================================================
# Gemini Setup / Status
# ============================================================================

@ai_bp.route('/ai/check-status', methods=['GET'])
def check_status():
    """Check if Gemini is configured."""
    return jsonify({"configured": is_configured()})


@ai_bp.route('/ai/setup', methods=['POST'])
def setup():
    """Configure Gemini API key."""
    data = request.json
    api_key = data.get('api_key')
    if not api_key:
        return jsonify({"error": "API Key required"}), 400
    try:
        from google import genai
        test_client = genai.Client(api_key=api_key)
        test_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]
        test_success = False
        for model_name in test_models:
            try:
                test_client.models.generate_content(model=model_name, contents="Hello")
                test_success = True
                break
            except Exception:
                continue

        if not test_success and not api_key.startswith("AIza"):
            return jsonify({"error": "Invalid API key format"}), 400

        set_api_key(api_key)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e, 400, "Requête invalide.")


@ai_bp.route('/ai/status', methods=['GET'])
def ai_status():
    """Check if the AI (Franck) is configured and available."""
    has_key = bool(cfg.GEMINI_API_KEY)
    return jsonify({
        "configured": has_key,
        "model": "gemini-2.0-flash" if has_key else None,
        "assistant_name": "Franck",
    })


# ============================================================================
# Franck Chat
# ============================================================================

@ai_bp.route('/chat', methods=['POST'])
def chat():
    """Main Franck chat endpoint with function-calling."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503

    from google.genai import types

    data = request.json
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

    context_info = f"""
CONTEXTE ACTUEL ({time.strftime('%A %d %B %Y, %H:%M')}):

VUE D'ENSEMBLE:
- {len(projects)} clients/projets au total
- {len([p for p in projects if p.get('status') == 'Active'])} projets actifs
- Revenus encaisses: {total_paid:.0f} CHF
- En attente de paiement: {total_pending:.0f} CHF

EVENEMENTS D'AUJOURD'HUI:
{chr(10).join(['- ' + e.get('startTime', '?') + ' : ' + e.get('title', '?') for e in today_events]) if today_events else '- Aucun evenement prevu'}

TACHES EN COURS ({len(pending_todos)} taches non terminees):
{chr(10).join(['- [' + t.get('priority', 'Medium') + '] ' + t.get('title', '?') + ' (' + t.get('projectName', '?') + ')' for t in pending_todos[:10]]) if pending_todos else '- Aucune tache en attente'}

TACHES PRIORITAIRES ({len(high_priority_todos)} haute priorite):
{chr(10).join(['- ' + t.get('title', '?') + ' (' + t.get('projectName', '?') + ')' for t in high_priority_todos[:5]]) if high_priority_todos else '- Aucune tache urgente'}

CLIENTS ACTIFS:
{chr(10).join(['- ' + p.get('clientName', '?') + ' (' + p.get('phase', '?') + ')' for p in projects if p.get('status') == 'Active'][:5]) or '- Aucun projet actif'}

SUGGESTIONS POSSIBLES:
- Si Marion demande "quoi de neuf" ou semble chercher quoi faire, suggere-lui des actions utiles
- Celebre si des factures ont ete payees recemment
- Alerte gentiment si des factures sont en retard
"""

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
            chat_session = client.chats.create(
                model="gemini-2.0-flash",
                history=history_contents[:-1],
                config=types.GenerateContentConfig(tools=TOOLS_LIST),
            )
            response = chat_session.send_message(history_contents[-1].parts[0].text)

            for _round in range(MAX_TOOL_ROUNDS):
                part = response.candidates[0].content.parts[0]
                if not (hasattr(part, 'function_call') and part.function_call):
                    logger.info("Franck final text (round %d, no tool call): %.200s", _round, response.text or "(empty)")
                    yield response.text
                    break
                func_name = part.function_call.name
                func_args = dict(part.function_call.args) if part.function_call.args else {}
                logger.info("Franck EXECUTING tool [round %d]: %s(%s)", _round + 1, func_name, func_args)
                res = execute_tool(func_name, func_args)
                logger.info("Franck tool result [%s]: %.300s", func_name, str(res))
                response = chat_session.send_message(
                    types.Part.from_function_response(name=func_name, response={"result": res})
                )
            else:
                yield response.text

            memory['last_seen'] = time.strftime('%Y-%m-%d %H:%M')
            save_franck_memory(memory)
        except Exception as e:
            logger.error("Chat error: %s", e, exc_info=True)
            yield "Aie, mes circuits grincent un peu... Erreur technique, ma belle. Reessaie dans quelques secondes."

    return Response(generate(), mimetype='text/plain')


@ai_bp.route('/chat/zen', methods=['POST'])
def chat_zen():
    """Coach Franck endpoint for Focus Mode."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503

    from google.genai import types

    try:
        data = request.json
        message = data.get('message', '')
        history = data.get('history', [])

        contents = [
            {"role": "user", "parts": [{"text": COACH_FRANCK_SYSTEM_PROMPT}]},
            {"role": "model", "parts": [{"text": "Compris. Je suis Coach Franck, pret a accompagner Marion avec bienveillance et expertise."}]},
        ]

        for msg in history:
            role = msg.get('role', 'user')
            text = msg.get('parts', [msg.get('text', '')])[0] if isinstance(msg.get('parts'), list) else msg.get('text', '')
            contents.append({"role": role, "parts": [{"text": text}]})

        contents.append({"role": "user", "parts": [{"text": message}]})

        def generate():
            try:
                response = client.models.generate_content_stream(
                    model="gemini-2.0-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(temperature=0.8, max_output_tokens=500),
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
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
    if not client:
        return jsonify({"error": "Server not configured"}), 503
    data = request.json
    try:
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"""
            Tu es le Redacteur en Chef de "Marion Web OS News", l'assistant personnel de Marion.
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
        )
        return jsonify({"html": response.text})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/analyze', methods=['POST'])
def analyze_project():
    """Analyze a project with AI."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503
    data = request.json
    try:
        prompt = f"Analyze project {data.get('clientName')} and tasks {data.get('tasks')}. Return HTML."
        response = client.models.generate_content(model="gemini-2.5-pro", contents=prompt)
        return jsonify({"html": response.text})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/notes/ai', methods=['POST'])
def ai_note_action():
    """AI-powered note actions (improve, summarize, tasks, continue)."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server configuration error: Gemini Client is None"}), 503

    try:
        data = request.json
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

        try:
            response = client.models.generate_content(model="gemini-2.5-pro", contents=prompt)
            return jsonify({"success": True, "result": response.text})
        except Exception:
            try:
                response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
                return jsonify({"success": True, "result": response.text})
            except Exception as e2:
                return error_response(e2)
    except Exception as e:
        return error_response(e)


@ai_bp.route('/invoices/remind', methods=['POST'])
def generate_invoice_reminder():
    """Generate an invoice reminder email with AI."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503
    try:
        from google.genai import types
        resp = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"Write invoice reminder for {request.json.get('clientName')} "
                     f"{request.json.get('amount')}. Return JSON {{subject, body}}.",
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return jsonify(json.loads(resp.text))
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


@ai_bp.route('/meeting/analyze', methods=['POST'])
def analyze_meeting():
    """Analyze a meeting transcription."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503
    try:
        return jsonify({"summary": "Meeting analysis...", "tasks": []})
    except Exception as e:
        return error_response(e)


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

        client = get_client()
        if client:
            try:
                from google.genai import types
                mime_type = "application/pdf" if temp_path.suffix.lower() == '.pdf' else "image/jpeg"
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
                response = client.models.generate_content(
                    model="gemini-2.5-pro",
                    contents=[
                        types.Content(role="user", parts=[
                            types.Part.from_bytes(data=file_content, mime_type=mime_type),
                            types.Part.from_text(text=prompt),
                        ])
                    ],
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
                ai_result = json.loads(response.text.replace("```json", "").replace("```", "").strip())
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
    if not client:
        return jsonify({"error": "Server not configured"}), 503

    data = request.json or {}
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
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return jsonify({"success": True, "reply": response.text})
    except Exception as e:
        return error_response(e)


@ai_bp.route('/email/ai/summarize', methods=['POST'])
def email_ai_summarize():
    """Summarize an email or email thread."""
    client = get_client()
    if not client:
        return jsonify({"error": "Server not configured"}), 503

    data = request.json or {}
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
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return jsonify({"success": True, "summary": response.text})
    except Exception as e:
        return error_response(e)


# ============================================================================
# QR Code Generation (Swiss QR-bill)
# ============================================================================

@ai_bp.route('/generate-qr', methods=['POST'])
def generate_qr():
    """Generate a Swiss QR-bill QR code."""
    if not segno:
        return jsonify({"error": "Segno manquant"}), 500
    data = request.json
    try:
        raw_iban = str(data.get('iban', '')).replace(" ", "")
        debtor = data.get('debtor', {})
        d_name = debtor.get('name') or 'Client'
        d_addr = debtor.get('address') or ''
        d_zip = debtor.get('zip') or '1000'
        d_city = debtor.get('city') or 'Lausanne'
        amount = f"{float(data.get('amount', 0.0)):.2f}"
        ref_msg = data.get('message', '')

        lines = [
            "SPC", "0200", "1", raw_iban,
            "K", "Marion Web", "4A chemin du Port", "1246 Corsier", "", "", "CH",
            "", "", "", "", "", "", "",
            amount, "CHF",
            "K", d_name, d_addr, f"{d_zip} {d_city}", "", "", "CH",
            "NON", "", ref_msg, "EPD",
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
