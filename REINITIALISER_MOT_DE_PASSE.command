#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

if [ -z "${MARION_CLEAN_SHELL:-}" ]; then
  export MARION_CLEAN_SHELL=1
  exec /bin/bash --noprofile --norc "$SCRIPT_PATH" "$@"
fi

DATA_DIR="$HOME/Desktop/Marion Web OS Database"
AUTH_FILE="$DATA_DIR/.marion_auth.json"
OAUTH_ENC="$DATA_DIR/.oauth_tokens.enc"
OAUTH_JSON="$DATA_DIR/.oauth_tokens.json"

command -v clear >/dev/null 2>&1 && clear || true
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     Marion — Réinitialiser le mot de passe                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Dossier données : $DATA_DIR"
echo ""
echo "⚠️  Cela supprime le mot de passe Marion et les connexions Google."
echo "    Tes dossiers clients (fichiers) sont CONSERVÉS."
echo ""
read -r -p "Continuer ? (o/N) " ans
if [ "$ans" != "o" ] && [ "$ans" != "O" ]; then
    echo "Annulé."
    read -r -p "Appuie sur Entrée..."
    exit 0
fi

rm -f "$AUTH_FILE" "$OAUTH_ENC" "$OAUTH_JSON"
echo "✅ Mot de passe supprimé."

if curl -fsS --max-time 2 http://127.0.0.1:5003/api/v1/version >/dev/null 2>&1; then
    curl -fsS -X POST http://127.0.0.1:5003/api/v1/auth/reset \
        -H 'Content-Type: application/json' \
        -d '{"confirm":"RESET"}' >/dev/null 2>&1 || true
    echo "✅ Sessions serveur nettoyées."
fi

echo ""
echo "👉 Rafraîchis Marion dans le navigateur (Cmd+R)."
echo "   Choisis un nouveau mot de passe (min. 6 caractères)."
echo ""
read -r -p "Appuie sur Entrée pour fermer..."
