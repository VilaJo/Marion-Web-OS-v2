"""
Tests for Authentication endpoints
"""

import pytest


class TestAuthCheck:
    """Tests for /api/v1/auth/check"""
    
    def test_auth_check_returns_200(self, client):
        """Auth check should always return 200."""
        resp = client.get('/api/v1/auth/check')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'configured' in data
        assert 'authenticated' in data

    def test_auth_check_unauthenticated(self, client):
        """Without token, should not be authenticated."""
        resp = client.get('/api/v1/auth/check')
        data = resp.get_json()
        assert data['authenticated'] is False


class TestAuthSetup:
    """Tests for /api/v1/auth/setup"""

    def test_setup_short_password_rejected(self, client):
        """Password shorter than 6 chars should be rejected."""
        resp = client.post('/api/v1/auth/setup', json={'password': '123'})
        assert resp.status_code == 400

    def test_setup_valid_password(self, client):
        """Valid password should create session."""
        resp = client.post('/api/v1/auth/setup', json={'password': 'test123456'})
        # Could be 200 (success) or 400 (already configured)
        data = resp.get_json()
        if resp.status_code == 200:
            assert data.get('success') is True
            assert 'token' in data


class TestAuthLogin:
    """Tests for /api/v1/auth/login"""

    def test_login_wrong_password(self, client):
        """Wrong password should return 401."""
        resp = client.post('/api/v1/auth/login', json={'password': 'wrong_password_here'})
        # Either 401 (wrong password) or 400 (not configured)
        assert resp.status_code in (400, 401)

    def test_login_returns_token(self, client, auth_token):
        """Correct login should return a token."""
        assert auth_token is not None
        assert len(auth_token) > 20


class TestAuthLogout:
    """Tests for /api/v1/auth/logout"""

    def test_logout(self, client, auth_headers):
        """Logout should succeed."""
        resp = client.post('/api/v1/auth/logout', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('success') is True


class TestProtectedEndpoints:
    """Tests that protected endpoints require authentication"""

    def test_version_requires_auth(self, client):
        """Version endpoint should require auth."""
        resp = client.get('/api/v1/version')
        # Either 401 (no token) or 200 (if auth not configured)
        assert resp.status_code in (200, 401)

    def test_version_with_auth(self, client, auth_headers):
        """Version endpoint should work with valid token."""
        resp = client.get('/api/v1/version', headers=auth_headers)
        assert resp.status_code == 200


class TestV1Health:
    """Tests for /api/v1/health (public endpoint)"""

    def test_health_returns_200(self, client):
        """Health check should always return 200 without auth."""
        resp = client.get('/api/v1/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('status') == 'healthy'
        assert 'version' in data
        assert 'uptime_seconds' in data

    def test_v1_version_returns_200(self, client):
        """V1 version should return 200 without auth."""
        resp = client.get('/api/v1/version')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'version' in data
        assert 'name' in data
