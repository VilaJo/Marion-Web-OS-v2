"""
Marion Web OS - Structured Logger
=================================
Provides a configured logger with:
  - Console handler (stdout) — always active
  - File handler with rotation (RotatingFileHandler) — logs to DATA_PATH/logs/
  - Levels: DEBUG in development, INFO in production
  - Format: [YYYY-MM-DD HH:MM:SS] [LEVEL] [module] message

Usage in any module:
    from services.logger import get_logger
    logger = get_logger(__name__)
    logger.info("Something happened")
"""

from __future__ import annotations

import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------
_initialized = False
_log_dir: Path | None = None

LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Defaults — overridden by init_logging()
_DEFAULT_LEVEL = logging.INFO
_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
_BACKUP_COUNT = 3


def init_logging(
    log_level: str = 'INFO',
    data_path: str | Path | None = None,
    environment: str = 'development',
):
    """
    Initialise the 'marion' root logger.
    Should be called once at startup (from franck_server.py).
    
    Args:
        log_level: Desired log level string (DEBUG, INFO, WARNING, ERROR)
        data_path: Directory where log files are stored (defaults to DATA_PATH env or cwd)
        environment: 'development' or 'production'
    """
    global _initialized, _log_dir

    if _initialized:
        return

    # Resolve log directory
    if data_path is None:
        data_path = os.getenv('DATA_PATH', str(Path.home() / 'Desktop' / 'Marion Web OS Database'))
    _log_dir = Path(data_path) / 'logs'
    _log_dir.mkdir(parents=True, exist_ok=True)

    # Resolve level
    level_name = log_level.upper() if log_level else 'INFO'
    if environment == 'development':
        level_name = os.getenv('LOG_LEVEL', 'DEBUG').upper()
    level = getattr(logging, level_name, logging.INFO)

    # Configure root 'marion' logger
    root_logger = logging.getLogger('marion')
    root_logger.setLevel(level)
    root_logger.propagate = False  # Don't bubble up to Python root logger

    # Remove existing handlers (if re-called)
    root_logger.handlers.clear()

    formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler with rotation
    try:
        log_file = _log_dir / 'marion.log'
        file_handler = RotatingFileHandler(
            str(log_file),
            maxBytes=_MAX_BYTES,
            backupCount=_BACKUP_COUNT,
            encoding='utf-8',
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except Exception as e:
        # Don't crash if we can't write log files
        console_handler.setLevel(logging.DEBUG)
        root_logger.warning("Could not create file handler for logs: %s", e)

    # Quieten noisy libraries in production
    if environment == 'production':
        logging.getLogger('werkzeug').setLevel(logging.WARNING)

    _initialized = True
    root_logger.info(
        "Logger initialized — level=%s, env=%s, log_dir=%s",
        level_name, environment, _log_dir,
    )


def get_logger(name: str = 'marion') -> logging.Logger:
    """
    Get a child logger under the 'marion' namespace.
    
    Usage:
        logger = get_logger(__name__)       # e.g. 'marion.api.auth_bp'
        logger = get_logger('backup')       # e.g. 'marion.backup'
    """
    if name.startswith('marion'):
        return logging.getLogger(name)
    return logging.getLogger(f'marion.{name}')
