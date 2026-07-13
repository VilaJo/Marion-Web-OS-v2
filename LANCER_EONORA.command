#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS - LANCEMENT
# ═══════════════════════════════════════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

marion_pause() {
    read -r -p "Appuie sur Entrée pour fermer..."
}

marion_fail() {
    echo ""
    echo "❌ $1"
    marion_pause
    exit 1
}

if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
    export MARION_CLEAN_SHELL=1
    exec /bin/bash --noprofile --norc "$SCRIPT_PATH" "$@"
fi

cd "$SCRIPT_DIR"
APP_DIR="$(pwd)"

command -v clear >/dev/null 2>&1 && clear || true
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        🦄  MARION WEB OS                                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PID_FILE=".marion.pid"
LOG_FILE=".marion.log"
PYTHON_BIN="$APP_DIR/.venv/bin/python"

is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid="$(cat "$PID_FILE" 2>/dev/null || true)"
        if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    if lsof -i :5003 > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

if is_server_running; then
    echo "✅ Marion est déjà en cours d'exécution !"
    open "http://127.0.0.1:5003"
    sleep 3
    exit 0
fi

if [ ! -x "$PYTHON_BIN" ]; then
    marion_fail "Environnement non installé. Lance d'abord INSTALLER.command"
fi

# shellcheck source=packaging/verify_dist.sh
source "$APP_DIR/packaging/verify_dist.sh" 2>/dev/null || true
if declare -F verify_dist_integrity >/dev/null 2>&1; then
    if ! verify_dist_integrity "$APP_DIR"; then
        echo "⚠️  Interface (.dist) incomplète — lance REPARER_INTERFACE.command"
    fi
fi

echo "🚀 Démarrage du serveur..."
"$PYTHON_BIN" "$APP_DIR/franck_server.py" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

echo "⏳ Initialisation..."
READY=0
for _ in $(seq 1 60); do
    if curl -fsS --max-time 2 http://127.0.0.1:5003/api/v1/version > /dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 1
done

if [ "$READY" -ne 1 ]; then
    tail -20 "$LOG_FILE" 2>/dev/null || true
    marion_fail "Serveur non prêt. Vérifie .marion.log"
fi

echo "✅ Serveur prêt !"
open "http://127.0.0.1:5003"
echo "🦄 Marion tourne sur http://127.0.0.1:5003"

trap 'kill "$SERVER_PID" 2>/dev/null; rm -f "$PID_FILE"; exit 0' INT TERM
wait "$SERVER_PID" || true
rm -f "$PID_FILE"
marion_pause
