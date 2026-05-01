/**
 * CompetitorAnalysis — Analyze competitor websites via Gemini + Google Search
 * Embedded in ClientView as the "Concurrents" tab.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Globe, Plus, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp,
    Target, TrendingUp, Shield, Zap, Download, RefreshCw, X, Clock
} from 'lucide-react';
import { apiFetch } from '../services/api';

const STORAGE_PREFIX = 'competitor_analysis_';

interface PersistedAnalysis {
    urls: string[];
    desc: string;
    result: AnalysisResult;
    timestamp: number;
}

function loadPersisted(projectId: string): PersistedAnalysis | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + projectId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function savePersisted(projectId: string, data: Omit<PersistedAnalysis, 'timestamp'>) {
    try {
        localStorage.setItem(
            STORAGE_PREFIX + projectId,
            JSON.stringify({ ...data, timestamp: Date.now() }),
        );
    } catch { /* quota — ignore */ }
}

function clearPersisted(projectId: string) {
    try { localStorage.removeItem(STORAGE_PREFIX + projectId); } catch {}
}

function formatAge(ts: number): string {
    const diff = Date.now() - ts;
    const days = Math.floor(diff / 86400000);
    if (days >= 1) return `il y a ${days}j`;
    const hours = Math.floor(diff / 3600000);
    if (hours >= 1) return `il y a ${hours}h`;
    const min = Math.floor(diff / 60000);
    if (min >= 1) return `il y a ${min}min`;
    return 'à l\'instant';
}

interface Competitor {
    url: string;
    name: string;
    strengths: string[];
    weaknesses: string[];
    score: number;
    summary: string;
}

interface AnalysisResult {
    competitors: Competitor[];
    opportunities: string[];
    recommendation: string;
}

interface CompetitorAnalysisProps {
    clientDescription?: string;
    clientName: string;
    projectId: string;
}

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-8 text-right">{score}</span>
        </div>
    );
};

const CompetitorCard: React.FC<{ competitor: Competitor; index: number }> = ({ competitor, index }) => {
    const [expanded, setExpanded] = useState(true);
    const scoreColor = competitor.score >= 70 ? 'text-emerald-600' : competitor.score >= 50 ? 'text-amber-600' : 'text-red-600';

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <button
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{index + 1}</span>
                    </div>
                    <div className="text-left min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{competitor.name || competitor.url}</p>
                        <p className="text-xs text-slate-500 truncate">{competitor.url}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`text-2xl font-black ${scoreColor}`}>{competitor.score}</span>
                    {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Score global</label>
                        <ScoreBar score={competitor.score} />
                    </div>

                    {competitor.summary && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">{competitor.summary}</p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center gap-1 mb-1.5">
                                <Shield size={12} className="text-emerald-500" />
                                <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Forces</label>
                            </div>
                            <ul className="space-y-1">
                                {competitor.strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-1.5">
                                <AlertCircle size={12} className="text-red-500" />
                                <label className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Faiblesses</label>
                            </div>
                            <ul className="space-y-1">
                                {competitor.weaknesses.map((w, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({ clientDescription, clientName, projectId }) => {
    // Hydrate from localStorage on mount
    const persisted = loadPersisted(projectId);

    const [urls, setUrls] = useState<string[]>(persisted?.urls || ['', '', '']);
    const [desc, setDesc] = useState(persisted?.desc || clientDescription || '');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(persisted?.result || null);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(persisted?.timestamp || null);

    // Re-hydrate when project changes
    useEffect(() => {
        const p = loadPersisted(projectId);
        if (p) {
            setUrls(p.urls);
            setDesc(p.desc);
            setResult(p.result);
            setSavedAt(p.timestamp);
        } else {
            setUrls(['', '', '']);
            setDesc(clientDescription || '');
            setResult(null);
            setSavedAt(null);
        }
        setError(null);
    }, [projectId, clientDescription]);

    const handleAnalyze = useCallback(async () => {
        const validUrls = urls.filter(u => u.trim().length > 3);
        if (!validUrls.length) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await apiFetch('/api/v1/ai/competitor-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: validUrls, client_description: desc }),
            });
            if (!res.ok) throw new Error(`Erreur ${res.status}`);
            const data: AnalysisResult = await res.json();
            setResult(data);
            // Persist for next visit
            savePersisted(projectId, { urls, desc, result: data });
            setSavedAt(Date.now());
        } catch (e: any) {
            setError(e.message || 'Analyse impossible');
        } finally {
            setIsLoading(false);
        }
    }, [urls, desc, projectId]);

    const handleClearAnalysis = useCallback(() => {
        clearPersisted(projectId);
        setResult(null);
        setSavedAt(null);
    }, [projectId]);

    const handleCopyReport = useCallback(() => {
        if (!result) return;
        const lines = [
            `# Analyse concurrentielle — ${clientName}`,
            '',
            ...result.competitors.map(c => [
                `## ${c.name || c.url} (score: ${c.score}/100)`,
                `${c.summary}`,
                `Forces: ${c.strengths.join(', ')}`,
                `Faiblesses: ${c.weaknesses.join(', ')}`,
            ].join('\n')),
            '',
            `## Opportunités`,
            result.opportunities.map(o => `- ${o}`).join('\n'),
            '',
            `## Recommandation`,
            result.recommendation,
        ].join('\n');
        navigator.clipboard.writeText(lines);
    }, [result, clientName]);

    const hasValidUrls = urls.some(u => u.trim().length > 3);

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            {/* URL inputs */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Globe size={15} className="text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sites concurrents à analyser</h3>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Activité du client (contexte)</label>
                    <input
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="Ex: Restaurant gastronomique à Lyon, cible haut de gamme..."
                        className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                </div>

                <div className="space-y-2">
                    {urls.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <Globe size={13} className="text-slate-400 flex-shrink-0" />
                            <input
                                value={url}
                                onChange={(e) => setUrls(prev => prev.map((u, i) => i === idx ? e.target.value : u))}
                                placeholder={`URL concurrent ${idx + 1} (https://...)`}
                                className="flex-1 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            {idx === urls.length - 1 && idx < 2 && (
                                <button onClick={() => setUrls(prev => [...prev, ''])} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors">
                                    <Plus size={13} />
                                </button>
                            )}
                            {urls.length > 1 && (
                                <button onClick={() => setUrls(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={!hasValidUrls || isLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isLoading ? <><Loader2 size={14} className="animate-spin" /> Analyse en cours…</> : <><Target size={14} /> Analyser les concurrents</>}
                </button>

                {isLoading && (
                    <p className="text-xs text-slate-400 text-center">Gemini visite les sites et analyse leur design… (15–30 sec)</p>
                )}
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 flex items-start gap-2">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {result && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Résultats de l'analyse</h3>
                            {savedAt && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    <Clock size={10} /> Sauvegardé {formatAge(savedAt)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleCopyReport} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                <Download size={12} /> Copier le rapport
                            </button>
                            <button onClick={handleClearAnalysis} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors" title="Effacer cette analyse">
                                <Trash2 size={12} /> Effacer
                            </button>
                        </div>
                    </div>

                    {result.competitors.map((c, i) => (
                        <CompetitorCard key={i} competitor={c} index={i} />
                    ))}

                    {result.opportunities.length > 0 && (
                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={14} className="text-emerald-600" />
                                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Opportunités pour Marion</h4>
                            </div>
                            <ul className="space-y-1.5">
                                {result.opportunities.map((o, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                                        <Zap size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {o}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.recommendation && (
                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Target size={14} className="text-indigo-600" />
                                <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Recommandation stratégique</h4>
                            </div>
                            <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">{result.recommendation}</p>
                        </div>
                    )}
                </div>
            )}

            {!result && !isLoading && !error && (
                <div className="text-center py-10 text-slate-400">
                    <Globe size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Entre 1 à 3 URLs de sites concurrents et lance l'analyse.</p>
                    <p className="text-xs mt-1">Gemini analysera le design, l'UX et le CRO de chaque site.</p>
                </div>
            )}
        </div>
    );
};
