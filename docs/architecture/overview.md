# Architecture — Vue d'ensemble

## 1. Principes architecturaux

Eonora Tech OS repose sur une **architecture hybride** combinant :

- **SPA React** : Interface réactive, lazy loading, offline-ready
- **API Flask** : Passerelle système (OS Bridge) pour accès fichiers, base de données, services externes
- **Double persistence** : SQLite pour l'état métier (auth, OAuth, portail), JSON + fichiers pour les projets clients

### Local-First

Les données sensibles restent sur la machine de l'utilisateur :

- Dossier `Eonora Tech OS Database` (ou `DATA_PATH`) : SQLite, credentials chiffrés
- Dossier `Desktop` ou chemins configurés : `project.json` par client, fichiers, factures
- Aucune donnée métier n'est envoyée vers un cloud tiers (sauf OAuth Google, emails IMAP/SMTP)

---

## 2. Couches de l'application

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
│  Pages · Components · Stores (Zustand) · React Query · Services  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP REST (apiFetch, X-Marion-Token)
┌─────────────────────────────▼───────────────────────────────────┐
│                     BACKEND (Flask)                              │
│  Blueprints · Auth Middleware · CORS                             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     SERVICES (Python)                           │
│  gemini_service · oauth_service · email_service                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     DATA LAYER                                   │
│  SQLite  │  JSON (project.json)  │  Filesystem (Desktop, etc.)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Diagrammes détaillés

- [Contexte système (C4 L1)](./system-context.md) — Acteurs et systèmes externes
- [Containers (C4 L2)](./container-diagram.md) — SPA, Flask, SQLite, JSON
- [Flux de données](./data-flow.md) — Parcours des requêtes et des données

---

## 4. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `franck_server.py` | Point d'entrée Flask, enregistrement blueprints, auth middleware |
| `config.py` | Configuration multi-environnement (dev, prod, test) |
| `router.tsx` | Routes React (Dashboard, Client, Finances, Emails, Settings) |
| `services/api.ts` | `apiFetch` — wrapper HTTP avec `X-Marion-Token` |
| `database/db.py` | Accès SQLite, migrations |
