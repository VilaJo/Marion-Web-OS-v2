#!/bin/bash
cd "$(dirname "$0")"

echo "🦄 Installation de Marion Web OS..."
echo "-----------------------------------"

# 1. Vérifier Python
echo "🔍 Vérification de Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas trouvé."
    echo "👉 Veuillez suivre les instructions du README.md (Section Prérequis) pour l'installer via le Terminal."
    read -p "Appuyez sur Entrée pour quitter..."
    exit 1
fi

# 2. Vérifier Node.js
echo "🔍 Vérification de Node.js..."
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js n'est pas trouvé."
    echo "👉 Veuillez suivre les instructions du README.md (Section Prérequis) pour l'installer via le Terminal."
    read -p "Appuyez sur Entrée pour quitter..."
    exit 1
fi

# 3. Backend Python
echo "📦 Installation du Cerveau (Python)..."
if [ -d ".venv" ]; then
    echo "   🧹 Nettoyage de l'ancien environnement..."
    rm -rf .venv
fi
python3 -m venv .venv
source .venv/bin/activate
pip install -r .requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances Python."
    read -p "Appuyez sur Entrée..."
    exit 1
fi

# 4. Frontend React
echo "🎨 Installation de l'Interface (React)..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances React."
    read -p "Appuyez sur Entrée..."
    exit 1
fi

echo "🏗️  Construction de l'application..."
npm run build

# 5. Configuration Clé API
if [ ! -f .env.local ]; then
    echo "----------------------------------------"
    echo "🔑 Configuration de l'IA"
    echo "Entrez votre clé API Gemini (AIza...):"
    read API_KEY
    echo "GEMINI_API_KEY=$API_KEY" > .env.local
    echo "✅ Clé enregistrée !"
else
    echo "✅ Configuration existante trouvée."
fi

echo "----------------------------------------"
echo "✨ Installation terminée avec succès !"
echo "👉 Vous pouvez maintenant double-cliquer sur 'LANCER_MARION.command'"
echo "----------------------------------------"
read -p "Appuyez sur Entrée pour fermer..."
