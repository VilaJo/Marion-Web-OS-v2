/**
 * StackPickerPage — Wizard "quelle stack pour ce projet ?"
 *
 * Marion répond à 3 questions et l'IA recommande :
 *  - une stack principale (la plus pragmatique)
 *  - une alternative
 *  - la commande de scaffold à coller en terminal
 *  - les libs additionnelles à installer
 *  - 3 raisons pédagogiques
 *  - 1 piège à éviter
 *
 * Historique des picks persiste en `marion_stack_picks` (localStorage).
 */

import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Sparkles, Loader2, Copy, Check, Rocket, AlertCircle,
    History, ExternalLink, Trash2, Wand2, Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CmsAnswer = 'none' | 'editable_by_client' | 'headless' | 'unsure';
type EcomAnswer = 'none' | 'few_products' | 'catalog' | 'subscriptions';
type MultiAnswer = 'no' | '2' | '3+';
type ComplexityAnswer = 'simple' | 'standard' | 'complex';

interface StackPick {
    name: string;
    framework: string;
    ui: string;
    cms: string;
    ecommerce: string;
    deploy: string;
    scaffold_command: string;
    extra_install: string;
    why: string[];
    pitfall: string;
}

interface PickerResult {
    primary: StackPick;
    alternative: StackPick;
    reasoning: string;
}

interface HistoryEntry {
    id: string;
    project_name: string;
    created_at: number;
    answers: { cms: CmsAnswer; ecommerce: EcomAnswer; multilingual: MultiAnswer; complexity: ComplexityAnswer };
    result: PickerResult;
}

const HISTORY_KEY = 'marion_stack_picks';

function loadHistory(): HistoryEntry[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30))); } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Question definitions
// ---------------------------------------------------------------------------

interface QOption<V extends string> {
    value: V;
    label: string;
    hint?: string;
    emoji: string;
}

const Q_CMS: QOption<CmsAnswer>[] = [
    { value: 'none', label: 'Pas de CMS', hint: 'Le contenu est en dur (ou en MDX)', emoji: '📄' },
    { value: 'editable_by_client', label: 'Le client doit éditer', hint: 'Sanity Studio / Storyblok / WordPress headless', emoji: '✍️' },
    { value: 'headless', label: 'Headless modeste', hint: 'Sanity / Contentful pour quelques pages', emoji: '🧩' },
    { value: 'unsure', label: 'Je ne sais pas', hint: "Je décide selon ton conseil", emoji: '🤔' },
];

const Q_ECOM: QOption<EcomAnswer>[] = [
    { value: 'none', label: 'Aucun e-commerce', emoji: '🚫' },
    { value: 'few_products', label: '1-50 produits', hint: 'Stripe Checkout suffit largement', emoji: '🛒' },
    { value: 'catalog', label: 'Catalog 50+ produits', hint: 'Shopify Storefront / Medusa', emoji: '🏪' },
    { value: 'subscriptions', label: 'Abonnements', hint: 'Stripe Subscriptions / Lemon Squeezy', emoji: '🔁' },
];

const Q_MULTI: QOption<MultiAnswer>[] = [
    { value: 'no', label: 'Une seule langue', emoji: '🇫🇷' },
    { value: '2', label: '2 langues', hint: 'next-intl ou Astro i18n', emoji: '🇪🇺' },
    { value: '3+', label: '3 langues ou plus', hint: 'CMS-driven recommandé', emoji: '🌍' },
];

const Q_COMPLEXITY: QOption<ComplexityAnswer>[] = [
    { value: 'simple', label: 'Simple', hint: 'Vitrine, portfolio, landing', emoji: '🌱' },
    { value: 'standard', label: 'Standard', hint: 'Site marketing avec blog + formulaires', emoji: '🌳' },
    { value: 'complex', label: 'Complexe', hint: 'Dashboard, auth, données dynamiques', emoji: '🏗️' },
];

// ---------------------------------------------------------------------------
// Question step component
// ---------------------------------------------------------------------------

function QStep<V extends string>({
    question, options, value, onChange,
}: {
    question: string;
    options: QOption<V>[];
    value: V | null;
    onChange: (v: V) => void;
}) {
    return (
        <div className="space-y-3">
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">{question}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {options.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                            value === opt.value
                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-slate-900'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">{opt.emoji}</span>
                            <div className="flex-1">
                                <div className="font-semibold text-sm text-slate-800 dark:text-white">{opt.label}</div>
                                {opt.hint && <div className="text-xs text-slate-500 mt-0.5">{opt.hint}</div>}
                            </div>
                            {value === opt.value && <Check size={16} className="text-emerald-500 flex-shrink-0" />}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Stack card
// ---------------------------------------------------------------------------

const StackCard: React.FC<{ pick: StackPick; primary?: boolean }> = ({ pick, primary = false }) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const copy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 1200);
        } catch { /* noop */ }
    };

    return (
        <div className={`rounded-2xl border p-5 ${primary ? 'border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60'}`}>
            <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${primary ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {primary ? '⭐ Recommandé' : 'Alternative'}
                </span>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{pick.name}</h3>
            </div>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 mb-3">
                <li><strong className="text-slate-500">Framework :</strong> {pick.framework}</li>
                <li><strong className="text-slate-500">UI :</strong> {pick.ui}</li>
                <li><strong className="text-slate-500">CMS :</strong> {pick.cms}</li>
                <li><strong className="text-slate-500">E-commerce :</strong> {pick.ecommerce}</li>
                <li><strong className="text-slate-500">Deploy :</strong> {pick.deploy}</li>
            </ul>

            <div className="space-y-2">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Scaffold</div>
                    <div className="relative">
                        <code className="block bg-slate-900 text-emerald-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto pr-10">{pick.scaffold_command}</code>
                        <button
                            onClick={() => copy(pick.scaffold_command, 'scaffold')}
                            className="absolute top-1 right-1 p-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                            aria-label="Copier scaffold"
                        >
                            {copiedField === 'scaffold' ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                    </div>
                </div>
                {pick.extra_install && (
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">À installer en plus</div>
                        <div className="relative">
                            <code className="block bg-slate-900 text-cyan-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto pr-10">{pick.extra_install}</code>
                            <button
                                onClick={() => copy(pick.extra_install, 'extra')}
                                className="absolute top-1 right-1 p-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                aria-label="Copier"
                            >
                                {copiedField === 'extra' ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {pick.why?.length > 0 && (
                <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Pourquoi</div>
                    <ul className="space-y-1">
                        {pick.why.map((w, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                                <Check size={12} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                                {w}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {pick.pitfall && (
                <div className="mt-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs">
                    <strong>⚠️ Piège :</strong> {pick.pitfall}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const StackPickerPage: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [projectName, setProjectName] = useState('');
    const [cms, setCms] = useState<CmsAnswer | null>(null);
    const [ecom, setEcom] = useState<EcomAnswer | null>(null);
    const [multi, setMulti] = useState<MultiAnswer | null>(null);
    const [complexity, setComplexity] = useState<ComplexityAnswer | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PickerResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

    const canSubmit = !!cms && !!ecom && !!multi && !!complexity;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiFetch('/api/v1/ai/stack-picker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cms, ecommerce: ecom, multilingual: multi, complexity,
                    project_name: projectName.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Suggestion impossible.');
                return;
            }
            setResult(data);
            setStep(5);
            const entry: HistoryEntry = {
                id: `pick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                project_name: projectName.trim() || 'Sans nom',
                created_at: Date.now(),
                answers: { cms: cms!, ecommerce: ecom!, multilingual: multi!, complexity: complexity! },
                result: data,
            };
            const next = [entry, ...history];
            setHistory(next);
            saveHistory(next);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep(1);
        setCms(null); setEcom(null); setMulti(null); setComplexity(null);
        setProjectName('');
        setResult(null);
        setError(null);
    };

    const removeFromHistory = (id: string) => {
        const next = history.filter(h => h.id !== id);
        setHistory(next);
        saveHistory(next);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="mb-6">
                <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                    <ArrowLeft size={13} /> Retour
                </button>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Wand2 className="text-emerald-500" /> Stack Picker
                </h1>
                <p className="text-sm text-slate-500 mt-1">3 questions, je te recommande la stack la plus pragmatique pour ton projet.</p>
            </div>

            {/* Stepper */}
            {step < 5 && (
                <div className="flex items-center gap-2 mb-6 overflow-x-auto">
                    {['Projet', 'CMS', 'E-commerce', 'Multilingue + complexité'].map((label, i) => (
                        <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                            step > i ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : step === i + 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                            <span className="w-5 h-5 rounded-full bg-white/30 dark:bg-slate-900/30 flex items-center justify-center text-[10px]">{i + 1}</span>
                            {label}
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 min-h-[300px]">
                        {step === 1 && (
                            <div className="space-y-3">
                                <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-white">Nom du projet (optionnel)</h3>
                                <input
                                    value={projectName}
                                    onChange={e => setProjectName(e.target.value)}
                                    placeholder="Site Café Louise"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-400"
                                />
                                <p className="text-xs text-slate-500">Sert juste à retrouver ce pick dans ton historique.</p>
                                <div className="flex justify-end pt-3">
                                    <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold">
                                        Suivant →
                                    </button>
                                </div>
                            </div>
                        )}
                        {step === 2 && (
                            <div className="space-y-4">
                                <QStep<CmsAnswer> question="Le client doit-il pouvoir modifier le contenu ?" options={Q_CMS} value={cms} onChange={setCms} />
                                <div className="flex justify-between pt-2">
                                    <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-slate-800">← Retour</button>
                                    <button onClick={() => setStep(3)} disabled={!cms} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold">Suivant →</button>
                                </div>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-4">
                                <QStep<EcomAnswer> question="Y a-t-il du e-commerce ?" options={Q_ECOM} value={ecom} onChange={setEcom} />
                                <div className="flex justify-between pt-2">
                                    <button onClick={() => setStep(2)} className="text-xs text-slate-500 hover:text-slate-800">← Retour</button>
                                    <button onClick={() => setStep(4)} disabled={!ecom} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold">Suivant →</button>
                                </div>
                            </div>
                        )}
                        {step === 4 && (
                            <div className="space-y-6">
                                <QStep<MultiAnswer> question="Multilingue ?" options={Q_MULTI} value={multi} onChange={setMulti} />
                                <QStep<ComplexityAnswer> question="Complexité estimée ?" options={Q_COMPLEXITY} value={complexity} onChange={setComplexity} />
                                {error && (
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                                        <AlertCircle size={14} /> {error}
                                    </div>
                                )}
                                <div className="flex justify-between pt-2">
                                    <button onClick={() => setStep(3)} className="text-xs text-slate-500 hover:text-slate-800">← Retour</button>
                                    <button onClick={handleSubmit} disabled={!canSubmit || loading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50 hover:brightness-105">
                                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        {loading ? 'Recherche…' : 'Recommande-moi une stack'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {step === 5 && result && (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Rocket className="text-emerald-500" size={20} />
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Voici ta stack</h2>
                                    </div>
                                    <button onClick={reset} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        Nouveau pick
                                    </button>
                                </div>
                                {result.reasoning && (
                                    <p className="text-sm italic text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                                        <Lightbulb size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                                        {result.reasoning}
                                    </p>
                                )}
                                <StackCard pick={result.primary} primary />
                                <StackCard pick={result.alternative} />
                            </div>
                        )}
                    </div>
                </div>

                <aside className="lg:col-span-1 space-y-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><History size={14} className="text-slate-400" /> Historique</h3>
                        {history.length === 0 ? (
                            <p className="text-xs text-slate-500 mt-2">Aucun pick pour l'instant.</p>
                        ) : (
                            <ul className="mt-2 space-y-2">
                                {history.slice(0, 8).map(h => (
                                    <li key={h.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{h.project_name}</div>
                                                <div className="text-[10px] text-slate-500 truncate">{h.result.primary.name}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{new Date(h.created_at).toLocaleDateString('fr-FR')}</div>
                                            </div>
                                            <button onClick={() => removeFromHistory(h.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500" aria-label="Supprimer">
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default StackPickerPage;
