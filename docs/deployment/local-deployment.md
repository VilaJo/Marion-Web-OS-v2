# Déploiement — Installation locale

## Prérequis

- **Python** 3.12+ (avec venv)
- **Node.js** 18+ (npm)
- **macOS** (ou Linux pour development)

---

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/VilaJo/Marion-Web-OS-v2.git
cd Marion-Web-OS-v2

# 2. Lancer l'installateur (venv + npm)
./INSTALLER.command

# 3. Déploiement (optionnel)
# .env ou .env.local avec GEMINI_API_KEY, GOOGLE_CLIENT_ID, etc.
```

---

## Lancement

```bash
./LANCER_MARION.command
```

Ce script :
1. Active le venv Python
2. Démarre le serveur Flask (`franck_server.py`) sur `127.0.0.1:5003`
3. Ouvre le navigateur

---

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `HOST` | Interface écoute | `127.0.0.1` |
| `PORT` | Port HTTP | `5003` |
| `GEMINI_API_KEY` | Clé API Google Gemini | — |
| `GOOGLE_CLIENT_ID` | OAuth Google | — |
| `GOOGLE_CLIENT_SECRET` | OAuth Google | — |
| `DATA_PATH` | Dossier données | `~/Desktop/Marion Web OS Database` |
| `IMAP_HOST` | Serveur IMAP | `mail.infomaniak.com` |
| `SMTP_HOST` | Serveur SMTP | `mail.infomaniak.com` |

Voir `.env.example` pour la liste complète.

---

## Build frontend

```bash
npm run build
```

Les assets sont générés dans `.dist/`. Le serveur Flask sert ce dossier en mode production.

---

## Application macOS (.app)

### Distribution officielle (.dmg)

Pour créer le fichier d'installation à envoyer à Marion :

```bash
./BUILD_RELEASE.command
```

Produit : `release/MarionWebOS-<version>.dmg` (glisser vers Applications).

### Développement local

Le projet inclut aussi `INSTALLER.command` et `Marion Web OS.app` sur le Bureau — utiles pour le développement, pas pour la distribution.
