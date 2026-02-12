# Marion Web OS - API Blueprints (v1)
#
# All routes are versioned under /api/v1/ to allow future evolution
# without breaking existing clients.
#
# Blueprint registry (all registered in franck_server.py):
#
#   auth_bp       /api/v1/auth/*           Authentication (login, logout, setup, reset)
#   projects_bp   /api/v1/projects/*       Project CRUD (scan, save, move, archive, delete)
#   files_bp      /api/v1/files/*          File management (list, open, create, rename, delete, move)
#   ai_bp         /api/v1/chat,            AI & Franck chatbot (chat, zen, briefing, media,
#                 /api/v1/ai/*,            notes/ai, logo, QR, file dispatch)
#                 /api/v1/franck/*
#   calendar_bp   /api/v1/calendar/*       Local macOS Calendar (iCal)
#   invoices_bp   /api/v1/expenses,        Expenses, notes, time tracking
#                 /api/v1/notes,
#                 /api/v1/time/*
#   oauth_bp      /api/v1/oauth/*,         Google OAuth, Drive, Google Calendar
#                 /api/v1/drive/*,
#                 /api/v1/gcal/*
#   email_bp      /api/v1/email/*          IMAP/SMTP email client
#   updates_bp    /api/v1/version,         Version, updates, changelog, bug reports
#                 /api/v1/updates/*
#   api_v1        /api/v1/health,          Health check, workspaces
#                 /api/v1/workspace/*
#
# Service layer (services/):
#   gemini_service   Gemini AI client, tools, conversation state
#   oauth_service    Google OAuth token management
#   email_service    IMAP/SMTP helpers
