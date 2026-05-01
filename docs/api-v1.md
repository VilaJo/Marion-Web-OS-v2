# API HTTP v1 (`/api/v1`)

Toutes les routes API sont préfixées par `/api/v1`. L’authentification utilise l’en-tête `X-Marion-Token` (session créée après `/api/v1/auth/setup` ou `/api/v1/auth/login`), sauf routes publiques listées dans `franck_server.require_auth`.

## Authentification

| Méthode | Chemin | Description |
|--------|--------|-------------|
| GET | `/api/v1/auth/check` | État config + session |
| POST | `/api/v1/auth/setup` | Premier mot de passe |
| POST | `/api/v1/auth/login` | Connexion |
| POST | `/api/v1/auth/logout` | Déconnexion |

## Sauvegardes

| Méthode | Chemin | Description |
|--------|--------|-------------|
| GET | `/api/v1/backup/status` | Dernières sauvegardes locales, stats, cloud |
| GET | `/api/v1/backup` | Déclenche une sauvegarde SQLite locale |
| GET | `/api/v1/backup/bundle` | Télécharge un ZIP (`marion.db` + `manifest.json`) |
| POST | `/api/v1/backup/cloud` | Sauvegarde + envoi Google Drive (si configuré) |
| GET/POST | `/api/v1/backup/cloud/config` | Active/désactive la sauvegarde cloud |

## Projets & fichiers

Les blueprints `projects_bp`, fichiers et portail client exposent le CRUD projets, déplacement de dossiers, uploads — voir les fichiers dans `api/` pour le détail des chemins.

## Facturation & temps

| Méthode | Chemin | Description |
|--------|--------|-------------|
| POST | `/api/v1/invoices/...` | Factures, notes, dépenses (voir `api/invoices_bp.py`) |
| POST | `/api/v1/time/log` | Ajouter une entrée de temps |
| POST | `/api/v1/time/get` | Lire le fichier `timesheet.json` du client |
| POST | `/api/v1/time/mark_billed` | Marquer des entrées comme facturées |

## IA (Franck)

| Méthode | Chemin | Description |
|--------|--------|-------------|
| POST | `/api/v1/chat` | Chat principal ; corps JSON : `history`, `context` (projets, événements, `routePath`, `activeClient`, etc.) |
| GET | `/api/v1/franck/greeting` | Accueil contextuel |
| GET | `/api/v1/franck/suggestions` | Suggestions proactives |

## Workspaces & rôles (évolution)

Le module `api/v1/workspaces.py` introduit des **espaces de travail** (branding, modules activables). Modèle de permissions cible pour des évolutions multi-utilisateur :

- `owner` — contrôle total, facturation, paramètres workspace.
- `admin` — gestion des membres et des modules.
- `member` — projets et facturation selon règles workspace.
- `viewer` — lecture seule.

Tant que l’app reste mono-utilisateur local, ces rôles servent de référence pour la conception ; l’application des contrôles sur chaque route Flask doit suivre la même matrice lors du durcissement multi-tenant.

## Documentation complète

Voir [Documentation technique](../README.md) pour l’architecture, la base de données et le déploiement.
