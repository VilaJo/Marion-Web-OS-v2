"""
OAuth Service - Manages Google OAuth tokens (in-memory cache + SQLite persistence).

Provides helpers for token refresh, persistence and loading so that
blueprints dealing with Google APIs can stay thin.

Tokens are encrypted at rest using Fernet (via crypto_utils).
"""

import time
import base64
import json
import urllib.parse
import requests
from typing import Optional

from config import get_current_config
from database.db import (
    save_oauth_token as db_save_oauth_token,
    get_oauth_token as db_get_oauth_token,
    delete_oauth_token as db_delete_oauth_token,
    get_user_by_email,
)
from crypto_utils import encrypt_field, decrypt_field, is_encrypted_field
from services.logger import get_logger

logger = get_logger('services.oauth')
cfg = get_current_config()

# In-memory cache  (email -> {access_token, refresh_token, expires_in, user_info})
oauth_tokens: dict = {}


# ---------------------------------------------------------------------------
# Encryption helpers for token-at-rest protection
# ---------------------------------------------------------------------------

def _get_crypto_params():
    """Get password and salt needed for token encryption from shared state."""
    try:
        from api.shared import get_current_password, AUTH_FILE
        pwd = get_current_password()
        if not pwd or not AUTH_FILE.exists():
            return None, None
        with open(AUTH_FILE, 'r') as f:
            auth_data = json.load(f)
        salt = base64.b64decode(auth_data["salt"])
        return pwd, salt
    except Exception:
        return None, None


def _encrypt_token(value: str) -> str:
    """Encrypt a token string. Returns original value if encryption is unavailable."""
    if not value:
        return value
    pwd, salt = _get_crypto_params()
    if pwd and salt:
        try:
            return encrypt_field(value, pwd, salt)
        except Exception as e:
            logger.warning("[OAuth] Token encryption failed, storing plain: %s", e)
    return value


def _decrypt_token(value: str) -> str:
    """Decrypt a token string. Returns as-is if not encrypted or decryption fails."""
    if not value:
        return value
    pwd, salt = _get_crypto_params()
    if pwd and salt and is_encrypted_field(value):
        try:
            return decrypt_field(value, pwd, salt)
        except Exception as e:
            logger.warning("[OAuth] Token decryption failed (may be plain-text): %s", e)
    return value


# ---------------------------------------------------------------------------
# Token persistence  (SQLite  <->  in-memory)
# ---------------------------------------------------------------------------

def persist_to_db(email: str):
    """Save the in-memory OAuth tokens for *email* into SQLite (encrypted at rest)."""
    try:
        user = get_user_by_email('marion@local')
        if not user or email not in oauth_tokens:
            return
        tokens = oauth_tokens[email]
        db_save_oauth_token(
            user_id=user['id'],
            provider='google',
            email=email,
            access_token=_encrypt_token(tokens.get('access_token', '')),
            refresh_token=_encrypt_token(tokens.get('refresh_token') or ''),
            expires_in=tokens.get('expires_in'),
            scope=cfg.GOOGLE_SCOPES,
        )
    except Exception as e:
        logger.error("Failed to persist OAuth token to DB: %s", e, exc_info=True)


def load_from_db(user_id: int = None):
    """Load OAuth tokens from SQLite into the in-memory cache (decrypts at rest)."""
    global oauth_tokens
    try:
        if user_id is None:
            user = get_user_by_email('marion@local')
            if not user:
                return
            user_id = user['id']

        token_data = db_get_oauth_token(user_id, 'google')
        if token_data:
            email = token_data['email']
            oauth_tokens[email] = {
                "access_token": _decrypt_token(token_data['access_token']),
                "refresh_token": _decrypt_token(token_data.get('refresh_token') or ''),
                "expires_in": token_data.get('expires_in'),
                "expires_at": 0,  # unknown from DB, will be refreshed proactively
                "user_info": {"email": email},
            }
            logger.info("OAuth tokens loaded from DB for: %s", email)
    except Exception as e:
        logger.error("Failed to load OAuth tokens from DB: %s", e, exc_info=True)


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

def refresh_google_token(email: str) -> bool:
    """Refresh a Google OAuth token if expired. Returns True on success."""
    global oauth_tokens

    if email not in oauth_tokens:
        return False

    refresh_token = oauth_tokens[email].get('refresh_token')
    if not refresh_token:
        return False

    try:
        response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": cfg.GOOGLE_CLIENT_ID,
                "client_secret": cfg.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        if response.status_code == 200:
            new_tokens = response.json()
            oauth_tokens[email]['access_token'] = new_tokens['access_token']
            if 'refresh_token' in new_tokens:
                oauth_tokens[email]['refresh_token'] = new_tokens['refresh_token']
            expires_in = new_tokens.get('expires_in')
            oauth_tokens[email]['expires_in'] = expires_in
            oauth_tokens[email]['expires_at'] = time.time() + int(expires_in) if expires_in else 0
            persist_to_db(email)
            logger.info("Token refreshed for %s, expires in %ss", email, expires_in)
            return True
    except Exception as e:
        logger.error("Token refresh failed: %s", e, exc_info=True)

    return False


def get_valid_token(email: str) -> Optional[str]:
    """Return a valid access-token for *email*, refreshing proactively if near expiry."""
    if email not in oauth_tokens:
        load_from_db()
    if email not in oauth_tokens:
        return None

    token_data = oauth_tokens[email]
    access_token = token_data.get('access_token')
    expires_at = token_data.get('expires_at', 0)

    # Proactive refresh: if token expires within 5 minutes (or expires_at unknown/0)
    if expires_at == 0 or time.time() > expires_at - 300:
        if refresh_google_token(email):
            return oauth_tokens[email].get('access_token')
        # Refresh failed — maybe the current token is still valid, try it
        if access_token and expires_at > time.time():
            return access_token
        return None

    return access_token


def get_first_email() -> Optional[str]:
    """Return the first authenticated email, or None."""
    if not oauth_tokens:
        load_from_db()
    if oauth_tokens:
        return list(oauth_tokens.keys())[0]
    return None


def get_first_access_token() -> Optional[str]:
    """Convenience: return the access-token of the first authenticated account."""
    email = get_first_email()
    if email:
        return oauth_tokens[email].get('access_token')
    return None


def disconnect():
    """Disconnect all Google accounts (clear memory + DB)."""
    global oauth_tokens
    try:
        user = get_user_by_email('marion@local')
        if user:
            db_delete_oauth_token(user['id'], 'google')
    except Exception as e:
        logger.error("Failed to delete OAuth token from DB: %s", e, exc_info=True)
    oauth_tokens = {}


def store_tokens(email: str, tokens: dict, user_info: dict = None):
    """Store tokens in memory and persist to DB."""
    expires_in = tokens.get("expires_in")
    oauth_tokens[email] = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token"),
        "expires_in": expires_in,
        "expires_at": time.time() + int(expires_in) if expires_in else 0,
        "user_info": user_info or {"email": email},
    }
    persist_to_db(email)
