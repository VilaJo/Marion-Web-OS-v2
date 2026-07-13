# Sécurité

## Vue d'ensemble

Eonora Tech OS privilégie une approche **local-first** : les données sensibles restent sur la machine de l'utilisateur. Les échanges avec des services externes (Google, Infomaniak) sont limités aux fonctionnalités nécessaires.

---

## Authentification

### Mot de passe

- Hash avec **Argon2** (ou équivalent) via `crypto_utils.py`
- Sel unique par utilisateur
- Pas de stockage en clair

### Sessions

- Token aléatoire stocké en base (`sessions`)
- Expiration configurable (défaut : 8h)
- Header `X-Marion-Token` requis pour toutes les routes protégées
- Le token peut être passé en query param pour les requêtes d'images (`?X-Marion-Token=...`)

### Premier setup

- Si aucun fichier `.marion_auth.json` (ou équivalent) n'existe, les routes d'auth sont accessibles sans token
- `POST /api/v1/auth/setup` crée le premier utilisateur

---

## Chiffrement des données sensibles

### Credentials email (IMAP/SMTP)

- Stockés dans `email_accounts` (SQLite)
- Champs `password_encrypted` et `salt`
- Déchiffrement avec le mot de passe de session (en mémoire)

### OAuth tokens (Google)

- Stockés dans `oauth_tokens` (SQLite)
- Chiffrement via `oauth_service` avec le mot de passe utilisateur
- Fichier legacy `.oauth_tokens.enc` si utilisé

### Mot de passe en mémoire

- `current_password` dans `api/shared.py` : conservé en mémoire après login pour déchiffrer les credentials
- Réinitialisé à chaque requête après validation du token

---

## Portail client (public)

- Authentification par **PIN** (4 chiffres)
- Token partagé (`shareToken`) dans l'URL : `/portal/:token`
- Le token est un identifiant opaque, pas le mot de passe
- Les routes publiques du portail ne requerrent pas `X-Marion-Token`

---

## Accès fichiers

- `get_safe_path()` : résolution de chemin strictement limitée à `DESKTOP_PATH`
- Vérification `str(full_path).startswith(str(DESKTOP_PATH))` pour éviter les traversées de répertoire

---

## CORS

- Origines configurées dans `config.py` : `CORS_ORIGINS` (défaut : `http://127.0.0.1:5003`)
- `supports_credentials: True` pour les cookies si nécessaires

---

## Bonnes pratiques

1. **Ne pas commiter** `.env`, `.env.local` ou tout fichier contenant des clés API
2. **SECRET_KEY** : utiliser une valeur aléatoire en production
3. **HTTPS** : en déploiement externe, utiliser TLS
4. **Backup** : le dossier `Eonora Tech OS Database` contient des données sensibles — à sauvegarder de façon sécurisée
