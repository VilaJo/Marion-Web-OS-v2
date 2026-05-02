/**
 * Marion Web OS - Router Configuration
 * 
 * Route structure:
 *   /                    → Dashboard (main view)
 *   /client/:id          → Client detail view
 *   /client/:id/invoice  → Invoice builder for a client
 *   /finances            → Finance dashboard
 *   /emails              → Full-screen email client
 *   /settings            → Settings page
 * 
 * App.tsx provides the global layout (header, footer, modals).
 * Pages are rendered in the <Outlet /> area.
 */

import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary, RouteErrorFallback } from './components/ErrorBoundary';

// Lazy load pages
const App = React.lazy(() => import('./App'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ClientPage = React.lazy(() => import('./pages/ClientPage'));
const InvoicePage = React.lazy(() => import('./pages/InvoicePage'));
const FinancesPage = React.lazy(() => import('./pages/FinancesPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const EmailPage = React.lazy(() => import('./pages/EmailPage'));
const PortalPublicPage = React.lazy(() => import('./pages/PortalPublicPage'));
const ProspectingPage = React.lazy(() => import('./pages/ProspectingPage'));
const PromptLibraryPage = React.lazy(() => import('./pages/PromptLibraryPage'));
const MarketWatchPage = React.lazy(() => import('./pages/MarketWatchPage'));
const TodayPage = React.lazy(() => import('./pages/TodayPage'));
// Marion 2030 Atelier Edition (v2.6.0)
const WpStudioPage = React.lazy(() => import('./pages/WpStudioPage'));
const RecipesPage = React.lazy(() => import('./pages/RecipesPage'));
const ComponentCatalogPage = React.lazy(() => import('./pages/ComponentCatalogPage'));
const StackPickerPage = React.lazy(() => import('./pages/StackPickerPage'));
const SkillsPage = React.lazy(() => import('./pages/SkillsPage'));
const AuditWpPage = React.lazy(() => import('./pages/AuditWpPage'));

const router = createBrowserRouter([
    // Public portal route (standalone, outside App layout)
    {
        path: '/portal/:token',
        element: (
            <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>}>
                <PortalPublicPage />
            </Suspense>
        ),
        errorElement: <RouteErrorFallback />,
    },
    {
        path: '/',
        element: (
            <ErrorBoundary>
                <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement..." />}>
                    <App />
                </Suspense>
            </ErrorBoundary>
        ),
        errorElement: <RouteErrorFallback />,
        children: [
            {
                index: true,
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement du tableau de bord..." />}>
                        <Dashboard />
                    </Suspense>
                ),
            },
            {
                path: 'today',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de ta journée..." />}>
                        <TodayPage />
                    </Suspense>
                ),
            },
            {
                path: 'client/*',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement du client..." />}>
                        <ClientPage />
                    </Suspense>
                ),
            },
            {
                path: 'client/:id/invoice',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de la facture..." />}>
                        <InvoicePage />
                    </Suspense>
                ),
            },
            {
                path: 'finances',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des finances..." />}>
                        <FinancesPage />
                    </Suspense>
                ),
            },
            {
                path: 'emails',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des emails..." />}>
                        <EmailPage />
                    </Suspense>
                ),
            },
            {
                path: 'settings',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des paramètres..." />}>
                        <SettingsPage />
                    </Suspense>
                ),
            },
            {
                path: 'prospection',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de la prospection..." />}>
                        <ProspectingPage />
                    </Suspense>
                ),
            },
            {
                path: 'prompts',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de la bibliothèque..." />}>
                        <PromptLibraryPage />
                    </Suspense>
                ),
            },
            {
                path: 'market-watch',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de la veille marché..." />}>
                        <MarketWatchPage />
                    </Suspense>
                ),
            },
            // ───────── Marion 2030 Atelier Edition (v2.6.0) ─────────
            {
                path: 'wp-studio',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de l'atelier..." />}>
                        <WpStudioPage />
                    </Suspense>
                ),
            },
            {
                path: 'recipes',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des recettes..." />}>
                        <RecipesPage />
                    </Suspense>
                ),
            },
            {
                path: 'components',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement du catalog..." />}>
                        <ComponentCatalogPage />
                    </Suspense>
                ),
            },
            {
                path: 'stack-picker',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement du Stack Picker..." />}>
                        <StackPickerPage />
                    </Suspense>
                ),
            },
            {
                path: 'skills',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de tes compétences..." />}>
                        <SkillsPage />
                    </Suspense>
                ),
            },
            {
                path: 'audit-wp',
                errorElement: <RouteErrorFallback />,
                element: (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de l'audit..." />}>
                        <AuditWpPage />
                    </Suspense>
                ),
            },
        ],
    },
]);

export const AppRouter: React.FC = () => {
    return <RouterProvider router={router} />;
};

export default AppRouter;
