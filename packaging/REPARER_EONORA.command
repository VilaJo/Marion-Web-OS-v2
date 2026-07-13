#!/bin/bash
# Réparation complète — supprime le venv cassé et réinstalle pour la bonne architecture Mac
set -euo pipefail

SUPPORT="$HOME/Library/Application Support/Eonora Tech OS"
VENV="$SUPPORT/venv"
APP_CODE="/Applications/Eonora Tech OS.app/Contents/Resources/app"
REQ="$APP_CODE/.requirements.txt"
LOG="$SUPPORT/logs/marion.log"
HOST_ARCH="$(uname -m)"

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     Eonora Tech OS — Réparation Python                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Architecture détectée : $HOST_ARCH"
echo ""

mkdir -p "$SUPPORT/logs"

if [ ! -d "$APP_CODE" ]; then
    echo "❌ Eonora Tech OS.app introuvable dans /Applications"
    read -p "Entrée pour fermer…"
    exit 1
fi

xattr -dr com.apple.quarantine "/Applications/Eonora Tech OS.app" 2>/dev/null || true

echo "🧹 Suppression de l'ancien environnement Python…"
rm -rf "$VENV"

pick_python() {
    local py arch
    for py in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
        [ -x "$py" ] || continue
        arch="$("$py" -c "import platform; print(platform.machine())" 2>/dev/null || echo "")"
        if [ "$arch" = "$HOST_ARCH" ]; then
            echo "$py"
            return 0
        fi
    done
    command -v python3
}

PYTHON_BIN="$(pick_python)"
echo "🐍 Python utilisé : $PYTHON_BIN"
"$PYTHON_BIN" --version

echo "📦 Création du nouvel environnement…"
"$PYTHON_BIN" -m venv "$VENV"

echo "📥 Installation des dépendances (2-3 min)…"
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install --no-cache-dir -r "$REQ" 2>&1 | tee -a "$LOG"

echo ""
echo "🔍 Vérification…"
"$VENV/bin/python" -c "import flask; from cryptography.fernet import Fernet; print('OK')"

echo ""
echo "✅ Réparation terminée !"
echo "👉 Relance Eonora Tech OS depuis Applications."
echo ""
echo "Sur Mac Apple Silicon : vérifie que « Ouvrir avec Rosetta »"
echo "est DÉCOCHÉ (clic droit sur l'app → Lire les informations)."
echo ""
read -p "Entrée pour fermer…"
