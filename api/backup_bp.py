"""
Backup Blueprint - Manual database backup and status endpoints
"""
import os
from datetime import datetime
from pathlib import Path
from flask import Blueprint, jsonify

from services.logger import get_logger
from database.db import backup_database, get_db_path
from api.shared import error_response

logger = get_logger('api.backup')

backup_bp = Blueprint('backup', __name__)


@backup_bp.route('/api/v1/backup', methods=['GET'])
def manual_backup():
    """Trigger a manual database backup."""
    try:
        path = backup_database(max_backups=10)
        if path:
            return jsonify({"success": True, "message": "Sauvegarde créée.", "path": path})
        return jsonify({"error": "La sauvegarde a échoué."}), 500
    except Exception as e:
        return error_response(e, user_msg="Impossible de créer la sauvegarde.")


@backup_bp.route('/api/v1/backup/status', methods=['GET'])
def backup_status():
    """
    Return backup status information:
    - lastBackup: timestamp of the most recent backup
    - backupCount: number of available backups
    - totalSize: total size of all backups in bytes
    - nextBackupIn: seconds until next scheduled backup (approximate)
    """
    try:
        db_path = get_db_path()
        backup_dir = db_path.parent / "backups"

        backups = []
        total_size = 0
        if backup_dir.exists():
            for f in sorted(backup_dir.glob("marion_*.db"), key=lambda p: p.stat().st_mtime, reverse=True):
                stat = f.stat()
                total_size += stat.st_size
                backups.append({
                    "name": f.name,
                    "date": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size": stat.st_size,
                })

        last_backup = backups[0]["date"] if backups else None

        # Approximate next backup time
        backup_interval = int(os.getenv('BACKUP_INTERVAL_HOURS', '6')) * 3600
        next_backup_in = backup_interval  # Default
        if backups:
            last_ts = datetime.fromisoformat(backups[0]["date"])
            elapsed = (datetime.now() - last_ts).total_seconds()
            next_backup_in = max(0, backup_interval - elapsed)

        return jsonify({
            "success": True,
            "lastBackup": last_backup,
            "backupCount": len(backups),
            "totalSizeBytes": total_size,
            "totalSizeMB": round(total_size / (1024 * 1024), 2),
            "nextBackupInSeconds": int(next_backup_in),
            "nextBackupInHours": round(next_backup_in / 3600, 1),
            "backups": backups[:10],  # Last 10 backups
        })
    except Exception as e:
        return error_response(e, user_msg="Impossible de récupérer le statut des sauvegardes.")
