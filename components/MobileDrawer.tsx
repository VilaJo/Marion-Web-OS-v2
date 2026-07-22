/**
 * MobileDrawer - Slide-in sidebar menu for mobile navigation
 *
 * Contains all toolbar actions that are hidden on mobile in AppHeader.
 * Slides in from the right with a semi-transparent backdrop.
 *
 * v2.11.0 — nav allégée : deux sections, "Quotidien" (toujours visible) et
 * "Avancé" (repliée par défaut, pour les outils ponctuels).
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores';
import {
    X, LayoutGrid, StickyNote, Wand2, Tent, Target,
    Mail, Sparkles, Settings, Calendar, Wallet,
    HelpCircle, Sun, Moon, Sunrise, ChevronDown,
    Hammer, BookOpen, Palette, Shield, Telescope, Code2, Newspaper,
} from 'lucide-react';

interface DrawerItem {
    icon: React.ElementType;
    label: string;
    color: string;
    action: () => void;
}

export const MobileDrawer: React.FC = () => {
    const navigate = useNavigate();
    const {
        isMobileMenuOpen, setIsMobileMenuOpen,
        theme, cycleTheme,
        setShowMondayBriefing, setShowNotes, setShowMediaWorkshop,
        setIsFocusMode, setShowGoalsKPIs,
        setShowGuide, setShowAgendaModal, setShowChat,
        setDroppedFiles, setShowFileDispatcher,
    } = useUIStore();

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    // Lock body scroll when open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileMenuOpen]);

    if (!isMobileMenuOpen) return null;

    const close = () => setIsMobileMenuOpen(false);

    const menuAction = (action: () => void) => {
        close();
        // Small delay so drawer closes before modal opens
        setTimeout(action, 150);
    };

    const dailyItems: DrawerItem[] = [
        { icon: Sunrise, label: 'Ma journée', color: 'text-[#7C9A7E]', action: () => { close(); navigate('/today'); } },
        { icon: LayoutGrid, label: 'Clients', color: 'text-eo-rose', action: () => { close(); navigate('/'); } },
        { icon: Calendar, label: 'Agenda', color: 'text-eo-blue', action: () => menuAction(() => setShowAgendaModal(true)) },
        { icon: Mail, label: 'Emails', color: 'text-blue-500', action: () => { close(); navigate('/emails'); } },
        { icon: StickyNote, label: 'Notes rapides', color: 'text-amber-500', action: () => menuAction(() => setShowNotes(true)) },
        { icon: Sparkles, label: 'Franck', color: 'text-emerald-500', action: () => menuAction(() => setShowChat(true)) },
        { icon: Settings, label: 'Paramètres', color: 'text-slate-400', action: () => { close(); navigate('/settings'); } },
    ];

    const advancedItems: DrawerItem[] = [
        { icon: Wallet, label: 'Facturation', color: 'text-eo-teal', action: () => { close(); navigate('/finances'); } },
        { icon: Hammer, label: 'Atelier Refonte WP', color: 'text-eo-teal', action: () => { close(); navigate('/wp-studio'); } },
        { icon: BookOpen, label: 'Recettes WP → React', color: 'text-blue-500', action: () => { close(); navigate('/recipes'); } },
        { icon: Palette, label: 'Catalog Marion', color: 'text-eo-blue', action: () => { close(); navigate('/components'); } },
        { icon: Wand2, label: 'Stack Picker', color: 'text-emerald-500', action: () => { close(); navigate('/stack-picker'); } },
        { icon: Target, label: 'Mes compétences', color: 'text-eo-rose', action: () => { close(); navigate('/skills'); } },
        { icon: Shield, label: 'Audit Prospect WP', color: 'text-rose-500', action: () => { close(); navigate('/audit-wp'); } },
        { icon: Newspaper, label: 'Veille Marché', color: 'text-amber-500', action: () => { close(); navigate('/market-watch'); } },
        { icon: Telescope, label: 'Prospection', color: 'text-eo-blue', action: () => { close(); navigate('/prospection'); } },
        { icon: Code2, label: 'Bibliothèque de Prompts', color: 'text-eo-teal', action: () => { close(); navigate('/prompts'); } },
        { icon: Wand2, label: 'Atelier Média', color: 'text-eo-teal', action: () => menuAction(() => setShowMediaWorkshop(true)) },
        { icon: Tent, label: 'Mode Focus', color: 'text-blue-500', action: () => menuAction(() => setIsFocusMode(true)) },
        { icon: Target, label: 'Objectifs & KPIs', color: 'text-eo-teal', action: () => menuAction(() => setShowGoalsKPIs(true)) },
        { icon: LayoutGrid, label: 'Briefing du jour', color: 'text-eo-rose', action: () => menuAction(() => setShowMondayBriefing(true)) },
        {
            icon: Sparkles, label: 'Donner à Franck', color: 'text-emerald-500', action: () => {
                close();
                const input = document.createElement('input');
                input.type = 'file'; input.multiple = true;
                input.onchange = (e: any) => {
                    const files = Array.from(e.target.files || []) as File[];
                    if (files.length > 0) { setDroppedFiles(files); setShowFileDispatcher(true); }
                };
                input.click();
            },
        },
        { icon: HelpCircle, label: 'Guide & Aide', color: 'text-slate-400', action: () => menuAction(() => setShowGuide(true)) },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={close}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 bottom-0 z-[91] w-72 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="font-semibold text-slate-800 dark:text-white text-lg">Menu</h2>
                    <button
                        onClick={close}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={22} className="text-slate-500" />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto py-2">
                    <div className="px-5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Quotidien</div>
                    {dailyItems.map((item, idx) => (
                        <button
                            key={`daily-${idx}`}
                            onClick={item.action}
                            className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-700"
                        >
                            <item.icon size={22} className={item.color} />
                            <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                        </button>
                    ))}

                    <div className="my-2 mx-4 border-t border-slate-200 dark:border-slate-700" />

                    <button
                        onClick={() => setIsAdvancedOpen(v => !v)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        aria-expanded={isAdvancedOpen}
                    >
                        Avancé
                        <ChevronDown size={14} className={`transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isAdvancedOpen && advancedItems.map((item, idx) => (
                        <button
                            key={`advanced-${idx}`}
                            onClick={item.action}
                            className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-700"
                        >
                            <item.icon size={22} className={item.color} />
                            <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Theme toggle at bottom */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => { cycleTheme(); }}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        {theme === 'light' && <Sun size={22} className="text-amber-400" />}
                        {theme === 'dark' && <Moon size={22} className="text-brand-orange" />}
                        {theme === 'unicorn' && <Sparkles size={22} className="text-pink-500" />}
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Thème : {theme === 'light' ? 'Clair' : theme === 'dark' ? 'Sombre' : 'Licorne'}
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default MobileDrawer;
