#!/bin/bash
# Répare l'environnement Python de Marion après installation .dmg (dépendances manquantes)
set -euo pipefail

SUPPORT="$HOME/Library/Application Support/Marion Web OS"
VENV="$SUPPORT/venv"
APP_CODE="/Applications/Marion Web OS.app/Contents/Resources/app"
REQ="$APP_CODE/.requirements.txt"
LOG="$SUPPORT/logs/marion.log"

mkdir -p "$SUPPORT/logs"

if [ ! -d "$APP_CODE" ]; then
    echo "❌ Marion Web OS.app introuvable dans /Applications"
    exit 1
fi

if [ ! -f "$REQ" ]; then
    echo "❌ .requirements.txt introuvable dans l'app"
    exit 1
fi

if [ ! -x "$VENV/bin/python" ]; then
    echo "📦 Création du venv…"
    python3 -m venv "$VENV"
fi

echo "📥 Installation des dépendances…"
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install -r "$REQ" | tee -a "$LOG"

echo ""
echo "✅ Réparation terminée. Relance Marion Web OS depuis Applications."
