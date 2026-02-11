# Base de données — Migrations

## Système de migrations

Les migrations sont appliquées au démarrage via `run_migrations()` dans `franck_server.py`. Chaque fichier SQL dans `database/migrations/` est exécuté une seule fois (tracking via table `_migrations` ou équivalent).

## Fichiers

| Fichier | Description |
|---------|-------------|
| `001_initial.sql` | Tables users, workspaces, sessions, projects, tasks, invoices, events, notes, goals, oauth_tokens, etc. |
| `002_add_email_creds.sql` | Support credentials email |
| `003_add_email_accounts.sql` | Table `email_accounts` (IMAP/SMTP chiffré) |
| `004_portal_tables.sql` | `portal_deliverables`, `portal_updates`, `portal_client_files`, `portal_comments` |

## Ajouter une migration

1. Créer `database/migrations/005_nom.sql`
2. Écrire du SQL idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` avec vérifications)
3. Redémarrer le serveur — la migration sera appliquée automatiquement
