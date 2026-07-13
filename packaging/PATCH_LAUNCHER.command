#!/bin/bash
# Corrige le lanceur Marion installé (mauvaise URL de santé serveur)
set -euo pipefail

LAUNCHER="/Applications/Eonora Tech OS.app/Contents/MacOS/Marion"

if [ ! -f "$LAUNCHER" ]; then
    echo "❌ Eonora Tech OS.app introuvable dans /Applications"
    exit 1
fi

if grep -q '/api/v1/version' "$LAUNCHER"; then
    echo "✅ Lanceur déjà corrigé."
    exit 0
fi

cp "$LAUNCHER" "${LAUNCHER}.bak"
sed -i '' 's|/api/version|/api/v1/version|g' "$LAUNCHER"
echo "✅ Lanceur corrigé. Relance Eonora Tech OS depuis Applications."
