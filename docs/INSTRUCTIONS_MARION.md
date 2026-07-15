# Eonora Tech OS — Instructions Marion (v2.8.0)

Une page pour le quotidien. Garde ce fichier à portée de main.

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

## 8. Où sont tes clients ?

Sur le Bureau, dossier :

```
Eonora Tech OS Database
```

(parfois encore nommé « Marion Web OS Database » sur d’anciennes installs)

Ne le supprime pas. C’est là que vivent clients, tâches et factures.

---

## 9. Bug ? Qui appeler / quoi envoyer

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

Guide install complet : [`INSTALL_EONORA.md`](./INSTALL_EONORA.md)  
Checklist QA v2.8.0 : [`QA_RELEASE_v2.8.0.md`](./QA_RELEASE_v2.8.0.md)
