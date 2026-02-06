"""
Marion Web OS - Database Access Layer
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

# Thread-local storage for connections
_local = threading.local()

# Database configuration
DATABASE_PATH = os.environ.get('DATABASE_URL', '').replace('sqlite:///', '') or None
DEFAULT_DB_NAME = 'marion.db'


def get_db_path() -> Path:
    """Get the database file path"""
    if DATABASE_PATH:
        return Path(DATABASE_PATH)
    
    # Default: store in Marion Web OS Database folder
    user_home = Path.home()
    db_folder = user_home / "Desktop" / "Marion Web OS Database"
    db_folder.mkdir(parents=True, exist_ok=True)
    return db_folder / DEFAULT_DB_NAME


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
    
    print(f"Database initialized at: {get_db_path()}")


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
    
    if datetime.fromisoformat(session['expires_at']) < datetime.now():
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
            reset_at = datetime.fromisoformat(row['reset_at'])
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


# Initialize on import if running directly
if __name__ == '__main__':
    init_database()
    print("Database initialized successfully!")
