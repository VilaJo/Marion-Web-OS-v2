#!/bin/bash
# Eonora Tech OS — point d'entrée .app (répond immédiatement à macOS)
set -uo pipefail

BUNDLE_MACOS="$(cd "$(dirname "$0")" && pwd)"
WORKER="$BUNDLE_MACOS/marion-worker.sh"
SUPPORT="$HOME/Library/Application Support/Eonora Tech OS"
LOG_FILE="$SUPPORT/logs/marion.log"
PID_FILE="$SUPPORT/marion.pid"
STARTUP_LOCK="$SUPPORT/startup.lock"
PORT="${MARION_PORT:-5003}"
URL="http://127.0.0.1:${PORT}"

mkdir -p "$SUPPORT/logs"

is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid="$(cat "$PID_FILE" 2>/dev/null || true)"
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
