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
    /** N° IDE/UID Suisse au format CHE-xxx.xxx.xxx (affiché en footer facture). */
    agencyIde: string;
    /** N° TVA Suisse au format CHE-xxx.xxx.xxx TVA (mentions légales). */
    agencyVatNumber: string;
    /** Frais de rappel par niveau de relance [niv1, niv2, niv3] (CHF). */
    agencyReminderFees: [number, number, number];
    /** Taux TVA appliqué par défaut aux nouvelles lignes. 0 = pas de TVA. */
    defaultVatRate: 0 | 2.6 | 3.8 | 8.1;
    tjh: string;
    aiTone: string;
    briefingVocal: boolean;
    aiMode: 'local' | 'hybrid' | 'cloud';
    localModelName: string;
    aiFallbackEnabled: boolean;

    // Modals
    showChat: boolean;
    showSettings: boolean;
    showImporter: boolean;
    showFinanceModal: boolean;
    showGlobalInvoiceModal: boolean;
    showGuide: boolean;
    showGoalsKPIs: boolean;
    showDocTemplates: boolean;
    showNotifCenter: boolean;
    showGlobalSearch: boolean;
    showMediaWorkshop: boolean;
    showNotes: boolean;
    showFileDispatcher: boolean;
    showMondayBriefing: boolean;
    showTour: boolean;
    isFocusMode: boolean;
    showAgendaModal: boolean;
    showTodoPanel: boolean;
    
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

    /** Email relance templates — variables: {client}, {montant}, {numero}, {echeance} */
    relanceTemplatePolite: string;
    relanceTemplateFirm: string;
    /** Relance niveau 3 (mise en demeure) — utilise les mêmes variables. */
    relanceTemplateFinal: string;

    // Actions
    setTheme: (theme: Theme) => void;
    cycleTheme: () => void;
    setAccentColor: (color: string) => void;
    setCurrency: (currency: string) => void;
    setAgencyName: (name: string) => void;
    setAgencyWebsite: (website: string) => void;
    setAgencyIde: (ide: string) => void;
    setAgencyVatNumber: (vat: string) => void;
    setAgencyReminderFees: (fees: [number, number, number]) => void;
    setDefaultVatRate: (rate: 0 | 2.6 | 3.8 | 8.1) => void;
    setTjh: (tjh: string) => void;
    setAiTone: (tone: string) => void;
    setBriefingVocal: (v: boolean) => void;
    setAiMode: (mode: 'local' | 'hybrid' | 'cloud') => void;
    setLocalModelName: (name: string) => void;
    setAiFallbackEnabled: (enabled: boolean) => void;
    
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
    setShowNotifCenter: (v: boolean) => void;
    setShowGlobalSearch: (v: boolean) => void;
    setShowMediaWorkshop: (v: boolean) => void;
    setShowNotes: (v: boolean) => void;
    setShowFileDispatcher: (v: boolean) => void;
    setShowMondayBriefing: (v: boolean) => void;
    setShowTour: (v: boolean) => void;
    setIsFocusMode: (v: boolean) => void;
    setShowAgendaModal: (v: boolean) => void;
    setShowTodoPanel: (v: boolean) => void;
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
    setRelanceTemplatePolite: (v: string) => void;
    setRelanceTemplateFirm: (v: string) => void;
    setRelanceTemplateFinal: (v: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
    // Default Linear noir; one-shot migrate cream/light installs → dark
    theme: (() => {
        const migrated = localStorage.getItem('marion_theme_linear_v1');
        if (!migrated) {
            localStorage.setItem('marion_theme_linear_v1', '1');
            localStorage.setItem('marion_theme', 'dark');
            return 'dark' as Theme;
        }
        return (localStorage.getItem('marion_theme') as Theme) || 'dark';
    })(),
    accentColor: (() => {
        // Eonora rebrand (v2.10.0): the legacy orange accent is retired → sage brand.
        const stored = localStorage.getItem('marion_accent');
        return (!stored || stored === 'orange' || stored === '#FF7E5F') ? '#7C9A7E' : stored;
    })(),
    currency: localStorage.getItem('marion_currency') || 'CHF',
    agencyName: localStorage.getItem('marion_agency_name') || 'Eonora Tech',
    agencyWebsite: localStorage.getItem('marion_agency_website') || 'eonoratech.ch',
    agencyIde: localStorage.getItem('marion_agency_ide') || 'CHE-265.310.079',
    agencyVatNumber: localStorage.getItem('marion_agency_vat_number') || '',
    agencyReminderFees: (() => {
        try {
            const raw = localStorage.getItem('marion_agency_reminder_fees');
            if (!raw) return [0, 20, 40] as [number, number, number];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length === 3) {
                return parsed.map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0)) as [number, number, number];
            }
            return [0, 20, 40] as [number, number, number];
        } catch {
            return [0, 20, 40] as [number, number, number];
        }
    })(),
    defaultVatRate: ((): 0 | 2.6 | 3.8 | 8.1 => {
        const raw = localStorage.getItem('marion_default_vat_rate');
        const n = raw ? Number(raw) : 0;
        return [0, 2.6, 3.8, 8.1].includes(n) ? (n as 0 | 2.6 | 3.8 | 8.1) : 0;
    })(),
    tjh: localStorage.getItem('marion_tjh') || '60',
    aiTone: localStorage.getItem('marion_ai_tone') || 'witty',
    briefingVocal: localStorage.getItem('marion_briefing_vocal') === 'true',
    aiMode: ((): 'local' | 'hybrid' | 'cloud' => {
        const stored = localStorage.getItem('marion_ai_mode') as 'local' | 'hybrid' | 'cloud' | null;
        // Hybride/Local sont des modes avancés verrouillés pour Marion (v2.9.2) — toute valeur persistée autre que 'cloud' est ramenée à 'cloud'.
        return stored === 'hybrid' || stored === 'local' ? 'cloud' : (stored || 'cloud');
    })(),
    localModelName: localStorage.getItem('marion_ai_local_model') || 'qwen2.5:7b-instruct',
    aiFallbackEnabled: localStorage.getItem('marion_ai_fallback_enabled') !== 'false',
    
    // Modals - all closed by default
    showChat: false,
    showSettings: false,
    showImporter: false,
    showFinanceModal: false,
    showGlobalInvoiceModal: false,
    showGuide: false,
    showGoalsKPIs: false,
    showDocTemplates: false,
    showNotifCenter: false,
    showGlobalSearch: false,
    showMediaWorkshop: false,
    showNotes: false,
    showFileDispatcher: false,
    showMondayBriefing: false,
    showTour: false,
    isFocusMode: false,
    showAgendaModal: false,
    showTodoPanel: false,
    
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

    relanceTemplatePolite:
        localStorage.getItem('marion_relance_polite') ||
        `Bonjour,\n\nSauf erreur de notre part, la facture {numero} ({montant} CHF, échéance {echeance}) est toujours en attente de paiement.\n\nMerci de faire le nécessaire.\n\nCordialement`,
    relanceTemplateFirm:
        localStorage.getItem('marion_relance_firm') ||
        `Bonjour,\n\nNous n'avons pas reçu le règlement de la facture {numero} ({montant} CHF), échue le {echeance}. Merci de régulariser sous 8 jours ou de nous contacter.\n\nCordialement`,
    relanceTemplateFinal:
        localStorage.getItem('marion_relance_final') ||
        `Bonjour,\n\nMise en demeure de payer — la facture {numero} ({montant} CHF), échue le {echeance}, demeure impayée malgré nos relances précédentes.\n\nÀ défaut de règlement complet dans un délai de 10 jours dès réception de la présente, nous saisirons l'Office des poursuites compétent (art. 102 ss CO).\n\nLes frais de rappel et intérêts moratoires (5% l'an, art. 104 CO) sont applicables.\n\nCordialement`,

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
    setAgencyIde: (ide) => {
        localStorage.setItem('marion_agency_ide', ide);
        set({ agencyIde: ide });
    },
    setAgencyVatNumber: (vat) => {
        localStorage.setItem('marion_agency_vat_number', vat);
        set({ agencyVatNumber: vat });
    },
    setAgencyReminderFees: (fees) => {
        localStorage.setItem('marion_agency_reminder_fees', JSON.stringify(fees));
        set({ agencyReminderFees: fees });
    },
    setDefaultVatRate: (rate) => {
        localStorage.setItem('marion_default_vat_rate', String(rate));
        set({ defaultVatRate: rate });
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
    setAiMode: (mode) => {
        localStorage.setItem('marion_ai_mode', mode);
        set({ aiMode: mode });
    },
    setLocalModelName: (name) => {
        localStorage.setItem('marion_ai_local_model', name);
        set({ localModelName: name });
    },
    setAiFallbackEnabled: (enabled) => {
        localStorage.setItem('marion_ai_fallback_enabled', String(enabled));
        set({ aiFallbackEnabled: enabled });
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
    setShowNotifCenter: (v) => set({ showNotifCenter: v }),
    setShowGlobalSearch: (v) => set({ showGlobalSearch: v }),
    setShowMediaWorkshop: (v) => set({ showMediaWorkshop: v }),
    setShowNotes: (v) => set({ showNotes: v }),
    setShowFileDispatcher: (v) => set({ showFileDispatcher: v }),
    setShowMondayBriefing: (v) => set({ showMondayBriefing: v }),
    setShowTour: (v) => set({ showTour: v }),
    setIsFocusMode: (v) => set({ isFocusMode: v }),
    setShowAgendaModal: (v) => set({ showAgendaModal: v }),
    setShowTodoPanel: (v) => set({ showTodoPanel: v }),
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
    setRelanceTemplatePolite: (v) => {
        localStorage.setItem('marion_relance_polite', v);
        set({ relanceTemplatePolite: v });
    },
    setRelanceTemplateFirm: (v) => {
        localStorage.setItem('marion_relance_firm', v);
        set({ relanceTemplateFirm: v });
    },
    setRelanceTemplateFinal: (v) => {
        localStorage.setItem('marion_relance_final', v);
        set({ relanceTemplateFinal: v });
    },
}));
