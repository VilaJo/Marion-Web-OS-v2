"""
Backup Blueprint - Local and cloud database backup endpoints.
Handles: manual backup, backup status, cloud backup to Google Drive.
"""
import os
import json
import requests
from datetime import datetime
from pathlib import Path
import io
import zipfile
from flask import Blueprint, jsonify, request, send_file

from services.logger import get_logger
from database.db import backup_database, get_db_path
from api.shared import error_response

logger = get_logger('api.backup')

backup_bp = Blueprint('backup', __name__)

# ---------------------------------------------------------------------------
# Cloud backup settings persistence
# ---------------------------------------------------------------------------
_SETTINGS_FILE_NAME = '.marion_settings.json'


def _get_settings_path() -> Path:
    """Return the path to the shared settings file in DATA_PATH."""
    db_path = get_db_path()
    return db_path.parent / _SETTINGS_FILE_NAME


def _load_settings() -> dict:
    """Load settings from the JSON file."""
    path = _get_settings_path()
    if path.exists():
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_settings(settings: dict):
    """Save settings to the JSON file."""
    path = _get_settings_path()
    try:
        with open(path, 'w') as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        logger.error("Could not save settings: %s", e)


def is_cloud_backup_enabled() -> bool:
    """Check if cloud backup is enabled in settings."""
    settings = _load_settings()
    return settings.get('cloud_backup_enabled', False)


# ---------------------------------------------------------------------------
# Google Drive upload helper
# ---------------------------------------------------------------------------
DRIVE_BACKUP_FOLDER_NAME = 'Marion Backups'
DRIVE_MAX_CLOUD_BACKUPS = 5


def upload_backup_to_drive(backup_path: str) -> dict | None:
    """
    Upload a local backup file to Google Drive.
    
    - Finds or creates a "Marion Backups" folder
    - Uploads the .db file
    - Rotates old backups (keeps DRIVE_MAX_CLOUD_BACKUPS)
    
    Returns dict with file metadata on success, None on failure/skip.
    """
    from services.oauth_service import get_valid_token, get_first_email

    email = get_first_email()
    if not email:
        logger.debug("Cloud backup skipped — no Google account connected")
        return None

    access_token = get_valid_token(email)
    if not access_token:
        logger.warning("Cloud backup skipped — OAuth token expired or unavailable")
        return None

    headers = {"Authorization": f"Bearer {access_token}"}
    local_path = Path(backup_path)
    if not local_path.exists():
        logger.warning("Cloud backup skipped — local file not found: %s", backup_path)
        return None

    try:
        # ── Step 1: Find or create "Marion Backups" folder ──────────────
        folder_id = _find_or_create_drive_folder(headers)
        if not folder_id:
            logger.error("Cloud backup failed — could not find/create Drive folder")
            return None

        # ── Step 2: Upload the backup file ──────────────────────────────
        file_metadata = {
            "name": local_path.name,
            "parents": [folder_id],
        }

        with open(local_path, 'rb') as f:
            files = {
                'metadata': ('metadata', json.dumps(file_metadata), 'application/json'),
                'file': (local_path.name, f, 'application/x-sqlite3'),
            }
            resp = requests.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,createdTime",
                headers=headers,
                files=files,
                timeout=120,
            )

        if resp.status_code not in (200, 201):
            logger.error("Cloud backup upload failed: %s %s", resp.status_code, resp.text[:300])
            return None

        result = resp.json()
        logger.info("Cloud backup uploaded: %s (id=%s)", result.get('name'), result.get('id'))

        # ── Step 3: Rotate old backups on Drive ─────────────────────────
        _rotate_drive_backups(headers, folder_id)

        # ── Step 4: Save last cloud backup timestamp ────────────────────
        settings = _load_settings()
        settings['last_cloud_backup'] = datetime.now().isoformat()
        settings['last_cloud_backup_id'] = result.get('id')
        settings['last_cloud_backup_link'] = result.get('webViewLink')
        _save_settings(settings)

        return result

    except Exception as e:
        logger.error("Cloud backup error: %s", e, exc_info=True)
        return None


def _find_or_create_drive_folder(headers: dict) -> str | None:
    """Find the Marion Backups folder on Drive, or create it."""
    try:
        # Search for existing folder
        query = f"name='{DRIVE_BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        resp = requests.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={"q": query, "fields": "files(id,name)", "spaces": "drive"},
            timeout=30,
        )
        if resp.status_code == 200:
            files = resp.json().get('files', [])
            if files:
                return files[0]['id']

        # Create the folder
        folder_metadata = {
            "name": DRIVE_BACKUP_FOLDER_NAME,
            "mimeType": "application/vnd.google-apps.folder",
        }
        resp = requests.post(
            "https://www.googleapis.com/drive/v3/files",
            headers={**headers, "Content-Type": "application/json"},
            json=folder_metadata,
            timeout=30,
        )
        if resp.status_code in (200, 201):
            folder_id = resp.json().get('id')
            logger.info("Created Drive folder '%s' (id=%s)", DRIVE_BACKUP_FOLDER_NAME, folder_id)
            return folder_id

        logger.error("Failed to create Drive folder: %s", resp.text[:300])
        return None

    except Exception as e:
        logger.error("Drive folder lookup error: %s", e, exc_info=True)
        return None


def _rotate_drive_backups(headers: dict, folder_id: str):
    """Keep only the N most recent backups in the Drive folder."""
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        resp = requests.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={
                "q": query,
                "fields": "files(id,name,createdTime,size)",
                "orderBy": "createdTime desc",
                "pageSize": 50,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return

        files = resp.json().get('files', [])
        if len(files) <= DRIVE_MAX_CLOUD_BACKUPS:
            return

        # Delete oldest files beyond the limit
        to_delete = files[DRIVE_MAX_CLOUD_BACKUPS:]
        for f in to_delete:
            try:
                del_resp = requests.delete(
                    f"https://www.googleapis.com/drive/v3/files/{f['id']}",
                    headers=headers,
                    timeout=15,
                )
                if del_resp.status_code in (200, 204):
                    logger.info("Rotated cloud backup: %s", f.get('name'))
            except Exception:
                pass

    except Exception as e:
        logger.warning("Cloud backup rotation error: %s", e)


def _list_drive_backups(headers: dict) -> list:
    """List backups in the Marion Backups folder on Drive."""
    try:
        # First find the folder
        query = f"name='{DRIVE_BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        resp = requests.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={"q": query, "fields": "files(id)", "spaces": "drive"},
            timeout=15,
        )
        if resp.status_code != 200:
            return []

        folders = resp.json().get('files', [])
        if not folders:
            return []

        folder_id = folders[0]['id']

        # List files in folder
        query = f"'{folder_id}' in parents and trashed=false"
        resp = requests.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={
                "q": query,
                "fields": "files(id,name,createdTime,size,webViewLink)",
                "orderBy": "createdTime desc",
                "pageSize": 10,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            return []

        return resp.json().get('files', [])
    except Exception as e:
        logger.warning("Could not list cloud backups: %s", e)
        return []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

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


@backup_bp.route('/api/v1/backup/cloud', methods=['POST'])
def cloud_backup():
    """Create a local backup and upload it to Google Drive."""
    try:
        # Step 1: Local backup
        path = backup_database(max_backups=10)
        if not path:
            return jsonify({"error": "La sauvegarde locale a échoué."}), 500

        # Step 2: Upload to Drive
        result = upload_backup_to_drive(path)
        if result:
            return jsonify({
                "success": True,
                "message": "Sauvegarde uploadée sur Google Drive.",
                "localPath": path,
                "driveFileId": result.get('id'),
                "driveFileName": result.get('name'),
                "driveLink": result.get('webViewLink'),
            })
        else:
            return jsonify({
                "success": False,
                "error": "Sauvegarde locale réussie mais l'upload Drive a échoué. Vérifiez la connexion Google.",
                "localPath": path,
            }), 502
    except Exception as e:
        return error_response(e, user_msg="Impossible de créer la sauvegarde cloud.")


@backup_bp.route('/api/v1/backup/cloud/config', methods=['GET'])
def get_cloud_config():
    """Get cloud backup configuration."""
    settings = _load_settings()
    return jsonify({
        "success": True,
        "cloudBackupEnabled": settings.get('cloud_backup_enabled', False),
        "lastCloudBackup": settings.get('last_cloud_backup'),
        "lastCloudBackupLink": settings.get('last_cloud_backup_link'),
    })


@backup_bp.route('/api/v1/backup/cloud/config', methods=['POST'])
def set_cloud_config():
    """Update cloud backup configuration."""
    data = request.json or {}
    settings = _load_settings()

    if 'cloudBackupEnabled' in data:
        settings['cloud_backup_enabled'] = bool(data['cloudBackupEnabled'])
        logger.info("Cloud backup %s", 'enabled' if settings['cloud_backup_enabled'] else 'disabled')

    _save_settings(settings)

    return jsonify({
        "success": True,
        "cloudBackupEnabled": settings.get('cloud_backup_enabled', False),
    })


@backup_bp.route('/api/v1/backup/status', methods=['GET'])
def backup_status():
    """
    Return backup status information (local + cloud).
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
        next_backup_in = backup_interval
        if backups:
            last_ts = datetime.fromisoformat(backups[0]["date"])
            elapsed = (datetime.now() - last_ts).total_seconds()
            next_backup_in = max(0, backup_interval - elapsed)

        # Cloud backup info
        settings = _load_settings()
        cloud_enabled = settings.get('cloud_backup_enabled', False)
        last_cloud_backup = settings.get('last_cloud_backup')
        last_cloud_link = settings.get('last_cloud_backup_link')

        # Try to list cloud backups if Google is connected
        cloud_backups = []
        try:
            from services.oauth_service import get_valid_token, get_first_email
            email = get_first_email()
            if email:
                access_token = get_valid_token(email)
                if access_token:
                    headers = {"Authorization": f"Bearer {access_token}"}
                    cloud_backups = _list_drive_backups(headers)
        except Exception:
            pass  # Non-critical

        return jsonify({
            "success": True,
            "lastBackup": last_backup,
            "backupCount": len(backups),
            "totalSizeBytes": total_size,
            "totalSizeMB": round(total_size / (1024 * 1024), 2),
            "nextBackupInSeconds": int(next_backup_in),
            "nextBackupInHours": round(next_backup_in / 3600, 1),
            "backups": backups[:10],
            # Cloud info
            "cloudEnabled": cloud_enabled,
            "lastCloudBackup": last_cloud_backup,
            "lastCloudBackupLink": last_cloud_link,
            "cloudBackups": [{
                "id": f.get('id'),
                "name": f.get('name'),
                "date": f.get('createdTime'),
                "size": int(f.get('size', 0)),
                "link": f.get('webViewLink'),
            } for f in cloud_backups],
        })
    except Exception as e:
        return error_response(e, user_msg="Impossible de récupérer le statut des sauvegardes.")


@backup_bp.route('/api/v1/backup/bundle', methods=['GET'])
def download_backup_bundle():
    """
    Zip the SQLite database plus a small manifest JSON for off-site archiving.
    Uses the same snapshot logic as manual backup (works with :memory: and file DBs).
    Does not include project files on disk — only marion.db + manifest.
    """
    try:
        snap_path = backup_database(max_backups=10)
        if not snap_path:
            return jsonify({"error": "Impossible de créer une copie de la base."}), 500

        db_path = get_db_path()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(Path(snap_path), arcname="marion.db")
            manifest = {
                "exportedAt": datetime.now().isoformat(),
                "app": "Marion Web OS",
                "databaseFile": "marion.db",
                "dbPathHint": str(db_path),
                "snapshotSource": snap_path,
            }
            zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        buf.seek(0)
        fname = f"marion_bundle_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        return send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name=fname,
        )
    except Exception as e:
        return error_response(e, user_msg="Impossible de créer l'archive.")
