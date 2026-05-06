#!/bin/bash
cd "$(dirname "$0")"

echo "🦄 Mise à jour Marion Web OS"
echo "────────────────────────────────────────────────────────────────────"

UPDATED_VIA_GIT=0

# ──────────────────────────────────────────────────────────────────────────
# 0. Si c'est un clone Git → pull depuis le remote (évite « rien ne change » avec seulement ZIP)
# ──────────────────────────────────────────────────────────────────────────
if [ -d ".git" ]; then
    echo ""
    echo "📂 Clone Git détecté."
    if ! command -v git >/dev/null 2>&1; then
        echo "⚠️  git absent du PATH → on passe au téléchargement ZIP."
    else
        BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
        echo "    Branche : $BRANCH"
        REMOTE="$(git remote get-url origin 2>/dev/null || true)"
        if [ -z "$REMOTE" ]; then
            echo "⚠️  Pas de remote « origin » → impossible de tirer depuis GitHub."
            echo "    Configure : git remote add origin <url-du-depot>"
        else
            echo "    Origin   : $REMOTE"
            git fetch origin 2>/dev/null || true
            if git pull --ff-only 2>/dev/null || git pull 2>/dev/null; then
                echo "✅ git pull terminé."
                UPDATED_VIA_GIT=1
            else
                echo "⚠️  git pull a échoué (conflits, hors ligne…) → téléchargement ZIP ci-dessous."
            fi
        fi
    fi
fi

if [ "$UPDATED_VIA_GIT" -eq 0 ]; then

    if [ ! -d .git ]; then
        echo ""
        echo "💡 Pas de dépôt Git (souvent après un ZIP). Pour activer « git pull » : lance une fois ACTIVER_GIT.command."
    fi

# 1. Sauvegarde de la config locale
if [ -f .env.local ]; then
    echo "🔒 Sauvegarde de votre fichier local..."
    cp .env.local .env.local.bak
fi

# 2. Téléchargement (ZIP) — même logique que l’historique Marion
echo ""
echo "⬇️  Téléchargement de la version GitHub (branche main)…"

URLS=(
    "https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/heads/main.zip"
    "https://github.com/VilaJo/Marion-Web-OS-v2/archive/main.zip"
)

SUCCESS=0

for URL in "${URLS[@]}"; do
    echo "    Essai : $URL"
    curl -L -o update.zip "$URL"

    if unzip -t update.zip >/dev/null 2>&1; then
        echo "✅ ZIP valide."
        SUCCESS=1
        break
    else
        echo "⚠️  ZIP invalide, autre URL…"
    fi
done

if [ $SUCCESS -eq 0 ]; then
    echo "❌ Impossible de télécharger une mise à jour (ZIP)."
    head -n 5 update.zip 2>/dev/null || true
    rm -f update.zip
    exit 1
fi

echo "📦 Décompression…"
unzip -q -o update.zip

EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "Marion-Web-OS-v2-*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "❌ Dossier décompressé introuvable."
    rm -f update.zip
    exit 1
fi

echo "📂 Fusion dans le dossier actuel depuis : $EXTRACTED_DIR"
cp -R "$EXTRACTED_DIR"/* .
rm -rf "$EXTRACTED_DIR"
rm -f update.zip

if [ -f .env.local.bak ]; then
    mv .env.local.bak .env.local
    echo "✅ .env.local restauré."
fi

fi # fin branche ZIP

# ──────────────────────────────────────────────────────────────────────────
# Toujours faire : deps + build UI (sans ça « git pull » ne change pas l’écran !)
# ──────────────────────────────────────────────────────────────────────────

chmod +x *.command 2>/dev/null || true

echo ""
echo "🧠 Dépendances Python…"
if [ -d ".venv" ]; then
    # shellcheck source=/dev/null
    source .venv/bin/activate
    pip install -r .requirements.txt
else
    echo "⚠️  Pas de .venv — lance INSTALLER.command une fois."
    pip3 install -r .requirements.txt 2>/dev/null || true
fi

echo ""
echo "🎨 Interface (obligatoire pour voir les changements après pull) …"
if command -v npm >/dev/null 2>&1; then
    npm install
    npm run build
    if [ ! -f ".dist/index.html" ]; then
        echo "❌ Pas de .dist/index.html après le build — l’interface ne pourra pas s’afficher."
    fi
else
    echo "❌ npm introuvable — installe Node.js puis relance ce script."
fi

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "✨ Mise à jour terminée."
echo ""
echo "👉 IMPORTANT : si Marion tournait déjà, STOPPER puis LANCER (ou fermer puis rouvrir l’app),"
echo "   puis dans Safari/Chrome : rechargement forcé (Cmd + Shift + R)."
echo "────────────────────────────────────────────────────────────────────"
read -p "Appuie sur Entrée pour fermer…"
