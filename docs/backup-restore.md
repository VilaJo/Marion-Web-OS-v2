# Backup et restauration

## Emplacement des données

| Élément | Chemin par défaut |
|---------|-------------------|
| Base SQLite | `~/Desktop/Marion Web OS Database/marion.db` |
| Fichier auth | `~/Desktop/Marion Web OS Database/.marion_auth.json` |
| Tokens OAuth | Table `oauth_tokens` + `.oauth_tokens.enc` (legacy) |
| Comptes email | Table `email_accounts` |
| Projets (JSON) | Sous-dossiers de `DATA_PATH` / Desktop |
| Backups auto | Même dossier, fichiers `*.db.backup` |

---

## Backup automatique

Au démarrage du serveur (`franck_server.py`), `backup_database()` est appelé :

- Conserve les **5 derniers** backups
- Nommage : `marion.db.backup.YYYYMMDD_HHMMSS`
- Stockage dans le même répertoire que la base

---

## Backup manuel

### Via l'API

```bash
curl -H "X-Marion-Token: <token>" http://127.0.0.1:5003/api/v1/backup -o backup.db
```

### Via le système de fichiers

```bash
# Copier toute la base de données
cp ~/Desktop/Marion\ Web\ OS\ Database/marion.db ~/Backups/marion_$(date +%Y%m%d).db

# Copier le dossier complet (projets + DB)
cp -r ~/Desktop/Marion\ Web\ OS\ Database ~/Backups/marion_backup_$(date +%Y%m%d)
```

---

## Restauration

1. Arrêter le serveur Marion
2. Remplacer `marion.db` par le fichier de backup
3. Ou restaurer tout le dossier `Marion Web OS Database`
4. Redémarrer le serveur

```bash
# Exemple
cp ~/Backups/marion_20260210.db ~/Desktop/Marion\ Web\ OS\ Database/marion.db
```

---

## Fréquence recommandée

- **Quotidien** : Backup automatique au démarrage (utile pour rollback rapide)
- **Hebdomadaire** : Copie externe (disque externe, cloud personnel chiffré)
- **Avant mise à jour majeure** : Backup manuel complet
