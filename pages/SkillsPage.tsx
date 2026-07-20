/**
 * SkillsPage — Tableau des compétences (radar 8 axes)
 *
 * Marion auto-évalue ses skills sur 8 axes (1-5).
 * Le système identifie le plus faible et propose un "skill du mois" avec exos.
 *
 * Pas de backend pour le radar lui-même (juste localStorage), mais on peut
 * appeler /ai/daily-lesson en passant le sujet du skill du mois pour obtenir
 * des exercices Cursor adaptés.
 *
 * Persistence : `marion_skills_radar` (localStorage).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft, Target, Sparkles, Save, Trophy, AlertCircle, Loader2,
    BookOpen, RefreshCw, TrendingUp, Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { CodeReviewPanel } from '../components/CodeReviewPanel';
import { DailyLessonCard } from '../components/DailyLessonCard';
import { useClaudeStatus } from '../services/queries';

// ---------------------------------------------------------------------------
// Skills definition
// ---------------------------------------------------------------------------

interface Skill {
    id: string;
    label: string;
    description: string;
}

const SKILLS: Skill[] = [
    { id: 'tailwind', label: 'Tailwind', description: 'Maîtrise des classes utilitaires, design tokens, responsive' },
    { id: 'react_hooks', label: 'React Hooks', description: 'useState, useEffect, useMemo, custom hooks' },
    { id: 'nextjs_routing', label: 'Next.js Routing', description: 'App Router, dynamic routes, layouts, loading' },
    { id: 'server_components', label: 'Server Components', description: 'fetching données, ISR, server actions' },
    { id: 'animations', label: 'Animations (Framer)', description: 'Framer Motion, transitions, AnimatePresence' },
    { id: 'cursor_mastery', label: 'Cursor Mastery', description: 'Composer, Cmd+K, Cmd+L, agent mode' },
    { id: 'git_vercel', label: 'Git / Vercel', description: 'commit, branche, PR, deploy preview' },
    { id: 'a11y_perf', label: 'Accessibilité / Perf', description: 'ARIA, contrastes, Core Web Vitals' },
];

interface SkillState {
    levels: Record<string, number>; // 0-5 par skill id
    skillOfMonth?: { id: string; pickedAt: number; reason?: string };
    history: { date: string; levels: Record<string, number> }[];
}

const STORAGE_KEY = 'marion_skills_radar';

function loadSkills(): SkillState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return {
        levels: Object.fromEntries(SKILLS.map(s => [s.id, 3])),
        history: [],
    };
}
function saveSkills(s: SkillState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ---------------------------------------------------------------------------
// Radar SVG
// ---------------------------------------------------------------------------

const Radar: React.FC<{ levels: Record<string, number> }> = ({ levels }) => {
    const size = 360;
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) - 30;
    const n = SKILLS.length;
    const angles = SKILLS.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);

    const points = angles
        .map((a, i) => {
            const lvl = (levels[SKILLS[i].id] || 0) / 5;
            return `${cx + Math.cos(a) * radius * lvl},${cy + Math.sin(a) * radius * lvl}`;
        })
        .join(' ');

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-md mx-auto">
            {/* concentric pentagons */}
            {[1, 2, 3, 4, 5].map(level => {
                const lvlR = (radius * level) / 5;
                const polyPoints = angles.map(a => `${cx + Math.cos(a) * lvlR},${cy + Math.sin(a) * lvlR}`).join(' ');
                return <polygon key={level} points={polyPoints} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth={1} />;
            })}
            {/* axes */}
            {angles.map((a, i) => (
                <line
                    key={i}
                    x1={cx} y1={cy}
                    x2={cx + Math.cos(a) * radius} y2={cy + Math.sin(a) * radius}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-700"
                    strokeWidth={1}
                />
            ))}
            {/* data shape */}
            <polygon
                points={points}
                fill="rgba(168, 85, 247, 0.25)"
                stroke="rgb(168, 85, 247)"
                strokeWidth={2}
            />
            {/* dots + labels */}
            {angles.map((a, i) => {
                const lvl = (levels[SKILLS[i].id] || 0) / 5;
                const x = cx + Math.cos(a) * radius * lvl;
                const y = cy + Math.sin(a) * radius * lvl;
                const labelX = cx + Math.cos(a) * (radius + 20);
                const labelY = cy + Math.sin(a) * (radius + 20);
                return (
                    <g key={i}>
                        <circle cx={x} cy={y} r={4} fill="rgb(168, 85, 247)" />
                        <text
                            x={labelX} y={labelY}
                            textAnchor={Math.abs(labelX - cx) < 5 ? 'middle' : labelX > cx ? 'start' : 'end'}
                            dominantBaseline="middle"
                            className="text-[10px] fill-slate-600 dark:fill-slate-300 font-semibold"
                        >
                            {SKILLS[i].label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SkillsPage: React.FC = () => {
    const navigate = useNavigate();
    const [state, setState] = useState<SkillState>(() => loadSkills());
    const [savedFlash, setSavedFlash] = useState(false);
    const [loadingLesson, setLoadingLesson] = useState(false);
    const [lessonError, setLessonError] = useState<string | null>(null);
    const [exercise, setExercise] = useState<{ title: string; explanation: string; cursor_challenge: string; code_example?: string } | null>(null);
    const [showCodeReview, setShowCodeReview] = useState(false);
    const { data: claudeStatus } = useClaudeStatus();
    const claudeConfigured = !!claudeStatus?.configured;

    const setLevel = (skillId: string, val: number) => {
        const next = { ...state, levels: { ...state.levels, [skillId]: val } };
        setState(next);
    };

    const handleSave = () => {
        const today = new Date().toISOString().slice(0, 10);
        const history = [...state.history.filter(h => h.date !== today), { date: today, levels: state.levels }].slice(-30);
        const next = { ...state, history };
        setState(next);
        saveSkills(next);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
    };

    const weakestSkill = useMemo(() => {
        let weakest: { skill: Skill; level: number } | null = null;
        SKILLS.forEach(s => {
            const lvl = state.levels[s.id] ?? 3;
            if (!weakest || lvl < weakest.level) weakest = { skill: s, level: lvl };
        });
        return weakest;
    }, [state.levels]);

    const averageLevel = useMemo(() => {
        const vals = SKILLS.map(s => state.levels[s.id] ?? 3);
        return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    }, [state.levels]);

    const setSkillOfMonth = () => {
        if (!weakestSkill) return;
        const next = {
            ...state,
            skillOfMonth: { id: weakestSkill.skill.id, pickedAt: Date.now(), reason: `Plus faible : ${weakestSkill.level}/5` },
        };
        setState(next);
        saveSkills(next);
    };

    const generateExercise = async () => {
        const skillId = state.skillOfMonth?.id || weakestSkill?.skill.id;
        if (!skillId) return;
        const skill = SKILLS.find(s => s.id === skillId);
        if (!skill) return;
        setLoadingLesson(true);
        setLessonError(null);
        setExercise(null);
        try {
            const res = await apiFetch('/api/v1/ai/daily-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'intermediaire',
                    topic: skill.label,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setLessonError(data.error || 'Exercice indisponible.');
                return;
            }
            setExercise({
                title: data.title,
                explanation: data.explanation,
                cursor_challenge: data.cursor_challenge,
                code_example: data.code_example,
            });
        } catch {
            setLessonError('Impossible de joindre le serveur.');
        } finally {
            setLoadingLesson(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
            <div className="mb-6">
                <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 mb-2">
                    <ArrowLeft size={13} /> Retour
                </button>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Target className="text-purple-500" /> Tes compétences
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Auto-évalue-toi sur 8 axes. L'app te suggère un "skill du mois" et des exercices Cursor.
                </p>
            </div>

            {/* Leçon du jour — Marion peut piocher 5 min de pratique avant de bosser */}
            <div className="mb-6">
                <DailyLessonCard />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                        <Radar levels={state.levels} />
                        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-slate-500">Niveau moyen :</span>
                                <span className="text-2xl font-bold text-slate-800 dark:text-white">{averageLevel}/5</span>
                            </div>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold"
                            >
                                {savedFlash ? <><Sparkles size={13} /> Sauvegardé !</> : <><Save size={13} /> Sauver mon évaluation</>}
                            </button>
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">Auto-évaluation</h3>
                        {SKILLS.map(s => {
                            const lvl = state.levels[s.id] ?? 3;
                            return (
                                <div key={s.id} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800 dark:text-white">{s.label}</div>
                                            <div className="text-[11px] text-slate-500">{s.description}</div>
                                        </div>
                                        <div className="text-lg font-bold text-purple-500">{lvl}/5</div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setLevel(s.id, n)}
                                                className={`flex-1 h-2.5 rounded-full transition-colors ${
                                                    n <= lvl ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'
                                                }`}
                                                aria-label={`Niveau ${n}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <aside className="lg:col-span-1 space-y-4">
                    {/* Skill of the month */}
                    <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><Trophy size={14} className="text-amber-500" /> Skill du mois</h3>
                        {state.skillOfMonth ? (
                            <div className="mt-2">
                                <div className="text-base font-bold text-slate-800 dark:text-white">
                                    {SKILLS.find(s => s.id === state.skillOfMonth!.id)?.label}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Calendar size={10} /> Choisi le {new Date(state.skillOfMonth.pickedAt).toLocaleDateString('fr-FR')}
                                </div>
                                {state.skillOfMonth.reason && (
                                    <p className="text-[11px] italic text-slate-500 mt-1">{state.skillOfMonth.reason}</p>
                                )}
                            </div>
                        ) : weakestSkill ? (
                            <div className="mt-2 space-y-2">
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    Suggestion : <strong>{weakestSkill.skill.label}</strong> ({weakestSkill.level}/5).
                                </p>
                                <button onClick={setSkillOfMonth} className="w-full px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold">
                                    Définir comme skill du mois
                                </button>
                            </div>
                        ) : null}

                        {(state.skillOfMonth || weakestSkill) && (
                            <button
                                onClick={generateExercise}
                                disabled={loadingLesson}
                                className="mt-3 w-full px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                            >
                                {loadingLesson ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Générer un exercice
                            </button>
                        )}

                        {lessonError && (
                            <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-[11px] flex items-center gap-1">
                                <AlertCircle size={10} /> {lessonError}
                            </div>
                        )}

                        {exercise && (
                            <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 space-y-2">
                                <h4 className="font-bold text-xs text-slate-800 dark:text-white">{exercise.title}</h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">{exercise.explanation}</p>
                                <div className="text-[11px] p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-slate-700 dark:text-slate-200">
                                    🎯 {exercise.cursor_challenge}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History */}
                    {state.history.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" /> Évolution</h3>
                            <ul className="mt-2 space-y-1 text-xs">
                                {state.history.slice(-5).reverse().map(h => {
                                    const avg = (Object.values(h.levels).reduce((a, b) => a + b, 0) / Object.values(h.levels).length).toFixed(1);
                                    return (
                                        <li key={h.date} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                            <span>{new Date(h.date).toLocaleDateString('fr-FR')}</span>
                                            <span className="font-bold">{avg}/5</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {claudeConfigured && (
                        <button
                            onClick={() => setShowCodeReview(!showCodeReview)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                        >
                            <BookOpen size={12} /> {showCodeReview ? 'Masquer' : 'Tester'} le Code Review Claude
                        </button>
                    )}
                </aside>
            </div>

            {claudeConfigured && showCodeReview && (
                <div className="mt-6">
                    <CodeReviewPanel />
                </div>
            )}
        </div>
    );
};

export default SkillsPage;
