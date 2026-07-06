#!/bin/bash
# Create a drag-to-Applications DMG from release/staging/Marion Web OS.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING="$ROOT/release/staging"
DMG_DIR="$ROOT/release/dmg-root"
APP_NAME="Marion Web OS"
APP_BUNDLE="$STAGING/${APP_NAME}.app"
VERSION="$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo "2.7.0")"
DMG_NAME="MarionWebOS-${VERSION}.dmg"
DMG_PATH="$ROOT/release/${DMG_NAME}"
VOLUME_NAME="Marion Web OS"

if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ Bundle introuvable — lance packaging/build_app_bundle.sh d'abord."
    exit 1
fi

echo "💿 Création du DMG ${DMG_NAME}…"

rm -rf "$DMG_DIR"
mkdir -p "$DMG_DIR"
cp -R "$APP_BUNDLE" "$DMG_DIR/"
ln -sf /Applications "$DMG_DIR/Applications"
cp "$ROOT/packaging/REPARER_MARION.command" "$DMG_DIR/" 2>/dev/null || true
chmod +x "$DMG_DIR/REPARER_MARION.command" 2>/dev/null || true

# Instructions visibles dans le DMG
cat > "$DMG_DIR/Lisez-moi.txt" <<'TXT'
Marion Web OS — Installation

1. Glisse l'icône « Marion Web OS » sur le dossier « Applications »
2. Ouvre Marion depuis le Launchpad ou Applications
3. Au premier lancement : patiente 2-3 min (installation automatique)
4. En cas d'erreur « serveur n'a pas démarré » : double-clique REPARER_MARION.command
5. Place le fichier .env.local (fourni par Johan) dans :
   ~/Bibliothèque/Application Support/Marion Web OS/

Tes dossiers clients existants sur le Bureau
(« Marion Web OS Database ») sont détectés automatiquement.
TXT

rm -f "$DMG_PATH"
hdiutil create \
    -volname "$VOLUME_NAME" \
    -srcfolder "$DMG_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH" >/dev/null

echo "✅ DMG créé : $DMG_PATH"
echo ""
echo "   👉 Envoie ce fichier à Marion pour installation en 2 clics."
