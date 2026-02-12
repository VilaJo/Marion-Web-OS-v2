"""
Marion Web OS - Main Flask Application
=======================================
Thin entry-point that:
  1. Creates the Flask app and applies configuration
  2. Registers all API blueprints
  3. Sets up the authentication middleware
  4. Serves the frontend (SPA catch-all)

All domain logic lives in the api/ blueprints and services/ layer.
"""

import os
import sys
import json
import base64
import threading
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from config import get_current_config
from services.logger import init_logging, get_logger
from database.db import (
    init_database,
    validate_session as db_validate_session,
    backup_database,
    run_migrations,
)
from api.shared import (
    DESKTOP_PATH, AUTH_FILE, init_db_structure,
    set_current_password as _sync_shared_password,
)

# ---------------------------------------------------------------------------
# App creation & configuration
# ---------------------------------------------------------------------------
cfg = get_current_config()

# Initialise structured logging before anything else
init_logging(
    log_level=cfg.LOG_LEVEL,
    data_path=str(cfg.DATA_PATH),
    environment=cfg.ENVIRONMENT,
)
logger = get_logger('server')

app = Flask(__name__, static_folder=cfg.STATIC_FOLDER)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.secret_key = cfg.SECRET_KEY

CORS(app, origins=cfg.CORS_ORIGINS, supports_credentials=True)

# ---------------------------------------------------------------------------
# Database initialisation
# ---------------------------------------------------------------------------
init_database()
run_migrations()  # Apply pending DB migrations
init_db_structure()
backup_database(max_backups=10)  # Auto-backup on startup (keeps last 10)

# ---------------------------------------------------------------------------
# Scheduled backup daemon (every 6 hours by default)
# ---------------------------------------------------------------------------
BACKUP_INTERVAL_HOURS = int(os.getenv('BACKUP_INTERVAL_HOURS', '6'))


def _scheduled_backup():
    """Run a database backup and schedule the next one."""
    try:
        path = backup_database(max_backups=10)
        if path:
            logger.info("Scheduled backup completed: %s", path)
        else:
            logger.warning("Scheduled backup returned no path")
    except Exception as e:
        logger.error("Scheduled backup failed: %s", e, exc_info=True)
    # Schedule next backup
    timer = threading.Timer(BACKUP_INTERVAL_HOURS * 3600, _scheduled_backup)
    timer.daemon = True
    timer.start()


# Start the first scheduled backup timer
_backup_timer = threading.Timer(BACKUP_INTERVAL_HOURS * 3600, _scheduled_backup)
_backup_timer.daemon = True
_backup_timer.start()
logger.info("Backup scheduler started — interval: every %dh", BACKUP_INTERVAL_HOURS)

# ---------------------------------------------------------------------------
# Blueprint registration
# ---------------------------------------------------------------------------

# API v1  (health, workspaces)
from api.v1 import init_v1
init_v1(app)

# Domain blueprints
from api.auth_bp import auth_bp
from api.projects_bp import projects_bp
from api.files_bp import files_bp
from api.ai_bp import ai_bp
from api.calendar_bp import calendar_bp
from api.invoices_bp import invoices_bp
from api.oauth_bp import oauth_bp
from api.email_bp import email_bp
from api.updates_bp import updates_bp
from api.backup_bp import backup_bp
from api.portal_bp import portal_bp
from api.analytics_bp import analytics_bp

app.register_blueprint(auth_bp)        # /api/v1/auth/*
app.register_blueprint(projects_bp)    # /api/v1/projects/*
app.register_blueprint(files_bp)       # /api/v1/files/*
app.register_blueprint(ai_bp)          # /api/v1/chat, /api/v1/ai/*, /api/v1/franck/*, /api/v1/media/*, etc.
app.register_blueprint(calendar_bp)    # /api/v1/calendar/*
app.register_blueprint(invoices_bp)    # /api/v1/expenses, /api/v1/notes, /api/v1/time/*
app.register_blueprint(oauth_bp)       # /api/v1/oauth/*, /api/v1/drive/*, /api/v1/gcal/*
app.register_blueprint(email_bp)       # /api/v1/email/*
app.register_blueprint(updates_bp)     # /api/v1/version, /api/v1/updates/*, /api/v1/report-bug
app.register_blueprint(backup_bp)      # /api/v1/backup
app.register_blueprint(portal_bp)
app.register_blueprint(analytics_bp)     # /api/v1/analytics/*      # /api/v1/portal/*

# ---------------------------------------------------------------------------
# Authentication middleware
# ---------------------------------------------------------------------------

# Password kept in memory for encryption/decryption (set on successful auth)
current_password = None


@app.before_request
def require_auth():
    """Verify the session token on every API request."""
    global current_password

    # Public endpoints (no auth required)
    public_paths = [
        '/api/v1/auth/check',
        '/api/v1/auth/setup',
        '/api/v1/auth/login',
        '/api/v1/auth/reset',
        '/api/v1/ai/setup',
        '/api/v1/ai/check-status',
    ]

    public_prefixes = [
        '/api/v1/oauth/',
        '/api/v1/health',
        '/api/v1/version',
    ]

    # Portal public endpoints: /api/v1/portal/<token>/auth, /api/v1/portal/<token>/check, etc.
    # These use their own PIN-based auth, not Marion session auth.
    if request.path.startswith('/api/v1/portal/'):
        # Extract the segment after /api/v1/portal/
        parts = request.path[len('/api/v1/portal/'):].strip('/').split('/')
        # Public routes have a token (long alphanumeric string) as first segment
        # Admin routes have known keywords: deliverable, deliverables, update, updates,
        #   comment, comments, client-files, unseen
        admin_keywords = {
            'deliverable', 'deliverables', 'update', 'updates',
            'comment', 'comments', 'client-files', 'unseen',
        }
        if parts and parts[0] not in admin_keywords:
            # This is a public portal route (token-based)
            return None

    if any(request.path.startswith(p) for p in public_prefixes):
        return None

    # Static assets
    static_ext = (
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
        '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.map',
    )
    if request.path.endswith(static_ext):
        return None
    if request.path.startswith('/.dist') or request.path.startswith('/assets'):
        return None

    # Known public paths
    if any(request.path == p for p in public_paths):
        return None

    # Frontend routes (non-API)
    if request.path == '/' or not request.path.startswith('/api/v1/'):
        return None

    # Auth not yet configured → allow
    if not AUTH_FILE.exists():
        return None

    # Validate session token (header or query param for img/download requests)
    token = request.headers.get('X-Marion-Token') or request.args.get('X-Marion-Token')
    if not token:
        return jsonify({"error": "Non authentifie", "code": "NO_TOKEN"}), 401

    session_data = db_validate_session(token)
    if session_data:
        current_password = session_data.get("password_for_encryption")
        _sync_shared_password(current_password)
        return None

    return jsonify({"error": "Session invalide", "code": "INVALID_TOKEN"}), 401


# ---------------------------------------------------------------------------
# Load OAuth tokens from DB on startup
# ---------------------------------------------------------------------------
from services.oauth_service import load_from_db as _load_oauth
_load_oauth()

# ---------------------------------------------------------------------------
# Frontend SPA catch-all
# ---------------------------------------------------------------------------

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve the React frontend (SPA)."""
    if path.startswith('api/'):
        return jsonify({"error": "Not found – use /api/v1/ prefix"}), 404

    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)

    # Don't return index.html for static asset paths that don't exist
    static_ext = (
        '.js', '.css', '.map', '.woff', '.woff2', '.ttf', '.eot',
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    )
    if path and any(path.endswith(ext) for ext in static_ext):
        return jsonify({"error": "Not found"}), 404

    return send_from_directory(app.static_folder, 'index.html')


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    try:
        cfg.print_summary()

        # Initialise Gemini client
        from services.gemini_service import init_client, get_client
        logger.info("Initializing Gemini Client...")
        init_client()
        client = get_client()
        logger.info("Client Status: %s", 'Configured' if client else 'Not Configured')

        logger.info("Starting Marion Web OS on %s:%s...", cfg.HOST, cfg.PORT)
        app.run(host=cfg.HOST, port=cfg.PORT, debug=cfg.DEBUG, use_reloader=False)
    except Exception as e:
        logger.critical("CRITICAL STARTUP ERROR: %s", e, exc_info=True)
