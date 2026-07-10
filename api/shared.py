"""
Shared state and utilities for API blueprints.
This module provides access to global state and utility functions used across blueprints.
"""

import os
import sys
import json
from services.logger import get_logger

logger = get_logger('api.shared')
import base64
import shutil
from pathlib import Path
from flask import jsonify
from config import get_current_config

cfg = get_current_config()

# --- File System Config (derived from centralised Config) ---
USER_HOME = cfg.USER_HOME
DESKTOP_PATH = cfg.DATA_PATH
AUTH_FILE = DESKTOP_PATH / ".marion_auth.json"
OAUTH_TOKENS_ENC = DESKTOP_PATH / ".oauth_tokens.enc"
OAUTH_TOKENS_JSON = DESKTOP_PATH / ".oauth_tokens.json"  # Legacy

# --- Shared In-Memory State ---
# Sessions and rate limiting are fully handled by SQLite (database.db)
oauth_tokens = {}     # In-memory cache of OAuth tokens (synced with SQLite)
current_password = None  # Password kept in memory for encryption/decryption


def get_current_password():
    """Get the current password (needed for encryption operations)."""
    return current_password


def set_current_password(password):
    """Set the current password after successful auth."""
    global current_password
    current_password = password


# --- Path Safety ---
def get_safe_path(req_path):
    """Resolve a request path safely within DESKTOP_PATH."""
    clean_req = req_path.lstrip('/') if req_path else ""
    full_path = (DESKTOP_PATH / clean_req).resolve()
    if not str(full_path).startswith(str(DESKTOP_PATH)):
        raise ValueError("Access denied")
    return full_path


# --- File System Structure ---
ARCHIVE_CATEGORIES = [
    "0. Associations", "1. Corporate", "2. Avocats",
    "3. Médical", "4. Immobilier", "5. Mariages",
    "6. Autre", "Audits"
]

STATUS_FOLDER_MAP = {
    "Prospect": "4. Prospects",
    "En cours": "1. En cours", "Active": "1. En cours",
    "Maintenance": "2. Maintenances",
    "Association": "3. Associations",
    "Archivé": "5. Archivés", "Archived": "5. Archivés",
    # Legacy mappings for migration
    "Actif": "1. En cours",
    "Pro bono": "3. Associations", "Pro Bono": "3. Associations",
    "Perso": "1. En cours",
}

FOLDER_STATUS_MAP = {
    "1. En cours": "En cours",
    "2. Maintenances": "Maintenance",
    "3. Associations": "Association",
    "4. Prospects": "Prospect",
    "5. Archivés": "Archivé",
    # Legacy folder names (in case old folders still exist)
    "Prospect": "Prospect", "Actif": "En cours",
    "Archivé": "Archivé", "Pro bono": "Association",
    "Perso": "En cours",
}


def count_scanned_project_folders() -> int:
    """
    Count directories that ``scan_projects`` would list (same traversal rules).
    Returns -1 if the filesystem cannot be read.
    """
    n = 0
    try:
        for folder_name in FOLDER_STATUS_MAP:
            status_path = DESKTOP_PATH / folder_name
            if not status_path.exists():
                continue
            for entry in status_path.iterdir():
                if not entry.is_dir() or entry.name.startswith('.'):
                    continue
                if folder_name in ("5. Archivés", "Archivé") and entry.name in ARCHIVE_CATEGORIES:
                    for sub in entry.iterdir():
                        if sub.is_dir() and not sub.name.startswith('.'):
                            n += 1
                else:
                    n += 1
    except OSError as e:
        logger.warning("count_scanned_project_folders: %s", e)
        return -1
    return n


def init_db_structure():
    """Initialize the database folder structure on disk."""
    if not DESKTOP_PATH.exists():
        try:
            os.makedirs(DESKTOP_PATH)
        except OSError:
            pass

    folders = ["1. En cours", "2. Maintenances", "3. Associations", "4. Prospects", "5. Archivés",
               "Notes", "Dépenses", "00_INBOX"]
    for folder in folders:
        path = DESKTOP_PATH / folder
        if not path.exists():
            os.makedirs(path)

    for sub in ARCHIVE_CATEGORIES:
        path = DESKTOP_PATH / "5. Archivés" / sub
        if not path.exists():
            os.makedirs(path)


# --- Sensitive fields for encryption ---
SENSITIVE_PROJECT_FIELDS = ['credentials', 'privateNotes']


def _normalize_project_list_fields(data: dict) -> dict:
    """Ensure list-shaped project fields are arrays (encrypted placeholders are strings)."""
    creds = data.get('credentials')
    if isinstance(creds, list):
        data['credentials'] = creds
    else:
        data['credentials'] = []
        if creds == '[CHIFFRE]' or data.get('_encrypted_credentials'):
            data['credentialsLocked'] = True

    moodboard = data.get('moodboard')
    if not isinstance(moodboard, list):
        data['moodboard'] = []

    data.pop('_encrypted_credentials', None)
    data.pop('_encrypted_privateNotes', None)
    return data


def load_project_data(project_path):
    """Load project data from .99_Admin/project.json and decrypt sensitive fields."""
    from crypto_utils import decrypt_sensitive_fields

    json_path = project_path / ".99_Admin" / "project.json"
    if json_path.exists():
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)

            # Decrypt sensitive fields if auth is configured
            pwd = get_current_password()
            if pwd and AUTH_FILE.exists():
                try:
                    with open(AUTH_FILE, 'r') as f:
                        auth_data = json.load(f)
                    salt = base64.b64decode(auth_data["salt"])
                    data = decrypt_sensitive_fields(data, pwd, salt, SENSITIVE_PROJECT_FIELDS)
                except Exception as e:
                    logger.warning("Could not decrypt sensitive fields: %s", e)

            return _normalize_project_list_fields(data)
        except Exception as e:
            logger.error("Error loading project data: %s", e, exc_info=True)
    return {}


def save_project_data_file(project_path, data):
    """Save project data to .99_Admin/project.json, encrypting sensitive fields."""
    from crypto_utils import encrypt_sensitive_fields

    admin_path = project_path / ".99_Admin"
    if not admin_path.exists():
        os.makedirs(admin_path)
    json_path = admin_path / "project.json"

    data_to_save = data.copy()
    pwd = get_current_password()
    if pwd and AUTH_FILE.exists():
        try:
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)
            salt = base64.b64decode(auth_data["salt"])
            data_to_save = encrypt_sensitive_fields(data_to_save, pwd, salt, SENSITIVE_PROJECT_FIELDS)
        except Exception as e:
            logger.warning("Could not encrypt sensitive fields: %s", e)

    with open(json_path, 'w') as f:
        json.dump(data_to_save, f, indent=2)


def get_project_progress(project_path, tasks=None):
    """Calculate project progress from folder structure and tasks."""
    folder_progress = 10
    try:
        if (project_path / "01_Brief").exists() and any(f.is_file() for f in (project_path / "01_Brief").iterdir() if not f.name.startswith('.')):
            folder_progress += 20
        if (project_path / "03_Design").exists() and any(f.is_file() for f in (project_path / "03_Design").iterdir() if not f.name.startswith('.')):
            folder_progress += 30
        if (project_path / "04_Livraison").exists() and any(f.is_file() for f in (project_path / "04_Livraison").iterdir() if not f.name.startswith('.')):
            folder_progress += 40
    except Exception:
        pass

    task_progress = 0
    if tasks and len(tasks) > 0:
        completed = sum(1 for t in tasks if t.get('completed'))
        task_progress = int((completed / len(tasks)) * 100)
        final_progress = int((folder_progress + task_progress) / 2)
    else:
        final_progress = folder_progress
    return min(final_progress, 100)


def save_avatar_file(project_path, data_url):
    """Save avatar image from data URL to .99_Admin/avatar.*"""
    try:
        if not data_url or not data_url.startswith('data:'):
            return False
        header, encoded = data_url.split(",", 1)
        ext = "png"
        if "svg" in header:
            ext = "svg"
        elif "jpeg" in header or "jpg" in header:
            ext = "jpg"
        file_path = project_path / ".99_Admin" / f"avatar.{ext}"
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(encoded))
        return True
    except Exception:
        return False


def load_avatar_file(project_path):
    """Load avatar image from .99_Admin/avatar.* as data URL."""
    try:
        admin_path = project_path / ".99_Admin"
        for ext in ["svg", "png", "jpg"]:
            file_path = admin_path / f"avatar.{ext}"
            if file_path.exists():
                with open(file_path, "rb") as f:
                    content = f.read()
                    mime = "image/svg+xml" if ext == "svg" else f"image/{ext}"
                    b64 = base64.b64encode(content).decode('utf-8')
                    return f"data:{mime};base64,{b64}"
    except Exception:
        pass
    return None


# --- Standardised error response ---

def error_response(e: Exception, status: int = 500, user_msg: str = "Erreur interne du serveur."):
    """
    Return a safe JSON error response.
    - Logs the full traceback server-side.
    - Returns a generic message to the client (no internal details leaked).
    For 400-class errors, pass a specific user_msg.
    """
    logger.error("[ERROR %s] %s", status, user_msg, exc_info=True)
    return jsonify({"error": user_msg}), status


# --- Input validation decorator ---

from functools import wraps
from flask import request as flask_request


def validate_json(schema: dict):
    """
    Lightweight JSON body validation decorator.
    
    schema = {
        "required": ["field1", "field2"],            # required keys
        "types": {"field1": str, "field2": int},     # expected types
        "max_lengths": {"field1": 500},              # max string lengths
    }
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            body = flask_request.get_json(silent=True)
            if body is None:
                return jsonify({"error": "Corps JSON requis."}), 400
            # Check required fields
            for field in schema.get("required", []):
                if field not in body:
                    return jsonify({"error": f"Champ requis manquant : {field}"}), 400
            # Check types
            for field, expected_type in schema.get("types", {}).items():
                if field in body and body[field] is not None and not isinstance(body[field], expected_type):
                    return jsonify({"error": f"Type invalide pour {field}."}), 400
            # Check max lengths
            for field, max_len in schema.get("max_lengths", {}).items():
                if field in body and isinstance(body[field], str) and len(body[field]) > max_len:
                    return jsonify({"error": f"{field} dépasse la taille maximale ({max_len})."}), 400
            return f(*args, **kwargs)
        return wrapper
    return decorator
