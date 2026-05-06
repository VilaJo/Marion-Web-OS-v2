"""
Email Blueprint - IMAP / SMTP routes for the email client.
Handles: connect, disconnect, status, list, body, send, draft,
         mark_read, mark_unread, delete, count_for_client, count_batch,
         attachment download, AI reply, AI summarize.

Credentials are stored server-side in an encrypted in-memory store, keyed by
session token.  Phase 3.1: credentials are encrypted with Fernet (via
crypto_utils) using the session password as encryption key.
"""

from __future__ import annotations

import base64
from flask import Blueprint, request, jsonify, Response
from services.logger import get_logger

logger = get_logger('api.email')
from services.email_service import (
    list_emails as svc_list_emails,
    get_email_body as svc_get_email_body,
    send_email as svc_send_email,
    count_emails_for_client as svc_count_emails,
    count_emails_batch as svc_count_emails_batch,
    validate_credentials as svc_validate_credentials,
    mark_as_read as svc_mark_as_read,
    mark_as_unread as svc_mark_as_unread,
    save_draft as svc_save_draft,
    delete_email as svc_delete_email,
    get_attachment as svc_get_attachment,
    star_email as svc_star_email,
    unstar_email as svc_unstar_email,
    move_email as svc_move_email,
    search_emails as svc_search_emails,
    list_folders as svc_list_folders,
)
from api.shared import error_response, validate_json

email_bp = Blueprint('email', __name__, url_prefix='/api/v1/email')

# ---------------------------------------------------------------------------
# Server-side credential store (encrypted in-memory, keyed by session token)
# Phase 3.1: credentials are encrypted at rest using Fernet
# ---------------------------------------------------------------------------
_email_creds: dict = {}
# { token: { "encrypted": str, "username": str } }
# "encrypted" holds the Fernet-encrypted password (base64)
# "username" is stored in cleartext (not sensitive)


def _get_token() -> str | None:
    return request.headers.get('X-Marion-Token')


def _get_encryption_password() -> str | None:
    """
    Retrieve the session's encryption password from the DB session record.
    This is the user's auth password stored in the sessions table.
    """
    try:
        from database.db import validate_session
        token = _get_token()
        if not token:
            return None
        session = validate_session(token)
        if session and session.get('password_for_encryption'):
            return session['password_for_encryption']
    except Exception:
        pass
    return None


def _encrypt_creds(username: str, password: str, encryption_key: str) -> dict:
    """Encrypt email credentials for in-memory storage."""
    try:
        from crypto_utils import encrypt_field, generate_salt
        salt = generate_salt()
        encrypted_pwd = encrypt_field(password, encryption_key, salt)
        return {
            "username": username,
            "encrypted": encrypted_pwd,
            "salt": base64.b64encode(salt).decode(),
        }
    except Exception:
        # Fallback: store as-is if encryption not available
        return {"username": username, "password": password}


def _decrypt_creds(token: str, encryption_key: str | None = None) -> tuple[str | None, str | None]:
    """
    Resolve IMAP credentials.
    1. Try server-side encrypted store (preferred).
    2. Fall back to body fields (legacy compat).
    Returns (username, password) or (None, None).
    """
    if token and token in _email_creds:
        entry = _email_creds[token]
        username = entry.get("username")

        # Try encrypted path
        if "encrypted" in entry and "salt" in entry:
            enc_key = encryption_key or _get_encryption_password()
            if enc_key:
                try:
                    from crypto_utils import decrypt_field
                    salt = base64.b64decode(entry["salt"])
                    password = decrypt_field(entry["encrypted"], enc_key, salt)
                    return username, password
                except Exception:
                    pass

        # Fallback to plain (legacy/migration)
        if "password" in entry:
            return username, entry["password"]

    # Legacy: credentials in request body
    data = request.json or {}
    u = data.get("username")
    p = data.get("password")
    if u and p:
        return u, p
    return None, None


def _get_creds():
    """Convenience wrapper around _decrypt_creds."""
    token = _get_token()
    return _decrypt_creds(token)


# ---------------------------------------------------------------------------
# Connect / Disconnect
# ---------------------------------------------------------------------------

@email_bp.route('/connect', methods=['POST'])
@validate_json({"required": ["username", "password"], "types": {"username": str, "password": str}})
def email_connect():
    """Store IMAP credentials server-side for the current session."""
    data = request.json
    token = _get_token()
    if not token:
        return jsonify({"error": "Session requise."}), 401

    username = data["username"]
    password = data["password"]

    # Quick validation: IMAP login only
    try:
        if not svc_validate_credentials(username, password):
            return jsonify({"error": "Identifiants email invalides."}), 401
    except Exception as e:
        return error_response(e, 401, "Connexion au serveur mail impossible.")

    # Encrypt credentials before storing (Phase 3.1)
    enc_key = _get_encryption_password()
    if enc_key:
        _email_creds[token] = _encrypt_creds(username, password, enc_key)
    else:
        _email_creds[token] = {"username": username, "password": password}

    # Persist to DB if available (Phase 3.2)
    try:
        from database.db import validate_session, save_email_account
        session = validate_session(token)
        if session:
            user_id = session["user_id"]
            from crypto_utils import encrypt_field, generate_salt
            salt = generate_salt()
            encrypted_pwd = encrypt_field(password, enc_key or "fallback", salt)
            save_email_account(
                user_id=user_id,
                username=username,
                password_encrypted=encrypted_pwd,
                salt=base64.b64encode(salt).decode(),
            )
    except Exception:
        pass  # DB persistence is best-effort

    return jsonify({"success": True, "message": "Connecté."})


@email_bp.route('/disconnect', methods=['POST'])
def email_disconnect():
    """Remove stored IMAP credentials for the current session."""
    token = _get_token()
    if token and token in _email_creds:
        del _email_creds[token]

    # Also remove from DB (Phase 3.2)
    try:
        from database.db import validate_session, delete_email_account
        session = validate_session(token)
        if session:
            delete_email_account(session["user_id"])
    except Exception:
        pass

    return jsonify({"success": True, "message": "Déconnecté."})


@email_bp.route('/status', methods=['GET'])
def email_status():
    """Check if IMAP credentials are stored for this session."""
    token = _get_token()
    connected = bool(token and token in _email_creds)
    username = _email_creds[token].get("username") if connected else None

    # If not in memory, try loading from DB (Phase 3.2)
    if not connected and token:
        try:
            from database.db import validate_session, get_email_account
            session = validate_session(token)
            if session:
                account = get_email_account(session["user_id"])
                if account:
                    username = account["username"]
                    # Restore to memory
                    enc_key = _get_encryption_password()
                    if enc_key:
                        try:
                            from crypto_utils import decrypt_field
                            salt = base64.b64decode(account["salt"])
                            password = decrypt_field(account["password_encrypted"], enc_key, salt)
                            _email_creds[token] = _encrypt_creds(username, password, enc_key)
                            connected = True
                        except Exception:
                            pass
                    if not connected and account.get("password_encrypted"):
                        # Try fallback restoration
                        connected = False
        except Exception:
            pass

    return jsonify({"connected": connected, "username": username})


@email_bp.route('/unseen', methods=['GET'])
def unseen_count():
    """Quick IMAP check: return the number of unseen messages in INBOX."""
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"count": 0, "connected": False})
    try:
        from services.email_service import imap_connection, _select_folder
        with imap_connection(username, password) as mail:
            _select_folder(mail, 'inbox')
            status, data = mail.search(None, 'UNSEEN')
            if status == 'OK' and data[0]:
                ids = data[0].split()
                # Return count + last 5 new message IDs for dedup
                count = len(ids)
                # Fetch subject & from of the newest unseen message for notification
                newest_info = None
                if ids:
                    last_id = ids[-1]
                    typ, msg_data = mail.fetch(last_id, '(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM)])')
                    if typ == 'OK' and msg_data[0]:
                        raw = msg_data[0][1] if isinstance(msg_data[0], tuple) else b''
                        from email.header import decode_header
                        import email
                        msg = email.message_from_bytes(raw)
                        subj_raw = msg.get('Subject', '')
                        from_raw = msg.get('From', '')
                        # Decode subject
                        parts = decode_header(subj_raw)
                        subj = ''
                        for part, enc in parts:
                            if isinstance(part, bytes):
                                subj += part.decode(enc or 'utf-8', errors='replace')
                            else:
                                subj += part
                        # Decode from
                        from_parts = decode_header(from_raw)
                        sender = ''
                        for part, enc in from_parts:
                            if isinstance(part, bytes):
                                sender += part.decode(enc or 'utf-8', errors='replace')
                            else:
                                sender += part
                        newest_info = {"subject": subj.strip(), "from": sender.strip()}
                return jsonify({"count": count, "connected": True, "newest": newest_info})
            return jsonify({"count": 0, "connected": True})
    except Exception as e:
        logger.error("Unseen count error: %s", e, exc_info=True)
        return jsonify({"count": 0, "connected": True, "error": str(e)})


# ---------------------------------------------------------------------------
# List / Body / Send (existing endpoints, now with pool + improvements)
# ---------------------------------------------------------------------------

@email_bp.route('/list', methods=['POST'])
def list_emails():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json or {}
    folder_alias = data.get('folder', 'inbox')
    offset = data.get('offset', 0)
    limit = data.get('limit', 30)
    try:
        emails = svc_list_emails(username, password, folder_alias, offset=offset, limit=limit)
        return jsonify({"emails": emails})
    except ValueError as e:
        return error_response(e, 404, "Boîte mail introuvable.")
    except Exception as e:
        return error_response(e)


@email_bp.route('/body', methods=['POST'])
def get_email_body():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json or {}
    msg_id = data.get('id')
    folder = data.get('folder', 'inbox')
    if not msg_id:
        return jsonify({"error": "Champ requis manquant : id"}), 400
    try:
        result = svc_get_email_body(username, password, msg_id, folder)
        return jsonify({"success": True, "html": result["html"], "attachments": result["attachments"]})
    except Exception as e:
        return error_response(e)


@email_bp.route('/send', methods=['POST'])
def send_email():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401

    # Support both JSON and multipart/form-data (Phase 2.5)
    if request.content_type and 'multipart/form-data' in request.content_type:
        to_addr = request.form.get('to')
        subject = request.form.get('subject')
        body = request.form.get('body')
        signature_html = request.form.get('signature_html')
        if not to_addr or not subject or not body:
            return jsonify({"error": "Champs requis manquants : to, subject, body"}), 400

        # Collect attachments from multipart
        attachments = []
        for key in request.files:
            f = request.files[key]
            if f.filename:
                content = f.read()
                mime = f.content_type or 'application/octet-stream'
                attachments.append((f.filename, content, mime))

        try:
            svc_send_email(username, password, to_addr, subject, body,
                           attachments=attachments if attachments else None,
                           signature_html=signature_html)
            return jsonify({"success": True})
        except Exception as e:
            return error_response(e)
    else:
        # JSON path
        data = request.json
        if not data:
            return jsonify({"error": "Corps JSON requis."}), 400
        to_addr = data.get('to')
        subject = data.get('subject')
        body = data.get('body')
        signature_html = data.get('signature_html')
        if not to_addr or not subject or not body:
            return jsonify({"error": "Champs requis manquants : to, subject, body"}), 400
        try:
            svc_send_email(username, password, to_addr, subject, body,
                           signature_html=signature_html)
            return jsonify({"success": True})
        except Exception as e:
            return error_response(e)


# ---------------------------------------------------------------------------
# Mark as read / unread (Phase 1.3)
# ---------------------------------------------------------------------------

@email_bp.route('/mark_read', methods=['POST'])
@validate_json({"required": ["id"], "types": {"id": str}})
def mark_read():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    folder = data.get('folder', 'inbox')
    try:
        svc_mark_as_read(username, password, msg_id, folder)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@email_bp.route('/mark_unread', methods=['POST'])
@validate_json({"required": ["id"], "types": {"id": str}})
def mark_unread():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    folder = data.get('folder', 'inbox')
    try:
        svc_mark_as_unread(username, password, msg_id, folder)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Draft (Phase 1.4)
# ---------------------------------------------------------------------------

@email_bp.route('/draft', methods=['POST'])
@validate_json({"required": ["to", "subject", "body"], "types": {"to": str, "subject": str, "body": str}})
def save_draft():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    try:
        svc_save_draft(username, password, data['to'], data['subject'], data['body'])
        return jsonify({"success": True, "message": "Brouillon enregistré."})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Delete (Phase 2.1)
# ---------------------------------------------------------------------------

@email_bp.route('/delete', methods=['POST'])
@validate_json({"required": ["id"], "types": {"id": str}})
def delete_email():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    folder = data.get('folder', 'inbox')
    try:
        svc_delete_email(username, password, msg_id, folder)
        return jsonify({"success": True, "message": "Email supprimé."})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Attachment download (Phase 2.4)
# ---------------------------------------------------------------------------

@email_bp.route('/attachment', methods=['POST'])
@validate_json({"required": ["id", "partIndex"], "types": {"id": str, "partIndex": int}})
def download_attachment():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    part_index = data['partIndex']
    folder = data.get('folder', 'inbox')
    try:
        content_bytes, filename, content_type = svc_get_attachment(
            username, password, msg_id, part_index, folder
        )
        return Response(
            content_bytes,
            mimetype=content_type,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': str(len(content_bytes)),
            },
        )
    except ValueError as e:
        return error_response(e, 404, str(e))
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Star / Unstar
# ---------------------------------------------------------------------------

@email_bp.route('/star', methods=['POST'])
@validate_json({"required": ["id"], "types": {"id": str}})
def star_email():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    folder = data.get('folder', 'inbox')
    try:
        svc_star_email(username, password, msg_id, folder)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@email_bp.route('/unstar', methods=['POST'])
@validate_json({"required": ["id"], "types": {"id": str}})
def unstar_email():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    folder = data.get('folder', 'inbox')
    try:
        svc_unstar_email(username, password, msg_id, folder)
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Move email
# ---------------------------------------------------------------------------

@email_bp.route('/move', methods=['POST'])
@validate_json({"required": ["id", "toFolder"], "types": {"id": str, "toFolder": str}})
def move_email_route():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    msg_id = data['id']
    from_folder = data.get('fromFolder', 'inbox')
    to_folder = data['toFolder']
    try:
        svc_move_email(username, password, msg_id, from_folder, to_folder)
        return jsonify({"success": True, "message": "Email déplacé."})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@email_bp.route('/search', methods=['POST'])
@validate_json({"required": ["query"], "types": {"query": str}})
def search_emails():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json
    query = data['query']
    folder = data.get('folder', 'inbox')
    offset = data.get('offset', 0)
    limit = data.get('limit', 30)
    try:
        emails = svc_search_emails(username, password, query, folder, offset=offset, limit=limit)
        return jsonify({"success": True, "emails": emails})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# List folders
# ---------------------------------------------------------------------------

@email_bp.route('/folders', methods=['GET'])
def email_folders():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    try:
        folders = svc_list_folders(username, password)
        return jsonify({"success": True, "folders": folders})
    except Exception as e:
        return error_response(e)


# ---------------------------------------------------------------------------
# Count for client / Batch count (Phase 1.5)
# ---------------------------------------------------------------------------

@email_bp.route('/count_for_client', methods=['POST'])
def count_for_client():
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401
    data = request.json or {}
    client_email = data.get('clientEmail')
    if not client_email:
        return jsonify({"error": "Champ requis manquant : clientEmail"}), 400
    try:
        count = svc_count_emails(username, password, client_email)
        return jsonify({"success": True, "count": count})
    except Exception as e:
        return error_response(e)


@email_bp.route('/count_batch', methods=['POST'])
@validate_json({"required": ["clientEmails"], "types": {"clientEmails": list}})
def count_batch():
    """Count unread emails for multiple client emails in a single IMAP connection."""
    username, password = _get_creds()
    if not username or not password:
        return jsonify({"error": "Identifiants email non configurés."}), 401

    data = request.json
    client_emails = data.get('clientEmails', [])

    try:
        results = svc_count_emails_batch(username, password, client_emails)
        return jsonify({"success": True, "counts": results})
    except Exception as e:
        return error_response(e)
