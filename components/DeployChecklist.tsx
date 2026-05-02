/**
 * DeployChecklist — Pre-deploy verification for a preview URL
 *
 * Marion colle l'URL d'une preview Vercel/Netlify, l'app vérifie :
 *   - Meta title/description
 *   - Viewport mobile
 *   - Canonical
 *   - OG image / title (partage social)
 *   - Sitemap.xml accessible
 *   - Robots.txt accessible
 *   - Favicon
 *   - Lighthouse perf >= 80, a11y >= 90, SEO >= 90
 *
 * Affichage : liste de critères avec ✓/✗, score global, bouton "Re-tester".
 */

import React, { useState } from 'react';
import {
    Search, Loader2, CheckCircle2, XCircle, AlertCircle,
    Rocket, RefreshCw, ExternalLink, ListChecks,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeployCheck {
    id: string;
    label: string;
    passed: boolean;
    detail: string;
}

interface DeployResult {
    url: string;
    checked_at: number;
    checks: DeployCheck[];
    passed: number;
    total: number;
    ready_to_deploy: boolean;
}

interface Props {
    initialUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DeployChecklist: React.FC<Props> = ({ initialUrl = '' }) => {
    const [url, setUrl] = useState(initialUrl);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DeployResult | null>(null);

    const runCheck = async () => {
        if (!url.trim()) {
            setError('Entre l\'URL de la preview à vérifier.');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiFetch('/api/v1/audit/deploy-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Vérification impossible.');
                return;
            }
            setResult(data);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const ratio = result ? Math.round((result.passed / result.total) * 100) : 0;
    const ratioColor = !result
        ? 'bg-slate-200'
        : ratio >= 90 ? 'bg-emerald-500'
        : ratio >= 70 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
                        <Rocket size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Checklist pré-déploiement</h3>
                        <p className="text-[11px] text-white/80">Avant de pusher en prod, vérifie l'essentiel.</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-3">
                <form onSubmit={(e) => { e.preventDefault(); runCheck(); }} className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://mon-preview.vercel.app"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
                        {loading ? 'Vérif…' : (result ? 'Re-tester' : 'Vérifier')}
                    </button>
                </form>

                {loading && (
                    <p className="text-[11px] text-slate-500">PageSpeed peut prendre 20-30 s, patiente…</p>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                {result && (
                    <div className="space-y-3">
                        {/* Summary */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full transition-all ${ratioColor}`} style={{ width: `${ratio}%` }} />
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap">
                                {result.passed}/{result.total}
                            </span>
                        </div>

                        {result.ready_to_deploy ? (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                                <CheckCircle2 size={16} /> Prêt à déployer en production !
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-semibold">
                                <AlertCircle size={16} /> {result.total - result.passed} point{result.total - result.passed > 1 ? 's' : ''} à corriger avant la prod
                            </div>
                        )}

                        {/* Checklist */}
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            {result.checks.map(c => (
                                <li key={c.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900">
                                    {c.passed ? (
                                        <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                                    ) : (
                                        <XCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-semibold ${c.passed ? 'text-slate-800 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {c.label}
                                        </div>
                                        <div className={`text-[11px] mt-0.5 ${c.passed ? 'text-slate-500' : 'text-red-600 dark:text-red-400'}`}>
                                            {c.detail}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div className="flex gap-2">
                            <button
                                onClick={runCheck}
                                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <RefreshCw size={11} /> Re-tester
                            </button>
                            <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <ExternalLink size={11} /> Ouvrir la preview
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeployChecklist;
