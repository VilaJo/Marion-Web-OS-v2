"""
Tests for Calendar endpoints (iCal via AppleScript)

All AppleScript calls are mocked since tests run without macOS Calendar.
"""

import json
import pytest
from unittest.mock import patch, MagicMock


class TestCalendarFetch:
    """Tests for GET /api/v1/calendar/fetch"""

    @patch('api.calendar_bp.subprocess')
    def test_fetch_returns_events(self, mock_subprocess, client, auth_headers):
        """Fetch should parse AppleScript output into events."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = (
            "uid-001|||Reunion client|||2026-2-10|||14:30|||60|||Travail|||Discuter du projet"
            "@@@"
            "uid-002|||Focus coding|||2026-2-11|||9:0|||120|||Personnel|||"
        )
        mock_subprocess.run.return_value = mock_result

        resp = client.get('/api/v1/calendar/fetch', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'events' in data
        events = data['events']
        assert len(events) == 2
        assert events[0]['title'] == 'Reunion client'
        assert events[0]['date'] == '2026-02-10'
        assert events[0]['startTime'] == '14:30'
        assert events[0]['duration'] == 60
        assert events[0]['calendarName'] == 'Travail'
        assert events[1]['title'] == 'Focus coding'

    @patch('api.calendar_bp.subprocess')
    def test_fetch_empty_calendar(self, mock_subprocess, client, auth_headers):
        """Fetch with empty calendar returns empty list."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ''
        mock_subprocess.run.return_value = mock_result

        resp = client.get('/api/v1/calendar/fetch', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['events'] == []

    @patch('api.calendar_bp.subprocess')
    def test_fetch_applescript_error(self, mock_subprocess, client, auth_headers):
        """Fetch should handle AppleScript errors gracefully."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = 'Calendar not accessible'
        mock_result.stdout = ''
        mock_subprocess.run.return_value = mock_result

        resp = client.get('/api/v1/calendar/fetch', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'events' in data


class TestCalendarSync:
    """Tests for POST /api/v1/calendar/sync (create event)"""

    @patch('api.calendar_bp.subprocess')
    def test_create_event(self, mock_subprocess, client, auth_headers):
        """Create event should call AppleScript and return success."""
        mock_subprocess.run.return_value = MagicMock(returncode=0)

        resp = client.post(
            '/api/v1/calendar/sync',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={
                'title': 'Test Event',
                'startDate': '2026-03-15',
                'startTime': '10:00',
                'duration': 1.5,
            }
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True
        mock_subprocess.run.assert_called_once()

    @patch('api.calendar_bp.subprocess')
    def test_create_event_applescript_failure(self, mock_subprocess, client, auth_headers):
        """Create event should handle AppleScript failure."""
        mock_subprocess.run.side_effect = Exception("osascript not found")

        resp = client.post(
            '/api/v1/calendar/sync',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={
                'title': 'Failing Event',
                'startDate': '2026-03-15',
                'startTime': '10:00',
                'duration': 1,
            }
        )
        assert resp.status_code == 500


class TestCalendarUpdate:
    """Tests for POST /api/v1/calendar/update"""

    @patch('api.calendar_bp.subprocess')
    def test_update_event(self, mock_subprocess, client, auth_headers):
        """Update event should call AppleScript with correct parameters."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'OK'
        mock_subprocess.run.return_value = mock_result

        resp = client.post(
            '/api/v1/calendar/update',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={
                'id': 'uid-001',
                'calendarName': 'Travail',
                'title': 'Updated Meeting',
                'date': '2026-03-20',
                'startTime': '15:00',
                'duration': 90,
            }
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True

    def test_update_event_missing_id(self, client, auth_headers):
        """Update without id should return 400."""
        resp = client.post(
            '/api/v1/calendar/update',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={'title': 'No ID', 'date': '2026-03-20', 'startTime': '10:00'}
        )
        assert resp.status_code == 400


class TestCalendarDelete:
    """Tests for POST /api/v1/calendar/delete"""

    @patch('api.calendar_bp.subprocess')
    def test_delete_event(self, mock_subprocess, client, auth_headers):
        """Delete event should call AppleScript and return success."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'OK'
        mock_subprocess.run.return_value = mock_result

        resp = client.post(
            '/api/v1/calendar/delete',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={'id': 'uid-001', 'calendarName': 'Travail'}
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True

    def test_delete_event_missing_id(self, client, auth_headers):
        """Delete without event id should return 400."""
        resp = client.post(
            '/api/v1/calendar/delete',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={}
        )
        assert resp.status_code == 400

    @patch('api.calendar_bp.subprocess')
    def test_delete_event_not_found(self, mock_subprocess, client, auth_headers):
        """Delete non-existent event should return error."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'ERROR:Event not found'
        mock_subprocess.run.return_value = mock_result

        resp = client.post(
            '/api/v1/calendar/delete',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={'id': 'nonexistent-uid'}
        )
        assert resp.status_code == 500
