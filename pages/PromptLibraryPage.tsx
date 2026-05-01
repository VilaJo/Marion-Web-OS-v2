/**
 * PromptLibraryPage — Marion's secret weapon: a curated library of Cursor/Claude prompts
 * Stored in localStorage, with AI-powered improvement via Gemini.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    BookMarked, Plus, Search, Star, Copy, CheckCircle, Trash2,
    WandSparkles, X, ChevronDown, Code2, ShoppingCart, User,
    RefreshCw, Tag, Loader2, Edit3, Hash, Zap, Package, RotateCcw,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type PromptCategory = 'landing-page' | 'ecommerce' | 'portfolio' | 'refonte' | 'composant' | 'autre';

export interface CursorPrompt {
    id: string;
    title: string;
    content: string;
    category: PromptCategory;
    tags: string[];
    rating: number;
    usageCount: number;
    createdAt: string;
}

const STORAGE_KEY = 'cursor_prompt_library';

// ---------------------------------------------------------------------------
// Default prompts
// ---------------------------------------------------------------------------
const DEFAULT_PROMPTS: CursorPrompt[] = [
    {
        id: 'default-1',
        title: 'Section Hero — Landing Page SaaS',
        content: `Create a Hero section for a SaaS landing page using React + Tailwind CSS.
Requirements:
- Headline + subheadline with gradient text effect
- Primary CTA button (indigo/violet gradient) + secondary outline button  
- Social proof: "Trusted by 500+ companies" with avatar stack
- Background: subtle mesh gradient, floating card decorations
- Fully responsive (mobile-first)
- Dark mode support with dark: classes
- Smooth entrance animation with Tailwind animate-fade-in`,
        category: 'landing-page',
        tags: ['hero', 'saas', 'cta', 'animation'],
        rating: 5,
        usageCount: 12,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'default-2',
        title: 'Product Card — E-commerce',
        content: `Build a ProductCard component in React + Tailwind with:
- Product image with hover zoom effect
- Price with discount badge (if applicable)
- Star rating component (half-stars supported)
- Add to cart button with loading state
- Wishlist toggle (heart icon, animated)
- Quick view modal trigger
- Skeleton loading state
Props: { id, title, price, originalPrice?, image, rating, reviewCount, inStock }`,
        category: 'ecommerce',
        tags: ['product-card', 'cart', 'rating'],
        rating: 4,
        usageCount: 8,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'default-3',
        title: 'Portfolio Grid — Filterable',
        content: `Create a filterable portfolio grid component with:
- Masonry or CSS grid layout (3 columns desktop, 2 tablet, 1 mobile)
- Category filter buttons with active state
- Hover overlay with project title + "View project" link
- Smooth filter animation (framer-motion or CSS transitions)
- Lazy-loading images with blur placeholder
- "Load more" button
Data: array of { id, title, category, image, url, year }`,
        category: 'portfolio',
        tags: ['grid', 'filter', 'masonry', 'animation'],
        rating: 5,
        usageCount: 6,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'default-4',
        title: 'Navigation — Sticky avec mega-menu',
        content: `Build a sticky navigation header in React + Tailwind:
- Logo on left, nav links center, CTA right
- Mega-menu dropdown on hover (with categories and featured item)
- Mobile hamburger menu with slide-in drawer
- Scroll behavior: transparent on top → white/blur on scroll (backdrop-blur)
- Active link state with underline animation
- Dark mode toggle button
Use useScrollY hook pattern for scroll detection.`,
        category: 'composant',
        tags: ['navigation', 'sticky', 'mega-menu', 'mobile'],
        rating: 4,
        usageCount: 15,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'default-5',
        title: 'Refonte — Audit UI rapide',
        content: `Analyze this existing component and suggest a complete UI/UX redesign:
[PASTE COMPONENT HERE]

Provide:
1. Issues identified (spacing, typography, accessibility, responsiveness)
2. Redesigned component with modern Tailwind CSS
3. What changed and why
4. Accessibility improvements (ARIA, keyboard nav, contrast)
Keep existing functionality, only improve the design.`,
        category: 'refonte',
        tags: ['audit', 'redesign', 'accessibility', 'ux'],
        rating: 5,
        usageCount: 4,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'default-6',
        title: 'Pricing Section — 3 plans',
        content: `Create a pricing section with 3 tiers in React + Tailwind:
- Monthly/Annual toggle with savings badge ("Save 20%")
- 3 cards: Starter, Pro (highlighted/popular), Enterprise
- Feature list with check/x icons
- Highlighted card: larger, gradient border, "Most Popular" badge
- CTA buttons per plan
- "Contact us" for enterprise tier
Props: plans array with { name, price, features, highlighted, cta }
Animate card entrance with stagger effect.`,
        category: 'landing-page',
        tags: ['pricing', 'toggle', 'plans', 'saas'],
        rating: 5,
        usageCount: 9,
        createdAt: new Date().toISOString(),
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Marker key — once the user has interacted (added/imported/cleared), we never
// re-seed defaults. This prevents the "default prompts come back" UX bug after
// the user voluntarily deletes everything.
const INIT_MARKER_KEY = 'cursor_prompt_library_initialized';

function loadPrompts(): CursorPrompt[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const initialized = localStorage.getItem(INIT_MARKER_KEY) === 'true';

        if (!raw) {
            // First-ever visit: seed defaults
            if (!initialized) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROMPTS));
                localStorage.setItem(INIT_MARKER_KEY, 'true');
                return DEFAULT_PROMPTS;
            }
            // Library was intentionally emptied → respect that
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function savePrompts(prompts: CursorPrompt[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
    // Once the user touches the library, lock it in
    localStorage.setItem(INIT_MARKER_KEY, 'true');
}

const CATEGORIES: { value: PromptCategory | 'all'; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Tous', icon: <Hash size={14} /> },
    { value: 'landing-page', label: 'Landing Page', icon: <Zap size={14} /> },
    { value: 'ecommerce', label: 'E-commerce', icon: <ShoppingCart size={14} /> },
    { value: 'portfolio', label: 'Portfolio', icon: <User size={14} /> },
    { value: 'refonte', label: 'Refonte', icon: <RefreshCw size={14} /> },
    { value: 'composant', label: 'Composant', icon: <Package size={14} /> },
    { value: 'autre', label: 'Autre', icon: <Tag size={14} /> },
];

const CATEGORY_COLORS: Record<PromptCategory, string> = {
    'landing-page': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    'ecommerce': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    'portfolio': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    'refonte': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'composant': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    'autre': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------
const StarRating: React.FC<{ rating: number; onChange?: (r: number) => void; size?: number }> = ({ rating, onChange, size = 14 }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => onChange?.(s)} className={onChange ? 'cursor-pointer' : 'cursor-default'}>
                <Star size={size} className={s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
            </button>
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// Prompt editor modal
// ---------------------------------------------------------------------------
const PromptEditorModal: React.FC<{
    initial?: Partial<CursorPrompt>;
    onSave: (p: Omit<CursorPrompt, 'id' | 'createdAt' | 'usageCount'>) => void;
    onClose: () => void;
}> = ({ initial, onSave, onClose }) => {
    const [title, setTitle] = useState(initial?.title || '');
    const [content, setContent] = useState(initial?.content || '');
    const [category, setCategory] = useState<PromptCategory>(initial?.category || 'autre');
    const [tags, setTags] = useState(initial?.tags?.join(', ') || '');
    const [rating, setRating] = useState(initial?.rating || 3);

    const isValid = title.trim().length > 0 && content.trim().length > 0;

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{initial?.id ? 'Modifier le prompt' : 'Nouveau prompt'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Titre</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Hero section SaaS avec animation"
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Catégorie</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value as PromptCategory)}
                                className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                                {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Note</label>
                            <div className="flex items-center gap-2 h-[38px]"><StarRating rating={rating} onChange={setRating} size={16} /></div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tags (séparés par des virgules)</label>
                        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hero, saas, animation, dark-mode"
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Contenu du prompt</label>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
                            placeholder="Décris le composant ou la fonctionnalité à générer..."
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono" />
                    </div>
                </div>
                <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Annuler</button>
                    <button onClick={() => onSave({ title, content, category, tags: tags.split(',').map(t => t.trim()).filter(Boolean), rating })}
                        disabled={!isValid}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50">
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Prompt card
// ---------------------------------------------------------------------------
const PromptCard: React.FC<{
    prompt: CursorPrompt;
    onCopy: (p: CursorPrompt) => void;
    onEdit: (p: CursorPrompt) => void;
    onDelete: (id: string) => void;
    onImprove: (p: CursorPrompt) => void;
    onRatingChange: (id: string, r: number) => void;
    isCopied: boolean;
    isImproving: boolean;
}> = ({ prompt, onCopy, onEdit, onDelete, onImprove, onRatingChange, isCopied, isImproving }) => (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all">
        <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1.5 ${CATEGORY_COLORS[prompt.category]}`}>
                    {CATEGORIES.find(c => c.value === prompt.category)?.label}
                </span>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{prompt.title}</h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit(prompt)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Edit3 size={13} />
                </button>
                <button onClick={() => onDelete(prompt.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Trash2 size={13} />
                </button>
            </div>
        </div>

        <pre className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-hidden line-clamp-4 font-mono whitespace-pre-wrap">
            {prompt.content}
        </pre>

        {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
                {prompt.tags.slice(0, 4).map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{t}</span>
                ))}
            </div>
        )}

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <StarRating rating={prompt.rating} onChange={(r) => onRatingChange(prompt.id, r)} />
                <span className="text-[10px] text-slate-400">{prompt.usageCount}x utilisé</span>
            </div>
        </div>

        <div className="flex gap-1.5 mt-auto">
            <button
                onClick={() => onCopy(prompt)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isCopied
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700'
                }`}
            >
                {isCopied ? <><CheckCircle size={12} /> Copié !</> : <><Copy size={12} /> Copier</>}
            </button>
            <button
                onClick={() => onImprove(prompt)}
                disabled={isImproving}
                title="Améliorer avec l'IA"
                className="py-2 px-2.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-violet-500 hover:border-violet-300 transition-all disabled:opacity-60"
            >
                {isImproving ? <Loader2 size={12} className="animate-spin" /> : <WandSparkles size={12} />}
            </button>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const PromptLibraryPage: React.FC = () => {
    const [prompts, setPrompts] = useState<CursorPrompt[]>(loadPrompts);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<PromptCategory | 'all'>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [improvingId, setImprovingId] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<CursorPrompt | undefined>(undefined);
    const [improveModal, setImproveModal] = useState<{ original: CursorPrompt; result: { improved_prompt: string; changes_made: string[] } } | null>(null);

    const filtered = useMemo(() => {
        let list = prompts;
        if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.content.toLowerCase().includes(q) ||
                p.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        return list.sort((a, b) => b.rating - a.rating || b.usageCount - a.usageCount);
    }, [prompts, activeCategory, search]);

    const handleCopy = useCallback((p: CursorPrompt) => {
        navigator.clipboard.writeText(p.content);
        setCopiedId(p.id);
        setTimeout(() => setCopiedId(null), 2000);
        setPrompts(prev => {
            const updated = prev.map(pr => pr.id === p.id ? { ...pr, usageCount: pr.usageCount + 1 } : pr);
            savePrompts(updated);
            return updated;
        });
    }, []);

    const handleDelete = useCallback((id: string) => {
        setPrompts(prev => {
            const updated = prev.filter(p => p.id !== id);
            savePrompts(updated);
            return updated;
        });
    }, []);

    const handleSave = useCallback((data: Omit<CursorPrompt, 'id' | 'createdAt' | 'usageCount'>) => {
        setPrompts(prev => {
            let updated: CursorPrompt[];
            if (editingPrompt) {
                updated = prev.map(p => p.id === editingPrompt.id ? { ...p, ...data } : p);
            } else {
                const newPrompt: CursorPrompt = {
                    ...data,
                    id: Date.now().toString(),
                    createdAt: new Date().toISOString(),
                    usageCount: 0,
                };
                updated = [newPrompt, ...prev];
            }
            savePrompts(updated);
            return updated;
        });
        setEditorOpen(false);
        setEditingPrompt(undefined);
    }, [editingPrompt]);

    const handleRatingChange = useCallback((id: string, rating: number) => {
        setPrompts(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, rating } : p);
            savePrompts(updated);
            return updated;
        });
    }, []);

    const handleImprove = useCallback(async (p: CursorPrompt) => {
        setImprovingId(p.id);
        try {
            const res = await apiFetch('/api/v1/ai/improve-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: p.content, category: p.category }),
            });
            const data = await res.json();
            if (data.improved_prompt) {
                setImproveModal({ original: p, result: data });
            }
        } catch {
            // silent fail
        } finally {
            setImprovingId(null);
        }
    }, []);

    const handleApplyImprovement = useCallback(() => {
        if (!improveModal) return;
        setPrompts(prev => {
            const updated = prev.map(p => p.id === improveModal.original.id
                ? { ...p, content: improveModal.result.improved_prompt }
                : p
            );
            savePrompts(updated);
            return updated;
        });
        setImproveModal(null);
    }, [improveModal]);

    const handleResetDefaults = useCallback(() => {
        if (window.confirm('Réinitialiser avec les prompts par défaut ? Tes prompts actuels seront perdus.')) {
            savePrompts(DEFAULT_PROMPTS);
            setPrompts(DEFAULT_PROMPTS);
        }
    }, []);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: prompts.length };
        for (const p of prompts) c[p.category] = (c[p.category] || 0) + 1;
        return c;
    }, [prompts]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                            <Code2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bibliothèque de Prompts</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Tes meilleurs prompts Cursor/Claude — prêts à réutiliser</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleResetDefaults} title="Réinitialiser les prompts par défaut"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <RotateCcw size={16} />
                        </button>
                        <button
                            onClick={() => { setEditingPrompt(undefined); setEditorOpen(true); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:brightness-105 transition-all"
                        >
                            <Plus size={15} /> Nouveau prompt
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
                {/* Search + filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher un prompt…"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => setActiveCategory(cat.value as any)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeCategory === cat.value
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                                }`}
                            >
                                {cat.icon} {cat.label}
                                {counts[cat.value] > 0 && (
                                    <span className={`rounded-full px-1 text-[10px] ${activeCategory === cat.value ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                        {counts[cat.value]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results count */}
                {filtered.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {filtered.length} prompt{filtered.length > 1 ? 's' : ''} {activeCategory !== 'all' ? `dans ${CATEGORIES.find(c => c.value === activeCategory)?.label}` : ''}
                    </p>
                )}

                {/* Grid */}
                {filtered.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(p => (
                            <PromptCard
                                key={p.id}
                                prompt={p}
                                onCopy={handleCopy}
                                onEdit={(pr) => { setEditingPrompt(pr); setEditorOpen(true); }}
                                onDelete={handleDelete}
                                onImprove={handleImprove}
                                onRatingChange={handleRatingChange}
                                isCopied={copiedId === p.id}
                                isImproving={improvingId === p.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-14 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                            <BookMarked size={24} className="text-violet-500" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Aucun prompt trouvé</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Crée ton premier prompt ou change les filtres.</p>
                    </div>
                )}
            </div>

            {/* Editor modal */}
            {editorOpen && (
                <PromptEditorModal
                    initial={editingPrompt}
                    onSave={handleSave}
                    onClose={() => { setEditorOpen(false); setEditingPrompt(undefined); }}
                />
            )}

            {/* Improvement result modal */}
            {improveModal && (
                <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={() => setImproveModal(null)}>
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <WandSparkles size={18} className="text-violet-500" />
                                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Prompt amélioré par l'IA</h2>
                            </div>
                            <button onClick={() => setImproveModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {improveModal.result.changes_made?.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 mb-2">Améliorations apportées</p>
                                    <ul className="space-y-1">
                                        {improveModal.result.changes_made.map((c, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                <CheckCircle size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-semibold text-slate-500 mb-2">Nouveau prompt</p>
                                <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-60 font-mono whitespace-pre-wrap">
                                    {improveModal.result.improved_prompt}
                                </pre>
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                            <button onClick={() => setImproveModal(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Ignorer
                            </button>
                            <button onClick={handleApplyImprovement} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold hover:brightness-105 transition-all">
                                Appliquer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PromptLibraryPage;
