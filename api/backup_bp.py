"""
Backup Blueprint - Manual database backup endpoint
"""
from flask import Blueprint, jsonify
from database.db import backup_database
from api.shared import error_response

backup_bp = Blueprint('backup', __name__)


@backup_bp.route('/api/v1/backup', methods=['GET'])
def manual_backup():
    """Trigger a manual database backup."""
    try:
        path = backup_database()
        if path:
            return jsonify({"success": True, "message": "Sauvegarde créée.", "path": path})
        return jsonify({"error": "La sauvegarde a échoué."}), 500
    except Exception as e:
        return error_response(e, user_msg="Impossible de créer la sauvegarde.")
