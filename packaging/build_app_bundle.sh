#!/bin/bash
# Build Eonora Tech OS.app for distribution (payload inside bundle)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING="$ROOT/release/staging"
APP_NAME="Eonora Tech OS"
APP_BUNDLE="$STAGING/${APP_NAME}.app"
PAYLOAD="$APP_BUNDLE/Contents/Resources/app"
VERSION="$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo "2.7.0")"

echo "📦 Construction de ${APP_NAME}.app (v${VERSION})…"

if [ ! -f "$ROOT/.dist/index.html" ]; then
    echo "❌ .dist/index.html introuvable — lance d'abord : npm run build"
    exit 1
fi

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources" "$PAYLOAD"

# --- Payload applicatif (backend + UI compilée) ---
copy_dir() {
    local name="$1"
    if [ -d "$ROOT/$name" ]; then
        rsync -a --exclude '__pycache__' --exclude '*.pyc' "$ROOT/$name/" "$PAYLOAD/$name/"
    fi
}

copy_dir api
copy_dir database
copy_dir services
copy_dir .dist

mkdir -p "$PAYLOAD/static/portal_uploads"
cp "$ROOT/franck_server.py" "$ROOT/config.py" "$ROOT/crypto_utils.py" "$PAYLOAD/"
cp "$ROOT/.requirements.txt" "$PAYLOAD/"
cp "$ROOT/.env.example" "$PAYLOAD/" 2>/dev/null || true

# --- Info.plist ---
cat > "$APP_BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Marion</string>
    <key>CFBundleIdentifier</key>
    <string>ch.jvautomation.marion-web-os</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
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
    <key>LSArchitecturePriority</key>
    <array>
        <string>arm64</string>
        <string>x86_64</string>
    </array>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# --- Lanceur (répond vite) + worker (démarrage long en arrière-plan) ---
cp "$ROOT/packaging/launcher.sh" "$APP_BUNDLE/Contents/MacOS/Marion"
cp "$ROOT/packaging/marion-worker.sh" "$APP_BUNDLE/Contents/MacOS/marion-worker.sh"
chmod +x "$APP_BUNDLE/Contents/MacOS/Marion" "$APP_BUNDLE/Contents/MacOS/marion-worker.sh"

# --- Icône ---
if [ -f "$ROOT/build_app_icon.sh" ]; then
    bash "$ROOT/build_app_icon.sh"
fi
if [ -f "$ROOT/public/icons/AppIcon.icns" ]; then
    cp "$ROOT/public/icons/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
fi

echo "✅ Bundle prêt : $APP_BUNDLE"
