#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS — Activer git pull (install issue du ZIP sans dossier .git)
# ═══════════════════════════════════════════════════════════════════════════════
# Double-clique ce fichier dans le dossier du projet (à côté de INSTALLER.command).
# Effet : crée .git, lie origin → GitHub, aligne le code sur main, puis « git pull » marchera.
# Ne supprime pas .env.local (ignoré par Git) ni ton dossier « Marion Web OS Database ».

cd "$(dirname "$0")" || exit 1

ORIGIN="${MARION_GIT_ORIGIN:-https://github.com/VilaJo/Marion-Web-OS-v2.git}"
BRANCH="${MARION_GIT_BRANCH:-main}"

SOFT_FAIL=0
for a in "$@"; do
  if [ "$a" = "--installer" ]; then
    SOFT_FAIL=1
  fi
done

if [ "$SOFT_FAIL" -eq 0 ]; then
  clear
fi
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     🦄  Marion — Activer Git (git pull)                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "❌ git n’est pas installé."
  echo "   👉 macOS : xcode-select --install   ou   brew install git"
  exit 1
fi

cleanup_failed_init() {
  if [ -n "${MARION_TMP_GIT_INIT:-}" ]; then
    echo "   ↩️  Annulation du dépôt vide (.git retiré)."
    rm -rf .git
  fi
  unset MARION_TMP_GIT_INIT
}

if [ -d .git ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    echo "✅ Un dépôt Git existe déjà avec « origin »."
    echo ""
    BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "$BRANCH")"
    git remote -v | head -2
    echo ""
    echo "   Tu peux lancer depuis ce dossier :"
    echo "      git fetch origin && git pull"
    exit 0
  fi
  echo "⚠️  Dossier .git sans remote « origin » — ajout du remote..."
  git remote remove origin 2>/dev/null || true
else
  MARION_TMP_GIT_INIT=1
  echo "📁 Initialisation du dépôt Git (branche $BRANCH)…"
  git init -b "$BRANCH" || exit 1
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$ORIGIN" || { cleanup_failed_init; exit 1; }

echo ""
echo "📡 Connexion à GitHub (fetch)…"
if ! git fetch --depth 1 origin "$BRANCH"; then
  cleanup_failed_init
  echo ""
  echo "❌ Fetch impossible (hors ligne, pare-feu ou URL incorrecte)."
  if [ "$SOFT_FAIL" -eq 1 ]; then
    echo "   (Mode installeur : on continue avec les fichiers du ZIP.)"
    exit 0
  fi
  exit 1
fi

unset MARION_TMP_GIT_INIT

echo ""
echo "🔄 Alignement des fichiers sur origin/$BRANCH (comme un clone léger)…"
if ! git reset --hard "origin/$BRANCH"; then
  echo "❌ git reset impossible."
  exit 1
fi

git branch --set-upstream-to="origin/$BRANCH" "$BRANCH" 2>/dev/null || true

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo "✅ C’est bon. Dans ce dossier tu peux maintenant :"
echo "      git pull"
echo ""
echo "   Après un pull avec changements dans l’interface :"
echo "      npm ci   # ou npm install"
echo "      npm run build"
echo ""
echo "   Ou lancer METTRE_A_JOUR.command (gère aussi dépendances + build)."
echo "───────────────────────────────────────────────────────────────────"
echo ""

if [ "$SOFT_FAIL" -eq 0 ]; then
  read -p "Appuie sur Entrée pour fermer…"
fi

exit 0
