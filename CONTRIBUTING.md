# Guide de contribution

Merci de votre intérêt pour Marion Web OS. Ce document décrit comment contribuer au projet.

---

## Prérequis

- **Python** 3.12+
- **Node.js** 18+
- **Git**

---

## Installation

```bash
git clone https://github.com/VilaJo/Marion-Web-OS-v2.git
cd Marion-Web-OS-v2
./INSTALLER.command
```

---

## Workflow

1. **Fork** le dépôt
2. Créer une **branche** : `git checkout -b feature/ma-fonctionnalite`
3. **Commiter** : `git commit -m "feat: ajout de X"`
4. **Pusher** : `git push origin feature/ma-fonctionnalite`
5. Ouvrir une **Pull Request**

---

## Conventions de commits

Format : `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `style` | Formatage, pas de changement de code |
| `refactor` | Refactoring |
| `test` | Ajout de tests |
| `chore` | Maintenance, dépendances |

Exemples :
- `feat(portal): add lightbox for images`
- `fix(email): prevent segmentation fault on IMAP`
- `docs: add troubleshooting guide`

---

## Structure du code

- **Frontend** : React + TypeScript, Tailwind, `apiFetch` pour les appels API
- **Backend** : Flask blueprints, services dans `services/`
- **Base de données** : Migrations dans `database/migrations/`
- **Tests** : `tests/` (pytest, vitest)

---

## Bonnes pratiques

- Respecter les conventions existantes (nommage, structure)
- Documenter les nouvelles APIs dans `docs/api/`
- Tester manuellement avant de soumettre une PR
- Vérifier que `npm run build` passe sans erreur

---

## Questions

Pour toute question, ouvrir une issue sur GitHub.
