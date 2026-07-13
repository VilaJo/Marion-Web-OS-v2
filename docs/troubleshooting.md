# Dépannage

## Erreurs fréquentes et solutions

---

### 401 — Non authentifié / Session invalide

**Symptôme** : L'app redirige vers l'écran de login ou affiche "Session invalide".

**Causes possibles** :
- Session expirée (durée par défaut : 8h)
- Token absent ou incorrect
- Redémarrage du navigateur (sessionStorage vidé)

**Solution** : Se reconnecter avec le mot de passe. Le token est stocké dans `sessionStorage` et est perdu à la fermeture du navigateur.

---

### 503 — Server not configured (Gemini)

**Symptôme** : Franck ou les outils IA ne répondent pas, message "Server not configured".

**Cause** : `GEMINI_API_KEY` non configurée ou invalide.

**Solution** :
1. Aller dans **Paramètres** → **IA**
2. Saisir une clé API Google Gemini valide
3. Ou définir `GEMINI_API_KEY` dans `.env` / `.env.local`

---

### SSL / Segmentation fault (Python)

**Symptôme** : `ssl.SSLError: [SSL: RECORD_LAYER_FAILURE]` suivi de `segmentation fault` et `leaked semaphore objects`.

**Cause** : Problème connu avec les connexions IMAP partagées (pool) sur Python 3.14 / macOS ARM.

**Solution** : L'app utilise désormais des connexions IMAP **single-use** (une par requête). Si l'erreur persiste :
- Vérifier que `email_service.py` n'utilise pas de pool
- Mettre à jour Python ou tester avec Python 3.12

---

### Les dossiers / fichiers ne s'affichent pas (Fichiers & Liens)

**Symptôme** : L'onglet "Fichiers & Liens" est vide, pas de dossiers.

**Causes possibles** :
- Requêtes API sans token d'authentification (401)
- Chemin `DATA_PATH` incorrect ou vide

**Solution** :
- Vérifier que toutes les requêtes utilisent `apiFetch` (et non `fetch` brut)
- Vérifier `DATA_PATH` dans la config (défaut : `~/Desktop/Eonora Tech OS Database`)

---

### Google Agenda / Drive déconnectés

**Symptôme** : Badge "Hors ligne" ou "Reconnecter" dans l'agenda.

**Causes** :
- Token OAuth expiré
- Refresh token manquant (nécessite re-auth complète)

**Solution** : Cliquer sur **Reconnecter** dans l'Agenda. Si la reconnexion échoue, déconnecter puis reconnecter dans les paramètres.

---

### Portail client ne s'affiche pas

**Symptôme** : Page blanche ou erreur "ShareToken not found" sur `/portal/:token`.

**Cause** : `portal_settings_json` du projet non synchronisé en base.

**Solution** : Ouvrir la fiche client → Portail → Enregistrer les paramètres. Vérifier que `portalSettings` dans `project.json` est bien sauvegardé.

---

### Images du portail non visibles

**Symptôme** : Les livrables images s'affichent en téléchargement au lieu d'un aperçu.

**Cause** : MIME type incorrect ou non détecté.

**Solution** : Le backend utilise `mimetypes.guess_type()`. Vérifier que les extensions sont reconnues (png, jpg, jpeg, gif, webp, svg).

---

### "Aucun dossier personnalisé trouvé" (Email)

**Symptôme** : L'onglet Classement des emails indique qu'aucun dossier n'est trouvé.

**Causes** :
- Compte IMAP non connecté ou credentials invalides
- Serveur Infomaniak renvoie une structure vide

**Solution** : Vérifier la connexion email dans Paramètres. Tester avec un client mail externe pour confirmer l'accès IMAP.

---

## Logs et diagnostic

- **Backend** : Les logs Flask s'affichent dans le terminal où `franck_server.py` est lancé
- **Frontend** : Console navigateur (F12) pour les erreurs JavaScript
- **Database** : `marion_data.db` ou `Eonora Tech OS Database/marion.db`
