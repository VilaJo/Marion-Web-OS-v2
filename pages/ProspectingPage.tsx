/**
 * ProspectingPage - International lead prospecting
 *
 * Uses Apollo.io as primary source (real contacts) and falls back
 * to Gemini AI suggestions when Apollo credits are exhausted.
 * Found prospects can be imported as PROSPECT clients in one click.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Telescope, Globe, Building2, Users, Briefcase,
    Mail, ExternalLink, Linkedin, Plus, CheckCircle, X,
    Loader2, ShieldCheck, AlertCircle, UserPlus,
    RefreshCw, Settings, ChevronDown, History, Tag, Check,
    WandSparkles, Download, Bookmark, BookmarkPlus, Trash2,
    ChevronUp, Target,
} from 'lucide-react';
import { Project, ProjectStatus, WorkflowPhase, ClientProfile } from '../types';
import { useSaveProject, useProjects } from '../services/queries';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Prospect {
    name: string;
    title: string;
    company: string;
    country: string;
    email: string;
    website: string;
    linkedin: string;
    source: 'apollo' | 'ai_generated';
    industry?: string;
    fit_score?: number;
}

interface SearchFilters {
    title: string;
    country: string;
    industry: string;
    employee_count: string;
    keyword: string;
    organization_name: string;
}

interface SearchResult {
    results: Prospect[];
    source: 'apollo' | 'ai_generated';
    credits_remaining: number | null;
    total_entries: number;
    page: number;
    apollo_warning?: 'credits_exhausted' | 'plan_required' | string | null;
}

interface SavedList {
    id: string;
    name: string;
    filters: SearchFilters;
    createdAt: string;
}

interface WebsiteAnalysis {
    what: string;
    need: string;
    angle: string;
}

type ApolloState = 'configured' | 'unconfigured' | 'exhausted';

const HISTORY_KEY = 'prospection_history';
const SAVED_LISTS_KEY = 'prospection_saved_lists';
const MAX_HISTORY = 5;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COUNTRIES = [
    { value: '', label: 'Tous les pays' },
    { value: 'France', label: '🇫🇷 France' },
    { value: 'Germany', label: '🇩🇪 Allemagne' },
    { value: 'United Kingdom', label: '🇬🇧 Royaume-Uni' },
    { value: 'United States', label: '🇺🇸 États-Unis' },
    { value: 'Canada', label: '🇨🇦 Canada' },
    { value: 'Spain', label: '🇪🇸 Espagne' },
    { value: 'Italy', label: '🇮🇹 Italie' },
    { value: 'Netherlands', label: '🇳🇱 Pays-Bas' },
    { value: 'Belgium', label: '🇧🇪 Belgique' },
    { value: 'Switzerland', label: '🇨🇭 Suisse' },
    { value: 'Australia', label: '🇦🇺 Australie' },
    { value: 'Singapore', label: '🇸🇬 Singapour' },
    { value: 'Japan', label: '🇯🇵 Japon' },
    { value: 'Brazil', label: '🇧🇷 Brésil' },
];

const INDUSTRIES = [
    { value: '', label: 'Tous les secteurs' },
    { value: 'SaaS', label: 'SaaS / Logiciel' },
    { value: 'E-commerce', label: 'E-commerce / Retail' },
    { value: 'Agence digitale', label: 'Agence digitale' },
    { value: 'Fintech', label: 'Fintech' },
    { value: 'Immobilier', label: 'Immobilier' },
    { value: 'Santé', label: 'Santé / MedTech' },
    { value: 'EdTech', label: 'EdTech / Formation' },
    { value: 'Industrie', label: 'Industrie / Manufacturing' },
    { value: 'Consulting', label: 'Consulting / Services' },
    { value: 'Startup', label: 'Startup / Tech' },
    { value: 'Luxe', label: 'Luxe / Mode' },
    { value: 'Restauration', label: 'Restauration / Hôtellerie' },
];

const EMPLOYEE_RANGES = [
    { value: '', label: 'Toute taille' },
    { value: '1,10', label: '1 – 10 employés' },
    { value: '11,50', label: '11 – 50 employés' },
    { value: '51,200', label: '51 – 200 employés' },
    { value: '201+', label: '200+ employés' },
];

const EMPTY_FILTERS: SearchFilters = {
    title: '', country: '', industry: '', employee_count: '', keyword: '', organization_name: '',
};

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------
function loadHistory(): SearchFilters[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
}

function saveHistory(filters: SearchFilters) {
    const prev = loadHistory();
    const without = prev.filter((h) => JSON.stringify(h) !== JSON.stringify(filters));
    localStorage.setItem(HISTORY_KEY, JSON.stringify([filters, ...without].slice(0, MAX_HISTORY)));
}

function filtersLabel(f: SearchFilters): string {
    const parts = [f.title, f.keyword, f.organization_name, f.country, f.industry].filter(Boolean);
    return parts.join(' · ') || 'Recherche sans filtre';
}

// ---------------------------------------------------------------------------
// Saved lists helpers (F4)
// ---------------------------------------------------------------------------
function loadSavedLists(): SavedList[] {
    try { return JSON.parse(localStorage.getItem(SAVED_LISTS_KEY) || '[]'); }
    catch { return []; }
}

function persistSavedLists(lists: SavedList[]) {
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists));
}

// ---------------------------------------------------------------------------
// Fit score badge (F3)
// ---------------------------------------------------------------------------
const FitScoreBadge: React.FC<{ score: number }> = ({ score }) => {
    if (score < 40) return null;
    const isGood = score >= 70;
    return (
        <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10 ${
            isGood
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
        }`}>
            <Target size={8} />
            {isGood ? 'Bon fit' : 'Potentiel'}
        </span>
    );
};

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------
const SourceBadge: React.FC<{
    source: 'apollo' | 'ai_generated';
    apolloState: ApolloState;
    credits: number | null;
}> = ({ source, apolloState, credits }) => {
    if (source === 'apollo') {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <ShieldCheck size={13} />
                Contacts vérifiés Apollo.io
                {credits !== null && (
                    <span className="ml-1 text-emerald-500 dark:text-emerald-400 font-normal">· {credits} crédits restants</span>
                )}
            </div>
        );
    }
    if (apolloState === 'unconfigured') {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                <Search size={13} />
                Recherche Google via IA
                <span className="ml-1 font-normal">· Données issues du web</span>
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <Search size={13} />
            Recherche Google via IA
            <span className="ml-1 font-normal">· Données issues du web</span>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Generated email modal (F1)
// ---------------------------------------------------------------------------
const GeneratedEmailModal: React.FC<{
    prospect: Prospect;
    onClose: () => void;
}> = ({ prospect, onClose }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        apiFetch('/api/v1/prospection/generate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: prospect.name,
                title: prospect.title,
                company: prospect.company,
                country: prospect.country,
                website: prospect.website,
                industry: prospect.industry,
            }),
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.error) throw new Error(d.error);
                setSubject(d.subject || '');
                setBody(d.body || '');
            })
            .catch((e) => setError(e.message || 'Erreur inconnue'))
            .finally(() => setIsLoading(false));
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-eonora-gradient flex items-center justify-center">
                            <WandSparkles size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Email de prospection IA</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Pour {prospect.name} · {prospect.company}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={16} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <Loader2 size={28} className="animate-spin text-indigo-500" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Rédaction de l'email en cours…</p>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 text-xs text-red-700 dark:text-red-300">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {error}
                        </div>
                    )}
                    {!isLoading && !error && (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Objet</label>
                                <input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Corps du message</label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={10}
                                    className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono"
                                />
                            </div>
                        </>
                    )}
                </div>

                {!isLoading && !error && (
                    <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                            {copied ? <><CheckCircle size={14} className="text-emerald-500" /> Copié !</> : <><Download size={14} /> Copier</>}
                        </button>
                        {prospect.email && (
                            <button
                                onClick={() => {
                                    navigate(`/emails?compose=true&to=${encodeURIComponent(prospect.email)}&subject=${encodeURIComponent(subject)}`);
                                    onClose();
                                }}
                                className="flex-1 py-2.5 rounded-lg bg-eonora-gradient text-white text-sm font-semibold hover:brightness-105 transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <Mail size={14} /> Ouvrir dans Emails
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Prospect card
// ---------------------------------------------------------------------------
interface ProspectCardProps {
    prospect: Prospect;
    alreadyImported: boolean;
    existingProjectId?: string;
    isSelected: boolean;
    onImport: (p: Prospect) => void;
    onToggleSelect: (key: string) => void;
    onGenerateEmail: (p: Prospect) => void;
    prospectKey: string;
    analysisCache: Map<string, WebsiteAnalysis | 'error'>;
    onAnalyzeWebsite: (p: Prospect) => void;
    isAnalyzing: string | null;
}

const ProspectCard: React.FC<ProspectCardProps> = ({
    prospect, alreadyImported, existingProjectId, isSelected,
    onImport, onToggleSelect, onGenerateEmail, prospectKey,
    analysisCache, onAnalyzeWebsite, isAnalyzing,
}) => {
    const navigate = useNavigate();
    const initials = (prospect.name || prospect.company || '??').slice(0, 2).toUpperCase();
    const colors = ['from-indigo-400 to-blue-500', 'from-emerald-400 to-teal-500', 'from-violet-400 to-purple-500', 'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500'];
    const colorClass = colors[(prospect.name || '').length % colors.length];
    const [analysisOpen, setAnalysisOpen] = useState(false);

    const websiteKey = prospect.website || '';
    const cachedValue = analysisCache.get(websiteKey);
    const analysis = cachedValue && cachedValue !== 'error' ? (cachedValue as WebsiteAnalysis) : null;
    const analysisFailed = cachedValue === 'error';
    const isThisAnalyzing = isAnalyzing === websiteKey;

    const handleAnalyzeClick = () => {
        if (cachedValue) {
            setAnalysisOpen((o) => !o);
            return;
        }
        setAnalysisOpen(true);
        onAnalyzeWebsite(prospect);
    };

    return (
        <div className={`rounded-xl border bg-white dark:bg-slate-900 flex flex-col transition-all group relative overflow-hidden ${
            isSelected
                ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700'
                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
        }`}>
            <div className="p-4 flex flex-col gap-3">
                {/* Fit score badge (F3) */}
                {(prospect.fit_score ?? 0) >= 40 && (
                    <FitScoreBadge score={prospect.fit_score!} />
                )}

                {/* Selection checkbox */}
                <button
                    onClick={() => onToggleSelect(prospectKey)}
                    className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        isSelected
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-white dark:bg-slate-900'
                    }`}
                >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                </button>

                <div className="flex items-start gap-3 pr-6 pt-1">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorClass} text-white font-bold flex items-center justify-center text-sm flex-shrink-0`}>
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{prospect.name || '—'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{prospect.title || '—'}</p>
                    </div>
                </div>

                {prospect.source === 'ai_generated' && (
                    <span className="self-start text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-semibold">Suggestion IA</span>
                )}

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {prospect.company && (
                        <div className="flex items-center gap-2">
                            <Building2 size={12} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate">{prospect.company}</span>
                        </div>
                    )}
                    {prospect.country && (
                        <div className="flex items-center gap-2">
                            <Globe size={12} className="text-slate-400 flex-shrink-0" />
                            <span>{prospect.country}</span>
                        </div>
                    )}
                    {prospect.email && (
                        <div className="flex items-center gap-2">
                            <Mail size={12} className="text-slate-400 flex-shrink-0" />
                            <a href={`mailto:${prospect.email}`} className="truncate text-indigo-500 hover:underline">{prospect.email}</a>
                        </div>
                    )}
                    {prospect.website && (
                        <div className="flex items-center gap-2">
                            <ExternalLink size={12} className="text-slate-400 flex-shrink-0" />
                            <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="truncate text-indigo-500 hover:underline">
                                {prospect.website.replace(/^https?:\/\//, '')}
                            </a>
                        </div>
                    )}
                    {prospect.linkedin && (
                        <div className="flex items-center gap-2">
                            <Linkedin size={12} className="text-slate-400 flex-shrink-0" />
                            <a href={prospect.linkedin} target="_blank" rel="noopener noreferrer" className="truncate text-indigo-500 hover:underline">Profil LinkedIn</a>
                        </div>
                    )}
                </div>

                <div className="mt-auto flex gap-1.5">
                    {existingProjectId ? (
                        <button
                            onClick={() => navigate(`/clients/${existingProjectId}`)}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
                        >
                            <CheckCircle size={13} /> Déjà dans ton Kanban
                        </button>
                    ) : (
                        <button
                            onClick={() => onImport(prospect)}
                            disabled={alreadyImported}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                alreadyImported
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 cursor-default'
                                    : 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700'
                            }`}
                        >
                            {alreadyImported ? <><CheckCircle size={13} /> Importé</> : <><UserPlus size={13} /> Importer</>}
                        </button>
                    )}

                    {/* F1 — AI email generation button */}
                    <button
                        onClick={() => onGenerateEmail(prospect)}
                        title="Générer un email de prospection IA"
                        className="py-2 px-2.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-600 transition-all"
                    >
                        <WandSparkles size={13} />
                    </button>

                    {/* Quick email button */}
                    {prospect.email && (
                        <button
                            onClick={() => navigate(`/emails?compose=true&to=${encodeURIComponent(prospect.email)}`)}
                            title="Envoyer un email"
                            className="py-2 px-2.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
                        >
                            <Mail size={13} />
                        </button>
                    )}

                    {/* F2 — Analyze website button */}
                    {prospect.website && (
                        <button
                            onClick={handleAnalyzeClick}
                            title={analysisOpen ? 'Masquer l\'analyse' : 'Analyser le site web'}
                            className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                                analysisOpen
                                    ? 'border-teal-300 dark:border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-500 hover:border-teal-300 dark:hover:border-teal-600'
                            }`}
                        >
                            {isThisAnalyzing ? <Loader2 size={13} className="animate-spin" /> : analysisOpen ? <ChevronUp size={13} /> : <Globe size={13} />}
                        </button>
                    )}
                </div>
            </div>

            {/* F2 — Website analysis expandable panel */}
            {analysisOpen && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-teal-50/60 dark:bg-teal-900/10 p-3 space-y-2">
                    {isThisAnalyzing && (
                        <div className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
                            <Loader2 size={12} className="animate-spin" /> Analyse du site en cours…
                        </div>
                    )}
                    {!isThisAnalyzing && analysisFailed && (
                        <p className="text-xs text-red-500 dark:text-red-400">Impossible d'analyser ce site.</p>
                    )}
                    {!isThisAnalyzing && analysis && (
                        <>
                            <div className="text-xs">
                                <p className="font-semibold text-teal-700 dark:text-teal-300 mb-0.5">Ce qu'ils font</p>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{analysis.what}</p>
                            </div>
                            <div className="text-xs">
                                <p className="font-semibold text-teal-700 dark:text-teal-300 mb-0.5">Besoin potentiel</p>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{analysis.need}</p>
                            </div>
                            <div className="text-xs">
                                <p className="font-semibold text-teal-700 dark:text-teal-300 mb-0.5">Angle d'approche</p>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{analysis.angle}</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Import modal
// ---------------------------------------------------------------------------
const ImportProspectModal: React.FC<{
    prospect: Prospect;
    source: 'apollo' | 'ai_generated';
    onConfirm: (overrides: { name: string; email: string; website: string; company: string; notes: string }) => void;
    onClose: () => void;
    isLoading: boolean;
}> = ({ prospect, source, onConfirm, onClose, isLoading }) => {
    const [name, setName] = useState(prospect.name || prospect.company || '');
    const [email, setEmail] = useState(prospect.email || '');
    const [website, setWebsite] = useState(prospect.website || '');
    const [company, setCompany] = useState(prospect.company || '');
    const [notes, setNotes] = useState('');

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Importer comme prospect</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Sera ajouté dans ton Kanban avec le statut <strong>Prospect</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={16} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    {source === 'ai_generated' && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-xs text-amber-700 dark:text-amber-300">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                            Ce profil est une suggestion IA. Vérifie les informations avant de contacter.
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nom du contact</label>
                        <input value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Entreprise</label>
                        <input value={company} onChange={(e) => setCompany(e.target.value)}
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email</label>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Site web</label>
                        <input value={website} onChange={(e) => setWebsite(e.target.value)}
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes / contexte</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                            placeholder="Ex: Rencontré à un événement, intéressé par notre offre X…"
                            className="w-full rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        Annuler
                    </button>
                    <button onClick={() => onConfirm({ name, email, website, company, notes })}
                        disabled={!name.trim() || isLoading}
                        className="flex-1 py-2.5 rounded-lg bg-eonora-gradient text-white text-sm font-semibold hover:brightness-105 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? <><Loader2 size={14} className="animate-spin" /> Import…</> : <><Plus size={14} /> Confirmer l'import</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const ProspectingPage: React.FC = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
    const [allResults, setAllResults] = useState<Prospect[]>([]);
    const [searchMeta, setSearchMeta] = useState<Omit<SearchResult, 'results'> | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
    const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [isBulkImporting, setIsBulkImporting] = useState(false);
    const [apolloConfigured, setApolloConfigured] = useState<boolean | null>(null);
    const [apolloWarning, setApolloWarning] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [searchHistory, setSearchHistory] = useState<SearchFilters[]>([]);
    const historyRef = useRef<HTMLDivElement>(null);

    // F1 — AI email modal
    const [emailModalProspect, setEmailModalProspect] = useState<Prospect | null>(null);

    // F2 — Website analysis cache
    const [analysisCache, setAnalysisCache] = useState<Map<string, WebsiteAnalysis | 'error'>>(new Map());
    const [analyzingWebsite, setAnalyzingWebsite] = useState<string | null>(null);

    // F3 — Sort by score
    const [sortByScore, setSortByScore] = useState(false);

    // F4 — Saved lists
    const [savedLists, setSavedLists] = useState<SavedList[]>(loadSavedLists);
    const [listsOpen, setListsOpen] = useState(false);
    const listsRef = useRef<HTMLDivElement>(null);

    const saveProject = useSaveProject();
    const projectsQuery = useProjects();

    const apolloState: ApolloState = useMemo(() => {
        if (apolloConfigured === false) return 'unconfigured';
        if (searchMeta?.source === 'ai_generated' && apolloConfigured === true) return 'exhausted';
        return apolloConfigured ? 'configured' : 'unconfigured';
    }, [apolloConfigured, searchMeta]);

    const existingClientsMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of projectsQuery.data || []) {
            if (p.profile?.email) map.set(p.profile.email.toLowerCase(), p.id);
            map.set(p.clientName.toLowerCase(), p.id);
        }
        return map;
    }, [projectsQuery.data]);

    const prospectKey = (p: Prospect) => `${p.name}|${p.company}|${p.email}`;

    const getExistingProjectId = (p: Prospect): string | undefined => {
        if (p.email) {
            const byEmail = existingClientsMap.get(p.email.toLowerCase());
            if (byEmail) return byEmail;
        }
        return existingClientsMap.get((p.name || p.company || '').toLowerCase());
    };

    // F3 — sorted results
    const displayedResults = useMemo(() => {
        if (!sortByScore) return allResults;
        return [...allResults].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
    }, [allResults, sortByScore]);

    useEffect(() => {
        apiFetch('/api/v1/prospection/status')
            .then((r) => r.json())
            .then((d) => setApolloConfigured(d.apollo_configured))
            .catch(() => setApolloConfigured(false));
        setSearchHistory(loadHistory());
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false);
            if (listsRef.current && !listsRef.current.contains(e.target as Node)) setListsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const runSearch = useCallback(async (f: SearchFilters, page: number, append = false) => {
        if (page === 1) {
            setIsSearching(true);
            setSearchError(null);
            if (!append) { setAllResults([]); setCurrentPage(1); setSelectedKeys(new Set()); }
        } else {
            setIsLoadingMore(true);
        }
        try {
            const res = await apiFetch('/api/v1/prospection/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...f, page }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Erreur ${res.status}`);
            }
            const data: SearchResult = await res.json();
            setAllResults((prev) => append ? [...prev, ...data.results] : data.results);
            setSearchMeta({ source: data.source, credits_remaining: data.credits_remaining, total_entries: data.total_entries, page: data.page });
            setApolloWarning(data.apollo_warning || null);
            setCurrentPage(page);
            if (page === 1) saveHistory(f);
            setSearchHistory(loadHistory());
        } catch (err: any) {
            setSearchError(err.message || 'Erreur inconnue');
        } finally {
            setIsSearching(false);
            setIsLoadingMore(false);
        }
    }, []);

    const handleSearch = useCallback(() => runSearch(filters, 1, false), [filters, runSearch]);
    const handleLoadMore = useCallback(() => runSearch(filters, currentPage + 1, true), [filters, currentPage, runSearch]);

    // F2 — Analyze website
    const handleAnalyzeWebsite = useCallback(async (prospect: Prospect) => {
        const key = prospect.website;
        if (!key || analysisCache.has(key)) return;
        setAnalyzingWebsite(key);
        try {
            const res = await apiFetch('/api/v1/prospection/analyze-website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ website: prospect.website, company: prospect.company, industry: prospect.industry }),
            });
            const data = await res.json();
            if (data.what) {
                setAnalysisCache((prev) => new Map(prev).set(key, data as WebsiteAnalysis));
            } else {
                setAnalysisCache((prev) => new Map(prev).set(key, 'error'));
            }
        } catch {
            setAnalysisCache((prev) => new Map(prev).set(key, 'error'));
        } finally {
            setAnalyzingWebsite(null);
        }
    }, [analysisCache]);

    // F4 — Save current search as named list
    const handleSaveList = useCallback(() => {
        const name = window.prompt('Nom de cette liste de recherche :');
        if (!name?.trim()) return;
        const newList: SavedList = {
            id: Date.now().toString(),
            name: name.trim(),
            filters,
            createdAt: new Date().toISOString(),
        };
        setSavedLists((prev) => {
            const updated = [newList, ...prev];
            persistSavedLists(updated);
            return updated;
        });
    }, [filters]);

    const handleDeleteList = useCallback((id: string) => {
        setSavedLists((prev) => {
            const updated = prev.filter((l) => l.id !== id);
            persistSavedLists(updated);
            return updated;
        });
    }, []);

    // F5 — Export CSV
    const handleExportCsv = useCallback(() => {
        const header = ['Nom', 'Titre', 'Entreprise', 'Pays', 'Email', 'Site web', 'LinkedIn', 'Source', 'Score'];
        const rows = allResults.map((p) => [
            p.name, p.title, p.company, p.country, p.email, p.website, p.linkedin,
            p.source === 'apollo' ? 'Apollo.io' : 'IA / Google',
            String(p.fit_score ?? ''),
        ].map((v) => `"${(v || '').replace(/"/g, '""')}"`));
        const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [allResults]);

    const buildProject = (
        prospect: Prospect,
        overrides: { name: string; email: string; website: string; company: string; notes: string }
    ): Project => {
        const displayName = overrides.company.trim() || overrides.name.trim() || 'Prospect';
        const safeName = displayName.replace(/[/\\:*?"<>|]/g, '').trim() || 'Prospect';
        const projectId = `4. Prospects/${safeName}`;
        const customFields: { key: string; value: string }[] = [
            { key: 'Source', value: searchMeta?.source === 'apollo' ? 'Apollo.io' : 'Recherche Google / IA' },
            { key: 'Titre', value: prospect.title || '' },
            { key: 'Entreprise', value: overrides.company || '' },
            { key: 'Pays', value: prospect.country || '' },
            ...(prospect.linkedin ? [{ key: 'LinkedIn', value: prospect.linkedin }] : []),
            ...(overrides.notes ? [{ key: 'Notes prospection', value: overrides.notes }] : []),
            ...(prospect.fit_score !== undefined ? [{ key: 'Score pertinence', value: String(prospect.fit_score) }] : []),
        ];
        const profile: ClientProfile = {
            email: overrides.email || '',
            phone: '',
            website: overrides.website || '',
            address: '',
            customFields,
        };
        return {
            id: projectId,
            clientName: displayName,
            avatarInitials: displayName.slice(0, 2).toUpperCase(),
            status: ProjectStatus.PROSPECT,
            phase: WorkflowPhase.DISCOVERY,
            tasks: [],
            invoices: [],
            profile,
            progress: 0,
            createdAt: new Date().toISOString(),
            links: {},
        };
    };

    const handleConfirmImport = useCallback(
        (overrides: { name: string; email: string; website: string; company: string; notes: string }) => {
            if (!selectedProspect) return;
            const project = buildProject(selectedProspect, overrides);
            saveProject.mutate({ project }, {
                onSuccess: () => {
                    setImportedKeys((prev) => new Set([...prev, prospectKey(selectedProspect)]));
                    setImportSuccess(project.clientName);
                    setSelectedProspect(null);
                    setTimeout(() => setImportSuccess(null), 4000);
                },
                onError: (err: any) => {
                    setImportError(err?.message || "Impossible de sauvegarder le prospect. Vérifie que Flask est démarré.");
                    setTimeout(() => setImportError(null), 6000);
                },
            });
        },
        [selectedProspect, searchMeta, saveProject]
    );

    const handleBulkImport = useCallback(async () => {
        const toImport = allResults.filter((p) => selectedKeys.has(prospectKey(p)));
        if (!toImport.length) return;
        setIsBulkImporting(true);
        let count = 0;
        let errors = 0;
        for (const prospect of toImport) {
            const project = buildProject(prospect, {
                name: prospect.name || '',
                email: prospect.email || '',
                website: prospect.website || '',
                company: prospect.company || prospect.name || 'Prospect',
                notes: '',
            });
            try {
                await saveProject.mutateAsync({ project });
                setImportedKeys((prev) => new Set([...prev, prospectKey(prospect)]));
                count++;
            } catch { errors++; }
        }
        setSelectedKeys(new Set());
        setIsBulkImporting(false);
        if (count > 0) { setImportSuccess(`${count} prospect(s) importé(s) dans le Kanban.`); setTimeout(() => setImportSuccess(null), 4000); }
        if (errors > 0) { setImportError(`${errors} import(s) ont échoué. Vérifie que Flask est bien démarré.`); setTimeout(() => setImportError(null), 6000); }
    }, [allResults, selectedKeys, searchMeta, saveProject]);

    const toggleSelect = useCallback((key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    const hasFilters = Object.values(filters).some(Boolean);
    const hasMore = searchMeta && allResults.length < searchMeta.total_entries && searchMeta.source === 'apollo';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-eonora-gradient flex items-center justify-center shadow-sm">
                            <Telescope size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Prospection Internationale</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Recherche de prospects B2B via Apollo.io · Fallback IA</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {importedKeys.size > 0 && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                                <CheckCircle size={14} /> {importedKeys.size} prospect(s) importé(s)
                            </div>
                        )}
                        {apolloConfigured === false && (
                            <button
                                onClick={() => navigate('/settings')}
                                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
                            >
                                <Settings size={13} /> Configurer Apollo
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
                {/* Search panel */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-4 flex items-center gap-2">
                        <Search size={13} /> Critères de recherche
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Briefcase size={12} /> Poste / titre
                            </label>
                            <input
                                value={filters.title}
                                onChange={(e) => setFilters((f) => ({ ...f, title: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="ex. CEO, CMO, Founder…"
                                className="w-full rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Tag size={12} /> Mot-clé
                            </label>
                            <input
                                value={filters.keyword}
                                onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="ex. Shopify, fintech, CRM…"
                                className="w-full rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Building2 size={12} /> Entreprise
                            </label>
                            <input
                                value={filters.organization_name}
                                onChange={(e) => setFilters((f) => ({ ...f, organization_name: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="ex. Stripe, LVMH…"
                                className="w-full rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Globe size={12} /> Pays
                            </label>
                            <select
                                value={filters.country}
                                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
                                className="w-full rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Building2 size={12} /> Secteur
                            </label>
                            <select
                                value={filters.industry}
                                onChange={(e) => setFilters((f) => ({ ...f, industry: e.target.value }))}
                                className="w-full rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Users size={12} /> Taille
                            </label>
                            <select
                                value={filters.employee_count}
                                onChange={(e) => setFilters((f) => ({ ...f, employee_count: e.target.value }))}
                                className="w-full rounded-lg px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                {EMPLOYEE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* History dropdown */}
                            <div className="relative" ref={historyRef}>
                                <button
                                    onClick={() => setHistoryOpen((o) => !o)}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <History size={13} /> Récentes <ChevronDown size={11} />
                                </button>
                                {historyOpen && searchHistory.length > 0 && (
                                    <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 overflow-hidden">
                                        {searchHistory.map((h, i) => (
                                            <button key={i}
                                                onClick={() => { setFilters(h); setHistoryOpen(false); runSearch(h, 1, false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 truncate">
                                                {filtersLabel(h)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {historyOpen && searchHistory.length === 0 && (
                                    <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg px-3 py-2 text-xs text-slate-400">
                                        Aucune recherche récente
                                    </div>
                                )}
                            </div>

                            {/* F4 — Saved lists dropdown */}
                            <div className="relative" ref={listsRef}>
                                <button
                                    onClick={() => setListsOpen((o) => !o)}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <Bookmark size={13} /> Mes listes
                                    {savedLists.length > 0 && (
                                        <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full px-1.5 text-[10px] font-bold">{savedLists.length}</span>
                                    )}
                                    <ChevronDown size={11} />
                                </button>
                                {listsOpen && (
                                    <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 overflow-hidden">
                                        {savedLists.length === 0 && (
                                            <p className="px-3 py-2 text-xs text-slate-400">Aucune liste sauvegardée</p>
                                        )}
                                        {savedLists.map((list) => (
                                            <div key={list.id} className="flex items-center gap-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <button
                                                    onClick={() => { setFilters(list.filters); setListsOpen(false); runSearch(list.filters, 1, false); }}
                                                    className="flex-1 text-left text-xs text-slate-700 dark:text-slate-300 truncate px-1 py-2"
                                                >
                                                    {list.name}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteList(list.id)}
                                                    className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                                            <button
                                                onClick={() => { handleSaveList(); setListsOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-1.5"
                                            >
                                                <BookmarkPlus size={12} /> Sauvegarder la recherche actuelle
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {hasFilters && (
                                <button
                                    onClick={() => setFilters(EMPTY_FILTERS)}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X size={12} /> Effacer
                                </button>
                            )}
                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-eonora-gradient text-white rounded-xl text-sm font-semibold shadow-sm hover:brightness-105 transition-all disabled:opacity-60"
                            >
                                {isSearching ? <><Loader2 size={15} className="animate-spin" /> Recherche…</> : <><Search size={15} /> Rechercher</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toasts */}
                {searchError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 flex items-start gap-3">
                        <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erreur de recherche</p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{searchError}</p>
                        </div>
                    </div>
                )}
                {importSuccess && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                        <CheckCircle size={16} />
                        <span><strong>{importSuccess}</strong> ajouté(s) dans ton Kanban.</span>
                    </div>
                )}
                {importError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                        <AlertCircle size={16} />
                        <span>{importError}</span>
                    </div>
                )}

                {/* Apollo warnings */}
                {apolloWarning === 'plan_required' && (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-4 flex items-start gap-3">
                        <Search size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Recherche via Gemini + Google</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Apollo.io nécessite un plan payant pour la recherche de contacts. Les résultats ci-dessous proviennent d'une <strong>vraie recherche Google effectuée par Gemini</strong> — entreprises et profils réels trouvés sur le web. Vérifie les informations avant de contacter.
                                <a href="https://app.apollo.io/#/settings/plans/upgrade" target="_blank" rel="noopener noreferrer" className="ml-2 underline hover:text-blue-800">Voir les plans Apollo →</a>
                            </p>
                        </div>
                    </div>
                )}
                {apolloWarning === 'credits_exhausted' && (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 flex items-center gap-3 text-xs text-blue-700 dark:text-blue-300">
                        <Search size={15} className="flex-shrink-0" />
                        Crédits Apollo épuisés — recherche effectuée via Gemini + Google Search. Les crédits Apollo se rechargent chaque mois.
                    </div>
                )}

                {/* Results */}
                {allResults.length > 0 && searchMeta && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {allResults.length}
                                    {searchMeta.total_entries > allResults.length && (
                                        <span className="text-slate-400 font-normal"> sur {searchMeta.total_entries}</span>
                                    )} résultat(s)
                                </p>
                                <SourceBadge source={searchMeta.source} apolloState={apolloState} credits={searchMeta.credits_remaining} />
                            </div>
                            <div className="flex items-center gap-2">
                                {/* F3 — Sort by relevance toggle */}
                                <button
                                    onClick={() => setSortByScore((s) => !s)}
                                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                                        sortByScore
                                            ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500 hover:border-indigo-200'
                                    }`}
                                >
                                    <Target size={12} /> {sortByScore ? 'Tri : pertinence' : 'Trier par pertinence'}
                                </button>
                                {/* F5 — Export CSV */}
                                <button
                                    onClick={handleExportCsv}
                                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all"
                                >
                                    <Download size={12} /> Exporter CSV
                                </button>
                                <button
                                    onClick={handleSearch}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-500 transition-colors"
                                >
                                    <RefreshCw size={12} /> Actualiser
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {displayedResults.map((prospect, idx) => {
                                const pk = prospectKey(prospect);
                                return (
                                    <ProspectCard
                                        key={`${pk}-${idx}`}
                                        prospect={prospect}
                                        alreadyImported={importedKeys.has(pk)}
                                        existingProjectId={getExistingProjectId(prospect)}
                                        isSelected={selectedKeys.has(pk)}
                                        onImport={setSelectedProspect}
                                        onToggleSelect={toggleSelect}
                                        onGenerateEmail={setEmailModalProspect}
                                        prospectKey={pk}
                                        analysisCache={analysisCache}
                                        onAnalyzeWebsite={handleAnalyzeWebsite}
                                        isAnalyzing={analyzingWebsite}
                                    />
                                );
                            })}
                        </div>

                        {hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-60"
                                >
                                    {isLoadingMore ? <><Loader2 size={14} className="animate-spin" /> Chargement…</> : <>Charger plus de résultats</>}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {allResults.length === 0 && !isSearching && !searchError && (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-14 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4a72c4]/15 to-[#2aada0]/15 dark:from-[#4a72c4]/25 dark:to-[#2aada0]/25 flex items-center justify-center mx-auto mb-4">
                            <Telescope size={28} className="text-eo-blue" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">Trouve tes prochains clients</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            Recherche des prospects B2B dans plus de 210 millions de contacts via Apollo.io.
                            Remplis les filtres ci-dessus et clique sur <strong>Rechercher</strong>.
                        </p>
                        {hasFilters && (
                            <button
                                onClick={handleSearch}
                                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-eonora-gradient text-white rounded-xl text-sm font-semibold shadow-sm hover:brightness-105 transition-all"
                            >
                                <Search size={15} /> Lancer la recherche
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Bulk import floating bar */}
            {selectedKeys.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl shadow-2xl px-5 py-3 border border-slate-700 dark:border-slate-200">
                    <span className="text-sm font-semibold">{selectedKeys.size} prospect(s) sélectionné(s)</span>
                    <button
                        onClick={() => setSelectedKeys(new Set())}
                        className="text-xs text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-900 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleBulkImport}
                        disabled={isBulkImporting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-all disabled:opacity-60"
                    >
                        {isBulkImporting ? <><Loader2 size={14} className="animate-spin" /> Import…</> : <><UserPlus size={14} /> Importer la sélection</>}
                    </button>
                </div>
            )}

            {/* Import modal */}
            {selectedProspect && (
                <ImportProspectModal
                    prospect={selectedProspect}
                    source={searchMeta?.source || 'ai_generated'}
                    onClose={() => setSelectedProspect(null)}
                    onConfirm={handleConfirmImport}
                    isLoading={saveProject.isPending}
                />
            )}

            {/* F1 — Generated email modal */}
            {emailModalProspect && (
                <GeneratedEmailModal
                    prospect={emailModalProspect}
                    onClose={() => setEmailModalProspect(null)}
                />
            )}
        </div>
    );
};

export default ProspectingPage;
