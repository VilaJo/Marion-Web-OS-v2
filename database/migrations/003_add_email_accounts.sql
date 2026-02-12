-- Migration 003: Add email_accounts table for persistent encrypted email credentials
CREATE TABLE IF NOT EXISTS email_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    salt TEXT NOT NULL,
    imap_host TEXT DEFAULT 'mail.infomaniak.com',
    smtp_host TEXT DEFAULT 'mail.infomaniak.com',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, username)
);
