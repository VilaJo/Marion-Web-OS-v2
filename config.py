"""
Eonora Tech OS - Configuration
Multi-environment configuration management.

All application settings are centralised here. Modules should import
``get_current_config()`` instead of reading ``os.getenv`` directly so that
environment-specific overrides and validation happen in one place.
"""

# `from __future__ import annotations` rend toutes les annotations paresseuses
# (évaluées comme strings), ce qui permet la syntaxe `X | None` même sur
# Python 3.9 (Mac de Marion). Sans ça, `_config: type[Config] | None = None`
# crashe à l'import avec TypeError.
from __future__ import annotations

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load .env files (order matters: .env.local wins over .env)
# ---------------------------------------------------------------------------
def get_marion_support_dir() -> Path:
    """User-writable config for the installed .app (outside /Applications)."""
    home = Path.home()
    support_root = home / "Library" / "Application Support"
    for name in ("Eonora Tech OS", "Marion Web OS"):
        path = support_root / name
        if path.is_dir():
            return path
    return support_root / "Eonora Tech OS"


_INSTALLED_ENV_CANDIDATES = (
    ".env.local",
    "MARION-env.local",
    "env.local",
    ".env",
)


def resolve_installed_env_file() -> Path | None:
    """First existing config file in Application Support (Finder-friendly names OK)."""
    support = get_marion_support_dir()
    for name in _INSTALLED_ENV_CANDIDATES:
        path = support / name
        if path.is_file():
            return path
    return None


def get_env_local_path() -> Path:
    """Path to env config — Application Support when installed via .dmg."""
    if os.getenv("MARION_INSTALLED_APP"):
        found = resolve_installed_env_file()
        if found:
            return found
        return get_marion_support_dir() / ".env.local"
    return get_application_root() / ".env.local"


def get_application_root() -> Path:
    """Directory containing this file: Marion project root (next to ``franck_server.py``)."""
    return Path(__file__).resolve().parent


if os.getenv("MARION_INSTALLED_APP"):
    _support = get_marion_support_dir()
    for name in reversed(_INSTALLED_ENV_CANDIDATES):
        load_dotenv(_support / name)

load_dotenv(".env.local")
load_dotenv(".env")


def _legacy_desktop_data_candidates() -> list[Path]:
    """Known locations for client data (new name + legacy Marion installs)."""
    home = Path.home()
    folder_names = ("Eonora Tech OS Database", "Marion Web OS Database")
    bases = (
        home / "Desktop",
        home / "Bureau",
        home / "Library" / "Mobile Documents" / "com~apple~CloudDocs" / "Desktop",
        home / "Library" / "Mobile Documents" / "com~apple~CloudDocs" / "Bureau",
    )
    return [base / name for base in bases for name in folder_names]


def _folder_has_client_data(path: Path) -> bool:
    """True if folder looks like an existing Marion client database."""
    if not path.is_dir():
        return False
    if (path / "marion.db").is_file():
        return True
    for name in ("1. En cours", "4. Prospects", "2. Archives", "3. Terminés", "5. Archivés", "backups"):
        if (path / name).is_dir():
            return True
    try:
        return any(path.iterdir())
    except OSError:
        return False


def _find_legacy_desktop_data() -> Path | None:
    for candidate in _legacy_desktop_data_candidates():
        if _folder_has_client_data(candidate):
            return candidate.resolve()
    return None


def _default_data_path() -> Path:
    """Default client data directory for dev vs installed .app."""
    legacy = _find_legacy_desktop_data()
    if legacy is not None:
        return legacy
    if os.getenv("MARION_INSTALLED_APP"):
        return get_marion_support_dir() / "Data"
    return Path.home() / "Desktop" / "Eonora Tech OS Database"


def _resolve_data_path() -> Path:
    explicit = os.getenv("DATA_PATH", "").strip()
    if explicit:
        return Path(explicit).expanduser().resolve()
    return _default_data_path()


def _resolve_database_url(data_path: Path) -> str:
    explicit = os.getenv("DATABASE_URL", "").strip()
    if explicit:
        return explicit
    return f"sqlite:///{data_path / 'marion.db'}"


# ---------------------------------------------------------------------------
# Base configuration
# ---------------------------------------------------------------------------

class Config:
    """Base configuration shared by all environments."""

    # -- Application --------------------------------------------------------
    APP_NAME = os.getenv('APP_NAME', 'Eonora Tech OS')
    APP_VERSION = '2.13.13'
    DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 'yes')
    ENVIRONMENT = os.getenv('FLASK_ENV', os.getenv('ENV', 'development'))
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

    # -- Security -----------------------------------------------------------
    SECRET_KEY = os.getenv('SECRET_KEY', os.getenv('FLASK_SECRET_KEY'))
    if not SECRET_KEY:
        # Generate a stable secret key based on machine identity (dev only)
        import hashlib
        _machine_id = str(Path.home()) + os.getenv('USER', 'marion')
        SECRET_KEY = hashlib.sha256(_machine_id.encode()).hexdigest()

    SESSION_DURATION_HOURS = int(os.getenv('SESSION_DURATION_HOURS', '8'))
    MAX_LOGIN_ATTEMPTS = int(os.getenv('MAX_LOGIN_ATTEMPTS', '10'))
    RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '60'))

    # -- Database & paths (DATA_PATH first — DB must live alongside data) -----
    USER_HOME = Path.home()
    DATA_PATH = _resolve_data_path()
    DATABASE_URL = _resolve_database_url(DATA_PATH)

    STATIC_FOLDER = os.getenv('STATIC_FOLDER', '.dist')

    # -- API Keys -----------------------------------------------------------
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    GEMINI_FLASH_MODEL = os.getenv('GEMINI_FLASH_MODEL', 'gemini-2.5-flash')
    GEMINI_PRO_MODEL = os.getenv('GEMINI_PRO_MODEL', 'gemini-2.5-pro')
    GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')
    APOLLO_API_KEY = os.getenv('APOLLO_API_KEY', '')

    # -- AI Provider Routing ------------------------------------------------
    AI_PROVIDER = os.getenv('AI_PROVIDER', 'cloud').lower()  # cloud | local | hybrid
    AI_FALLBACK_PROVIDER = os.getenv('AI_FALLBACK_PROVIDER', 'cloud').lower()
    AI_LOCAL_TIMEOUT_MS = int(os.getenv('AI_LOCAL_TIMEOUT_MS', '45000'))
    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
    OLLAMA_MODEL_CHAT = os.getenv('OLLAMA_MODEL_CHAT', 'qwen2.5:7b-instruct')
    OLLAMA_MODEL_REASONING = os.getenv('OLLAMA_MODEL_REASONING', 'qwen2.5:7b-instruct')
    OLLAMA_MODEL_VISION = os.getenv('OLLAMA_MODEL_VISION', 'llama3.2-vision')

    # -- Google OAuth -------------------------------------------------------
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    GOOGLE_REDIRECT_URI = os.getenv(
        'GOOGLE_REDIRECT_URI',
        'http://127.0.0.1:5003/api/v1/oauth/google/callback',
    )
    GOOGLE_SCOPES = os.getenv(
        'GOOGLE_SCOPES',
        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar',
    )

    # -- GitHub -------------------------------------------------------------
    GITHUB_REPO_OWNER = os.getenv('GITHUB_REPO_OWNER', 'VilaJo')
    GITHUB_REPO_NAME = os.getenv('GITHUB_REPO_NAME', 'Marion-Web-OS-v2')

    # -- CORS -----------------------------------------------------------------
    # PUBLIC_BASE_URL: the HTTPS URL exposed by the Cloudflare Tunnel (see
    # packaging/cloudflare_tunnel.sh). When set, it's added to the allowed CORS
    # origins so the client portal keeps working through the tunnel. The
    # server itself always keeps binding to 127.0.0.1 — the tunnel connects
    # locally, it never opens the port to the outside directly.
    PUBLIC_BASE_URL = os.getenv('PUBLIC_BASE_URL', '').strip()

    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://127.0.0.1:5003,http://localhost:5003').split(',')
    if PUBLIC_BASE_URL and PUBLIC_BASE_URL not in CORS_ORIGINS:
        CORS_ORIGINS.append(PUBLIC_BASE_URL)

    # -- Email (IMAP / SMTP) ------------------------------------------------
    IMAP_HOST = os.getenv('IMAP_HOST', 'mail.infomaniak.com')
    IMAP_PORT = int(os.getenv('IMAP_PORT', '993'))
    SMTP_HOST = os.getenv('SMTP_HOST', 'mail.infomaniak.com')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
    SMTP_USER = os.getenv('SMTP_USER', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', '')
    SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'Eonora Tech OS')

    # -- Server -------------------------------------------------------------
    HOST = os.getenv('HOST', '127.0.0.1')
    PORT = int(os.getenv('PORT', '5003'))

    # -- Derived helpers ----------------------------------------------------

    @classmethod
    def get_db_path(cls) -> Path:
        """Return the resolved database file path from ``DATABASE_URL``."""
        url = cls.DATABASE_URL
        if url.startswith('sqlite:///'):
            return Path(url.replace('sqlite:///', '', 1))
        # Fallback
        return cls.DATA_PATH / 'marion.db'

    @classmethod
    def ensure_data_path(cls) -> Path:
        """Ensure the data directory exists and return it."""
        cls.DATA_PATH.mkdir(parents=True, exist_ok=True)
        return cls.DATA_PATH

    @classmethod
    def validate(cls):
        """Validate the configuration. Override in subclasses for stricter checks."""
        errors: list[str] = []
        if not cls.SECRET_KEY:
            errors.append("SECRET_KEY is empty")
        if errors:
            raise ValueError(f"Config validation failed: {'; '.join(errors)}")

    @classmethod
    def configure_logging(cls):
        """Set up logging for the current environment."""
        log_format = '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        level = getattr(logging, cls.LOG_LEVEL, logging.INFO)
        logging.basicConfig(level=level, format=log_format)
        # Quieten noisy third-party loggers in non-debug mode
        if not cls.DEBUG:
            logging.getLogger('werkzeug').setLevel(logging.WARNING)

    @classmethod
    def print_summary(cls):
        """Print a human-readable startup summary (non-sensitive values only)."""
        has_gemini = '✓' if cls.GEMINI_API_KEY else '✗'
        has_google = '✓' if (cls.GOOGLE_CLIENT_ID and cls.GOOGLE_CLIENT_SECRET) else '✗'
        has_github = '✓' if cls.GITHUB_TOKEN else '✗'
        has_smtp = '✓' if cls.SMTP_HOST else '✗'
        has_apollo = '✓' if cls.APOLLO_API_KEY else '✗'
        _config_logger.info(
            "\n╔══════════════════════════════════════════╗\n"
            "║  %s v%s\n"
            "║  Environment : %s\n"
            "║  Debug       : %s\n"
            "║  Log level   : %s\n"
            "║  Database    : %s\n"
            "║  Data path   : %s\n"
            "║  Server      : %s:%s\n"
            "║  Integrations: Gemini %s  Google %s  GitHub %s  SMTP %s  Apollo %s\n"
            "╚══════════════════════════════════════════╝",
            cls.APP_NAME, cls.APP_VERSION, cls.ENVIRONMENT, cls.DEBUG, cls.LOG_LEVEL,
            cls.get_db_path(), cls.DATA_PATH, cls.HOST, cls.PORT,
            has_gemini, has_google, has_github, has_smtp, has_apollo,
        )


# ---------------------------------------------------------------------------
# Environment-specific configurations
# ---------------------------------------------------------------------------

class DevelopmentConfig(Config):
    """Development configuration — verbose logging, debug enabled."""
    DEBUG = True
    ENVIRONMENT = 'development'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'DEBUG').upper()


class ProductionConfig(Config):
    """Production configuration — strict validation, no debug."""
    DEBUG = False
    ENVIRONMENT = 'production'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'WARNING').upper()

    @classmethod
    def validate(cls):
        """Production checks — auto-generate SECRET_KEY if missing."""
        if not os.getenv('SECRET_KEY'):
            import secrets
            generated = secrets.token_urlsafe(64)
            os.environ['SECRET_KEY'] = generated
            cls.SECRET_KEY = generated
            _config_logger.warning(
                "SECRET_KEY not set — auto-generated for this session. "
                "Set SECRET_KEY in .env for persistent sessions across restarts."
            )
        if not cls.GEMINI_API_KEY:
            _config_logger.warning("GEMINI_API_KEY not set — Franck chatbot will not work")


class TestingConfig(Config):
    """Testing configuration — in-memory DB, debug enabled."""
    DEBUG = True
    TESTING = True
    ENVIRONMENT = 'testing'
    LOG_LEVEL = 'DEBUG'
    DATABASE_URL = 'sqlite:///:memory:'


# Use standard logging.getLogger to avoid circular import (logger imports config)
_config_logger = logging.getLogger('marion.config')


# ---------------------------------------------------------------------------
# Config resolution
# ---------------------------------------------------------------------------

config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}


def get_config(env: str = None) -> type[Config]:
    """Return the configuration *class* for the given environment name."""
    if env is None:
        env = os.getenv('FLASK_ENV', os.getenv('ENV', 'development'))
    return config_map.get(env, DevelopmentConfig)


# Singleton ------------------------------------------------------------------

_config: type[Config] | None = None


def get_current_config() -> type[Config]:
    """Return the active configuration class (cached singleton)."""
    global _config
    if _config is None:
        _config = get_config()
        _config.configure_logging()
        _config.validate()
    return _config
