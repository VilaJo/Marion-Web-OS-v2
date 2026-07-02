#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS — CRÉER LE FICHIER D'INSTALLATION (.dmg)
# ═══════════════════════════════════════════════════════════════════════════════
# Pour Johan / développeur : produit MarionWebOS-x.y.z.dmg à envoyer à Marion.

cd "$(dirname "$0")"
ROOT="$(pwd)"

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        🦄  MARION WEB OS — Build release (.dmg)               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Prérequis
echo "📋 Vérification des prérequis…"
echo -n "   Node.js… "
if ! command -v npm >/dev/null 2>&1; then
    echo "❌"
    echo "   Installe Node.js : brew install node"
    read -p "Entrée pour fermer…"
    exit 1
fi
echo "✅ $(node --version)"

echo -n "   Python 3… "
if ! command -v python3 >/dev/null 2>&1; then
    echo "❌"
    echo "   Installe Python : brew install python@3.12"
    read -p "Entrée pour fermer…"
    exit 1
fi
echo "✅ $(python3 --version 2>&1)"

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo ""
echo "🎨 Compilation de l'interface…"
npm run build

echo ""
echo "📦 Construction de l'application…"
chmod +x packaging/*.sh build_app_icon.sh 2>/dev/null || true
bash packaging/build_app_bundle.sh

echo ""
echo "💿 Création du fichier .dmg…"
bash packaging/build_dmg.sh

DMG_FILE="$(ls -1t release/MarionWebOS-*.dmg 2>/dev/null | head -1)"
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        ✨  RELEASE PRÊTE !                                      ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
if [ -n "$DMG_FILE" ]; then
echo "║   📀  $DMG_FILE"
fi
echo "║                                                               ║"
echo "║   👉 Envoie le .dmg à Marion                                  ║"
echo "║   👉 Elle glisse l'app dans Applications et double-clique     ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if [ -n "$DMG_FILE" ]; then
    open -R "$ROOT/$DMG_FILE" 2>/dev/null || true
fi

read -p "Appuie sur Entrée pour fermer…"
