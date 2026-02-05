#!/bin/bash
cd "$(dirname "$0")"

# --- Configuration ---
echo "🚀 Lancement de Marion Web OS..."

# Fonction pour nettoyer les processus à la fermeture
cleanup() {
    echo "🛑 Arrêt des serveurs..."
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM EXIT

# --- 1. Démarrage du Cerveau (Backend) ---
echo "🧠 Démarrage de Franck (Serveur)..."
if [ -d ".venv" ]; then
    source .venv/bin/activate
    python3 franck_server.py > /dev/null 2>&1 &
else
    python3 franck_server.py > /dev/null 2>&1 &
fi
BACKEND_PID=$!

# --- 2. Démarrage de l'Interface (Frontend) ---
echo "🎨 Démarrage de l'Interface..."
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

# --- 3. Lancement du Navigateur ---
echo "🌍 Ouverture immédiate..."
(sleep 1 && open "http://localhost:3000") &

# --- 4. Maintien de la session ---
echo "✅ Tout est prêt ! Ne fermez pas cette fenêtre."
echo "   (Appuyez sur Ctrl+C pour arrêter)"

# Attendre que l'un des processus se termine (ce qui n'arrivera pas sauf crash/arrêt)
wait $BACKEND_PID $FRONTEND_PID
