import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, Camera, Plus, Trash2, Mail, Phone, Globe, MapPin,
    Link2, Server, FolderPlus, Sparkles, User, ExternalLink,
    LayoutTemplate, ChevronDown, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { ProjectStatus, ClientProfile, WorkflowPhase } from '../types';

// ---------------------------------------------------------------------------
// Project templates
// ---------------------------------------------------------------------------
export interface ProjectTemplate {
    id: string;
    label: string;
    description: string;
    icon: string;
    defaultStatus: ProjectStatus;
    defaultPhase: WorkflowPhase;
    tasks: { title: string; priority: 'Low' | 'Medium' | 'High'; phase: WorkflowPhase }[];
    cursorPrompts: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
    {
        id: 'landing-saas',
        label: 'Landing Page SaaS',
        description: 'Site vitrine + hero + pricing + onboarding',
        icon: '🚀',
        defaultStatus: ProjectStatus.EN_COURS,
        defaultPhase: WorkflowPhase.DESIGN,
        tasks: [
            { title: 'Brief et moodboard', priority: 'High', phase: WorkflowPhase.DISCOVERY },
            { title: 'Wireframes (Figma)', priority: 'High', phase: WorkflowPhase.DESIGN },
            { title: 'Section Hero + navigation', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Section Features (3-6 blocs)', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Section Pricing (3 plans)', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Section Testimonials', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Section CTA final + footer', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Responsive mobile', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Dark mode', priority: 'Low', phase: WorkflowPhase.DEV },
            { title: 'SEO & meta tags', priority: 'Medium', phase: WorkflowPhase.QA },
            { title: 'Tests cross-browser', priority: 'High', phase: WorkflowPhase.QA },
            { title: 'Déploiement Vercel', priority: 'High', phase: WorkflowPhase.QA },
        ],
        cursorPrompts: ['Hero section avec gradient et CTA', 'Pricing table avec toggle annuel/mensuel', 'Footer responsive avec newsletter'],
    },
    {
        id: 'ecommerce',
        label: 'E-commerce',
        description: 'Boutique en ligne complète avec panier',
        icon: '🛒',
        defaultStatus: ProjectStatus.EN_COURS,
        defaultPhase: WorkflowPhase.DISCOVERY,
        tasks: [
            { title: 'Audit et brief e-commerce', priority: 'High', phase: WorkflowPhase.DISCOVERY },
            { title: 'Architecture pages (catégories, fiches produit)', priority: 'High', phase: WorkflowPhase.STRATEGY },
            { title: 'Maquettes Figma', priority: 'High', phase: WorkflowPhase.DESIGN },
            { title: 'Page accueil + hero', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Liste produits + filtres', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Fiche produit', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Panier et checkout', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Intégration paiement (Stripe)', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Compte client + historique', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Responsive + performances', priority: 'High', phase: WorkflowPhase.QA },
            { title: 'Tests achat complet', priority: 'High', phase: WorkflowPhase.QA },
            { title: 'Mise en ligne + DNS', priority: 'High', phase: WorkflowPhase.QA },
        ],
        cursorPrompts: ['Product card avec hover zoom et add to cart', 'Checkout form multi-étapes', 'Filtres produits avec URL params'],
    },
    {
        id: 'portfolio',
        label: 'Portfolio',
        description: 'Site portfolio créatif et personnel',
        icon: '🎨',
        defaultStatus: ProjectStatus.EN_COURS,
        defaultPhase: WorkflowPhase.DESIGN,
        tasks: [
            { title: 'Brief créatif + direction artistique', priority: 'High', phase: WorkflowPhase.DISCOVERY },
            { title: 'Sélection des projets à mettre en avant', priority: 'High', phase: WorkflowPhase.STRATEGY },
            { title: 'Maquettes Figma', priority: 'High', phase: WorkflowPhase.DESIGN },
            { title: 'Page d\'accueil + intro', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Grille portfolio filtrable', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Pages de cas d\'étude', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Page À propos', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Page Contact + formulaire', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Animations et transitions', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'SEO et performances', priority: 'High', phase: WorkflowPhase.QA },
        ],
        cursorPrompts: ['Portfolio grid avec filtres et animations', 'Hero section avec effet texte animé', 'Case study layout avec images et résultats'],
    },
    {
        id: 'refonte',
        label: 'Refonte de site',
        description: 'Modernisation d\'un site existant',
        icon: '♻️',
        defaultStatus: ProjectStatus.EN_COURS,
        defaultPhase: WorkflowPhase.DISCOVERY,
        tasks: [
            { title: 'Audit UX du site existant', priority: 'High', phase: WorkflowPhase.DISCOVERY },
            { title: 'Analyse concurrentielle', priority: 'High', phase: WorkflowPhase.DISCOVERY },
            { title: 'Définition des objectifs de refonte', priority: 'High', phase: WorkflowPhase.STRATEGY },
            { title: 'Nouvelle architecture de l\'information', priority: 'High', phase: WorkflowPhase.STRATEGY },
            { title: 'Nouvelles maquettes Figma', priority: 'High', phase: WorkflowPhase.DESIGN },
            { title: 'Validation design client', priority: 'High', phase: WorkflowPhase.DESIGN },
            { title: 'Développement nouvelles pages', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Migration contenus', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Redirections 301', priority: 'Medium', phase: WorkflowPhase.QA },
            { title: 'Tests et recettage', priority: 'High', phase: WorkflowPhase.QA },
            { title: 'Mise en ligne et suivi post-lancement', priority: 'High', phase: WorkflowPhase.QA },
        ],
        cursorPrompts: ['Audit composant existant et refonte Tailwind', 'Migration CSS vers Tailwind utilities', 'Navigation redesign avec animations'],
    },
    {
        id: 'vitrine',
        label: 'Site vitrine',
        description: 'Site institutionnel pour PME ou artisan',
        icon: '🏢',
        defaultStatus: ProjectStatus.EN_COURS,
        defaultPhase: WorkflowPhase.DISCOVERY,
        tasks: [
            { title: 'Réunion de brief client', priority: 'High', phase: WorkflowPhase.DISCOVERY },
            { title: 'Collecte des contenus (textes, photos)', priority: 'High', phase: WorkflowPhase.STRATEGY },
            { title: 'Maquettes Figma', priority: 'High', phase: WorkflowPhase.DESIGN },
            { title: 'Développement page d\'accueil', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Développement pages internes', priority: 'High', phase: WorkflowPhase.DEV },
            { title: 'Formulaire de contact', priority: 'Medium', phase: WorkflowPhase.DEV },
            { title: 'Google Maps + infos pratiques', priority: 'Low', phase: WorkflowPhase.DEV },
            { title: 'Responsive + SEO local', priority: 'High', phase: WorkflowPhase.QA },
            { title: 'Mise en ligne + formation client', priority: 'High', phase: WorkflowPhase.QA },
        ],
        cursorPrompts: ['Page vitrine avec sections services et contact', 'Section équipe avec cards', 'Footer avec carte Google Maps'],
    },
];

const AVATAR_GRADIENTS = [
    'from-brand-primary to-brand-secondary',
    'from-purple-400 to-indigo-500',
    'from-green-400 to-teal-500',
    'from-yellow-400 to-orange-500',
    'from-pink-400 to-rose-500',
    'from-sky-400 to-blue-500',
    'from-fuchsia-400 to-purple-500',
    'from-amber-400 to-red-500',
    'from-emerald-400 to-cyan-500',
];

const STATUS_META: Record<ProjectStatus, { label: string; emoji: string }> = {
    [ProjectStatus.EN_COURS]: { label: 'En cours', emoji: '🚀' },
    [ProjectStatus.MAINTENANCE]: { label: 'Maintenance', emoji: '🔧' },
    [ProjectStatus.ASSOCIATION]: { label: 'Association', emoji: '🤝' },
    [ProjectStatus.PROSPECT]: { label: 'Prospect', emoji: '🌱' },
    [ProjectStatus.ARCHIVED]: { label: 'Archivé', emoji: '📦' },
};

const LINK_PRESETS = [
    { key: 'figma', label: 'Figma', placeholder: 'https://figma.com/...' },
    { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...' },
    { key: 'wordpress', label: 'WordPress', placeholder: 'https://...' },
    { key: 'drive', label: 'Google Drive', placeholder: 'https://drive.google.com/...' },
];

export interface NewClientData {
    name: string;
    status: ProjectStatus;
    avatarColor: string;
    avatarImage?: string;
    profile: ClientProfile;
    links: Record<string, string>;
    templateId?: string;
    templateTasks?: { title: string; priority: 'Low' | 'Medium' | 'High'; phase: WorkflowPhase }[];
    cursorPrompts?: string[];
}

interface NewClientScreenProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: NewClientData) => void;
    isCreating?: boolean;
}

export const NewClientScreen: React.FC<NewClientScreenProps> = ({ isOpen, onClose, onCreate, isCreating = false }) => {
    const [name, setName] = useState('');
    const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.EN_COURS);
    const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
    const [templateSectionOpen, setTemplateSectionOpen] = useState(true);
    const [avatarColor, setAvatarColor] = useState(AVATAR_GRADIENTS[0]);
    const [avatarImage, setAvatarImage] = useState<string | undefined>();
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [address, setAddress] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [serverAccess, setServerAccess] = useState('');
    const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
    const [links, setLinks] = useState<Record<string, string>>({});
    const [showLinkAdd, setShowLinkAdd] = useState(false);
    const [newLinkKey, setNewLinkKey] = useState('');
    const [newLinkValue, setNewLinkValue] = useState('');

    const nameRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('overflow-hidden');
            setTimeout(() => nameRef.current?.focus(), 200);
            return () => { document.body.classList.remove('overflow-hidden'); };
        }
    }, [isOpen]);

    const resetForm = () => {
        setName(''); setStatus(ProjectStatus.EN_COURS);
        setAvatarColor(AVATAR_GRADIENTS[0]); setAvatarImage(undefined);
        setEmail(''); setPhone(''); setWebsite(''); setAddress('');
        setDriveLink(''); setServerAccess('');
        setCustomFields([]); setLinks({});
        setShowLinkAdd(false); setNewLinkKey(''); setNewLinkValue('');
        setSelectedTemplate(null); setTemplateSectionOpen(true);
    };

    const handleClose = () => { resetForm(); onClose(); };

    const handleCreate = () => {
        if (!name.trim()) {
            nameRef.current?.focus();
            return;
        }
        onCreate({
            name: name.trim(),
            status: selectedTemplate?.defaultStatus ?? status,
            avatarColor,
            avatarImage,
            profile: { email, phone, website, address, driveLink, serverAccess, customFields },
            links,
            templateId: selectedTemplate?.id,
            templateTasks: selectedTemplate?.tasks,
            cursorPrompts: selectedTemplate?.cursorPrompts,
        });
        resetForm();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setAvatarImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    const addCustomField = () => {
        setCustomFields(prev => [...prev, { key: '', value: '' }]);
    };

    const updateCustomField = (idx: number, field: 'key' | 'value', val: string) => {
        setCustomFields(prev => prev.map((cf, i) => i === idx ? { ...cf, [field]: val } : cf));
    };

    const removeCustomField = (idx: number) => {
        setCustomFields(prev => prev.filter((_, i) => i !== idx));
    };

    const addLink = () => {
        const key = newLinkKey.trim();
        const val = newLinkValue.trim();
        if (key && val) {
            setLinks(prev => ({ ...prev, [key.toLowerCase()]: val }));
            setNewLinkKey(''); setNewLinkValue('');
            setShowLinkAdd(false);
        }
    };

    const removeLink = (key: string) => {
        setLinks(prev => { const n = { ...prev }; delete n[key]; return n; });
    };

    const initials = name.trim() ? name.trim().substring(0, 2).toUpperCase() : '?';

    if (!isOpen) return null;

    const inputCls = "w-full bg-white/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all";
    const labelCls = "text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block";
    const sectionCardCls = "bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-slate-700/40 shadow-sm";

    return createPortal(
        <div className="fixed inset-0 z-[200] animate-in fade-in duration-300">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#FAF7F2] via-[#FAF7F2] to-[#FAF7F2] dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#A7C1A3]/20 dark:bg-orange-900/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/15 dark:bg-purple-900/10 rounded-full blur-[100px]" />

            <div ref={containerRef} className="relative z-10 h-full flex flex-col">
                {/* Header */}
                <header className="shrink-0 px-4 md:px-8 pt-4 md:pt-6 pb-2 md:pb-3">
                    <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
                        <button
                            onClick={handleClose}
                            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors group"
                        >
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-white/80 dark:border-slate-700/50 shadow-sm group-hover:shadow-md transition-shadow">
                                <ArrowLeft size={18} />
                            </div>
                            <span className="text-sm font-medium hidden md:inline">Retour</span>
                        </button>

                        <h1 className="text-lg md:text-xl font-serif font-bold text-slate-800 dark:text-white">
                            Nouveau Client
                        </h1>

                        <button
                            onClick={handleCreate}
                            disabled={!name.trim() || isCreating}
                            className={`px-6 md:px-8 py-2.5 md:py-3 bg-eonora-gradient text-white rounded-full font-bold text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-200/50 dark:shadow-orange-900/20 transition-all duration-300 ${
                                !name.trim() || isCreating
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:scale-105 hover:shadow-[0_0_25px_rgba(255,126,95,0.4)]'
                            }`}
                        >
                            <FolderPlus size={16} />
                            <span className="hidden sm:inline">{isCreating ? 'Création...' : 'Créer le dossier'}</span>
                            <span className="sm:hidden">{isCreating ? '...' : 'Créer'}</span>
                        </button>
                    </div>
                </header>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-10 md:pb-12 pt-1 md:pt-2">
                    <div className="max-w-6xl mx-auto min-h-full lg:min-h-[calc(100vh-170px)] flex items-start lg:items-center">
                        <div className="w-full rounded-[28px] border border-white/70 dark:border-slate-700/40 bg-white/35 dark:bg-slate-900/25 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-3 md:p-5 lg:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 md:gap-8">

                                {/* LEFT COLUMN - Identity */}
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">

                                {/* Avatar + Name card */}
                                <div className={`${sectionCardCls} text-center`}>
                                    {/* Avatar */}
                                    <div className="flex justify-center mb-5">
                                        <div className="relative group">
                                            <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center shadow-xl ring-4 ring-white/80 dark:ring-slate-800/80 transition-all duration-300`}>
                                                {avatarImage ? (
                                                    <img src={avatarImage} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <span className="text-white text-4xl font-serif font-bold select-none">{initials}</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute -bottom-1 -right-1 p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg border border-slate-100 dark:border-slate-600 hover:scale-110 transition-transform"
                                                title="Ajouter un logo"
                                            >
                                                <Camera size={14} className="text-slate-600 dark:text-slate-300" />
                                            </button>
                                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        </div>
                                    </div>

                                    {/* Color picker */}
                                    <div className="flex justify-center gap-1.5 mb-5 flex-wrap px-4">
                                        {AVATAR_GRADIENTS.map((g) => (
                                            <button
                                                key={g}
                                                onClick={() => { setAvatarColor(g); setAvatarImage(undefined); }}
                                                className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} transition-all duration-200 ${
                                                    avatarColor === g && !avatarImage
                                                        ? 'ring-2 ring-offset-2 ring-brand-orange dark:ring-offset-slate-800 scale-110'
                                                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                                                }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Name input */}
                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-eonora-gradient rounded-2xl opacity-0 group-focus-within:opacity-30 transition-opacity duration-500 blur" />
                                        <input
                                            ref={nameRef}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                            placeholder="Nom du client..."
                                            className="relative w-full text-xl font-serif text-center p-4 bg-white/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/50 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/50 text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Status selector */}
                                <div className={sectionCardCls}>
                                    <label className={labelCls}>Statut de démarrage</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.values(ProjectStatus).filter(s => s !== ProjectStatus.ARCHIVED).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setStatus(s)}
                                                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                                                    status === s
                                                        ? 'bg-eonora-gradient text-white shadow-md shadow-orange-200/40 dark:shadow-orange-900/20 scale-[1.02]'
                                                        : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50 border border-slate-200/60 dark:border-slate-700/40'
                                                }`}
                                            >
                                                <span>{STATUS_META[s].emoji}</span>
                                                <span>{STATUS_META[s].label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Template selector */}
                                <div className={sectionCardCls}>
                                    <button
                                        className="w-full flex items-center justify-between gap-2 mb-1"
                                        onClick={() => setTemplateSectionOpen(o => !o)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <LayoutTemplate size={16} className="text-brand-orange" />
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Template de projet</span>
                                        </div>
                                        {templateSectionOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                    </button>
                                    {templateSectionOpen && (
                                        <div className="mt-3 space-y-2">
                                            <button
                                                onClick={() => setSelectedTemplate(null)}
                                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                                    !selectedTemplate
                                                        ? 'bg-eonora-gradient text-white shadow-sm'
                                                        : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-700/50'
                                                }`}
                                            >
                                                ✦ Projet vide (sans template)
                                            </button>
                                            {PROJECT_TEMPLATES.map(tpl => (
                                                <button
                                                    key={tpl.id}
                                                    onClick={() => { setSelectedTemplate(tpl); setStatus(tpl.defaultStatus); }}
                                                    className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
                                                        selectedTemplate?.id === tpl.id
                                                            ? 'bg-eonora-gradient text-white shadow-sm'
                                                            : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-700/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{tpl.icon}</span>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold truncate">{tpl.label}</p>
                                                            <p className={`text-[10px] truncate ${selectedTemplate?.id === tpl.id ? 'text-white/70' : 'text-slate-400'}`}>{tpl.tasks.length} tâches · {tpl.description}</p>
                                                        </div>
                                                        {selectedTemplate?.id === tpl.id && <CheckCircle2 size={14} className="ml-auto flex-shrink-0" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedTemplate && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Tâches incluses</p>
                                            <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                                {selectedTemplate.tasks.map((t, i) => (
                                                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-orange flex-shrink-0" />
                                                        {t.title}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Franck helper note */}
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/40 dark:bg-slate-800/30 border border-white/50 dark:border-slate-700/30">
                                    <div className="w-8 h-8 rounded-full bg-eonora-gradient flex items-center justify-center shrink-0 shadow-sm">
                                        <Sparkles size={14} className="text-white" />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
                                        Franck préparera automatiquement les dossiers et la structure du projet.
                                    </p>
                                </div>
                                </div>

                                {/* RIGHT COLUMN - Details */}
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 delay-100 fill-mode-both">

                                {/* Contact info */}
                                <div className={sectionCardCls}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <User size={16} className="text-brand-orange" />
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Coordonnées</label>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="relative">
                                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={`${inputCls} pl-10`} />
                                        </div>
                                        <div className="relative">
                                            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className={`${inputCls} pl-10`} />
                                        </div>
                                        <div className="relative">
                                            <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Site web" className={`${inputCls} pl-10`} />
                                        </div>
                                        <div className="relative">
                                            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" className={`${inputCls} pl-10`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Links */}
                                <div className={sectionCardCls}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <ExternalLink size={16} className="text-brand-orange" />
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Liens</label>
                                        </div>
                                        <button
                                            onClick={() => setShowLinkAdd(true)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-brand-orange"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    {/* Preset link buttons */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {LINK_PRESETS.filter(lp => !links[lp.key]).map((lp) => (
                                            <button
                                                key={lp.key}
                                                onClick={() => setLinks(prev => ({ ...prev, [lp.key]: '' }))}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-brand-orange/10 hover:text-brand-orange transition-colors border border-transparent hover:border-brand-orange/20"
                                            >
                                                <Plus size={12} /> {lp.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Active links */}
                                    <div className="space-y-2">
                                        {Object.entries(links).map(([key, val]) => {
                                            const preset = LINK_PRESETS.find(lp => lp.key === key);
                                            return (
                                                <div key={key} className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-20 shrink-0 capitalize">{preset?.label || key}</span>
                                                    <div className="relative flex-1">
                                                        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            value={val}
                                                            onChange={(e) => setLinks(prev => ({ ...prev, [key]: e.target.value }))}
                                                            placeholder={preset?.placeholder || 'https://...'}
                                                            className={`${inputCls} pl-9 py-2 text-xs`}
                                                        />
                                                    </div>
                                                    <button onClick={() => removeLink(key)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Add custom link inline */}
                                    {showLinkAdd && (
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                            <input
                                                value={newLinkKey}
                                                onChange={(e) => setNewLinkKey(e.target.value)}
                                                placeholder="Nom"
                                                className={`${inputCls} py-2 text-xs w-28`}
                                                autoFocus
                                            />
                                            <input
                                                value={newLinkValue}
                                                onChange={(e) => setNewLinkValue(e.target.value)}
                                                placeholder="https://..."
                                                className={`${inputCls} py-2 text-xs flex-1`}
                                                onKeyDown={(e) => e.key === 'Enter' && addLink()}
                                            />
                                            <button onClick={addLink} className="p-1.5 text-brand-orange hover:bg-brand-orange/10 rounded-lg transition-colors">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    )}

                                    {Object.keys(links).length === 0 && !showLinkAdd && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Ajoutez des liens Figma, GitHub, WordPress...</p>
                                    )}
                                </div>

                                {/* Access & notes */}
                                <div className={sectionCardCls}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Server size={16} className="text-brand-orange" />
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Accès & Notes</label>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className={labelCls}>Accès serveur / hébergement</label>
                                            <textarea
                                                value={serverAccess}
                                                onChange={(e) => setServerAccess(e.target.value)}
                                                placeholder="ex: OVH - login / pass, SSH..."
                                                rows={2}
                                                className={`${inputCls} resize-none`}
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between">
                                                <label className={labelCls}>Champs personnalisés</label>
                                                <button
                                                    onClick={addCustomField}
                                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-brand-orange"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            {customFields.length > 0 && (
                                                <div className="space-y-2 mt-2">
                                                    {customFields.map((cf, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <input
                                                                value={cf.key}
                                                                onChange={(e) => updateCustomField(idx, 'key', e.target.value)}
                                                                placeholder="Clé"
                                                                className={`${inputCls} py-2 text-xs w-1/3`}
                                                            />
                                                            <input
                                                                value={cf.value}
                                                                onChange={(e) => updateCustomField(idx, 'value', e.target.value)}
                                                                placeholder="Valeur"
                                                                className={`${inputCls} py-2 text-xs flex-1`}
                                                            />
                                                            <button onClick={() => removeCustomField(idx)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {customFields.length === 0 && (
                                                <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">SIRET, contact secondaire, notes...</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
