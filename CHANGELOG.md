# Journal des Modifications (Changelog)

Toutes les modifications notables de **Marion CRM** seront documentées dans ce fichier.

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
