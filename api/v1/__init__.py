"""
API v1 - Marion Web OS API version 1
All new routes should be added here.
Legacy routes in franck_server.py will gradually migrate to v1.
"""

from flask import Blueprint

api_v1 = Blueprint('api_v1', __name__, url_prefix='/api/v1')

# Import route modules to register them with the blueprint
from . import health
from . import workspaces


def init_v1(app):
    """Register the v1 API blueprint with the Flask app."""
    app.register_blueprint(api_v1)
