/**
 * CodeReviewPanel — Review code via Claude Opus 4.7
 *
 * Marion colle un snippet (sortie de Cursor), Claude évalue selon 6 critères :
 * a11y, dry, responsive, dark mode, performance, naming.
 *
 * Tracking : compte des issues résolues, persisté en `marion_code_review_stats`.
 *
 * Intégré dans FranckChat (Code Mode) et accessible depuis SkillsPage.
 */

import React, { useEffect, useState } from 'react';
import {
    Code2, Loader2, AlertCircle, CheckCircle2, X, Sparkles, Award,
    Accessibility, Recycle, Smartphone, Moon, Zap, Type, Copy, Check,
    TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'high' | 'medium' | 'low';
type Category = 'a11y' | 'dry' | 'responsive' | 'dark_mode' | 'performance' | 'naming';

interface ReviewIssue {
    id?: string;
    severity: Severity;
    category: Category;
    title: string;
    explanation: string;
    suggested_fix?: string;
    fixed?: boolean;
}

interface ReviewResult {
    overall_score: number;
    summary: string;
    issues: ReviewIssue[];
    encouragement?: string;
}

interface ReviewStats {
    totalReviews: number;
    issuesFound: number;
    issuesFixed: number;
    averageScore: number;
    lastReviewAt?: string;
}

const STATS_KEY = 'marion_code_review_stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadStats(): ReviewStats {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return { totalReviews: 0, issuesFound: 0, issuesFixed: 0, averageScore: 0 };
}

function saveStats(stats: ReviewStats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* noop */ }
}

const CATEGORY_META: Record<Category, { label: string; icon: any; color: string }> = {
    a11y: { label: 'Accessibilité', icon: Accessibility, color: 'text-purple-500' },
    dry: { label: 'DRY', icon: Recycle, color: 'text-emerald-500' },
    responsive: { label: 'Responsive', icon: Smartphone, color: 'text-blue-500' },
    dark_mode: { label: 'Dark mode', icon: Moon, color: 'text-indigo-500' },
    performance: { label: 'Performance', icon: Zap, color: 'text-amber-500' },
    naming: { label: 'Nommage', icon: Type, color: 'text-pink-500' },
};

const ALL_CATEGORIES: Category[] = ['a11y', 'dry', 'responsive', 'dark_mode', 'performance', 'naming'];

function severityClass(s: Severity): string {
    if (s === 'high') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    if (s === 'medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

function scoreColor(score: number): string {
    if (score >= 85) return 'text-emerald-500';
    if (score >= 65) return 'text-amber-500';
    return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
    initialCode?: string;
    compact?: boolean;
}

export const CodeReviewPanel: React.FC<Props> = ({ initialCode = '', compact = false }) => {
    const [code, setCode] = useState(initialCode);
    const [framework, setFramework] = useState<'react' | 'vue' | 'svelte'>('react');
    const [focusFilter, setFocusFilter] = useState<Set<Category>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ReviewResult | null>(null);
    const [stats, setStats] = useState<ReviewStats>(() => loadStats());
    const [copiedFixId, setCopiedFixId] = useState<string | null>(null);

    useEffect(() => {
        if (initialCode) setCode(initialCode);
    }, [initialCode]);

    const toggleFocus = (cat: Category) => {
        const next = new Set(focusFilter);
        if (next.has(cat)) next.delete(cat); else next.add(cat);
        setFocusFilter(next);
    };

    const handleReview = async () => {
        if (!code.trim()) {
            setError('Colle d\'abord du code à reviewer.');
            return;
        }
        if (code.length > 16000) {
            setError('Code trop long (max ~16 000 caractères).');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiFetch('/api/v1/ai/code-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    framework,
                    focus: Array.from(focusFilter),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Review impossible.');
                return;
            }
            const withIds: ReviewResult = {
                ...data,
                issues: (data.issues || []).map((i: ReviewIssue, idx: number) => ({
                    ...i,
                    id: `i-${Date.now()}-${idx}`,
                })),
            };
            setResult(withIds);

            const newStats: ReviewStats = {
                totalReviews: stats.totalReviews + 1,
                issuesFound: stats.issuesFound + withIds.issues.length,
                issuesFixed: stats.issuesFixed,
                averageScore: Math.round(
                    (stats.averageScore * stats.totalReviews + (withIds.overall_score || 0)) /
                        (stats.totalReviews + 1),
                ),
                lastReviewAt: new Date().toISOString(),
            };
            setStats(newStats);
            saveStats(newStats);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const toggleFixed = (issueId: string) => {
        if (!result) return;
        const next = result.issues.map(i => {
            if (i.id !== issueId) return i;
            const flipped = !i.fixed;
            const delta = flipped ? 1 : -1;
            const updatedStats = { ...stats, issuesFixed: Math.max(0, stats.issuesFixed + delta) };
            setStats(updatedStats);
            saveStats(updatedStats);
            return { ...i, fixed: flipped };
        });
        setResult({ ...result, issues: next });
    };

    const copyFix = async (issueId: string, fix: string) => {
        try {
            await navigator.clipboard.writeText(fix);
            setCopiedFixId(issueId);
            setTimeout(() => setCopiedFixId(null), 1200);
        } catch { /* noop */ }
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
                        <Award size={18} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-sm">Code Review (Claude Opus 4.7)</h3>
                        <p className="text-[11px] text-white/85">Colle du code, je te dis ce qui peut être amélioré.</p>
                    </div>
                </div>
                {!compact && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-white/15 backdrop-blur rounded-lg p-2 border border-white/20">
                            <div className="text-[9px] uppercase font-bold opacity-80">Reviews</div>
                            <div className="text-lg font-bold">{stats.totalReviews}</div>
                        </div>
                        <div className="bg-white/15 backdrop-blur rounded-lg p-2 border border-white/20">
                            <div className="text-[9px] uppercase font-bold opacity-80">Issues corrigées</div>
                            <div className="text-lg font-bold">{stats.issuesFixed}/{stats.issuesFound}</div>
                        </div>
                        <div className="bg-white/15 backdrop-blur rounded-lg p-2 border border-white/20">
                            <div className="text-[9px] uppercase font-bold opacity-80">Score moy.</div>
                            <div className="text-lg font-bold">{stats.averageScore || '—'}</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={framework}
                        onChange={e => setFramework(e.target.value as any)}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none"
                    >
                        <option value="react">React / Tailwind</option>
                        <option value="vue">Vue</option>
                        <option value="svelte">Svelte</option>
                    </select>
                    <span className="text-[11px] text-slate-500">Focus :</span>
                    {ALL_CATEGORIES.map(cat => {
                        const meta = CATEGORY_META[cat];
                        const Icon = meta.icon;
                        const active = focusFilter.has(cat);
                        return (
                            <button
                                key={cat}
                                onClick={() => toggleFocus(cat)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                    active
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                <Icon size={10} /> {meta.label}
                            </button>
                        );
                    })}
                </div>

                <textarea
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    rows={compact ? 6 : 10}
                    placeholder="Colle ici ton JSX/Tailwind…"
                    className="w-full px-3 py-2 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono outline-none"
                />

                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{code.length} / 16 000 caractères</span>
                    <button
                        onClick={handleReview}
                        disabled={loading || !code.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-semibold disabled:opacity-50 hover:brightness-105"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {loading ? 'Review en cours…' : 'Reviewer le code'}
                    </button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                {result && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className={`text-4xl font-bold ${scoreColor(result.overall_score)}`}>
                                {result.overall_score}
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800 dark:text-white">{result.summary}</div>
                                {result.encouragement && (
                                    <div className="text-xs text-slate-500 italic mt-1 flex items-center gap-1">
                                        <TrendingUp size={11} /> {result.encouragement}
                                    </div>
                                )}
                            </div>
                        </div>

                        {result.issues.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                                Aucune issue critique détectée. Joli boulot !
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {result.issues.map((issue) => {
                                    const meta = CATEGORY_META[issue.category] || CATEGORY_META.naming;
                                    const Icon = meta.icon;
                                    return (
                                        <li
                                            key={issue.id}
                                            className={`p-3 rounded-xl border transition-opacity ${
                                                issue.fixed
                                                    ? 'opacity-50 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => issue.id && toggleFixed(issue.id)}
                                                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${
                                                        issue.fixed
                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                                                    }`}
                                                    aria-label={issue.fixed ? 'Marquer non corrigé' : 'Marquer corrigé'}
                                                >
                                                    {issue.fixed && <Check size={12} />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severityClass(issue.severity)}`}>{issue.severity}</span>
                                                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${meta.color}`}>
                                                            <Icon size={10} /> {meta.label}
                                                        </span>
                                                        <h5 className={`text-sm font-bold ${issue.fixed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                                                            {issue.title}
                                                        </h5>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300">{issue.explanation}</p>
                                                    {issue.suggested_fix && (
                                                        <div className="mt-2 relative">
                                                            <pre className="bg-slate-900 dark:bg-black text-slate-100 rounded-lg p-2 text-[10px] font-mono overflow-x-auto max-h-40">
                                                                <code>{issue.suggested_fix}</code>
                                                            </pre>
                                                            <button
                                                                onClick={() => issue.id && copyFix(issue.id, issue.suggested_fix!)}
                                                                className="absolute top-1.5 right-1.5 p-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                                                aria-label="Copier le fix"
                                                            >
                                                                {copiedFixId === issue.id ? <Check size={10} /> : <Copy size={10} />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeReviewPanel;
