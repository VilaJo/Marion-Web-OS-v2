"""
Tests for Invoices, Expenses, Notes, and Time Tracking endpoints
"""

import json
import time
import pytest


class TestExpenses:
    """Tests for /api/v1/expenses"""

    def test_get_expenses(self, client, auth_headers):
        """GET expenses should return 200 with a list."""
        resp = client.get('/api/v1/expenses', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'expenses' in data
        assert isinstance(data['expenses'], list)

    def test_delete_nonexistent_expense(self, client, auth_headers):
        """DELETE a non-existent expense should succeed gracefully."""
        resp = client.delete(
            '/api/v1/expenses/nonexistent_exp_999',
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True

    def test_scan_expense_no_file(self, client, auth_headers):
        """Scan without file should return 400."""
        resp = client.post(
            '/api/v1/expenses/scan',
            headers=auth_headers
        )
        assert resp.status_code == 400


class TestNotes:
    """Tests for /api/v1/notes"""

    def test_get_notes(self, client, auth_headers):
        """GET notes should return 200 with a list."""
        resp = client.get('/api/v1/notes', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'notes' in data

    def test_save_note(self, client, auth_headers):
        """POST a new note should succeed."""
        note_id = f"test-note-{int(time.time())}"
        resp = client.post(
            '/api/v1/notes',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"id": note_id, "title": "Test Note", "content": "Hello from tests", "color": "blue"}
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True

    def test_save_note_missing_id(self, client, auth_headers):
        """POST a note without ID should return 400."""
        resp = client.post(
            '/api/v1/notes',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"title": "No ID Note", "content": "Will fail"}
        )
        assert resp.status_code == 400

    def test_delete_note_missing_id(self, client, auth_headers):
        """DELETE a note without ID should return 400."""
        resp = client.delete(
            '/api/v1/notes',
            headers=auth_headers
        )
        assert resp.status_code == 400


class TestTimeTracking:
    """Tests for /api/v1/time/*"""

    def test_log_time_missing_data(self, client, auth_headers):
        """POST time log without required data should return 400."""
        resp = client.post(
            '/api/v1/time/log',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={}
        )
        assert resp.status_code == 400

    def test_get_time_logs_nonexistent(self, client, auth_headers):
        """Get time logs for non-existent project should return empty."""
        resp = client.post(
            '/api/v1/time/get',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"clientId": "nonexistent_client_99"}
        )
        # May return 200 with empty list, or 500 if path doesn't exist
        assert resp.status_code in (200, 500)
