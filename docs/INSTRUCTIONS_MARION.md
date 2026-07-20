# Eonora Tech OS — Instructions Marion (v2.9.2)

Une page pour le quotidien. Garde ce fichier à portée de main.

---

## 0. Ton usage au quotidien

Ta boucle de tous les jours, c'est : **Ma journée → Clients → Agenda → Emails → Portail → Franck**. Tout le reste (facturation, timeline, réglages) part de ces écrans.

L'**Atelier** (WP Studio, refontes de sites) est un outil avancé pour les gros chantiers ponctuels — tu n'as pas besoin d'y toucher pour ton travail de tous les jours.

---

## 1. Lancer

Double-clic sur **Eonora Tech OS** (icône sur le Bureau ou dans Applications).

- Aucune fenêtre Terminal ne doit s’ouvrir.
- Au premier lancement : attendre 2–3 minutes (une seule fois).
- Le navigateur s’ouvre sur l’app (http://127.0.0.1:5003).

---

## 2. Arrêter

Double-clic sur **`STOPPER_EONORA.command`** (dans le dossier du projet).

Ou : quitter le navigateur + Cmd+Q sur l’app si elle est ouverte.

---

## 3. Mettre à jour

1. Double-clic sur **`METTRE_A_JOUR.command`**
2. Attendre la fin du script
3. Relancer **Eonora Tech OS**
4. Dans le navigateur : **Cmd + Shift + R** (rechargement forcé)

Sans ce Cmd+Shift+R, l’ancienne page peut rester en cache.

---

## 4. Écran blanc / page qui ne charge pas

1. Double-clic sur **`REPARER_INTERFACE.command`**
2. Relancer l’app
3. **Cmd + Shift + R** dans le navigateur

---

## 5. Mot de passe oublié

Double-clic sur **`REINITIALISER_MOT_DE_PASSE.command`**, puis suivre les messages à l’écran.

---

## 6. Franck (assistant IA)

1. Ouvre **Paramètres → IA**
2. Colle ta **clé Gemini** (fournie par Johan si besoin)
3. Choisis le mode **Cloud**
4. Ouvre Franck et envoie un message texte pour vérifier

---

## 7. Micro (Franck vocal)

1. macOS demande l’accès au micro → **Autoriser**
2. Clique sur le micro dans Franck
3. Parle clairement pendant **1–2 secondes**, puis arrête
4. Si ça échoue : Paramètres Système → Confidentialité → Microphone → autoriser le navigateur / l’app

---

## 8. Partager le portail client (lien public)

Pour envoyer à un client un vrai lien HTTPS (pas juste un aperçu local) :

1. Onglet **Portail client** → active le portail (bouton **Activé**)
2. Double-clic sur **`LANCER_PORTAIL_PUBLIC.command`** (garde la fenêtre ouverte)
3. Copie le lien affiché dans l'onglet **Portail client** et envoie-le au client

Guide complet (PIN, ce que voit le client, arrêt du tunnel) :
[`PORTAIL_PUBLIC.md`](./PORTAIL_PUBLIC.md)

---

## 9. Où sont tes clients ?

Sur le Bureau, dossier :

```
Eonora Tech OS Database
```

(parfois encore nommé « Marion Web OS Database » sur d’anciennes installs)

Ne le supprime pas. C’est là que vivent clients, tâches et factures.

---

## 10. Agenda se déconnecte souvent ?

Si le bandeau **« Reconnecter »** revient régulièrement dans l'Agenda (plus d'une fois par semaine) :

- Ce n'est pas un bug de l'app — c'est un réglage côté Google Cloud que seul **Johan** peut changer (publier l'app OAuth Google, mode Testing → Production).
- Préviens Johan : *« Agenda se déconnecte souvent »*.
- En attendant, si tes rendez-vous Infomaniak sont déjà configurés, ils continuent de s'afficher normalement dans l'Agenda — seule la synchro Google est temporairement coupée.

---

## 11. Checklist Johan — OAuth Google

*(Section pour Johan, pas pour Marion — la garder ici pour ne pas la perdre.)*

Pour que l'Agenda de Marion arrête de se déconnecter tous les quelques jours, il faut publier l'app OAuth Google (mode **Testing → Production**). Détail complet :
[`GOOGLE_OAUTH_EONORA.md`](./GOOGLE_OAUTH_EONORA.md) § *« Déconnexions fréquentes ? Passer en Production »*.

1. [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) → **PUBLISH APP** (passer de **Testing** à **Production**)
2. **Reconnecter Agenda** une fois sur le Mac de Marion (Paramètres → Agenda → reconnecter Google Calendar)
3. Cocher ici quand fait : [ ]

---

## 12. Bug ? Qui appeler / quoi envoyer

Contact : **Johan**

Envoie :

1. Une **capture d’écran** de l’erreur
2. Le fichier **`.marion.log`** (à la racine du dossier projet)  
   ou les logs dans :  
   `~/Library/Application Support/Eonora Tech OS/logs/`

**Ne jamais envoyer** le fichier `.env` / `MARION-env.local` (secrets).

---

## Raccourcis utiles

| Action | Fichier / geste |
|--------|-----------------|
| Lancer | Double-clic **Eonora Tech OS** |
| Arrêter | `STOPPER_EONORA.command` |
| Mettre à jour | `METTRE_A_JOUR.command` + Cmd+Shift+R |
| Réparer écran blanc | `REPARER_INTERFACE.command` |
| Réinit. mot de passe | `REINITIALISER_MOT_DE_PASSE.command` |
| Partager le portail client | `LANCER_PORTAIL_PUBLIC.command` / `STOPPER_PORTAIL_PUBLIC.command` |

Guide install complet : [`INSTALL_EONORA.md`](./INSTALL_EONORA.md)  
Guide portail public (lien client) : [`PORTAIL_PUBLIC.md`](./PORTAIL_PUBLIC.md)  
Checklist QA v2.9.2 : [`QA_RELEASE_v2.9.2.md`](./QA_RELEASE_v2.9.2.md)
