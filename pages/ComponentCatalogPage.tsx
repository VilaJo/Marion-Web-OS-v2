/**
 * ComponentCatalogPage — Catalog Marion-style
 *
 * Marion sauve des snippets de composants Tailwind/React qu'elle aime
 * (Hero v3, Pricing 3-tiers, Footer newsletter, etc.). Pour chacun :
 *  - une preview iframe sandbox (si HTML autonome) ou un placeholder visuel
 *  - le code JSX/Tailwind copy-able
 *  - des variantes (light / dark / mobile)
 *  - tags + projet source
 *
 * Persistence : localStorage `marion_component_catalog`. Marion peut exporter
 * tout son catalog en .json pour le sauvegarder/synchroniser.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
    ArrowLeft, Plus, Search, Tag, X, Trash2, Copy, Check, Code2,
    Eye, Sun, Moon, Smartphone, Monitor, Download, Upload, Palette,
    AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentSnippet {
    id: string;
    name: string;
    category: string;
    code: string;
    htmlPreview?: string;
    tags: string[];
    sourceProject?: string;
    notes?: string;
    createdAt: string;
}

const STORAGE_KEY = 'marion_component_catalog';

const CATEGORIES = [
    'Hero', 'Navigation', 'Pricing', 'Features', 'Testimonials',
    'CTA', 'Footer', 'Forms', 'Cards', 'Modals', 'Tables', 'Misc',
];

const PREVIEW_TEMPLATE = (html: string, dark: boolean) => `<!DOCTYPE html>
<html class="${dark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: {} }
    };
  </script>
  <style>
    body { margin: 0; padding: 16px; font-family: ui-sans-serif, system-ui, sans-serif; }
    .dark body { background: #0f172a; color: #f8fafc; }
  </style>
</head>
<body>${html}</body>
</html>`;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadCatalog(): ComponentSnippet[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCatalog(items: ComponentSnippet[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// Preview pane
// ---------------------------------------------------------------------------

const PreviewPane: React.FC<{ snippet: ComponentSnippet }> = ({ snippet }) => {
    const [dark, setDark] = useState(false);
    const [mobile, setMobile] = useState(false);
    const html = snippet.htmlPreview || snippet.code;

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Eye size={11} /> Preview
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() => setDark(!dark)}
                        className={`p-1.5 rounded-lg ${dark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
                        aria-label="Toggle dark mode"
                    >
                        {dark ? <Sun size={11} /> : <Moon size={11} />}
                    </button>
                    <button
                        onClick={() => setMobile(!mobile)}
                        className={`p-1.5 rounded-lg ${mobile ? 'bg-fuchsia-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                        aria-label="Toggle mobile preview"
                    >
                        {mobile ? <Smartphone size={11} /> : <Monitor size={11} />}
                    </button>
                </div>
            </div>
            <div className="p-3 flex justify-center bg-white dark:bg-slate-950">
                <iframe
                    title={`Preview ${snippet.name}`}
                    sandbox=""
                    srcDoc={PREVIEW_TEMPLATE(html, dark)}
                    className={`bg-white border border-slate-200 dark:border-slate-700 rounded-lg transition-all ${mobile ? 'w-[375px]' : 'w-full'}`}
                    style={{ minHeight: 300, height: 360 }}
                />
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Snippet card
// ---------------------------------------------------------------------------

const SnippetCard: React.FC<{
    snippet: ComponentSnippet;
    onDelete: (id: string) => void;
    onEdit: (s: ComponentSnippet) => void;
}> = ({ snippet, onDelete, onEdit }) => {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(snippet.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { /* noop */ }
    };

    return (
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
            <header className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                            {snippet.category}
                        </span>
                        {snippet.sourceProject && (
                            <span className="text-[10px] text-slate-500">depuis <strong>{snippet.sourceProject}</strong></span>
                        )}
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">{snippet.name}</h3>
                    {snippet.notes && <p className="text-xs text-slate-500 mt-1">{snippet.notes}</p>}
                </div>
                <div className="flex gap-1">
                    <button onClick={() => onEdit(snippet)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Editer">
                        <Code2 size={13} />
                    </button>
                    <button onClick={() => onDelete(snippet.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Supprimer">
                        <Trash2 size={13} />
                    </button>
                </div>
            </header>

            <div className="px-4">
                <PreviewPane snippet={snippet} />
            </div>

            <div className="p-4 space-y-2">
                {snippet.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {snippet.tags.map(t => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">#{t}</span>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    >
                        {expanded ? '— Masquer le code' : '+ Voir le code'}
                    </button>
                    <button
                        onClick={copyCode}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
                    >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        {copied ? 'Copié' : 'Copier le code'}
                    </button>
                </div>
                {expanded && (
                    <pre className="bg-slate-900 dark:bg-black text-slate-100 rounded-xl p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72 mt-2">
                        <code>{snippet.code}</code>
                    </pre>
                )}
            </div>
        </article>
    );
};

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------

const SnippetModal: React.FC<{
    initial?: ComponentSnippet | null;
    onClose: () => void;
    onSave: (s: ComponentSnippet) => void;
}> = ({ initial, onClose, onSave }) => {
    const [name, setName] = useState(initial?.name || '');
    const [category, setCategory] = useState(initial?.category || 'Hero');
    const [code, setCode] = useState(initial?.code || '');
    const [htmlPreview, setHtmlPreview] = useState(initial?.htmlPreview || '');
    const [tags, setTags] = useState((initial?.tags || []).join(', '));
    const [sourceProject, setSourceProject] = useState(initial?.sourceProject || '');
    const [notes, setNotes] = useState(initial?.notes || '');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        if (!name.trim() || !code.trim()) {
            setError('Nom et code sont requis.');
            return;
        }
        const snippet: ComponentSnippet = {
            id: initial?.id || `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: name.trim(),
            category,
            code: code.trim(),
            htmlPreview: htmlPreview.trim() || undefined,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            sourceProject: sourceProject.trim() || undefined,
            notes: notes.trim() || undefined,
            createdAt: initial?.createdAt || new Date().toISOString(),
        };
        onSave(snippet);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <h2 className="font-bold text-slate-800 dark:text-white">{initial ? 'Modifier le snippet' : 'Nouveau snippet'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nom</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Hero v3 - dégradé violet" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-violet-400" />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Catégorie</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Code JSX/Tailwind</label>
                        <textarea value={code} onChange={e => setCode(e.target.value)} rows={8} placeholder="<section className='py-20'>..." className="mt-1 w-full px-3 py-2 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            HTML autonome pour preview (optionnel — sinon code utilisé)
                        </label>
                        <textarea value={htmlPreview} onChange={e => setHtmlPreview(e.target.value)} rows={4} placeholder="<section class='py-20'>...</section>" className="mt-1 w-full px-3 py-2 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono outline-none" />
                        <p className="text-[10px] text-slate-500 mt-1">Si tu colles du JSX (className, etc.), ajoute ici une version HTML autonome avec class="…" pour avoir une vraie preview iframe.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tags (séparés par virgules)</label>
                            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="hero, gradient, dark" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-violet-400" />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Projet source (optionnel)</label>
                            <input value={sourceProject} onChange={e => setSourceProject(e.target.value)} placeholder="Café Louise" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-violet-400" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Notes (optionnel)</label>
                        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pense à wrap dans un container max-w-7xl" className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-violet-400" />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
                    <button onClick={onClose} className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Annuler</button>
                    <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold">{initial ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ComponentCatalogPage: React.FC = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<ComponentSnippet[]>(() => loadCatalog());
    const [search, setSearch] = useState('');
    const [activeCat, setActiveCat] = useState<string>('all');
    const [editing, setEditing] = useState<ComponentSnippet | null>(null);
    const [showModal, setShowModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        return items.filter(i => {
            if (activeCat !== 'all' && i.category !== activeCat) return false;
            if (!s) return true;
            return (
                i.name.toLowerCase().includes(s)
                || i.tags.some(t => t.toLowerCase().includes(s))
                || (i.sourceProject || '').toLowerCase().includes(s)
            );
        });
    }, [items, search, activeCat]);

    const persist = (next: ComponentSnippet[]) => {
        setItems(next);
        saveCatalog(next);
    };

    const handleSave = (s: ComponentSnippet) => {
        const exists = items.some(i => i.id === s.id);
        const next = exists
            ? items.map(i => i.id === s.id ? s : i)
            : [s, ...items];
        persist(next);
        setShowModal(false);
        setEditing(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Supprimer ce snippet ?')) return;
        persist(items.filter(i => i.id !== id));
    };

    const handleEdit = (s: ComponentSnippet) => {
        setEditing(s);
        setShowModal(true);
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marion-components-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result as string);
                if (!Array.isArray(imported)) throw new Error('Format invalide');
                // Merge by id, imported wins
                const existingIds = new Set(items.map(i => i.id));
                const merged = [
                    ...imported,
                    ...items.filter(i => !imported.find((x: any) => x.id === i.id)),
                ];
                persist(merged);
                alert(`${imported.length} snippets importés.`);
            } catch (err: any) {
                alert(`Import impossible : ${err.message}`);
            }
        };
        reader.readAsText(file);
    };

    const counts = useMemo(() => {
        const m = new Map<string, number>();
        items.forEach(i => m.set(i.category, (m.get(i.category) || 0) + 1));
        return m;
    }, [items]);

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                <div>
                    <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                        <ArrowLeft size={13} /> Retour
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Palette className="text-violet-500" /> Catalog Marion
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Tous tes snippets favoris, prêts à recoller. Preview live, dark mode, mobile.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleExport}
                        disabled={items.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                        <Download size={13} /> Exporter
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        <Upload size={13} /> Importer
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
                    />
                    <button
                        onClick={() => { setEditing(null); setShowModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold"
                    >
                        <Plus size={14} /> Nouveau
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <aside className="lg:col-span-1 space-y-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Chercher…"
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-violet-400"
                        />
                    </div>
                    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-1">
                        <button
                            onClick={() => setActiveCat('all')}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                                activeCat === 'all' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span>Toutes</span>
                            <span className="text-[10px] opacity-60">{items.length}</span>
                        </button>
                        {CATEGORIES.map(c => {
                            const n = counts.get(c) || 0;
                            return (
                                <button
                                    key={c}
                                    onClick={() => setActiveCat(c)}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                                        activeCat === c ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{c}</span>
                                    <span className={`text-[10px] ${n === 0 ? 'opacity-30' : 'opacity-60'}`}>{n}</span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <div className="lg:col-span-3 space-y-4">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <Tag size={32} className="mx-auto mb-2 opacity-40" />
                            {items.length === 0
                                ? "Catalog vide ! Ajoute ton premier snippet."
                                : "Aucun snippet ne correspond à ta recherche."}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filtered.map(s => (
                                <SnippetCard key={s.id} snippet={s} onDelete={handleDelete} onEdit={handleEdit} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <SnippetModal
                    initial={editing}
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default ComponentCatalogPage;
