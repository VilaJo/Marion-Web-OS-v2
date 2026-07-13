#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS — Mise à jour (GitHub main)
# ═══════════════════════════════════════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
  export MARION_CLEAN_SHELL=1
  exec /bin/bash --noprofile --norc "$SCRIPT_PATH" "$@"
fi

cd "$SCRIPT_DIR"
APP_DIR="$(pwd)"

# shellcheck source=packaging/verify_dist.sh
source "$APP_DIR/packaging/verify_dist.sh"

command -v clear >/dev/null 2>&1 && clear || true
echo "🦄 Mise à jour Eonora Tech OS"
echo "────────────────────────────────────────────────────────────────────"
echo "📁 $APP_DIR"
echo ""

UPDATED_VIA_GIT=0

write_installed_stamp() {
    if [ -f BUILD_STAMP.json ]; then
        cp BUILD_STAMP.json .marion_installed.json
        echo "✅ Empreinte install : $(grep -o '"commit": *"[^"]*"' BUILD_STAMP.json | head -1)"
        return
    fi
    if command -v git >/dev/null 2>&1 && [ -d .git ]; then
        COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"
        if [ -n "$COMMIT" ]; then
            printf '{\n  "commit": "%s",\n  "updatedAt": "%s"\n}\n' "$COMMIT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .marion_installed.json
            echo "✅ Empreinte install : ${COMMIT:0:7}"
        fi
    fi
}

select_python() {
    for candidate in /usr/bin/python3 python3.12 python3.11 python3; do
        command -v "$candidate" >/dev/null 2>&1 || continue
        echo "$candidate"
        return 0
    done
    return 1
}

# ── 0. Git pull si dépôt présent ─────────────────────────────────────────────
if [ -d .git ] && command -v git >/dev/null 2>&1; then
    echo "📂 Clone Git — synchronisation origin/main…"
    git fetch origin 2>/dev/null || true
    if git pull --ff-only origin main 2>/dev/null || git pull --ff-only 2>/dev/null || git pull 2>/dev/null; then
        echo "✅ git pull terminé."
        UPDATED_VIA_GIT=1
    else
        echo "⚠️  git pull échoué → téléchargement ZIP GitHub."
    fi
fi

# ── 1. ZIP GitHub main (installs sans .git, ex. Marion) ───────────────────
if [ "$UPDATED_VIA_GIT" -eq 0 ]; then
    if [ ! -d .git ]; then
        echo "💡 Pas de .git — mise à jour via ZIP GitHub (branche main)."
    fi

    if [ -f .env.local ]; then
        echo "🔒 Sauvegarde .env.local…"
        cp .env.local .env.local.bak
    fi

    echo ""
    echo "⬇️  Téléchargement GitHub (main)…"
    URLS=(
        "https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/heads/main.zip"
        "https://github.com/VilaJo/Marion-Web-OS-v2/archive/main.zip"
    )
    SUCCESS=0
    for URL in "${URLS[@]}"; do
        echo "    $URL"
        if curl -fsSL -o update.zip "$URL" && unzip -t update.zip >/dev/null 2>&1; then
            SUCCESS=1
            break
        fi
        echo "    ⚠️  échec, essai suivant…"
    done

    if [ "$SUCCESS" -eq 0 ]; then
        echo "❌ Impossible de télécharger la mise à jour."
        rm -f update.zip
        read -r -p "Appuie sur Entrée…"
        exit 1
    fi

    echo "📦 Décompression…"
    unzip -q -o update.zip
    EXTRACTED_DIR="$(find . -maxdepth 1 -type d -name 'Marion-Web-OS-v2-*' | head -n 1)"
    if [ -z "$EXTRACTED_DIR" ]; then
        echo "❌ Dossier extrait introuvable."
        rm -f update.zip
        exit 1
    fi

    echo "📂 Fusion (code + .dist) depuis $EXTRACTED_DIR"
    rsync -a --delete \
        --exclude '.env.local' --exclude '.venv' --exclude '.marion.log' --exclude '.marion.pid' \
        --exclude 'Eonora Tech OS Database' --exclude '.marion_installed.json' \
        --exclude 'node_modules' \
        "$EXTRACTED_DIR"/ ./
    rm -rf "$EXTRACTED_DIR" update.zip

    if [ -f .env.local.bak ]; then
        mv .env.local.bak .env.local
        echo "✅ .env.local restauré."
    fi
fi

# ── 2. Vérifier / réparer l'interface (.dist) ───────────────────────────────
echo ""
echo "🎨 Vérification interface…"
if ! verify_dist_integrity "$APP_DIR"; then
    echo "⚠️  Interface incohérente — restauration .dist depuis GitHub…"
    if ! download_dist_from_github "$APP_DIR"; then
        echo "❌ Impossible de réparer .dist"
        read -r -p "Appuie sur Entrée…"
        exit 1
    fi
fi

# ── 3. Dépendances Python ───────────────────────────────────────────────────
chmod +x "$APP_DIR"/*.command 2>/dev/null || true

echo ""
echo "🧠 Dépendances Python…"
PYTHON_CMD="$(select_python || true)"
if [ -n "$PYTHON_CMD" ] && [ -x ".venv/bin/pip" ]; then
    .venv/bin/pip install -q -r .requirements.txt || echo "⚠️  pip install partiel"
elif [ -n "$PYTHON_CMD" ]; then
    echo "⚠️  Pas de .venv — lance INSTALLER.command si besoin."
else
    echo "⚠️  Python introuvable."
fi

# ── 4. Ne jamais rebuild npm si .dist est valide (évite écran blanc) ────────
echo ""
echo "🎨 Interface : .dist prêt (pas de npm build — utilise GitHub)"

# ── 5. Icônes Bureau (optionnel) ───────────────────────────────────────────
if [ -f refresh_desktop_app_icon.sh ]; then
    echo ""
    bash refresh_desktop_app_icon.sh 2>/dev/null || true
fi

write_installed_stamp

echo ""
echo "📋 Scripts dans ce dossier :"
for f in "$APP_DIR"/*.command; do
    [ -f "$f" ] && basename "$f"
done

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "✨ Mise à jour terminée."
echo ""
echo "👉 STOPPER_EONORA.command puis LANCER_EONORA.command"
echo "👉 Navigateur : Cmd + Shift + R (obligatoire)"
echo "   Si écran blanc : REPARER_INTERFACE.command"
echo "────────────────────────────────────────────────────────────────────"
read -r -p "Appuie sur Entrée pour fermer…"
