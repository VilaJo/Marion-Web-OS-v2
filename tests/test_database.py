"""
Tests for Database operations
"""

import os
import sys
import tempfile
import pytest

# Set up path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Use temp database for these tests
db_fd, db_path = tempfile.mkstemp(suffix='.db')
os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'

from database.db import (
    init_database, create_user, get_user_by_email, get_user_by_id,
    create_session, validate_session, delete_session, delete_expired_sessions,
    check_rate_limit, reset_rate_limit,
    get_user_workspace, update_workspace_settings, update_workspace_branding,
    save_oauth_token, get_oauth_token, delete_oauth_token,
)


@pytest.fixture(scope='module', autouse=True)
def setup_db():
    """Initialize the test database."""
    init_database()
    yield
    os.close(db_fd)
    try:
        os.unlink(db_path)
    except:
        pass


class TestUserOperations:
    """Tests for user CRUD."""

    def test_create_user(self):
        user_id = create_user('test@test.com', 'hash123', 'salt123', 'Test User')
        assert user_id > 0

    def test_get_user_by_email(self):
        user = get_user_by_email('test@test.com')
        assert user is not None
        assert user['email'] == 'test@test.com'
        assert user['display_name'] == 'Test User'

    def test_get_user_by_id(self):
        user = get_user_by_email('test@test.com')
        same_user = get_user_by_id(user['id'])
        assert same_user is not None
        assert same_user['email'] == 'test@test.com'

    def test_get_nonexistent_user(self):
        user = get_user_by_email('nobody@nowhere.com')
        assert user is None

    def test_create_user_creates_workspace(self):
        user = get_user_by_email('test@test.com')
        workspace = get_user_workspace(user['id'])
        assert workspace is not None
        assert workspace['owner_id'] == user['id']


class TestSessionOperations:
    """Tests for session management."""

    def test_create_session(self):
        user = get_user_by_email('test@test.com')
        token = create_session(user['id'], 'my_password', '127.0.0.1', 'TestAgent')
        assert token is not None
        assert len(token) > 20

    def test_validate_session(self):
        user = get_user_by_email('test@test.com')
        token = create_session(user['id'], 'my_password', '127.0.0.1', 'TestAgent')
        
        session = validate_session(token)
        assert session is not None
        assert session['user_id'] == user['id']
        assert session['password_for_encryption'] == 'my_password'

    def test_validate_invalid_session(self):
        session = validate_session('invalid_token_12345')
        assert session is None

    def test_delete_session(self):
        user = get_user_by_email('test@test.com')
        token = create_session(user['id'], 'pw')
        
        delete_session(token)
        session = validate_session(token)
        assert session is None

    def test_expired_session(self):
        user = get_user_by_email('test@test.com')
        token = create_session(user['id'], 'pw', duration_hours=0)  # Expires immediately
        
        session = validate_session(token)
        assert session is None


class TestRateLimiting:
    """Tests for rate limiting."""

    def test_rate_limit_allows_initial(self):
        result = check_rate_limit('10.0.0.1', 'test', max_attempts=3, window_seconds=60)
        assert result is True

    def test_rate_limit_blocks_after_max(self):
        ip = '10.0.0.2'
        for _ in range(5):
            check_rate_limit(ip, 'test2', max_attempts=3, window_seconds=60)
        
        result = check_rate_limit(ip, 'test2', max_attempts=3, window_seconds=60)
        assert result is False

    def test_rate_limit_reset(self):
        ip = '10.0.0.3'
        for _ in range(10):
            check_rate_limit(ip, 'test3', max_attempts=3, window_seconds=60)
        
        reset_rate_limit(ip, 'test3')
        result = check_rate_limit(ip, 'test3', max_attempts=3, window_seconds=60)
        assert result is True


class TestOAuthTokens:
    """Tests for OAuth token storage."""

    def test_save_and_get_token(self):
        user = get_user_by_email('test@test.com')
        save_oauth_token(
            user['id'], 'google', 'test@gmail.com',
            access_token='access_123', refresh_token='refresh_456'
        )
        
        token = get_oauth_token(user['id'], 'google')
        assert token is not None
        assert token['access_token'] == 'access_123'
        assert token['refresh_token'] == 'refresh_456'

    def test_update_token(self):
        user = get_user_by_email('test@test.com')
        save_oauth_token(
            user['id'], 'google', 'test@gmail.com',
            access_token='access_new'
        )
        
        token = get_oauth_token(user['id'], 'google')
        assert token['access_token'] == 'access_new'
        # refresh_token should be preserved
        assert token['refresh_token'] == 'refresh_456'

    def test_delete_token(self):
        user = get_user_by_email('test@test.com')
        delete_oauth_token(user['id'], 'google')
        
        token = get_oauth_token(user['id'], 'google')
        assert token is None


class TestWorkspaceOperations:
    """Tests for workspace management."""

    def test_update_settings(self):
        user = get_user_by_email('test@test.com')
        workspace = get_user_workspace(user['id'])
        
        update_workspace_settings(workspace['id'], {
            'currency': 'EUR',
            'language': 'fr'
        })
        
        updated = get_user_workspace(user['id'])
        import json
        settings = json.loads(updated['settings_json'])
        assert settings['currency'] == 'EUR'

    def test_update_branding(self):
        user = get_user_by_email('test@test.com')
        workspace = get_user_workspace(user['id'])
        
        update_workspace_branding(workspace['id'], {
            'appName': 'Custom App',
            'primaryColor': '#ff0000'
        })
        
        updated = get_user_workspace(user['id'])
        import json
        branding = json.loads(updated['branding_json'])
        assert branding['appName'] == 'Custom App'
