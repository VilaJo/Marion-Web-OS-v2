# Glossaire

| Terme | Définition |
|-------|-------------|
| **project.json** | Fichier JSON par projet/client, stocké dans le dossier du projet. Contient tâches, profil, brand kit, moodboard, maintenance. |
| **external_id** | Identifiant projet basé sur le chemin (ex. `Actif/Johan Vila`). Utilisé pour mapper dossiers ↔ base SQLite. |
| **workspace** | Espace de travail (multi-tenant). Un utilisateur a un workspace par défaut. |
| **Franck** | Assistant IA intégré (Google Gemini). Chat, briefing, analyse, dispatch fichiers. |
| **Coach Franck** | Mode IA du Mode Focus — coaching court et concret. |
| **X-Marion-Token** | Header HTTP contenant le token de session pour les requêtes authentifiées. |
| **shareToken** | Token partagé pour le portail client. Permet aux clients d'accéder à leur projet via une URL. |
| **PIN** | Code à 4 chiffres pour authentifier un client sur le portail public. |
| **DATA_PATH** | Dossier racine des données (défaut : `~/Desktop/Eonora Tech OS Database`). |
| **DESKTOP_PATH** | Alias de `DATA_PATH` dans le code. |
| **livrable** | Élément publié par Marion sur le portail client (lien, image, fichier). |
| **portal_deliverables** | Table SQLite des livrables du portail. |
| **portal_updates** | Table SQLite des mises à jour / journal d'avancement. |
| **portal_client_files** | Fichiers uploadés par le client via le portail. |
| **apiFetch** | Wrapper fetch frontend qui ajoute automatiquement `X-Marion-Token`. |
| **blueprint** | Module Flask regroupant des routes (ex. `auth_bp`, `projects_bp`). |
