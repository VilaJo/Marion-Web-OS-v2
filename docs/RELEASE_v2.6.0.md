# Release v2.6.0 — "Marion 2030 Atelier Edition"

Date : 2 mai 2026
Theme : **De WordPress à Cursor** — l'atelier complet pour aider Marion dans sa transition.

---

## 🎯 Vision

Marion a passé 10 ans sur WordPress. Aujourd'hui elle réinvente sa pratique avec Cursor, Tailwind et React. Cette release transforme Marion Web OS en **véritable atelier de transition** : 12 nouveaux outils, 5 vagues, zero infra externe (pas de Playwright, pas de scraping). Tout repose sur des screenshots uploadés + Gemini multimodal + Claude Opus 4.7 pour le code review + PageSpeed Insights pour les vrais Lighthouse scores.

---

## 🚀 Nouveautés majeures

### Vague 1 — Atelier Refonte WP (les 3 killers)

#### 1. Atelier Refonte WP — `/wp-studio`
Le **killer feature** de la release. Wizard 3 étapes :
1. Marion entre les infos du site WP + uploade les screenshots ordonnés (1 par section)
2. Gemini analyse en multimodal et génère le plan de refonte
3. Plan structuré avec design tokens (couleurs, typo, spacing), suggestion de stack, sections détaillées avec **prompts Cursor prêts à coller**, et tâches Kanban à importer en 1 clic
- Historique des refontes en sidebar.
- Téléchargement du plan en Markdown.

#### 2. Screenshot to Prompt — composant réutilisable
- Drag & drop d'une image, paste depuis le presse-papier.
- Gemini retourne un prompt Cursor prêt à coller avec spécifications design + tags.
- Bouton "Sauver dans la bibliothèque de prompts".
- Intégré dans WP Studio (sidebar).

#### 3. Avant / Après — onglet 🪞 dans la fiche client
- 2 zones d'upload : Original WordPress + Recreation Cursor.
- Score de fidélité global + par dimension (couleurs, typo, spacing, responsive).
- **Punch list** des écarts avec sévérité (high/medium/low) et fix suggéré.
- Bouton "Marquer comme corrigé" pour traquer la progression.
- Historique des comparaisons par projet.

---

### Vague 2 — Knowledge Base WordPress → React

#### 4. Recettes WP → React — `/recipes`
12 patterns prêts à coller :
- ACF, Contact Form 7, WooCommerce, Yoast SEO, Elementor, WP Menu, Custom Post Types, WP Loop, Permalinks, Widgets, Shortcodes, Hooks.
- Chaque recette : terme WP / équivalent moderne / snippet code copy-able / prompt Cursor associé.
- Recherche + filtre par catégorie.
- Marion peut ajouter ses propres recettes (persisté en localStorage).

#### 5. Glossaire WP — composant + slash command
- Tape `/wp <terme>` dans Franck, l'IA te donne l'équivalent moderne + définition + exemple de code + piège à éviter + lien doc.
- Cache localStorage par terme pour éviter les appels répétés.
- Intégré aussi dans la sidebar des Recettes.

---

### Vague 3 — Productivité long terme

#### 6. Component Catalog — `/components`
- Sauvegarde tes snippets favoris (Hero, Pricing, Footer newsletter…).
- **Preview iframe sandbox** avec toggle dark mode + mobile (375px).
- Code JSX/Tailwind, tags, projet source.
- Export / Import en JSON pour synchroniser entre devices.

#### 7. Code Review par Claude Opus 4.7 — composant
- Colle ton code, choisis le framework et les axes (a11y, DRY, responsive, dark mode, perf, naming).
- Claude produit un score global + une punch list d'issues avec explication et fix suggéré.
- Tracking des issues résolues (compteur dans `marion_code_review_stats`).
- **Intégré dans Franck** (bouton "🦾 Claude Opus" en code mode) et dans la page Skills.

#### 8. Stack Picker — `/stack-picker`
- Wizard 4 questions (CMS ? E-commerce ? Multilingue ? Complexité ?).
- Gemini recommande une stack primaire + une alternative.
- **Commande de scaffold** prête à coller (`npx create-next-app`, etc.).
- Lib UI, CMS, e-commerce, deploy, raisons + pièges à éviter.
- Historique des picks par projet.

---

### Vague 4 — Apprentissage continu

#### 9. Leçon du jour — widget Dashboard
- Carte "Leçon du jour" en haut du Dashboard.
- Gemini génère une mini-leçon de 5 min : titre, explication, code example, **challenge Cursor**.
- **Streak system** + badges 3 jours / 7 jours / 30 jours.
- Persisté par jour pour ne pas re-générer.

#### 10. Skills Radar — `/skills`
- Vue radar 8 axes : Tailwind, React Hooks, Next.js Routing, Server Components, Animations, Cursor Mastery, Git/Vercel, A11y/Perf.
- Auto-évaluation 1-5 par axe.
- Suggestion automatique du **skill du mois** (le plus faible).
- Bouton "Génère un exercice ciblé" pour la skill choisie (utilise `/ai/daily-lesson`).
- **CodeReviewPanel inline** pour pratiquer.

---

### Vague 5 — Business

#### 11. Audit Prospect WP — `/audit-wp`
- Marion colle l'URL d'un site WordPress prospect.
- L'app appelle **Google PageSpeed Insights API** (vrais Lighthouse scores), détecte les plugins/builders, puis demande à Gemini de générer :
  - Risques sécurité / SEO / performance.
  - **Coût annuel WP estimé vs site sur-mesure** (hébergement + maintenance + plugins + mises à jour).
  - Opportunités commerciales.
  - **Argumentaire de vente prêt-à-pitcher** (markdown copy-able + version email).
- Devient l'arme numéro 1 de Marion en RDV prospect.

#### 12. Pre-deploy Checklist — onglet 🚀 dans la fiche client
- Marion colle l'URL d'une preview Vercel.
- L'app vérifie : meta tags (title, description, OG), favicon, sitemap.xml, robots.txt + lance un mini Lighthouse.
- Checklist visuelle pass/fail + barre de progression + verdict global.

---

## 🛠 Backend

### Nouveaux blueprints
- `api/wp_studio_bp.py` — `/ai/wp-studio/*` (analyze-site, screenshot-to-prompt, compare-screenshots, import-tasks, history)
- `api/audit_bp.py` — `/audit/*` (wp-prospect, deploy-check)

### Nouveaux endpoints dans `api/ai_bp.py`
- `POST /ai/code-review` — Claude Opus 4.7
- `POST /ai/stack-picker`
- `POST /ai/wp-glossary/lookup`
- `POST /ai/daily-lesson`

---

## 🎨 Frontend

### Nouvelles pages
- `pages/WpStudioPage.tsx`
- `pages/RecipesPage.tsx`
- `pages/ComponentCatalogPage.tsx`
- `pages/StackPickerPage.tsx`
- `pages/SkillsPage.tsx`
- `pages/AuditWpPage.tsx`

### Nouveaux composants
- `components/ScreenshotToPrompt.tsx`
- `components/BeforeAfterCompare.tsx`
- `components/CodeReviewPanel.tsx`
- `components/WpGlossary.tsx`
- `components/DeployChecklist.tsx`
- `components/DailyLessonCard.tsx`

### Modifications
- `router.tsx` — 6 nouvelles routes lazy-loadées.
- `components/AppHeader.tsx` — menu déroulant **"Atelier"** (icône 🔨) regroupant les 6 nouveaux outils.
- `components/ClientView.tsx` — onglets 🪞 Avant/Après + 🚀 Pre-deploy.
- `components/FranckChat.tsx` — slash command `/wp` + bouton Claude Opus.
- `pages/Dashboard.tsx` — widget DailyLessonCard.

---

## 🧠 Décisions techniques

1. **Pas de Playwright** : tout passe par des screenshots uploadés (Gemini multimodal).
2. **PageSpeed Insights API** publique pour Lighthouse (gratuite, sans clé).
3. **Claude Opus 4.7** pour le code review (raisonnement code > Gemini Flash).
4. **Persistence mixte** : `workspace_settings` pour ce qui doit suivre Marion (stats, historiques), `localStorage` pour le cache éphémère (glossary, daily lesson, component catalog).
5. **Aucune migration DB** — tout passe par `workspace_settings.settings_json` existant.

---

## 📦 Upgrade

```bash
git pull
pip install -r requirements.txt
npm install
npm run build
```

Bonne refonte, Marion ! 🔨💜
