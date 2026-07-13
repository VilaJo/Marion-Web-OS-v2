#!/bin/bash
# Compatibilité — ancien nom de l'arrêt
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/STOPPER_EONORA.command"
