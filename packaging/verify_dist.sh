#!/usr/bin/env bash
# Vérifie que .dist/index.html référence des fichiers JS/CSS présents sur disque.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
verify_dist_integrity() {
    local app_dir="${1:-.}"
    local index="$app_dir/.dist/index.html"

    if [ ! -f "$index" ]; then
        echo "❌ .dist/index.html introuvable"
        return 1
    fi

    local missing=0
    local ref path
    while IFS= read -r ref; do
        path="${ref#/}"
        if [ ! -f "$app_dir/.dist/$path" ]; then
            echo "❌ Fichier manquant : .dist/$path"
            missing=1
        fi
    done < <(grep -oE '/assets/[^"'\'' ]+\.(js|css)' "$index" | sort -u)

    if [ "$missing" -ne 0 ]; then
        return 1
    fi

    echo "✅ Interface (.dist) cohérente"
    return 0
}

download_dist_from_github() {
    local app_dir="${1:-.}"
    local tmp zip extracted

    tmp="$(mktemp -d)"
    zip="$tmp/update.zip"

    echo "⬇️  Téléchargement .dist depuis GitHub (main)…"
    if ! curl -fsSL -o "$zip" "https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/heads/main.zip"; then
        echo "❌ Téléchargement impossible"
        rm -rf "$tmp"
        return 1
    fi

    unzip -q -o "$zip" -d "$tmp"
    extracted="$(find "$tmp" -maxdepth 1 -type d -name 'Marion-Web-OS-v2-*' | head -n 1)"
    if [ -z "$extracted" ] || [ ! -d "$extracted/.dist" ]; then
        echo "❌ Archive GitHub invalide (.dist absent)"
        rm -rf "$tmp"
        return 1
    fi

    echo "📂 Restauration de .dist…"
    rm -rf "$app_dir/.dist"
    cp -R "$extracted/.dist" "$app_dir/.dist"
    if [ -f "$extracted/public/sw.js" ]; then
        cp "$extracted/public/sw.js" "$app_dir/public/sw.js" 2>/dev/null || true
        cp "$extracted/public/sw.js" "$app_dir/.dist/sw.js" 2>/dev/null || true
    fi
    rm -rf "$tmp"

    verify_dist_integrity "$app_dir"
}
