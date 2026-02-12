"""
Portal Blueprint - Public client portal + admin management routes.

Public endpoints (no Marion auth required, portal PIN auth):
  POST /api/v1/portal/<token>/auth      - Authenticate with PIN
  GET  /api/v1/portal/<token>           - Get portal data
  POST /api/v1/portal/<token>/comment   - Add a comment
  POST /api/v1/portal/<token>/upload    - Upload a file
  GET  /api/v1/portal/<token>/files     - List uploaded files
  GET  /api/v1/portal/<token>/activity  - Merged activity feed

Admin endpoints (Marion auth required):
  POST   /api/v1/portal/deliverable          - Create/update deliverable
  DELETE /api/v1/portal/deliverable/<id>     - Delete deliverable
  GET    /api/v1/portal/deliverables/<pid>   - List deliverables for project
  POST   /api/v1/portal/update               - Create an update
  DELETE /api/v1/portal/update/<id>          - Delete an update
  GET    /api/v1/portal/updates/<pid>        - List updates for project
  GET    /api/v1/portal/comments/<pid>       - List comments for project
  POST   /api/v1/portal/comments/<pid>/seen  - Mark comments as seen
  DELETE /api/v1/portal/comment/<id>         - Delete a comment
  POST   /api/v1/portal/comment              - Admin reply (comment)
  GET    /api/v1/portal/client-files/<pid>   - List client files
  DELETE /api/v1/portal/client-files/<id>    - Delete a client file
  GET    /api/v1/portal/client-files/<id>/download - Download a client file
  POST   /api/v1/portal/client-files/<pid>/seen   - Mark files as seen
  GET    /api/v1/portal/unseen/<pid>         - Get unseen counts
"""

import os
import json
import uuid
import hashlib
import hmac
import time
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from services.logger import get_logger

logger = get_logger('api.portal')

from database.db import (
    get_project_by_portal_token, verify_portal_pin, get_project,
    get_project_by_external_id,
    create_portal_deliverable, get_portal_deliverables,
    update_portal_deliverable, delete_portal_deliverable,
    create_portal_update, get_portal_updates, delete_portal_update,
    create_portal_comment, get_portal_comments, delete_portal_comment,
    mark_portal_comments_seen, count_unseen_portal_comments,
    create_portal_client_file, get_portal_client_files,
    delete_portal_client_file, mark_portal_files_seen, count_unseen_portal_files,
    get_portal_activity,
    create_portal_document, get_portal_documents,
    update_portal_document, delete_portal_document,
    get_invoices,
)

portal_bp = Blueprint('portal', __name__, url_prefix='/api/v1/portal')


def _resolve_pid(project_id_or_external: str) -> int | None:
    """Resolve a project identifier (numeric ID or external_id like 'Actif/Johan Vila') to numeric DB id.
    
    Projects are stored as folders on disk, not in the DB. The DB `projects` table
    may be empty. We do a lazy-insert to create a DB row the first time a portal
    feature is used for a given project.
    """
    # Try numeric first
    try:
        return int(project_id_or_external)
    except (ValueError, TypeError):
        pass

    ext_id = str(project_id_or_external)

    # Lookup by external_id
    proj = get_project_by_external_id(ext_id)
    if proj:
        return proj['id']

    # Lazy-insert: create a minimal projects row so portal tables can reference it
    from database.db import get_db
    client_name = ext_id.split('/')[-1] if '/' in ext_id else ext_id
    try:
        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO projects (workspace_id, external_id, client_name, status, phase)
                   VALUES (1, ?, ?, 'Active', 'Découverte')""",
                (ext_id, client_name)
            )
            return cursor.lastrowid
    except Exception:
        # Maybe a race condition created it meanwhile
        proj = get_project_by_external_id(ext_id)
        if proj:
            return proj['id']
        return None


# Max upload size: 20 MB
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',  # images
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',   # documents
    'ai', 'eps', 'psd',                            # design files
    'zip', 'rar',                                   # archives
}

# Simple portal session tokens (in-memory, lightweight)
_portal_sessions: dict = {}  # token -> {project_id, expires}
PORTAL_SESSION_DURATION = 24 * 3600  # 24 hours


def _get_upload_dir(project_id: int) -> Path:
    """Get the upload directory for a project's client files."""
    base = Path(__file__).parent.parent / 'static' / 'portal_uploads' / str(project_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


def _generate_portal_session(project_id: int) -> str:
    """Generate a lightweight session token for portal access."""
    token = hashlib.sha256(f"{project_id}-{time.time()}-{uuid.uuid4()}".encode()).hexdigest()[:32]
    _portal_sessions[token] = {
        'project_id': project_id,
        'expires': time.time() + PORTAL_SESSION_DURATION,
    }
    # Cleanup expired sessions
    now = time.time()
    expired = [k for k, v in _portal_sessions.items() if v['expires'] < now]
    for k in expired:
        del _portal_sessions[k]
    return token


def _validate_portal_session(share_token: str) -> int | None:
    """Validate portal session from header. Returns project_id or None."""
    session_token = request.headers.get('X-Portal-Token')
    if not session_token:
        return None
    session = _portal_sessions.get(session_token)
    if not session or session['expires'] < time.time():
        if session_token in _portal_sessions:
            del _portal_sessions[session_token]
        return None
    # Verify the project still matches and portal is still enabled
    project = get_project_by_portal_token(share_token)
    if not project or project['id'] != session['project_id']:
        return None
    return session['project_id']


def _serialize_project_for_portal(project: dict, portal_settings: dict) -> dict:
    """Build the public portal data payload."""
    deliverables = get_portal_deliverables(project['id'], visible_only=True)
    comments = get_portal_comments(project['id'])
    updates = get_portal_updates(project['id'])
    client_files = get_portal_client_files(project['id'])
    
    tasks = []
    if portal_settings.get('showTasks'):
        from database.db import get_db, rows_to_list
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order",
                (project['id'],)
            ).fetchall()
            tasks = rows_to_list(rows)

    # Account data (maintenance, invoices, documents) — included in main payload
    account = None
    if portal_settings.get('showAccount'):
        maintenance = {}
        if project.get('maintenance_json'):
            try:
                maintenance = json.loads(project['maintenance_json']) if isinstance(project['maintenance_json'], str) else project['maintenance_json']
            except (json.JSONDecodeError, TypeError):
                pass

        invoices_raw = get_invoices(project['id'])
        docs_raw = get_portal_documents(project['id'], visible_only=True)

        account = {
            'maintenance': {
                'hasContract': maintenance.get('hasContract', False),
                'contractSignDate': maintenance.get('contractSignDate'),
                'freeMaintenanceEndDate': maintenance.get('freeMaintenanceEndDate'),
                'monthlyPrice': maintenance.get('monthlyPrice'),
            },
            'invoices': [{
                'id': inv['id'],
                'number': inv['number'],
                'date': inv['date'],
                'dueDate': inv.get('due_date'),
                'amount': inv['amount'],
                'currency': inv.get('currency', 'CHF'),
                'status': inv['status'],
            } for inv in invoices_raw],
            'documents': [{
                'id': d['id'],
                'title': d['title'],
                'docType': d.get('doc_type', 'other'),
                'originalName': d.get('original_name'),
                'mimeType': d.get('mime_type'),
                'sizeBytes': d.get('size_bytes', 0),
                'uploadedAt': d.get('uploaded_at'),
            } for d in docs_raw],
        }

    return {
        'clientName': project['client_name'],
        'phase': project['phase'],
        'progress': project['progress'],
        'settings': {
            'showTasks': portal_settings.get('showTasks', True),
            'showTimeline': portal_settings.get('showTimeline', True),
            'allowComments': portal_settings.get('allowComments', True),
            'showDeliverables': portal_settings.get('showDeliverables', True),
            'showUpdates': portal_settings.get('showUpdates', True),
            'allowUploads': portal_settings.get('allowUploads', True),
            'customMessage': portal_settings.get('customMessage', ''),
            'clientName': portal_settings.get('clientName', project['client_name']),
            'showAccount': portal_settings.get('showAccount', False),
        },
        'deliverables': [{
            'id': d['id'],
            'type': d['type'],
            'title': d['title'],
            'url': d.get('url'),
            'description': d.get('description'),
            'thumbnail': d.get('thumbnail_base64'),
            'sortOrder': d.get('sort_order', 0),
            'filePath': d.get('file_path'),
            'originalName': d.get('original_name'),
        } for d in deliverables],
        'updates': [{
            'id': u['id'],
            'phase': u.get('phase'),
            'title': u['title'],
            'content': u.get('content'),
            'attachments': json.loads(u['attachments_json']) if u.get('attachments_json') else [],
            'createdAt': u['created_at'],
        } for u in updates],
        'comments': [{
            'id': c['id'],
            'author': c['author'],
            'text': c['text'],
            'phaseRef': c.get('phase_ref'),
            'isAdmin': bool(c.get('is_admin')),
            'createdAt': c['created_at'],
        } for c in comments],
        'tasks': [{
            'id': t.get('external_id') or str(t['id']),
            'title': t['title'],
            'completed': bool(t['completed']),
            'column': t.get('column', 'todo'),
            'priority': t.get('priority', 'Medium'),
            'phase': t.get('phase'),
        } for t in tasks],
        'clientFiles': [{
            'id': f['id'],
            'originalName': f['original_name'],
            'mimeType': f.get('mime_type'),
            'sizeBytes': f.get('size_bytes', 0),
            'category': f.get('category', 'other'),
            'note': f.get('note'),
            'authorName': f.get('author_name'),
            'createdAt': f['created_at'],
        } for f in client_files],
        'account': account,
    }


# ==========================================================================
# PUBLIC ENDPOINTS (no Marion auth, portal PIN session)
# ==========================================================================

@portal_bp.route('/<token>/auth', methods=['POST'])
def portal_auth(token: str):
    """Authenticate to a portal with a PIN."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable ou désactivé."}), 404

    data = request.json or {}
    pin = data.get('pin', '')

    if not verify_portal_pin(project['id'], pin):
        return jsonify({"error": "Code PIN incorrect."}), 401

    session_token = _generate_portal_session(project['id'])
    
    # Parse portal settings for client name
    ps = {}
    if project.get('portal_settings_json'):
        try:
            ps = json.loads(project['portal_settings_json'])
        except (json.JSONDecodeError, TypeError):
            pass

    return jsonify({
        "sessionToken": session_token,
        "clientName": ps.get('clientName', project['client_name']),
        "hasPin": bool(project.get('portal_pin')),
    })


@portal_bp.route('/<token>/check', methods=['GET'])
def portal_check(token: str):
    """Check if a portal exists and whether it needs a PIN."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"exists": False}), 404
    return jsonify({
        "exists": True,
        "hasPin": bool(project.get('portal_pin')),
        "clientName": project['client_name'],
    })


@portal_bp.route('/<token>', methods=['GET'])
def portal_get(token: str):
    """Get full portal data. Requires valid portal session."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée. Veuillez vous reconnecter."}), 401

    ps = {}
    if project.get('portal_settings_json'):
        try:
            ps = json.loads(project['portal_settings_json'])
        except (json.JSONDecodeError, TypeError):
            pass

    return jsonify(_serialize_project_for_portal(project, ps))


@portal_bp.route('/<token>/comment', methods=['POST'])
def portal_add_comment(token: str):
    """Add a comment from the client side."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée."}), 401

    data = request.json or {}
    author = (data.get('author') or '').strip()
    text = (data.get('text') or '').strip()
    if not author or not text:
        return jsonify({"error": "Auteur et message requis."}), 400

    comment_id = create_portal_comment(project['id'], {
        'author': author,
        'text': text,
        'phaseRef': data.get('phaseRef'),
        'isAdmin': False,
    })

    return jsonify({"id": comment_id, "success": True}), 201


@portal_bp.route('/<token>/upload', methods=['POST'])
def portal_upload(token: str):
    """Upload a file from the client side."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée."}), 401

    # Check portal settings allow uploads
    ps = {}
    if project.get('portal_settings_json'):
        try:
            ps = json.loads(project['portal_settings_json'])
        except (json.JSONDecodeError, TypeError):
            pass
    if not ps.get('allowUploads', True):
        return jsonify({"error": "Les uploads ne sont pas autorisés."}), 403

    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni."}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Nom de fichier manquant."}), 400

    # Check extension
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Type de fichier non autorisé (.{ext})."}), 400

    # Check size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({"error": "Fichier trop volumineux (max 20 MB)."}), 400

    # Save file
    safe_name = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
    upload_dir = _get_upload_dir(project['id'])
    file.save(str(upload_dir / unique_name))

    # Determine category
    category = request.form.get('category', 'other')
    if category not in ('text', 'image', 'logo', 'document', 'other'):
        category = 'other'

    file_id = create_portal_client_file(project['id'], {
        'filename': unique_name,
        'originalName': file.filename,
        'mimeType': file.content_type,
        'sizeBytes': size,
        'category': category,
        'note': request.form.get('note', ''),
        'authorName': request.form.get('authorName', 'Client'),
    })

    return jsonify({"id": file_id, "success": True}), 201


@portal_bp.route('/<token>/files', methods=['GET'])
def portal_list_files(token: str):
    """List files uploaded by the client."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée."}), 401

    files = get_portal_client_files(project['id'])
    return jsonify([{
        'id': f['id'],
        'originalName': f['original_name'],
        'mimeType': f.get('mime_type'),
        'sizeBytes': f.get('size_bytes', 0),
        'category': f.get('category', 'other'),
        'note': f.get('note'),
        'authorName': f.get('author_name'),
        'createdAt': f['created_at'],
    } for f in files])


@portal_bp.route('/<token>/activity', methods=['GET'])
def portal_activity(token: str):
    """Get merged activity feed."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée."}), 401

    activity = get_portal_activity(project['id'])
    return jsonify(activity)


@portal_bp.route('/<token>/deliverable/<int:deliverable_id>/download', methods=['GET'])
def portal_public_download_deliverable(token: str, deliverable_id: int):
    """Public download route for deliverable files."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404
    from database.db import get_db
    with get_db() as conn:
        row = conn.execute(
            "SELECT file_path, original_name, visible FROM portal_deliverables WHERE id = ? AND project_id = ?",
            (deliverable_id, project['id'])
        ).fetchone()
    if not row or not row['file_path'] or not row['visible']:
        return jsonify({"error": "Fichier introuvable."}), 404
    full_path = Path(__file__).parent.parent / 'static' / 'portal_deliverables' / row['file_path']
    if not full_path.is_file():
        return jsonify({"error": "Fichier introuvable sur le disque."}), 404
    import mimetypes
    mime, _ = mimetypes.guess_type(str(full_path))
    force_download = request.args.get('download', '0') == '1'
    return send_file(str(full_path), mimetype=mime or 'application/octet-stream',
                     download_name=row['original_name'] or full_path.name, as_attachment=force_download)


# ==========================================================================
# ADMIN ENDPOINTS (Marion auth required via global middleware)
# ==========================================================================

# -- Deliverables --

@portal_bp.route('/deliverables/<path:project_id>', methods=['GET'])
def admin_list_deliverables(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    items = get_portal_deliverables(pid)
    return jsonify([{
        'id': d['id'],
        'type': d['type'],
        'title': d['title'],
        'url': d.get('url'),
        'description': d.get('description'),
        'thumbnail': d.get('thumbnail_base64'),
        'visible': bool(d.get('visible', 1)),
        'sortOrder': d.get('sort_order', 0),
        'createdAt': d.get('created_at'),
        'filePath': d.get('file_path'),
        'originalName': d.get('original_name'),
    } for d in items])


def _get_deliverable_dir(project_id: int) -> Path:
    """Get the upload directory for a project's deliverable files."""
    base = Path(__file__).parent.parent / 'static' / 'portal_deliverables' / str(project_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


DELIVERABLE_ALLOWED_EXT = {
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',  # images
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',   # documents
    'ai', 'eps', 'psd',                            # design files
    'zip', 'rar',                                   # archives
    'fig',                                           # figma exports
}


@portal_bp.route('/deliverable', methods=['POST'])
def admin_create_deliverable():
    # Support both JSON and multipart/form-data (for file uploads)
    if request.content_type and 'multipart/form-data' in request.content_type:
        raw_pid = request.form.get('projectId')
        if not raw_pid:
            return jsonify({"error": "projectId requis."}), 400
        pid = _resolve_pid(raw_pid)
        if pid is None:
            return jsonify({"error": "Projet introuvable."}), 404
        deliverable_id = request.form.get('id')
        d_type = request.form.get('type', 'file')
        title = request.form.get('title', '')
        url = request.form.get('url', '')
        description = request.form.get('description', '')
        visible = request.form.get('visible', 'true').lower() in ('true', '1', 'yes')

        file_path = None
        original_name = None
        uploaded_file = request.files.get('file')
        if uploaded_file and uploaded_file.filename:
            ext = uploaded_file.filename.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.filename else ''
            if ext not in DELIVERABLE_ALLOWED_EXT:
                return jsonify({"error": f"Extension .{ext} non autorisée."}), 400
            if uploaded_file.content_length and uploaded_file.content_length > MAX_UPLOAD_BYTES:
                return jsonify({"error": "Fichier trop volumineux (max 20 Mo)."}), 400

            original_name = secure_filename(uploaded_file.filename)
            unique_name = f"{uuid.uuid4().hex[:12]}_{original_name}"
            dest = _get_deliverable_dir(pid) / unique_name
            uploaded_file.save(str(dest))
            file_path = f"{pid}/{unique_name}"

        data = {
            'type': d_type,
            'title': title,
            'url': url or None,
            'description': description or None,
            'thumbnail': None,
            'sortOrder': int(request.form.get('sortOrder', 0)),
            'visible': visible,
            'file_path': file_path,
            'original_name': original_name,
        }

        if deliverable_id:
            update_portal_deliverable(int(deliverable_id), {
                'type': data['type'],
                'title': data['title'],
                'url': data['url'],
                'description': data['description'],
                'thumbnail_base64': None,
                'sort_order': data['sortOrder'],
                'visible': 1 if data['visible'] else 0,
                'file_path': data['file_path'] if file_path else None,
                'original_name': data['original_name'] if original_name else None,
            })
            return jsonify({"id": int(deliverable_id), "updated": True})

        new_id = create_portal_deliverable(pid, data)
        return jsonify({"id": new_id, "created": True}), 201
    else:
        # JSON body (no file upload, links only)
        data = request.json or {}
        raw_pid = data.get('projectId')
        if not raw_pid:
            return jsonify({"error": "projectId requis."}), 400
        pid = _resolve_pid(raw_pid)
        if pid is None:
            return jsonify({"error": "Projet introuvable."}), 404

        if data.get('id'):
            update_portal_deliverable(data['id'], {
                'type': data.get('type'),
                'title': data.get('title'),
                'url': data.get('url'),
                'description': data.get('description'),
                'thumbnail_base64': data.get('thumbnail'),
                'sort_order': data.get('sortOrder', 0),
                'visible': 1 if data.get('visible', True) else 0,
            })
            return jsonify({"id": data['id'], "updated": True})

        new_id = create_portal_deliverable(pid, data)
        return jsonify({"id": new_id, "created": True}), 201


@portal_bp.route('/deliverable/<int:deliverable_id>/download', methods=['GET'])
def admin_download_deliverable(deliverable_id: int):
    """Serve a deliverable file. Inline by default (for thumbnails), ?download=1 forces download."""
    from database.db import get_db
    with get_db() as conn:
        row = conn.execute(
            "SELECT file_path, original_name, type FROM portal_deliverables WHERE id = ?",
            (deliverable_id,)
        ).fetchone()
    if not row or not row['file_path']:
        return jsonify({"error": "Fichier introuvable."}), 404
    full_path = Path(__file__).parent.parent / 'static' / 'portal_deliverables' / row['file_path']
    if not full_path.is_file():
        return jsonify({"error": "Fichier introuvable sur le disque."}), 404
    import mimetypes
    mime, _ = mimetypes.guess_type(str(full_path))
    force_download = request.args.get('download', '0') == '1'
    return send_file(str(full_path), mimetype=mime or 'application/octet-stream',
                     download_name=row['original_name'] or full_path.name, as_attachment=force_download)


@portal_bp.route('/deliverable/<int:deliverable_id>', methods=['DELETE'])
def admin_delete_deliverable(deliverable_id: int):
    delete_portal_deliverable(deliverable_id)
    return jsonify({"deleted": True})


# -- Updates --

@portal_bp.route('/updates/<path:project_id>', methods=['GET'])
def admin_list_updates(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    items = get_portal_updates(pid)
    return jsonify([{
        'id': u['id'],
        'phase': u.get('phase'),
        'title': u['title'],
        'content': u.get('content'),
        'attachments': json.loads(u['attachments_json']) if u.get('attachments_json') else [],
        'createdAt': u['created_at'],
    } for u in items])


@portal_bp.route('/update', methods=['POST'])
def admin_create_update():
    data = request.json or {}
    raw_pid = data.get('projectId')
    if not raw_pid:
        return jsonify({"error": "projectId requis."}), 400
    pid = _resolve_pid(raw_pid)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    new_id = create_portal_update(pid, data)
    return jsonify({"id": new_id, "created": True}), 201


@portal_bp.route('/update/<int:update_id>', methods=['DELETE'])
def admin_delete_update(update_id: int):
    delete_portal_update(update_id)
    return jsonify({"deleted": True})


# -- Comments (admin) --

@portal_bp.route('/comments/<path:project_id>', methods=['GET'])
def admin_list_comments(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    items = get_portal_comments(pid)
    return jsonify([{
        'id': c['id'],
        'author': c['author'],
        'text': c['text'],
        'phaseRef': c.get('phase_ref'),
        'isAdmin': bool(c.get('is_admin')),
        'seen': bool(c.get('seen')),
        'createdAt': c['created_at'],
    } for c in items])


@portal_bp.route('/comments/<path:project_id>/seen', methods=['POST'])
def admin_mark_comments_seen(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    mark_portal_comments_seen(pid)
    return jsonify({"success": True})


@portal_bp.route('/comment/<int:comment_id>', methods=['DELETE'])
def admin_delete_comment(comment_id: int):
    delete_portal_comment(comment_id)
    return jsonify({"deleted": True})


@portal_bp.route('/comment', methods=['POST'])
def admin_reply_comment():
    """Admin (Marion) adds a reply/comment."""
    data = request.json or {}
    raw_pid = data.get('projectId')
    if not raw_pid:
        return jsonify({"error": "projectId requis."}), 400
    pid = _resolve_pid(raw_pid)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    new_id = create_portal_comment(pid, {
        'author': data.get('author', 'Marion Web'),
        'text': data.get('text', ''),
        'phaseRef': data.get('phaseRef'),
        'isAdmin': True,
    })
    return jsonify({"id": new_id, "created": True}), 201


# -- Client Files (admin) --

@portal_bp.route('/client-files/<path:project_id>', methods=['GET'])
def admin_list_client_files(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    files = get_portal_client_files(pid)
    return jsonify([{
        'id': f['id'],
        'filename': f['filename'],
        'originalName': f['original_name'],
        'mimeType': f.get('mime_type'),
        'sizeBytes': f.get('size_bytes', 0),
        'category': f.get('category', 'other'),
        'note': f.get('note'),
        'authorName': f.get('author_name'),
        'seen': bool(f.get('seen')),
        'createdAt': f['created_at'],
    } for f in files])


@portal_bp.route('/client-files/<path:project_id>/seen', methods=['POST'])
def admin_mark_files_seen(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    mark_portal_files_seen(pid)
    return jsonify({"success": True})


@portal_bp.route('/client-files/<int:file_id>', methods=['DELETE'])
def admin_delete_client_file(file_id: int):
    record = delete_portal_client_file(file_id)
    if record:
        # Remove physical file
        fpath = _get_upload_dir(record['project_id']) / record['filename']
        if fpath.exists():
            fpath.unlink()
    return jsonify({"deleted": True})


@portal_bp.route('/client-files/<int:file_id>/download', methods=['GET'])
def admin_download_client_file(file_id: int):
    from database.db import get_db, row_to_dict
    with get_db() as conn:
        row = conn.execute("SELECT * FROM portal_client_files WHERE id = ?", (file_id,)).fetchone()
    if not row:
        return jsonify({"error": "Fichier introuvable."}), 404
    record = row_to_dict(row)
    fpath = _get_upload_dir(record['project_id']) / record['filename']
    if not fpath.exists():
        return jsonify({"error": "Fichier physique introuvable."}), 404
    return send_file(str(fpath), download_name=record['original_name'], as_attachment=True)


# -- Unseen counts --

@portal_bp.route('/unseen/<path:project_id>', methods=['GET'])
def admin_unseen_counts(project_id: str):
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    return jsonify({
        'comments': count_unseen_portal_comments(pid),
        'files': count_unseen_portal_files(pid),
    })


# -- Portal Documents (admin) --

def _get_document_dir(project_id: int) -> Path:
    """Get the upload directory for a project's portal documents."""
    base = Path(__file__).parent.parent / 'static' / 'portal_documents' / str(project_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


DOCUMENT_ALLOWED_EXT = {
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',  # documents
    'xls', 'xlsx', 'csv',                          # spreadsheets
    'png', 'jpg', 'jpeg',                           # scanned docs
    'zip',                                           # archives
}


@portal_bp.route('/documents/<path:project_id>', methods=['GET'])
def admin_list_documents(project_id: str):
    """List all portal documents for a project (admin)."""
    pid = _resolve_pid(project_id)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404
    items = get_portal_documents(pid)
    return jsonify([{
        'id': d['id'],
        'title': d['title'],
        'docType': d.get('doc_type', 'other'),
        'originalName': d.get('original_name'),
        'mimeType': d.get('mime_type'),
        'sizeBytes': d.get('size_bytes', 0),
        'visible': bool(d.get('visible', 1)),
        'uploadedAt': d.get('uploaded_at'),
    } for d in items])


@portal_bp.route('/document', methods=['POST'])
def admin_create_document():
    """Upload a portal document (contract, invoice PDF, quote, etc.)."""
    if not request.content_type or 'multipart/form-data' not in request.content_type:
        return jsonify({"error": "multipart/form-data requis."}), 400

    raw_pid = request.form.get('projectId')
    if not raw_pid:
        return jsonify({"error": "projectId requis."}), 400
    pid = _resolve_pid(raw_pid)
    if pid is None:
        return jsonify({"error": "Projet introuvable."}), 404

    uploaded_file = request.files.get('file')
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "Aucun fichier fourni."}), 400

    ext = uploaded_file.filename.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.filename else ''
    if ext not in DOCUMENT_ALLOWED_EXT:
        return jsonify({"error": f"Extension .{ext} non autorisée."}), 400

    uploaded_file.seek(0, 2)
    size = uploaded_file.tell()
    uploaded_file.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({"error": "Fichier trop volumineux (max 20 Mo)."}), 400

    original_name = secure_filename(uploaded_file.filename)
    unique_name = f"{uuid.uuid4().hex[:12]}_{original_name}"
    dest = _get_document_dir(pid) / unique_name
    uploaded_file.save(str(dest))
    file_path = f"{pid}/{unique_name}"

    title = request.form.get('title', original_name)
    doc_type = request.form.get('docType', 'other')
    if doc_type not in ('contract', 'invoice', 'quote', 'report', 'other'):
        doc_type = 'other'

    new_id = create_portal_document(pid, {
        'title': title,
        'doc_type': doc_type,
        'file_path': file_path,
        'original_name': uploaded_file.filename,
        'mime_type': uploaded_file.content_type,
        'size_bytes': size,
        'visible': request.form.get('visible', 'true').lower() in ('true', '1', 'yes'),
    })

    return jsonify({"id": new_id, "created": True}), 201


@portal_bp.route('/document/<int:doc_id>', methods=['PUT'])
def admin_update_document(doc_id: int):
    """Toggle visibility or update title/type of a portal document."""
    data = request.json or {}
    update_data = {}
    if 'visible' in data:
        update_data['visible'] = 1 if data['visible'] else 0
    if 'title' in data:
        update_data['title'] = data['title']
    if 'docType' in data:
        update_data['doc_type'] = data['docType']
    update_portal_document(doc_id, update_data)
    return jsonify({"updated": True})


@portal_bp.route('/document/<int:doc_id>', methods=['DELETE'])
def admin_delete_document(doc_id: int):
    """Delete a portal document."""
    record = delete_portal_document(doc_id)
    if record and record.get('file_path'):
        full_path = Path(__file__).parent.parent / 'static' / 'portal_documents' / record['file_path']
        if full_path.is_file():
            full_path.unlink()
    return jsonify({"deleted": True})


@portal_bp.route('/document/<int:doc_id>/download', methods=['GET'])
def admin_download_document(doc_id: int):
    """Admin download route for portal documents."""
    from database.db import get_db
    with get_db() as conn:
        row = conn.execute(
            "SELECT file_path, original_name, mime_type FROM portal_documents WHERE id = ?",
            (doc_id,)
        ).fetchone()
    if not row or not row['file_path']:
        return jsonify({"error": "Fichier introuvable."}), 404
    full_path = Path(__file__).parent.parent / 'static' / 'portal_documents' / row['file_path']
    if not full_path.is_file():
        return jsonify({"error": "Fichier introuvable sur le disque."}), 404
    import mimetypes as mt
    mime = row['mime_type'] or mt.guess_type(str(full_path))[0] or 'application/octet-stream'
    return send_file(str(full_path), mimetype=mime,
                     download_name=row['original_name'] or full_path.name, as_attachment=True)


# ==========================================================================
# PUBLIC ACCOUNT ENDPOINT (Mon Compte)
# ==========================================================================

@portal_bp.route('/<token>/account', methods=['GET'])
def portal_account(token: str):
    """Get aggregated account data for the public Mon Compte section."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée."}), 401

    # Check if showAccount is enabled
    ps = {}
    if project.get('portal_settings_json'):
        try:
            ps = json.loads(project['portal_settings_json'])
        except (json.JSONDecodeError, TypeError):
            pass
    if not ps.get('showAccount', False):
        return jsonify({"error": "Section non activée."}), 403

    # 1. Maintenance info (from project maintenance_json)
    maintenance = {}
    if project.get('maintenance_json'):
        try:
            maintenance = json.loads(project['maintenance_json']) if isinstance(project['maintenance_json'], str) else project['maintenance_json']
        except (json.JSONDecodeError, TypeError):
            pass

    # 2. Invoices (billing history)
    invoices_raw = get_invoices(project['id'])
    invoices = [{
        'id': inv['id'],
        'number': inv['number'],
        'date': inv['date'],
        'dueDate': inv.get('due_date'),
        'amount': inv['amount'],
        'currency': inv.get('currency', 'CHF'),
        'status': inv['status'],
    } for inv in invoices_raw]

    # 3. Portal documents (visible only)
    docs_raw = get_portal_documents(project['id'], visible_only=True)
    documents = [{
        'id': d['id'],
        'title': d['title'],
        'docType': d.get('doc_type', 'other'),
        'originalName': d.get('original_name'),
        'mimeType': d.get('mime_type'),
        'sizeBytes': d.get('size_bytes', 0),
        'uploadedAt': d.get('uploaded_at'),
    } for d in docs_raw]

    return jsonify({
        'maintenance': {
            'hasContract': maintenance.get('hasContract', False),
            'contractSignDate': maintenance.get('contractSignDate'),
            'freeMaintenanceEndDate': maintenance.get('freeMaintenanceEndDate'),
            'monthlyPrice': maintenance.get('monthlyPrice'),
        },
        'invoices': invoices,
        'documents': documents,
    })


@portal_bp.route('/<token>/document/<int:doc_id>/download', methods=['GET'])
def portal_public_download_document(token: str, doc_id: int):
    """Public download route for portal documents (requires valid portal session)."""
    project = get_project_by_portal_token(token)
    if not project:
        return jsonify({"error": "Portail introuvable."}), 404

    project_id = _validate_portal_session(token)
    if project_id is None:
        return jsonify({"error": "Session expirée."}), 401

    from database.db import get_db
    with get_db() as conn:
        row = conn.execute(
            "SELECT file_path, original_name, mime_type, visible FROM portal_documents WHERE id = ? AND project_id = ?",
            (doc_id, project['id'])
        ).fetchone()
    if not row or not row['file_path'] or not row['visible']:
        return jsonify({"error": "Document introuvable."}), 404
    full_path = Path(__file__).parent.parent / 'static' / 'portal_documents' / row['file_path']
    if not full_path.is_file():
        return jsonify({"error": "Document introuvable sur le disque."}), 404
    import mimetypes as mt
    mime = row['mime_type'] or mt.guess_type(str(full_path))[0] or 'application/octet-stream'
    return send_file(str(full_path), mimetype=mime,
                     download_name=row['original_name'] or full_path.name, as_attachment=True)
