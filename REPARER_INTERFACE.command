#!/usr/bin/env bash
# Répare l'écran blanc (404 sur index-*.js) — restaure .dist depuis GitHub
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
  export MARION_CLEAN_SHELL=1
  exec /bin/bash --noprofile --norc "$SCRIPT_PATH" "$@"
fi

cd "$SCRIPT_DIR"
APP_DIR="$(pwd)"

# shellcheck source=packaging/verify_dist.sh
source "$APP_DIR/packaging/verify_dist.sh"

command -v clear >/dev/null 2>&1 && clear || true
echo "🦄 Marion Web OS — Réparation interface"
echo "────────────────────────────────────────────────────────────────────"
echo "📁 $APP_DIR"
echo ""

if verify_dist_integrity "$APP_DIR"; then
    echo ""
    echo "L'interface semble correcte sur le disque."
    echo "Si l'écran reste blanc :"
    echo "  1. STOPPER_MARION.command"
    echo "  2. Dans Safari/Chrome : Cmd + Shift + R"
    echo "  3. Ou vider le cache du site 127.0.0.1"
    echo "  4. LANCER_MARION.command"
    read -r -p "Appuie sur Entrée pour fermer…"
    exit 0
fi

echo ""
echo "🔧 Restauration depuis GitHub…"
if ! download_dist_from_github "$APP_DIR"; then
    read -r -p "Échec. Appuie sur Entrée…"
    exit 1
fi

if [ -f BUILD_STAMP.json ]; then
    cp BUILD_STAMP.json .marion_installed.json 2>/dev/null || true
fi

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "✅ Interface réparée."
echo ""
echo "👉 STOPPER_MARION.command"
echo "👉 LANCER_MARION.command"
echo "👉 Navigateur : Cmd + Shift + R (obligatoire)"
echo "────────────────────────────────────────────────────────────────────"
read -r -p "Appuie sur Entrée pour fermer…"
