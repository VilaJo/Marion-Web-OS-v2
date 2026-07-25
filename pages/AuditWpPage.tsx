/**
 * AuditWpPage — Audit prospect WordPress
 *
 * Marion colle l'URL d'un prospect, l'app calcule :
 *  - Snapshot prospect (CMS, builder, plugins, risques, économie)
 *  - Lighthouse (si PageSpeed disponible) + Core Web Vitals
 *  - Coût annuel WP vs custom + argumentaire de vente
 */

import React, { useMemo, useState } from 'react';
import {
    ArrowLeft, Search, Loader2, AlertCircle, Shield, Zap, TrendingUp,
    Target, Copy, Check, Download, ExternalLink, Mail, FileText,
    AlertTriangle, CheckCircle2, Blocks, Puzzle, Gauge,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditResult {
    url: string;
    audited_at: number;
    probe?: {
        title?: string;
        meta_description?: string;
        is_wordpress?: boolean;
        wp_plugins?: string[];
        wp_themes?: string[];
        builder_signals?: Record<string, boolean>;
        has_favicon?: boolean;
        has_canonical?: boolean;
        has_viewport?: boolean;
        og_image?: string | boolean;
    };
    lighthouse_mobile?: {
        available: boolean;
        scores?: { performance?: number; accessibility?: number; seo?: number; best_practices?: number };
        metrics?: { lcp?: string; fcp?: string; cls?: string; tbt?: string; speed_index?: string };
        error?: string;
    };
    ai?: {
        site?: { url: string; title?: string; is_wordpress?: boolean };
        wp_findings?: { plugins_detected?: string[]; themes_detected?: string[]; builder?: string };
        risks?: { severity: 'high' | 'medium' | 'low'; title: string; detail: string }[];
        annual_cost_wp_eur?: { hosting?: number; maintenance?: number; licenses?: number; total?: number };
        annual_cost_custom_eur?: { hosting?: number; maintenance?: number; licenses?: number; total?: number };
        savings_per_year_eur?: number;
        opportunities?: string[];
        sales_pitch_markdown?: string;
        error?: string;
    };
}

type ScoreKey = 'performance' | 'accessibility' | 'seo' | 'best_practices';

function hasRealScores(scores?: { performance?: number; accessibility?: number; seo?: number; best_practices?: number }): boolean {
    if (!scores) return false;
    return [scores.performance, scores.accessibility, scores.seo, scores.best_practices]
        .some((v) => typeof v === 'number');
}

function scoreTone(s?: number): string {
    if (s === undefined || s === null) return 'text-slate-400';
    if (s >= 90) return 'text-[#2aada0]';
    if (s >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-[#b05070]';
}

function scoreHint(s?: number): string {
    if (s === undefined || s === null) return 'n/d';
    if (s >= 90) return 'Bon';
    if (s >= 70) return 'Moyen';
    return 'Faible';
}

function severityClass(s: string) {
    if (s === 'high') return 'bg-[#b05070]/12 text-[#b05070]';
    if (s === 'medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-500';
}

function detectBuilder(result: AuditResult): string {
    const fromAi = result.ai?.wp_findings?.builder?.trim();
    if (fromAi) return fromAi;
    const signals = result.probe?.builder_signals || {};
    const hit = Object.entries(signals).find(([, v]) => v);
    if (!hit) return '—';
    const name = hit[0].replace(/_/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AuditWpPage: React.FC = () => {
    const navigate = useNavigate();
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AuditResult | null>(null);
    const [copiedPitch, setCopiedPitch] = useState(false);

    const handleAudit = async () => {
        if (!url.trim()) {
            setError('Entre une URL.');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiFetch('/api/v1/audit/wp-prospect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Audit impossible.');
                return;
            }
            setResult(data);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const copyPitch = async () => {
        if (!result?.ai?.sales_pitch_markdown) return;
        try {
            await navigator.clipboard.writeText(result.ai.sales_pitch_markdown);
            setCopiedPitch(true);
            setTimeout(() => setCopiedPitch(false), 1500);
        } catch { /* noop */ }
    };

    const downloadReport = () => {
        if (!result) return;
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit-${new URL(result.url).hostname}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const lh = result?.lighthouse_mobile;
    const scores = lh?.scores;
    const lighthouseReady = Boolean(lh?.available && hasRealScores(scores));

    const snapshot = useMemo(() => {
        if (!result) return null;
        const plugins = result.probe?.wp_plugins?.length
            ?? result.ai?.wp_findings?.plugins_detected?.length
            ?? 0;
        const risks = result.ai?.risks || [];
        const highRisks = risks.filter((r) => r.severity === 'high').length;
        const savings = result.ai?.savings_per_year_eur;
        const missingBasics = [
            !result.probe?.has_viewport && 'viewport',
            !result.probe?.has_favicon && 'favicon',
            !result.probe?.has_canonical && 'canonical',
            !result.probe?.meta_description && 'meta description',
            !result.probe?.og_image && 'og:image',
        ].filter(Boolean) as string[];

        return {
            isWp: Boolean(result.probe?.is_wordpress ?? result.ai?.site?.is_wordpress),
            builder: detectBuilder(result),
            plugins,
            highRisks,
            riskTotal: risks.length,
            savings,
            title: result.probe?.title || result.ai?.site?.title || new URL(result.url).hostname,
            missingBasics,
        };
    }, [result]);

    const scoreItems: { key: ScoreKey; label: string; icon: React.ElementType }[] = [
        { key: 'performance', label: 'Performance', icon: Zap },
        { key: 'accessibility', label: 'Accessibilité', icon: Shield },
        { key: 'seo', label: 'SEO', icon: Target },
        { key: 'best_practices', label: 'Bonnes pratiques', icon: CheckCircle2 },
    ];

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="mb-6">
                <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                    <ArrowLeft size={13} /> Retour
                </button>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="text-[#b05070]" size={22} /> Audit Prospect WP
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Colle une URL — synthèse pitchable (CMS, risques, coûts) en ~30 secondes.
                </p>
            </div>

            {/* Input */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 mb-5">
                <form onSubmit={(e) => { e.preventDefault(); handleAudit(); }} className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://patisserie-marie.fr"
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium disabled:opacity-50 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                        {loading ? 'Audit en cours…' : 'Lancer l\'audit'}
                    </button>
                </form>
                {error && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-[#b05070] text-xs">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                {loading && (
                    <p className="text-xs text-slate-500 mt-3">
                        Analyse HTML + PageSpeed + synthèse IA… 20–40 s.
                    </p>
                )}
            </div>

            {result && snapshot && (
                <div className="space-y-5">
                    {/* Functional prospect snapshot — always useful */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Synthèse prospect</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">{snapshot.title}</p>
                            </div>
                            <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 shrink-0"
                            >
                                {new URL(result.url).hostname} <ExternalLink size={11} />
                            </a>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800">
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5">
                                    <Blocks size={10} /> CMS
                                </p>
                                <p className={`text-sm font-semibold ${snapshot.isWp ? 'text-[#4a72c4]' : 'text-slate-800 dark:text-white'}`}>
                                    {snapshot.isWp ? 'WordPress' : 'Autre / inconnu'}
                                </p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Builder</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{snapshot.builder}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5">
                                    <Puzzle size={10} /> Plugins
                                </p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white tabular-nums">
                                    {snapshot.plugins}
                                    <span className="text-[11px] font-medium text-slate-400 ml-1">détectés</span>
                                </p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5">
                                    <AlertTriangle size={10} /> Risques
                                </p>
                                <p className={`text-sm font-semibold tabular-nums ${snapshot.highRisks > 0 ? 'text-[#b05070]' : 'text-slate-800 dark:text-white'}`}>
                                    {snapshot.highRisks > 0
                                        ? `${snapshot.highRisks} critique${snapshot.highRisks > 1 ? 's' : ''}`
                                        : snapshot.riskTotal > 0
                                            ? `${snapshot.riskTotal} signalé${snapshot.riskTotal > 1 ? 's' : ''}`
                                            : 'Aucun'}
                                </p>
                            </div>
                            <div className="px-4 py-3 col-span-2 md:col-span-1">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5">
                                    <TrendingUp size={10} /> Économie / an
                                </p>
                                <p className="text-sm font-semibold text-[#2aada0] tabular-nums">
                                    {typeof snapshot.savings === 'number'
                                        ? `${snapshot.savings.toLocaleString('fr-FR')} €`
                                        : '—'}
                                </p>
                            </div>
                        </div>

                        {snapshot.missingBasics.length > 0 && (
                            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/30">
                                <p className="text-[11px] text-slate-500">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">Manques SEO / tech : </span>
                                    {snapshot.missingBasics.join(' · ')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Lighthouse — only when real scores exist */}
                    {lighthouseReady ? (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                <Gauge size={14} className="text-slate-400" />
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                    Lighthouse mobile
                                </p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800">
                                {scoreItems.map(({ key, label, icon: Icon }) => {
                                    const s = scores?.[key];
                                    return (
                                        <div key={key} className="px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5">
                                                <Icon size={10} /> {label}
                                            </p>
                                            <p className={`text-2xl font-semibold tabular-nums ${scoreTone(s)}`}>
                                                {typeof s === 'number' ? s : '—'}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{scoreHint(s)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            {lh?.metrics && Object.values(lh.metrics).some(Boolean) && (
                                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {Object.entries(lh.metrics).map(([k, v]) => v && (
                                        <div key={k}>
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{k}</p>
                                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 tabular-nums">{v}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 flex items-start gap-2">
                            <Gauge size={14} className="text-slate-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    Scores Lighthouse indisponibles
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {lh?.error
                                        ? `PageSpeed : ${lh.error}. La synthèse ci-dessus reste exploitable pour le pitch.`
                                        : 'PageSpeed n’a pas renvoyé de scores. La synthèse CMS / risques / coûts suffit pour pitcher.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* WordPress findings */}
                    {result.probe?.is_wordpress && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Site WordPress détecté</h3>
                            {result.probe.wp_plugins && result.probe.wp_plugins.length > 0 && (
                                <div className="mt-1">
                                    <div className="text-[11px] text-slate-500 mb-1.5">Plugins ({result.probe.wp_plugins.length})</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {result.probe.wp_plugins.map(p => (
                                            <span key={p} className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {result.ai?.wp_findings?.builder && (
                                <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                                    <span className="text-slate-400 font-medium">Builder · </span>
                                    {result.ai.wp_findings.builder}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cost comparison */}
                    {result.ai?.annual_cost_wp_eur && result.ai?.annual_cost_custom_eur && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Coût WP / an</h4>
                                <div className="text-2xl font-semibold text-[#b05070] tabular-nums mt-1">{result.ai.annual_cost_wp_eur.total?.toLocaleString('fr-FR')} €</div>
                                <ul className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                                    {result.ai.annual_cost_wp_eur.hosting !== undefined && <li>Hébergement · {result.ai.annual_cost_wp_eur.hosting} €</li>}
                                    {result.ai.annual_cost_wp_eur.maintenance !== undefined && <li>Maintenance · {result.ai.annual_cost_wp_eur.maintenance} €</li>}
                                    {result.ai.annual_cost_wp_eur.licenses !== undefined && <li>Licences · {result.ai.annual_cost_wp_eur.licenses} €</li>}
                                </ul>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Coût sur-mesure / an</h4>
                                <div className="text-2xl font-semibold text-[#2aada0] tabular-nums mt-1">{result.ai.annual_cost_custom_eur.total?.toLocaleString('fr-FR')} €</div>
                                <ul className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                                    {result.ai.annual_cost_custom_eur.hosting !== undefined && <li>Hébergement · {result.ai.annual_cost_custom_eur.hosting} €</li>}
                                    {result.ai.annual_cost_custom_eur.maintenance !== undefined && <li>Maintenance · {result.ai.annual_cost_custom_eur.maintenance} €</li>}
                                    {result.ai.annual_cost_custom_eur.licenses !== undefined && <li>Licences · {result.ai.annual_cost_custom_eur.licenses} €</li>}
                                </ul>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-4">
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest opacity-70 flex items-center gap-1.5"><TrendingUp size={11} /> Économie</h4>
                                <div className="text-2xl font-semibold tabular-nums mt-1">{result.ai.savings_per_year_eur?.toLocaleString('fr-FR')} €</div>
                                <p className="text-[11px] opacity-70 mt-2">Économies / an pour le client</p>
                            </div>
                        </div>
                    )}

                    {/* Risks */}
                    {result.ai?.risks && result.ai.risks.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                                <AlertTriangle size={14} className="text-amber-500" /> Risques identifiés
                            </h3>
                            <ul className="space-y-2">
                                {result.ai.risks.map((r, i) => (
                                    <li key={i} className="p-3 rounded-md border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${severityClass(r.severity)}`}>{r.severity}</span>
                                            <h5 className="text-sm font-semibold text-slate-800 dark:text-white">{r.title}</h5>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{r.detail}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Opportunities */}
                    {result.ai?.opportunities && result.ai.opportunities.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                                <Target size={14} className="text-[#2aada0]" /> Opportunités à pitcher
                            </h3>
                            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                                {result.ai.opportunities.map((o, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-[#2aada0]" /> {o}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Sales pitch */}
                    {result.ai?.sales_pitch_markdown && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
                            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <FileText size={14} /> Argumentaire de vente
                                </h3>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={copyPitch}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                                    >
                                        {copiedPitch ? <Check size={11} className="text-[#2aada0]" /> : <Copy size={11} />}
                                        {copiedPitch ? 'Copié' : 'Copier le pitch'}
                                    </button>
                                    <a
                                        href={`mailto:?subject=${encodeURIComponent('Refonte de votre site')}&body=${encodeURIComponent(result.ai.sales_pitch_markdown)}`}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium"
                                    >
                                        <Mail size={11} /> Envoyer par email
                                    </a>
                                </div>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 rounded-md p-4 border border-slate-100 dark:border-slate-800 leading-relaxed font-sans">
                                {result.ai.sales_pitch_markdown}
                            </pre>
                        </div>
                    )}

                    {/* Footer actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={downloadReport}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <Download size={12} /> Télécharger l'audit (JSON)
                        </button>
                        <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <ExternalLink size={12} /> Ouvrir le site
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditWpPage;
