"""
Eonora Tech OS - Database Access Layer
SQLite database with connection pooling and helper methods
"""

import sqlite3
import json
import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Dict, List, Any, Tuple
import threading

from config import get_current_config
from services.logger import get_logger

logger = get_logger('database')

# Thread-local storage for connections
_local = threading.local()


def _register_sqlite_datetime_handlers() -> None:
    """Register explicit datetime handlers to avoid deprecated sqlite defaults."""
    sqlite3.register_adapter(datetime, lambda value: value.isoformat(sep=' ', timespec='seconds'))
    sqlite3.register_converter('timestamp', lambda raw: datetime.fromisoformat(raw.decode('utf-8')))
    sqlite3.register_converter('datetime', lambda raw: datetime.fromisoformat(raw.decode('utf-8')))


_register_sqlite_datetime_handlers()


def get_db_path() -> Path:
    """Get the database file path from the centralised Config."""
    cfg = get_current_config()
    db_path = cfg.get_db_path()
    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection() -> sqlite3.Connection:
    """Get a thread-local database connection"""
    if not hasattr(_local, 'connection') or _local.connection is None:
        db_path = get_db_path()
        _local.connection = sqlite3.connect(
            str(db_path),
            check_same_thread=False,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
        )
        _local.connection.row_factory = sqlite3.Row
        # Enable foreign keys
        _local.connection.execute("PRAGMA foreign_keys = ON")
    return _local.connection


@contextmanager
def get_db():
    """Context manager for database operations"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


def init_database():
    """Initialize the database schema"""
    schema_path = Path(__file__).parent / 'schema.sql'
    
    with get_db() as conn:
        with open(schema_path, 'r') as f:
            conn.executescript(f.read())
    
    logger.info("Database initialized at: %s", get_db_path())


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a sqlite3.Row to a dictionary"""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    """Convert multiple rows to a list of dictionaries"""
    return [row_to_dict(row) for row in rows]


# =============================================================================
# USER OPERATIONS
# =============================================================================

def create_user(email: str, password_hash: str, password_salt: str, display_name: str = None) -> int:
    """Create a new user and return their ID"""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO users (email, password_hash, password_salt, display_name)
               VALUES (?, ?, ?, ?)""",
            (email, password_hash, password_salt, display_name)
        )
        user_id = cursor.lastrowid
        
        # Create default workspace for the user
        conn.execute(
            """INSERT INTO workspaces (name, owner_id) VALUES (?, ?)""",
            (display_name or 'Mon Espace', user_id)
        )
        
        return user_id


def get_user_by_email(email: str) -> Optional[Dict]:
    """Get a user by email"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        return row_to_dict(row)


def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Get a user by ID"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return row_to_dict(row)


def update_user_last_login(user_id: int):
    """Update user's last login timestamp"""
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            (user_id,)
        )


# =============================================================================
# SESSION OPERATIONS
# =============================================================================

def create_session(user_id: int, password_for_encryption: str = None, 
                   ip_address: str = None, user_agent: str = None,
                   duration_hours: int = 8) -> str:
    """Create a new session and return the token"""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=duration_hours)
    
    with get_db() as conn:
        conn.execute(
            """INSERT INTO sessions (token, user_id, password_for_encryption, expires_at, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (token, user_id, password_for_encryption, expires_at, ip_address, user_agent)
        )
    
    return token


def get_session(token: str) -> Optional[Dict]:
    """Get a session by token"""
    with get_db() as conn:
        row = conn.execute(
            """SELECT s.*, u.email, u.display_name 
               FROM sessions s 
               JOIN users u ON s.user_id = u.id 
               WHERE s.token = ?""",
            (token,)
        ).fetchone()
        return row_to_dict(row)


def validate_session(token: str) -> Optional[Dict]:
    """Validate a session and return session data if valid"""
    session = get_session(token)
    if not session:
        return None
    
    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    
    if expires_at < datetime.now():
        delete_session(token)
        return None
    
    return session


def delete_session(token: str):
    """Delete a session"""
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def delete_expired_sessions():
    """Clean up expired sessions"""
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP")


def delete_user_sessions(user_id: int):
    """Delete all sessions for a user"""
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


# =============================================================================
# OAUTH TOKEN OPERATIONS
# =============================================================================

def save_oauth_token(user_id: int, provider: str, email: str, 
                     access_token: str, refresh_token: str = None,
                     expires_in: int = None, scope: str = None) -> int:
    """Save or update OAuth tokens"""
    with get_db() as conn:
        # Try to update first
        cursor = conn.execute(
            """UPDATE oauth_tokens 
               SET access_token = ?, refresh_token = COALESCE(?, refresh_token), 
                   expires_in = ?, scope = ?, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND provider = ? AND email = ?""",
            (access_token, refresh_token, expires_in, scope, user_id, provider, email)
        )
        
        if cursor.rowcount == 0:
            # Insert new
            cursor = conn.execute(
                """INSERT INTO oauth_tokens (user_id, provider, email, access_token, refresh_token, expires_in, scope)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, provider, email, access_token, refresh_token, expires_in, scope)
            )
        
        return cursor.lastrowid


def get_oauth_token(user_id: int, provider: str = 'google') -> Optional[Dict]:
    """Get OAuth tokens for a user"""
    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM oauth_tokens 
               WHERE user_id = ? AND provider = ?
               ORDER BY updated_at DESC LIMIT 1""",
            (user_id, provider)
        ).fetchone()
        return row_to_dict(row)


def get_oauth_tokens_by_email(email: str, provider: str = 'google') -> Optional[Dict]:
    """Get OAuth tokens by email"""
    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM oauth_tokens WHERE email = ? AND provider = ?""",
            (email, provider)
        ).fetchone()
        return row_to_dict(row)


def delete_oauth_token(user_id: int, provider: str = 'google', email: str = None):
    """Delete OAuth tokens"""
    with get_db() as conn:
        if email:
            conn.execute(
                "DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ? AND email = ?",
                (user_id, provider, email)
            )
        else:
            conn.execute(
                "DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?",
                (user_id, provider)
            )


# =============================================================================
# WORKSPACE OPERATIONS
# =============================================================================

def create_workspace(owner_id: int, name: str, settings: Dict = None, branding: Dict = None) -> int:
    """Create a new workspace and return its ID"""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO workspaces (name, owner_id, settings_json, branding_json)
               VALUES (?, ?, ?, ?)""",
            (name, owner_id,
             json.dumps(settings or {}),
             json.dumps(branding or {}))
        )
        workspace_id = cursor.lastrowid

        # Add owner as 'owner' member
        conn.execute(
            """INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
               VALUES (?, ?, 'owner')""",
            (workspace_id, owner_id)
        )
        return workspace_id


def get_workspace_by_id(workspace_id: int) -> Optional[Dict]:
    """Get a workspace by ID"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        return row_to_dict(row)


def get_workspace_settings(workspace_id: int) -> Dict[str, Any]:
    """Return parsed workspace settings JSON."""
    ws = get_workspace_by_id(workspace_id)
    if not ws:
        return {}
    raw = ws.get('settings_json') or '{}'
    try:
        return json.loads(raw) if isinstance(raw, str) else (raw or {})
    except Exception:
        return {}


def get_user_workspace(user_id: int) -> Optional[Dict]:
    """Get the primary workspace for a user"""
    with get_db() as conn:
        row = conn.execute(
            """SELECT w.* FROM workspaces w
               LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
               WHERE w.owner_id = ? OR wm.user_id = ?
               ORDER BY w.owner_id = ? DESC
               LIMIT 1""",
            (user_id, user_id, user_id)
        ).fetchone()
        return row_to_dict(row)


def get_user_workspaces(user_id: int) -> List[Dict]:
    """Get all workspaces a user has access to (owned + member)"""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT DISTINCT w.*, 
                      CASE WHEN w.owner_id = ? THEN 'owner'
                           ELSE COALESCE(wm.role, 'member')
                      END AS user_role
               FROM workspaces w
               LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
               WHERE w.owner_id = ? OR wm.user_id = ?
               ORDER BY w.owner_id = ? DESC, w.name ASC""",
            (user_id, user_id, user_id, user_id, user_id)
        ).fetchall()
        return rows_to_list(rows)


def update_workspace(workspace_id: int, updates: Dict):
    """Update workspace name or other direct fields"""
    allowed = ['name']
    set_clauses = []
    values = []
    for field in allowed:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(updates[field])
    if not set_clauses:
        return
    values.append(workspace_id)
    with get_db() as conn:
        conn.execute(
            f"UPDATE workspaces SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values
        )


def delete_workspace(workspace_id: int):
    """Delete a workspace and cascade to all related data"""
    with get_db() as conn:
        conn.execute("DELETE FROM workspaces WHERE id = ?", (workspace_id,))


def update_workspace_settings(workspace_id: int, settings: Dict):
    """Update workspace settings"""
    with get_db() as conn:
        conn.execute(
            "UPDATE workspaces SET settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(settings), workspace_id)
        )


def update_workspace_branding(workspace_id: int, branding: Dict):
    """Update workspace branding"""
    with get_db() as conn:
        conn.execute(
            "UPDATE workspaces SET branding_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(branding), workspace_id)
        )


# =============================================================================
# WORKSPACE MEMBER OPERATIONS
# =============================================================================

def add_workspace_member(workspace_id: int, user_id: int, role: str = 'member') -> bool:
    """Add a user to a workspace. Returns True on success."""
    if role not in ('owner', 'admin', 'member', 'viewer'):
        raise ValueError(f"Invalid role: {role}")
    with get_db() as conn:
        try:
            conn.execute(
                """INSERT INTO workspace_members (workspace_id, user_id, role)
                   VALUES (?, ?, ?)""",
                (workspace_id, user_id, role)
            )
            return True
        except Exception:
            return False


def remove_workspace_member(workspace_id: int, user_id: int):
    """Remove a user from a workspace"""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
            (workspace_id, user_id)
        )


def update_workspace_member_role(workspace_id: int, user_id: int, new_role: str):
    """Update a member's role in a workspace"""
    if new_role not in ('owner', 'admin', 'member', 'viewer'):
        raise ValueError(f"Invalid role: {new_role}")
    with get_db() as conn:
        conn.execute(
            "UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?",
            (new_role, workspace_id, user_id)
        )


def get_workspace_members(workspace_id: int) -> List[Dict]:
    """Get all members of a workspace including the owner"""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT u.id, u.email, u.display_name, wm.role, wm.created_at
               FROM workspace_members wm
               JOIN users u ON wm.user_id = u.id
               WHERE wm.workspace_id = ?
               ORDER BY 
                   CASE wm.role 
                       WHEN 'owner' THEN 0 
                       WHEN 'admin' THEN 1 
                       WHEN 'member' THEN 2 
                       WHEN 'viewer' THEN 3 
                   END""",
            (workspace_id,)
        ).fetchall()
        members = rows_to_list(rows)

        # Ensure owner is included
        workspace = get_workspace_by_id(workspace_id)
        if workspace:
            owner_id = workspace['owner_id']
            if not any(m['id'] == owner_id for m in members):
                owner = get_user_by_id(owner_id)
                if owner:
                    members.insert(0, {
                        'id': owner['id'],
                        'email': owner['email'],
                        'display_name': owner['display_name'],
                        'role': 'owner',
                        'created_at': workspace['created_at'],
                    })
        return members


def check_workspace_permission(workspace_id: int, user_id: int, required_role: str = 'viewer') -> bool:
    """Check if a user has at least the required role in a workspace.
    Role hierarchy: owner > admin > member > viewer
    """
    role_order = {'owner': 0, 'admin': 1, 'member': 2, 'viewer': 3}
    if required_role not in role_order:
        return False

    workspace = get_workspace_by_id(workspace_id)
    if not workspace:
        return False

    # Owner always has full access
    if workspace['owner_id'] == user_id:
        return True

    with get_db() as conn:
        row = conn.execute(
            "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
            (workspace_id, user_id)
        ).fetchone()

    if not row:
        return False

    user_role_rank = role_order.get(row['role'], 99)
    required_rank = role_order[required_role]
    return user_role_rank <= required_rank


# =============================================================================
# PROJECT OPERATIONS
# =============================================================================

def create_project(workspace_id: int, project_data: Dict) -> int:
    """Create a new project"""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO projects 
               (workspace_id, external_id, client_name, avatar_initials, avatar_color, 
                avatar_image, status, phase, progress, profile_json, brand_kit_json,
                credentials_json, moodboard_json, maintenance_json, portal_settings_json,
                folder_path, archive_category)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                workspace_id,
                project_data.get('id'),
                project_data.get('clientName'),
                project_data.get('avatarInitials'),
                project_data.get('avatarColor'),
                project_data.get('avatarImage'),
                project_data.get('status', 'Prospect'),
                project_data.get('phase', 'Découverte'),
                project_data.get('progress', 0),
                json.dumps(project_data.get('profile', {})),
                json.dumps(project_data.get('brandKit', {})),
                json.dumps(project_data.get('credentials', [])),
                json.dumps(project_data.get('moodboard', [])),
                json.dumps(project_data.get('maintenance', {})),
                json.dumps(project_data.get('portalSettings')),
                project_data.get('folderPath'),
                project_data.get('archiveCategory')
            )
        )
        return cursor.lastrowid


def get_projects(workspace_id: int, status: str = None) -> List[Dict]:
    """Get all projects for a workspace"""
    with get_db() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM projects WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC",
                (workspace_id, status)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC",
                (workspace_id,)
            ).fetchall()
        return rows_to_list(rows)


def get_project(project_id: int) -> Optional[Dict]:
    """Get a project by ID"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return row_to_dict(row)


def get_project_by_external_id(external_id: str) -> Optional[Dict]:
    """Get a project by external ID"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE external_id = ?", (external_id,)
        ).fetchone()
        return row_to_dict(row)


def update_project(project_id: int, updates: Dict):
    """Update a project"""
    allowed_fields = [
        'client_name', 'avatar_initials', 'avatar_color', 'avatar_image',
        'status', 'phase', 'progress', 'profile_json', 'brand_kit_json',
        'credentials_json', 'moodboard_json', 'maintenance_json',
        'portal_settings_json', 'folder_path', 'archive_category', 'unread_email_count'
    ]
    
    set_clauses = []
    values = []
    
    for field in allowed_fields:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            value = updates[field]
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            values.append(value)
    
    if not set_clauses:
        return
    
    values.append(project_id)
    
    with get_db() as conn:
        conn.execute(
            f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = ?",
            values
        )


def delete_project(project_id: int):
    """Delete a project and all related data"""
    with get_db() as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))


def create_activity_event(
    workspace_id: int,
    event_type: str,
    title: str,
    description: str = None,
    project_id: int = None,
    project_name: str = None,
    metadata: Dict[str, Any] = None,
) -> int:
    """Create an audit/activity event row."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO activities (workspace_id, type, title, description, project_id, project_name, metadata_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                workspace_id,
                event_type,
                title,
                description,
                project_id,
                project_name,
                json.dumps(metadata or {}),
            ),
        )
        return cursor.lastrowid


# =============================================================================
# TASK OPERATIONS
# =============================================================================

def create_task(project_id: int, task_data: Dict) -> int:
    """Create a new task"""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO tasks 
               (project_id, external_id, title, description, completed, column, 
                due_date, priority, phase, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                task_data.get('id'),
                task_data.get('title'),
                task_data.get('description'),
                task_data.get('completed', False),
                task_data.get('column', 'todo'),
                task_data.get('dueDate'),
                task_data.get('priority', 'Medium'),
                task_data.get('phase'),
                task_data.get('sortOrder', 0)
            )
        )
        return cursor.lastrowid


def get_tasks(project_id: int) -> List[Dict]:
    """Get all tasks for a project"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order, created_at",
            (project_id,)
        ).fetchall()
        return rows_to_list(rows)


def update_task(task_id: int, updates: Dict):
    """Update a task"""
    allowed_fields = ['title', 'description', 'completed', 'column', 'due_date', 'priority', 'phase', 'sort_order']
    
    set_clauses = []
    values = []
    
    for field in allowed_fields:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(updates[field])
    
    if not set_clauses:
        return
    
    values.append(task_id)
    
    with get_db() as conn:
        conn.execute(
            f"UPDATE tasks SET {', '.join(set_clauses)} WHERE id = ?",
            values
        )


def delete_task(task_id: int):
    """Delete a task"""
    with get_db() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))


# =============================================================================
# INVOICE OPERATIONS
# =============================================================================

def create_invoice(project_id: int, invoice_data: Dict) -> int:
    """Create a new invoice"""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO invoices 
               (project_id, external_id, number, date, due_date, client_address,
                client_display_name, amount, currency, status, items_json, 
                payments_json, payment_link, footer_note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                invoice_data.get('id'),
                invoice_data.get('number'),
                invoice_data.get('date'),
                invoice_data.get('dueDate'),
                invoice_data.get('clientAddress'),
                invoice_data.get('clientDisplayName'),
                invoice_data.get('amount', 0),
                invoice_data.get('currency', 'CHF'),
                invoice_data.get('status', 'Draft'),
                json.dumps(invoice_data.get('items', [])),
                json.dumps(invoice_data.get('payments', [])),
                invoice_data.get('paymentLink'),
                invoice_data.get('footerNote')
            )
        )
        return cursor.lastrowid


def get_invoices(project_id: int) -> List[Dict]:
    """Get all invoices for a project"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM invoices WHERE project_id = ? ORDER BY date DESC",
            (project_id,)
        ).fetchall()
        return rows_to_list(rows)


def get_all_invoices(workspace_id: int, status: str = None) -> List[Dict]:
    """Get all invoices for a workspace"""
    with get_db() as conn:
        if status:
            rows = conn.execute(
                """SELECT i.*, p.client_name 
                   FROM invoices i 
                   JOIN projects p ON i.project_id = p.id
                   WHERE p.workspace_id = ? AND i.status = ?
                   ORDER BY i.date DESC""",
                (workspace_id, status)
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT i.*, p.client_name 
                   FROM invoices i 
                   JOIN projects p ON i.project_id = p.id
                   WHERE p.workspace_id = ?
                   ORDER BY i.date DESC""",
                (workspace_id,)
            ).fetchall()
        return rows_to_list(rows)


def update_invoice(invoice_id: int, updates: Dict):
    """Update an invoice"""
    allowed_fields = [
        'number', 'date', 'due_date', 'client_address', 'client_display_name',
        'amount', 'currency', 'status', 'items_json', 'payments_json',
        'payment_link', 'footer_note'
    ]
    
    set_clauses = []
    values = []
    
    for field in allowed_fields:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            value = updates[field]
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            values.append(value)
    
    if not set_clauses:
        return
    
    values.append(invoice_id)
    
    with get_db() as conn:
        conn.execute(
            f"UPDATE invoices SET {', '.join(set_clauses)} WHERE id = ?",
            values
        )


# =============================================================================
# EMAIL ACCOUNT OPERATIONS (Phase 3.2)
# =============================================================================

def save_email_account(user_id: int, username: str, password_encrypted: str,
                       salt: str, imap_host: str = None, smtp_host: str = None) -> int:
    """Save or update email account credentials (encrypted)."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO email_accounts (user_id, username, password_encrypted, salt, imap_host, smtp_host)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, username)
               DO UPDATE SET password_encrypted = excluded.password_encrypted,
                             salt = excluded.salt,
                             imap_host = COALESCE(excluded.imap_host, email_accounts.imap_host),
                             smtp_host = COALESCE(excluded.smtp_host, email_accounts.smtp_host)""",
            (user_id, username, password_encrypted, salt,
             imap_host or 'mail.infomaniak.com', smtp_host or 'mail.infomaniak.com')
        )
        return cursor.lastrowid


def get_email_account(user_id: int) -> Optional[Dict]:
    """Get the email account for a user."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM email_accounts WHERE user_id = ? LIMIT 1",
            (user_id,)
        ).fetchone()
        return row_to_dict(row)


def delete_email_account(user_id: int):
    """Delete the email account for a user."""
    with get_db() as conn:
        conn.execute("DELETE FROM email_accounts WHERE user_id = ?", (user_id,))


# =============================================================================
# RATE LIMITING
# =============================================================================

def check_rate_limit(ip_address: str, endpoint: str, max_attempts: int = 10, window_seconds: int = 60) -> bool:
    """Check if IP is rate limited. Returns True if allowed, False if blocked."""
    with get_db() as conn:
        now = datetime.now()
        
        row = conn.execute(
            "SELECT * FROM rate_limits WHERE ip_address = ? AND endpoint = ?",
            (ip_address, endpoint)
        ).fetchone()
        
        if row:
            reset_at = row['reset_at']
            if isinstance(reset_at, str):
                reset_at = datetime.fromisoformat(reset_at)
            if reset_at < now:
                # Window expired, reset
                conn.execute(
                    "UPDATE rate_limits SET attempt_count = 1, reset_at = ? WHERE id = ?",
                    (now + timedelta(seconds=window_seconds), row['id'])
                )
                return True
            elif row['attempt_count'] >= max_attempts:
                return False
            else:
                conn.execute(
                    "UPDATE rate_limits SET attempt_count = attempt_count + 1 WHERE id = ?",
                    (row['id'],)
                )
                return True
        else:
            conn.execute(
                "INSERT INTO rate_limits (ip_address, endpoint, reset_at) VALUES (?, ?, ?)",
                (ip_address, endpoint, now + timedelta(seconds=window_seconds))
            )
            return True


def reset_rate_limit(ip_address: str, endpoint: str):
    """Reset rate limit for an IP"""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM rate_limits WHERE ip_address = ? AND endpoint = ?",
            (ip_address, endpoint)
        )


# =============================================================================
# MIGRATION HELPERS
# =============================================================================

def migrate_legacy_auth(auth_data: Dict, password_hash: str, password_salt: str) -> int:
    """Migrate legacy auth data to new user system"""
    # Create user from legacy auth
    user_id = create_user(
        email=auth_data.get('email', 'marion@local'),
        password_hash=password_hash,
        password_salt=password_salt,
        display_name=auth_data.get('name', 'Marion')
    )
    return user_id


def migrate_project_from_dict(workspace_id: int, project_dict: Dict) -> int:
    """Migrate a project from legacy format"""
    project_id = create_project(workspace_id, project_dict)
    
    # Migrate tasks
    for task in project_dict.get('tasks', []):
        create_task(project_id, task)
    
    # Migrate invoices
    for invoice in project_dict.get('invoices', []):
        create_invoice(project_id, invoice)
    
    return project_id


# =============================================================================
# PORTAL OPERATIONS
# =============================================================================

def get_project_by_portal_token(share_token: str) -> Optional[Dict]:
    """Find a project by its portal share token (stored in portal_settings_json)."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM projects").fetchall()
        for row in rows:
            d = row_to_dict(row)
            ps_raw = d.get('portal_settings_json')
            if ps_raw:
                try:
                    ps = json.loads(ps_raw) if isinstance(ps_raw, str) else ps_raw
                    if ps.get('shareToken') == share_token and ps.get('enabled'):
                        return d
                except (json.JSONDecodeError, TypeError):
                    pass
    return None


def verify_portal_pin(project_id: int, pin: str) -> bool:
    """Check if the given PIN matches the project's portal PIN."""
    with get_db() as conn:
        row = conn.execute("SELECT portal_pin FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            return False
        stored = row['portal_pin']
        if not stored:
            # No PIN set → open access
            return True
        return stored == pin


# -- Portal Sessions (SQLite-backed, survives server restarts) --

def create_portal_session(token: str, project_id: int, expires_at: int) -> None:
    """Store a portal session token with its expiry (unix timestamp, seconds)."""
    with get_db() as conn:
        conn.execute(
            "INSERT INTO portal_sessions (token, project_id, expires_at) VALUES (?, ?, ?)",
            (token, project_id, expires_at)
        )


def get_portal_session(token: str) -> Optional[Dict]:
    """Fetch a portal session by token."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM portal_sessions WHERE token = ?", (token,)).fetchone()
        return row_to_dict(row)


def delete_portal_session(token: str) -> None:
    """Delete a single portal session."""
    with get_db() as conn:
        conn.execute("DELETE FROM portal_sessions WHERE token = ?", (token,))


def delete_expired_portal_sessions(now_ts: int) -> None:
    """Remove all portal sessions whose expiry is in the past."""
    with get_db() as conn:
        conn.execute("DELETE FROM portal_sessions WHERE expires_at < ?", (now_ts,))


# -- Portal Deliverables --

def create_portal_deliverable(project_id: int, data: Dict) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO portal_deliverables
               (project_id, type, title, url, description, thumbnail_base64, sort_order, visible, file_path, original_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, data.get('type', 'link'), data['title'],
             data.get('url'), data.get('description'), data.get('thumbnail'),
             data.get('sortOrder', 0), 1 if data.get('visible', True) else 0,
             data.get('file_path'), data.get('original_name'))
        )
        return cursor.lastrowid


def get_portal_deliverables(project_id: int, visible_only: bool = False) -> List[Dict]:
    with get_db() as conn:
        if visible_only:
            rows = conn.execute(
                "SELECT * FROM portal_deliverables WHERE project_id = ? AND visible = 1 ORDER BY sort_order",
                (project_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM portal_deliverables WHERE project_id = ? ORDER BY sort_order",
                (project_id,)
            ).fetchall()
        return rows_to_list(rows)


def update_portal_deliverable(deliverable_id: int, data: Dict):
    allowed = ['type', 'title', 'url', 'description', 'thumbnail_base64', 'sort_order', 'visible', 'file_path', 'original_name']
    clauses, vals = [], []
    for k in allowed:
        if k in data:
            clauses.append(f"{k} = ?")
            vals.append(data[k])
    if not clauses:
        return
    vals.append(deliverable_id)
    with get_db() as conn:
        conn.execute(f"UPDATE portal_deliverables SET {', '.join(clauses)} WHERE id = ?", vals)


def delete_portal_deliverable(deliverable_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT file_path FROM portal_deliverables WHERE id = ?", (deliverable_id,)).fetchone()
        if row and row['file_path']:
            try:
                import os
                fp = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'portal_deliverables', row['file_path'])
                if os.path.isfile(fp):
                    os.remove(fp)
            except Exception:
                pass
        conn.execute("DELETE FROM portal_deliverables WHERE id = ?", (deliverable_id,))


# -- Portal Updates --

def create_portal_update(project_id: int, data: Dict) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO portal_updates (project_id, phase, title, content, attachments_json)
               VALUES (?, ?, ?, ?, ?)""",
            (project_id, data.get('phase'), data['title'],
             data.get('content', ''), json.dumps(data.get('attachments', [])))
        )
        return cursor.lastrowid


def get_portal_updates(project_id: int) -> List[Dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portal_updates WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        ).fetchall()
        return rows_to_list(rows)


def delete_portal_update(update_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM portal_updates WHERE id = ?", (update_id,))


# -- Portal Comments --

def create_portal_comment(project_id: int, data: Dict) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO portal_comments (project_id, author, text, phase_ref, is_admin)
               VALUES (?, ?, ?, ?, ?)""",
            (project_id, data['author'], data['text'],
             data.get('phaseRef'), 1 if data.get('isAdmin') else 0)
        )
        return cursor.lastrowid


def get_portal_comments(project_id: int) -> List[Dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portal_comments WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,)
        ).fetchall()
        return rows_to_list(rows)


def delete_portal_comment(comment_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM portal_comments WHERE id = ?", (comment_id,))


def mark_portal_comments_seen(project_id: int):
    with get_db() as conn:
        conn.execute("UPDATE portal_comments SET seen = 1 WHERE project_id = ? AND is_admin = 0", (project_id,))


def count_unseen_portal_comments(project_id: int) -> int:
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM portal_comments WHERE project_id = ? AND is_admin = 0 AND seen = 0",
            (project_id,)
        ).fetchone()
        return row['cnt'] if row else 0


# -- Portal Client Files --

def create_portal_client_file(project_id: int, data: Dict) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO portal_client_files
               (project_id, filename, original_name, mime_type, size_bytes, category, note, author_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, data['filename'], data['originalName'],
             data.get('mimeType'), data.get('sizeBytes', 0),
             data.get('category', 'other'), data.get('note'), data.get('authorName'))
        )
        return cursor.lastrowid


def get_portal_client_files(project_id: int) -> List[Dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portal_client_files WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        ).fetchall()
        return rows_to_list(rows)


def delete_portal_client_file(file_id: int) -> Optional[Dict]:
    """Delete a client file record and return its data for physical file cleanup."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM portal_client_files WHERE id = ?", (file_id,)).fetchone()
        if row:
            conn.execute("DELETE FROM portal_client_files WHERE id = ?", (file_id,))
            return row_to_dict(row)
    return None


def mark_portal_files_seen(project_id: int):
    with get_db() as conn:
        conn.execute("UPDATE portal_client_files SET seen = 1 WHERE project_id = ?", (project_id,))


def count_unseen_portal_files(project_id: int) -> int:
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM portal_client_files WHERE project_id = ? AND seen = 0",
            (project_id,)
        ).fetchone()
        return row['cnt'] if row else 0


# -- Portal Documents --

def create_portal_document(project_id: int, data: Dict) -> int:
    """Create a portal document record."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO portal_documents
               (project_id, title, doc_type, file_path, original_name, mime_type, size_bytes, visible)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, data['title'], data.get('doc_type', 'other'),
             data['file_path'], data['original_name'],
             data.get('mime_type'), data.get('size_bytes', 0),
             1 if data.get('visible', True) else 0)
        )
        return cursor.lastrowid


def get_portal_documents(project_id: int, visible_only: bool = False) -> List[Dict]:
    """Get all portal documents for a project."""
    with get_db() as conn:
        if visible_only:
            rows = conn.execute(
                "SELECT * FROM portal_documents WHERE project_id = ? AND visible = 1 ORDER BY uploaded_at DESC",
                (project_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM portal_documents WHERE project_id = ? ORDER BY uploaded_at DESC",
                (project_id,)
            ).fetchall()
        return rows_to_list(rows)


def update_portal_document(doc_id: int, data: Dict):
    """Update a portal document (e.g. toggle visibility)."""
    allowed = ['title', 'doc_type', 'visible']
    clauses, vals = [], []
    for k in allowed:
        if k in data:
            clauses.append(f"{k} = ?")
            vals.append(data[k])
    if not clauses:
        return
    vals.append(doc_id)
    with get_db() as conn:
        conn.execute(f"UPDATE portal_documents SET {', '.join(clauses)} WHERE id = ?", vals)


def delete_portal_document(doc_id: int) -> Optional[Dict]:
    """Delete a portal document record and return its data for physical file cleanup."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM portal_documents WHERE id = ?", (doc_id,)).fetchone()
        if row:
            conn.execute("DELETE FROM portal_documents WHERE id = ?", (doc_id,))
            return row_to_dict(row)
    return None


# -- Portal Activity (merged feed) --

def get_portal_activity(project_id: int, limit: int = 50) -> List[Dict]:
    """Get a merged chronological feed of updates, comments and file uploads."""
    items = []
    for u in get_portal_updates(project_id):
        items.append({
            'id': f"update-{u['id']}",
            'type': 'update',
            'title': u['title'],
            'content': u.get('content'),
            'phase': u.get('phase'),
            'author': 'Eonora Tech',
            'createdAt': u['created_at'],
        })
    for c in get_portal_comments(project_id):
        items.append({
            'id': f"comment-{c['id']}",
            'type': 'comment',
            'title': c['text'][:80],
            'content': c['text'],
            'author': c['author'],
            'isAdmin': bool(c.get('is_admin')),
            'createdAt': c['created_at'],
        })
    for f in get_portal_client_files(project_id):
        items.append({
            'id': f"file-{f['id']}",
            'type': 'file',
            'title': f['original_name'],
            'content': f.get('note'),
            'author': f.get('author_name', 'Client'),
            'category': f.get('category'),
            'createdAt': f['created_at'],
        })
    items.sort(key=lambda x: x['createdAt'] or '', reverse=True)
    return items[:limit]


# =============================================================================
# MIGRATION SYSTEM
# =============================================================================

def _safe_add_column(conn, table: str, column: str, col_type: str = "TEXT"):
    """Safely add a column to a table if it doesn't already exist."""
    try:
        cols = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            logger.info("Migration: Added column %s.%s", table, column)
    except Exception as e:
        logger.error("Migration: Could not add %s.%s: %s", table, column, e, exc_info=True)


def run_migrations():
    """
    Run pending SQL migration files from database/migrations/.
    Tracks applied versions in a `schema_migrations` table.
    Files must be named NNN_description.sql and are executed in order.
    """
    migrations_dir = Path(__file__).parent / 'migrations'
    if not migrations_dir.exists():
        return

    with get_db() as conn:
        # Ensure tracking table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                filename TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Get already-applied versions
        applied = set()
        rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
        for row in rows:
            applied.add(row[0] if isinstance(row, (tuple, list)) else row['version'])

        # Find migration files
        migration_files = sorted(migrations_dir.glob('*.sql'))
        for mf in migration_files:
            # Extract version number from filename (e.g. 001_initial.sql -> 1)
            try:
                version = int(mf.name.split('_')[0])
            except (ValueError, IndexError):
                continue

            if version in applied:
                continue

            logger.info("Migration: Applying %s (v%s)...", mf.name, version)
            try:
                sql = mf.read_text()
                conn.executescript(sql)
                conn.execute(
                    "INSERT INTO schema_migrations (version, filename) VALUES (?, ?)",
                    (version, mf.name)
                )
                logger.info("Migration: Applied %s", mf.name)
            except Exception as e:
                logger.error("Migration: FAILED %s: %s", mf.name, e, exc_info=True)
                # Don't break -- skip to next (or raise depending on policy)

        # Safe column additions (for columns that can't use IF NOT EXISTS in SQLite)
        _safe_add_column(conn, 'projects', 'portal_pin', 'TEXT')
        _safe_add_column(conn, 'portal_deliverables', 'file_path', 'TEXT')
        _safe_add_column(conn, 'portal_deliverables', 'original_name', 'TEXT')


# =============================================================================
# AUTOMATIC BACKUP
# =============================================================================

def backup_database(max_backups: int = 5) -> Optional[str]:
    """
    Create a backup of the SQLite database using the native backup API.
    Keeps at most `max_backups` recent backups; older ones are rotated out.
    Returns the path to the new backup file, or None on failure.
    """
    db_path = get_db_path()
    backup_dir = db_path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    backup_path = backup_dir / f"marion_{timestamp}.db"

    try:
        source = sqlite3.connect(str(db_path))
        dest = sqlite3.connect(str(backup_path))
        source.backup(dest)
        dest.close()
        source.close()
        logger.info("Backup created: %s", backup_path)

        # Rotation: keep only the N most recent backups
        backups = sorted(backup_dir.glob("marion_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in backups[max_backups:]:
            try:
                old.unlink()
                logger.info("Backup rotated out: %s", old.name)
            except OSError:
                pass

        return str(backup_path)
    except Exception as e:
        logger.error("Backup error: %s", e, exc_info=True)
        return None


# Initialize on import if running directly
if __name__ == '__main__':
    init_database()
    logger.info("Database initialized successfully!")
