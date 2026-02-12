-- Migration 002: Add email_credentials column to sessions for server-side IMAP storage
-- (Optional extension: the current implementation uses in-memory storage but this
--  column allows persistence across restarts if needed.)

ALTER TABLE sessions ADD COLUMN email_credentials_enc TEXT;
