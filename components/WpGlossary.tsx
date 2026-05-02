/**
 * WpGlossary — lookup d'un terme WordPress vers son équivalent moderne
 *
 * Utilisé en sidebar de RecipesPage et accessible depuis FranckChat
 * via la slash-command `/wp <terme>`.
 *
 * Cache localStorage (`wp_glossary_cache`) pour éviter de re-payer Gemini
 * sur des termes déjà cherchés.
 */

import React, { useEffect, useState } from 'react';
import { Search, Loader2, ExternalLink, Check, Copy, Sparkles, AlertCircle, History } from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types & cache
// ---------------------------------------------------------------------------

export interface GlossaryEntry {
    wp_term: string;
    wp_definition: string;
    modern_equivalent: string;
    code_example: string;
    code_lang?: string;
    pitfall: string;
    doc_url?: string;
    cached_at?: number;
}

const CACHE_KEY = 'wp_glossary_cache';

function loadCache(): Record<string, GlossaryEntry> {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveCache(cache: Record<string, GlossaryEntry>) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* noop */ }
}

function normaliseTerm(t: string) {
    return t.trim().toLowerCase();
}

// Public lookup helper (used by FranckChat's `/wp` slash command).
export async function wpGlossaryLookup(term: string): Promise<GlossaryEntry> {
    const key = normaliseTerm(term);
    const cache = loadCache();
    if (cache[key]) return cache[key];

    const res = await apiFetch('/api/v1/ai/wp-glossary/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Glossary lookup failed');
    const entry: GlossaryEntry = { ...data, cached_at: Date.now() };
    cache[key] = entry;
    saveCache(cache);
    return entry;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
    initialTerm?: string;
    onResult?: (entry: GlossaryEntry) => void;
}

export const WpGlossary: React.FC<Props> = ({ initialTerm = '', onResult }) => {
    const [term, setTerm] = useState(initialTerm);
    const [loading, setLoading] = useState(false);
    const [entry, setEntry] = useState<GlossaryEntry | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const cache = loadCache();
        setHistory(
            Object.values(cache)
                .sort((a, b) => (b.cached_at || 0) - (a.cached_at || 0))
                .slice(0, 8)
                .map(e => e.wp_term),
        );
    }, [entry]);

    const lookup = async (q?: string) => {
        const t = (q ?? term).trim();
        if (!t) return;
        setLoading(true);
        setError(null);
        try {
            const result = await wpGlossaryLookup(t);
            setEntry(result);
            onResult?.(result);
        } catch (e: any) {
            setError(e?.message || 'Recherche impossible');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (!entry) return;
        try {
            await navigator.clipboard.writeText(entry.code_example);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { /* noop */ }
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                <h3 className="font-bold text-sm flex items-center gap-2"><Sparkles size={14} /> Glossaire WP → moderne</h3>
                <p className="text-[11px] text-white/80 mt-0.5">Tape un terme WordPress, je te donne l'équivalent.</p>
            </div>
            <div className="p-4 space-y-3">
                <form
                    onSubmit={(e) => { e.preventDefault(); lookup(); }}
                    className="relative"
                >
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={term}
                        onChange={e => setTerm(e.target.value)}
                        placeholder="Ex: ACF, wp_query, shortcode…"
                        className="w-full pl-9 pr-20 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-blue-400"
                    />
                    <button
                        type="submit"
                        disabled={!term.trim() || loading}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-1"
                    >
                        {loading ? <Loader2 size={11} className="animate-spin" /> : 'Chercher'}
                    </button>
                </form>

                {error && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {entry && (
                    <div className="space-y-2 text-xs">
                        <div>
                            <div className="font-bold text-sm text-slate-800 dark:text-white">{entry.wp_term}</div>
                            <p className="text-slate-500 mt-0.5">{entry.wp_definition}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Équivalent moderne</span>
                            <p className="text-slate-700 dark:text-slate-200 mt-0.5">{entry.modern_equivalent}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase text-slate-500">Exemple</span>
                                <button onClick={handleCopyCode} className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1">
                                    {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                    {copied ? 'Copié' : 'Copier'}
                                </button>
                            </div>
                            <pre className="bg-slate-900 dark:bg-black text-slate-100 rounded-lg p-2 text-[10px] font-mono leading-relaxed overflow-x-auto max-h-40">
                                <code>{entry.code_example}</code>
                            </pre>
                        </div>
                        {entry.pitfall && (
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                ⚠️ {entry.pitfall}
                            </div>
                        )}
                        {entry.doc_url && (
                            <a
                                href={entry.doc_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <ExternalLink size={11} /> Documentation
                            </a>
                        )}
                    </div>
                )}

                {history.length > 0 && !entry && (
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
                            <History size={10} /> Récents
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {history.map(h => (
                                <button
                                    key={h}
                                    onClick={() => { setTerm(h); lookup(h); }}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300"
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WpGlossary;
