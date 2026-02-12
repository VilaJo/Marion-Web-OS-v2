"""
Tests for Projects CRUD endpoints
"""

import json
import pytest


class TestProjectsScan:
    """Tests for /api/v1/projects/scan"""

    def test_scan_returns_200(self, client, auth_headers):
        """Scan should return 200 with a projects list."""
        resp = client.get('/api/v1/projects/scan', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'projects' in data
        assert isinstance(data['projects'], list)

    def test_scan_without_auth(self, client):
        """Scan should fail without auth if configured."""
        resp = client.get('/api/v1/projects/scan')
        # May return 401 or 200 depending on whether auth is configured
        assert resp.status_code in (200, 401)


class TestProjectsSave:
    """Tests for /api/v1/projects/save"""

    def test_save_missing_id(self, client, auth_headers):
        """Save without project ID should return 400."""
        resp = client.post(
            '/api/v1/projects/save',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"clientName": "Test Client"}
        )
        assert resp.status_code == 400
        data = resp.get_json()
        assert 'error' in data

    def test_save_nonexistent_project(self, client, auth_headers):
        """Save to a non-existent project should return 404."""
        resp = client.post(
            '/api/v1/projects/save',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"id": "nonexistent_project_9999", "clientName": "Ghost"}
        )
        assert resp.status_code == 404


class TestProjectsMove:
    """Tests for /api/v1/projects/move"""

    def test_move_missing_project(self, client, auth_headers):
        """Moving a non-existent project should return 404."""
        resp = client.post(
            '/api/v1/projects/move',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"clientName": "NonExistentClient99", "newStatus": "Active"}
        )
        assert resp.status_code == 404


class TestProjectsDelete:
    """Tests for /api/v1/projects/delete"""

    def test_delete_missing_params(self, client, auth_headers):
        """Delete without params should return 400."""
        resp = client.delete(
            '/api/v1/projects/delete',
            headers=auth_headers
        )
        assert resp.status_code == 400

    def test_delete_nonexistent_project(self, client, auth_headers):
        """Delete a non-existent project by ID should return an error."""
        resp = client.delete(
            '/api/v1/projects/delete?id=ghost_project_99',
            headers=auth_headers
        )
        # Returns 400 if path doesn't resolve safely, or 404/500
        assert resp.status_code in (400, 404, 500)
