/**
 * Eonora Tech OS - Main Application Layout
 *
 * This component provides:
 * - Authentication gate (login, onboarding, backend-down)
 * - Global layout (header, footer, route outlet)
 * - Theme and accent color management
 * - Drag & drop zone
 *
 * Heavy UI sections are extracted into:
 *   - AppHeader      → components/AppHeader.tsx
 *   - GlobalOverlays → components/GlobalOverlays.tsx
 *   - Keyboard shortcuts → hooks/useKeyboardShortcuts.ts
 *
 * State management is delegated to Zustand stores.
 * Data fetching uses React Query hooks.
 */

import React, { useEffect, useRef, useCallback, Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore, useProjectStore, useUIStore, useNotificationStore, useWorkspaceStore } from './stores';
import { useProjects, queryKeys } from './services/queries';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './services/api';
import { useFocusStore } from './stores/useFocusStore';

// Extracted components
import { AppHeader } from './components/AppHeader';
import { GlobalOverlays } from './components/GlobalOverlays';
import { GlobalDashboardModals } from './components/GlobalDashboardModals';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { useEmailNotifications } from './hooks/useEmailNotifications';
import { usePortalNotifications } from './hooks/usePortalNotifications';
import { useOAuthMonitor } from './hooks/useOAuthMonitor';

// Lazy loaded components
const FocusMode = React.lazy(() => import('./components/FocusMode').then(m => ({ default: m.FocusMode })));
const TourGuide = React.lazy(() => import('./components/TourGuide').then(m => ({ default: m.TourGuide })));
const Onboarding = React.lazy(() => import('./components/Onboarding'));

import { AmbientPlayer } from './components/AmbientPlayer';
import { GlobalSearch } from './components/GlobalSearch';
import { UndoToastContainer } from './components/UndoToast';
import { EmptyState } from './components/Shared';
import { SplashScreen } from './components/SplashScreen';
import { ToastItem } from './components/NotificationSystem';
import { LoginScreen } from './components/LoginScreen';

import { AlertTriangle, UploadCloud } from 'lucide-react';

declare const confetti: any;

const LOADING_MESSAGES = [
    "Préparation du café virtuel...",
    "Alignement des pixels au millimètre...",
    "Réveil de Franck (il a le sommeil lourd)...",
    "Chargement de la créativité...",
    "Vérification des stocks de paillettes...",
    "Initialisation du Yacht Bar..."
];

// ============================================================================
// Main App Layout Component
// ============================================================================

const App: React.FC = () => {
    // === React Query ===
    const queryClient = useQueryClient();
    const { data: projects = [] } = useProjects();

    // === Zustand Stores ===
    const {
        isAuthenticated, authChecked, isConfigured, isBackendDown, isLoading,
        checkAuth, setIsConfigured, setIsBackendDown, setIsLoading
    } = useAuthStore();

    const { events } = useProjectStore();

    const {
        theme, accentColor,
        showTour, setShowTour,
        isFocusMode, setIsFocusMode,
        isDraggingOver, setIsDraggingOver,
        isTorchActive, isTransitioning,
        setDroppedFiles, setShowFileDispatcher, setShowScrollTop,
        ambientUrl, setAmbientUrl, isAmbientPlaying, setIsAmbientPlaying,
        ambientVolume, setAmbientVolume,
        setIsTourCompleted,
    } = useUIStore();

    const { toasts, removeToast, addNotification, flushDeferredToasts } = useNotificationStore();
    const focusSessionState = useFocusStore(s => s.state);
    const appNavigate = useNavigate();

    // === Workspace / Branding ===
    const { loadWorkspace } = useWorkspaceStore();

    // === Local State ===
    const [loadingText, setLoadingText] = useState(LOADING_MESSAGES[0]);
    const [loadingMessage] = useState(LOADING_MESSAGES[0]);

    // === Refs ===
    const hasInitialized = useRef(false);

    const getAiStatusUrl = () => {
        const params = new URLSearchParams();
        const mode = localStorage.getItem('marion_ai_mode');
        const localModel = localStorage.getItem('marion_ai_local_model');
        const fallback = localStorage.getItem('marion_ai_fallback_enabled');
        if (mode) params.set('ai_mode', mode);
        if (localModel) params.set('local_model', localModel);
        if (fallback) params.set('fallback_enabled', fallback);
        const qs = params.toString();
        return `/api/v1/ai/check-status${qs ? `?${qs}` : ''}`;
    };
    const haloRef = useRef<HTMLDivElement>(null);

    // === Keyboard Shortcuts ===
    useKeyboardShortcuts();

    // === Auto-check for new GitHub releases (notifies once per release) ===
    useUpdateChecker();

    // === Email Notifications (background polling) ===
    useEmailNotifications();

    // === Portal Notifications (background polling) ===
    usePortalNotifications();

    // === OAuth Monitor (auto-detect disconnection, notify) ===
    useOAuthMonitor();

    // ========================================================================
    // Auth Check & Workspace Loading
    // ========================================================================
    useEffect(() => { checkAuth(); }, [checkAuth]);

    useEffect(() => {
        if (isAuthenticated) loadWorkspace();
    }, [isAuthenticated, loadWorkspace]);

    const handleAuthenticated = async (token: string) => {
        sessionStorage.setItem('marion_token', token);
        useAuthStore.getState().checkAuth();
        setIsLoading(true);
        setLoadingText("Connexion réussie...");

        setTimeout(async () => {
            try {
                const res = await apiFetch(getAiStatusUrl());
                const data = await res.json();
                const hasAnyEngine = !!(data?.cloudAvailable || data?.localAvailable);
                const effectivelyConfigured = !!data?.configured || hasAnyEngine;
                setIsConfigured(effectivelyConfigured);
                setIsBackendDown(false);
                if (effectivelyConfigured) {
                    loadWorkspace();
                    await queryClient.refetchQueries({ queryKey: queryKeys.projects });
                    setTimeout(() => setIsLoading(false), 2000);
                } else {
                    setIsLoading(false);
                }
            } catch {
                setIsLoading(false);
            }
        }, 500);
    };

    // ========================================================================
    // Loading Message Cycling
    // ========================================================================
    useEffect(() => {
        if (!isLoading && !isTransitioning) return;
        let i = 0;
        const interval = setInterval(() => {
            i = (i + 1) % LOADING_MESSAGES.length;
            setLoadingText(LOADING_MESSAGES[i]);
        }, 1500);
        return () => clearInterval(interval);
    }, [isLoading, isTransitioning]);

    useEffect(() => {
        if (focusSessionState !== 'running') {
            flushDeferredToasts();
        }
    }, [focusSessionState, flushDeferredToasts]);

    // ========================================================================
    // Initial Status Check
    // ========================================================================
    const checkStatus = useCallback(async () => {
        try {
            const res = await apiFetch(getAiStatusUrl());
            const data = await res.json();
            const preferredMode = localStorage.getItem('marion_ai_mode');
            const provider =
                preferredMode === 'local' || preferredMode === 'hybrid' || preferredMode === 'cloud'
                    ? preferredMode
                    : data?.provider;
            const modeLabel =
                provider === 'local'
                    ? 'Local (Ollama)'
                    : provider === 'hybrid'
                        ? 'Hybride (Local -> Cloud)'
                        : 'Cloud (Gemini)';

            // Marion is "set up" as long as ANY engine works (cloud OR local).
            // Only show the Onboarding screen on truly first-time setup — i.e.
            // the user has no Gemini key AND no local Ollama. Otherwise a
            // missing local engine (e.g. Ollama not started) when the user
            // happens to have picked "Local" mode would wrongly trigger
            // Onboarding and re-ask for the Gemini key on every refresh.
            const hasAnyEngine = !!(data?.cloudAvailable || data?.localAvailable);
            const effectivelyConfigured = !!data?.configured || hasAnyEngine;

            setIsConfigured(effectivelyConfigured);
            setIsBackendDown(false);

            // If the user's preferred mode is unavailable but cloud works,
            // transparently fall back to cloud so the app stays usable.
            if (!data?.configured && data?.cloudAvailable && (preferredMode === 'local' || preferredMode === 'hybrid')) {
                try { localStorage.setItem('marion_ai_mode', 'cloud'); } catch {}
                addNotification(
                    'Mode Cloud activé',
                    "Ollama n'est pas accessible — Marion bascule sur Gemini.",
                    'ai'
                );
            }

            if (effectivelyConfigured) {
                await queryClient.refetchQueries({ queryKey: queryKeys.projects });
                if (isLoading) {
                    setTimeout(() => {
                        setIsLoading(false);
                        setTimeout(() => {
                            addNotification('Franck est en ligne', `Mode IA actif: ${modeLabel}.`, 'ai');
                        }, 800);
                    }, 2500);
                }
            } else {
                setIsLoading(false);
            }
        } catch {
            setIsConfigured(false);
            setIsBackendDown(true);
            setIsLoading(false);
        }
    }, [isLoading, queryClient, addNotification]);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        checkStatus();
    }, [checkStatus]);

    // ========================================================================
    // Theme & Accent Effects
    // ========================================================================
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark', 'unicorn');
        if (theme === 'dark') root.classList.add('dark');
        else if (theme === 'unicorn') root.classList.add('unicorn');
    }, [theme]);

    useEffect(() => {
        // Migrate the retired orange accent to the Eonora sage brand.
        const brand = (!accentColor || accentColor === 'orange' || accentColor === '#FF7E5F')
            ? '#7C9A7E'
            : accentColor;
        document.documentElement.style.setProperty('--brand-color', brand);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (theme === 'light') {
            document.body.style.backgroundImage = '';
            document.body.style.backgroundColor = '#FAF7F2';
            meta?.setAttribute('content', '#FAF7F2');
        } else if (theme === 'dark') {
            // Linear noir — flat canvas (no space grid / cream flash)
            document.body.style.backgroundImage = '';
            document.body.style.backgroundColor = '#0f0f10';
            meta?.setAttribute('content', '#0f0f10');
        } else {
            document.body.style.backgroundImage = '';
            document.body.style.backgroundColor = '';
            meta?.setAttribute('content', '#FAF7F2');
        }
    }, [accentColor, theme]);

    // ========================================================================
    // Global Effects
    // ========================================================================

    // Scroll-to-top visibility
    useEffect(() => {
        const onScroll = () => setShowScrollTop(window.scrollY > 300);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Halo movement (dark theme torch)
    useEffect(() => {
        if (!isTorchActive || theme !== 'dark') return;
        const handleMouseMove = (e: MouseEvent) => {
            if (haloRef.current) {
                haloRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
                haloRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isTorchActive, theme]);

    // Tour handler
    const handleTourComplete = () => {
        setIsTourCompleted(true);
        setShowTour(false);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    };

    // Drag & Drop — only react to external file drops, not internal drags (Kanban etc.)
    const dragCounterRef = useRef(0);

    const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        if (!hasFiles(e)) return;           // ignore Kanban / internal drags
        dragCounterRef.current += 1;
        if (dragCounterRef.current === 1) setIsDraggingOver(true);
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();                  // required for drop to work
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (!hasFiles(e)) return;
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDraggingOver(false);
        }
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) { setDroppedFiles(files); setShowFileDispatcher(true); }
    };

    // ========================================================================
    // Authentication Gate
    // ========================================================================
    if (authChecked && !isAuthenticated) {
        return (
            <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement..." />}>
                <LoginScreen onAuthenticated={handleAuthenticated} />
            </Suspense>
        );
    }

    if (isConfigured === false) {
        return (
            <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement de l'interface..." />}>
                <Onboarding onSetupComplete={() => setIsConfigured(true)} />
            </Suspense>
        );
    }

    if (isBackendDown) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F19] p-4">
                <div className="flex flex-col items-center">
                    <EmptyState
                        title="Marion n'arrive pas à se connecter"
                        message="Le serveur qui fait tourner Franck et tes données ne répond pas. C'est presque toujours parce que l'application n'est pas encore lancée."
                        icon={AlertTriangle}
                        actionLabel="Réessayer la connexion"
                        onAction={checkStatus}
                    />
                    <div className="max-w-md -mt-4 mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-5 text-sm text-slate-600 dark:text-slate-300 text-left space-y-2">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Quoi faire ?</p>
                        <p>1. Double-clique sur <strong>Eonora Tech OS</strong> sur ton Bureau (ou <strong>LANCER_MARION.command</strong>) et attends 1–2 minutes.</p>
                        <p>2. Reviens ici et clique sur « Réessayer la connexion ».</p>
                        <p>3. Toujours bloqué ? Lance <strong>REPARER_INTERFACE.command</strong>, puis <strong>Cmd + Shift + R</strong> dans le navigateur.</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs pt-1">Si rien n'y fait, envoie à Johan le fichier <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[11px]">.marion.log</code> à la racine du projet.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================================
    // Main Render
    // ========================================================================
    return (
        <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des modules..." />}>
        <div
            className={`min-h-screen p-4 md:p-8 transition-colors duration-500 animate-in fade-in duration-1000 ${isDraggingOver ? 'ring-4 ring-emerald-500 ring-inset' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <TourGuide isOpen={showTour} onClose={() => setShowTour(false)} onComplete={handleTourComplete} />

            {isFocusMode && (
                <FocusMode
                    onExit={() => setIsFocusMode(false)}
                    projects={projects}
                    ambientUrl={ambientUrl}
                    isAmbientPlaying={isAmbientPlaying}
                    ambientVolume={ambientVolume}
                    onSetAmbientUrl={setAmbientUrl}
                    onToggleAmbient={setIsAmbientPlaying}
                    onSetVolume={setAmbientVolume}
                />
            )}

            <SplashScreen visible={isLoading || isTransitioning} loadingText={isTransitioning ? loadingMessage : loadingText} />
            <AmbientPlayer url={ambientUrl} isPlaying={isAmbientPlaying} volume={ambientVolume} />

            {/* Halo Glow */}
            {isTorchActive && theme === 'dark' && (
                <div
                    ref={haloRef}
                    className="fixed w-[400px] h-[400px] pointer-events-none z-[5] rounded-full mix-blend-screen opacity-80 transition-opacity duration-300"
                    style={{ left: 'var(--mouse-x)', top: 'var(--mouse-y)', transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 30%, transparent 70%)', boxShadow: '0 0 60px 30px rgba(255,255,255,0.05)' }}
                />
            )}

            {/* Toast Container */}
            <div 
                className="fixed top-20 md:top-24 right-2 md:right-8 left-2 md:left-auto z-[60] flex flex-col gap-3 w-auto md:w-full md:max-w-sm pointer-events-none"
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map(t => <ToastItem key={t.id} notification={t} onClose={removeToast} onNavigate={(link) => appNavigate(link)} />)}
            </div>

            {/* Header */}
            <AppHeader
                isConfigured={isConfigured}
                isBackendDown={isBackendDown}
                onReconnect={() => { setIsLoading(true); checkStatus(); }}
            />

            {/* Main Content - Route Outlet */}
            <main className="max-w-[1400px] mx-auto px-3 md:px-6 pb-20 relative z-10">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="max-w-7xl mx-auto mt-20 text-center text-xs text-slate-400 font-serif flex items-center justify-center gap-1 opacity-50 hover:opacity-100 transition-opacity pb-8 relative z-10">
                <span>Designer avec</span>
                <span className="text-red-400">♥</span>
                <span>par JV Automation - Copyright 2026 - v2.6.0</span>
            </footer>

            {/* Global Overlays */}
            <GlobalOverlays projects={projects} events={events} />
            <GlobalDashboardModals />

            {/* Global Search (Cmd+K) */}
            <GlobalSearch />

            {/* Undo Toasts */}
            <UndoToastContainer />
        </div>
        </Suspense>
    );
};

export default App;
