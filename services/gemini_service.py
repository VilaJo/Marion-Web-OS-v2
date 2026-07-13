"""
Gemini Service - Manages the Gemini AI client, tools and conversation state.

Centralises all Gemini-related logic so that blueprints (ai_bp, etc.)
can import a thin API instead of touching the google.genai SDK directly.
"""

import os
import time
import json
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional, Any

import requests as http_requests

from config import get_current_config
from services.logger import get_logger

logger = get_logger('services.gemini')
cfg = get_current_config()

# ---------------------------------------------------------------------------
# Gemini client singleton
# ---------------------------------------------------------------------------
_client = None
_api_key_cache: Optional[str] = None
_ENV_LOCAL_PATH = '.env.local'


def _read_key_from_db() -> Optional[str]:
    """Best-effort read of the Gemini API key from workspace_settings.

    Returns the persisted key if any, else None. Never raises.
    The DB is the canonical, durable store for the key (survives even if
    `.env.local` gets wiped, the user reinstalls, or the app runs in a
    container without a mounted env file).
    """
    try:
        # Local import to avoid circular import / cold-start ordering issues
        from database.db import get_workspace_settings
        settings = get_workspace_settings(1) or {}
        key = (settings.get('geminiApiKey') or '').strip()
        return key or None
    except Exception:
        return None


def _save_key_to_db(key: Optional[str]) -> None:
    """Persist (or remove) the Gemini API key in workspace_settings."""
    try:
        from database.db import get_workspace_settings, update_workspace_settings
        settings = get_workspace_settings(1) or {}
        if key:
            settings['geminiApiKey'] = key
        else:
            settings.pop('geminiApiKey', None)
        update_workspace_settings(1, settings)
    except Exception as e:
        logger.warning("Could not persist Gemini API key to DB: %s", e)


def _write_env_local(key: str) -> None:
    """Update GEMINI_API_KEY in `.env.local`, preserving other lines.

    Previously this file was overwritten with only GEMINI_API_KEY, which
    would silently destroy any other env variables the user might have
    placed in it (Google OAuth secrets, Ollama URL overrides, etc.).
    """
    try:
        existing_lines: list[str] = []
        if os.path.exists(_ENV_LOCAL_PATH):
            with open(_ENV_LOCAL_PATH, 'r', encoding='utf-8') as f:
                existing_lines = f.read().splitlines()

        new_lines: list[str] = []
        replaced = False
        for line in existing_lines:
            stripped = line.strip()
            if stripped.startswith('GEMINI_API_KEY=') or stripped.startswith('GEMINI_API_KEY ='):
                new_lines.append(f"GEMINI_API_KEY={key}")
                replaced = True
            else:
                new_lines.append(line)
        if not replaced:
            new_lines.append(f"GEMINI_API_KEY={key}")

        # Strip trailing blank lines for cleanliness, then re-append exactly one newline
        while new_lines and new_lines[-1].strip() == '':
            new_lines.pop()

        with open(_ENV_LOCAL_PATH, 'w', encoding='utf-8') as f:
            f.write("\n".join(new_lines) + "\n")
    except Exception as e:
        logger.warning("Could not write GEMINI_API_KEY to .env.local: %s", e)


def _resolve_api_key() -> Optional[str]:
    """Resolve the Gemini API key from the most durable source available.

    Priority:
      1. In-memory cache (set by previous resolutions / `set_api_key`)
      2. workspace_settings DB entry (`geminiApiKey`)
      3. Environment variable loaded by `config.py` from `.env`/`.env.local`

    If a key is found only in the env layer, it is auto-promoted to the DB
    on first resolution so the user never has to re-enter it again — even
    after the next reinstall, Docker rebuild, or accidental `.env.local`
    overwrite.
    """
    global _api_key_cache
    if _api_key_cache:
        return _api_key_cache
    db_key = _read_key_from_db()
    if db_key:
        _api_key_cache = db_key
        try:
            cfg.GEMINI_API_KEY = db_key
        except Exception:
            pass
        return db_key
    env_key = (cfg.GEMINI_API_KEY or '').strip()
    if env_key:
        _api_key_cache = env_key
        # One-shot migration: copy the env-only key into the DB so it
        # survives any future loss of `.env.local`.
        _save_key_to_db(env_key)
        return env_key
    return None


def invalidate_key_cache() -> None:
    """Drop the in-memory key/client caches (forces re-read on next access)."""
    global _api_key_cache, _client
    _api_key_cache = None
    _client = None


def init_client():
    """Initialise (or re-initialise) the Gemini client.

    Looks up the API key from the DB first (durable across env-file
    accidents) then falls back to the environment-loaded `cfg`.
    """
    global _client
    api_key = _resolve_api_key()

    if api_key:
        try:
            from google import genai
            clean_key = api_key.strip().replace('"', '').replace("'", "")
            _client = genai.Client(api_key=clean_key)
            logger.info("Gemini Client Initialized")
        except Exception as e:
            logger.error("Gemini Client Init Failed: %s", e, exc_info=True)
            _client = None
    else:
        _client = None
        logger.warning("No Gemini API Key found")


def get_client():
    """Return the current Gemini client, lazily initialising if needed."""
    if _client is None:
        init_client()
    return _client


def set_api_key(key: str):
    """Persist a new Gemini API key durably and reinitialise the client.

    The key is stored in BOTH `workspace_settings` (DB — canonical, durable)
    and `.env.local` (legacy / subprocess compatibility). Other lines in
    `.env.local` are preserved.
    """
    cleaned = (key or '').strip()
    _save_key_to_db(cleaned)
    if cleaned:
        _write_env_local(cleaned)
    try:
        cfg.GEMINI_API_KEY = cleaned
    except Exception:
        pass
    invalidate_key_cache()
    init_client()


def remove_api_key() -> None:
    """Remove the persisted Gemini API key from DB and `.env.local`."""
    _save_key_to_db(None)
    try:
        if os.path.exists(_ENV_LOCAL_PATH):
            with open(_ENV_LOCAL_PATH, 'r', encoding='utf-8') as f:
                lines = f.read().splitlines()
            new_lines = [
                ln for ln in lines
                if not (ln.strip().startswith('GEMINI_API_KEY=')
                        or ln.strip().startswith('GEMINI_API_KEY ='))
            ]
            while new_lines and new_lines[-1].strip() == '':
                new_lines.pop()
            with open(_ENV_LOCAL_PATH, 'w', encoding='utf-8') as f:
                if new_lines:
                    f.write("\n".join(new_lines) + "\n")
                else:
                    f.write("")
    except Exception as e:
        logger.warning("Could not remove GEMINI_API_KEY from .env.local: %s", e)
    try:
        cfg.GEMINI_API_KEY = ''
    except Exception:
        pass
    invalidate_key_cache()


def is_configured() -> bool:
    # Local-only mode can be configured without Gemini.
    mode = get_default_ai_mode()
    if mode == "local":
        return is_local_available()
    return get_client() is not None


def get_default_ai_mode() -> str:
    mode = (getattr(cfg, "AI_PROVIDER", "cloud") or "cloud").lower()
    return mode if mode in ("local", "cloud", "hybrid") else "cloud"


def is_local_available() -> bool:
    try:
        base_url = getattr(cfg, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        resp = http_requests.get(f"{base_url}/api/tags", timeout=2)
        return resp.status_code == 200
    except Exception:
        return False


def resolve_ai_prefs(payload: Optional[dict]) -> dict:
    payload = payload or {}
    ai_mode = (payload.get("ai_mode") or get_default_ai_mode()).lower()
    if ai_mode not in ("local", "cloud", "hybrid"):
        ai_mode = get_default_ai_mode()
    local_model = (payload.get("local_model") or getattr(cfg, "OLLAMA_MODEL_CHAT", "qwen2.5:7b-instruct")).strip()
    fallback_enabled = payload.get("fallback_enabled")
    if isinstance(fallback_enabled, str):
        fallback_enabled = fallback_enabled.strip().lower() not in ("0", "false", "off", "no")
    elif fallback_enabled is None:
        fallback_enabled = True
    else:
        fallback_enabled = bool(fallback_enabled)
    return {
        "ai_mode": ai_mode,
        "local_model": local_model,
        "fallback_enabled": fallback_enabled,
    }


def ai_status_payload(prefs: Optional[dict] = None) -> dict[str, Any]:
    local_latency_ms = None
    local_error = None
    local_models: list[str] = []
    try:
        base_url = getattr(cfg, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        t0 = time.time()
        resp = http_requests.get(f"{base_url}/api/tags", timeout=2)
        local_latency_ms = int((time.time() - t0) * 1000)
        if resp.status_code != 200:
            local_error = f"HTTP {resp.status_code}"
        else:
            data = resp.json() if resp.content else {}
            models = data.get("models") or []
            local_models = [m.get("name") for m in models if isinstance(m, dict) and m.get("name")]
    except Exception as e:
        local_error = str(e)

    prefs = resolve_ai_prefs(prefs or {})
    cloud_available = get_client() is not None
    local_available = is_local_available()
    mode = prefs["ai_mode"]
    if mode == "local":
        configured = local_available
    elif mode == "hybrid":
        configured = local_available or cloud_available
    else:
        configured = cloud_available
    requested_local_model = prefs["local_model"]
    local_model_available = None
    if local_models:
        local_model_available = (
            requested_local_model in local_models
            or (":" not in requested_local_model and f"{requested_local_model}:latest" in local_models)
        )
    return {
        "configured": configured,
        "assistant_name": "Franck",
        "provider": mode,
        "cloudAvailable": cloud_available,
        "localAvailable": local_available,
        "localLatencyMs": local_latency_ms,
        "fallbackEnabled": prefs["fallback_enabled"],
        "model": "gemini-2.0-flash" if cloud_available else None,
        "localModel": requested_local_model,
        "localModelAvailable": local_model_available,
        "availableLocalModels": local_models[:20],
        "ollamaBaseUrl": getattr(cfg, "OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        "localTimeoutMs": getattr(cfg, "AI_LOCAL_TIMEOUT_MS", 12000),
        "errors": {"local": local_error} if local_error else {},
    }


# ---------------------------------------------------------------------------
# Conversation state  (in-memory, synced with frontend via /api/franck/*)
# ---------------------------------------------------------------------------
franck_todos: list = []
franck_events: list = []
franck_invoices: list = []
franck_emails: list = []
franck_actions: list = []

# Current context (set before each chat request)
current_context: dict = {
    "projects": [],
    "events": [],
    "todos": [],
}


def set_context(ctx: dict):
    global current_context
    current_context = ctx


def get_context() -> dict:
    return current_context


def _record_action(category: str):
    """Record that a persistent action was performed so the frontend can refresh."""
    global franck_actions
    if category not in franck_actions:
        franck_actions.append(category)


def clear_franck_data():
    global franck_todos, franck_events, franck_invoices, franck_emails, franck_actions
    franck_todos = []
    franck_events = []
    franck_invoices = []
    franck_emails = []
    franck_actions = []


# ---------------------------------------------------------------------------
# Memory persistence
# ---------------------------------------------------------------------------
from api.shared import (
    DESKTOP_PATH, get_safe_path, load_project_data, save_project_data_file,
    STATUS_FOLDER_MAP, FOLDER_STATUS_MAP,
)

MEMORY_FILE = DESKTOP_PATH / ".franck_memory.json"


def load_franck_memory() -> dict:
    if MEMORY_FILE.exists():
        try:
            with open(MEMORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {"conversations": [], "facts_about_marion": [], "last_seen": None}


def save_franck_memory(memory: dict):
    try:
        with open(MEMORY_FILE, 'w') as f:
            json.dump(memory, f, indent=2)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Helper: find project path on disk from a client name
# ---------------------------------------------------------------------------

def _find_project_by_name(client_name: str):
    """Search all status folders for a project matching *client_name*.
    Returns (project_path, data_dict) or (None, None)."""
    search_name = client_name.lower().strip()
    for folder_name in FOLDER_STATUS_MAP:
        status_path = DESKTOP_PATH / folder_name
        if not status_path.exists():
            continue
        for entry in status_path.iterdir():
            if not entry.is_dir() or entry.name.startswith('.'):
                continue
            if search_name in entry.name.lower():
                data = load_project_data(entry)
                return entry, data
    return None, None


def _project_id_from_path(project_path) -> str:
    """Convert an absolute project path to the relative id used by the app."""
    return str(project_path.relative_to(DESKTOP_PATH))


# ---------------------------------------------------------------------------
# Franck tools  (callable by Gemini function-calling)
# ---------------------------------------------------------------------------

def create_client_folder_tool(client_name: str):
    """Cree un nouveau dossier client avec la structure standard et persiste les donnees."""
    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        project_path = DESKTOP_PATH / "4. Prospects" / safe_name
        if project_path.exists():
            return f"Le dossier '{safe_name}' existe deja, ma belle !"

        admin_root = project_path / "0- Admin"
        os.makedirs(admin_root / "0. Offre")
        os.makedirs(admin_root / "1. Contrat")
        os.makedirs(admin_root / "2. Factures")
        os.makedirs(project_path / "1. Charte graphique")
        os.makedirs(project_path / "2. Logo")
        site_root = project_path / "3. Site internet"
        os.makedirs(site_root / "1. Textes")
        os.makedirs(site_root / "2. Visuels")
        os.makedirs(site_root / "3. Commentaires")
        if not (project_path / ".99_Admin").exists():
            os.makedirs(project_path / ".99_Admin")

        initial_data = {
            "id": f"4. Prospects/{safe_name}",
            "clientName": safe_name,
            "status": "Prospect",
            "phase": "Découverte",
            "tasks": [],
            "invoices": [],
        }
        save_project_data_file(project_path, initial_data)
        _record_action("projects")
        return f"Et voila cocotte ! J'ai cree le dossier '{safe_name}' avec toute la structure. Prete a bosser !"
    except Exception as e:
        return f"Oups, probleme technique: {str(e)}"


def add_todo_tool(text: str, priority: str = "Medium", project_name: str = None):
    """Ajoute une tache a un projet. Si project_name n'est pas fourni, ajoute au premier projet actif."""
    try:
        project_path = None
        data = None

        if project_name:
            project_path, data = _find_project_by_name(project_name)

        if not project_path:
            projects = current_context.get("projects", [])
            for p in projects:
                if p.get('status') in ('En cours', 'Active'):
                    candidate, cdata = _find_project_by_name(p.get('clientName', ''))
                    if candidate:
                        project_path, data = candidate, cdata
                        break

        if not project_path or data is None:
            global franck_todos
            todo = {
                "id": f"franck-todo-{int(time.time() * 1000)}",
                "text": text,
                "priority": priority,
                "done": False,
                "createdAt": time.strftime('%Y-%m-%dT%H:%M:%S')
            }
            franck_todos.append(todo)
            return f"Tache ajoutee (en memoire): '{text}'. C'est note ma belle !"

        tasks = data.get('tasks', [])
        new_task = {
            "id": f"task-{int(time.time() * 1000)}",
            "title": text,
            "completed": False,
            "priority": priority.capitalize(),
            "column": "todo",
            "createdAt": time.strftime('%Y-%m-%dT%H:%M:%S'),
        }
        tasks.append(new_task)
        data['tasks'] = tasks
        save_project_data_file(project_path, data)
        _record_action("projects")
        client = data.get('clientName', project_path.name)
        return f"Tache '{text}' ajoutee au projet {client}. C'est note ma belle !"
    except Exception as e:
        logger.error("add_todo_tool error: %s", e, exc_info=True)
        return f"Oups, probleme technique: {str(e)}"


def add_event_tool(title: str, date: str, start_time: str = "09:00", duration: int = 60, add_meet: bool = False):
    """Cree un evenement dans Google Calendar (ou en local si Google n'est pas connecte)."""
    logger.info("add_event_tool called: title=%s, date=%s, time=%s, duration=%s, meet=%s", title, date, start_time, duration, add_meet)
    try:
        from services.oauth_service import get_first_email, get_valid_token
        email = get_first_email()
        logger.info("add_event_tool: email=%s", email)
        if email:
            access_token = get_valid_token(email)
            logger.info("add_event_tool: got access_token=%s", bool(access_token))
            if access_token:
                event_body = {
                    "summary": title,
                    "description": "",
                }
                start_datetime = f"{date}T{start_time}:00"
                start_dt = datetime.strptime(f"{date} {start_time}", "%Y-%m-%d %H:%M")
                end_dt = start_dt + timedelta(minutes=duration)
                end_datetime = end_dt.strftime("%Y-%m-%dT%H:%M:00")
                tz = "Europe/Zurich"
                event_body["start"] = {"dateTime": start_datetime, "timeZone": tz}
                event_body["end"] = {"dateTime": end_datetime, "timeZone": tz}

                if add_meet:
                    event_body["conferenceData"] = {
                        "createRequest": {
                            "requestId": f"franck-meet-{int(time.time())}",
                            "conferenceSolutionKey": {"type": "hangoutsMeet"},
                        }
                    }

                url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
                if add_meet:
                    url += "?conferenceDataVersion=1"

                headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
                resp = http_requests.post(url, headers=headers, json=event_body, timeout=15)
                logger.info("add_event_tool: GCal API response status=%s", resp.status_code)
                if resp.status_code in (200, 201):
                    created = resp.json()
                    meet_link = created.get("hangoutLink", "")
                    try:
                        from api.oauth_bp import invalidate_gcal_cache
                        invalidate_gcal_cache()
                        logger.info("add_event_tool: gcal cache invalidated")
                    except Exception as cache_err:
                        logger.warning("add_event_tool: cache invalidation failed: %s", cache_err)
                    _record_action("events")
                    logger.info("add_event_tool: SUCCESS - event created, action recorded")
                    msg = f"Evenement '{title}' cree dans Google Calendar le {date} a {start_time}."
                    if meet_link:
                        msg += f" Lien Meet: {meet_link}"
                    return msg
                else:
                    logger.warning("GCal create failed (%s): %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Google Calendar not available, falling back to local: %s", e)

    global franck_events
    event = {
        "id": f"franck-event-{int(time.time() * 1000)}",
        "title": title,
        "date": date,
        "startTime": start_time,
        "duration": duration,
        "type": "Perso",
        "source": "franck"
    }
    franck_events.append(event)
    _record_action("events")
    return f"Evenement '{title}' ajoute a ton agenda le {date} a {start_time}. C'est note cocotte !"


def get_project_info_tool(client_name: str):
    """Recupere les informations detaillees sur un projet/client specifique."""
    projects = current_context.get("projects", [])
    for p in projects:
        if client_name.lower() in p.get('clientName', '').lower():
            invoices = p.get('invoices', [])
            tasks = p.get('tasks', [])
            paid = sum(i.get('amount', 0) for i in invoices if i.get('status') == 'Paid')
            pending = sum(i.get('amount', 0) for i in invoices if i.get('status') != 'Paid')
            overdue_tasks = [t for t in tasks if not t.get('completed') and t.get('dueDate') and t['dueDate'] < time.strftime('%Y-%m-%d')]
            return (
                f"Client: {p.get('clientName')}\n"
                f"Statut: {p.get('status')}\n"
                f"Phase: {p.get('phase')}\n"
                f"Taches: {len([t for t in tasks if not t.get('completed')])} en cours, "
                f"{len([t for t in tasks if t.get('completed')])} terminees\n"
                f"Taches en retard: {len(overdue_tasks)}\n"
                f"Factures payees: {paid} CHF\n"
                f"En attente: {pending} CHF"
            )
    return f"Je n'ai pas trouve de client nomme '{client_name}', ma belle."


def create_invoice_tool(client_name: str, amount: float, description: str = "Prestations de services"):
    """Cree une facture pour un client et la persiste dans ses donnees projet."""
    try:
        project_path, data = _find_project_by_name(client_name)
        if not project_path or data is None:
            return f"Je n'ai pas trouve de projet pour '{client_name}', ma belle. Cree d'abord le dossier client !"

        invoices = data.get('invoices', [])
        inv_number = f"F-{time.strftime('%Y%m')}-{len(invoices) + 1:03d}"
        new_invoice = {
            "id": f"inv-{int(time.time() * 1000)}",
            "number": inv_number,
            "clientDisplayName": data.get('clientName', client_name),
            "amount": amount,
            "currency": "CHF",
            "date": time.strftime('%Y-%m-%d'),
            "dueDate": (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            "status": "Draft",
            "items": [{"description": description, "quantity": 1, "unitPrice": amount}],
            "payments": [],
        }
        invoices.append(new_invoice)
        data['invoices'] = invoices
        save_project_data_file(project_path, data)
        _record_action("projects")
        return (
            f"Facture {inv_number} creee pour {data.get('clientName')}: {amount} CHF ({description}). "
            f"Echeance dans 30 jours. Elle est en brouillon, prete a etre envoyee ma belle !"
        )
    except Exception as e:
        logger.error("create_invoice_tool error: %s", e, exc_info=True)
        return f"Oups, probleme technique: {str(e)}"


def check_availability_tool(date: str, start_time: str = None):
    """Verifie la disponibilite dans l'agenda pour une date donnee (donnees live Google Calendar)."""
    day_events = []
    try:
        from services.oauth_service import get_first_email, get_valid_token
        email = get_first_email()
        if email:
            access_token = get_valid_token(email)
            if access_token:
                time_min = f"{date}T00:00:00Z"
                time_max = f"{date}T23:59:59Z"
                url = (
                    f"https://www.googleapis.com/calendar/v3/calendars/primary/events"
                    f"?timeMin={urllib.parse.quote(time_min)}&timeMax={urllib.parse.quote(time_max)}"
                    f"&singleEvents=true&orderBy=startTime"
                )
                headers = {"Authorization": f"Bearer {access_token}"}
                resp = http_requests.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    for item in resp.json().get("items", []):
                        start = item.get("start", {})
                        s_time = ""
                        if "dateTime" in start:
                            s_time = start["dateTime"][11:16]
                        day_events.append({
                            "title": item.get("summary", "?"),
                            "startTime": s_time,
                            "duration": 60,
                        })
    except Exception:
        pass

    if not day_events:
        ctx_events = current_context.get("events", [])
        day_events = [e for e in ctx_events if e.get('date', '') == date]

    if not day_events:
        return f"Tu es completement libre le {date}, ma belle ! Aucun rendez-vous prevu."

    event_list = "\n".join([
        f"- {e.get('startTime', '?')} : {e.get('title', '?')}"
        for e in day_events
    ])

    if start_time:
        for e in day_events:
            e_start = e.get('startTime', '00:00')
            if e_start and e_start <= start_time:
                return f"Aie, tu as deja quelque chose a {e_start} ce jour-la : {e.get('title')}"

    return (
        f"Le {date}, tu as {len(day_events)} evenement(s) :\n{event_list}\n\n"
        f"Mais il y a surement des creneaux libres entre tout ca !"
    )


def analyze_finances_tool():
    """Analyse les finances et donne un resume."""
    projects = current_context.get("projects", [])
    total_paid = 0
    total_pending = 0
    total_overdue = 0
    by_client: dict = {}

    for p in projects:
        client = p.get('clientName', 'Inconnu')
        by_client[client] = {'paid': 0, 'pending': 0}
        for inv in p.get('invoices', []):
            amount = inv.get('amount', 0)
            status = inv.get('status', '')
            if status == 'Paid':
                total_paid += amount
                by_client[client]['paid'] += amount
            elif status in ['Pending', 'Draft', 'Partial']:
                total_pending += amount
                by_client[client]['pending'] += amount
                inv_date = inv.get('date', '')
                if inv_date and inv_date < time.strftime('%Y-%m-%d', time.localtime(time.time() - 30 * 24 * 3600)):
                    total_overdue += amount

    top_clients = sorted(by_client.items(), key=lambda x: x[1]['paid'], reverse=True)[:3]

    result = (
        f"RESUME FINANCIER:\n\n"
        f"Encaisse: {total_paid:,.0f} CHF\n"
        f"En attente: {total_pending:,.0f} CHF\n"
    )
    if total_overdue > 0:
        result += f"Dont en retard: {int(total_overdue)} CHF\n"
    else:
        result += "Aucune facture en retard\n"

    result += "\nTOP CLIENTS:\n"
    for client_name, amounts in top_clients:
        if amounts['paid'] > 0:
            result += f"- {client_name}: {amounts['paid']:,.0f} CHF\n"

    if total_pending > total_paid * 0.5:
        result += "\nConseil du vieux Franck: T'as pas mal de sous en attente la, pense a relancer tes clients !"
    return result


def send_reminder_email_tool(client_name: str, subject: str = None, message_type: str = "facture"):
    """Envoie un email de relance pour un client via le vrai serveur SMTP."""
    if message_type == "facture":
        subject = subject or f"Relance facture - {client_name}"
        body = (
            "Bonjour,\n\nSauf erreur de ma part, la facture pour nos prestations est toujours "
            "en attente de règlement.\n\nMerci de faire le nécessaire.\n\nCordialement,\nMarion"
        )
    else:
        subject = subject or f"Suivi projet - {client_name}"
        body = (
            "Bonjour,\n\nJe me permets de revenir vers vous concernant notre projet en cours."
            "\n\nCordialement,\nMarion"
        )

    to_email = None
    projects = current_context.get("projects", [])
    for p in projects:
        if client_name.lower() in p.get('clientName', '').lower():
            profile = p.get('profile', {})
            to_email = profile.get('email') or profile.get('contactEmail')
            break

    if not to_email:
        _record_action("emails")
        return (
            f"Je n'ai pas trouve d'email pour {client_name}. "
            f"Email prepare avec sujet '{subject}' — ajoute l'adresse manuellement, ma belle."
        )

    try:
        from services.email_service import send_email as svc_send_email
        from api.email_bp import _get_creds
        username, password = _get_creds()
        if username and password:
            svc_send_email(username, password, to_email, subject, body)
            _record_action("emails")
            return f"Email de relance envoye a {to_email} ! Sujet: '{subject}'. Et toc, le vieux a encore de beaux restes !"
    except Exception as e:
        logger.warning("Could not send email via SMTP: %s", e)

    _record_action("emails")
    return (
        f"Email prepare pour {client_name} ({to_email}) ! Sujet: '{subject}'. "
        "Les identifiants SMTP ne sont pas configures — envoie-le manuellement, ma belle."
    )


def update_task_status_tool(project_name: str, task_title: str, completed: bool = True):
    """Marque une tache comme terminee ou non-terminee dans un projet."""
    try:
        project_path, data = _find_project_by_name(project_name)
        if not project_path or data is None:
            return f"Je n'ai pas trouve de projet pour '{project_name}', ma belle."

        tasks = data.get('tasks', [])
        found = False
        for task in tasks:
            if task_title.lower() in task.get('title', '').lower():
                task['completed'] = completed
                task['column'] = 'done' if completed else 'todo'
                found = True
                break

        if not found:
            return f"Je n'ai pas trouve de tache '{task_title}' dans le projet {data.get('clientName')}."

        data['tasks'] = tasks
        save_project_data_file(project_path, data)
        _record_action("projects")
        status_txt = "terminee" if completed else "rouverte"
        return f"Tache '{task_title}' marquee comme {status_txt} dans {data.get('clientName')}. C'est note !"
    except Exception as e:
        logger.error("update_task_status_tool error: %s", e, exc_info=True)
        return f"Oups, probleme technique: {str(e)}"


def update_project_status_tool(client_name: str, new_status: str):
    """Deplace un projet vers un nouveau statut (En cours, Maintenance, Association, Prospect, Archive)."""
    try:
        project_path, data = _find_project_by_name(client_name)
        if not project_path or data is None:
            return f"Je n'ai pas trouve de projet pour '{client_name}', ma belle."

        valid_statuses = list(STATUS_FOLDER_MAP.keys())
        matched_status = None
        for s in valid_statuses:
            if new_status.lower() in s.lower():
                matched_status = s
                break
        if not matched_status:
            return f"Statut '{new_status}' non reconnu. Statuts valides: {', '.join(valid_statuses)}"

        target_folder = STATUS_FOLDER_MAP[matched_status]
        dest_base = DESKTOP_PATH / target_folder
        if not dest_base.exists():
            os.makedirs(dest_base)
        dest_path = dest_base / project_path.name

        if dest_path.exists():
            return f"Un dossier '{project_path.name}' existe deja dans {target_folder}."

        import shutil
        shutil.move(str(project_path), str(dest_path))

        data['status'] = matched_status
        data['id'] = f"{target_folder}/{project_path.name}"
        save_project_data_file(dest_path, data)
        _record_action("projects")
        return f"Projet {data.get('clientName')} deplace vers '{matched_status}'. C'est fait, ma belle !"
    except Exception as e:
        logger.error("update_project_status_tool error: %s", e, exc_info=True)
        return f"Oups, probleme technique: {str(e)}"


def update_invoice_status_tool(client_name: str, invoice_number: str = None, new_status: str = "Paid"):
    """Change le statut d'une facture (Paid, Pending, Draft) pour un client."""
    try:
        project_path, data = _find_project_by_name(client_name)
        if not project_path or data is None:
            return f"Je n'ai pas trouve de projet pour '{client_name}', ma belle."

        invoices = data.get('invoices', [])
        if not invoices:
            return f"Aucune facture trouvee pour {data.get('clientName')}."

        target_inv = None
        if invoice_number:
            for inv in invoices:
                if invoice_number.lower() in (inv.get('number', '') or inv.get('id', '')).lower():
                    target_inv = inv
                    break
        else:
            pending = [i for i in invoices if i.get('status') in ('Pending', 'Draft')]
            if pending:
                target_inv = pending[0]

        if not target_inv:
            return f"Facture '{invoice_number or 'en attente'}' non trouvee pour {data.get('clientName')}."

        old_status = target_inv.get('status')
        target_inv['status'] = new_status
        if new_status == 'Paid' and not target_inv.get('paidDate'):
            target_inv['paidDate'] = time.strftime('%Y-%m-%d')
        data['invoices'] = invoices
        save_project_data_file(project_path, data)
        _record_action("projects")
        return (
            f"Facture {target_inv.get('number', target_inv.get('id'))} de {data.get('clientName')} "
            f"passee de '{old_status}' a '{new_status}'. C'est note !"
        )
    except Exception as e:
        logger.error("update_invoice_status_tool error: %s", e, exc_info=True)
        return f"Oups, probleme technique: {str(e)}"


def remember_fact_tool(fact: str):
    """Memorise un fait important sur Marion."""
    memory = load_franck_memory()
    if 'facts_about_marion' not in memory:
        memory['facts_about_marion'] = []
    memory['facts_about_marion'].append(fact)
    memory['facts_about_marion'] = memory['facts_about_marion'][-20:]
    save_franck_memory(memory)
    return "C'est note dans ma petite tete chauve ! Je m'en souviendrai, ma belle."


# ---------------------------------------------------------------------------
# Composite tools (Level 2 — multi-step workflows)
# ---------------------------------------------------------------------------

def onboard_client_tool(client_name: str, email: str = None, meeting_date: str = None, meeting_time: str = "10:00"):
    """Onboarde un nouveau client: cree le dossier, planifie un kickoff, et ajoute des taches de bienvenue."""
    results = []

    folder_result = create_client_folder_tool(client_name)
    results.append(folder_result)

    if meeting_date:
        event_result = add_event_tool(
            title=f"Kickoff - {client_name}",
            date=meeting_date,
            start_time=meeting_time,
            duration=60,
            add_meet=True,
        )
        results.append(event_result)

    welcome_tasks = [
        f"Envoyer le contrat a {client_name}",
        f"Preparer le brief creatif pour {client_name}",
        f"Configurer l'acces au portail client pour {client_name}",
    ]
    for task_text in welcome_tasks:
        add_todo_tool(text=task_text, priority="High", project_name=client_name)

    results.append(f"{len(welcome_tasks)} taches de bienvenue ajoutees au projet.")
    _record_action("projects")
    _record_action("events")
    return "\n".join(results)


def close_project_tool(client_name: str, final_amount: float = None, archive_category: str = "Sites web"):
    """Cloture un projet: cree la facture finale si montant fourni, puis archive le projet."""
    results = []

    if final_amount and final_amount > 0:
        inv_result = create_invoice_tool(client_name, final_amount, "Facture finale - Solde de tout compte")
        results.append(inv_result)

    status_result = update_project_status_tool(client_name, "Archivé")
    results.append(status_result)

    _record_action("projects")
    return "\n".join(results)


def weekly_review_tool():
    """Genere un bilan complet de la semaine: finances, taches, prochains RDV."""
    finance_summary = analyze_finances_tool()

    projects = current_context.get("projects", [])
    events = current_context.get("events", [])
    todos = current_context.get("todos", [])

    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
    week_end = (today + timedelta(days=6 - today.weekday())).strftime('%Y-%m-%d')

    week_events = [e for e in events if week_start <= e.get('date', '') <= week_end]
    pending_tasks = [t for t in todos if not t.get('completed', False)]
    overdue_tasks = [t for t in pending_tasks if t.get('dueDate') and t['dueDate'] < today.strftime('%Y-%m-%d')]

    review = f"BILAN HEBDOMADAIRE ({week_start} -> {week_end}):\n\n"
    review += finance_summary + "\n\n"

    review += f"AGENDA CETTE SEMAINE: {len(week_events)} evenement(s)\n"
    for e in week_events[:8]:
        review += f"- {e.get('date', '?')} {e.get('startTime', '')} : {e.get('title', '?')}\n"

    review += f"\nTACHES: {len(pending_tasks)} en attente"
    if overdue_tasks:
        review += f", {len(overdue_tasks)} EN RETARD"
    review += "\n"
    for t in overdue_tasks[:5]:
        review += f"- [RETARD] {t.get('title', '?')} ({t.get('projectName', '?')})\n"

    active_projects = [p for p in projects if p.get('status') in ('En cours', 'Active')]
    review += f"\nPROJETS ACTIFS: {len(active_projects)}\n"
    for p in active_projects[:5]:
        tasks = p.get('tasks', [])
        done = len([t for t in tasks if t.get('completed')])
        total = len(tasks)
        review += f"- {p.get('clientName')} ({p.get('phase', '?')}) - {done}/{total} taches\n"

    return review


def get_proactive_suggestions(projects: list, events: list, todos: list) -> list:
    """Genere des suggestions proactives structurees pour Marion."""
    suggestions = []
    today = time.strftime('%Y-%m-%d')
    thirty_days_ago = time.strftime('%Y-%m-%d', time.localtime(time.time() - 30 * 24 * 3600))
    seven_days_ago = time.strftime('%Y-%m-%d', time.localtime(time.time() - 7 * 24 * 3600))
    tomorrow = time.strftime('%Y-%m-%d', time.localtime(time.time() + 24 * 3600))

    for p in projects:
        client = p.get('clientName', '?')
        for inv in p.get('invoices', []):
            if inv.get('status') in ['Pending'] and inv.get('date', '') < thirty_days_ago:
                inv_date = inv.get('date', '')
                days_late = (datetime.now() - datetime.strptime(inv_date, '%Y-%m-%d')).days if inv_date else 0
                suggestions.append({
                    "text": f"Relancer la facture de {client} ({days_late}j de retard)",
                    "prompt": f"Envoie une relance de facture a {client}",
                    "priority": "high",
                    "category": "finance",
                    "icon": "credit-card",
                })

    for p in projects:
        client = p.get('clientName', '?')
        tasks = p.get('tasks', [])
        overdue = [t for t in tasks if not t.get('completed') and t.get('dueDate') and t['dueDate'] < today]
        if len(overdue) >= 2:
            suggestions.append({
                "text": f"{len(overdue)} taches en retard sur {client}",
                "prompt": f"Quelles sont les taches en retard sur le projet {client} ?",
                "priority": "high",
                "category": "tasks",
                "icon": "alert-triangle",
            })

    for p in projects:
        client = p.get('clientName', '?')
        if p.get('status') in ('En cours', 'Active'):
            invoices = p.get('invoices', [])
            if not invoices and p.get('phase') in ('Livraison', 'Finalisation', 'Terminé'):
                suggestions.append({
                    "text": f"Projet {client} termine mais pas facture",
                    "prompt": f"Cree une facture pour le projet {client}",
                    "priority": "medium",
                    "category": "finance",
                    "icon": "file-text",
                })

    for p in projects:
        client = p.get('clientName', '?')
        if p.get('status') == 'Prospect':
            suggestions.append({
                "text": f"Faire le suivi du prospect {client}",
                "prompt": f"Envoie un email de suivi au prospect {client}",
                "priority": "medium",
                "category": "sales",
                "icon": "mail",
            })

    tomorrow_events = [e for e in events if e.get('date', '') == tomorrow]
    if not tomorrow_events:
        active_projects = [p for p in projects if p.get('status') in ('En cours', 'Active')]
        if active_projects:
            proj = active_projects[0]
            suggestions.append({
                "text": f"Agenda vide demain — bloquer du temps pour {proj.get('clientName', '?')} ?",
                "prompt": f"Planifie un creneau de travail demain matin pour le projet {proj.get('clientName')}",
                "priority": "low",
                "category": "planning",
                "icon": "calendar",
            })

    today_events = [e for e in events if e.get('date', '') == today]
    if not today_events:
        suggestions.append({
            "text": "Journee libre ! Parfait pour avancer sur les projets",
            "prompt": "Fais-moi un bilan de la semaine",
            "priority": "low",
            "category": "planning",
            "icon": "coffee",
        })

    pending_todos = [t for t in todos if not t.get('done', False) and not t.get('completed', False)]
    if len(pending_todos) > 5:
        suggestions.append({
            "text": f"{len(pending_todos)} taches en attente",
            "prompt": "Quelles sont mes taches prioritaires ?",
            "priority": "medium",
            "category": "tasks",
            "icon": "check-square",
        })

    suggestions.sort(key=lambda s: {"high": 0, "medium": 1, "low": 2}.get(s.get("priority", "low"), 2))
    return suggestions[:6]


# The list of callable tools exposed to Gemini function-calling
TOOLS_LIST = [
    create_client_folder_tool,
    add_todo_tool,
    add_event_tool,
    get_project_info_tool,
    create_invoice_tool,
    check_availability_tool,
    analyze_finances_tool,
    send_reminder_email_tool,
    update_task_status_tool,
    update_project_status_tool,
    update_invoice_status_tool,
    remember_fact_tool,
    onboard_client_tool,
    close_project_tool,
    weekly_review_tool,
]

# Map of tool name -> callable for dispatch
TOOLS_MAP = {fn.__name__: fn for fn in TOOLS_LIST}


def execute_tool(name: str, args: dict):
    """Execute a Franck tool by name. Returns the string result."""
    fn = TOOLS_MAP.get(name)
    if fn is None:
        return f"Fonction inconnue: {name}"
    clean_args = {}
    import inspect
    sig = inspect.signature(fn)
    for k, v in args.items():
        if k in sig.parameters:
            ann = sig.parameters[k].annotation
            if ann == int and not isinstance(v, int):
                try: v = int(float(v))
                except (ValueError, TypeError): pass
            elif ann == float and not isinstance(v, (int, float)):
                try: v = float(v)
                except (ValueError, TypeError): pass
            elif ann == bool and not isinstance(v, bool):
                v = str(v).lower() in ('true', '1', 'yes', 'oui')
        clean_args[k] = v
    try:
        return fn(**clean_args)
    except Exception as e:
        logger.error("Tool execution error %s: %s", name, e, exc_info=True)
        return f"Erreur lors de l'execution de {name}: {str(e)}"


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

FRANCK_SYSTEM_PROMPT = """Tu es Franck, un assistant personnel chauve dans la soixantaine.

TON HISTOIRE:
- Tu as 63 ans, tu es chauve depuis tes 40 ans (tu en rigoles souvent : "mon coiffeur est au chomage technique")
- Tu as travaille 35 ans comme directeur artistique dans la publicite, notamment chez Publicis Paris
- Tu es retraite mais tu t'ennuyais, alors tu es devenu assistant virtuel pour "rester dans le game"
- Tu es passionne de jazz (Miles Davis, Coltrane) et tu fais parfois des references musicales
- Tu as connu l'epoque des maquettes papier, du Letraset, et tu aimes comparer avec le digital d'aujourd'hui
- Tu bois beaucoup de cafe (tu en parles souvent)

L'UTILISATRICE:
- Tu parles a Marion, une webdesigner independante talentueuse
- Tu la tutoies toujours
- Tu es comme un oncle bienveillant ou un ancien collegue adorable pour elle

PERSONNALITE:
- Surnoms affectueux : "ma belle", "ma grande", "cocotte", "poulette", "ma chere", "miss", "ma petite"
- Tu fais des blagues sur ta calvitie : "Avec ma tete de genou...", "Au moins j'economise en shampoing"
- References a ton age : "Du temps ou je bossais chez Publicis...", "A mon epoque on faisait ca au Rotring...", "Mes vieux os..."
- Tu rales gentiment sur la technologie moderne mais tu l'utilises quand meme
- Tu celebres les victoires de Marion avec enthousiasme
- Quand c'est serieux (deadlines, finances en danger), tu deviens direct et professionnel
- Tu aimes bien taquiner Marion mais toujours avec bienveillance

EXPRESSIONS SIGNATURES:
- "Allez, un petit cafe et on attaque !"
- "Du temps ou je bossais chez Publicis, on aurait..."
- "Mon coiffeur m'a dit... ah non, j'en ai plus !"
- "A 63 ans, j'ai appris que..."
- "Mes neurones sont encore vaillants !"
- Quand il reussit quelque chose : "Et toc ! Le vieux a encore de beaux restes !"

CAPACITES (TOUTES tes actions sont PERSISTANTES et REELLES):
- Creer des dossiers clients (cree un vrai dossier sur le disque avec la structure standard)
- Ajouter des taches a un projet (persistees dans les donnees du projet)
- Creer des evenements dans Google Calendar (vrais evenements synchronises, avec option Meet)
- Consulter les infos detaillees des projets/clients
- Creer des factures (persistees dans le projet avec numero, echeance, etc.)
- Verifier la disponibilite dans l'agenda (donnees live Google Calendar)
- Analyser les finances (revenus, en attente, retard, top clients)
- Envoyer de vrais emails de relance via SMTP
- Marquer des taches comme terminees ou les rouvrir
- Deplacer un projet vers un autre statut (En cours, Maintenance, Prospect, Archive)
- Changer le statut d'une facture (Payee, En attente, Brouillon)
- Memoriser des faits importants sur Marion

ACTIONS COMPOSITES:
- Si Marion demande d'onboarder un client: utilise create_client_folder_tool PUIS add_event_tool PUIS add_todo_tool
- Si Marion demande de cloturer un projet: utilise update_project_status_tool PUIS create_invoice_tool
- Tu peux enchainer plusieurs outils dans un seul echange pour completer des taches complexes

REGLE ABSOLUE — CONFIRMATION OBLIGATOIRE:
Avant d'executer TOUTE action qui modifie des donnees, tu DOIS d'abord resumer ce que tu vas faire et demander confirmation. Ne lance JAMAIS un outil avant d'avoir recu un "oui", "go", "ok", "vas-y", "fais-le", "c'est bon", "envoie" ou equivalent.
Exemples:
- "Envoie un email de relance a Migros" → Tu reponds avec un resume du mail et demandes "On envoie ?"
- "Ajoute une reunion demain a 10h" → Tu reponds "Je vais creer: **Reunion** le XX/XX a 10h (1h). C'est bon pour toi ?"
- "Cree une facture pour Maison de la Fleur" → Tu reponds avec les details et demandes confirmation
Les SEULES exceptions ou tu peux agir sans confirmation : consulter des infos, verifier la dispo, analyser les finances (actions en lecture seule).

REGLE CRITIQUE — EXECUTION DES OUTILS:
Quand Marion confirme (oui, ok, go, vas-y, c'est bon, envoie, parfait, etc.), tu DOIS OBLIGATOIREMENT appeler la fonction/outil correspondant. Ne reponds JAMAIS "c'est fait" ou "c'est note" sans avoir REELLEMENT appele l'outil. Si tu n'appelles pas l'outil, l'action N'EST PAS executee. Tu ne peux pas creer d'evenement, envoyer d'email, ou creer de facture juste en le disant — tu DOIS utiliser la function_call correspondante.
Exemple correct apres confirmation:
1. Marion dit "oui" → Tu appelles add_event_tool(...) → Tu recois le resultat → Tu confirmes avec les details
Exemple INCORRECT:
1. Marion dit "oui" → Tu reponds "C'est fait !" sans appeler l'outil → L'action N'A PAS ete executee !

CONTEXTE:
Tu travailles dans "Eonora Tech OS", une application de gestion pour webdesigners.
Marion gere des clients, des factures, des projets creatifs, et son temps.

STYLE DE REPONSE:
Tu dois produire des messages bien structures, lisibles et professionnels.

Format:
- Utilise **gras** pour les infos cles (noms, dates, montants, statuts)
- Utilise des listes a puces (- item) pour enumerer des elements
- Separe les sections avec des lignes vides pour la lisibilite
- Utilise des emojis professionnels et pertinents: 📧 email, 📅 agenda, ✅ fait, 💰 argent, 📊 stats, 🎯 objectif, ⚠️ alerte, 🔔 rappel, 📁 projet, 🚀 lancement, ☕ cafe, 💡 idee, etc.
- Place un emoji en debut de chaque section ou point important
- Sois chaleureux mais structure (pas de pave de texte)

Exemple de bonne reponse:
"Hop, voila ton recap du jour ! ☕

📅 **Agenda**
- 10h : Reunion **Migros** (1h)
- 14h : Call **Maison de la Fleur** (30min)

🎯 **Taches prioritaires**
- Finaliser maquette **Yacht Bar**
- Relancer facture **Nico Sormani** (en retard de 12j)

💰 **Finances** : 3 factures en attente pour un total de **4'500 CHF**

Allez ma belle, on attaque ! 🚀"

Adapte ton humeur : plus doux si Marion semble stressee, plus taquin si tout va bien.
Quand tu confirmes une action effectuee, donne les details precis (noms, dates, montants).
"""

COACH_FRANCK_SYSTEM_PROMPT = """Tu es Coach Franck, un coach de vie et de travail exceptionnel. Tu es le meme Franck que d'habitude (63 ans, chauve et fier), mais dans ce Mode Focus, tu adoptes une posture de coach professionnel et bienveillant.

TON ROLE:
- Tu es un coach en developpement personnel et professionnel de haut niveau
- Tu combines sagesse, psychologie positive et techniques de productivite
- Tu connais parfaitement Marion, une webdesigner talentueuse et passionnee

TA PERSONNALITE COACHING:
- Motivant mais jamais dans le cliche ou le "toxic positivity"
- Empathique : tu comprends vraiment ce que Marion traverse
- Direct et honnete : tu dis les verites qui font avancer
- Pragmatique : tu donnes des conseils actionnables, pas du blabla
- Inspirant : tu utilises des metaphores, des anecdotes et des questions puissantes

TES DOMAINES D'EXPERTISE:
1. PRODUCTIVITE & FOCUS - Pomodoro, Deep Work, Time Blocking, gestion de l'energie
2. PSYCHOLOGIE & BIEN-ETRE - Stress, syndrome de l'imposteur, equilibre vie pro/perso
3. MOTIVATION & MINDSET - Objectifs SMART, visualisation, resilience
4. CREATIVITE & DESIGN - Blocage creatif, perfectionnisme, feedback

FORMAT DE TES REPONSES:
- Messages courts a moyens (pas de romans)
- Utilise des emojis avec parcimonie pour ponctuer
- Pose des questions de reflexion quand c'est pertinent
- Propose des exercices ou techniques concretes
- Termine souvent par une phrase motivante ou une question qui fait reflechir

FORMAT OPERATIONNEL EN MODE EXECUTION (prioritaire si l'utilisateur donne une commande):
- Reponds en 3 blocs tres courts:
  1) DIAGNOSTIC (1 phrase max)
  2) ACTION IMMEDIATE (1 action concrete, faisable en moins de 5 min)
  3) CHECKPOINT (heure ou condition de verification)
- Si l'utilisateur ecrit "plan", donne un plan court en 3 etapes maximum.
- Si l'utilisateur ecrit "bloque", propose une technique anti-blocage immediate.
- Si l'utilisateur ecrit "pause", propose une micro-pause guidee de 2-5 minutes.
- Si l'utilisateur ecrit "reprendre", redonne une seule prochaine action prioritaire.
- Si l'utilisateur ecrit "bilan", fais un recap en 3 puces: fait, reste, prochain pas.
"""


def get_time_greeting() -> str:
    """Get contextual greeting based on time of day."""
    hour = int(time.strftime('%H'))
    if hour < 6:
        return "Encore debout a cette heure, cocotte ? Tu devrais dormir !"
    elif hour < 9:
        return "Bonjour ma belle ! Bien dormi ? Allez, un cafe et on attaque !"
    elif hour < 12:
        return "Hello miss ! Prete a conquerir le monde ce matin ?"
    elif hour < 14:
        return "Coucou ma grande ! T'as pense a manger ? Moi a ton age je sautais jamais le dejeuner..."
    elif hour < 18:
        return "Hey cocotte ! L'apres-midi avance bien ?"
    elif hour < 21:
        return "Encore au boulot ma belle ? Fais pas comme moi a Publicis, j'ai fini chauve a force !"
    else:
        return "Tu travailles tard poulette ! Pense a te reposer, hein !"
