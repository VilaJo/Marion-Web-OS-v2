/**
 * AuditWpPage — Audit prospect WordPress
 *
 * Marion colle l'URL d'un prospect, l'app calcule :
 *  - Lighthouse (perf, a11y, SEO, BP) via PageSpeed Insights API
 *  - Plugins WP détectés + builders (Elementor, Divi…)
 *  - Coût annuel WP estimé vs custom (économies projetées)
 *  - Risques sécu / perf / dépendances
 *  - Argumentaire de vente prêt à coller
 */

import React, { useState } from 'react';
import {
    ArrowLeft, Search, Loader2, AlertCircle, Shield, Zap, TrendingUp,
    Target, Copy, Check, Download, ExternalLink, Mail, FileText,
    AlertTriangle, CheckCircle2,
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

function scoreColor(s?: number) {
    if (s === undefined || s === null) return 'text-slate-400 bg-slate-100 dark:bg-slate-800';
    if (s >= 90) return 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30';
    if (s >= 70) return 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30';
    return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
}

function severityClass(s: string) {
    if (s === 'high') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    if (s === 'medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
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

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="mb-6">
                <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                    <ArrowLeft size={13} /> Retour
                </button>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Shield className="text-rose-500" /> Audit Prospect WP
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Colle une URL, l'app sort un rapport Lighthouse + plugins + coût + argumentaire en 30 secondes.
                </p>
            </div>

            {/* Input */}
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-5 mb-6">
                <form onSubmit={(e) => { e.preventDefault(); handleAudit(); }} className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://patisserie-marie.fr"
                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-rose-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold disabled:opacity-50 hover:brightness-105"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                        {loading ? 'Audit en cours…' : 'Lancer l\'audit'}
                    </button>
                </form>
                {error && (
                    <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                {loading && (
                    <p className="text-xs text-slate-500 mt-3">
                        L'audit prend 20-40 s (Lighthouse + détection plugins + analyse IA). Patiente…
                    </p>
                )}
            </div>

            {result && (
                <div className="space-y-5">
                    {/* Lighthouse scores */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { key: 'performance', label: 'Performance', icon: Zap },
                            { key: 'accessibility', label: 'A11y', icon: Shield },
                            { key: 'seo', label: 'SEO', icon: Target },
                            { key: 'best_practices', label: 'Best Practices', icon: CheckCircle2 },
                        ].map(({ key, label, icon: Icon }) => {
                            const s = (scores as any)?.[key];
                            return (
                                <div key={key} className={`rounded-2xl p-4 border ${scoreColor(s)} border-current/20`}>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-80">
                                        <Icon size={11} /> {label}
                                    </div>
                                    <div className="text-3xl font-bold mt-1">{s ?? '—'}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* CWV metrics */}
                    {lh?.metrics && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-2">Core Web Vitals (mobile)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                                {Object.entries(lh.metrics).map(([k, v]) => v && (
                                    <div key={k} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                                        <div className="text-[10px] uppercase font-bold text-slate-500">{k}</div>
                                        <div className="font-bold text-slate-800 dark:text-white">{v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* WordPress findings */}
                    {result.probe?.is_wordpress && (
                        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Site WordPress détecté</h3>
                            {result.probe.wp_plugins && result.probe.wp_plugins.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-[10px] font-bold uppercase text-slate-500">Plugins détectés ({result.probe.wp_plugins.length})</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {result.probe.wp_plugins.map(p => (
                                            <span key={p} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {result.ai?.wp_findings?.builder && (
                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                    <strong>Builder :</strong> {result.ai.wp_findings.builder}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cost comparison */}
                    {result.ai?.annual_cost_wp_eur && result.ai?.annual_cost_custom_eur && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Coût WP / an</h4>
                                <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{result.ai.annual_cost_wp_eur.total?.toLocaleString('fr-FR')} €</div>
                                <ul className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 space-y-0.5">
                                    {result.ai.annual_cost_wp_eur.hosting !== undefined && <li>Hébergement : {result.ai.annual_cost_wp_eur.hosting} €</li>}
                                    {result.ai.annual_cost_wp_eur.maintenance !== undefined && <li>Maintenance : {result.ai.annual_cost_wp_eur.maintenance} €</li>}
                                    {result.ai.annual_cost_wp_eur.licenses !== undefined && <li>Licences : {result.ai.annual_cost_wp_eur.licenses} €</li>}
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Coût sur-mesure / an</h4>
                                <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{result.ai.annual_cost_custom_eur.total?.toLocaleString('fr-FR')} €</div>
                                <ul className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 space-y-0.5">
                                    {result.ai.annual_cost_custom_eur.hosting !== undefined && <li>Hébergement : {result.ai.annual_cost_custom_eur.hosting} €</li>}
                                    {result.ai.annual_cost_custom_eur.maintenance !== undefined && <li>Maintenance : {result.ai.annual_cost_custom_eur.maintenance} €</li>}
                                    {result.ai.annual_cost_custom_eur.licenses !== undefined && <li>Licences : {result.ai.annual_cost_custom_eur.licenses} €</li>}
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-fuchsia-300 dark:border-fuchsia-700 bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5"><TrendingUp size={11} /> Économie</h4>
                                <div className="text-3xl font-bold mt-1">{result.ai.savings_per_year_eur?.toLocaleString('fr-FR')} €</div>
                                <p className="text-[11px] opacity-85 mt-2">Économies par an pour le client</p>
                            </div>
                        </div>
                    )}

                    {/* Risks */}
                    {result.ai?.risks && result.ai.risks.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-5">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-amber-500" /> Risques identifiés</h3>
                            <ul className="space-y-2">
                                {result.ai.risks.map((r, i) => (
                                    <li key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severityClass(r.severity)}`}>{r.severity}</span>
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-white">{r.title}</h5>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{r.detail}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Opportunities */}
                    {result.ai?.opportunities && result.ai.opportunities.length > 0 && (
                        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-5">
                            <h3 className="font-bold text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2 mb-3"><Target size={14} /> Opportunités à pitcher</h3>
                            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                                {result.ai.opportunities.map((o, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-emerald-500" /> {o}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Sales pitch */}
                    {result.ai?.sales_pitch_markdown && (
                        <div className="rounded-2xl border border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-slate-900/60 p-5">
                            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><FileText size={14} className="text-fuchsia-500" /> Argumentaire de vente</h3>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={copyPitch}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                                    >
                                        {copiedPitch ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                        {copiedPitch ? 'Copié !' : 'Copier le pitch'}
                                    </button>
                                    <a
                                        href={`mailto:?subject=${encodeURIComponent('Refonte de votre site')}&body=${encodeURIComponent(result.ai.sales_pitch_markdown)}`}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-semibold"
                                    >
                                        <Mail size={11} /> Envoyer par email
                                    </a>
                                </div>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 leading-relaxed font-sans">
                                {result.ai.sales_pitch_markdown}
                            </pre>
                        </div>
                    )}

                    {/* Footer actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={downloadReport}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <Download size={12} /> Télécharger l'audit (JSON)
                        </button>
                        <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
