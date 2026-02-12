/**
 * AppHeader - Main application header with toolbar
 *
 * Extracted from App.tsx for maintainability.
 * Contains: logo, navigation, toolbar buttons, notifications, Franck status.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useNotificationStore, useAuthStore } from '../stores';
import { Tooltip } from './Shared';
import { NotificationCenterPanel } from './NotificationSystem';
import { Project } from '../types';
import { useOfflineStore } from '../stores/useOfflineStore';
import { useEmailStatus, useEmailUnseen } from '../services/queries';

import {
    LayoutGrid, Bell, Settings, Sun, Moon,
    HelpCircle, Sparkles, MessageCircle, Wand2, Tent,
    FileText, StickyNote, Target, Mail, Menu,
} from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';

interface AppHeaderProps {
    isConfigured: boolean | null;
    isBackendDown: boolean;
    onReconnect: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isConfigured, isBackendDown, onReconnect }) => {
    const navigate = useNavigate();
    const { isOnline } = useOfflineStore();

    const {
        theme, setTheme,
        showChat, setShowChat,
        showNotifCenter, setShowNotifCenter,
        setShowMediaWorkshop, setShowNotes, setShowFileDispatcher,
        setShowGuide, setShowGoalsKPIs, setShowDocTemplates,
        setShowMessagingHub, setShowMondayBriefing,
        setIsFocusMode,
        setDroppedFiles, setShowImporter,
        isMobileMenuOpen, setIsMobileMenuOpen,
    } = useUIStore();

    const {
        notifications, markAsRead, removeNotification, clearAll,
    } = useNotificationStore();

    // Email unseen badge
    const { data: emailStatusData } = useEmailStatus();
    const emailConnected = emailStatusData?.connected ?? false;
    const { data: unseenData } = useEmailUnseen(emailConnected);
    const unseenCount = unseenData?.count ?? 0;

    return (
        <>
        <header className="sticky top-0 z-50 flex justify-between items-center px-2 sm:px-3 md:px-6 py-2 md:py-4 mb-2 md:mb-0 bg-white/70 dark:bg-slate-900/40 md:bg-transparent md:dark:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200/50 dark:border-slate-700/30 md:border-0">
            {/* Logo */}
            <div onClick={() => navigate('/')} className="group flex items-center gap-2 sm:gap-3 md:gap-5 cursor-pointer">
                <img 
                    src="/logo-marion.png" 
                    alt="Home" 
                    className={`w-9 h-9 sm:w-10 sm:h-10 md:w-14 md:h-14 object-contain transition-all duration-300 group-hover:scale-110 ${
                        theme === 'dark' 
                            ? 'group-hover:drop-shadow-[0_0_15px_rgba(255,126,95,0.8)]' 
                            : 'group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]'
                    }`} 
                />
                <div className="hidden sm:flex flex-col">
                    <h1 className="font-sans text-base sm:text-lg md:text-[26px] font-semibold text-slate-800 dark:text-white leading-tight">
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
                {/* Franck status */}
                {isConfigured !== null && (
                    <button
                        onClick={() => {
                            if (isBackendDown) { onReconnect(); }
                            else if (isConfigured === false) { /* handled by parent */ }
                            else { setShowChat(true); }
                        }}
                        className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer ${
                            (isBackendDown || isConfigured === false)
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${(isBackendDown || isConfigured === false) ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    </button>
                )}
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
                <Tooltip content="Templates">
                    <button onClick={() => setShowDocTemplates(true)} className="hidden lg:flex p-2 rounded-full text-slate-500 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors">
                        <FileText size={18} className="text-orange-500" />
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
                {isConfigured !== null && (
                    <button
                        onClick={() => {
                            if (isBackendDown) { onReconnect(); }
                            else if (isConfigured === false) { /* handled by parent */ }
                            else { setShowChat(true); }
                        }}
                        className={`ml-2 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer ${
                            (isBackendDown || isConfigured === false)
                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${(isBackendDown || isConfigured === false) ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        {isBackendDown ? 'Reconnecter' : isConfigured === false ? 'Configurer Franck' : 'Franck en ligne'}
                    </button>
                )}
            </div>

            {/* Mobile drawer */}
            <MobileDrawer />
        </header>
        {!isOnline && (
            <div className="sticky top-0 z-40 w-full bg-amber-400/90 text-slate-900 dark:text-slate-900 text-xs md:text-sm px-3 md:px-6 py-1.5 md:py-2 text-center font-medium shadow-sm">
                Mode hors-ligne — Les modifications seront synchronisées à la reconnexion.
            </div>
        )}
        </>
    );
};

export default AppHeader;
