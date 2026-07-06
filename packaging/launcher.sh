#!/bin/bash
# Marion Web OS — lanceur macOS (bundle /Applications)
set -euo pipefail

BUNDLE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_CODE="$BUNDLE_ROOT/Resources/app"
SUPPORT="$HOME/Library/Application Support/Marion Web OS"
VENV="$SUPPORT/venv"
LOG_DIR="$SUPPORT/logs"
LOG_FILE="$LOG_DIR/marion.log"
PID_FILE="$SUPPORT/marion.pid"
LEGACY_DATA="$HOME/Desktop/Marion Web OS Database"
DATA_DIR="$SUPPORT/Data"
ENV_FILE="$SUPPORT/.env.local"
PORT="${MARION_PORT:-5003}"
URL="http://127.0.0.1:${PORT}"

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

alert() {
    osascript -e "display alert \"Marion Web OS\" message \"$1\" as critical" 2>/dev/null || true
}

pick_python() {
    if command -v python3 >/dev/null 2>&1; then
        command -v python3
        return 0
    fi
    return 1
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
    for i in $(seq 1 45); do
        if curl -fsS "$URL/api/version" >/dev/null 2>&1; then
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
    if [ -f "$ENV_FILE" ] || [ -f "$SUPPORT/.env" ]; then
        return 0
    fi
    if [ -f "$APP_CODE/.env.example" ]; then
        cp "$APP_CODE/.env.example" "$ENV_FILE"
        osascript <<EOF 2>/dev/null || true
display dialog "Première installation de Marion Web OS.\n\nPlace le fichier de configuration (.env) que Johan t'a envoyé ici :\n\n${SUPPORT}\n\n(Renomme-le .env.local si besoin, puis relance Marion.)" buttons {"OK"} default button 1 with title "Marion Web OS"
EOF
    fi
}

ensure_venv() {
    local python_bin
    local req_file="$APP_CODE/.requirements.txt"
    local needs_install=0

    python_bin="$(pick_python)" || {
        alert "Python 3 est requis.\n\nInstalle-le avec : brew install python@3.12"
        exit 1
    }

    if [ ! -x "$VENV/bin/python" ]; then
        needs_install=1
        osascript <<EOF 2>/dev/null || true
display dialog "Marion Web OS prépare le premier lancement (2 à 3 minutes, une seule fois)…" buttons {"OK"} giving up after 4 with title "Marion Web OS"
EOF
        log "Creating venv at $VENV"
        "$python_bin" -m venv "$VENV"
    elif ! "$VENV/bin/python" -c "import cryptography" >/dev/null 2>&1; then
        needs_install=1
        log "Repairing venv — missing Python dependencies"
    fi

    if [ "$needs_install" -eq 1 ]; then
        if [ ! -f "$req_file" ]; then
            alert "Fichier des dépendances introuvable dans l'application.\n\nRéinstalle Marion Web OS depuis le .dmg."
            exit 1
        fi
        if ! "$VENV/bin/pip" install --upgrade pip >> "$LOG_FILE" 2>&1; then
            alert "Échec de l'installation Python (pip).\n\nConsulte les logs :\n$LOG_FILE"
            exit 1
        fi
        if ! "$VENV/bin/pip" install -r "$req_file" >> "$LOG_FILE" 2>&1; then
            alert "Échec de l'installation des dépendances Marion.\n\nConsulte les logs :\n$LOG_FILE"
            exit 1
        fi
        log "Python dependencies installed"
    fi
}

if [ ! -d "$APP_CODE" ] || [ ! -f "$APP_CODE/franck_server.py" ]; then
    alert "Fichiers application introuvables dans le bundle.\n\nRéinstalle Marion Web OS depuis le fichier .dmg."
    exit 1
fi

log "=== Marion Web OS launch ==="
ensure_data_dir
ensure_env_file
ensure_venv

export DATA_PATH="$DATA_DIR"
export STATIC_FOLDER="$APP_CODE/.dist"
export PORT="$PORT"
export MARION_INSTALLED_APP=1

cd "$APP_CODE" || exit 1

if ! is_server_running; then
    log "Starting server on $URL"
    "$VENV/bin/python" "$APP_CODE/franck_server.py" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    if ! wait_for_server; then
        alert "Le serveur n'a pas pu démarrer.\n\nConsulte les logs :\n$LOG_FILE"
        exit 1
    fi
else
    log "Server already running"
fi

open "$URL"
