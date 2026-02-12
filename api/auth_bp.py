"""
Auth Blueprint - Authentication routes
Handles: setup, login, logout, check, reset
"""

import json
import base64
from flask import Blueprint, request, jsonify

from services.logger import get_logger
from config import get_current_config

logger = get_logger('api.auth')
from crypto_utils import generate_salt, hash_password, verify_password
from database.db import (
    create_session as db_create_session,
    validate_session as db_validate_session,
    delete_session as db_delete_session,
    delete_expired_sessions,
    check_rate_limit as db_check_rate_limit,
    create_user, get_user_by_email, update_user_last_login
)
from api.shared import (
    AUTH_FILE, OAUTH_TOKENS_ENC, OAUTH_TOKENS_JSON, DESKTOP_PATH,
    oauth_tokens,
    get_current_password, set_current_password,
    error_response,
)

cfg = get_current_config()
auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

MAX_LOGIN_ATTEMPTS = cfg.MAX_LOGIN_ATTEMPTS


# ============================================================================
# Middleware helper
# ============================================================================

def require_auth():
    """
    Validates the session token against SQLite.
    Returns None if valid, or a response tuple if invalid.
    This is called from the main app's before_request hook.
    """
    token = request.headers.get('X-Marion-Token')
    if not token:
        return jsonify({"error": "Non authentifie", "code": "NO_TOKEN"}), 401

    # Validate session against SQLite
    session_data = db_validate_session(token)
    if session_data:
        set_current_password(session_data.get("password_for_encryption"))
        return None

    return jsonify({"error": "Session invalide", "code": "INVALID_TOKEN"}), 401


# ============================================================================
# Routes
# ============================================================================

@auth_bp.route('/check')
def auth_check():
    """Check if auth is configured and if the current session is valid."""
    is_configured = AUTH_FILE.exists()

    token = request.headers.get('X-Marion-Token')
    is_authenticated = False

    if token:
        session_data = db_validate_session(token)
        if session_data:
            is_authenticated = True

    return jsonify({
        "configured": is_configured,
        "authenticated": is_authenticated
    })


@auth_bp.route('/setup', methods=['POST'])
def auth_setup():
    """Configure the initial password."""
    if AUTH_FILE.exists():
        return jsonify({"error": "Deja configure"}), 400

    data = request.get_json()
    password = data.get('password', '')

    if len(password) < 6:
        return jsonify({"error": "Mot de passe trop court (min 6 caracteres)"}), 400

    salt = generate_salt()
    password_hash = hash_password(password, salt)

    auth_data = {
        "salt": base64.b64encode(salt).decode(),
        "password_hash": password_hash,
        "created_at": __import__('datetime').datetime.now().isoformat()
    }

    with open(AUTH_FILE, 'w') as f:
        json.dump(auth_data, f)

    # Create user in SQLite
    user = get_user_by_email('marion@local')
    if not user:
        user_id = create_user(
            email='marion@local',
            password_hash=password_hash,
            password_salt=base64.b64encode(salt).decode(),
            display_name='Marion'
        )
    else:
        user_id = user['id']

    # Create session (SQLite)
    token = db_create_session(
        user_id=user_id,
        password_for_encryption=password,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', ''),
        duration_hours=cfg.SESSION_DURATION_HOURS
    )
    set_current_password(password)

    return jsonify({
        "success": True,
        "token": token,
        "message": "Mot de passe configure"
    })


@auth_bp.route('/login', methods=['POST'])
def auth_login():
    """Login with password."""
    client_ip = request.remote_addr

    # Rate limiting (SQLite-backed)
    try:
        allowed = db_check_rate_limit(client_ip, 'login', MAX_LOGIN_ATTEMPTS, cfg.RATE_LIMIT_WINDOW_SECONDS)
    except Exception:
        allowed = True
    if not allowed:
        return jsonify({"error": "Trop de tentatives. Reessayez dans 1 minute."}), 429

    if not AUTH_FILE.exists():
        return jsonify({"error": "Non configure", "code": "NOT_CONFIGURED"}), 400

    data = request.get_json()
    password = data.get('password', '')

    try:
        with open(AUTH_FILE, 'r') as f:
            auth_data = json.load(f)
    except Exception:
        return jsonify({"error": "Erreur de lecture"}), 500

    salt = base64.b64decode(auth_data["salt"])
    stored_hash = auth_data["password_hash"]

    if not verify_password(password, salt, stored_hash):
        return jsonify({"error": "Mot de passe incorrect"}), 401

    # Get or create user
    user = get_user_by_email('marion@local')
    if not user:
        user_id = create_user(
            email='marion@local',
            password_hash=stored_hash,
            password_salt=auth_data["salt"],
            display_name='Marion'
        )
    else:
        user_id = user['id']
        update_user_last_login(user_id)

    # Create session (SQLite)
    token = db_create_session(
        user_id=user_id,
        password_for_encryption=password,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', ''),
        duration_hours=cfg.SESSION_DURATION_HOURS
    )
    set_current_password(password)

    # Clean up expired sessions
    try:
        delete_expired_sessions()
    except Exception:
        pass

    return jsonify({
        "success": True,
        "token": token
    })


@auth_bp.route('/logout', methods=['POST'])
def auth_logout():
    """Logout - invalidate session."""
    token = request.headers.get('X-Marion-Token')
    if token:
        try:
            db_delete_session(token)
        except Exception:
            pass

    set_current_password(None)
    return jsonify({"success": True})


@auth_bp.route('/reset', methods=['POST'])
def auth_reset():
    """Reset authentication - DELETE encrypted data and DB sessions."""
    from database.db import delete_user_sessions
    from database.db import delete_oauth_token as _db_delete_oauth

    data = request.get_json()
    confirm = data.get('confirm', '')

    if confirm != 'RESET':
        return jsonify({"error": "Confirmation requise"}), 400

    try:
        # Remove legacy files
        if AUTH_FILE.exists():
            AUTH_FILE.unlink()
        if OAUTH_TOKENS_ENC.exists():
            OAUTH_TOKENS_ENC.unlink()
        if OAUTH_TOKENS_JSON.exists():
            OAUTH_TOKENS_JSON.unlink()

        # Clear SQLite sessions and OAuth tokens
        try:
            from database.db import get_user_by_email as _get_user
            user = _get_user('marion@local')
            if user:
                delete_user_sessions(user['id'])
                _db_delete_oauth(user['id'], 'google')
        except Exception:
            pass

        oauth_tokens.clear()
        set_current_password(None)

        return jsonify({
            "success": True,
            "message": "Authentification reinitialisee."
        })
    except Exception as e:
        return error_response(e)
