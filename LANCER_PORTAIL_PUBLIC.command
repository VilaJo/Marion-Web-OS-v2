#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 EONORA TECH OS — LANCER LE PORTAIL PUBLIC (tunnel Cloudflare)
# ═══════════════════════════════════════════════════════════════════════════════
# Ouvre un tunnel Cloudflare vers le portail client (127.0.0.1:5003) pour que
# Marion puisse partager un lien HTTPS avec ses clients. Garde cette fenêtre
# ouverte : elle affiche l'état du tunnel en direct.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
    export MARION_CLEAN_SHELL=1
    exec /bin/bash --noprofile --norc "$SCRIPT_PATH" "$@"
fi

cd "$SCRIPT_DIR"
APP_DIR="$(pwd)"

command -v clear >/dev/null 2>&1 && clear || true
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        🌐  EONORA TECH OS — PORTAIL PUBLIC                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Charger .env / .env.local du projet (si présents)
for envfile in ".env" ".env.local"; do
    if [ -f "$envfile" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$envfile"
        set +a
    fi
done

if ! curl -fsS --max-time 2 http://127.0.0.1:5003/api/v1/version > /dev/null 2>&1; then
    echo "⚠️  Eonora Tech OS ne semble pas lancé sur http://127.0.0.1:5003"
    echo "   Lance d'abord « Eonora Tech OS » (double-clic sur l'icône), puis relance ce script."
    echo ""
    read -r -p "Appuie sur Entrée pour fermer…"
    exit 1
fi

chmod +x "$APP_DIR/packaging/cloudflare_tunnel.sh" 2>/dev/null || true
bash "$APP_DIR/packaging/cloudflare_tunnel.sh"
TUNNEL_STATUS=$?

if [ "$TUNNEL_STATUS" -ne 0 ]; then
    echo ""
    read -r -p "Appuie sur Entrée pour fermer…"
    exit 1
fi

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "✅ Tunnel actif. Garde cette fenêtre ouverte pour suivre son état."
echo "🛑 Pour arrêter : double-clique sur STOPPER_PORTAIL_PUBLIC.command"
echo "────────────────────────────────────────────────────────────────────"
echo ""

on_exit() {
    echo ""
    echo "👋 Fenêtre fermée — le tunnel continue en arrière-plan."
    echo "   Utilise STOPPER_PORTAIL_PUBLIC.command pour l'arrêter."
    exit 0
}
trap on_exit INT TERM

tail -f -n +1 /tmp/eonora_tunnel.log 2>/dev/null || (echo "Aucun log de tunnel trouvé."; sleep 5)
