# Frontend — Routing

## Configuration

Le routing est défini dans `router.tsx` avec `createBrowserRouter` (React Router v6).

---

## Routes

| Chemin | Page | Auth |
|--------|------|------|
| `/` | Dashboard | Oui |
| `/client/:id` | Fiche client | Oui |
| `/client/:id/invoice` | Création facture | Oui |
| `/finances` | Dashboard finances | Oui |
| `/emails` | Client email | Oui |
| `/settings` | Paramètres | Oui |
| `/portal/:token` | Portail client public | Non (PIN) |

---

## Layout

- **Route publique** : `/portal/:token` → `PortalPublicPage` seul (hors layout App)
- **Routes authentifiées** : Toutes les autres → `App` (header, footer, overlays) avec `Outlet` pour le contenu

---

## Lazy loading

Toutes les pages sont chargées en lazy :

```tsx
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
// ...
element: (
  <Suspense fallback={<SplashScreen visible={true} loadingText="..." />}>
    <Dashboard />
  </Suspense>
)
```
