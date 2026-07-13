#!/bin/bash
# Regenerate AppIcon.icns, update ~/Desktop/Eonora Tech OS.app, and set this folder's icon
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_APP="$HOME/Desktop/Eonora Tech OS.app"
ICNS_SRC="$APP_DIR/public/icons/AppIcon.icns"
LOGO_SRC="$APP_DIR/public/logo-eonora.png"

set_macos_folder_icon() {
    local folder="$1"
    local image="$2"

    if [ ! -f "$image" ]; then
        echo "❌ Image introuvable : $image"
        return 1
    fi

    if command -v fileicon >/dev/null 2>&1; then
        fileicon set "$folder" "$image"
        return 0
    fi

    if command -v npx >/dev/null 2>&1; then
        npx --yes fileicon set "$folder" "$image"
        return 0
    fi

    echo "❌ fileicon introuvable (brew install fileicon ou Node.js requis)."
    return 1
}

bash "$APP_DIR/build_app_icon.sh"

if [ -d "$DESKTOP_APP" ]; then
    mkdir -p "$DESKTOP_APP/Contents/Resources"
    cp "$ICNS_SRC" "$DESKTOP_APP/Contents/Resources/AppIcon.icns"
    rm -f "$DESKTOP_APP/Contents/Resources/AppIcon.png"
    touch "$DESKTOP_APP"
    echo "✅ Icône Bureau mise à jour : $DESKTOP_APP"
else
    echo "ℹ️  Pas d'app sur le Bureau — icône générée dans public/icons/AppIcon.icns"
fi

set_macos_folder_icon "$APP_DIR" "$LOGO_SRC"
echo "✅ Icône dossier projet mise à jour : $APP_DIR"

killall Dock 2>/dev/null || true
