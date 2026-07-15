#!/bin/bash
# Eonora Tech OS — worker pour installation « dossier sur le Bureau » (sans Terminal)
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

BUNDLE_MACOS="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_ROOT="$(dirname "$(dirname "$BUNDLE_MACOS")")"
PROJECT_PATH_FILE="$BUNDLE_ROOT/Resources/project_path"

resolve_project_dir() {
    local configured="" candidate path
    if [ -f "$PROJECT_PATH_FILE" ]; then
        configured="$(tr -d '\r' < "$PROJECT_PATH_FILE" | head -1)"
        if [ -n "$configured" ] && [ -f "$configured/franck_server.py" ]; then
            echo "$configured"
            return 0
        fi
    fi
    local app_parent
    app_parent="$(dirname "$BUNDLE_ROOT")"
    local candidates=(
        "$app_parent"
        "$HOME/Desktop/Marion Web OS"
        "$HOME/Desktop/Eonora Tech OS"
        "$HOME/Bureau/Marion Web OS"
        "$HOME/Bureau/Eonora Tech OS"
        "$HOME/Desktop/Marion-Web-OS-v2-main"
        "$HOME/Desktop/Marion-Web-OS-v2"
    )
    for candidate in "${candidates[@]}"; do
        if [ -f "$candidate/franck_server.py" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

PROJECT_DIR="$(resolve_project_dir || true)"
if [ -z "$PROJECT_DIR" ]; then
    osascript -e 'display alert "Eonora Tech OS" message "Dossier du projet introuvable.\n\nLance INSTALLER.command une fois, ou réinstalle depuis le .dmg." as critical' 2>/dev/null || true
    exit 1
fi

LOG_FILE="$PROJECT_DIR/.marion.log"
PID_FILE="$PROJECT_DIR/.marion.pid"
STARTUP_LOCK="$PROJECT_DIR/.marion.startup.lock"
PYTHON_BIN="$PROJECT_DIR/.venv/bin/python"
PORT="${MARION_PORT:-5003}"
URL="http://127.0.0.1:${PORT}"

mkdir -p "$(dirname "$LOG_FILE")"
trap 'rm -f "$STARTUP_LOCK"' EXIT

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

alert() {
    osascript -e "display alert \"Eonora Tech OS\" message \"$1\" as critical" 2>/dev/null || true
}

notify() {
    osascript -e "display notification \"$1\" with title \"Eonora Tech OS\"" 2>/dev/null || true
}

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

wait_for_server() {
    local i
    for i in $(seq 1 90); do
        if curl -fsS "$URL/api/v1/version" >/dev/null 2>&1; then
            log "Server ready after ${i}s"
            return 0
        fi
        sleep 1
    done
    return 1
}

log "=== Eonora Tech OS folder worker start ==="
log "Project: $PROJECT_DIR"

if [ ! -x "$PYTHON_BIN" ]; then
    alert "Environnement Python manquant.\n\nLance INSTALLER.command une fois dans le dossier du projet."
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

if ! is_server_running; then
    notify "Démarrage de Marion…"
    log "Starting server on $URL"
    "$PYTHON_BIN" "$PROJECT_DIR/franck_server.py" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    if ! wait_for_server; then
        alert "Le serveur n'a pas pu démarrer.\n\nLogs : $LOG_FILE"
        exit 1
    fi
else
    log "Server already running"
fi

open "$URL"
notify "Marion est prête."
