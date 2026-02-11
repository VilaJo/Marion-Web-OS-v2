# Frontend — State Management

## Zustand Stores

| Store | Rôle |
|-------|------|
| `useAuthStore` | Authentification (token, user, isLoggedIn) |
| `useProjectStore` | Projets, projet sélectionné, filtres |
| `useUIStore` | UI globale (theme, modals, notifications, drag overlay) |
| `useNotificationStore` | Notifications in-app |
| `useOfflineStore` | État online/offline |
| `useWorkspaceStore` | Workspace actif, branding |

---

## React Query

Les données serveur sont gérées via **TanStack React Query** (`services/queries.ts`) :

- `useProjects` — Liste projets
- `useOAuthStatus` — Statut Google (polling 5 min)
- `useConnectGoogle` — Connexion OAuth
- `useEmailUnseen` — Emails non lus (polling)
- `usePortalUnseen` — Activité portail non vue
- Etc.

---

## Persistence

| Donnée | Stockage |
|--------|----------|
| Token session | `sessionStorage` (`marion_token`) |
| Theme | `localStorage` |
| Daily todos | `localStorage` (`marion_daily_todos`) |
| Drive last sync | `localStorage` par projet |
