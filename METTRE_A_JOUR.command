#!/bin/bash
cd "$(dirname "$0")"

echo "🦄 Recherche de mises à jour pour Marion CRM..."
echo "------------------------------------------------"

# 1. Sauvegarde de la config locale
if [ -f .env.local ]; then
    echo "🔒 Sauvegarde de votre clé API..."
    cp .env.local .env.local.bak
fi

# 2. Téléchargement de la dernière version (depuis la branche main)
echo "⬇️  Téléchargement de la nouvelle version..."

# Liste des URLs potentielles
URLS=(
    "https://github.com/VilaJo/Marion-Web-OS/archive/refs/heads/main.zip"
    "https://github.com/VilaJo/Marion-Web-OS/archive/main.zip"
    "https://github.com/VilaJo/marion-crm-storybook/archive/refs/heads/main.zip"
)

SUCCESS=0

for URL in "${URLS[@]}"; do
    echo "Essai depuis : $URL"
    curl -L -o update.zip "$URL"
    
    # Vérification si c'est un ZIP valide (en testant l'intégrité)
    if unzip -t update.zip > /dev/null 2>&1; then
        echo "✅ Téléchargement réussi."
        SUCCESS=1
        break
    else
        echo "⚠️ Echec. Fichier invalide."
    fi
done

if [ $SUCCESS -eq 0 ]; then
    echo "❌ ERREUR CRITIQUE : Impossible de télécharger la mise à jour."
    echo "Le fichier téléchargé n'est pas un ZIP valide. Contenu :"
    head -n 5 update.zip
    rm update.zip
    exit 1
fi

# 3. Décompression et Installation
echo "📦 Installation de la mise à jour..."
unzip -q -o update.zip

# Trouver le dossier dézippé (quel que soit son nom)
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "Marion-Web-OS-*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "❌ Erreur : Impossible de trouver le dossier de mise à jour."
    exit 1
fi

echo "📂 Dossier trouvé : $EXTRACTED_DIR"

# Copier le contenu du dossier dézippé vers le dossier courant
cp -R "$EXTRACTED_DIR"/* .

# Nettoyage
rm -rf "$EXTRACTED_DIR"
rm update.zip

# Rendre les scripts exécutables pour la prochaine fois
chmod +x *.command

# 4. Restauration de la config
if [ -f .env.local.bak ]; then
    mv .env.local.bak .env.local
    echo "✅ Clé API restaurée."
fi

# 5. Mise à jour des dépendances (si nécessaire)
echo "🧠 Mise à jour du Cerveau (Python)..."
if [ -d ".venv" ]; then
    source .venv/bin/activate
    pip install -r .requirements.txt
else
    echo "⚠️ Pas d'environnement virtuel trouvé. Tentative d'installation globale..."
    pip3 install -r .requirements.txt
fi

echo "🎨 Mise à jour de l'Interface..."
if command -v npm >/dev/null 2>&1; then
    echo "📦 Installation des paquets Node..."
    npm install
    
    echo "🏗️ Construction de l'application..."
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ ERREUR CRITIQUE : La construction de l'interface a échoué."
        echo "L'application risque de ne pas fonctionner."
        read -p "Appuyez sur Entrée pour voir les détails..."
    fi
    
    if [ ! -f ".dist/index.html" ]; then
        echo "⚠️ ATTENTION : Le fichier index.html est manquant dans .dist/"
        echo "Cela provoquera une erreur 'Not Found'."
    fi
else
    echo "❌ Node.js (npm) n'est pas trouvé. Impossible de mettre à jour l'interface."
fi

echo "------------------------------------------------"
echo "✨ Mise à jour terminée avec succès !"
echo "👉 Vous pouvez relancer 'LANCER_MARION.command'"
echo "------------------------------------------------"
read -p "Appuyez sur Entrée pour fermer..."
