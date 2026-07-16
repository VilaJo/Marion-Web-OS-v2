#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🛑 EONORA TECH OS — ARRÊTER LE PORTAIL PUBLIC (tunnel Cloudflare)
# ═══════════════════════════════════════════════════════════════════════════════
if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
    export MARION_CLEAN_SHELL=1
    exec /bin/bash --noprofile --norc "$0" "$@"
fi

cd "$(dirname "$0")"

echo "🛑 Arrêt du tunnel Cloudflare…"

PID_FILE="/tmp/eonora_tunnel.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID" 2>/dev/null
        echo "✅ Tunnel arrêté (PID: $PID)"
    else
        echo "ℹ️  Le tunnel n'était pas en cours d'exécution"
    fi
    rm -f "$PID_FILE"
else
    if pkill -f "cloudflared tunnel" 2>/dev/null; then
        echo "✅ Tunnel arrêté"
    else
        echo "ℹ️  Aucun tunnel Cloudflare en cours d'exécution"
    fi
fi

echo ""
echo "💡 Le portail reste utilisable en local (127.0.0.1:5003), mais le lien"
echo "   public ne fonctionnera plus jusqu'au prochain lancement du tunnel."
echo ""
sleep 2
