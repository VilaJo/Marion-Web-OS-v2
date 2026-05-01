# Release v2.5.0 — "Marion 2030 Edition"

Date : 1er mai 2026
Theme : Marion devient une **Web Designer 2030** — Cursor / Claude / IA partout.

---

## 🚀 Nouveautés majeures

### 1. Bibliothèque de Prompts Cursor / Claude — `/prompts`
Une bibliothèque dédiée pour stocker, organiser et améliorer ses meilleurs prompts.
- Catégories : Cursor, Claude, Tailwind, React, SaaS, E-commerce, Portfolio…
- Recherche, tags, notes, copie en 1 clic.
- **Amélioration IA** : Gemini réécrit le prompt pour le rendre plus efficace.
- Persistance locale + bouton "Restaurer les défauts".

### 2. Veille Marché hebdomadaire — `/market-watch`
Chaque semaine, Gemini (avec Google Search grounding) génère un brief :
- 6 tendances UI/UX, technos, IA, business, outils, inspiration.
- Score d'impact (high / medium / low) + action concrète pour Marion.
- Cache local 7 jours pour éviter les requêtes inutiles.

### 3. Analyse Concurrentielle — onglet "🔍 Concurrents" dans la fiche client
- Marion entre 2 à 3 URLs de concurrents.
- Gemini analyse via Google Search : forces / faiblesses / score / 3 opportunités / recommandation stratégique.
- **Persistance par projet** : les analyses sont sauvegardées et rechargées avec un badge "Sauvegardé il y a Xj".

### 4. Pricing Intelligence — onglet Finance
- Estimation IA d'une fourchette de prix alignée sur le marché (pays, secteur, complexité).
- Décomposition design / dev / suivi avec justification.

### 5. Rapport IA d'avancement — onglet "📊 Rapport IA"
- État de santé du projet (on_track / at_risk / delayed / completed).
- Pourcentage, points forts, prochaines étapes prioritaires, bloqueurs, statut financier.

### 6. Générateur de Case Study — onglet "📄 Case Study" (visible uniquement en fin de projet)
- Contexte / Problème / Solution / Résultats / Technologies.
- Génère aussi un **post LinkedIn** prêt à publier.

### 7. Templates de projet
- 5 templates pré-remplis (Landing SaaS, E-commerce, Portfolio, Refonte, Site vitrine).
- Crée le projet avec ses tâches, sa timeline et **suggère automatiquement les prompts Cursor associés** dans la bibliothèque.

### 8. Génération d'images dans MediaStudio
- Nouveau panneau "Générer" avec Imagen 3.0.
- Choix du style (photo, illustration, flat, mockup, watercolor) et du ratio.
- L'image générée est chargée directement dans l'éditeur pour ajustements.

### 9. Prospection internationale — `/prospection`
- Apollo.io comme source primaire (clé API gérée dans Settings).
- Fallback Gemini quand crédits épuisés.
- Templates d'outreach personnalisables, scoring de leads, import direct vers le Kanban.

### 10. FranckChat → Lead dev virtuel
- **Code Mode** : éditeur multi-ligne, syntax highlighting, copie de code en 1 clic.
- Commandes spécifiques : review, debug, refactor, génération Tailwind/React.
- État du Code Mode persisté entre les sessions.

### 11. Claude (Anthropic) comme 3ème provider IA
- Settings → IA & Assistants → ajout de la clé Anthropic.
- Modèles à jour : `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-7`.

---

## 🐛 Bugs critiques corrigés

| # | Bug | Statut |
|---|---|---|
| 1 | `405 Method Not Allowed` sur `/api/v1/ai/market-watch` (double-prefix `/api/v1/api/v1`) | ✅ |
| 2 | `React error #130` dans Settings → IA & Assistants (icône `Mail` non importée) | ✅ |
| 3 | Drag & Drop Kanban : tâches déposées dans la mauvaise colonne | ✅ (custom collision detection) |
| 4 | `401 Unauthorized` sur Google Meet : token expiré non détecté | ✅ (validation `tokeninfo` côté backend) |
| 5 | `claude-3-5-haiku-latest` retiré chez Anthropic | ✅ (modèles 4.x) |
| 6 | `MediaStudio.tsx` modifié n'était PAS celui utilisé (vrai fichier dans `components/media/`) | ✅ |
| 7 | Bibliothèque de prompts revenait aux défauts après suppression manuelle | ✅ (marker `initialized`) |
| 8 | Onglet Case Study toujours visible (n'a de sens qu'en fin de projet) | ✅ |
| 9 | Pricing IA dans Rapport IA (mal placé) → déplacé dans Finance | ✅ |
| 10 | Analyses concurrentielles perdues à chaque navigation | ✅ (persistance par projet ID) |
| 11 | Code Mode de Franck non persisté | ✅ (localStorage) |
| 12 | Boutons /prompts et /market-watch sans état actif dans le header | ✅ |
| 13 | Imagen 3.0.001 (legacy) | ✅ (fallback automatique 002 → 001) |
| 14 | Endpoints AI ne vérifiaient pas si Gemini est configuré (crash silencieux) | ✅ (503 explicite) |
| 15 | `anthropic` absent de `requirements.txt` | ✅ |
| 16 | Templates de projet ne suggéraient pas les prompts Cursor associés | ✅ (auto-import dans la bibliothèque) |

---

## 🛠️ Stack & infra

- React 18, TypeScript strict, Tailwind, Zustand, dnd-kit, Vite.
- Flask 3, SQLite, Gemini 2.0 Flash + Imagen 3.0, Anthropic Claude SDK.
- Build : `npm run build` (toujours < 5 sec, bundle React < 110 KB gzip).

---

## ✅ Vérifications avant release

- [x] `npx tsc --noEmit` → 0 erreur
- [x] `npm run build` → succès, 3.5s
- [x] `python -m py_compile` sur tous les fichiers Python modifiés → succès
- [x] Vérification des routes Flask → aucun double-prefix
- [x] Pas de `console.log` orphelins en production
- [x] ReadLints sur les 15 fichiers modifiés → aucune erreur

---

## 📦 Versions liées

- Précédent : v2.4.7 (Meeting Copilot v2)
- Suivant : v2.5.x (patches mineurs)
