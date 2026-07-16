# Portail client — Lien public (Cloudflare Tunnel)

Ce guide explique comment partager le portail client avec un vrai lien HTTPS,
utilisable par le client depuis n'importe où (pas seulement depuis le Mac de
Marion). Le tunnel Cloudflare ouvre ce lien **sans jamais ouvrir de port** sur
la box internet — c'est sécurisé par design.

---

## 1. Prérequis

- **`cloudflared` installé** sur le Mac. Pour vérifier ou installer :

  ```bash
  brew install cloudflared
  ```

  (Si `brew` n'est pas installé, voir [brew.sh](https://brew.sh) ou télécharger
  le binaire directement sur
  [github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases).)

- **Eonora Tech OS doit être lancé** (double-clic sur l'icône, comme d'habitude).
  Le tunnel ne fait que relier ce serveur local à Internet — il ne le remplace pas.

---

## 2. Activer le portail pour un projet

1. Ouvre le projet concerné.
2. Va dans l'onglet **Portail client**.
3. Active le bouton **Activé** en haut à droite (il devient vert).
4. Un lien apparaît dans le cadre orange, avec un bouton **copier**.

Tant que le tunnel n'est pas démarré, un message orange rappelle :
*« Aperçu local uniquement — activez le tunnel pour partager ce lien »*.
Le lien fonctionne quand même en local (pour tes tests), mais pas encore pour le client.

---

## 3. Démarrer le tunnel

Double-clic sur **`LANCER_PORTAIL_PUBLIC.command`** (à la racine du dossier projet).

- La fenêtre vérifie que l'app tourne, puis démarre le tunnel Cloudflare.
- Elle affiche le lien public dès qu'il est prêt (quelques secondes).
- **Laisse cette fenêtre ouverte** : c'est elle qui garde le tunnel actif et
  affiche son état en direct.

Une fois démarré, retourne dans l'onglet **Portail client** : le message
orange disparaît et le lien affiché est maintenant le vrai lien public.

---

## 4. Copier le lien HTTPS et le partager au client

Dans l'onglet **Portail client** :

1. Clique sur l'icône **copier** à côté du lien.
2. Colle-le dans un email ou un message pour ton client.
3. Si tu as défini un **code PIN**, transmets-le séparément (pas dans le même message).

---

## 5. Ce que voit le client

Le client arrive sur une page dédiée, sans rien voir du reste de l'app :

- **Code PIN** (si activé) pour accéder au portail.
- **Livrables** : sites, maquettes Figma, fichiers, liens partagés par Marion.
- **Suivi de projet** : timeline, tâches en cours, mises à jour publiées.
- **Commentaires** : le client peut écrire, Marion peut répondre.
- **Fichiers reçus** : le client peut envoyer des fichiers (logo, textes, etc.).
- **Mon Compte** (si activé) : contrat, factures, documents (devis, etc.).

---

## 6. Si le Mac est éteint

Le lien public **ne fonctionne que quand le Mac de Marion est allumé, l'app
lancée et le tunnel actif**. Si le Mac est éteint ou en veille :

- Le client verra une erreur de connexion sur le lien.
- **Prévenir le client** si le portail doit rester accessible en dehors des
  heures de travail (ex. horaires de bureau uniquement).

Pour un lien qui reste disponible en permanence, il faudrait un Mac (ou
serveur) allumé 24h/24 — ce n'est pas nécessaire pour un usage normal.

---

## 7. Arrêter le tunnel

Double-clic sur **`STOPPER_PORTAIL_PUBLIC.command`**.

- Le lien public cesse de fonctionner immédiatement.
- Le portail reste utilisable en local, sur le Mac de Marion uniquement.
- Fermer simplement la fenêtre du tunnel ne l'arrête **pas** — utilise bien ce script.

---

## Raccourcis utiles

| Action | Fichier |
|--------|---------|
| Démarrer le tunnel | `LANCER_PORTAIL_PUBLIC.command` |
| Arrêter le tunnel | `STOPPER_PORTAIL_PUBLIC.command` |
| Activer/copier le lien | Onglet **Portail client** → bouton **Activé** |

Configuration avancée (tunnel nommé avec compte Cloudflare, lien fixe) :
voir les variables `PUBLIC_BASE_URL` et `CLOUDFLARE_TUNNEL_TOKEN` dans `.env.example`.
