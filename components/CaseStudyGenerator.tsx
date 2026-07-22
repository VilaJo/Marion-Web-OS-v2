/**
 * CaseStudyGenerator — Auto-generate portfolio case studies and LinkedIn posts
 * Shown in ClientView when project is in archived phase.
 */

import React, { useState, useCallback } from 'react';
import {
    BookOpen, Loader2, AlertCircle, Copy, CheckCircle2, Download,
    Linkedin, Edit3, Save, RefreshCw, Sparkles,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import type { Project } from '../types';

interface CaseStudyResult {
    title: string;
    tagline: string;
    context: string;
    problem: string;
    solution: string;
    results: string;
    tech_stack: string[];
    duration: string;
    linkedin_post: string;
    portfolio_blurb: string;
}

interface CaseStudyGeneratorProps {
    project: Project;
}

type EditableSection = keyof Omit<CaseStudyResult, 'tech_stack'>;

export const CaseStudyGenerator: React.FC<CaseStudyGeneratorProps> = ({ project }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<CaseStudyResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
    const [editValue, setEditValue] = useState('');
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'study' | 'linkedin' | 'portfolio'>('study');

    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/v1/ai/case-study', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project: {
                        clientName: project.clientName,
                        phase: project.phase,
                        createdAt: project.createdAt,
                        tasks: project.tasks,
                        profile: project.profile,
                    },
                }),
            });
            if (!res.ok) throw new Error(`Erreur ${res.status}`);
            const data: CaseStudyResult = await res.json();
            setResult(data);
        } catch (e: any) {
            setError(e.message || 'Génération impossible');
        } finally {
            setIsLoading(false);
        }
    }, [project]);

    const handleCopy = useCallback((text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(key);
        setTimeout(() => setCopiedSection(null), 2000);
    }, []);

    const handleStartEdit = (key: EditableSection, value: string) => {
        setEditingSection(key);
        setEditValue(value);
    };

    const handleSaveEdit = () => {
        if (!result || !editingSection) return;
        setResult(prev => prev ? { ...prev, [editingSection]: editValue } : prev);
        setEditingSection(null);
    };

    const handleExport = useCallback(() => {
        if (!result) return;
        const content = [
            `# ${result.title}`,
            `*${result.tagline}*`,
            '',
            '## Contexte',
            result.context,
            '',
            '## Problème',
            result.problem,
            '',
            '## Solution',
            result.solution,
            '',
            '## Résultats',
            result.results,
            '',
            `## Stack technique : ${result.tech_stack.join(', ')}`,
            `## Durée : ${result.duration}`,
            '',
            '---',
            '## Post LinkedIn',
            result.linkedin_post,
            '',
            '## Portfolio (courte description)',
            result.portfolio_blurb,
        ].join('\n');
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `case-study-${project.clientName.toLowerCase().replace(/\s+/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }, [result, project.clientName]);

    const SectionBlock: React.FC<{ label: string; content: string; sectionKey: EditableSection; multiline?: boolean }> = ({ label, content, sectionKey, multiline = true }) => (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <div className="flex items-center gap-1">
                    <button onClick={() => handleCopy(content, sectionKey)} className="p-1 rounded text-slate-400 hover:text-indigo-500 transition-colors">
                        {copiedSection === sectionKey ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    </button>
                    <button onClick={() => handleStartEdit(sectionKey, content)} className="p-1 rounded text-slate-400 hover:text-indigo-500 transition-colors">
                        <Edit3 size={11} />
                    </button>
                </div>
            </div>
            {editingSection === sectionKey ? (
                <div className="space-y-1">
                    {multiline ? (
                        <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={4}
                            className="w-full text-xs rounded-lg p-2 bg-slate-50 dark:bg-slate-800 border border-indigo-300 outline-none resize-none" autoFocus />
                    ) : (
                        <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            className="w-full text-xs rounded-lg p-2 bg-slate-50 dark:bg-slate-800 border border-indigo-300 outline-none" autoFocus />
                    )}
                    <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditingSection(null)} className="px-2 py-1 text-[10px] rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Annuler</button>
                        <button onClick={handleSaveEdit} className="px-2 py-1 text-[10px] rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex items-center gap-1">
                            <Save size={10} /> Sauver
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{content}</p>
            )}
        </div>
    );

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-violet-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Générateur de Case Study</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Génère automatiquement une étude de cas pour ton portfolio + un post LinkedIn prêt à publier.</p>
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-eonora-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-105 transition-all disabled:opacity-60"
                >
                    {isLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Génération en cours…</>
                        : result ? <><RefreshCw size={14} /> Régénérer</> : <><BookOpen size={14} /> Générer le Case Study</>
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
                <div className="space-y-4">
                    {/* Section tabs */}
                    <div className="flex gap-1.5">
                        {(['study', 'linkedin', 'portfolio'] as const).map(s => (
                            <button key={s} onClick={() => setActiveSection(s)}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    activeSection === s
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}>
                                {s === 'study' ? '📄 Case Study' : s === 'linkedin' ? <span className="flex items-center justify-center gap-1"><Linkedin size={12} /> LinkedIn</span> : '🎯 Portfolio'}
                            </button>
                        ))}
                    </div>

                    {activeSection === 'study' && (
                        <div className="space-y-3">
                            <SectionBlock label="Titre" content={result.title} sectionKey="title" multiline={false} />
                            <SectionBlock label="Tagline" content={result.tagline} sectionKey="tagline" multiline={false} />
                            <SectionBlock label="Contexte" content={result.context} sectionKey="context" />
                            <SectionBlock label="Problème" content={result.problem} sectionKey="problem" />
                            <SectionBlock label="Solution" content={result.solution} sectionKey="solution" />
                            <SectionBlock label="Résultats" content={result.results} sectionKey="results" />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stack technique · {result.duration}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {result.tech_stack.map((t, i) => (
                                        <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">{t}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'linkedin' && (
                        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Linkedin size={16} className="text-blue-600" />
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Post LinkedIn</p>
                                </div>
                                <button onClick={() => handleCopy(result.linkedin_post, 'linkedin')} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                                    {copiedSection === 'linkedin' ? <><CheckCircle2 size={12} className="text-emerald-500" /> Copié !</> : <><Copy size={12} /> Copier</>}
                                </button>
                            </div>
                            {editingSection === 'linkedin_post' ? (
                                <div className="space-y-2">
                                    <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={10}
                                        className="w-full text-xs rounded-lg p-3 bg-white dark:bg-slate-800 border border-blue-300 outline-none resize-none" autoFocus />
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingSection(null)} className="flex-1 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">Annuler</button>
                                        <button onClick={handleSaveEdit} className="flex-1 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors">Sauver</button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">{result.linkedin_post}</p>
                            )}
                            {editingSection !== 'linkedin_post' && (
                                <button onClick={() => handleStartEdit('linkedin_post' as any, result.linkedin_post)} className="mt-3 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors">
                                    <Edit3 size={11} /> Modifier
                                </button>
                            )}
                        </div>
                    )}

                    {activeSection === 'portfolio' && (
                        <SectionBlock label="Description portfolio (courte)" content={result.portfolio_blurb} sectionKey="portfolio_blurb" />
                    )}

                    <button onClick={handleExport} className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                        <Download size={14} /> Exporter en Markdown
                    </button>
                </div>
            )}

            {!result && !isLoading && !error && (
                <div className="text-center py-8 text-slate-400">
                    <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Génère automatiquement ton case study portfolio.</p>
                    <p className="text-xs mt-1">Titre, contexte, solution, résultats + post LinkedIn inclus.</p>
                </div>
            )}
        </div>
    );
};
