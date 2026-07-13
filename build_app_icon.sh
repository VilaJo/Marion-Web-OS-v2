#!/bin/bash
# Generate macOS AppIcon.icns from public/logo-eonora.png
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGO="$APP_DIR/public/logo-eonora.png"
ICONSET="$APP_DIR/.build/AppIcon.iconset"
ICNS_OUT="$APP_DIR/public/icons/AppIcon.icns"

if [ ! -f "$LOGO" ]; then
    echo "❌ Logo introuvable : $LOGO"
    exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
    echo "❌ iconutil introuvable (macOS requis)."
    exit 1
fi

mkdir -p "$APP_DIR/.build" "$APP_DIR/public/icons"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

python3 << PY
from PIL import Image
import os

logo_path = "$LOGO"
iconset = "$ICONSET"

original = Image.open(logo_path).convert("RGBA")
sizes = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}

for name, size in sizes.items():
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target = int(size * 0.85)
    logo = original.copy()
    ratio = min(target / logo.width, target / logo.height)
    new_w = int(logo.width * ratio)
    new_h = int(logo.height * ratio)
    logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(logo, (x, y), logo)
    canvas.save(os.path.join(iconset, name), "PNG")
PY

iconutil -c icns "$ICONSET" -o "$ICNS_OUT"
rm -rf "$ICONSET"
echo "✅ AppIcon.icns généré : $ICNS_OUT"
