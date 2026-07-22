# Journal des Modifications (Changelog)

Toutes les modifications notables de **Marion CRM / Eonora Tech OS** seront documentées dans ce fichier.

## [2.10.2] - 2026-07-22
### Unification palette Eonora — fin des incohérences
- **Cohérence visuelle** : chasse aux couleurs parasites (violets/indigos/fuchsias « IA », orangés/ambres résiduels, dégradés arc-en-ciel) sur toute l'interface. Tout le chrome de marque parle désormais la même langue Eonora : crème `#FAF7F2`, sage `#7C9A7E`, et dégradé signature `linear-gradient(120deg, #b05070 0%, #4a72c4 55%, #2aada0 100%)`.
- **Surfaces harmonisées** : header, écran de connexion/onboarding, Franck (chat + coach Focus + bouton flottant), briefing, e-mails, prospection (Apollo), bibliothèque de prompts, Code Review, WP Studio / Screenshot → Prompt, veille marché, réglages (IA & sécurité), portail client, Meeting Mode, notes rapides, timelines de projet, splash & PWA — tous alignés.
- **Garde-fou tokens** : remappage des échelles Tailwind `indigo → bleu Eonora` et `violet`/`purple`/`fuchsia → rose Eonora` (en plus de `orange → sage`) dans `index.html`. Les classes héritées restent automatiquement dans la palette ; un `from-purple-… to-indigo-…` devient rose→bleu (signature).
- **Dégradés signature** : héros, en-têtes IA et CTA phares passent tous par `bg-eonora-gradient` (120°, rose→bleu→teal).
- **Conservé volontairement** : statuts sémantiques (vert/rouge/jaune), couleurs fournisseurs remappées sur la palette (Gemini bleu, Claude rose), rotations d'avatars/catégories, et `InvoiceBuilder` (non retouché).
- Docs : section « couleurs interdites / à utiliser » ajoutée dans `docs/brand/README.md`.

## [2.10.1] - 2026-07-21
### Correctif — dégradé signature
- **Couleurs** : correction du dégradé signature Eonora qui utilisait les mauvaises teintes. Le dégradé de marque reprend désormais les couleurs exactes du logo « Eonora Tech » : `linear-gradient(120deg, #b05070 0%, #4a72c4 55%, #2aada0 100%)` (rose/plum → bleu → teal).
- **Tokens** : `--eonora-rose` (`#b05070`), `--eonora-blue` (`#4a72c4`), `--eonora-teal` (`#2aada0`) et alias Tailwind `eo-rose` / `eo-blue` / `eo-teal` ; mise à jour de `eonora-gradient`, `marion-gradient`, `sunset-gradient`.
- **Impact** : accents, logo, en-têtes de briefing, pastilles d'accentuation (Paramètres) et confettis alignés sur le bon dégradé. Fond crème (`#FAF7F2`) et boutons sage (`#7C9A7E`) inchangés. `InvoiceBuilder` non touché.

## [2.10.0] - 2026-07-20
### Refonte visuelle — charte graphique Eonora Tech
- **Identité** : application de la charte officielle Eonora Tech sur toute l'interface — fond crème ultra-épuré (`#FAF7F2`), boutons **sage** (`#7C9A7E`) et **dégradé signature** violet → bleu → cyan (`#7C3AED → #3B82F6 → #22D3EE`) pour les accents, logo et surbrillances.
- **Mode sombre** : passage à un **charbon** profond (`#1A1C20`) avec cartes contrastées (`#23262B`) et accents sage, à la place de l'ancien thème « espace » coloré (planètes masquées, étoiles atténuées).
- **Système de couleurs** : tokens centralisés (`--eonora-bg`, `--eonora-sage`, `--eonora-charcoal`, `--eonora-gradient`) et remappage de l'ancienne palette orange vers le sage — un seul changement se répercute partout (boutons, badges, survols, ombres).
- **Écran de connexion / déverrouillage** : fond crème, bouton sage, accents à jour.
- **Accent personnalisable** : la couleur d'accentuation par défaut devient le sage ; nouvelles pastilles alignées sur le dégradé (sage, violet, bleu, cyan). L'ancien orange est migré automatiquement.
- **Facturation** : l'InvoiceBuilder est laissé tel quel (à la demande de Marion) — il hérite uniquement des tokens globaux, sans refonte.
- Docs : charte graphique ajoutée dans `docs/brand/` (image + README).

## [2.9.2] - 2026-07-20
### Fiabilité suite — portail live, sécurité IA, factures PDF
- **Portail client** : bandeau live dans l'onglet Portail client — distingue « aperçu local », « lien public inactif » (tunnel coupé) et « lien public actif » (badge vert), avec vérification automatique toutes les 20 secondes (`GET /api/v1/portal/tunnel-status`).
- **IA** : Claude Opus (Code Review) masqué automatiquement tant qu'aucune clé Anthropic n'est configurée — plus de bouton ou de panneau « fantôme » pour Marion (Franck, Compétences).
- **IA** : le mode d'exécution est verrouillé sur **Cloud** — Hybride et Local sont grisés (usage avancé, pas pour Marion) ; toute ancienne préférence locale « hybrid »/« local » est ramenée à « cloud ».
- **Emails** : « Joindre facture… » génère maintenant un vrai **PDF** (numéro, client, montant, échéance, détail des prestations) au lieu d'un simple `.txt`.
- **Atelier** : infobulle clarifiée — « Outils avancés (WP Studio, refontes) », pour rappeler que ce n'est pas un usage quotidien.
- Docs : checklist QA v2.9.2, checklist Johan pour publier l'app OAuth Google, note de cadrage pour un portail 24/7 indépendant du Mac de Marion (`docs/PORTAIL_24H.md`).

## [2.9.1] - 2026-07-20
### Fiabilité : retirer le faux, clarifier l'Agenda
- **Messagerie (WhatsApp/SMS)** : retirée de l'en-tête et du menu mobile — c'était une démo 100% locale (aucun message n'était réellement envoyé). Le composant reste dans le code mais n'est plus accessible, pour éviter que Marion pense avoir envoyé un message à un client.
- **Dropbox** : carte retirée des Paramètres — le bouton « Connecter » ne faisait qu'activer un faux statut en local, sans connexion réelle. Google Drive (sauvegarde + OAuth réel) reste inchangé.
- **Agenda** : bannière de déconnexion Google Calendar reformulée (distingue « jamais connecté » de « jeton expiré, à reconnecter ») et indique quand les événements Infomaniak restent disponibles pendant la coupure Google. Le mode immersion affiche aussi l'état Google dans la liste des agendas, avec reconnexion en un clic.
- Doc : nouvelle note pour Johan sur la publication de l'app OAuth Google (Testing → Production) en cas de déconnexions fréquentes (`docs/GOOGLE_OAUTH_EONORA.md`, `docs/troubleshooting.md`, `docs/INSTRUCTIONS_MARION.md`).

## [2.9.0] - 2026-07-16
### Portail client : lien officiel (Cloudflare Tunnel)
- Nouveau : partage du portail client via un vrai lien HTTPS (Cloudflare Tunnel), sans ouvrir de port
- Sécurité : sessions du portail client stockées en base (au lieu de la mémoire), limite anti-brute-force sur le code PIN (5 essais / 15 min)
- Sécurité : les routes admin de documents du portail exigent désormais l'authentification Marion
- `LANCER_PORTAIL_PUBLIC.command` / `STOPPER_PORTAIL_PUBLIC.command` pour démarrer/arrêter le tunnel
- Message d'avertissement dans l'onglet Portail client quand le lien n'est encore qu'un aperçu local
- Nouveau guide : `docs/PORTAIL_PUBLIC.md`

## [2.8.1] - 2026-07-15
### Ma journée, Franck & Emails
- « Ma journée » : CTA Briefing / Franck / Emails, prompts rapides pré-remplis pour Franck
- Franck : les suggestions proactives (relances factures) ouvrent directement un email pré-rempli
- Correction d'un bug d'envoi de la voix / du prompt de Franck (référence cassée)
- Emails : réponse « Relancer » depuis Ma journée / Franck arrive déjà en brouillon
- Emails : bouton « Joindre facture… » pour attacher un résumé de facture ouverte
- Emails : bannière claire en cas d'erreur de connexion IMAP + icône grise si non connecté
- Guide : nouvelle section « En cas de souci » (Franck, emails, scripts .command)
- Écran « Marion ne se connecte pas » : explications plus claires et actionnables

## [2.8.0] - 2026-07-15
### Quotidien Marion
- Franck vocal + chat Gemini plus fiables
- App Bureau sans fenêtre Terminal
- Veille Marché (Gemini) réparée
- Mises à jour plus sûres (moins d’écrans blancs après MAJ)
- Fiche instructions Marion + checklist QA release

## [1.2.0] - 2025-12-06
### ✨ Nouveautés (Features)
- **Atelier Média Pro** : Refonte complète de l'outil.
  - Ajout du moteur **Pillow** (Python) pour un traitement d'image haute qualité.
  - **Détourage automatique** : Suppression du fond blanc pour créer des logos transparents.
  - **Presets intelligents** : Post Instagram, Story, Bannière LinkedIn, Header Email.
  - **Mode Custom** : Redimensionnement et conversion (WebP/PNG/JPG) sur mesure.
  - **Extracteur de Palette v2** : Analyse algorithmique des couleurs dominantes réelles.
- **Reporter de Bugs** : Ajout d'un bouton 🐞 (en bas à gauche) pour signaler les problèmes directement sur GitHub.
- **Installation** : Nouveau guide d'installation interactif (`GUIDE_INSTALLATION.html`).

### ⚡ Améliorations
- **Architecture** : Migration du serveur sur le port 5003 pour éviter les conflits système macOS.
- **Performance** : Optimisation du build Frontend (Vite/React).
- **UI** : Affichage en grille des presets de l'Atelier Média pour une meilleure lisibilité.

### 🐛 Corrections
- Correction des conflits de dépendances Storybook.
- Correction de l'affichage des caractères spéciaux dans les boutons d'action.

---

## [1.1.0] - 2025-12-05
### ✨ Nouveautés
- **File Dispatcher** : Système de tri intelligent des fichiers par IA (Gemini).
- **Importateur** : Scan automatique des dossiers du bureau.

---

## [1.0.0] - 2025-12-01
- Lancement initial de Marion CRM.
- Dashboard, Agenda, CRM Client, Facturation.
