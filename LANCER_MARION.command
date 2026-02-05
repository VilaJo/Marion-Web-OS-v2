#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🦄 MARION WEB OS - LANCEMENT
# ═══════════════════════════════════════════════════════════════════════════════

cd "$(dirname "$0")"
APP_DIR="$(pwd)"

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        🦄  MARION WEB OS                                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PID_FILE=".marion.pid"
LOG_FILE=".marion.log"

# Fonction pour vérifier si le serveur tourne
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            return 0
        fi
    fi
    # Vérifier aussi si le port est utilisé
    if lsof -i :5003 > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Vérifier si déjà en cours
if is_server_running; then
    echo "✅ Marion est déjà en cours d'exécution !"
    echo ""
    echo "🌐 Ouverture du navigateur..."
    open "http://127.0.0.1:5003"
    echo ""
    echo "💡 Pour arrêter Marion, utilise STOPPER_MARION.command"
    sleep 3
    exit 0
fi

# Vérifier l'environnement virtuel
if [ ! -d ".venv" ]; then
    echo "❌ Environnement non installé !"
    echo ""
    echo "👉 Lance d'abord INSTALLER.command"
    read -p "Appuie sur Entrée..."
    exit 1
fi

# Démarrer le serveur
echo "🚀 Démarrage du serveur..."
echo ""

source .venv/bin/activate
python franck_server.py > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

echo "   PID: $SERVER_PID"

# Attendre que le serveur soit prêt
echo ""
echo "⏳ Initialisation..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:5003/api/version > /dev/null 2>&1; then
        echo ""
        echo "✅ Serveur prêt !"
        break
    fi
    echo -n "."
    sleep 1
done

# Ouvrir le navigateur
echo ""
echo "🌐 Ouverture du navigateur..."
sleep 1
open "http://127.0.0.1:5003"

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo ""
echo "🦄 Marion Web OS est en cours d'exécution !"
echo ""
echo "   📍 URL: http://127.0.0.1:5003"
echo "   📋 Logs: $APP_DIR/.marion.log"
echo ""
echo "💡 Pour arrêter: Lance STOPPER_MARION.command"
echo "   ou ferme cette fenêtre (Ctrl+C)"
echo ""
echo "───────────────────────────────────────────────────────────────────"
echo ""

# Garder le terminal ouvert et surveiller le serveur
trap "kill $SERVER_PID 2>/dev/null; rm -f $PID_FILE; echo ''; echo '👋 Marion arrêté !'; exit 0" INT TERM

# Attendre que le serveur se termine
wait $SERVER_PID
rm -f "$PID_FILE"
echo ""
echo "⚠️  Le serveur s'est arrêté. Vérifie les logs: $LOG_FILE"
read -p "Appuie sur Entrée..."
