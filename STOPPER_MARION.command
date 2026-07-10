#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🛑 MARION WEB OS - ARRÊT
# ═══════════════════════════════════════════════════════════════════════════════
if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
  export MARION_CLEAN_SHELL=1
  exec /bin/bash --noprofile --norc "$0" "$@"
fi

cd "$(dirname "$0")"

echo "🛑 Arrêt de Marion Web OS..."

PID_FILE=".marion.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID 2>/dev/null
        echo "✅ Serveur arrêté (PID: $PID)"
    else
        echo "ℹ️  Le serveur n'était pas en cours d'exécution"
    fi
    rm -f "$PID_FILE"
else
    # Essayer de trouver et tuer le processus par son nom
    pkill -f "franck_server.py" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Serveur arrêté"
    else
        echo "ℹ️  Aucun serveur Marion en cours d'exécution"
    fi
fi

echo ""
echo "👋 À bientôt !"
sleep 2
