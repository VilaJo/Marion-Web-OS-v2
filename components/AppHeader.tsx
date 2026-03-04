/**
 * AppHeader - Main application header with toolbar
 *
 * Extracted from App.tsx for maintainability.
 * Contains: logo, navigation, toolbar buttons, notifications, Franck status.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useNotificationStore, useAuthStore } from '../stores';
import { Tooltip } from './Shared';
import { NotificationCenterPanel } from './NotificationSystem';
import { Project } from '../types';
import { useOfflineStore } from '../stores/useOfflineStore';
import { useEmailStatus, useEmailUnseen } from '../services/queries';
import { apiFetch } from '../services/api';

import {
    LayoutGrid, Bell, Settings, Sun, Moon,
    HelpCircle, Sparkles, MessageCircle, Wand2, Tent,
    StickyNote, Target, Mail, Menu, Search,
    Key, RefreshCw, CheckCircle, AlertTriangle, Loader2, X,
} from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';

interface AppHeaderProps {
    isConfigured: boolean | null;
    isBackendDown: boolean;
    onReconnect: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isConfigured, isBackendDown, onReconnect }) => {
    const navigate = useNavigate();
    const isOnline = useOfflineStore((s) => s.isOnline);
    const queueCount = useOfflineStore((s) => s.queue.length);
    const isSyncing = useOfflineStore((s) => s.isSyncing);

    const {
        theme, setTheme,
        showChat, setShowChat,
        showNotifCenter, setShowNotifCenter,
        setShowMediaWorkshop, setShowNotes, setShowFileDispatcher,
        setShowGuide, setShowGoalsKPIs,
        setShowMessagingHub, setShowMondayBriefing, setShowGlobalSearch,
        setIsFocusMode,
        setDroppedFiles, setShowImporter,
        isMobileMenuOpen, setIsMobileMenuOpen,
    } = useUIStore();

    const {
        notifications, markAsRead, removeNotification, clearAll,
    } = useNotificationStore();

    const { setIsConfigured } = useAuthStore();

    // Email unseen badge
    const { data: emailStatusData } = useEmailStatus();
    const emailConnected = emailStatusData?.connected ?? false;
    const { data: unseenData } = useEmailUnseen(emailConnected);
    const unseenCount = unseenData?.count ?? 0;

    // Franck connection menu
    const [showFranckMenu, setShowFranckMenu] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [franckSetupLoading, setFranckSetupLoading] = useState(false);
    const [franckSetupError, setFranckSetupError] = useState('');
    const [franckSetupSuccess, setFranckSetupSuccess] = useState(false);
    const [franckProvider, setFranckProvider] = useState<'local' | 'cloud' | 'hybrid' | null>(null);
    const [franckLocalAvailable, setFranckLocalAvailable] = useState<boolean | null>(null);
    const [franckCloudAvailable, setFranckCloudAvailable] = useState<boolean | null>(null);
    const franckMenuRef = useRef<HTMLDivElement>(null);

    const getProviderLabel = (provider?: string | null) => {
        if (provider === 'local') return 'Local (Ollama)';
        if (provider === 'hybrid') return 'Hybride (Local -> Cloud)';
        return 'Cloud (Gemini)';
    };

    const applyAiStatus = (data: any) => {
        const preferred = localStorage.getItem('marion_ai_mode');
        if (preferred === 'local' || preferred === 'cloud' || preferred === 'hybrid') {
            setFranckProvider(preferred);
        } else {
            const provider = data?.provider;
            if (provider === 'local' || provider === 'cloud' || provider === 'hybrid') {
                setFranckProvider(provider);
            }
        }
        setFranckLocalAvailable(typeof data?.localAvailable === 'boolean' ? data.localAvailable : null);
        setFranckCloudAvailable(typeof data?.cloudAvailable === 'boolean' ? data.cloudAvailable : null);
    };

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

    // Close Franck menu on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (franckMenuRef.current && !franckMenuRef.current.contains(e.target as Node)) {
                setShowFranckMenu(false);
            }
        };
        if (showFranckMenu) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showFranckMenu]);

    useEffect(() => {
        if (!showFranckMenu) return;
        let cancelled = false;
        const readAiStatus = async () => {
            try {
                const res = await apiFetch(getAiStatusUrl());
                const data = await res.json();
                if (!cancelled) {
                    setIsConfigured(data.configured);
                    applyAiStatus(data);
                }
            } catch {
                // silent; reconnect button already handles explicit errors
            }
        };
        readAiStatus();
        return () => {
            cancelled = true;
        };
    }, [showFranckMenu, setIsConfigured]);

    const handleFranckApiKeySubmit = async () => {
        if (!apiKeyInput.trim()) return;
        setFranckSetupLoading(true);
        setFranckSetupError('');
        setFranckSetupSuccess(false);
        try {
            const res = await apiFetch('/api/v1/ai/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKeyInput.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setFranckSetupSuccess(true);
                setIsConfigured(true);
                setTimeout(() => {
                    setShowFranckMenu(false);
                    setApiKeyInput('');
                    setFranckSetupSuccess(false);
                }, 1500);
            } else {
                setFranckSetupError(data.error || 'Clé API invalide');
            }
        } catch {
            setFranckSetupError('Impossible de joindre le serveur');
        } finally {
            setFranckSetupLoading(false);
        }
    };

    const [franckTestLoading, setFranckTestLoading] = useState(false);
    const handleFranckReconnect = async () => {
        setFranckSetupError('');
        setFranckSetupSuccess(false);
        setFranckTestLoading(true);
        try {
            const res = await apiFetch(getAiStatusUrl());
            const data = await res.json();
            setIsConfigured(data.configured);
            applyAiStatus(data);
            if (data.configured) {
                setFranckSetupSuccess(true);
                setTimeout(() => {
                    setShowFranckMenu(false);
                    setFranckSetupSuccess(false);
                }, 1500);
            } else {
                setFranckSetupError('Franck n\'est pas configuré. Entre ta clé API ci-dessous.');
            }
        } catch {
            setFranckSetupError('Serveur injoignable. Vérifie que le terminal tourne.');
        } finally {
            setFranckTestLoading(false);
        }
    };

    const franckIsDown = isBackendDown || isConfigured === false;

    // Scroll: text "Marion Web OS Assistant Intelligent" disappears behind logo
    const [scrollY, setScrollY] = useState(0);
    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    const scrollProgress = Math.min(scrollY / 60, 1); // 0→1 over 60px scroll

    return (
        <>
        <header className="sticky top-0 z-50 flex justify-between items-center px-2 sm:px-3 md:px-6 py-2 md:py-4 mb-2 md:mb-0 bg-white/70 dark:bg-slate-900/40 md:bg-transparent md:dark:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200/50 dark:border-slate-700/30 md:border-0">
            {/* Logo + text (text slides behind logo on scroll) */}
            <div onClick={() => navigate('/')} className="group flex items-center cursor-pointer relative overflow-hidden">
                <div className="relative z-10 flex-shrink-0">
                    <img 
                        src="/logo-marion.png" 
                        alt="Home" 
                        className={`w-9 h-9 sm:w-10 sm:h-10 md:w-14 md:h-14 object-contain transition-all duration-300 group-hover:scale-110 ${
                            theme === 'dark' 
                                ? 'group-hover:drop-shadow-[0_0_15px_rgba(255,126,95,0.8)]' 
                                : 'group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]'
                        }`} 
                    />
                </div>
                <div 
                    className="hidden sm:flex flex-col ml-2 sm:ml-3 md:ml-5 transition-all duration-300 ease-out"
                    style={{
                        opacity: 1 - scrollProgress,
                        transform: `translateX(${-scrollProgress * 90}px)`,
                    }}
                >
                    <h1 className="font-sans text-base sm:text-lg md:text-[26px] font-semibold text-slate-800 dark:text-white leading-tight whitespace-nowrap">
                        Marion Web <span className="text-slate-400 font-normal hidden md:inline">OS</span>
                    </h1>
                    <p className="text-[10px] md:text-xs text-slate-400 hidden md:block">Assistant Intelligent</p>
                </div>
            </div>

            {/* Mobile: compact toolbar */}
            <div className="flex md:hidden items-center gap-1">
                {/* Notifications */}
                <div className="relative">
                    <button onClick={() => setShowNotifCenter(!showNotifCenter)} className="p-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-colors relative">
                        <Bell size={18} />
                        {notifications.some(n => !n.read) && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
                    </button>
                    {showNotifCenter && (
                        <div className="absolute right-0 mt-3 w-80 z-50">
                            <NotificationCenterPanel notifications={notifications} onMarkRead={markAsRead} onDelete={removeNotification} onClearAll={clearAll} onNavigate={(link) => { navigate(link); setShowNotifCenter(false); }} />
                        </div>
                    )}
                </div>
                {/* Franck status (mobile) */}
                <button
                    onClick={() => setShowFranckMenu(!showFranckMenu)}
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer ${
                        franckIsDown
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${franckIsDown ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                </button>
                {/* Hamburger */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <Menu size={22} className="text-slate-600 dark:text-slate-300" />
                </button>
            </div>

            {/* Desktop: full toolbar */}
            <div className="hidden md:flex items-center gap-0.5 md:gap-2 bg-white/70 dark:bg-slate-800/40 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-md md:-mt-2">
                <button onClick={() => setShowMondayBriefing(true)} className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-gradient-to-r from-brand-orange to-pink-500 text-white flex items-center gap-1.5">
                    <LayoutGrid size={14} /> Briefing
                </button>
                <Tooltip content="Recherche (⌘K)">
                    <button onClick={() => setShowGlobalSearch(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
                        <Search size={18} className="text-slate-500 dark:text-slate-300" />
                    </button>
                </Tooltip>
                <Tooltip content="Notes Rapides">
                    <button onClick={() => setShowNotes(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700 transition-colors">
                        <StickyNote size={18} className="text-amber-500" />
                    </button>
                </Tooltip>
                <Tooltip content="Atelier Média">
                    <button onClick={() => setShowMediaWorkshop(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <Wand2 size={18} className="text-purple-500" />
                    </button>
                </Tooltip>
                <Tooltip content="Mode Focus">
                    <button onClick={() => setIsFocusMode(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <Tent size={18} className="text-blue-500" />
                    </button>
                </Tooltip>
                <Tooltip content="Objectifs & KPIs">
                    <button onClick={() => setShowGoalsKPIs(true)} className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <Target size={18} className="text-violet-500" />
                    </button>
                </Tooltip>
                <Tooltip content="Emails">
                    <button onClick={() => navigate('/emails')} className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors relative">
                        <Mail size={18} className="text-blue-500" />
                        {unseenCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm animate-pulse">
                                {unseenCount > 99 ? '99+' : unseenCount}
                            </span>
                        )}
                    </button>
                </Tooltip>
                <Tooltip content="Messagerie">
                    <button onClick={() => setShowMessagingHub(true)} className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <MessageCircle size={18} className="text-green-500" />
                    </button>
                </Tooltip>
                <Tooltip content="Donner à Franck">
                    <button
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file'; input.multiple = true;
                            input.onchange = (e: any) => {
                                const files = Array.from(e.target.files || []) as File[];
                                if (files.length > 0) { setDroppedFiles(files); setShowFileDispatcher(true); }
                            };
                            input.click();
                        }}
                        className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Sparkles size={18} className="text-emerald-500" />
                    </button>
                </Tooltip>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                <Tooltip content="Changer de thème">
                    <button onClick={() => { const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'unicorn' : 'light'; setTheme(next as any); }} className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        {theme === 'light' && <Sun size={18} className="text-amber-400" />}
                        {theme === 'dark' && <Moon size={18} className="text-brand-orange" />}
                        {theme === 'unicorn' && <Sparkles size={18} className="text-pink-500" />}
                    </button>
                </Tooltip>
                <Tooltip content="Paramètres">
                    <button onClick={() => navigate('/settings')} className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <Settings size={18} />
                    </button>
                </Tooltip>
                <Tooltip content="Guide & Aide">
                    <button onClick={() => setShowGuide(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <HelpCircle size={18} />
                    </button>
                </Tooltip>
                {/* Notifications */}
                <div className="relative">
                    <Tooltip content="Notifications">
                        <button onClick={() => setShowNotifCenter(!showNotifCenter)} className="p-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-colors relative">
                            <Bell size={18} />
                            {notifications.some(n => !n.read) && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
                        </button>
                    </Tooltip>
                    {showNotifCenter && (
                        <div className="absolute right-0 mt-3 w-80 z-50">
                            <NotificationCenterPanel notifications={notifications} onMarkRead={markAsRead} onDelete={removeNotification} onClearAll={clearAll} onNavigate={(link) => { navigate(link); setShowNotifCenter(false); }} />
                        </div>
                    )}
                </div>
                {/* Franck status (desktop) */}
                <div className="relative ml-2" ref={franckMenuRef}>
                    <button
                        onClick={() => setShowFranckMenu(!showFranckMenu)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer ${
                            franckIsDown
                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${franckIsDown ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        {franckIsDown ? 'Non connecté' : 'Franck en ligne'}
                    </button>

                    {/* Franck dropdown menu */}
                    {showFranckMenu && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-serif text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {franckIsDown 
                                        ? <><AlertTriangle size={16} className="text-amber-500" /> Franck — Non connecté</>
                                        : <><CheckCircle size={16} className="text-emerald-500" /> Franck — En ligne</>
                                    }
                                </h3>
                                <button onClick={() => setShowFranckMenu(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="mb-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                                <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1">Mode IA actif</div>
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {getProviderLabel(franckProvider)}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Local: {franckLocalAvailable === null ? 'N/A' : franckLocalAvailable ? 'Disponible' : 'Indisponible'} · Cloud: {franckCloudAvailable === null ? 'N/A' : franckCloudAvailable ? 'Disponible' : 'Non configuré'}
                                </div>
                            </div>

                            {franckIsDown && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    {isBackendDown 
                                        ? 'Le serveur est injoignable. Vérifie que le terminal tourne.' 
                                        : (franckProvider === 'local'
                                            ? 'Le mode local est actif mais Ollama semble indisponible.'
                                            : 'La clé API Gemini n\'est pas configurée ou est invalide.')}
                                </p>
                            )}

                            {/* Open chat button */}
                            {!franckIsDown && (
                                <button
                                    onClick={() => { setShowChat(true); setShowFranckMenu(false); }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors border border-emerald-200 dark:border-emerald-800"
                                >
                                    <MessageCircle size={14} /> Ouvrir le chat
                                </button>
                            )}

                            {/* Reconnect button */}
                            <button
                                onClick={handleFranckReconnect}
                                disabled={franckTestLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                            >
                                {franckTestLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {franckIsDown ? 'Réessayer la connexion' : 'Tester la connexion'}
                            </button>

                            {/* API Key input */}
                            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    <Key size={12} className="inline mr-1" /> Clé API Gemini
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiKeyInput}
                                        onChange={(e) => setApiKeyInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleFranckApiKeySubmit()}
                                        placeholder="AIzaSy..."
                                        className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-orange placeholder:text-slate-400"
                                    />
                                    <button
                                        onClick={handleFranckApiKeySubmit}
                                        disabled={franckSetupLoading || !apiKeyInput.trim()}
                                        className="px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                                    >
                                        {franckSetupLoading ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
                                    </button>
                                </div>
                                {franckSetupError && (
                                    <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                                        <AlertTriangle size={12} /> {franckSetupError}
                                    </p>
                                )}
                                {franckSetupSuccess && (
                                    <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                                        <CheckCircle size={12} /> Franck est connecté !
                                    </p>
                                )}
                                <p className="mt-2 text-[10px] text-slate-400">
                                    Obtiens ta clé sur <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-orange">aistudio.google.com</a>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile drawer */}
            <MobileDrawer />
        </header>
        {!isOnline && (
            <div className="sticky top-0 z-40 w-full bg-amber-400/90 text-slate-900 dark:text-slate-900 text-xs md:text-sm px-3 md:px-6 py-1.5 md:py-2 text-center font-medium shadow-sm flex items-center justify-center gap-2">
                {isSyncing ? (
                    <>
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Synchronisation en cours...
                    </>
                ) : (
                    <>
                        Mode hors-ligne
                        {queueCount > 0
                            ? ` — ${queueCount} modification${queueCount > 1 ? 's' : ''} en attente`
                            : ' — Les modifications seront synchronisées à la reconnexion.'}
                    </>
                )}
            </div>
        )}
        </>
    );
};

export default AppHeader;
