/**
 * UI Store - Theme, modals, and navigation state
 */

import { create } from 'zustand';
import { Theme, Invoice, Project } from '../types';

interface UIState {
    // Theme & Appearance
    theme: Theme;
    accentColor: string;
    
    // Settings
    currency: string;
    agencyName: string;
    agencyWebsite: string;
    tjh: string;
    aiTone: string;
    briefingVocal: boolean;

    // Modals
    showChat: boolean;
    showSettings: boolean;
    showImporter: boolean;
    showFinanceModal: boolean;
    showGlobalInvoiceModal: boolean;
    showGuide: boolean;
    showGoalsKPIs: boolean;
    showDocTemplates: boolean;
    showMessagingHub: boolean;
    showNotifCenter: boolean;
    showMediaWorkshop: boolean;
    showNotes: boolean;
    showFileDispatcher: boolean;
    showMondayBriefing: boolean;
    showTour: boolean;
    isFocusMode: boolean;
    
    // Mobile
    isMobileMenuOpen: boolean;

    // Misc UI
    showScrollTop: boolean;
    isDraggingOver: boolean;
    isTorchActive: boolean;
    isTransitioning: boolean;
    
    // Invoice editing
    currentInvoiceToEdit: { invoice: Invoice; project?: Project } | null;
    
    // Dropped files
    droppedFiles: File[];

    // Ambient sound
    ambientUrl: string | null;
    isAmbientPlaying: boolean;
    ambientVolume: number;

    // Signature & notification preferences
    signatureSettings: { mode: string; name: string; role: string; imageUrl: string; html: string };
    notificationPrefs: { id: string; title: string; desc: string; checked: boolean }[];
    isTourCompleted: boolean;

    // Subscription
    subscriptionDate: string; // ISO date of subscription start

    // Actions
    setTheme: (theme: Theme) => void;
    cycleTheme: () => void;
    setAccentColor: (color: string) => void;
    setCurrency: (currency: string) => void;
    setAgencyName: (name: string) => void;
    setAgencyWebsite: (website: string) => void;
    setTjh: (tjh: string) => void;
    setAiTone: (tone: string) => void;
    setBriefingVocal: (v: boolean) => void;
    
    // Modal toggles
    toggleModal: (modal: string, value?: boolean) => void;
    setShowChat: (v: boolean) => void;
    setShowSettings: (v: boolean) => void;
    setShowImporter: (v: boolean) => void;
    setShowFinanceModal: (v: boolean) => void;
    setShowGlobalInvoiceModal: (v: boolean) => void;
    setShowGuide: (v: boolean) => void;
    setShowGoalsKPIs: (v: boolean) => void;
    setShowDocTemplates: (v: boolean) => void;
    setShowMessagingHub: (v: boolean) => void;
    setShowNotifCenter: (v: boolean) => void;
    setShowMediaWorkshop: (v: boolean) => void;
    setShowNotes: (v: boolean) => void;
    setShowFileDispatcher: (v: boolean) => void;
    setShowMondayBriefing: (v: boolean) => void;
    setShowTour: (v: boolean) => void;
    setIsFocusMode: (v: boolean) => void;
    setIsMobileMenuOpen: (v: boolean) => void;
    setShowScrollTop: (v: boolean) => void;
    setIsDraggingOver: (v: boolean) => void;
    setIsTorchActive: (v: boolean) => void;
    setIsTransitioning: (v: boolean) => void;
    setCurrentInvoiceToEdit: (v: { invoice: Invoice; project?: Project } | null) => void;
    setDroppedFiles: (files: File[]) => void;
    setAmbientUrl: (url: string | null) => void;
    setIsAmbientPlaying: (v: boolean) => void;
    setAmbientVolume: (v: number) => void;
    setSignatureSettings: (v: { mode: string; name: string; role: string; imageUrl: string; html: string }) => void;
    setNotificationPrefs: (v: { id: string; title: string; desc: string; checked: boolean }[]) => void;
    setIsTourCompleted: (v: boolean) => void;
    setSubscriptionDate: (v: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
    // Initialize from localStorage
    theme: (localStorage.getItem('marion_theme') as Theme) || 'light',
    accentColor: localStorage.getItem('marion_accent') || 'orange',
    currency: localStorage.getItem('marion_currency') || 'CHF',
    agencyName: localStorage.getItem('marion_agency_name') || 'Marion Web',
    agencyWebsite: localStorage.getItem('marion_agency_website') || 'marionweb.ch',
    tjh: localStorage.getItem('marion_tjh') || '60',
    aiTone: localStorage.getItem('marion_ai_tone') || 'witty',
    briefingVocal: localStorage.getItem('marion_briefing_vocal') === 'true',
    
    // Modals - all closed by default
    showChat: false,
    showSettings: false,
    showImporter: false,
    showFinanceModal: false,
    showGlobalInvoiceModal: false,
    showGuide: false,
    showGoalsKPIs: false,
    showDocTemplates: false,
    showMessagingHub: false,
    showNotifCenter: false,
    showMediaWorkshop: false,
    showNotes: false,
    showFileDispatcher: false,
    showMondayBriefing: false,
    showTour: false,
    isFocusMode: false,
    
    // Mobile
    isMobileMenuOpen: false,

    // Misc
    showScrollTop: false,
    isDraggingOver: false,
    isTorchActive: false,
    isTransitioning: false,
    currentInvoiceToEdit: null,
    droppedFiles: [],
    ambientUrl: null,
    isAmbientPlaying: false,
    ambientVolume: 0.5,

    // Signature settings (persisted)
    signatureSettings: (() => {
        try {
            const saved = JSON.parse(localStorage.getItem('marion_signature') || '{}');
            return { mode: 'standard', name: 'Marion', role: 'Web Designer Indépendante', imageUrl: '', html: '', ...saved };
        } catch {
            return { mode: 'standard', name: 'Marion', role: 'Web Designer Indépendante', imageUrl: '', html: '' };
        }
    })(),

    // Notification preferences (persisted)
    notificationPrefs: (() => {
        try {
            const saved = JSON.parse(localStorage.getItem('marion_notifications') || '[]');
            if (saved.length > 0) return saved;
        } catch { /* ignore */ }
        return [
            { id: 'deadlines', title: 'Rappels de Deadlines', desc: '48h et 24h avant une échéance', checked: true },
            { id: 'payments', title: 'Paiement Facture', desc: "Dès qu'un client règle une facture", checked: true },
            { id: 'leads', title: 'Nouveau Lead', desc: 'Quand un prospect est créé ou importé', checked: false },
            { id: 'updates', title: 'Mises à jour Franck', desc: "Nouvelles fonctionnalités de l'IA", checked: true },
        ];
    })(),

    isTourCompleted: localStorage.getItem('marion_web_os_tour_completed') === 'true',

    // Subscription date (persisted)
    subscriptionDate: localStorage.getItem('marion_sub_date') || new Date().toISOString().split('T')[0],

    // Theme actions
    setTheme: (theme) => {
        localStorage.setItem('marion_theme', theme);
        set({ theme });
    },
    cycleTheme: () => {
        const { theme } = get();
        const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'unicorn' : 'light';
        localStorage.setItem('marion_theme', next);
        set({ theme: next as Theme });
    },
    setAccentColor: (color) => {
        localStorage.setItem('marion_accent', color);
        set({ accentColor: color });
    },
    setCurrency: (currency) => {
        localStorage.setItem('marion_currency', currency);
        set({ currency });
    },
    setAgencyName: (name) => {
        localStorage.setItem('marion_agency_name', name);
        set({ agencyName: name });
    },
    setAgencyWebsite: (website) => {
        localStorage.setItem('marion_agency_website', website);
        set({ agencyWebsite: website });
    },
    setTjh: (tjh) => {
        localStorage.setItem('marion_tjh', tjh);
        set({ tjh });
    },
    setAiTone: (tone) => {
        localStorage.setItem('marion_ai_tone', tone);
        set({ aiTone: tone });
    },
    setBriefingVocal: (v) => {
        localStorage.setItem('marion_briefing_vocal', String(v));
        set({ briefingVocal: v });
    },

    // Generic modal toggle
    toggleModal: (modal, value) => {
        const key = `show${modal}` as keyof UIState;
        set({ [key]: value !== undefined ? value : !get()[key] } as any);
    },

    // Modal setters
    setShowChat: (v) => set({ showChat: v }),
    setShowSettings: (v) => set({ showSettings: v }),
    setShowImporter: (v) => set({ showImporter: v }),
    setShowFinanceModal: (v) => set({ showFinanceModal: v }),
    setShowGlobalInvoiceModal: (v) => set({ showGlobalInvoiceModal: v }),
    setShowGuide: (v) => set({ showGuide: v }),
    setShowGoalsKPIs: (v) => set({ showGoalsKPIs: v }),
    setShowDocTemplates: (v) => set({ showDocTemplates: v }),
    setShowMessagingHub: (v) => set({ showMessagingHub: v }),
    setShowNotifCenter: (v) => set({ showNotifCenter: v }),
    setShowMediaWorkshop: (v) => set({ showMediaWorkshop: v }),
    setShowNotes: (v) => set({ showNotes: v }),
    setShowFileDispatcher: (v) => set({ showFileDispatcher: v }),
    setShowMondayBriefing: (v) => set({ showMondayBriefing: v }),
    setShowTour: (v) => set({ showTour: v }),
    setIsFocusMode: (v) => set({ isFocusMode: v }),
    setIsMobileMenuOpen: (v) => set({ isMobileMenuOpen: v }),
    setShowScrollTop: (v) => set({ showScrollTop: v }),
    setIsDraggingOver: (v) => set({ isDraggingOver: v }),
    setIsTorchActive: (v) => set({ isTorchActive: v }),
    setIsTransitioning: (v) => set({ isTransitioning: v }),
    setCurrentInvoiceToEdit: (v) => set({ currentInvoiceToEdit: v }),
    setDroppedFiles: (files) => set({ droppedFiles: files }),
    setAmbientUrl: (url) => set({ ambientUrl: url }),
    setIsAmbientPlaying: (v) => set({ isAmbientPlaying: v }),
    setAmbientVolume: (v) => set({ ambientVolume: v }),
    setSignatureSettings: (v) => {
        localStorage.setItem('marion_signature', JSON.stringify(v));
        set({ signatureSettings: v });
    },
    setNotificationPrefs: (v) => {
        localStorage.setItem('marion_notifications', JSON.stringify(v));
        set({ notificationPrefs: v });
    },
    setIsTourCompleted: (v) => {
        localStorage.setItem('marion_web_os_tour_completed', String(v));
        set({ isTourCompleted: v });
    },
    setSubscriptionDate: (v) => {
        localStorage.setItem('marion_sub_date', v);
        set({ subscriptionDate: v });
    },
}));
