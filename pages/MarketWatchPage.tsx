/**
 * MarketWatchPage — Weekly AI-powered trend digest for web design & front-end
 * Cached in localStorage for 7 days to avoid excessive API calls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Newspaper, RefreshCw, Loader2, ExternalLink, Zap,
    Cpu, Palette, Wrench, TrendingUp, Lightbulb, ChevronRight,
    AlertCircle, CheckCircle, Clock,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Trend {
    title: string;
    summary: string;
    source_url: string;
    category: 'ui-ux' | 'technologie' | 'ia' | 'outils' | 'business' | 'inspiration';
    impact: 'high' | 'medium' | 'low';
    action: string;
}

interface WatchResult {
    generated_at: string;
    trends: Trend[];
}

const CACHE_KEY = 'market_watch_cache';
const CACHE_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadCache(): WatchResult | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        const ageMs = Date.now() - timestamp;
        if (ageMs > CACHE_TTL_DAYS * 24 * 3600 * 1000) return null;
        return data;
    } catch {
        return null;
    }
}

function saveCache(data: WatchResult) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

function getCacheAge(): string | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { timestamp } = JSON.parse(raw);
        const diffH = Math.floor((Date.now() - timestamp) / 3600000);
        if (diffH < 1) return 'il y a moins d\'une heure';
        if (diffH < 24) return `il y a ${diffH}h`;
        const diffD = Math.floor(diffH / 24);
        return `il y a ${diffD} jour${diffD > 1 ? 's' : ''}`;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------
const CATEGORY_CONFIG: Record<Trend['category'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    'ui-ux': { label: 'UI / UX', icon: <Palette size={14} />, color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
    'technologie': { label: 'Technologie', icon: <Cpu size={14} />, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    'ia': { label: 'Intelligence Artificielle', icon: <Zap size={14} />, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    'outils': { label: 'Outils', icon: <Wrench size={14} />, color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' },
    'business': { label: 'Business', icon: <TrendingUp size={14} />, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
    'inspiration': { label: 'Inspiration', icon: <Lightbulb size={14} />, color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
};

const IMPACT_CONFIG: Record<Trend['impact'], { label: string; color: string }> = {
    high: { label: 'Impact fort', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    medium: { label: 'Impact moyen', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    low: { label: 'À surveiller', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
};

// ---------------------------------------------------------------------------
// Trend card
// ---------------------------------------------------------------------------
const TrendCard: React.FC<{ trend: Trend; index: number }> = ({ trend, index }) => {
    const [expanded, setExpanded] = useState(false);
    const cat = CATEGORY_CONFIG[trend.category] || CATEGORY_CONFIG['inspiration'];
    const impact = IMPACT_CONFIG[trend.impact] || IMPACT_CONFIG['low'];
    const isNew = index < 2;

    return (
        <div className={`rounded-xl border bg-white dark:bg-slate-900 p-4 flex flex-col gap-3 transition-all hover:shadow-sm ${cat.bg}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cat.bg} ${cat.color}`}>
                        {cat.icon} {cat.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${impact.color}`}>
                        {impact.label}
                    </span>
                    {isNew && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500 text-white animate-pulse">
                            Nouveau
                        </span>
                    )}
                </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{trend.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{trend.summary}</p>

            {expanded && trend.action && (
                <div className="flex items-start gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
                    <CheckCircle size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed"><strong>Action :</strong> {trend.action}</p>
                </div>
            )}

            <div className="flex items-center gap-2 mt-auto">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-slate-500 hover:text-indigo-500 transition-colors flex items-center gap-1"
                >
                    {expanded ? 'Moins' : 'Voir l\'action conseillée'}
                    <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                {trend.source_url && trend.source_url.startsWith('http') && (
                    <a
                        href={trend.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                    >
                        Source <ExternalLink size={11} />
                    </a>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const MarketWatchPage: React.FC = () => {
    const [result, setResult] = useState<WatchResult | null>(loadCache);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cacheAge, setCacheAge] = useState<string | null>(getCacheAge);
    const [activeFilter, setActiveFilter] = useState<Trend['category'] | 'all'>('all');

    const fetchWatch = useCallback(async (force = false) => {
        if (!force) {
            const cached = loadCache();
            if (cached) { setResult(cached); return; }
        }
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/v1/ai/market-watch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(typeof errBody.error === 'string' ? errBody.error : `Erreur ${res.status}`);
            }
            const data: WatchResult = await res.json();
            saveCache(data);
            setResult(data);
            setCacheAge('il y a moins d\'une heure');
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!result) fetchWatch(false);
    }, []);

    const filtered = result?.trends.filter(t => activeFilter === 'all' || t.category === activeFilter) ?? [];
    const categoryKeys = Object.keys(CATEGORY_CONFIG) as Trend['category'][];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                            <Newspaper size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Veille Marché</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Tendances web design &amp; front-end de la semaine · Powered by Gemini
                                {cacheAge && <span className="ml-2 text-slate-400"><Clock size={10} className="inline mr-0.5" />{cacheAge}</span>}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchWatch(true)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-60"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Actualiser
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
                {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 flex items-start gap-3">
                        <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erreur de chargement</p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
                        </div>
                    </div>
                )}

                {isLoading && !result && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-14 text-center">
                        <Loader2 size={32} className="animate-spin text-amber-500 mx-auto mb-4" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">Gemini analyse les tendances du moment…</p>
                        <p className="text-xs text-slate-400 mt-1">Recherche sur le web en cours, cela peut prendre 15–30 secondes</p>
                    </div>
                )}

                {result && (
                    <>
                        {/* Category filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setActiveFilter('all')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeFilter === 'all'
                                        ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900'
                                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                                }`}
                            >
                                Toutes ({result.trends.length})
                            </button>
                            {categoryKeys.map(cat => {
                                const count = result.trends.filter(t => t.category === cat).length;
                                if (!count) return null;
                                const cfg = CATEGORY_CONFIG[cat];
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveFilter(cat)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            activeFilter === cat
                                                ? `${cfg.bg} ${cfg.color} border`
                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                                        }`}
                                    >
                                        {cfg.icon} {cfg.label} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Trend grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((trend, idx) => (
                                <TrendCard key={idx} trend={trend} index={idx} />
                            ))}
                        </div>

                        <p className="text-xs text-slate-400 text-center pt-2">
                            Généré le {new Date(result.generated_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · La veille se recharge automatiquement après 7 jours
                        </p>
                    </>
                )}

                {!result && !isLoading && !error && (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-14 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mx-auto mb-4">
                            <Newspaper size={28} className="text-amber-500" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">Génère ta veille de la semaine</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5">
                            Gemini recherche sur le web les tendances UI/UX, technologie, IA et outils les plus récentes pour toi.
                        </p>
                        <button
                            onClick={() => fetchWatch(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:brightness-105 transition-all"
                        >
                            <Newspaper size={15} /> Générer la veille
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketWatchPage;
