# Installation Eonora Tech OS — Guide Marion (Mac)

Version stable **v2.7.2** — facturation + agenda.

---

## 1. Télécharger (méthode recommandée — fichier .dmg)

Johan t'envoie le fichier **`MarionWebOS-2.7.2.dmg`** (ou version plus récente).

1. Double-clique sur le `.dmg`
2. **Glisse** l'icône **Eonora Tech OS** sur le dossier **Applications**
3. Éjecte le disque « Eonora Tech OS »
4. Ouvre **Eonora Tech OS** depuis le Launchpad ou le dossier Applications

Au **premier lancement**, Marion installe automatiquement ses composants (2–3 minutes, une seule fois).  
Ensuite, un double-clic suffit — le navigateur s'ouvre sur Marion.

**Prérequis sur le Mac :** Python 3 (souvent déjà présent). Si besoin : `brew install python@3.12`

---

## 1 bis. Ancienne méthode (développeur / ZIP GitHub)

**Option A** — Release GitHub :

https://github.com/VilaJo/Marion-Web-OS-v2/releases/tag/v2.7.0

Télécharge le **Source code (zip)** ou utilise le lien direct :

https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/tags/v2.7.0.zip

**Option B** — Branche `main` (dernière version) :

https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/heads/main.zip

---

## 2. Prérequis (méthode ZIP uniquement)

Si l'installateur dit que Python ou Node manque :

```bash
# Installer Homebrew si besoin : https://brew.sh
brew install python@3.12 node
```

---

## 3. Installer l'application (méthode ZIP)

1. Dézippe le dossier téléchargé
2. Ouvre le dossier (ex. `Marion-Web-OS-v2-2.7.0`)
3. **Double-clic sur `INSTALLER.command`**
4. Attends la fin (quelques minutes) — une icône **Eonora Tech OS** apparaît sur le Bureau

---

## 4. Configuration secrète (fichier `.env`)

Johan t'envoie un fichier **`.env`** par message sécurisé (pas par email public).

**Si tu as installé via le .dmg**, place le fichier **`MARION-env.local`** ici (sans le renommer) :

```
~/Bibliothèque/Application Support/Eonora Tech OS/MARION-env.local
```

Le Finder refuse souvent les noms commençant par un point — **pas besoin** de renommer en `.env.local`.

**Contenu minimum** (Johan t'envoie le fichier complet) :

- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` — obligatoires pour Google Calendar
- `GEMINI_API_KEY` — pour Franck (optionnel mais utile)

**Si tu as installé via le ZIP**, place-le à la racine du dossier projet (à côté de `INSTALLER.command`).
2. Vérifie dans le Terminal :

```bash
cd ~/Desktop/Marion-Web-OS-v2-2.7.0   # adapte le chemin
ls -la .env
```

Tu dois voir `.env` (pas seulement `.env.example`).

Contenu minimum pour l'agenda :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY` (pour Franck, optionnel mais utile)

---

## 5. Google Calendar — connexion

**Important** : Johan doit avoir ajouté **`marion.kindynis@gmail.com`** dans Google Cloud Console → OAuth → **Test users**. Sinon Google bloque la connexion.

Voir aussi : [`docs/GOOGLE_OAUTH_MARION.md`](./GOOGLE_OAUTH_MARION.md)

Dans Eonora Tech OS :

1. Lance **Eonora Tech OS.app** (ou `LANCER_EONORA.command`)
2. Va dans **Paramètres** (icône engrenage)
3. Clique **Connecter Google Calendar**
4. Choisis le compte **`marion.kindynis@gmail.com`**
5. Autorise l'accès au calendrier

Si ça échoue : envoie à Johan une capture de l'écran d'erreur Google.

---

## 6. Facturation — premier réglage

**Paramètres → Agence** :

| Champ | Exemple |
|-------|---------|
| N° IDE/UID | CHE-123.456.789 |
| N° TVA | CHE-123.456.789 TVA |
| IBAN | CHxx xxxx xxxx xxxx xxxx x |
| Frais relance | 0 / 20 / 40 CHF |

Ensuite : **Finances** → créer une facture test en brouillon → vérifier le QR-bill en bas de page.

---

## 7. Où sont tes données ?

Tout est stocké **localement** sur ton Mac :

```
~/Desktop/Eonora Tech OS Database/
```

- Dossiers clients (`1. En cours`, etc.)
- Base SQLite `marion.db`
- Tokens Google (après connexion)

**Nouveau Mac vide** : ce dossier n'existe pas encore. Pour récupérer d'anciens projets, copie ce dossier depuis l'ancien Mac (AirDrop, disque externe).

**Réinstallation** sans perdre les clients : garde uniquement `Eonora Tech OS Database` sur le Bureau, supprime le dossier code et réinstalle. Voir `REINSTALLATION_PROPURE.txt`.

---

## 8. Mises à jour plus tard

**Depuis l'application (recommandé pour Marion) :**

1. Ouvre **Paramètres** (icône engrenage)
2. Onglet **Mises à jour**
3. Clique **Synchroniser depuis GitHub**
4. Un terminal s'ouvre — attends la fin, puis **STOPPER_EONORA.command** et **LANCER_EONORA.command**
5. Dans le navigateur : **Cmd + Shift + R** (rechargement forcé)

**Manuellement** (double-clic dans le dossier Eonora Tech OS) :

- **`METTRE_A_JOUR.command`** — télécharge la dernière version depuis GitHub (branche main), sans `git` ni `npm` requis

**Si tu développes avec Git :**

- **`git pull`** après avoir lancé `ACTIVER_GIT.command` une fois

---

## 9. Dépannage rapide

| Problème | Solution |
|----------|----------|
| Page blanche / 404 `index-*.js` | **REPARER_INTERFACE.command** puis Cmd+Shift+R |
| Page blanche | Relance `INSTALLER.command` |
| « Non connecté » agenda | Vérifier `.env` + test user Google + reconnecter dans Paramètres |
| Port 5003 occupé | Ferme une autre instance ou lance `STOPPER_EONORA.command` |
| Mode hors-ligne affiché | Vérifie que le serveur tourne (`LANCER_EONORA.command`) |
| Logs | Fichier `.marion.log` à la racine du projet |

URL de l'app : **http://127.0.0.1:5003**

---

## Contact

En cas de blocage : Johan + capture d'écran + contenu de `.marion.log` (sans coller le `.env`).
