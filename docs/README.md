# Marion Web OS — Documentation Technique

> Documentation complète de l'architecture, des APIs et du déploiement du Business OS Local-First pour freelances créatifs.

---

## 📚 Sommaire

| Section | Description |
|---------|-------------|
| [Architecture](./architecture/overview.md) | Vue d'ensemble, diagrammes C4, flux de données |
| [API](./api/overview.md) | Endpoints REST, authentification, blueprints |
| [Base de données](./database/schema.md) | Schéma SQLite, relations, migrations |
| [Frontend](./frontend/structure.md) | Structure React, routing, state management |
| [Déploiement](./deployment/local-deployment.md) | Installation locale, prérequis, lancement |

---

## 🎯 Principes Clés

- **Local-First** : Données stockées localement (JSON + SQLite), souveraineté totale
- **Hybride** : SPA React + API Flask, best of both worlds
- **IA Embarquée** : Franck (Gemini) intégré au système de fichiers
- **Sécurité** : Authentification par mot de passe, tokens de session, OAuth pour Google

---

## 🛠 Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Python 3.12+, Flask |
| Base de données | SQLite |
| Persistence | JSON (project.json) + système de fichiers |
| IA | Google Gemini (via SDK Python) |
| Email | IMAP/SMTP (Infomaniak) |
| OAuth | Google (Calendar, Drive) |

---

*Dernière mise à jour : Février 2026*
