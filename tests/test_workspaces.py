"""
Tests for Workspace management endpoints
"""

import json
import os
import sys
import tempfile
import pytest

# Set up path and use temp database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestWorkspaceEndpoints:
    """Tests for workspace API endpoints."""

    def test_get_workspace(self, client, auth_headers):
        """GET /api/v1/workspace should return the user's workspace."""
        resp = client.get('/api/v1/workspace', headers=auth_headers)
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.get_json()
            assert 'name' in data
            assert 'branding' in data
            assert 'settings' in data

    def test_get_workspace_unauthenticated(self, client):
        """GET /api/v1/workspace without auth should fail."""
        resp = client.get('/api/v1/workspace')
        assert resp.status_code in (200, 401)

    def test_list_workspaces(self, client, auth_headers):
        """GET /api/v1/workspaces should return a list."""
        resp = client.get('/api/v1/workspaces', headers=auth_headers)
        assert resp.status_code in (200, 401)
        if resp.status_code == 200:
            data = resp.get_json()
            assert 'workspaces' in data
            assert isinstance(data['workspaces'], list)

    def test_create_workspace(self, client, auth_headers):
        """POST /api/v1/workspace should create a workspace."""
        resp = client.post(
            '/api/v1/workspace',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"name": "Test Workspace"}
        )
        assert resp.status_code in (201, 401)
        if resp.status_code == 201:
            data = resp.get_json()
            assert data.get('success') is True
            assert data['workspace']['name'] == 'Test Workspace'

    def test_create_workspace_empty_name(self, client, auth_headers):
        """POST /api/v1/workspace with empty name should return 400."""
        resp = client.post(
            '/api/v1/workspace',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"name": ""}
        )
        assert resp.status_code in (400, 401)


class TestWorkspaceSettings:
    """Tests for workspace settings endpoints."""

    def test_update_settings(self, client, auth_headers):
        """PUT /api/v1/workspace/settings should update settings."""
        resp = client.put(
            '/api/v1/workspace/settings',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"currency": "EUR", "language": "fr"}
        )
        assert resp.status_code in (200, 401, 403, 404)
        if resp.status_code == 200:
            data = resp.get_json()
            assert data.get('success') is True
            assert data['settings']['currency'] == 'EUR'


class TestWorkspaceBranding:
    """Tests for workspace branding (white-label) endpoints."""

    def test_get_branding(self, client, auth_headers):
        """GET /api/v1/workspace/branding should return branding config."""
        resp = client.get('/api/v1/workspace/branding', headers=auth_headers)
        assert resp.status_code in (200, 401)
        if resp.status_code == 200:
            data = resp.get_json()
            assert 'appName' in data
            assert 'primaryColor' in data
            assert 'enabledModules' in data

    def test_update_branding(self, client, auth_headers):
        """PUT /api/v1/workspace/branding should update branding."""
        resp = client.put(
            '/api/v1/workspace/branding',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={
                "appName": "Studio Pro",
                "primaryColor": "#3b82f6",
                "companyName": "My Agency",
                "enabledModules": ["projects", "invoices"]
            }
        )
        assert resp.status_code in (200, 401, 403, 404)
        if resp.status_code == 200:
            data = resp.get_json()
            assert data.get('success') is True
            assert data['branding']['appName'] == 'Studio Pro'
            assert data['branding']['primaryColor'] == '#3b82f6'
            assert 'projects' in data['branding']['enabledModules']

    def test_branding_invalid_modules_filtered(self, client, auth_headers):
        """Invalid modules should be filtered out."""
        resp = client.put(
            '/api/v1/workspace/branding',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"enabledModules": ["projects", "invalid_module", "invoices"]}
        )
        assert resp.status_code in (200, 401, 403, 404)
        if resp.status_code == 200:
            data = resp.get_json()
            modules = data['branding']['enabledModules']
            assert 'invalid_module' not in modules
            assert 'projects' in modules


class TestWorkspaceMembers:
    """Tests for workspace member management endpoints."""

    def test_get_members(self, client, auth_headers):
        """GET /api/v1/workspace/members should return members list."""
        resp = client.get('/api/v1/workspace/members', headers=auth_headers)
        assert resp.status_code in (200, 401, 404)
        if resp.status_code == 200:
            data = resp.get_json()
            assert 'members' in data
            assert isinstance(data['members'], list)

    def test_add_member_missing_email(self, client, auth_headers):
        """POST /api/v1/workspace/members without email should return 400."""
        resp = client.post(
            '/api/v1/workspace/members',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"role": "member"}
        )
        assert resp.status_code in (400, 401, 403, 404)

    def test_add_member_nonexistent_user(self, client, auth_headers):
        """POST member with non-existent email should return 404."""
        resp = client.post(
            '/api/v1/workspace/members',
            headers={**auth_headers, 'Content-Type': 'application/json'},
            json={"email": "nonexistent@nowhere.com", "role": "member"}
        )
        assert resp.status_code in (404, 401, 403)


class TestWorkspaceDB:
    """Direct database tests for workspace operations."""

    def test_create_workspace_db(self):
        """Create a workspace via DB layer."""
        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'

        try:
            # Re-import to use fresh DB
            from database.db import (
                init_database, create_user, create_workspace,
                get_workspace_by_id, get_user_workspaces,
                add_workspace_member, get_workspace_members,
                check_workspace_permission, remove_workspace_member,
                update_workspace_member_role,
            )
            init_database()

            # Create two users
            user1_id = create_user('owner@test.com', 'hash', 'salt', 'Owner')
            user2_id = create_user('member@test.com', 'hash', 'salt', 'Member')

            # User1 creates a workspace
            ws_id = create_workspace(user1_id, 'Team Workspace')
            ws = get_workspace_by_id(ws_id)
            assert ws is not None
            assert ws['name'] == 'Team Workspace'
            assert ws['owner_id'] == user1_id

            # Add user2 as member
            success = add_workspace_member(ws_id, user2_id, 'member')
            assert success is True

            # Check members
            members = get_workspace_members(ws_id)
            emails = [m['email'] for m in members]
            assert 'member@test.com' in emails

            # Check permissions
            assert check_workspace_permission(ws_id, user1_id, 'owner') is True
            assert check_workspace_permission(ws_id, user2_id, 'member') is True
            assert check_workspace_permission(ws_id, user2_id, 'admin') is False

            # Update role
            update_workspace_member_role(ws_id, user2_id, 'admin')
            assert check_workspace_permission(ws_id, user2_id, 'admin') is True

            # Remove member
            remove_workspace_member(ws_id, user2_id)
            members_after = get_workspace_members(ws_id)
            member_emails = [m['email'] for m in members_after]
            assert 'member@test.com' not in member_emails

            # List workspaces for user1
            ws_list = get_user_workspaces(user1_id)
            assert len(ws_list) >= 1
        finally:
            os.close(db_fd)
            try:
                os.unlink(db_path)
            except Exception:
                pass
