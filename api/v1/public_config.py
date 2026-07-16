"""
Public (non-sensitive) configuration endpoint for API v1.

Exposes settings the frontend needs before/without knowing anything
sensitive — currently just the Cloudflare Tunnel public base URL so the
client portal can build a shareable HTTPS link.
"""

from flask import jsonify

from config import get_current_config
from . import api_v1

cfg = get_current_config()


@api_v1.route('/config/public')
def config_public():
    """Return non-sensitive configuration values for the frontend."""
    return jsonify({
        "publicBaseUrl": cfg.PUBLIC_BASE_URL,
    })
