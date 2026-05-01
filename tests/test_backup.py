"""
Tests for the database backup functionality
"""

import os
import sys
import tempfile
import pytest
from pathlib import Path

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['FLASK_ENV'] = 'testing'
os.environ['ENV'] = 'testing'


def test_backup_database_creates_file():
    """Test that backup_database creates a backup file."""
    from database.db import backup_database, get_db_path, init_database

    # Make sure DB exists
    init_database()

    path = backup_database(max_backups=3)
    assert path is not None
    assert os.path.exists(path)
    assert 'marion_' in os.path.basename(path)

    # Cleanup
    try:
        os.unlink(path)
    except:
        pass


def test_backup_rotation():
    """Test that old backups are rotated out."""
    from database.db import backup_database, get_db_path, init_database
    import time

    init_database()

    backup_dir = get_db_path().parent / "backups"

    # Create 5 backups
    paths = []
    for i in range(5):
        p = backup_database(max_backups=3)
        if p:
            paths.append(p)
        time.sleep(0.1)  # Ensure different timestamps

    # Only 3 should remain
    remaining = list(backup_dir.glob("marion_*.db"))
    assert len(remaining) <= 3

    # Cleanup
    for f in backup_dir.glob("marion_*.db"):
        try:
            f.unlink()
        except:
            pass


def test_error_response_helper():
    """Test the error_response helper function."""
    os.environ['FLASK_ENV'] = 'testing'

    from flask import Flask
    app = Flask(__name__)

    with app.app_context():
        from api.shared import error_response

        # Test default error
        response, status = error_response(Exception("secret db error"))
        data = response.get_json()
        assert status == 500
        assert data["error"] == "Erreur interne du serveur."
        assert "secret" not in data["error"]

        # Test custom message
        response, status = error_response(
            ValueError("bad input"), 400, "Requête invalide."
        )
        data = response.get_json()
        assert status == 400
        assert data["error"] == "Requête invalide."


def test_validate_json_decorator():
    """Test the validate_json decorator."""
    from flask import Flask
    app = Flask(__name__)

    from api.shared import validate_json

    @app.route('/test', methods=['POST'])
    @validate_json({"required": ["name"], "types": {"name": str, "age": int}})
    def test_endpoint():
        from flask import jsonify, request
        return jsonify({"ok": True})

    with app.test_client() as client:
        # Missing required field
        resp = client.post('/test', json={"age": 25})
        assert resp.status_code == 400

        # Wrong type
        resp = client.post('/test', json={"name": 123})
        assert resp.status_code == 400

        # Valid
        resp = client.post('/test', json={"name": "test", "age": 25})
        assert resp.status_code == 200


class TestBackupHTTPApi:
    """Integration tests for /api/v1/backup* (requires app + auth)."""

    def test_backup_status_authenticated(self, client, auth_headers):
        resp = client.get('/api/v1/backup/status', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert 'backupCount' in data
        assert 'lastBackup' in data

    def test_manual_backup_authenticated(self, client, auth_headers):
        resp = client.get('/api/v1/backup', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        assert 'path' in data

    def test_bundle_download_authenticated(self, client, auth_headers):
        from database.db import init_database

        init_database()
        resp = client.get('/api/v1/backup/bundle', headers=auth_headers)
        assert resp.status_code == 200
        assert resp.mimetype == 'application/zip'
        assert len(resp.data) > 100
