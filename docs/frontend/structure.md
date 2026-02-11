# Frontend — Structure

## Arborescence

```
├── App.tsx                 # Layout global, overlays, drag & drop
├── index.tsx               # Point d'entrée React
├── router.tsx              # React Router (createBrowserRouter)
├── index.css               # Styles globaux, Tailwind
├── types.ts                # Interfaces TypeScript
├── constants.ts            # Constantes (phases, sons, etc.)
│
├── pages/                  # Pages (routes)
│   ├── Dashboard.tsx       # Tableau de bord principal
│   ├── ClientPage.tsx      # Fiche client détaillée
│   ├── InvoicePage.tsx     # Création/édition facture
│   ├── FinancesPage.tsx    # Vue finances
│   ├── EmailPage.tsx       # Client email plein écran
│   ├── SettingsPage.tsx    # Paramètres
│   └── PortalPublicPage.tsx # Portail client (route publique)
│
├── components/             # Composants réutilisables
│   ├── AppHeader.tsx       # En-tête, navigation
│   ├── Agenda.tsx          # Widget agenda
│   ├── ClientView.tsx      # Vue détaillée client (tabs)
│   ├── FinancialHealthWidget.tsx
│   ├── FranckChat.tsx      # Chat IA
│   ├── FocusMode.tsx       # Mode focus + Coach Franck
│   ├── MediaStudio.tsx     # Atelier médias
│   ├── WorkflowTimeline.tsx # Timeline workflow
│   ├── ClientPortal.tsx    # Admin portail client
│   ├── email/              # Sous-composants email
│   └── media/              # Sous-composants MediaStudio
│
├── stores/                 # Zustand stores
│   ├── useAuthStore.ts
│   ├── useProjectStore.ts
│   ├── useUIStore.ts
│   ├── useNotificationStore.ts
│   ├── useOfflineStore.ts
│   └── useWorkspaceStore.ts
│
├── services/               # Services frontend
│   ├── api.ts              # apiFetch, apiGet, apiPost...
│   ├── queries.ts          # React Query hooks
│   ├── queryClient.ts       # Config React Query
│   └── geminiService.ts
│
└── hooks/                  # Hooks personnalisés
    ├── useEmailNotifications.ts
    ├── usePortalNotifications.ts
    ├── useOAuthMonitor.ts
    └── useKeyboardShortcuts.ts
```

---

## Conventions

- **Pages** : Une page par route, lazy-loaded via `React.lazy`
- **Components** : Nommage PascalCase, co-location des styles
- **Stores** : Zustand pour état global, React Query pour données serveur
- **API** : Toujours `apiFetch` (jamais `fetch` brut) pour les routes authentifiées
