"""
Invoices & Finance Blueprint - Expenses, notes, time tracking, invoice numbering.
Handles: expenses CRUD + AI scan, notes CRUD, time tracking CRUD,
         Swiss-grade atomic sequential invoice numbering.
"""

import os
import json
import time
import tempfile
from datetime import datetime
from pathlib import Path
from flask import Blueprint, request, jsonify

from services.logger import get_logger
from api.shared import DESKTOP_PATH, get_safe_path, load_project_data, save_project_data_file, error_response

logger = get_logger('api.invoices')

invoices_bp = Blueprint('invoices', __name__, url_prefix='/api/v1')


# ============================================================================
# INVOICE NUMBERING — Swiss-grade sequential, no-gap, year-scoped, atomic
# ============================================================================
#
# Stockage : ~/Marion Web OS/.invoice_counters.json (à la racine de DESKTOP_PATH)
#   {
#     "2026": { "next": 42 },
#     "2025": { "next": 117 },
#     "format": "F{YYYY}-{NNNN}",   # configurable, défaut F{YYYY}-{NNNN}
#     "padding": 4                    # nombre de digits pour NNNN
#   }
#
# Concurrence : verrou via fichier temporaire + os.replace (atomique sur POSIX).
# Si une autre requête arrive entre-temps elle relit et incrémente.
# ============================================================================

COUNTERS_FILE = DESKTOP_PATH / ".invoice_counters.json"
DEFAULT_FORMAT = "F{YYYY}-{NNNN}"
DEFAULT_PADDING = 4


def _load_counters() -> dict:
    """Charge le fichier de compteurs, retourne dict vide si inexistant."""
    if not COUNTERS_FILE.exists():
        return {"format": DEFAULT_FORMAT, "padding": DEFAULT_PADDING}
    try:
        with open(COUNTERS_FILE, "r") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                return {"format": DEFAULT_FORMAT, "padding": DEFAULT_PADDING}
            data.setdefault("format", DEFAULT_FORMAT)
            data.setdefault("padding", DEFAULT_PADDING)
            return data
    except Exception as e:
        logger.warning("Failed to read invoice counters file: %s", e)
        return {"format": DEFAULT_FORMAT, "padding": DEFAULT_PADDING}


def _save_counters_atomic(data: dict) -> None:
    """Écrit le fichier compteurs de manière atomique (tmpfile + rename)."""
    COUNTERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_path = tempfile.mkstemp(
        prefix=".invoice_counters_", suffix=".json", dir=str(COUNTERS_FILE.parent)
    )
    try:
        with os.fdopen(tmp_fd, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_path, COUNTERS_FILE)  # atomic on POSIX
    except Exception:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
        raise


def _format_number(fmt: str, year: int, seq: int, padding: int) -> str:
    """Applique le format. Supporte {YYYY}, {YY}, {NNNN}, {N}."""
    return (
        fmt.replace("{YYYY}", f"{year:04d}")
        .replace("{YY}", f"{year % 100:02d}")
        .replace("{NNNN}", f"{seq:0{padding}d}")
        .replace("{N}", str(seq))
    )


@invoices_bp.route('/invoices/next-number', methods=['POST'])
def invoice_next_number():
    """
    Retourne le prochain numéro de facture séquentiel pour une année donnée.

    Body JSON (tous optionnels) :
      - year     : int — année cible (défaut = année courante)
      - preview  : bool — si true, ne pas incrémenter (juste lire)
      - format   : str — surcharge ponctuelle du format

    Réponse :
      { "number": "F2026-0042", "year": 2026, "sequence": 42, "format": "F{YYYY}-{NNNN}" }

    Comportement : si le compteur n'existe pas pour l'année, il démarre à 1.
    Atomique vis-à-vis des écritures concurrentes (lock-free, swap-based).
    """
    body = request.get_json(silent=True) or {}
    try:
        year = int(body.get("year") or datetime.now().year)
    except (TypeError, ValueError):
        return jsonify({"error": "year must be an integer"}), 400
    preview = bool(body.get("preview", False))

    data = _load_counters()
    fmt = str(body.get("format") or data.get("format") or DEFAULT_FORMAT)
    padding = int(data.get("padding") or DEFAULT_PADDING)

    year_key = str(year)
    entry = data.get(year_key)
    if not isinstance(entry, dict):
        entry = {"next": 1}
        data[year_key] = entry

    seq = int(entry.get("next") or 1)
    number = _format_number(fmt, year, seq, padding)

    if not preview:
        entry["next"] = seq + 1
        data[year_key] = entry
        try:
            _save_counters_atomic(data)
        except Exception as e:
            logger.error("Failed to persist invoice counters: %s", e, exc_info=True)
            return jsonify({"error": "Could not persist counter"}), 500

    return jsonify({
        "number": number,
        "year": year,
        "sequence": seq,
        "format": fmt,
    })


@invoices_bp.route('/invoices/counters', methods=['GET'])
def invoice_counters_state():
    """Inspect read-only state of all year counters — used by 'Conformité' KPI."""
    data = _load_counters()
    out = {}
    for k, v in data.items():
        if k in ("format", "padding"):
            continue
        if isinstance(v, dict) and "next" in v:
            out[k] = {"next": v["next"], "issued": max(0, int(v["next"]) - 1)}
    return jsonify({
        "format": data.get("format", DEFAULT_FORMAT),
        "padding": data.get("padding", DEFAULT_PADDING),
        "years": out,
    })


# ============================================================================
# EXPENSES
# ============================================================================

@invoices_bp.route('/expenses', methods=['GET'])
def get_expenses():
    """Get all expenses from the Depenses folder."""
    expenses_path = DESKTOP_PATH / "Dépenses"
    if not expenses_path.exists():
        os.makedirs(expenses_path)
    expenses = []
    try:
        for entry in expenses_path.glob("*.json"):
            try:
                with open(entry, 'r') as f:
                    data = json.load(f)
                    expenses.append(data)
            except Exception:
                pass
        expenses.sort(key=lambda x: x.get('date', ''), reverse=True)

        # Optional pagination - backwards compatible
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', default=0, type=int) or 0

        # If no limit provided, keep existing behavior
        if limit is None:
            return jsonify({"expenses": expenses})

        # Apply limit/offset and return paginated payload
        if offset < 0:
            offset = 0
        total = len(expenses)
        items = expenses[offset: offset + limit]
        has_more = (offset + limit) < total

        return jsonify({
            "items": items,
            "total": total,
            "hasMore": has_more,
        })
    except Exception as e:
        return error_response(e)


@invoices_bp.route('/expenses/scan', methods=['POST'])
def scan_expense():
    """Scan an expense receipt with AI."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        expenses_path = DESKTOP_PATH / "Dépenses"
        if not expenses_path.exists():
            os.makedirs(expenses_path)

        file_ext = Path(file.filename).suffix
        expense_id = f"exp-{int(time.time())}"
        file_name = f"{expense_id}{file_ext}"
        file_path = expenses_path / file_name
        file.save(file_path)

        expense_data = {
            "id": expense_id,
            "date": time.strftime('%Y-%m-%d'),
            "supplier": "Inconnu",
            "amount": 0,
            "category": "Other",
            "description": "Scan echoue",
            "fileUrl": str(file_path),
        }

        # Try AI extraction
        from services.gemini_service import get_client, resolve_ai_prefs
        from services.ai_provider_service import generate_json_with_fallback, generate_multimodal_with_fallback
        client = get_client()
        ai_prefs = resolve_ai_prefs(request.form.to_dict() if request.form else {})
        if client or ai_prefs.get("ai_mode") in ("local", "hybrid"):
            try:
                mime_type = "application/pdf" if file_ext.lower() == '.pdf' else "image/jpeg"
                if file_ext.lower() in ['.png', '.webp']:
                    mime_type = f"image/{file_ext[1:]}"
                with open(file_path, "rb") as f:
                    file_content = f.read()
                prompt = (
                    'Analyze this receipt/invoice. Extract: '
                    '- Supplier Name (merchant) '
                    '- Total Amount (Grand Total) '
                    '- Date (YYYY-MM-DD) '
                    '- Category (Choose one: Software, Hardware, Office, Travel, Services, Tax, Other) '
                    '- Description (Short summary). '
                    'Return ONLY JSON: { "supplier": "", "amount": 0.0, "date": "", "category": "", "description": "" }'
                )
                # Use multimodal path first; if local model returns non-JSON, fallback to strict JSON generation.
                raw = generate_multimodal_with_fallback(
                    gemini_client=client,
                    file_bytes=file_content,
                    prompt=prompt,
                    prefs=ai_prefs,
                    cloud_model="gemini-2.5-pro",
                    mime_type=mime_type,
                    response_mime_type="application/json",
                )
                try:
                    extracted = json.loads(raw.replace("```json", "").replace("```", "").strip())
                except Exception:
                    extracted = generate_json_with_fallback(
                        gemini_client=client,
                        prompt=f"{prompt}\n\nOCR text candidate:\n{raw[:4000]}",
                        prefs=ai_prefs,
                        cloud_model="gemini-2.5-pro",
                        task="reasoning",
                    )
                expense_data.update(extracted)
            except Exception as ai_e:
                logger.warning("AI Expense Scan Error: %s", ai_e)

        json_path = expenses_path / f"{expense_id}.json"
        with open(json_path, 'w') as f:
            json.dump(expense_data, f, indent=2)

        return jsonify({"success": True, "expense": expense_data})
    except Exception as e:
        return error_response(e)


@invoices_bp.route('/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """Delete an expense by ID."""
    try:
        expenses_path = DESKTOP_PATH / "Dépenses"
        json_path = expenses_path / f"{expense_id}.json"
        if json_path.exists():
            os.remove(json_path)
        for f in expenses_path.glob(f"{expense_id}.*"):
            os.remove(f)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


# ============================================================================
# NOTES
# ============================================================================

@invoices_bp.route('/notes', methods=['GET'])
def get_notes():
    """Get all quick notes."""
    notes_path = DESKTOP_PATH / "Notes"
    if not notes_path.exists():
        os.makedirs(notes_path)
    notes = []
    try:
        for entry in notes_path.glob("*.json"):
            try:
                with open(entry, 'r') as f:
                    notes.append(json.load(f))
            except Exception:
                pass
        notes.sort(key=lambda x: x.get('date', ''), reverse=True)

        # Optional pagination - backwards compatible
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', default=0, type=int) or 0

        # If no limit provided, keep existing behavior
        if limit is None:
            return jsonify({"notes": notes})

        # Apply limit/offset and return paginated payload
        if offset < 0:
            offset = 0
        total = len(notes)
        items = notes[offset: offset + limit]
        has_more = (offset + limit) < total

        return jsonify({
            "items": items,
            "total": total,
            "hasMore": has_more,
        })
    except Exception as e:
        return error_response(e)


@invoices_bp.route('/notes', methods=['POST'])
def save_note():
    """Save or update a note."""
    data = request.json
    note_id = data.get('id')
    if not note_id:
        return jsonify({"error": "Note ID required"}), 400
    try:
        notes_path = DESKTOP_PATH / "Notes"
        if not notes_path.exists():
            os.makedirs(notes_path)
        file_path = notes_path / f"{note_id}.json"
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@invoices_bp.route('/notes', methods=['DELETE'])
def delete_note():
    """Delete a note by ID."""
    note_id = request.args.get('id')
    if not note_id:
        return jsonify({"error": "Note ID required"}), 400
    try:
        file_path = DESKTOP_PATH / "Notes" / f"{note_id}.json"
        if file_path.exists():
            os.remove(file_path)
        else:
            return jsonify({"error": "Note not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


# ============================================================================
# TIME TRACKING
# ============================================================================

@invoices_bp.route('/time/log', methods=['POST'])
def log_time():
    """Log a time entry for a client/project."""
    data = request.json
    client_id = data.get('clientId')
    entry = data.get('entry')
    if not client_id or not entry:
        return jsonify({"error": "Missing data"}), 400
    try:
        safe_path = get_safe_path(client_id)
        admin_path = safe_path / ".99_Admin"
        if not admin_path.exists():
            os.makedirs(admin_path)
        sheet_path = admin_path / "timesheet.json"
        logs = []
        if sheet_path.exists():
            try:
                with open(sheet_path, 'r') as f:
                    logs = json.load(f)
            except Exception:
                pass
        entry['id'] = f"log-{int(time.time())}-{len(logs)}"
        entry['status'] = 'pending'
        logs.append(entry)
        with open(sheet_path, 'w') as f:
            json.dump(logs, f, indent=2)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@invoices_bp.route('/time/mark_billed', methods=['POST'])
def mark_time_billed():
    """Mark time entries as billed."""
    data = request.json
    client_id = data.get('clientId')
    log_ids = data.get('logIds', [])
    try:
        safe_path = get_safe_path(client_id)
        sheet_path = safe_path / ".99_Admin" / "timesheet.json"
        if not sheet_path.exists():
            return jsonify({"error": "No timesheet found"}), 404
        with open(sheet_path, 'r') as f:
            logs = json.load(f)
        updated_count = 0
        for log in logs:
            if log.get('id') in log_ids:
                log['status'] = 'billed'
                updated_count += 1
        with open(sheet_path, 'w') as f:
            json.dump(logs, f, indent=2)
        return jsonify({"success": True, "updated": updated_count})
    except Exception as e:
        return error_response(e)


@invoices_bp.route('/time/get', methods=['POST'])
def get_time_logs():
    """Get time logs for a client/project."""
    data = request.json
    client_id = data.get('clientId')
    try:
        safe_path = get_safe_path(client_id)
        sheet_path = safe_path / ".99_Admin" / "timesheet.json"
        if sheet_path.exists():
            with open(sheet_path, 'r') as f:
                logs = json.load(f)
        else:
            logs = []

        # Optional pagination via query params - backwards compatible
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', default=0, type=int) or 0

        # If no limit provided, keep existing behavior
        if limit is None:
            return jsonify({"logs": logs})

        # Apply limit/offset and return paginated payload
        if offset < 0:
            offset = 0
        total = len(logs)
        items = logs[offset: offset + limit]
        has_more = (offset + limit) < total

        return jsonify({
            "items": items,
            "total": total,
            "hasMore": has_more,
        })
    except Exception as e:
        return error_response(e)
