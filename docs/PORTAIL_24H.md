# Portail client 24/7 — Cadrage (non implémenté)

> Ce document cadre ce qu'il faudrait pour que le lien du portail client fonctionne
> **même quand le Mac de Marion est éteint ou en veille**. Rien n'est implémenté ici —
> c'est une note de cadrage pour une décision future (Johan + Marion).

---

## Contexte

Depuis la v2.9.0, le portail client est exposé via un **tunnel Cloudflare**
(`packaging/cloudflare_tunnel.sh`, lancé par `LANCER_PORTAIL_PUBLIC.command`).

Ce tunnel fonctionne très bien, mais il a une limite structurelle : il relie
Internet au serveur Flask qui tourne **sur le Mac de Marion**
(`127.0.0.1:5003`). Si le Mac est éteint, en veille, ou si le tunnel est
arrêté, le lien public répond une erreur — même si `PUBLIC_BASE_URL` reste
configuré.

**24/7 signifie une chose précise : le portail ne peut plus dépendre du Mac de
Marion.** Il faut un hébergement indépendant, toujours en ligne.

---

## Prérequis avant d'envisager le 24/7

1. **Synchroniser les données du portail** (tables SQLite `portal_*` +
   fichiers de `static/portal_uploads/`, `static/portal_deliverables/`,
   `static/portal_documents/`) vers un service toujours en ligne.
2. **Phases 1 et 2 de cette suite stables en production** (bandeau tunnel
   fiable, QA passée) — inutile de bâtir du 24/7 sur des fondations pas
   encore éprouvées au quotidien.
3. Une décision claire sur le modèle de coût (hébergement payant récurrent
   vs. gratuit avec limites).

---

## Options d'implémentation (non tranchées)

### Option A — Déploiement indépendant (recommandé à terme)

Utiliser le `Dockerfile` existant à la racine du projet — déjà prêt pour la
production (`gunicorn`, volume `/data` pour la persistance SQLite) :

```
Dockerfile
```

Déployer ce conteneur sur un service toujours en ligne :

- **Railway** ou **Fly.io** — déploiement simple, volume persistant géré,
  coût faible pour un usage mono-client.
- **VPS** (Hetzner, Infomaniak, etc.) — plus de contrôle, plus de
  maintenance manuelle (mises à jour OS, certificats, etc.).

Dans ce scénario, le portail vivrait sur son propre serveur, indépendant du
Mac de Marion. Il faudrait alors synchroniser (ou migrer) les données
clients concernées vers ce service.

### Option B — Synchronisation hybride

Garder le serveur principal sur le Mac de Marion (comme aujourd'hui) mais
synchroniser en tâche de fond les données du portail (livrables, commentaires,
fichiers clients) vers une petite instance cloud dédiée au portail public
uniquement. Le Mac reste la source de vérité ; le cloud n'héberge qu'une
copie "vitrine" pour le client.

Plus complexe à maintenir (double écriture, risque de désynchronisation),
mais évite de migrer toute la logique métier (facturation, projets, etc.)
hors du Mac.

---

## Critère de GO

**Marion doit pouvoir donner le lien du portail à un client, éteindre son
Mac, et le client peut toujours ouvrir le lien.** Tant que ce n'est pas
vrai, le 24/7 n'est pas atteint — le tunnel actuel (Phases 1+2) reste la
solution "portail actif pendant que le Mac tourne".

---

## Statut

**Non implémenté.** Dépend de la stabilité des Phases 1 (bandeau tunnel live)
et 2 (QA release) de la suite Fiabilité v2.9.2. À rouvrir une fois ces deux
phases validées en usage réel par Marion.
