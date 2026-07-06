#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS - INSTALLATEUR
# ═══════════════════════════════════════════════════════════════════════════════

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

# Node.js
echo -n "   📦 Node.js... "
if command -v npm &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    echo "✅ Node $NODE_VERSION"
else
    echo "❌ Non trouvé"
    echo ""
    echo "   👉 Installe Node.js avec: brew install node"
    echo "   👉 Ou télécharge depuis: https://nodejs.org/"
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

echo "   📥 Installation des paquets npm..."
npm install --silent 2>/dev/null

if [ $? -ne 0 ]; then
    echo "   ❌ Erreur lors de l'installation npm"
    read -p "   Appuie sur Entrée..."
    exit 1
fi

echo "   🏗️  Construction de l'application..."
npm run build --silent 2>/dev/null

if [ $? -ne 0 ]; then
    echo "   ⚠️  Build avec warnings (normal)"
fi
echo "   ✅ Interface installée !"

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Création de l'application .app pour le Bureau
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🖥️  Création de l'application Bureau..."
echo ""

DESKTOP_PATH="$HOME/Desktop"
APP_BUNDLE="$DESKTOP_PATH/Marion Web OS.app"

# Supprimer l'ancienne version si elle existe
if [ -d "$APP_BUNDLE" ]; then
    echo "   🧹 Suppression de l'ancienne version..."
    rm -rf "$APP_BUNDLE"
fi

# Créer la structure du bundle
echo "   📁 Création du bundle .app..."
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>ch.jvautomation.marion-web-os</string>
    <key>CFBundleName</key>
    <string>Marion Web OS</string>
    <key>CFBundleDisplayName</key>
    <string>Marion Web OS</string>
    <key>CFBundleVersion</key>
    <string>2.7.2</string>
    <key>CFBundleShortVersionString</key>
    <string>2.7.2</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# Script de lancement (utilise le chemin complet vers python)
cat > "$APP_BUNDLE/Contents/MacOS/launcher" << LAUNCHER
#!/bin/bash
# Marion Web OS Launcher - Fixed for double-click

APP_PATH="$APP_DIR"
LOG_FILE="\$APP_PATH/.marion.log"
PID_FILE="\$APP_PATH/.marion.pid"
PYTHON_PATH="\$APP_PATH/.venv/bin/python"

cd "\$APP_PATH" || exit 1

echo "=== Marion Web OS Launch - \$(date) ===" >> "\$LOG_FILE"

is_server_running() {
    if [ -f "\$PID_FILE" ]; then
        PID=\$(cat "\$PID_FILE")
        if ps -p "\$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    if lsof -i :5003 > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

wait_for_server() {
    for i in {1..45}; do
        if curl -s http://127.0.0.1:5003/api/v1/version > /dev/null 2>&1; then
            echo "Server ready after \${i}s" >> "\$LOG_FILE"
            return 0
        fi
        sleep 1
    done
    return 1
}

if ! is_server_running; then
    echo "Starting server..." >> "\$LOG_FILE"
    
    if [ ! -f "\$PYTHON_PATH" ]; then
        osascript -e 'display alert "Marion Web OS" message "L'\''environnement Python n'\''est pas installé.\n\nLancez INSTALLER.command d'\''abord." as critical'
        exit 1
    fi
    
    "\$PYTHON_PATH" "\$APP_PATH/franck_server.py" >> "\$LOG_FILE" 2>&1 &
    echo \$! > "\$PID_FILE"
    
    if ! wait_for_server; then
        osascript -e 'display alert "Marion Web OS" message "Le serveur n'\''a pas pu démarrer.\n\nVérifiez les logs: .marion.log" as critical'
        exit 1
    fi
fi

open "http://127.0.0.1:5003"
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

# Icône .app + dossier projet (logo actuel)
if [ -f "$APP_DIR/refresh_desktop_app_icon.sh" ]; then
    bash "$APP_DIR/refresh_desktop_app_icon.sh"
fi

echo "   ✅ Application créée sur le Bureau !"

echo ""
echo "───────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 4b. Dossier données sur le Bureau (sans DATA_PATH dans .env.local =
#       identique au défaut dans config.py — toujours TON utilisateur macOS.)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "💾 Dossiers clients + SQLite : emplacement PAR DÉFAUT sur ce Mac :"
DATA_ROOT="$HOME/Desktop/Marion Web OS Database"
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
echo "║   🖥️  Une icône 'Marion Web OS' a été créée sur ton Bureau    ║"
echo "║                                                               ║"
echo "║   👉 Double-clique dessus pour lancer l'application !         ║"
echo "║                                                               ║"
echo "║   📥 Mise à jour : git pull — ou METTRE_A_JOUR.command        ║"
echo "║      ACTIVER_GIT.command si pas de dossier .git              ║"
echo "║                                                               ║"
echo "║   🗂️  Réinstall : garde seul sur le Bureau le dossier         ║"
echo "║      « Marion Web OS Database » ; supprime le dossier code   ║"
echo "║      et Marion Web OS.app puis retélécharge. Lire alors       ║"
echo "║      REINSTALLATION_PROPURE.txt dans le projet.               ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
read -p "Appuie sur Entrée pour fermer..."
