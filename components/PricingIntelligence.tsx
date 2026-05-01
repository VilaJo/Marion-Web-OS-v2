/**
 * PricingIntelligence — AI-powered pricing estimation for freelance web projects
 * Integrated in ClientView's finance tab or as a standalone component.
 */

import React, { useState, useCallback } from 'react';
import { DollarSign, Loader2, AlertCircle, TrendingUp, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../services/api';

interface PricingResult {
    range_low: number;
    range_high: number;
    recommended: number;
    currency: string;
    justification: string;
    comparable_projects: string[];
    tips: string[];
}

interface PricingIntelligenceProps {
    defaultCountry?: string;
    defaultIndustry?: string;
    onUsePrice?: (price: number) => void;
}

const PROJECT_TYPES = [
    'Site vitrine', 'Landing Page', 'Site e-commerce', 'Application web', 'Portfolio',
    'Blog', 'Refonte de site', 'Site multilingue', 'Dashboard', 'Autre',
];

const COMPLEXITY_OPTIONS = [
    { value: 'simple', label: 'Simple', desc: 'Template + peu de personnalisation' },
    { value: 'medium', label: 'Moyen', desc: 'Design sur mesure, quelques fonctionnalités' },
    { value: 'complex', label: 'Complexe', desc: 'Très personnalisé, nombreuses fonctionnalités' },
];

export const PricingIntelligence: React.FC<PricingIntelligenceProps> = ({
    defaultCountry = 'France',
    defaultIndustry = '',
    onUsePrice,
}) => {
    const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
    const [pages, setPages] = useState(5);
    const [industry, setIndustry] = useState(defaultIndustry);
    const [country, setCountry] = useState(defaultCountry);
    const [complexity, setComplexity] = useState<'simple' | 'medium' | 'complex'>('medium');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<PricingResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleEstimate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/v1/ai/pricing-intelligence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_type: projectType, pages, industry, country, complexity }),
            });
            if (!res.ok) throw new Error(`Erreur ${res.status}`);
            const data: PricingResult = await res.json();
            setResult(data);
        } catch (e: any) {
            setError(e.message || 'Estimation impossible');
        } finally {
            setIsLoading(false);
        }
    }, [projectType, pages, industry, country, complexity]);

    const fmt = (n: number, currency: string = 'EUR') =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            {/* Configuration form */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={15} className="text-emerald-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Paramètres du projet</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Type de projet</label>
                        <select value={projectType} onChange={(e) => setProjectType(e.target.value)}
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-emerald-400">
                            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nb de pages</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPages(p => Math.max(1, p - 1))} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <ChevronLeft size={14} />
                            </button>
                            <span className="flex-1 text-center text-sm font-bold text-slate-800 dark:text-slate-100">{pages}</span>
                            <button onClick={() => setPages(p => p + 1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Secteur client</label>
                        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ex: Restaurant, SaaS, E-commerce..."
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Pays</label>
                        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France"
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Complexité</label>
                    <div className="grid grid-cols-3 gap-2">
                        {COMPLEXITY_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => setComplexity(opt.value as any)}
                                className={`p-2.5 rounded-xl text-left transition-all ${
                                    complexity === opt.value
                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm'
                                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                                }`}>
                                <p className="text-xs font-bold">{opt.label}</p>
                                <p className={`text-[10px] mt-0.5 ${complexity === opt.value ? 'text-white/70' : 'text-slate-400'}`}>{opt.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <button onClick={handleEstimate} disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-105 transition-all disabled:opacity-60">
                    {isLoading ? <><Loader2 size={14} className="animate-spin" /> Estimation en cours…</> : <><TrendingUp size={14} /> Estimer le prix du marché</>}
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 flex items-start gap-2">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {result && (
                <div className="space-y-4">
                    {/* Price range visual */}
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4">
                        <div className="text-center mb-4">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Fourchette de marché</p>
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-sm text-slate-500">{fmt(result.range_low, result.currency)}</span>
                                <span className="text-slate-400">—</span>
                                <span className="text-sm text-slate-500">{fmt(result.range_high, result.currency)}</span>
                            </div>
                        </div>

                        <div className="relative h-10 mb-4">
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-gradient-to-r from-slate-200 via-emerald-200 to-slate-200 dark:from-slate-700 dark:via-emerald-700 dark:to-slate-700" />
                            {(() => {
                                const total = result.range_high - result.range_low;
                                const pos = total > 0 ? ((result.recommended - result.range_low) / total) * 100 : 50;
                                return (
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                                        style={{ left: `${pos}%` }}
                                    >
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 shadow-lg border-2 border-white dark:border-slate-900" />
                                        <div className="mt-1 px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-black whitespace-nowrap shadow-sm">
                                            Recommandé: {fmt(result.recommended, result.currency)}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {onUsePrice && (
                            <button onClick={() => onUsePrice(result.recommended)}
                                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                                <CheckCircle size={13} /> Utiliser ce tarif dans le devis
                            </button>
                        )}
                    </div>

                    {result.justification && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Justification</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{result.justification}</p>
                        </div>
                    )}

                    {result.comparable_projects?.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Projets comparables</p>
                            <ul className="space-y-1">
                                {result.comparable_projects.map((p, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                        <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" /> {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.tips?.length > 0 && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">Conseils pour maximiser ta valeur</p>
                            <ul className="space-y-1.5">
                                {result.tips.map((tip, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" /> {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {!result && !isLoading && !error && (
                <div className="text-center py-8 text-slate-400">
                    <DollarSign size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Configure les paramètres et lance l'estimation.</p>
                    <p className="text-xs mt-1">Gemini recherche les tarifs actuels du marché freelance.</p>
                </div>
            )}
        </div>
    );
};
