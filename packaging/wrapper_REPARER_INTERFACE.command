#!/usr/bin/env bash
# Copie ce fichier à côté du dossier « Eonora Tech OS » sur le Bureau de Marion.
# Ex. Bureau/Eonora Tech OS - Pour Marion/REPARER_INTERFACE.command
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for ROOT in "$SCRIPT_DIR/Eonora Tech OS" "$SCRIPT_DIR" "$HOME/Desktop/Eonora Tech OS"; do
    if [ -f "$ROOT/REPARER_INTERFACE.command" ]; then
        exec bash "$ROOT/REPARER_INTERFACE.command"
    fi
done

echo "❌ REPARER_INTERFACE introuvable."
echo "   Lance METTRE_A_JOUR.command dans le dossier Eonora Tech OS."
read -r -p "Appuie sur Entrée…"
exit 1
