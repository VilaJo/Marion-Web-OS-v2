"""
Projects Blueprint - Project CRUD routes
Handles: scan, save, move, archive, delete
"""

import os
import json
import shutil
from flask import Blueprint, request, jsonify

from services.logger import get_logger
from api.shared import (
    DESKTOP_PATH, get_safe_path, init_db_structure,
    load_project_data, save_project_data_file, get_project_progress,
    save_avatar_file, load_avatar_file,
    FOLDER_STATUS_MAP, STATUS_FOLDER_MAP, ARCHIVE_CATEGORIES,
    error_response, validate_json,
)

logger = get_logger('api.projects')
projects_bp = Blueprint('projects', __name__, url_prefix='/api/v1/projects')


@projects_bp.route('/scan', methods=['GET'])
def scan_projects():
    """Scan all project folders and return project data."""
    projects = []

    try:
        for folder_name, status in FOLDER_STATUS_MAP.items():
            status_path = DESKTOP_PATH / folder_name
            if not status_path.exists():
                continue

            def process_entry(entry):
                data = load_project_data(entry)
                avatar_img = load_avatar_file(entry) or data.get('avatarImage')
                progress = get_project_progress(entry, data.get('tasks', []))
                return {
                    "id": str(entry.relative_to(DESKTOP_PATH)),
                    "name": entry.name,
                    "clientName": entry.name,
                    "status": status,
                    "path": str(entry.relative_to(DESKTOP_PATH)),
                    "progress": progress,
                    "tasks": data.get('tasks', []),
                    "invoices": data.get('invoices', []),
                    "profile": data.get('profile', {}),
                    "brandKit": data.get('brandKit', {}),
                    "credentials": data.get('credentials', []),
                    "moodboard": data.get('moodboard', []),
                    "avatarImage": avatar_img,
                    "avatarColor": data.get('avatarColor'),
                    "avatarInitials": data.get('avatarInitials', entry.name[:2].upper()),
                    "logoLabData": data.get('logoLabData'),
                    "logoTransform": data.get('logoTransform'),
                    "phase": data.get('phase'),
                    "maintenance": data.get('maintenance'),
                    "createdAt": data.get('createdAt'),
                    "portalSettings": data.get('portalSettings'),
                    "portalComments": data.get('portalComments'),
                    "archiveCategory": None,
                }

            for entry in status_path.iterdir():
                if entry.is_dir() and not entry.name.startswith('.'):
                    if folder_name in ("5. Archivés", "Archivé") and entry.name in ARCHIVE_CATEGORIES:
                        for sub in entry.iterdir():
                            if sub.is_dir() and not sub.name.startswith('.'):
                                p = process_entry(sub)
                                p['archiveCategory'] = entry.name
                                projects.append(p)
                    else:
                        projects.append(process_entry(entry))
        # Sync portal settings to DB for any project that has an active portal
        try:
            import json as _json
            from database.db import get_db, get_project_by_external_id
            for p in projects:
                ps = p.get('portalSettings')
                if ps and isinstance(ps, dict) and ps.get('enabled') and ps.get('shareToken'):
                    ext_id = p.get('id', '')
                    pin = ps.get('pin', '')
                    portal_json = _json.dumps(ps)
                    phase = p.get('phase', 'Découverte')
                    client_name = p.get('clientName', ext_id.split('/')[-1])
                    proj = get_project_by_external_id(ext_id)
                    if proj:
                        with get_db() as conn:
                            conn.execute(
                                "UPDATE projects SET portal_settings_json = ?, portal_pin = ?, phase = ?, client_name = ? WHERE id = ?",
                                (portal_json, pin if pin else None, phase, client_name, proj['id'])
                            )
                    else:
                        with get_db() as conn:
                            conn.execute(
                                """INSERT INTO projects (workspace_id, external_id, client_name, status, phase, portal_pin, portal_settings_json)
                                   VALUES (1, ?, ?, 'Active', ?, ?, ?)""",
                                (ext_id, client_name, phase, pin if pin else None, portal_json)
                            )
        except Exception:
            pass  # non-critical, don't break scan

        # Optional pagination - backwards compatible
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', default=0, type=int) or 0

        # If no limit provided, preserve existing response shape
        if limit is None:
            return jsonify({"projects": projects})

        if offset < 0:
            offset = 0
        total = len(projects)
        sliced = projects[offset: offset + limit]
        has_more = (offset + limit) < total

        return jsonify({
            "projects": sliced,
            "total": total,
            "hasMore": has_more,
        })
    except Exception as e:
        return error_response(e)


@projects_bp.route('/save', methods=['POST'])
@validate_json({"required": ["id"], "types": {"id": str}})
def save_project():
    """Save project data to disk."""
    data = request.json
    project_id = data.get('id')

    try:
        project_path = get_safe_path(project_id)
        if not project_path.exists():
            return jsonify({"error": "Project not found"}), 404

        # Handle avatar image
        avatar_data = data.get('avatarImage')
        if avatar_data and str(avatar_data).startswith('data:'):
            save_avatar_file(project_path, avatar_data)
            if 'avatarImage' in data:
                del data['avatarImage']

        save_project_data_file(project_path, data)
        progress = get_project_progress(project_path, data.get('tasks', []))

        # Sync portal settings + maintenance to database for public portal access
        portal_settings = data.get('portalSettings')
        if portal_settings and isinstance(portal_settings, dict):
            try:
                import json as _json
                from database.db import get_db, get_project_by_external_id
                pin = portal_settings.get('pin', '')
                portal_json = _json.dumps(portal_settings)
                maintenance_json = _json.dumps(data.get('maintenance') or {})
                phase = data.get('phase', 'Découverte')
                progress = data.get('progress', 0)
                client_name = project_id.split('/')[-1] if '/' in project_id else project_id
                proj = get_project_by_external_id(project_id)
                if proj:
                    with get_db() as conn:
                        conn.execute(
                            """UPDATE projects SET portal_pin = ?, portal_settings_json = ?, 
                               phase = ?, client_name = ?, maintenance_json = ?, progress = ?
                               WHERE id = ?""",
                            (pin if pin else None, portal_json, phase, client_name,
                             maintenance_json, progress, proj['id'])
                        )
                        # Sync invoices to database
                        invoices = data.get('invoices', [])
                        if invoices:
                            existing = [r['external_id'] for r in conn.execute(
                                "SELECT external_id FROM invoices WHERE project_id = ?", (proj['id'],)
                            ).fetchall() if r['external_id']]
                            for inv in invoices:
                                inv_id = inv.get('id', '')
                                if inv_id and inv_id not in existing:
                                    conn.execute(
                                        """INSERT INTO invoices (project_id, external_id, number, date, due_date,
                                           client_address, client_display_name, amount, currency, status,
                                           items_json, payments_json, payment_link, footer_note)
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                                        (proj['id'], inv_id, inv.get('number', ''),
                                         inv.get('date', ''), inv.get('dueDate'),
                                         inv.get('clientAddress'), inv.get('clientDisplayName'),
                                         inv.get('amount', 0), inv.get('currency', 'CHF'),
                                         inv.get('status', 'Draft'),
                                         _json.dumps(inv.get('items', [])),
                                         _json.dumps(inv.get('payments', [])),
                                         inv.get('paymentLink'), inv.get('footerNote'))
                                    )
                                elif inv_id and inv_id in existing:
                                    conn.execute(
                                        """UPDATE invoices SET number = ?, date = ?, due_date = ?,
                                           amount = ?, currency = ?, status = ?,
                                           items_json = ?, payments_json = ?
                                           WHERE project_id = ? AND external_id = ?""",
                                        (inv.get('number', ''), inv.get('date', ''), inv.get('dueDate'),
                                         inv.get('amount', 0), inv.get('currency', 'CHF'),
                                         inv.get('status', 'Draft'),
                                         _json.dumps(inv.get('items', [])),
                                         _json.dumps(inv.get('payments', [])),
                                         proj['id'], inv_id)
                                    )
                else:
                    # Create project row if it doesn't exist yet
                    with get_db() as conn:
                        conn.execute(
                            """INSERT INTO projects (workspace_id, external_id, client_name, status, phase,
                               portal_pin, portal_settings_json, maintenance_json, progress)
                               VALUES (1, ?, ?, 'Active', ?, ?, ?, ?, ?)""",
                            (project_id, client_name, phase, pin if pin else None,
                             portal_json, maintenance_json, progress)
                        )
            except Exception as sync_err:
                logger.warning("[Sync] DB sync warning: %s", sync_err)
                pass  # non-critical

        return jsonify({"success": True, "progress": progress})
    except Exception as e:
        return error_response(e)


@projects_bp.route('/move', methods=['POST'])
@validate_json({"required": ["clientName", "newStatus"], "types": {"clientName": str, "newStatus": str}})
def move_project_status():
    """Move a project between status folders (Active, Prospect, Archived, etc.)"""
    data = request.json
    client_name = data.get('clientName')
    new_status = data.get('newStatus')
    archive_category = data.get('archiveCategory')

    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()

        # Find the current project folder
        source_path = None
        for folder in ["1. En cours", "2. Maintenances", "3. Associations", "4. Prospects", "5. Archivés",
                       "Prospect", "Actif", "Pro bono", "Perso", "Archivé"]:
            p = DESKTOP_PATH / folder / safe_name
            if p.exists():
                source_path = p
                break
            if folder in ("5. Archivés", "Archivé"):
                archive_path = DESKTOP_PATH / folder
                if archive_path.exists():
                    for sub in [d for d in archive_path.iterdir() if d.is_dir()]:
                        if (sub / safe_name).exists():
                            source_path = sub / safe_name
                            break

        if not source_path:
            return jsonify({"error": "Project not found"}), 404

        # Determine destination
        dest_base = DESKTOP_PATH / STATUS_FOLDER_MAP.get(new_status, "4. Prospects")
        if new_status in ("Archived", "Archivé") and archive_category:
            dest_path = dest_base / archive_category / safe_name
        else:
            dest_path = dest_base / safe_name

        if not dest_path.parent.exists():
            os.makedirs(dest_path.parent)

        if str(source_path) != str(dest_path):
            shutil.move(str(source_path), str(dest_path))

        # Update status in project.json
        try:
            json_path = dest_path / ".99_Admin" / "project.json"
            if json_path.exists():
                with open(json_path, 'r') as f:
                    p_data = json.load(f)
                p_data['status'] = new_status
                if new_status in ("Archived", "Archivé"):
                    p_data['archiveCategory'] = archive_category
                with open(json_path, 'w') as f:
                    json.dump(p_data, f, indent=2)
        except Exception:
            pass

        return jsonify({"success": True, "path": str(dest_path.relative_to(DESKTOP_PATH))})
    except Exception as e:
        return error_response(e)


@projects_bp.route('/archive', methods=['POST'])
def archive_project():
    """Archive a project (delegates to move)."""
    return move_project_status()


@projects_bp.route('/delete', methods=['DELETE'])
def delete_project():
    """Delete a project folder entirely."""
    client_name = request.args.get('clientName')
    if not client_name:
        # Try by ID
        project_id = request.args.get('id')
        if project_id:
            try:
                target_path = get_safe_path(project_id)
                if target_path.exists() and str(target_path).startswith(str(DESKTOP_PATH)):
                    shutil.rmtree(target_path)
                    return jsonify({"success": True})
            except Exception as e:
                return error_response(e)
        return jsonify({"error": "Client name or ID required"}), 400

    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        target_path = None
        for folder in ["1. En cours", "2. Maintenances", "3. Associations", "4. Prospects", "5. Archivés",
                       "Prospect", "Actif", "Archivé", "Pro bono", "Perso"]:
            p = DESKTOP_PATH / folder / safe_name
            if p.exists():
                target_path = p
                break
            # Also search inside archive sub-categories
            if folder in ("5. Archivés", "Archivé"):
                archive_path = DESKTOP_PATH / folder
                if archive_path.exists():
                    for sub in [d for d in archive_path.iterdir() if d.is_dir()]:
                        if (sub / safe_name).exists():
                            target_path = sub / safe_name
                            break
                if target_path:
                    break

        if target_path and str(target_path).startswith(str(DESKTOP_PATH)):
            shutil.rmtree(target_path)
            return jsonify({"success": True})
        return jsonify({"error": "Project not found"}), 404
    except Exception as e:
        return error_response(e)
