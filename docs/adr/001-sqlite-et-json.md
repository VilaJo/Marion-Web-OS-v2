# ADR 001 : SQLite + JSON pour la persistence

## Statut

Accepté

## Contexte

Marion Web OS doit stocker des données structurées (utilisateurs, sessions, projets, tâches) tout en restant local-first et simple à déployer.

## Décision

- **SQLite** pour l'état métier : users, sessions, OAuth, projets (metadata), tâches, factures, événements, portail.
- **JSON + fichiers** (`project.json`) pour les données riches par projet : tâches détaillées, profil, brand kit, moodboard, maintenance.

## Raisons

1. **Zéro dépendance externe** : SQLite ne nécessite pas de serveur de base de données.
2. **Portabilité** : Un seul fichier `.db` + dossiers, facile à sauvegarder et déplacer.
3. **Flexibilité** : `project.json` évolue sans migrations pour les champs métier spécifiques.
4. **Performance** : SQLite suffit pour un usage single-user/desktop.

## Conséquences

- Double source de vérité : métadonnées en DB, contenu détaillé en JSON.
- Synchronisation nécessaire entre `projects` (DB) et `project.json` (fichier) lors du scan/save.
- Pas de support multi-utilisateur concurrent (usage prévu : une personne à la fois).
