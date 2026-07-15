#!/bin/bash
# Crée ou met à jour l'icône Bureau Eonora Tech OS.app (double-clic, sans Terminal)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="${1:-$ROOT}"
VERSION="$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo "2.8.0")"
DESKTOP_APP="$HOME/Desktop/Eonora Tech OS.app"
LEGACY_APP="$HOME/Desktop/Marion Web OS.app"
ICNS_SRC="$ROOT/public/icons/AppIcon.icns"

if [ ! -f "$PROJECT_DIR/franck_server.py" ]; then
    echo "❌ Dossier projet invalide : $PROJECT_DIR"
    exit 1
fi

echo "🖥️  Mise à jour de l'app Bureau (sans console)…"
echo "    Projet : $PROJECT_DIR"

mkdir -p "$DESKTOP_APP/Contents/MacOS" "$DESKTOP_APP/Contents/Resources"

cat > "$DESKTOP_APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Eonora</string>
    <key>CFBundleIdentifier</key>
    <string>ch.jvautomation.eonora-tech-os</string>
    <key>CFBundleName</key>
    <string>Eonora Tech OS</string>
    <key>CFBundleDisplayName</key>
    <string>Eonora Tech OS</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

printf '%s\n' "$PROJECT_DIR" > "$DESKTOP_APP/Contents/Resources/project_path"

cp "$ROOT/packaging/folder_launcher.sh" "$DESKTOP_APP/Contents/MacOS/Eonora"
cp "$ROOT/packaging/folder_worker.sh" "$DESKTOP_APP/Contents/MacOS/folder-worker.sh"
chmod +x "$DESKTOP_APP/Contents/MacOS/Eonora" "$DESKTOP_APP/Contents/MacOS/folder-worker.sh"

if [ -f "$ICNS_SRC" ]; then
    cp "$ICNS_SRC" "$DESKTOP_APP/Contents/Resources/AppIcon.icns"
elif [ -f "$ROOT/build_app_icon.sh" ]; then
    bash "$ROOT/build_app_icon.sh"
    cp "$ICNS_SRC" "$DESKTOP_APP/Contents/Resources/AppIcon.icns"
fi

xattr -dr com.apple.quarantine "$DESKTOP_APP" 2>/dev/null || true
touch "$DESKTOP_APP"

# Retirer l'ancienne app « Marion Web OS » qui ouvrait Terminal
if [ -d "$LEGACY_APP" ]; then
    rm -rf "$LEGACY_APP"
    echo "🧹 Ancienne Marion Web OS.app supprimée (ouvrait Terminal)."
fi

echo "✅ Double-clique sur : $DESKTOP_APP"
echo "   (aucune fenêtre Terminal — logs dans $PROJECT_DIR/.marion.log)"
