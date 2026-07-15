#!/bin/bash
# Eonora Tech OS — lanceur .app pour dossier projet (répond vite, sans Terminal)
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

BUNDLE_MACOS="$(cd "$(dirname "$0")" && pwd)"
WORKER="$BUNDLE_MACOS/folder-worker.sh"
BUNDLE_ROOT="$(dirname "$(dirname "$BUNDLE_MACOS")")"
PROJECT_PATH_FILE="$BUNDLE_ROOT/Resources/project_path"

read_project_dir() {
    if [ -f "$PROJECT_PATH_FILE" ]; then
        tr -d '\r' < "$PROJECT_PATH_FILE" | head -1
    fi
}

PROJECT_DIR="$(read_project_dir)"
LOG_FILE="${PROJECT_DIR:-$HOME}/.marion.log"
STARTUP_LOCK="${PROJECT_DIR:-$HOME}/.marion.startup.lock"
PORT="${MARION_PORT:-5003}"
URL="http://127.0.0.1:${PORT}"

is_server_running() {
    if [ -n "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/.marion.pid" ]; then
        local pid
        pid="$(cat "$PROJECT_DIR/.marion.pid" 2>/dev/null || true)"
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            return 0
        fi
    fi
    if lsof -i ":$PORT" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

if is_server_running && curl -fsS "$URL/api/v1/version" >/dev/null 2>&1; then
    open "$URL"
    exit 0
fi

if [ -f "$STARTUP_LOCK" ]; then
    osascript -e 'display notification "Marion démarre déjà en arrière-plan…" with title "Eonora Tech OS"' 2>/dev/null || true
    exit 0
fi

touch "$STARTUP_LOCK"
nohup "$WORKER" >> "$LOG_FILE" 2>&1 &
disown
exit 0
