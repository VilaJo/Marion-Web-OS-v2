-- Portal session tokens (PIN-authenticated client portal access).
-- Replaces the previous in-memory dict so sessions survive server restarts
-- and are shared correctly when the app is exposed via a public tunnel.
CREATE TABLE IF NOT EXISTS portal_sessions (
    token TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_project ON portal_sessions(project_id);
