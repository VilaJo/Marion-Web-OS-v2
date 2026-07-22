/**
 * WpStudioPage — L'Atelier de refonte WordPress -> Cursor/Tailwind
 *
 * Wizard 3 étapes :
 *  1. INFOS  — nom du site, secteur, drag-and-drop des screenshots des sections
 *  2. ANALYSE — Gemini multimodal lit les images + génère un plan de refonte
 *  3. PLAN   — sections détectées, design tokens, prompts Cursor par section,
 *              tâches Kanban à importer dans un projet existant
 *
 * Sidebar : "Capture rapide" (ScreenshotToPrompt) pour traiter une seule
 * section ad-hoc, indépendamment d'un site complet.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    ArrowLeft, ArrowRight, Upload, Image as ImageIcon, X, Loader2,
    Sparkles, BookmarkPlus, Check, Copy, FolderPlus, Download,
    AlertCircle, RotateCcw, History, Hammer, Rocket, Layers, Target, Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useProjects } from '../services/queries';
import { useNotificationStore } from '../stores';
import ScreenshotToPrompt from '../components/ScreenshotToPrompt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Screenshot {
    id: string;
    name: string;
    dataUrl: string;
    sizeKb: number;
}

interface RefonteSection {
    index: number;
    name: string;
    role?: string;
    structure?: string;
    colors?: string[];
    typography?: string;
    spacing?: string;
    cursor_prompt: string;
    estimated_minutes?: number;
}

interface RefonteKanbanTask {
    title: string;
    priority: 'Low' | 'Medium' | 'High';
    phase?: string;
    description?: string;
}

interface RefontePlan {
    id: string;
    created_at: number;
    site_name: string;
    site_url?: string;
    industry: string;
    design_tokens: {
        colors?: Record<string, string>;
        typography?: Record<string, string>;
        spacing?: string;
        radius?: string;
    };
    stack_suggestion?: Record<string, string>;
    sections: RefonteSection[];
    kanban_tasks: RefonteKanbanTask[];
    difficulty: number;
    estimated_hours: number;
    battle_plan: string;
}

interface RefonteHistoryItem {
    id: string;
    created_at: number;
    site_name: string;
    site_url?: string;
    industry: string;
    sections_count: number;
    difficulty?: number;
    estimated_hours?: number;
}

const PROMPT_LIBRARY_KEY = 'cursor_prompt_library';
const PROMPT_LIBRARY_INIT_KEY = 'cursor_prompt_library_initialized';
const SUGGESTED_SECTIONS = [
    'Header / Navigation', 'Hero', 'Services', 'À propos',
    'Témoignages', 'Pricing', 'Galerie', 'FAQ',
    'Contact', 'Footer',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

function pushPromptsToLibrary(plan: RefontePlan): number {
    try {
        const raw = localStorage.getItem(PROMPT_LIBRARY_KEY);
        const list: any[] = raw ? JSON.parse(raw) : [];
        let added = 0;
        for (const s of plan.sections) {
            list.unshift({
                id: `wp-studio-${plan.id}-${s.index}`,
                title: `${plan.site_name} — ${s.name}`,
                content: s.cursor_prompt,
                category: 'refonte',
                tags: [s.role, plan.industry, plan.site_name].filter(Boolean) as string[],
                rating: 4,
                usageCount: 0,
                createdAt: new Date().toISOString(),
            });
            added++;
        }
        localStorage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify(list));
        localStorage.setItem(PROMPT_LIBRARY_INIT_KEY, 'true');
        return added;
    } catch {
        return 0;
    }
}

function downloadPlanMarkdown(plan: RefontePlan) {
    const lines = [
        `# Refonte — ${plan.site_name}`,
        plan.site_url ? `Source : ${plan.site_url}` : '',
        `Secteur : ${plan.industry}`,
        ``,
        `**Difficulté :** ${plan.difficulty}/5 — **Heures estimées :** ${plan.estimated_hours}h`,
        ``,
        `## Battle plan`,
        plan.battle_plan,
        ``,
        `## Design tokens`,
        '```json',
        JSON.stringify(plan.design_tokens, null, 2),
        '```',
        ``,
        plan.stack_suggestion ? `## Stack suggérée\n\n${Object.entries(plan.stack_suggestion).map(([k, v]) => `- **${k}** : ${v}`).join('\n')}\n` : '',
        ``,
        `## Sections`,
        ...plan.sections.map(s => [
            `### ${s.index}. ${s.name}${s.role ? ` (${s.role})` : ''}`,
            s.structure ? `**Structure :** ${s.structure}` : '',
            s.colors?.length ? `**Couleurs :** ${s.colors.join(', ')}` : '',
            s.typography ? `**Typo :** ${s.typography}` : '',
            s.estimated_minutes ? `**Durée estimée :** ${s.estimated_minutes} min` : '',
            ``,
            '**Prompt Cursor :**',
            '```',
            s.cursor_prompt,
            '```',
            ``,
        ].filter(Boolean).join('\n')),
        ``,
        `## Tâches Kanban à importer`,
        ...plan.kanban_tasks.map(t => `- [${t.priority}] ${t.title}${t.phase ? ` _(${t.phase})_` : ''}`),
    ];
    const md = lines.filter(l => typeof l === 'string').join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refonte-${plan.site_name.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Step 1 — Upload screenshots
// ---------------------------------------------------------------------------

const Step1: React.FC<{
    siteName: string; setSiteName: (v: string) => void;
    siteUrl: string; setSiteUrl: (v: string) => void;
    industry: string; setIndustry: (v: string) => void;
    screenshots: Screenshot[];
    setScreenshots: React.Dispatch<React.SetStateAction<Screenshot[]>>;
    onNext: () => void;
}> = ({ siteName, setSiteName, siteUrl, setSiteUrl, industry, setIndustry, screenshots, setScreenshots, onNext }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const addFiles = useCallback(async (files: FileList | File[]) => {
        setError(null);
        const arr = Array.from(files);
        if (screenshots.length + arr.length > 12) {
            setError('Maximum 12 screenshots par analyse');
            return;
        }
        const next: Screenshot[] = [];
        for (const f of arr) {
            if (!f.type.startsWith('image/')) continue;
            if (f.size > 6 * 1024 * 1024) {
                setError(`"${f.name}" est trop lourde (max 6 Mo)`);
                continue;
            }
            try {
                const data = await fileToDataUrl(f);
                next.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: SUGGESTED_SECTIONS[screenshots.length + next.length] || f.name.replace(/\.[^.]+$/, ''),
                    dataUrl: data,
                    sizeKb: Math.round(f.size / 1024),
                });
            } catch {
                /* ignore */
            }
        }
        setScreenshots(s => [...s, ...next]);
    }, [screenshots, setScreenshots]);

    const removeScreenshot = (id: string) => setScreenshots(s => s.filter(x => x.id !== id));
    const renameScreenshot = (id: string, name: string) => setScreenshots(s => s.map(x => x.id === id ? { ...x, name } : x));
    const moveScreenshot = (id: string, dir: -1 | 1) => {
        setScreenshots(s => {
            const idx = s.findIndex(x => x.id === id);
            if (idx < 0) return s;
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= s.length) return s;
            const next = [...s];
            [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
            return next;
        });
    };

    const canContinue = !!siteName.trim() && screenshots.length > 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nom du site</label>
                    <input
                        value={siteName}
                        onChange={e => setSiteName(e.target.value)}
                        placeholder="Pâtisserie de Marie"
                        className="mt-1 w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400"
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">URL (optionnel)</label>
                    <input
                        value={siteUrl}
                        onChange={e => setSiteUrl(e.target.value)}
                        placeholder="https://patisserie-marie.fr"
                        className="mt-1 w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400"
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Secteur</label>
                    <input
                        value={industry}
                        onChange={e => setIndustry(e.target.value)}
                        placeholder="Restauration / pâtisserie"
                        className="mt-1 w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400"
                    />
                </div>
            </div>

            <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
                className="cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center border-slate-300 dark:border-slate-600 hover:border-fuchsia-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
                <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Glisse les screenshots des sections du site WP</p>
                <p className="text-xs text-slate-500 mt-1">1 image par section (Hero, Services, Footer…) — max 12 sections, 6 Mo / image</p>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) addFiles(e.target.files); }}
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                    <AlertCircle size={14} />
                    <span>{error}</span>
                </div>
            )}

            {screenshots.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                        {screenshots.length} section{screenshots.length > 1 ? 's' : ''} dans l'ordre
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {screenshots.map((s, i) => (
                            <li key={s.id} className="flex gap-3 p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <img src={s.dataUrl} alt={s.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300">{i + 1}</span>
                                        <input
                                            value={s.name}
                                            onChange={e => renameScreenshot(s.id, e.target.value)}
                                            className="flex-1 text-sm font-semibold text-slate-800 dark:text-white bg-transparent outline-none focus:bg-slate-50 dark:focus:bg-slate-800 rounded px-1"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{s.sizeKb} Ko</p>
                                    <div className="flex items-center gap-1 mt-2">
                                        <button onClick={() => moveScreenshot(s.id, -1)} disabled={i === 0} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40">↑</button>
                                        <button onClick={() => moveScreenshot(s.id, 1)} disabled={i === screenshots.length - 1} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40">↓</button>
                                        <button onClick={() => removeScreenshot(s.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40">Retirer</button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex justify-end pt-2">
                <button
                    onClick={onNext}
                    disabled={!canContinue}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-eonora-gradient text-white font-semibold disabled:opacity-50 hover:brightness-105 transition-all"
                >
                    Lancer l'analyse <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Step 3 — Display the plan
// ---------------------------------------------------------------------------

const PlanView: React.FC<{
    plan: RefontePlan;
    onReset: () => void;
}> = ({ plan, onReset }) => {
    const { data: projects = [] } = useProjects();
    const { addNotification } = useNotificationStore();
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [importing, setImporting] = useState(false);
    const [importedCount, setImportedCount] = useState(0);
    const [savedCount, setSavedCount] = useState(0);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const handleSavePrompts = () => {
        const n = pushPromptsToLibrary(plan);
        setSavedCount(n);
        addNotification('Prompts sauvés', `${n} prompt${n > 1 ? 's ajoutés' : ' ajouté'} à ta bibliothèque.`, 'ai');
    };

    const handleImportTasks = async () => {
        if (!selectedProject) return;
        setImporting(true);
        try {
            const res = await apiFetch('/api/v1/ai/wp-studio/import-tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: selectedProject, tasks: plan.kanban_tasks }),
            });
            const data = await res.json();
            if (res.ok) {
                setImportedCount(data.imported || 0);
                addNotification(
                    'Tâches importées',
                    `${data.imported} tâche${data.imported > 1 ? 's' : ''} ajoutée${data.imported > 1 ? 's' : ''} dans le projet.`,
                    'success',
                );
            } else {
                addNotification('Import impossible', data.error || 'Erreur inconnue', 'error');
            }
        } catch {
            addNotification('Import impossible', 'Serveur injoignable', 'error');
        } finally {
            setImporting(false);
        }
    };

    const handleCopySection = async (s: RefonteSection) => {
        try {
            await navigator.clipboard.writeText(s.cursor_prompt);
            setCopiedIdx(s.index);
            setTimeout(() => setCopiedIdx(null), 1200);
        } catch { /* noop */ }
    };

    return (
        <div className="space-y-6">
            {/* Header card */}
            <div className="rounded-2xl bg-eonora-gradient text-white p-6 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Plan de refonte</p>
                        <h2 className="text-2xl font-bold mt-1">{plan.site_name}</h2>
                        <p className="text-sm text-white/85 mt-1">{plan.industry} · {plan.sections.length} sections</p>
                    </div>
                    <button onClick={onReset} className="text-xs px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md font-semibold flex items-center gap-1.5">
                        <RotateCcw size={13} /> Nouvelle refonte
                    </button>
                </div>
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                        <div className="text-[10px] uppercase font-bold opacity-80">Difficulté</div>
                        <div className="text-2xl font-bold">{plan.difficulty}/5</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                        <div className="text-[10px] uppercase font-bold opacity-80">Heures</div>
                        <div className="text-2xl font-bold">{plan.estimated_hours}h</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                        <div className="text-[10px] uppercase font-bold opacity-80">Tâches</div>
                        <div className="text-2xl font-bold">{plan.kanban_tasks.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                        <div className="text-[10px] uppercase font-bold opacity-80">Sections</div>
                        <div className="text-2xl font-bold">{plan.sections.length}</div>
                    </div>
                </div>
                {plan.battle_plan && (
                    <p className="mt-4 text-sm italic bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                        <Target size={13} className="inline mr-1.5" /> {plan.battle_plan}
                    </p>
                )}
            </div>

            {/* Action bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><BookmarkPlus size={15} className="text-fuchsia-500" /> Bibliothèque de prompts</h3>
                    <p className="text-xs text-slate-500 mt-1">Ajoute les {plan.sections.length} prompts générés à ta bibliothèque Cursor.</p>
                    <button
                        onClick={handleSavePrompts}
                        className="mt-3 w-full px-3 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-sm font-semibold"
                    >
                        {savedCount > 0 ? `${savedCount} prompt${savedCount > 1 ? 's' : ''} ajouté${savedCount > 1 ? 's' : ''} ✓` : 'Sauver tous les prompts'}
                    </button>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><FolderPlus size={15} className="text-emerald-500" /> Importer dans un projet</h3>
                    <p className="text-xs text-slate-500 mt-1">Crée les {plan.kanban_tasks.length} tâches Kanban dans un projet existant.</p>
                    <select
                        value={selectedProject}
                        onChange={e => setSelectedProject(e.target.value)}
                        className="mt-2 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-400"
                    >
                        <option value="">— Choisir un projet —</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.clientName}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleImportTasks}
                        disabled={!selectedProject || importing}
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
                    >
                        {importing ? <Loader2 size={14} className="animate-spin" /> : importedCount > 0 ? <Check size={14} /> : <ArrowRight size={14} />}
                        {importedCount > 0 ? `${importedCount} tâches importées` : 'Importer les tâches'}
                    </button>
                </div>
            </div>

            <button
                onClick={() => downloadPlanMarkdown(plan)}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-fuchsia-600 flex items-center gap-1.5"
            >
                <Download size={13} /> Télécharger le plan en Markdown
            </button>

            {/* Design tokens */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-5">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Layers size={16} className="text-violet-500" /> Design tokens</h3>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plan.design_tokens.colors && (
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Couleurs</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(plan.design_tokens.colors).map(([k, v]) => (
                                    <div key={k} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <span className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600" style={{ background: v }} />
                                        <div className="text-[11px]">
                                            <div className="font-bold text-slate-700 dark:text-slate-200">{k}</div>
                                            <div className="font-mono text-slate-500">{v}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {plan.design_tokens.typography && (
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Typographie</div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                                {Object.entries(plan.design_tokens.typography).map(([k, v]) => (
                                    <div key={k}><strong className="text-slate-500">{k}:</strong> {v}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-500">Espacement :</strong> {plan.design_tokens.spacing || '—'}<br />
                        <strong className="text-slate-500">Radius :</strong> {plan.design_tokens.radius || '—'}
                    </div>
                    {plan.stack_suggestion && (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Rocket size={11} /> Stack suggérée</div>
                            <ul className="space-y-1">
                                {Object.entries(plan.stack_suggestion).map(([k, v]) => (
                                    <li key={k}><strong className="text-slate-500">{k}:</strong> {v}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Sections + prompts */}
            <div>
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3"><Hammer size={16} className="text-amber-500" /> Sections détectées</h3>
                <div className="space-y-3">
                    {plan.sections.map(s => (
                        <details key={s.index} className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden" open={s.index <= 2}>
                            <summary className="cursor-pointer p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <span className="shrink-0 w-7 h-7 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 text-xs font-bold flex items-center justify-center">
                                    {s.index}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-slate-800 dark:text-white">{s.name}</div>
                                    <div className="text-[11px] text-slate-500">
                                        {s.role && <span className="mr-2">{s.role}</span>}
                                        {s.estimated_minutes && <span>· ~{s.estimated_minutes} min</span>}
                                    </div>
                                </div>
                            </summary>
                            <div className="px-4 pb-4 space-y-3 text-xs">
                                {s.structure && <div><strong className="text-slate-500">Structure :</strong> {s.structure}</div>}
                                {s.colors?.length && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <strong className="text-slate-500">Couleurs :</strong>
                                        {s.colors.map(c => (
                                            <span key={c} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono">
                                                <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ background: c }} />
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {s.typography && <div><strong className="text-slate-500">Typo :</strong> {s.typography}</div>}
                                <div className="rounded-xl bg-slate-900 dark:bg-black text-slate-100 p-3 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                                    {s.cursor_prompt}
                                </div>
                                <button
                                    onClick={() => handleCopySection(s)}
                                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200"
                                >
                                    {copiedIdx === s.index ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                    {copiedIdx === s.index ? 'Copié !' : 'Copier ce prompt'}
                                </button>
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const WpStudioPage: React.FC = () => {
    const navigate = useNavigate();
    const { addNotification } = useNotificationStore();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');
    const [industry, setIndustry] = useState('');
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [plan, setPlan] = useState<RefontePlan | null>(null);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [history, setHistory] = useState<RefonteHistoryItem[]>([]);

    useEffect(() => {
        apiFetch('/api/v1/ai/wp-studio/history')
            .then(r => r.json())
            .then(data => setHistory(data.history || []))
            .catch(() => { /* noop */ });
    }, [plan]);

    const startAnalyze = async () => {
        setStep(2);
        setAnalyzeError(null);
        try {
            const res = await apiFetch('/api/v1/ai/wp-studio/analyze-site', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site_name: siteName,
                    site_url: siteUrl,
                    industry,
                    screenshots: screenshots.map(s => ({ name: s.name, data: s.dataUrl })),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAnalyzeError(data.error || 'Analyse impossible.');
                setStep(1);
                addNotification('Analyse échouée', data.error || 'Erreur inconnue', 'error');
                return;
            }
            setPlan(data);
            setStep(3);
            addNotification('Plan de refonte prêt', `${data.sections?.length || 0} sections analysées.`, 'success');
        } catch {
            setAnalyzeError('Impossible de joindre le serveur.');
            setStep(1);
        }
    };

    const reset = () => {
        setStep(1);
        setSiteName('');
        setSiteUrl('');
        setIndustry('');
        setScreenshots([]);
        setPlan(null);
        setAnalyzeError(null);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-6">
                <div>
                    <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                        <ArrowLeft size={13} /> Retour
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Hammer className="text-fuchsia-500" /> Atelier Refonte WP
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Glisse les sections de ton ancien site WP, l'IA te livre le plan de refonte complet en Cursor + Tailwind.</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto">
                {[
                    { n: 1, label: 'Captures' },
                    { n: 2, label: 'Analyse IA' },
                    { n: 3, label: 'Plan' },
                ].map(s => (
                    <div key={s.n} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        step >= s.n
                            ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                        <span className="w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-[10px]">{s.n}</span>
                        {s.label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {step === 1 && (
                        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-6">
                            <Step1
                                siteName={siteName} setSiteName={setSiteName}
                                siteUrl={siteUrl} setSiteUrl={setSiteUrl}
                                industry={industry} setIndustry={setIndustry}
                                screenshots={screenshots} setScreenshots={setScreenshots}
                                onNext={startAnalyze}
                            />
                        </div>
                    )}
                    {step === 2 && (
                        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
                            <Loader2 size={32} className="mx-auto text-fuchsia-500 animate-spin mb-3" />
                            <h3 className="font-bold text-slate-800 dark:text-white">L'IA analyse les {screenshots.length} sections…</h3>
                            <p className="text-xs text-slate-500 mt-1">Détection des couleurs, typo, structure et génération des prompts Cursor. Compte ~30 secondes.</p>
                        </div>
                    )}
                    {step === 3 && plan && (
                        <PlanView plan={plan} onReset={reset} />
                    )}
                    {analyzeError && step === 1 && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                            <AlertCircle size={14} /> {analyzeError}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="space-y-4">
                    <ScreenshotToPrompt
                        defaultContext="Section issue d'un site WordPress"
                        compact={false}
                    />

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><History size={14} className="text-slate-400" /> Refontes récentes</h3>
                        {history.length === 0 ? (
                            <p className="text-xs text-slate-500 mt-2">Aucune analyse pour l'instant. Lance ton premier atelier !</p>
                        ) : (
                            <ul className="mt-2 space-y-2 text-xs">
                                {history.slice(0, 8).map(h => (
                                    <li key={h.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <div className="font-bold text-slate-800 dark:text-white">{h.site_name}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {h.sections_count} section{h.sections_count > 1 ? 's' : ''}
                                            {h.estimated_hours ? ` · ${h.estimated_hours}h` : ''}
                                            {' · '}
                                            {new Date(h.created_at * 1000).toLocaleDateString('fr-FR')}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default WpStudioPage;
