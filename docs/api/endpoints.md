# API — Liste des endpoints

## Auth (`/api/v1/auth`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/check` | Vérifier si setup requis / session valide |
| POST | `/setup` | Premier setup (créer user) |
| POST | `/login` | Connexion |
| POST | `/logout` | Déconnexion |
| POST | `/reset` | Reset mot de passe |

---

## Projects (`/api/v1/projects`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/scan` | Scanner les projets (dossiers + DB) |
| POST | `/save` | Sauvegarder un projet |
| POST | `/move` | Déplacer un projet |
| POST | `/archive` | Archiver un projet |
| DELETE | `/delete` | Supprimer un projet |

---

## Files (`/api/v1/files`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/list` | Lister les fichiers d'un chemin |
| POST | `/open` | Ouvrir un fichier (URL) |
| POST | `/create` | Créer un dossier/fichier |
| POST | `/move` | Déplacer un élément |
| POST | `/rename` | Renommer |
| POST | `/delete_item` | Supprimer |
| POST | `/move_item` | Déplacer un élément |

---

## AI (`/api/v1`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/ai/check-status` | Statut Gemini |
| POST | `/ai/setup` | Configurer Gemini |
| GET | `/ai/status` | Statut IA |
| POST | `/chat` | Chat Franck (stream) |
| POST | `/chat/zen` | Coach Franck (mode focus) |
| GET | `/franck/greeting` | Greeting contextual |
| GET | `/franck/data` | Données mémoire Franck |
| POST | `/franck/clear` | Effacer mémoire |
| POST | `/franck/suggestions` | Suggestions de tâches |
| POST | `/briefing` | Générer briefing |
| POST | `/analyze` | Analyser projet |
| POST | `/notes/ai` | AI pour notes |
| POST | `/invoices/remind` | Relance factures |
| POST | `/logo/generate` | Générer logo |
| POST | `/meeting/analyze` | Analyser réunion |
| POST | `/media/vectorize` | Vectoriser image |
| POST | `/media/remove_bg` | Supprimer arrière-plan |
| POST | `/media/upscale` | Upscaler image |
| POST | `/media/palette` | Extraire palette |
| POST | `/media/compress` | Compresser image |
| POST | `/files/dispatch` | Dispatcher fichier (IA) |
| POST | `/email/ai/reply` | Réponse email IA |
| POST | `/email/ai/summarize` | Résumé email IA |
| POST | `/generate-qr` | Générer QR code |

---

## Calendar (`/api/v1/calendar`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/fetch` | Récupérer événements |
| POST | `/sync` | Synchroniser |
| POST | `/update` | Modifier événement |
| POST | `/delete` | Supprimer événement |

---

## Invoices / Expenses / Notes / Time (`/api/v1`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/expenses` | Liste dépenses |
| POST | `/expenses/scan` | Scanner factures |
| DELETE | `/expenses/<id>` | Supprimer dépense |
| GET | `/notes` | Liste notes |
| POST | `/notes` | Créer note |
| DELETE | `/notes` | Supprimer note |
| POST | `/time/log` | Logger temps |
| POST | `/time/mark_billed` | Marquer facturé |
| POST | `/time/get` | Récupérer temps |

---

## OAuth / Drive / Google Calendar (`/api/v1`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/oauth/google/login` | Initier OAuth |
| GET | `/oauth/google/callback` | Callback OAuth |
| GET | `/oauth/google/status` | Statut connexion |
| POST | `/oauth/google/disconnect` | Déconnecter |
| GET | `/drive/list` | Lister Drive |
| POST | `/drive/upload` | Uploader |
| POST | `/drive/sync` | Sync projet → Drive |
| GET | `/gcal/calendars` | Liste calendriers |
| GET | `/gcal/events` | Événements |
| POST | `/gcal/events` | Créer événement |
| PUT | `/gcal/events/<id>` | Modifier événement |
| DELETE | `/gcal/events/<id>` | Supprimer |
| GET | `/gcal/sync-status` | Statut sync |

---

## Email (`/api/v1/email`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/connect` | Connecter compte |
| POST | `/disconnect` | Déconnecter |
| GET | `/status` | Statut |
| GET | `/unseen` | Nombre non lus |
| POST | `/list` | Lister emails |
| POST | `/body` | Corps email |
| POST | `/send` | Envoyer |
| POST | `/mark_read` | Marquer lu |
| POST | `/mark_unread` | Marquer non lu |
| POST | `/draft` | Brouillon |
| POST | `/delete` | Supprimer |
| POST | `/attachment` | Pièce jointe |
| POST | `/star` | Étoiler |
| POST | `/unstar` | Désétoiler |
| POST | `/move` | Déplacer |
| POST | `/search` | Rechercher |
| GET | `/folders` | Dossiers |
| POST | `/count_for_client` | Compter par client |
| POST | `/count_batch` | Comptage batch |

---

## Portal (`/api/v1/portal`)

### Public (token dans URL)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/<token>/auth` | Authentification PIN |
| GET | `/<token>/check` | Vérifier session |
| GET | `/<token>` | Vue d'ensemble |
| POST | `/<token>/comment` | Poster commentaire |
| POST | `/<token>/upload` | Téléverser fichier |
| GET | `/<token>/files` | Fichiers client |
| GET | `/<token>/activity` | Activité |
| GET | `/<token>/deliverable/<id>/download` | Télécharger livrable |

### Admin (X-Marion-Token)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/deliverables/<project_id>` | Liste livrables |
| POST | `/deliverable` | Créer livrable |
| GET | `/deliverable/<id>/download` | Télécharger |
| DELETE | `/deliverable/<id>` | Supprimer |
| GET | `/updates/<project_id>` | Updates |
| POST | `/update` | Créer update |
| DELETE | `/update/<id>` | Supprimer |
| GET | `/comments/<project_id>` | Commentaires |
| POST | `/comments/<project_id>/seen` | Marquer vus |
| DELETE | `/comment/<id>` | Supprimer |
| POST | `/comment` | Créer |
| GET | `/client-files/<project_id>` | Fichiers client |
| POST | `/client-files/<project_id>/seen` | Marquer vus |
| DELETE | `/client-files/<id>` | Supprimer |
| GET | `/client-files/<id>/download` | Télécharger |
| GET | `/unseen/<project_id>` | Compt non vus |

---

## Updates / Version / Bug

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/version` | Version app |
| GET | `/updates/check` | Vérifier mises à jour |
| POST | `/updates/apply` | Appliquer mise à jour |
| GET | `/updates/changelog` | Changelog |
| POST | `/report-bug` | Signaler bug |

---

## Backup

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/backup` | Télécharger backup DB |
