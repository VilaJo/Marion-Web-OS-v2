"""
Workspace management endpoints for API v1
Handles multi-workspace support, members, branding, settings
"""

import json
from flask import request, jsonify

from database.db import (
    get_user_workspace, get_user_workspaces, get_workspace_by_id,
    create_workspace, update_workspace, delete_workspace,
    update_workspace_settings, update_workspace_branding,
    add_workspace_member, remove_workspace_member, update_workspace_member_role,
    get_workspace_members, check_workspace_permission,
    get_user_by_email,
)
from . import api_v1
from api.shared import error_response


# ============================================================================
# HELPERS
# ============================================================================

def _get_current_user_id():
    """Extract user_id from session token."""
    from database.db import validate_session as db_validate_session

    token = request.headers.get('X-Marion-Token')
    if not token:
        return None

    session_data = db_validate_session(token)
    if not session_data:
        return None

    return session_data.get('user_id')


def _parse_workspace_json(workspace: dict) -> dict:
    """Parse JSON fields in a workspace row."""
    if workspace.get('settings_json'):
        try:
            workspace['settings'] = json.loads(workspace['settings_json'])
        except (json.JSONDecodeError, TypeError):
            workspace['settings'] = {}
    else:
        workspace['settings'] = {}

    if workspace.get('branding_json'):
        try:
            workspace['branding'] = json.loads(workspace['branding_json'])
        except (json.JSONDecodeError, TypeError):
            workspace['branding'] = {}
    else:
        workspace['branding'] = {}

    return workspace


# Default branding values
DEFAULT_BRANDING = {
    'appName': 'Marion Web OS',
    'primaryColor': '#f97316',
    'logoUrl': '',
    'faviconUrl': '',
    'companyName': '',
    'tagline': '',
    'footerText': '',
    'enabledModules': ['projects', 'invoices', 'calendar', 'notes', 'expenses', 'ai', 'email', 'time_tracking'],
    'language': 'fr',
}


# ============================================================================
# WORKSPACE CRUD
# ============================================================================

@api_v1.route('/workspaces')
def list_workspaces():
    """List all workspaces the current user has access to."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspaces = get_user_workspaces(user_id)
    return jsonify({"workspaces": [_parse_workspace_json(w) for w in workspaces]})


@api_v1.route('/workspace')
def get_workspace():
    """Get the current user's primary workspace."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    workspace = _parse_workspace_json(workspace)

    # Fill in default branding for missing keys
    branding = {**DEFAULT_BRANDING, **workspace.get('branding', {})}
    workspace['branding'] = branding

    return jsonify(workspace)


@api_v1.route('/workspace', methods=['POST'])
def create_workspace_endpoint():
    """Create a new workspace."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({"error": "Le nom du workspace est requis"}), 400

    workspace_id = create_workspace(
        owner_id=user_id,
        name=name,
        settings=data.get('settings', {}),
        branding=data.get('branding', {}),
    )

    workspace = get_workspace_by_id(workspace_id)
    return jsonify({"success": True, "workspace": _parse_workspace_json(workspace)}), 201


@api_v1.route('/workspace/<int:workspace_id>', methods=['PUT'])
def update_workspace_endpoint(workspace_id):
    """Update a workspace (name)."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    if not check_workspace_permission(workspace_id, user_id, 'admin'):
        return jsonify({"error": "Permission refusee"}), 403

    data = request.get_json()
    update_workspace(workspace_id, data)

    workspace = get_workspace_by_id(workspace_id)
    return jsonify({"success": True, "workspace": _parse_workspace_json(workspace)})


@api_v1.route('/workspace/<int:workspace_id>', methods=['DELETE'])
def delete_workspace_endpoint(workspace_id):
    """Delete a workspace (owner only)."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_workspace_by_id(workspace_id)
    if not workspace:
        return jsonify({"error": "Workspace introuvable"}), 404
    if workspace['owner_id'] != user_id:
        return jsonify({"error": "Seul le proprietaire peut supprimer le workspace"}), 403

    # Prevent deleting the only workspace
    all_ws = get_user_workspaces(user_id)
    if len(all_ws) <= 1:
        return jsonify({"error": "Impossible de supprimer le dernier workspace"}), 400

    delete_workspace(workspace_id)
    return jsonify({"success": True})


# ============================================================================
# WORKSPACE SETTINGS
# ============================================================================

@api_v1.route('/workspace/settings', methods=['PUT'])
def update_settings():
    """Update workspace settings."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    if not check_workspace_permission(workspace['id'], user_id, 'admin'):
        return jsonify({"error": "Permission refusee"}), 403

    data = request.get_json()

    # Merge with existing settings
    current_settings = json.loads(workspace.get('settings_json') or '{}')
    current_settings.update(data)

    update_workspace_settings(workspace['id'], current_settings)

    return jsonify({"success": True, "settings": current_settings})


# ============================================================================
# WORKSPACE BRANDING (White-label)
# ============================================================================

@api_v1.route('/workspace/branding', methods=['PUT'])
def update_branding():
    """Update workspace branding (for white-label support)."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    if not check_workspace_permission(workspace['id'], user_id, 'admin'):
        return jsonify({"error": "Permission refusee"}), 403

    data = request.get_json()

    # Merge with existing branding (keep defaults for missing keys)
    current_branding = json.loads(workspace.get('branding_json') or '{}')
    merged = {**DEFAULT_BRANDING, **current_branding, **data}

    # Validate enabledModules if provided
    valid_modules = {'projects', 'invoices', 'calendar', 'notes', 'expenses', 'ai', 'email', 'time_tracking', 'goals', 'documents', 'media'}
    if 'enabledModules' in merged:
        merged['enabledModules'] = [m for m in merged['enabledModules'] if m in valid_modules]

    update_workspace_branding(workspace['id'], merged)

    return jsonify({"success": True, "branding": merged})


@api_v1.route('/workspace/branding')
def get_branding():
    """Get workspace branding (public-ish, requires auth)."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify(DEFAULT_BRANDING)

    current_branding = json.loads(workspace.get('branding_json') or '{}')
    branding = {**DEFAULT_BRANDING, **current_branding}

    return jsonify(branding)


# ============================================================================
# WORKSPACE MEMBERS
# ============================================================================

@api_v1.route('/workspace/members')
def get_members():
    """Get workspace members."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    members = get_workspace_members(workspace['id'])
    return jsonify({"members": members})


@api_v1.route('/workspace/members', methods=['POST'])
def add_member():
    """Add a member to the workspace by email."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    if not check_workspace_permission(workspace['id'], user_id, 'admin'):
        return jsonify({"error": "Permission refusee"}), 403

    data = request.get_json()
    email = data.get('email', '').strip()
    role = data.get('role', 'member')

    if not email:
        return jsonify({"error": "Email requis"}), 400

    target_user = get_user_by_email(email)
    if not target_user:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    success = add_workspace_member(workspace['id'], target_user['id'], role)
    if not success:
        return jsonify({"error": "L'utilisateur est deja membre du workspace"}), 409

    return jsonify({"success": True}), 201


@api_v1.route('/workspace/members/<int:member_id>', methods=['PUT'])
def update_member(member_id):
    """Update a member's role."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    if not check_workspace_permission(workspace['id'], user_id, 'admin'):
        return jsonify({"error": "Permission refusee"}), 403

    data = request.get_json()
    new_role = data.get('role')

    if not new_role:
        return jsonify({"error": "Role requis"}), 400

    try:
        update_workspace_member_role(workspace['id'], member_id, new_role)
    except ValueError as e:
        return error_response(e, 400, "Requête invalide.")

    return jsonify({"success": True})


@api_v1.route('/workspace/members/<int:member_id>', methods=['DELETE'])
def remove_member(member_id):
    """Remove a member from the workspace."""
    user_id = _get_current_user_id()
    if not user_id:
        return jsonify({"error": "Non authentifie"}), 401

    workspace = get_user_workspace(user_id)
    if not workspace:
        return jsonify({"error": "Aucun workspace"}), 404

    # Only owner/admin can remove; or user can remove themselves
    if member_id != user_id and not check_workspace_permission(workspace['id'], user_id, 'admin'):
        return jsonify({"error": "Permission refusee"}), 403

    # Cannot remove the owner
    if member_id == workspace['owner_id']:
        return jsonify({"error": "Impossible de retirer le proprietaire du workspace"}), 400

    remove_workspace_member(workspace['id'], member_id)
    return jsonify({"success": True})
