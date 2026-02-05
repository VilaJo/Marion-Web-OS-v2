# Marion Web OS 🚀

### Le "Business OS" Local-First pour Freelances Créatifs.

> **Plus qu'un CRM, c'est un cockpit de pilotage complet.** 
> Il fusionne gestion de projet, finance, et créativité, le tout propulsé par une IA contextuelle. Conçu pour remplacer la multitude d'outils SaaS par une solution unique, locale et sécurisée.

---

## 💡 La Vision : Pourquoi cet outil ?

Les freelances jonglent entre Notion, Trello, Drive et Excel. C'est fragmenté et les données sont éparpillées dans le Cloud.

**Marion Web OS** propose une nouvelle approche :
1.  **Local-First & Sécurité :** Toutes les données (clients, fichiers, factures) sont stockées en JSON et dossiers sur la machine de l'utilisateur. **Zéro dépendance Cloud**, souveraineté totale des données.
2.  **Design "Métier" :** L'interface n'est pas générique. Elle intègre des outils spécifiques aux designers (Moodboards, palettes couleurs, gestion de fichiers lourds).
3.  **Intelligence Embarquée :** L'assistant IA "Franck" (Google Gemini) est câblé directement sur le système de fichiers pour automatiser le tri et l'analyse.

## ✨ Fonctionnalités "Signature"

### 🌍 Agenda International Contextuel
Pour les nomades digitaux. Saisissez **"RDV demain 9h Mexico"**, et le système :
*   Détecte le fuseau horaire cible.
*   Convertit instantanément l'heure pour votre position actuelle (Genève).
*   Affiche visuellement le créneau correct sur votre grille.

### 🎨 Studio Créatif (Moodboard)
Chaque client dispose d'un espace "Créatif" persistant.
*   **Drag & Drop** d'images d'inspiration.
*   Sauvegarde des **Palettes de couleurs** (Hex) et **Typographies**.
*   Tout reste lié au dossier client sur le disque dur.

### 🧠 Assistant IA "Franck"
*   **Tri automatique** des fichiers téléchargés (déplace les factures et briefs dans les bons dossiers clients).
*   **Analyse contextuelle** des projets pour suggérer les prochaines tâches.

---

## 🛠 Stack Technique (Sous le capot)

Une architecture hybride conçue pour la performance d'une SPA (Single Page App) avec la puissance d'accès d'une application native.

*   **Frontend :** React 19, TypeScript, Vite.
*   **Styling :** Tailwind CSS (Architecture de composants, Dark/Light Mode, Animations CSS).
*   **Backend Local :** Python 3.12 (Flask) servant de passerelle système (OS Bridge).
*   **IA Engine :** Google Gemini Pro (via SDK Python).
*   **Persistence :** Filesystem Database (JSON structuré).

---

## 📋 Installation (Pour Développeurs)

```bash
# 1. Cloner le repo
git clone https://github.com/VilaJo/Marion-CRM-v1.0.git

# 2. Lancer l'installateur (Setup venv & npm)
./INSTALLER.command

# 3. Démarrer le système
./LANCER_MARION.command
```

---

## 🎨 Galerie & Thèmes

L'interface s'adapte à l'humeur du créatif.

### ☀️ Mode Professionnel (Light)
*Pour les présentations clients et la clarté.*
<div align="center">
  <img src="screenshots/dashboard_light.jpeg" alt="Dashboard Light" width="48%">
  <img src="screenshots/client_view_light.jpeg" alt="Client Light" width="48%">
</div>

### 🌌 Mode Espace (Dark)
*Pour le "Deep Work" et les sessions de code nocturnes.*
<div align="center">
  <img src="screenshots/dashboard_preview.png" alt="Dashboard Dark" width="48%">
  <img src="screenshots/client_view_preview.png" alt="Client Dark" width="48%">
</div>

---
*Architecturé et développé par Johan.*
