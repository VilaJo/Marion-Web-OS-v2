/**
 * BeforeAfterCompare — Comparateur Avant/Après
 *
 * 2 zones d'upload :
 *  - Original (site WordPress)
 *  - Recréation (preview Cursor / Vercel)
 *
 * Appelle POST /ai/wp-studio/compare-screenshots et affiche :
 *  - score global + 4 sous-scores (couleurs, typo, espacement, responsive)
 *  - punch list des écarts par sévérité
 *  - liste des "wins" (bonnes pratiques déjà respectées)
 *  - bouton "Marquer comme corrigé" (persistance localStorage par projectId)
 *
 * Historique : `compare_history_${projectId}` en localStorage.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Upload, Loader2, Sparkles, CheckCircle2, AlertCircle, Trash2,
    History, Check, X, Award, RefreshCw, Image as ImageIcon,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Issue {
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    fix?: string;
    fixed?: boolean;
}

interface CompareResult {
    score_global: number;
    scores: {
        couleurs: number;
        typographie: number;
        espacement: number;
        responsive: number;
    };
    issues: Issue[];
    wins?: string[];
    encouragement?: string;
    compared_at?: number;
}

interface HistoryEntry extends CompareResult {
    id: string;
    label: string;
}

interface Props {
    projectId?: string;
    defaultFocus?: string;
}

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

function getStorageKey(projectId?: string): string {
    return `compare_history_${projectId || 'global'}`;
}

function loadHistory(projectId?: string): HistoryEntry[] {
    try {
        const raw = localStorage.getItem(getStorageKey(projectId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveHistory(history: HistoryEntry[], projectId?: string) {
    try {
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(history.slice(0, 20)));
    } catch { /* noop */ }
}

function scoreColor(score: number): string {
    if (score >= 90) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700';
    if (score >= 70) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
    return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
}

function severityClass(s: Issue['severity']): string {
    if (s === 'high') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    if (s === 'medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

// ---------------------------------------------------------------------------
// Image picker sub-component
// ---------------------------------------------------------------------------

const ImagePicker: React.FC<{
    label: string;
    accentColor: 'rose' | 'emerald';
    image: string | null;
    onPick: (data: string) => void;
    onClear: () => void;
}> = ({ label, accentColor, image, onPick, onClear }) => {
    const ref = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        if (!file.type.startsWith('image/')) {
            setError('Format non supporté');
            return;
        }
        if (file.size > 6 * 1024 * 1024) {
            setError('Image trop lourde (6 Mo max)');
            return;
        }
        try {
            const data = await fileToDataUrl(file);
            onPick(data);
        } catch {
            setError('Lecture impossible');
        }
    }, [onPick]);

    const ringColor = accentColor === 'rose'
        ? 'border-rose-400 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'
        : 'border-emerald-400 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20';

    const labelChip = accentColor === 'rose'
        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${labelChip}`}>{label}</span>
                {image && (
                    <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1">
                        <X size={11} /> Retirer
                    </button>
                )}
            </div>
            {!image ? (
                <div
                    onClick={() => ref.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => {
                        e.preventDefault();
                        setDragging(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleFile(f);
                    }}
                    className={`cursor-pointer border-2 border-dashed rounded-xl aspect-video flex flex-col items-center justify-center text-center transition-all ${
                        dragging ? ringColor : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                    }`}
                >
                    <Upload size={20} className="text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Glisser une image</p>
                    <p className="text-[10px] text-slate-400 mt-1">JPG/PNG, 6 Mo max</p>
                    <input
                        ref={ref}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                </div>
            ) : (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <img src={image} alt={label} className="w-full h-full object-contain" />
                </div>
            )}
            {error && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={11} /> {error}</p>}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Compare component
// ---------------------------------------------------------------------------

export const BeforeAfterCompare: React.FC<Props> = ({ projectId, defaultFocus = '' }) => {
    const [original, setOriginal] = useState<string | null>(null);
    const [recreation, setRecreation] = useState<string | null>(null);
    const [focus, setFocus] = useState(defaultFocus);
    const [label, setLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CompareResult | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        setHistory(loadHistory(projectId));
    }, [projectId]);

    const handleCompare = async () => {
        if (!original || !recreation) {
            setError('Charge les 2 images avant de comparer.');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiFetch('/api/v1/ai/wp-studio/compare-screenshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original,
                    recreation,
                    focus: focus.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Comparaison impossible.');
                return;
            }
            setResult(data);
            const entry: HistoryEntry = {
                ...data,
                id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                label: label.trim() || focus.trim() || 'Comparaison',
            };
            const next = [entry, ...history];
            setHistory(next);
            saveHistory(next, projectId);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const toggleIssueFixed = (issueIdx: number) => {
        if (!result) return;
        const next = { ...result, issues: [...result.issues] };
        next.issues[issueIdx] = { ...next.issues[issueIdx], fixed: !next.issues[issueIdx].fixed };
        setResult(next);

        // Sync into history
        if (history.length > 0) {
            const updated = [...history];
            updated[0] = { ...updated[0], issues: next.issues };
            setHistory(updated);
            saveHistory(updated, projectId);
        }
    };

    const removeFromHistory = (id: string) => {
        const next = history.filter(h => h.id !== id);
        setHistory(next);
        saveHistory(next, projectId);
    };

    const reset = () => {
        setOriginal(null);
        setRecreation(null);
        setResult(null);
        setError(null);
        setLabel('');
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-rose-500 via-pink-500 to-emerald-500 text-white">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
                        <Award size={18} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-sm">Comparateur Avant / Après</h3>
                        <p className="text-[11px] text-white/85">Mesure ta fidélité visuelle entre l'original WP et ta recréation Cursor</p>
                    </div>
                </div>
                <div className="p-4 md:p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImagePicker
                            label="Original (WordPress)"
                            accentColor="rose"
                            image={original}
                            onPick={setOriginal}
                            onClear={() => setOriginal(null)}
                        />
                        <ImagePicker
                            label="Recréation (Cursor)"
                            accentColor="emerald"
                            image={recreation}
                            onPick={setRecreation}
                            onClear={() => setRecreation(null)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Label (optionnel)</label>
                            <input
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="Hero v2 — palette ajustée"
                                className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-rose-400"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Focus (optionnel)</label>
                            <input
                                value={focus}
                                onChange={e => setFocus(e.target.value)}
                                placeholder="le footer / la grille / le CTA…"
                                className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-rose-400"
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleCompare}
                            disabled={!original || !recreation || loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold text-sm disabled:opacity-50 hover:brightness-105 transition-all"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {loading ? 'Analyse en cours…' : 'Comparer'}
                        </button>
                        {(original || recreation) && (
                            <button
                                onClick={reset}
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <RefreshCw size={12} /> Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {result && (
                <div className="space-y-4">
                    {/* Score card */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Score de fidélité</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-5xl font-bold text-slate-800 dark:text-white">{result.score_global}</span>
                                    <span className="text-slate-400 text-sm">/ 100</span>
                                </div>
                                {result.encouragement && (
                                    <p className="text-xs text-slate-500 mt-2 italic">{result.encouragement}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 max-w-md">
                                {Object.entries(result.scores).map(([k, v]) => (
                                    <div key={k} className={`rounded-xl p-3 border ${scoreColor(v)}`}>
                                        <div className="text-[10px] uppercase font-bold opacity-80 truncate">{k}</div>
                                        <div className="text-2xl font-bold">{v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Wins */}
                    {result.wins && result.wins.length > 0 && (
                        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                            <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"><CheckCircle2 size={14} /> Ce qui marche déjà</h4>
                            <ul className="mt-2 space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                                {result.wins.map((w, i) => <li key={i}>· {w}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Issues */}
                    {result.issues.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Punch list ({result.issues.length} écart{result.issues.length > 1 ? 's' : ''})</h4>
                                <p className="text-[11px] text-slate-500">Coche au fur et à mesure que tu corriges. Tes scores remonteront à la prochaine comparaison.</p>
                            </div>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {result.issues.map((issue, i) => (
                                    <li key={i} className={`p-4 transition-opacity ${issue.fixed ? 'opacity-50' : ''}`}>
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => toggleIssueFixed(i)}
                                                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                                    issue.fixed
                                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                                                }`}
                                                aria-label={issue.fixed ? 'Marquer non corrigé' : 'Marquer corrigé'}
                                            >
                                                {issue.fixed && <Check size={12} />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${severityClass(issue.severity)}`}>
                                                        {issue.severity}
                                                    </span>
                                                    <h5 className={`text-sm font-bold ${issue.fixed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                                                        {issue.title}
                                                    </h5>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-300">{issue.detail}</p>
                                                {issue.fix && (
                                                    <div className="mt-2 text-[11px] font-mono bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300">
                                                        💡 {issue.fix}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                        <History size={14} className="text-slate-400" /> Historique des comparaisons
                    </h3>
                    <ul className="space-y-2">
                        {history.map(h => {
                            const fixedCount = h.issues.filter(i => i.fixed).length;
                            return (
                                <li key={h.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold ${scoreColor(h.score_global)} border`}>
                                        {h.score_global}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{h.label}</div>
                                        <div className="text-[11px] text-slate-500">
                                            {h.compared_at && new Date(h.compared_at * 1000).toLocaleDateString('fr-FR')}
                                            {' · '}
                                            {fixedCount}/{h.issues.length} corrigés
                                        </div>
                                    </div>
                                    <button onClick={() => removeFromHistory(h.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Supprimer">
                                        <Trash2 size={13} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default BeforeAfterCompare;
