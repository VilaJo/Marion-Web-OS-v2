# Développement — Setup

## Prérequis

- **Python** 3.12+ (recommandé : 3.12 pour éviter les bugs Python 3.14)
- **Node.js** 18+ (npm)
- **Git**

---

## Installation

```bash
git clone https://github.com/VilaJo/Marion-Web-OS-v2.git
cd Marion-Web-OS-v2
./INSTALLER.command
```

---

## Variables d'environnement

Créer `.env.local` (prioritaire sur `.env`) :

```env
# API
GEMINI_API_KEY=your_key_here

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:5003/api/v1/oauth/google/callback

# Données
DATA_PATH=~/Desktop/Marion Web OS Database

# Debug
DEBUG=true
```

---

## Lancer en mode dev

```bash
# 1. Démarrer le backend
./LANCER_MARION.command
# ou
python franck_server.py

# 2. (Optionnel) Frontend en mode dev avec hot reload
npm run dev
# Puis adapter l'URL ou le proxy vers le backend
```

En production, le frontend est pré-buildé (`npm run build`) et servi par Flask depuis `.dist/`.

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run build` | Build frontend → `.dist/` |
| `npm run dev` | Dev server Vite (si configuré) |
| `npm test` | Tests frontend (vitest) |
| `pytest tests/` | Tests backend (Python) |

---

## Structure des fichiers clés

- `franck_server.py` — Point d'entrée Flask
- `config.py` — Configuration
- `api/*.py` — Blueprints
- `services/*.py` — Logique métier
- `database/db.py` — Accès SQLite
- `router.tsx` — Routes React
- `services/api.ts` — Client API frontend
