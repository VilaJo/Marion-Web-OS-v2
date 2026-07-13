# Google OAuth — Autoriser Marion Kindynis

Compte Google Calendar de Marion :

```
marion.kindynis@gmail.com
```

Sans cette étape, l'agenda affiche « Non connecté » ou Google bloque avec `access_denied` tant que l'app OAuth est en mode **Testing**.

---

## Étapes (Johan — une fois, ~2 min)

1. Ouvrir [Google Cloud Console — OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Vérifier que le projet sélectionné est celui du `GOOGLE_CLIENT_ID` dans ton `.env`
3. Confirmer **Publishing status** = **Testing** (ou In production si déjà publié)
4. Section **Test users** → **+ ADD USERS**
5. Ajouter exactement : `marion.kindynis@gmail.com`
6. **SAVE**

Vérifier aussi [Credentials](https://console.cloud.google.com/apis/credentials) → ton client OAuth **Web application** :

- **Authorized redirect URIs** doit contenir :
  ```
  http://127.0.0.1:5003/api/v1/oauth/google/callback
  ```

APIs activées sur le projet :

- Google Calendar API
- (optionnel) Google Drive API

---

## Côté Marion (sur son Mac)

1. Fichier **`MARION-env.local`** dans  
   `~/Bibliothèque/Application Support/Eonora Tech OS/`  
   avec au minimum `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_REDIRECT_URI` (Johan envoie le fichier complet — pas seulement la clé Gemini)
2. **Relancer Marion** après avoir placé le fichier (quitte et rouvre l'app)
3. Eonora Tech OS → **Paramètres** ou **Agenda** → **Connecter Google Calendar**
3. Choisir le compte **`marion.kindynis@gmail.com`** (pas un autre compte Google)
4. Accepter les autorisations Calendrier

Si elle avait déjà connecté un autre compte sur l'ancien Mac : **déconnecter** puis reconnecter avec `marion.kindynis@gmail.com`.

---

## Vérification rapide

Dans un terminal sur le Mac de Marion (serveur lancé) :

```bash
curl -s http://127.0.0.1:5003/api/v1/oauth/google/status | python3 -m json.tool
```

Attendu après connexion :

```json
{
  "connected": true,
  "email": "marion.kindynis@gmail.com",
  "name": "..."
}
```

Agenda :

```bash
curl -s http://127.0.0.1:5003/api/v1/gcal/sync-status | python3 -m json.tool
```

---

## Erreurs fréquentes

| Message Google | Cause | Fix |
|----------------|-------|-----|
| `access_denied` | Email pas en test user | Ajouter `marion.kindynis@gmail.com` |
| `redirect_uri_mismatch` | Mauvais port ou URI | URI = `http://127.0.0.1:5003/api/v1/oauth/google/callback` |
| Connecté mais mauvais calendrier | Autre compte Google choisi | Déconnecter, reconnecter avec le bon compte |
| Token expired | Refresh token invalide | Déconnecter + reconnecter dans Paramètres |
