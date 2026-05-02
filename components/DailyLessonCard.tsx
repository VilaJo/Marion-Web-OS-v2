/**
 * DailyLessonCard — Widget "Leçon du jour"
 *
 * Affiché en haut du Dashboard. Génère une mini-leçon (3-5 min) personnalisée
 * via Gemini (`POST /ai/daily-lesson`). Une nouvelle leçon par jour, mise en
 * cache dans localStorage. Système de streak avec badges :
 *   - 3 jours d'affilée : 🔥
 *   - 7 jours        : 💪
 *   - 30 jours       : 🏆
 *
 * Persistence localStorage :
 *   marion_daily_lesson_${YYYY-MM-DD} = la leçon du jour (objet)
 *   marion_daily_lesson_done_${YYYY-MM-DD} = "true" si Marion a cliqué "Fait"
 *   marion_daily_lesson_streak = "{count, lastDoneDate}"
 *   marion_daily_lesson_recent = ["topicId1", "topicId2", ...] (8 derniers, à éviter)
 */

import React, { useEffect, useState } from 'react';
import {
    BookOpen, Loader2, Sparkles, X, Check, Copy, Flame, Trophy,
    Award, Clock, ChevronRight, AlertCircle, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lesson {
    id: string;
    topic: string;
    title: string;
    explanation: string;
    code_lang?: string;
    code_example: string;
    cursor_challenge: string;
    estimated_minutes?: number;
}

interface Streak {
    count: number;
    lastDoneDate?: string;
}

// ---------------------------------------------------------------------------
// Storage keys & helpers
// ---------------------------------------------------------------------------

const todayKey = () => new Date().toISOString().slice(0, 10);

function loadStreak(): Streak {
    try {
        const raw = localStorage.getItem('marion_daily_lesson_streak');
        if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return { count: 0 };
}
function saveStreak(s: Streak) {
    localStorage.setItem('marion_daily_lesson_streak', JSON.stringify(s));
}

function loadRecent(): string[] {
    try { return JSON.parse(localStorage.getItem('marion_daily_lesson_recent') || '[]'); } catch { return []; }
}
function pushRecent(topicId: string) {
    const recent = [topicId, ...loadRecent().filter(x => x !== topicId)].slice(0, 8);
    localStorage.setItem('marion_daily_lesson_recent', JSON.stringify(recent));
}

function loadTodayLesson(): Lesson | null {
    try {
        const raw = localStorage.getItem(`marion_daily_lesson_${todayKey()}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function saveTodayLesson(lesson: Lesson) {
    localStorage.setItem(`marion_daily_lesson_${todayKey()}`, JSON.stringify(lesson));
}

function isDoneToday(): boolean {
    return localStorage.getItem(`marion_daily_lesson_done_${todayKey()}`) === 'true';
}
function markDoneToday() {
    localStorage.setItem(`marion_daily_lesson_done_${todayKey()}`, 'true');
}

function diffInDays(a: Date, b: Date): number {
    const dayMs = 24 * 60 * 60 * 1000;
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((da - db) / dayMs);
}

function badgeFor(streak: number): { icon: any; color: string; label: string } | null {
    if (streak >= 30) return { icon: Trophy, color: 'text-amber-500', label: '30 jours' };
    if (streak >= 7) return { icon: Award, color: 'text-fuchsia-500', label: '7 jours' };
    if (streak >= 3) return { icon: Flame, color: 'text-orange-500', label: '3 jours' };
    return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
    level?: 'debutant' | 'intermediaire' | 'avance';
}

export const DailyLessonCard: React.FC<Props> = ({ level = 'intermediaire' }) => {
    const [lesson, setLesson] = useState<Lesson | null>(() => loadTodayLesson());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [done, setDone] = useState<boolean>(() => isDoneToday());
    const [streak, setStreak] = useState<Streak>(() => loadStreak());
    const [copied, setCopied] = useState<'code' | 'challenge' | null>(null);

    useEffect(() => {
        if (!lesson) {
            generateLesson();
        }
    }, []);

    const generateLesson = async (force = false) => {
        if (lesson && !force) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/v1/ai/daily-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, avoid: loadRecent() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Pas de leçon disponible.');
                return;
            }
            const newLesson: Lesson = data;
            setLesson(newLesson);
            saveTodayLesson(newLesson);
            if (newLesson.id) pushRecent(newLesson.id);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkDone = () => {
        if (done) return;
        markDoneToday();
        setDone(true);
        const today = new Date();
        const last = streak.lastDoneDate ? new Date(streak.lastDoneDate) : null;
        let newCount = 1;
        if (last) {
            const diff = diffInDays(today, last);
            if (diff === 0) newCount = streak.count;
            else if (diff === 1) newCount = streak.count + 1;
            else newCount = 1;
        }
        const next = { count: newCount, lastDoneDate: todayKey() };
        setStreak(next);
        saveStreak(next);
    };

    const copy = async (what: 'code' | 'challenge') => {
        if (!lesson) return;
        const text = what === 'code' ? lesson.code_example : lesson.cursor_challenge;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(what);
            setTimeout(() => setCopied(null), 1200);
        } catch { /* noop */ }
    };

    const badge = badgeFor(streak.count);
    const BadgeIcon = badge?.icon;

    return (
        <>
            <div className="rounded-2xl border border-fuchsia-200 dark:border-fuchsia-800 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-purple-50 dark:from-fuchsia-900/20 dark:via-pink-900/10 dark:to-purple-900/20 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fuchsia-500 text-white flex items-center justify-center shadow-md">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">Leçon du jour</div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm md:text-base">
                                {loading ? 'Préparation…' : lesson?.title || 'Aucune leçon'}
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {streak.count > 0 && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold ${badge?.color || 'text-slate-600 dark:text-slate-300'}`}>
                                {BadgeIcon ? <BadgeIcon size={12} /> : <Flame size={12} />}
                                {streak.count} j
                                {badge && <span className="text-[9px] uppercase opacity-70">{badge.label}</span>}
                            </div>
                        )}
                        {done && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <Check size={11} /> Fait
                            </span>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle size={13} /> {error}
                        <button onClick={() => generateLesson(true)} className="ml-auto text-xs underline">Retenter</button>
                    </div>
                )}

                {lesson && !loading && (
                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{lesson.explanation}</p>
                )}

                <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        {lesson?.estimated_minutes && (
                            <span className="flex items-center gap-1"><Clock size={11} /> {lesson.estimated_minutes} min</span>
                        )}
                        {lesson?.topic && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                {lesson.topic}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        disabled={!lesson || loading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-50 text-white text-xs font-semibold shadow-sm"
                    >
                        Faire la leçon <ChevronRight size={13} />
                    </button>
                </div>
            </div>

            {showModal && lesson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-fuchsia-500" />
                                <h2 className="font-bold text-slate-800 dark:text-white">{lesson.title}</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{lesson.explanation}</p>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Exemple de code</span>
                                    <button
                                        onClick={() => copy('code')}
                                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                    >
                                        {copied === 'code' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                        {copied === 'code' ? 'Copié' : 'Copier'}
                                    </button>
                                </div>
                                <pre className="bg-slate-900 dark:bg-black text-slate-100 rounded-xl p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-64">
                                    <code>{lesson.code_example}</code>
                                </pre>
                            </div>

                            <div className="rounded-xl border-2 border-fuchsia-300 dark:border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-300">🎯 Challenge Cursor (5 min)</span>
                                    <button
                                        onClick={() => copy('challenge')}
                                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                    >
                                        {copied === 'challenge' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                        {copied === 'challenge' ? 'Copié' : 'Copier'}
                                    </button>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200">{lesson.cursor_challenge}</p>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <button
                                    onClick={() => generateLesson(true)}
                                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                >
                                    <RefreshCw size={12} /> Une autre leçon
                                </button>
                                <button
                                    onClick={() => { handleMarkDone(); setShowModal(false); }}
                                    disabled={done}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold"
                                >
                                    {done ? <><Check size={14} /> Leçon faite</> : <><Check size={14} /> J'ai fait la leçon</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DailyLessonCard;
