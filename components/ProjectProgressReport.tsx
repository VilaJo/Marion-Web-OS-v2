/**
 * ProjectProgressReport — AI-powered internal progress report for Marion
 * Shows health status, highlights, next steps, and blockers.
 */

import React, { useState, useCallback } from 'react';
import {
    BarChart2, Loader2, AlertCircle, CheckCircle, Clock, AlertTriangle,
    ArrowRight, Copy, CheckCircle2, RefreshCw, TrendingUp, XCircle, FileDown,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { printElementAsPdf } from '../utils/pdfExport';
import type { Project } from '../types';

interface ProgressReportResult {
    summary: string;
    health: 'on_track' | 'at_risk' | 'delayed' | 'completed';
    percentage: number;
    completed_highlights: string[];
    next_steps: string[];
    blockers: string[];
    phase_assessment: string;
    financial_status: string;
}

interface ProjectProgressReportProps {
    project: Project;
}

const HEALTH_CONFIG = {
    on_track: { label: 'En bonne voie', icon: <CheckCircle size={14} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' },
    at_risk: { label: 'À surveiller', icon: <AlertTriangle size={14} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' },
    delayed: { label: 'En retard', icon: <XCircle size={14} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' },
    completed: { label: 'Terminé', icon: <CheckCircle2 size={14} />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700' },
};

export const ProjectProgressReport: React.FC<ProjectProgressReportProps> = ({ project }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ProgressReportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [pdfExporting, setPdfExporting] = useState(false);

    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/v1/ai/project-progress-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project: {
                        clientName: project.clientName,
                        phase: project.phase,
                        createdAt: project.createdAt,
                        tasks: project.tasks,
                        invoices: project.invoices,
                    },
                }),
            });
            if (!res.ok) throw new Error(`Erreur ${res.status}`);
            const data: ProgressReportResult = await res.json();
            setResult(data);
        } catch (e: any) {
            setError(e.message || 'Rapport impossible');
        } finally {
            setIsLoading(false);
        }
    }, [project]);

    const handleCopy = useCallback(() => {
        if (!result) return;
        const text = [
            `# Rapport d'avancement — ${project.clientName}`,
            `Santé : ${HEALTH_CONFIG[result.health]?.label || result.health}`,
            `Avancement : ${result.percentage}%`,
            '',
            result.summary,
            '',
            '## Points clés',
            result.completed_highlights.map(h => `✓ ${h}`).join('\n'),
            '',
            '## Prochaines étapes',
            result.next_steps.map(s => `→ ${s}`).join('\n'),
            '',
            result.blockers.length ? `## Points de vigilance\n${result.blockers.map(b => `⚠ ${b}`).join('\n')}` : '',
            '',
            `Phase : ${result.phase_assessment}`,
            `Finances : ${result.financial_status}`,
        ].filter(Boolean).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [result, project.clientName]);

    const handleExportPdf = useCallback(async () => {
        const el = document.getElementById('project-progress-report-print');
        if (!el) return;
        setPdfExporting(true);
        try {
            const safe = project.clientName.replace(/[^\w\-]+/g, '_').slice(0, 60);
            await printElementAsPdf(el, `rapport_${safe}.pdf`, { pageMarginMm: 10 });
        } finally {
            setPdfExporting(false);
        }
    }, [project.clientName]);

    const completedTasks = project.tasks.filter(t => t.completed).length;
    const totalTasks = project.tasks.length;

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            {/* Summary card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart2 size={15} className="text-indigo-500" />
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aperçu actuel</h3>
                    </div>
                    {result && (
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={handleExportPdf} disabled={pdfExporting} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50">
                                <FileDown size={12} /> PDF
                            </button>
                            <button type="button" onClick={handleCopy} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                {copied ? <><CheckCircle2 size={12} className="text-emerald-500" /> Copié !</> : <><Copy size={12} /> Copier</>}
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-center">
                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{completedTasks}</p>
                        <p className="text-[10px] text-slate-500">Tâches faites</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-center">
                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{totalTasks - completedTasks}</p>
                        <p className="text-[10px] text-slate-500">Restantes</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-center">
                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{project.invoices.filter(i => i.status === 'Paid').length}/{project.invoices.length}</p>
                        <p className="text-[10px] text-slate-500">Factures payées</p>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-105 transition-all disabled:opacity-60"
                >
                    {isLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Analyse en cours…</>
                        : result ? <><RefreshCw size={14} /> Régénérer le rapport</> : <><BarChart2 size={14} /> Générer le rapport IA</>
                    }
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 flex items-start gap-2">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {result && (
                <div id="project-progress-report-print" className="space-y-4 bg-white dark:bg-slate-900 p-2 rounded-xl print:p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider print:text-black">Rapport — {project.clientName}</p>
                    {/* Health + percentage */}
                    {(() => {
                        const h = HEALTH_CONFIG[result.health] || HEALTH_CONFIG.on_track;
                        return (
                            <div className={`rounded-xl border p-4 ${h.bg}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`flex items-center gap-2 font-bold text-sm ${h.color}`}>
                                        {h.icon} {h.label}
                                    </div>
                                    <span className="text-2xl font-black text-slate-700 dark:text-slate-300">{result.percentage}%</span>
                                </div>
                                <div className="w-full bg-white/60 dark:bg-slate-800/60 rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full bg-gradient-to-r transition-all duration-1000 ${
                                            result.health === 'on_track' || result.health === 'completed'
                                                ? 'from-emerald-400 to-teal-500'
                                                : result.health === 'at_risk'
                                                    ? 'from-amber-400 to-orange-500'
                                                    : 'from-red-400 to-rose-500'
                                        }`}
                                        style={{ width: `${result.percentage}%` }}
                                    />
                                </div>
                                <p className="text-xs mt-3 leading-relaxed text-slate-700 dark:text-slate-300">{result.summary}</p>
                            </div>
                        );
                    })()}

                    {result.completed_highlights.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={13} className="text-emerald-500" />
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Points clés réalisés</p>
                            </div>
                            <ul className="space-y-1">
                                {result.completed_highlights.map((h, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" /> {h}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.next_steps.length > 0 && (
                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowRight size={13} className="text-indigo-500" />
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Prochaines étapes prioritaires</p>
                            </div>
                            <ul className="space-y-1.5">
                                {result.next_steps.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-indigo-800 dark:text-indigo-200">
                                        <span className="font-black text-indigo-400 flex-shrink-0">{i + 1}.</span> {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.blockers.length > 0 && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={13} className="text-amber-500" />
                                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Points de vigilance</p>
                            </div>
                            <ul className="space-y-1">
                                {result.blockers.map((b, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" /> {b}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        {result.phase_assessment && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phase</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{result.phase_assessment}</p>
                            </div>
                        )}
                        {result.financial_status && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Finances</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{result.financial_status}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!result && !isLoading && !error && (
                <div className="text-center py-8 text-slate-400">
                    <BarChart2 size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Génère un rapport d'avancement IA pour ce projet.</p>
                    <p className="text-xs mt-1">Analyse des tâches, factures et de l'état actuel.</p>
                </div>
            )}
        </div>
    );
};
