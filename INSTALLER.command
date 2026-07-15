#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS - INSTALLATEUR
# ═══════════════════════════════════════════════════════════════════════════════
if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
  export MARION_CLEAN_SHELL=1
  exec /bin/bash --noprofile --norc "$0" "$@"
fi
set -euo pipefail

cd "$(dirname "$0")"
APP_DIR="$(pwd)"

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║        🦄  MARION WEB OS - Installation                       ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Vérification des prérequis
# ─────────────────────────────────────────────────────────────────────────────
echo "📋 Vérification des prérequis..."
echo ""

# Python
echo -n "   🐍 Python 3... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo "✅ $PYTHON_VERSION"
else
    echo "❌ Non trouvé"
    echo ""
    echo "   👉 Installe Python avec: brew install python3"
    echo "   👉 Ou télécharge depuis: https://www.python.org/downloads/"
    read -p "   Appuie sur Entrée pour quitter..."
    exit 1
fi

# Node.js — optionnel si .dist est déjà inclus (install Marion sans dev)
NEEDS_NPM_BUILD=1
# shellcheck source=packaging/verify_dist.sh
if [ -f "$APP_DIR/packaging/verify_dist.sh" ]; then
    # shellcheck disable=SC1091
    source "$APP_DIR/packaging/verify_dist.sh"
    if verify_dist_integrity "$APP_DIR" 2>/dev/null; then
        NEEDS_NPM_BUILD=0
    fi
fi

echo -n "   📦 Node.js... "
if command -v npm &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    if [ "$NEEDS_NPM_BUILD" -eq 0 ]; then
        echo "✅ Node $NODE_VERSION (optionnel — .dist déjà prêt)"
    else
        echo "✅ Node $NODE_VERSION"
    fi
elif [ "$NEEDS_NPM_BUILD" -eq 0 ]; then
    echo "⚪ absent (OK — interface pré-compilée)"
else
    echo "❌ Non trouvé"
    echo ""
    echo "   👉 Installe Node.js avec: brew install node"
    echo "   👉 Ou lance METTRE_A_JOUR.command pour récupérer .dist depuis GitHub"
    read -p "   Appuie sur Entrée pour quitter..."
    exit 1
fi

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 1b. Git — pour que « git pull » fonctionne (ZIP GitHub sans dossier .git)
# ─────────────────────────────────────────────────────────────────────────────
if [ -f "$APP_DIR/ACTIVER_GIT.command" ]; then
  echo ""
  echo "🔗 Liaison GitHub (optionnel : mises à jour avec git pull)…"
  bash "$APP_DIR/ACTIVER_GIT.command" --installer
  echo ""
  echo "───────────────────────────────────────────────────────────────────"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Installation Backend Python
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🧠 Installation du Cerveau (Python)..."
echo ""

if [ -d ".venv" ]; then
    echo "   🧹 Nettoyage de l'ancien environnement..."
    rm -rf .venv
fi

echo "   📁 Création de l'environnement virtuel..."
python3 -m venv .venv

echo "   📥 Installation des dépendances..."
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r .requirements.txt -q

if [ $? -ne 0 ]; then
    echo "   ❌ Erreur lors de l'installation Python"
    read -p "   Appuie sur Entrée..."
    exit 1
fi
echo "   ✅ Backend installé !"

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Installation Frontend React
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🎨 Installation de l'Interface (React)..."
echo ""

if [ "$NEEDS_NPM_BUILD" -eq 0 ]; then
    echo "   ✅ .dist déjà inclus — pas de build npm (évite écran blanc après mise à jour)"
elif command -v npm &> /dev/null; then
    echo "   📥 Installation des paquets npm..."
    npm install --silent 2>/dev/null

    if [ $? -ne 0 ]; then
        echo "   ❌ Erreur lors de l'installation npm"
        read -p "   Appuie sur Entrée..."
        exit 1
    fi

    echo "   🏗️  Construction de l'application..."
    npm run build --silent 2>/dev/null

    if ! verify_dist_integrity "$APP_DIR" 2>/dev/null; then
        echo "   ⚠️  Build npm incomplet — restauration .dist depuis GitHub…"
        download_dist_from_github "$APP_DIR" || true
    fi
    echo "   ✅ Interface installée !"
else
    echo "   ❌ Pas de .dist valide et pas de npm."
    echo "   👉 Lance METTRE_A_JOUR.command ou REPARER_INTERFACE.command"
    read -p "   Appuie sur Entrée..."
    exit 1
fi

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Création de l'application .app pour le Bureau (sans Terminal)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🖥️  Création de l'application Bureau (double-clic, sans console)..."
echo ""

bash "$APP_DIR/packaging/install_desktop_app.sh" "$APP_DIR"

echo "   ✅ Application créée sur le Bureau !"

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 4b. Dossier données sur le Bureau (sans DATA_PATH dans .env.local =
#       identique au défaut dans config.py — toujours TON utilisateur macOS.)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "💾 Dossiers clients + SQLite : emplacement PAR DÉFAUT sur ce Mac :"
DATA_ROOT="$HOME/Desktop/Eonora Tech OS Database"
echo "    $DATA_ROOT"
if mkdir -p "$DATA_ROOT" 2>/dev/null; then
    echo "   ✅ Ce dossier sur le Bureau est prêt — garde-le seul lors d'une réinstallation."
else
    echo "   ⚠️  Impossible de créer ce dossier (permissions ?)."
fi

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Configuration (optionnel)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔑 Configuration..."
echo ""

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "   ⚠️  Fichier .env non trouvé"
        echo "   📝 Copie .env.example vers .env et configure tes credentials Google"
        cp .env.example .env
    fi
fi

if [ -f ".env" ]; then
    echo "   ✅ Configuration trouvée"
else
    echo "   ⚠️  Configure le fichier .env avec tes credentials Google"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. Terminé !
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║        ✨  INSTALLATION TERMINÉE !                            ║"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║   🖥️  Une icône 'Eonora Tech OS' a été créée sur ton Bureau    ║"
echo "║                                                               ║"
echo "║   👉 Double-clique dessus pour lancer l'application !         ║"
echo "║                                                               ║"
echo "║   📥 Mise à jour : git pull — ou METTRE_A_JOUR.command        ║"
echo "║      ACTIVER_GIT.command si pas de dossier .git              ║"
echo "║                                                               ║"
echo "║   🗂️  Réinstall : garde seul sur le Bureau le dossier         ║"
echo "║      « Eonora Tech OS Database » ; supprime le dossier code   ║"
echo "║      et Eonora Tech OS.app puis retélécharge. Lire alors       ║"
echo "║      REINSTALLATION_PROPURE.txt dans le projet.               ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
read -p "Appuie sur Entrée pour fermer..."
