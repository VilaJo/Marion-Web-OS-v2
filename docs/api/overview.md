# API — Vue d'ensemble

## Base URL

```
http://127.0.0.1:5003/api/v1/
```

(Configurable via `HOST` et `PORT` dans `config.py` ou `.env`)

---

## Authentification

### Header requis

Toutes les routes protégées exigent le header :

```
X-Marion-Token: <session_token>
```

Le token est obtenu via `POST /api/v1/auth/login` et stocké dans `sessionStorage` par le frontend (`apiFetch` l'ajoute automatiquement).

### Routes publiques (sans auth)

| Route | Description |
|-------|-------------|
| `GET /api/v1/auth/check` | Vérifier si un setup est requis |
| `POST /api/v1/auth/setup` | Premier setup (créer user) |
| `POST /api/v1/auth/login` | Connexion |
| `POST /api/v1/auth/reset` | Reset mot de passe |
| `GET /api/v1/ai/check-status` | Statut Gemini |
| `POST /api/v1/ai/setup` | Configurer Gemini |
| `GET /api/v1/oauth/*` | Callbacks OAuth (redirection) |
| `GET /api/v1/health` | Health check |
| `GET /api/v1/version` | Version de l'app |

### Portail public

Les routes `/api/v1/portal/<token>/...` (où `token` est un identifiant partagé) utilisent une authentification par **PIN** (POST `/api/v1/portal/<token>/auth`) plutôt que `X-Marion-Token`.

---

## Structure des réponses

- **Succès** : JSON avec les données demandées
- **Erreur** : `{"error": "message", "code": "OPTIONAL_CODE"}` avec `4xx` ou `5xx`
- **Stream** : `text/plain` (ex. chat, briefing) — chunks texte

---

## Détails des endpoints

Voir [Endpoints](./endpoints.md) pour la liste complète par blueprint.

---

## Spécification OpenAPI

Un fichier [openapi.yaml](./openapi.yaml) (OpenAPI 3.0) documente les principaux endpoints. Utilisable avec Swagger UI, Postman ou Insomnia.
