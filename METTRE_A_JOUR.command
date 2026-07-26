#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS — Mise à jour (GitHub main) — force toujours le .dist neuf
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
echo "📁 Dossier mis à jour : $APP_DIR"
echo ""

write_installed_stamp() {
    if [ -f BUILD_STAMP.json ]; then
        cp BUILD_STAMP.json .marion_installed.json
        echo "✅ Empreinte install :"
        cat BUILD_STAMP.json
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

stop_running_server() {
    local pid_file="$APP_DIR/.marion.pid"
    local port="${MARION_PORT:-5003}"
    echo ""
    echo "🛑 Arrêt du serveur en cours (pour charger le nouveau .dist)…"
    if [ -f "$pid_file" ]; then
        local pid
        pid="$(tr -d '[:space:]' < "$pid_file" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            sleep 1
            kill -9 "$pid" 2>/dev/null || true
            echo "   Processus $pid arrêté."
        fi
        rm -f "$pid_file"
    fi
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids="$(lsof -ti ":$port" 2>/dev/null || true)"
        if [ -n "$pids" ]; then
            # shellcheck disable=SC2086
            kill $pids 2>/dev/null || true
            sleep 1
            # shellcheck disable=SC2086
            kill -9 $pids 2>/dev/null || true
            echo "   Port $port libéré."
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

show_desktop_app_target() {
    local path_file="$HOME/Desktop/Eonora Tech OS.app/Contents/Resources/project_path"
    if [ -f "$path_file" ]; then
        local target
        target="$(tr -d '\r' < "$path_file" | head -1)"
        echo ""
        echo "🖥️  L'app Bureau pointe vers :"
        echo "   $target"
        if [ "$target" != "$APP_DIR" ]; then
            echo "⚠️  ATTENTION : ce n'est PAS le dossier que tu viens de mettre à jour."
            echo "   Je vais repointer l'app Bureau vers : $APP_DIR"
        fi
    fi
}

# ── 0. Git pull si dépôt présent ─────────────────────────────────────────────
if [ -d .git ] && command -v git >/dev/null 2>&1; then
    echo "📂 Clone Git — synchronisation origin/main…"
    git fetch origin 2>/dev/null || true
    # Prefer hard reset to origin/main so local stale .dist cannot stick around
    if git rev-parse --verify origin/main >/dev/null 2>&1; then
        git checkout main 2>/dev/null || git checkout -B main origin/main 2>/dev/null || true
        if git reset --hard origin/main 2>/dev/null; then
            echo "✅ Dépôt aligné sur origin/main."
        elif git pull --ff-only origin main 2>/dev/null || git pull --ff-only 2>/dev/null || git pull 2>/dev/null; then
            echo "✅ git pull terminé."
        else
            echo "⚠️  git sync partiel — on force quand même le .dist depuis GitHub."
        fi
    fi
fi

# ── 1. ZIP GitHub (code) si pas de .git ──────────────────────────────────────
if [ ! -d .git ]; then
    if [ -f .env.local ]; then
        echo "🔒 Sauvegarde .env.local…"
        cp .env.local .env.local.bak
    fi

    echo ""
    echo "⬇️  Téléchargement GitHub (main)…"
    URLS=(
        "https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/heads/main.zip?nocache=$(date +%s)"
        "https://github.com/VilaJo/Marion-Web-OS-v2/archive/main.zip?nocache=$(date +%s)"
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
        --exclude 'node_modules' --exclude '.git' \
        "$EXTRACTED_DIR"/ ./
    rm -rf "$EXTRACTED_DIR" update.zip

    if [ -f .env.local.bak ]; then
        mv .env.local.bak .env.local
        echo "✅ .env.local restauré."
    fi
fi

# ── 2. TOUJOURS forcer le .dist depuis GitHub (évite ancienne UI) ─────────────
echo ""
echo "🎨 Forçage interface (.dist) depuis GitHub main…"
if ! download_dist_from_github "$APP_DIR"; then
    echo "❌ Impossible de télécharger le nouveau .dist"
    read -r -p "Appuie sur Entrée…"
    exit 1
fi

# Preuve rapide que le bon ClientView est bien là (sans Finances/E-mails dans les onglets)
CLIENTVIEW_JS="$(ls -1 "$APP_DIR"/.dist/assets/ClientView-*.js 2>/dev/null | head -1 || true)"
if [ -n "$CLIENTVIEW_JS" ]; then
    if grep -q "label:\"Finances\"" "$CLIENTVIEW_JS" 2>/dev/null || grep -q "label:'Finances'" "$CLIENTVIEW_JS" 2>/dev/null; then
        echo "⚠️  Ancien ClientView encore détecté — réessaie dans 30 s (cache GitHub)."
    else
        echo "✅ Nouveau ClientView détecté : $(basename "$CLIENTVIEW_JS")"
    fi
fi

# ── 3. Stop serveur + dépendances ────────────────────────────────────────────
stop_running_server

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

# ── 4. Repoint + refresh app Bureau vers CE dossier ──────────────────────────
show_desktop_app_target
if [ -f packaging/install_desktop_app.sh ]; then
    echo ""
    bash packaging/install_desktop_app.sh "$APP_DIR" 2>/dev/null || true
elif [ -f refresh_desktop_app_icon.sh ]; then
    echo ""
    bash refresh_desktop_app_icon.sh 2>/dev/null || true
fi

write_installed_stamp

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "✨ Mise à jour terminée — interface forcée depuis GitHub."
echo ""
echo "👉 STOPPER si besoin, puis double-clique « Eonora Tech OS » sur le Bureau"
echo "👉 Navigateur : Cmd + Shift + R"
echo "👉 Tu dois voir WhatsNew v2.13.15 — Fiches clients = couleurs dossiers"
echo "────────────────────────────────────────────────────────────────────"
read -r -p "Appuie sur Entrée pour fermer…"
