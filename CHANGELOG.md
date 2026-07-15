# Journal des Modifications (Changelog)

Toutes les modifications notables de **Marion CRM / Eonora Tech OS** seront documentées dans ce fichier.

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
