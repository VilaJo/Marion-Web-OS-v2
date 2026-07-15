#!/bin/bash
# Build DMG + dossier prêt à envoyer à Marion sur le Bureau de Johan
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo "2.7.9")"
DESKTOP="$HOME/Desktop"
OUT="$DESKTOP/Marion - Installation"
DMG_SRC="$ROOT/release/MarionWebOS-${VERSION}.dmg"
ENV_SRC="$DESKTOP/MARION-env.local"

echo "🦄 Préparation du package Marion v${VERSION}…"

cd "$ROOT"
npm run build
bash packaging/build_app_bundle.sh
bash packaging/build_dmg.sh

if [ ! -f "$DMG_SRC" ]; then
    echo "❌ DMG introuvable : $DMG_SRC"
    exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"

cp "$DMG_SRC" "$OUT/"
if [ -f "$ENV_SRC" ]; then
    cp "$ENV_SRC" "$OUT/MARION-env.local"
else
    echo "⚠️  $ENV_SRC absent — crée-le sur le Bureau avant d'envoyer à Marion."
fi

cat > "$OUT/LIRE EN PREMIER.txt" <<'TXT'
═══════════════════════════════════════════════════════════════
  MARION WEB OS — Installation (5 minutes)
═══════════════════════════════════════════════════════════════

ÉTAPE 1 — Installer l'application
──────────────────────────────────
1. Double-clique sur MarionWebOS-2.7.9.dmg (ou version dans ce dossier)
2. Glisse « Eonora Tech OS » dans le dossier « Applications »
3. Éjecte le disque Eonora Tech OS

ÉTAPE 2 — Fichier de configuration (obligatoire)
────────────────────────────────────────────────
1. Ouvre le Finder
2. Menu Aller → Aller au dossier… (Cmd+Shift+G)
3. Colle exactement :
   ~/Library/Application Support/Eonora Tech OS
4. Copie le fichier MARION-env.local (de ce dossier) DANS ce dossier
   (remplace l'ancien s'il existe déjà)

ÉTAPE 3 — Lancer Marion
───────────────────────
1. Double-clique sur « Eonora Tech OS » sur ton Bureau
   (ou ouvre l'app depuis Applications si installée via .dmg)
2. Aucune fenêtre Terminal ne s'ouvre — tout tourne en arrière-plan
3. Au premier lancement : attends 2 à 3 minutes (une seule fois)
4. Si macOS demande l'accès au Bureau → Autoriser

Pour arrêter : double-clique STOPPER_EONORA.command dans le dossier projet

ÉTAPE 4 — Tes dossiers clients
──────────────────────────────
Tes clients sont dans le dossier sur ton Bureau :
   Eonora Tech OS Database

L'application le détecte automatiquement. Tu n'as rien à copier.

Si tu ne vois pas tes clients :
→ Vérifie que MARION-env.local est bien dans Application Support
→ Quitte Marion (Cmd+Q) et relance

En cas de problème
──────────────────
Dans le .dmg : double-clique REPARER_EONORA.command
Logs : ~/Library/Application Support/Eonora Tech OS/logs/marion.log

Johan peut t'aider en lisant ce fichier log.
TXT

# Met à jour le numéro de version dans les instructions
sed -i '' "s/2\\.7\\.9/${VERSION}/g" "$OUT/LIRE EN PREMIER.txt" 2>/dev/null || \
    sed -i "s/2\\.7\\.9/${VERSION}/g" "$OUT/LIRE EN PREMIER.txt"

echo ""
echo "✅ Package prêt : $OUT"
echo "   • MarionWebOS-${VERSION}.dmg"
echo "   • MARION-env.local"
echo "   • LIRE EN PREMIER.txt"
echo ""
open "$OUT" 2>/dev/null || true
