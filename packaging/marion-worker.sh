#!/bin/bash
# Marion Web OS — worker (démarrage en arrière-plan)
set -euo pipefail

BUNDLE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_BUNDLE="$(cd "$(dirname "$0")/../.." && pwd)"
APP_CODE="$BUNDLE_ROOT/Resources/app"
SUPPORT="$HOME/Library/Application Support/Marion Web OS"
VENV="$SUPPORT/venv"
LOG_DIR="$SUPPORT/logs"
LOG_FILE="$LOG_DIR/marion.log"
PID_FILE="$SUPPORT/marion.pid"
STARTUP_LOCK="$SUPPORT/startup.lock"
LEGACY_DATA="$HOME/Desktop/Marion Web OS Database"
DATA_DIR="$SUPPORT/Data"
ENV_FILE="$SUPPORT/.env.local"
PORT="${MARION_PORT:-5003}"
URL="http://127.0.0.1:${PORT}"
HOST_ARCH="$(uname -m)"

mkdir -p "$LOG_DIR"
trap 'rm -f "$STARTUP_LOCK"' EXIT

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

alert() {
    osascript -e "display alert \"Marion Web OS\" message \"$1\" as critical" 2>/dev/null || true
}

notify() {
    osascript -e "display notification \"$1\" with title \"Marion Web OS\"" 2>/dev/null || true
}

pick_python() {
    local py arch
    local candidates=(
        "/opt/homebrew/bin/python3"
        "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3"
        "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3"
        "/usr/local/bin/python3"
        "/usr/bin/python3"
    )
    for py in "${candidates[@]}"; do
        [ -x "$py" ] || continue
        arch="$("$py" -c "import platform; print(platform.machine())" 2>/dev/null || echo "")"
        if [ "$arch" = "$HOST_ARCH" ]; then
            echo "$py"
            return 0
        fi
    done
    if command -v python3 >/dev/null 2>&1; then
        command -v python3
        return 0
    fi
    return 1
}

python_runs_deps() {
    "$1" -c "import flask; from cryptography.fernet import Fernet" >/dev/null 2>&1
}

venv_arch() {
    if [ ! -x "$VENV/bin/python" ]; then
        echo "missing"
        return 0
    fi
    "$VENV/bin/python" -c "import platform; print(platform.machine())" 2>/dev/null || echo "unknown"
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

ensure_data_dir() {
    if [ -d "$LEGACY_DATA" ] && [ -n "$(ls -A "$LEGACY_DATA" 2>/dev/null || true)" ]; then
        DATA_DIR="$LEGACY_DATA"
        log "Using legacy data folder: $DATA_DIR"
        return 0
    fi
    mkdir -p "$DATA_DIR"
    log "Using data folder: $DATA_DIR"
}

ensure_env_file() {
    if [ -f "$SUPPORT/.env.local" ] || [ -f "$SUPPORT/MARION-env.local" ] || [ -f "$SUPPORT/env.local" ] || [ -f "$SUPPORT/.env" ]; then
        return 0
    fi
    if [ -f "$APP_CODE/.env.example" ]; then
        cp "$APP_CODE/.env.example" "$ENV_FILE"
        osascript <<EOF 2>/dev/null || true
display dialog "Première installation de Marion Web OS.\n\nPlace le fichier de configuration que Johan t'a envoyé ici :\n\n${SUPPORT}\n\nNom du fichier : MARION-env.local (pas besoin de le renommer)." buttons {"OK"} default button 1 with title "Marion Web OS"
EOF
    fi
}

ensure_venv() {
    local python_bin
    local req_file="$APP_CODE/.requirements.txt"
    local needs_install=0
    local current_venv_arch

    python_bin="$(pick_python)" || {
        alert "Python 3 est requis.\n\nInstalle-le avec : brew install python@3.12"
        exit 1
    }

    log "Host arch=$HOST_ARCH python=$python_bin python_arch=$("$python_bin" -c "import platform; print(platform.machine())" 2>/dev/null || echo unknown)"

    current_venv_arch="$(venv_arch)"
    if [ "$current_venv_arch" != "missing" ] && [ "$current_venv_arch" != "$HOST_ARCH" ]; then
        log "Removing venv — arch mismatch (venv=$current_venv_arch, host=$HOST_ARCH)"
        rm -rf "$VENV"
        current_venv_arch="missing"
    fi

    if [ "$current_venv_arch" = "missing" ]; then
        needs_install=1
        notify "Installation Marion (2 à 3 min, une seule fois)…"
        log "Creating venv at $VENV with $python_bin"
        "$python_bin" -m venv "$VENV"
    elif ! python_runs_deps "$VENV/bin/python"; then
        needs_install=1
        notify "Réparation des composants Python…"
        log "Repairing venv — broken or incomplete Python dependencies"
        rm -rf "$VENV"
        "$python_bin" -m venv "$VENV"
    fi

    if [ "$needs_install" -eq 1 ]; then
        if [ ! -f "$req_file" ]; then
            alert "Fichier des dépendances introuvable.\n\nRéinstalle Marion Web OS depuis le .dmg."
            exit 1
        fi
        if ! "$VENV/bin/pip" install --upgrade pip >> "$LOG_FILE" 2>&1; then
            alert "Échec pip.\n\nLogs : $LOG_FILE"
            exit 1
        fi
        if ! "$VENV/bin/pip" install --no-cache-dir -r "$req_file" >> "$LOG_FILE" 2>&1; then
            alert "Échec installation dépendances.\n\nLogs : $LOG_FILE"
            exit 1
        fi
        if ! python_runs_deps "$VENV/bin/python"; then
            alert "Python installé mais invalide (architecture ?).\n\nLance REPARER_MARION.command depuis le .dmg.\n\nLogs : $LOG_FILE"
            exit 1
        fi
        log "Python dependencies installed (arch=$(venv_arch))"
    fi
}

if [ ! -d "$APP_CODE" ] || [ ! -f "$APP_CODE/franck_server.py" ]; then
    alert "Application incomplète.\n\nRéinstalle depuis le .dmg."
    exit 1
fi

xattr -dr com.apple.quarantine "$APP_BUNDLE" 2>/dev/null || true

log "=== Marion Web OS worker start ==="
ensure_data_dir
ensure_env_file
ensure_venv

export DATA_PATH="$DATA_DIR"
export DATABASE_URL="sqlite:///${DATA_DIR}/marion.db"
export STATIC_FOLDER="$APP_CODE/.dist"
export PORT="$PORT"
export MARION_INSTALLED_APP=1

cd "$APP_CODE" || exit 1

if ! is_server_running; then
    notify "Démarrage de Marion…"
    log "Starting server on $URL"
    "$VENV/bin/python" "$APP_CODE/franck_server.py" >> "$LOG_FILE" 2>&1 &
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
