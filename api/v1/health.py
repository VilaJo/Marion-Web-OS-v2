"""
Health & System endpoints for API v1
"""

import sys
import platform
from datetime import datetime
from flask import jsonify

from config import get_current_config
from . import api_v1

cfg = get_current_config()

_start_time = datetime.now()


@api_v1.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "version": cfg.APP_VERSION,
        "uptime_seconds": int((datetime.now() - _start_time).total_seconds()),
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "environment": cfg.ENVIRONMENT,
    })



# NOTE: /version endpoint is now served by updates_bp (at /api/v1/version)
# which provides richer version info including buildDate.
