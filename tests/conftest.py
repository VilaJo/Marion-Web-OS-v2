"""
Test fixtures for Marion Web OS
"""

import os
import sys
import tempfile
import pytest

# Set testing environment before any imports
os.environ['FLASK_ENV'] = 'testing'
os.environ['ENV'] = 'testing'

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope='session')
def app():
    """Create Flask test application."""
    # Use a temp database for tests
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'
    
    import franck_server
    app = franck_server.app
    app.config['TESTING'] = True
    
    yield app
    
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    """Create a test client."""
    with app.test_client() as client:
        yield client


@pytest.fixture
def auth_token(client, app):
    """Create an authenticated session and return the token."""
    import tempfile
    from pathlib import Path
    
    # Use a temp auth file for tests
    temp_auth = tempfile.mktemp(suffix='.json')
    
    # Override AUTH_FILE in all modules that reference it
    import franck_server
    import api.shared as shared_mod
    import api.auth_bp as auth_mod
    
    original_shared = shared_mod.AUTH_FILE
    original_auth = auth_mod.AUTH_FILE
    
    temp_path = Path(temp_auth)
    shared_mod.AUTH_FILE = temp_path
    auth_mod.AUTH_FILE = temp_path
    
    try:
        # Setup fresh auth
        resp = client.post('/api/v1/auth/setup', json={'password': 'test123456'})
        data = resp.get_json()
        token = data.get('token')
        
        if not token:
            # Try login if already configured
            resp = client.post('/api/v1/auth/login', json={'password': 'test123456'})
            data = resp.get_json()
            token = data.get('token')
        
        yield token
    finally:
        shared_mod.AUTH_FILE = original_shared
        auth_mod.AUTH_FILE = original_auth
        try:
            os.unlink(temp_auth)
        except:
            pass


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {'X-Marion-Token': auth_token or ''}
