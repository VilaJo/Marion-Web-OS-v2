#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 EONORA TECH OS — Tunnel Cloudflare (portail client public)
# ═══════════════════════════════════════════════════════════════════════════════
# Expose le portail client (127.0.0.1:5003) via Cloudflare Tunnel, sans jamais
# ouvrir de port sur la box/routeur de Marion. Deux modes possibles :
#   1) Tunnel nommé (compte Cloudflare)  → CLOUDFLARE_TUNNEL_TOKEN dans .env
#   2) Tunnel rapide (sans compte)        → cloudflared génère un lien
#      *.trycloudflare.com à la volée (recommandé par défaut).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="/tmp/eonora_tunnel.pid"
LOG_FILE="/tmp/eonora_tunnel.log"
LOCAL_URL="http://127.0.0.1:5003"

cd "$ROOT_DIR"

# ── 1. Charger .env / .env.local du projet (si présents) ────────────────────
for envfile in ".env" ".env.local"; do
    if [ -f "$envfile" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$envfile"
        set +a
    fi
done

# ── 2. Vérifier que cloudflared est installé ─────────────────────────────────
if ! command -v cloudflared >/dev/null 2>&1; then
    echo "❌ cloudflared n'est pas installé."
    echo ""
    echo "   Installe-le avec Homebrew :"
    echo "     brew install cloudflared"
    echo ""
    echo "   Ou télécharge le binaire directement :"
    echo "     https://github.com/cloudflare/cloudflared/releases"
    echo ""
    exit 1
fi

echo "✅ cloudflared trouvé : $(command -v cloudflared)"

# ── 3. Si un tunnel tourne déjà, ne pas en relancer un deuxième ─────────────
if [ -f "$PID_FILE" ]; then
    EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$EXISTING_PID" ] && ps -p "$EXISTING_PID" > /dev/null 2>&1; then
        echo "ℹ️  Un tunnel tourne déjà (PID: $EXISTING_PID)."
        echo "📄 Logs : $LOG_FILE"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-}"
PUBLIC_URL="${PUBLIC_BASE_URL:-}"

# ── 4a. Mode tunnel nommé (compte Cloudflare) ────────────────────────────────
if [ -n "$TOKEN" ]; then
    echo "🔐 Tunnel nommé (compte Cloudflare) — démarrage…"
    rm -f "$LOG_FILE"
    nohup cloudflared tunnel run --token "$TOKEN" > "$LOG_FILE" 2>&1 &
    TUNNEL_PID=$!
    echo "$TUNNEL_PID" > "$PID_FILE"
    sleep 2

    if ! ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
        echo "❌ Le tunnel n'a pas démarré. Regarde $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi

    echo ""
    echo "✅ Tunnel démarré (PID: $TUNNEL_PID)"
    if [ -n "$PUBLIC_URL" ]; then
        echo "🔗 Lien public : $PUBLIC_URL"
    else
        echo "🔗 Retrouve l'URL de ton tunnel nommé dans le dashboard Cloudflare Zero Trust."
    fi

# ── 4b. Mode tunnel rapide (sans compte, *.trycloudflare.com) ──────────────
else
    echo "⚡ Tunnel rapide (sans compte Cloudflare) — démarrage…"
    rm -f "$LOG_FILE"
    nohup cloudflared tunnel --url "$LOCAL_URL" > "$LOG_FILE" 2>&1 &
    TUNNEL_PID=$!
    echo "$TUNNEL_PID" > "$PID_FILE"

    echo "⏳ Récupération du lien public…"
    TUNNEL_URL=""
    for _ in $(seq 1 30); do
        TUNNEL_URL="$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1)"
        [ -n "$TUNNEL_URL" ] && break
        if ! ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    if [ -z "$TUNNEL_URL" ]; then
        echo "❌ Impossible de récupérer le lien du tunnel. Regarde $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi

    echo ""
    echo "✅ Tunnel démarré (PID: $TUNNEL_PID)"
    echo "🔗 Lien public : $TUNNEL_URL"
    echo ""
    echo "💡 Pour garder ce lien stable, ajoute-le dans .env :"
    echo "   PUBLIC_BASE_URL=$TUNNEL_URL"
fi

echo ""
echo "📄 Logs : $LOG_FILE"
echo "🛑 Pour arrêter : STOPPER_PORTAIL_PUBLIC.command"
