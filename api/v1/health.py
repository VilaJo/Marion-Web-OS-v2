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
    from services.gemini_service import ai_status_payload, resolve_ai_prefs, is_local_available
    from api.ai_bp import MEETING_METRICS

    ai_payload = ai_status_payload(resolve_ai_prefs({"ai_mode": "cloud"}))
    analyze_total = max(1, MEETING_METRICS.get("analyze_total", 0))
    coach_total = max(1, MEETING_METRICS.get("coach_total", 0))
    return jsonify({
        "status": "healthy",
        "version": cfg.APP_VERSION,
        "uptime_seconds": int((datetime.now() - _start_time).total_seconds()),
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "environment": cfg.ENVIRONMENT,
        "dependencies": {
            "ai_configured": bool(ai_payload.get("configured")),
            "local_ai_available": bool(is_local_available()),
        },
        "meeting_slo": {
            "analyze_failure_rate": MEETING_METRICS.get("analyze_failed", 0) / analyze_total,
            "coach_failure_rate": MEETING_METRICS.get("coach_failed", 0) / coach_total,
            "transcription_fallback_rate": MEETING_METRICS.get("fallback_transcription_used", 0) / analyze_total,
        },
    })



# NOTE: /version endpoint is now served by updates_bp (at /api/v1/version)
# which provides richer version info including buildDate.
