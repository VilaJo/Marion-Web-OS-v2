/**
 * DailyLessonCard — Widget "Leçon du jour"
 *
 * Génère une mini-leçon (3-5 min) personnalisée via Gemini (`POST /ai/daily-lesson`).
 * Si Gemini n'est pas joignable (backend off, endpoint pas encore loadé après mise à
 * jour, etc.) on bascule sur une **leçon de secours statique** pour que Marion ait
 * toujours quelque chose. Pas d'erreur effrayante en haut du dashboard.
 *
 * Une nouvelle leçon par jour, mise en cache dans localStorage. Système de streak :
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
    Award, Clock, ChevronRight, RefreshCw, WifiOff,
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
    /** True quand la leçon vient du fallback statique (pas de Gemini). */
    offline?: boolean;
}

interface Streak {
    count: number;
    lastDoneDate?: string;
}

// ---------------------------------------------------------------------------
// Fallback static lessons (used when API unreachable)
// ---------------------------------------------------------------------------

const FALLBACK_LESSONS: Lesson[] = [
    {
        id: 'tailwind-arbitrary-values',
        topic: 'Tailwind',
        title: 'Les valeurs arbitraires Tailwind : ton joker',
        explanation: "Quand aucune classe ne fait pile poil ce que tu veux, utilise les crochets : w-[437px], bg-[#ff6b35], grid-cols-[1fr_320px]. Pas besoin de configurer tailwind.config.",
        code_lang: 'tsx',
        code_example: `<div className="grid grid-cols-[1fr_320px] gap-[18px]">
  <main className="bg-[#fafafa]">…</main>
  <aside className="sticky top-[88px]">…</aside>
</div>`,
        cursor_challenge: "Ouvre un layout existant, repère un endroit où tu as utilisé un style inline (style={{...}}). Demande à Cursor de le convertir en classe Tailwind avec valeur arbitraire.",
        estimated_minutes: 4,
    },
    {
        id: 'react-conditional-render',
        topic: 'React',
        title: 'Le opérateur && pour le conditional render piège silencieux',
        explanation: "{count && <Badge />} affiche '0' si count = 0 (parce que 0 est falsy mais c'est aussi un nombre). Préfère un boolean strict : {count > 0 && <Badge />}.",
        code_lang: 'tsx',
        code_example: `// ❌ Affiche "0" quand items est vide
{items.length && <Counter value={items.length} />}

// ✅ N'affiche rien
{items.length > 0 && <Counter value={items.length} />}`,
        cursor_challenge: "Cherche dans ton projet 'length &&' avec Cmd+Shift+F. Demande à Cursor d'auditer chaque occurrence et de proposer un fix si nécessaire.",
        estimated_minutes: 3,
    },
    {
        id: 'cursor-cmd-k',
        topic: 'Cursor',
        title: '3 raccourcis Cursor que tu n\'utilises pas (encore)',
        explanation: "Cmd+K = inline edit (sélectionne + reformule). Cmd+L = chat sur la sélection. Cmd+I = Composer multi-fichiers. Tu doubleras ta vitesse.",
        code_lang: 'tsx',
        code_example: `// 1. Sélectionne ce composant
function Card({ title }: { title: string }) {
  return <div className="p-4 bg-white">{title}</div>;
}

// 2. Cmd+K → "ajoute le dark mode + un border-radius"
// 3. Tab pour accepter`,
        cursor_challenge: "Ouvre n'importe quel composant. Sélectionne tout. Cmd+K. Tape : 'rends ce composant responsive et ajoute le dark mode'. Compare le diff avant d'accepter.",
        estimated_minutes: 4,
    },
    {
        id: 'a11y-button-vs-div',
        topic: 'Accessibilité',
        title: 'Button vs div onClick : pourquoi ça compte vraiment',
        explanation: "Un <div onClick> n'est pas focusable au clavier, pas annoncé par les lecteurs d'écran, et pas activable avec Espace/Entrée. <button> fait tout ça gratuitement.",
        code_lang: 'tsx',
        code_example: `// ❌ Inaccessible
<div onClick={handleClick} className="cursor-pointer">
  Valider
</div>

// ✅ Accessible
<button type="button" onClick={handleClick} className="...">
  Valider
</button>`,
        cursor_challenge: "Cherche 'div onClick' dans ton projet. Demande à Cursor de les remplacer par <button type='button'> en gardant les classes Tailwind.",
        estimated_minutes: 5,
    },
    {
        id: 'tailwind-dark-mode',
        topic: 'Tailwind',
        title: 'Le dark mode Tailwind en 1 préfixe',
        explanation: "Le préfixe dark: applique la classe seulement quand l'élément <html> a la classe 'dark'. Tu écris ton style clair, puis le sombre à côté.",
        code_lang: 'tsx',
        code_example: `<div className="
  bg-white dark:bg-slate-900
  text-slate-900 dark:text-slate-100
  border border-slate-200 dark:border-slate-700
">
  Card adaptable
</div>`,
        cursor_challenge: "Prends un composant qui n'a pas le dark mode. Cmd+K → 'ajoute le dark mode pour tous les éléments visuels'. Vérifie en switchant le thème.",
        estimated_minutes: 4,
    },
    {
        id: 'next-server-component',
        topic: 'Next.js',
        title: 'Server Components : où mettre "use client"',
        explanation: "Par défaut tout est Server Component dans le App Router. Tu n'ajoutes 'use client' qu'à la racine d'un sous-arbre interactif (qui utilise useState, onClick, etc.).",
        code_lang: 'tsx',
        code_example: `// app/page.tsx — Server Component (peut fetch direct)
async function HomePage() {
  const data = await fetch('https://...').then(r => r.json());
  return <ProductGrid products={data} />;
}

// components/AddToCartButton.tsx — Client Component
'use client';
export function AddToCartButton({ id }: { id: string }) {
  const [adding, setAdding] = useState(false);
  // ...
}`,
        cursor_challenge: "Ouvre une page Next. Demande à Cursor : 'identifie quels composants doivent être client et lesquels peuvent rester server'. Lis sa réponse.",
        estimated_minutes: 5,
    },
    {
        id: 'git-amend',
        topic: 'Git',
        title: 'git commit --amend : fix ton dernier commit sans pollution d\'historique',
        explanation: "Tu as oublié un fichier ou une typo dans ton message de commit ? Avant de push, --amend te laisse modifier le dernier commit au lieu d'en créer un nouveau.",
        code_lang: 'bash',
        code_example: `# Tu as oublié d'ajouter README.md
git add README.md
git commit --amend --no-edit

# Ou tu veux changer le message
git commit --amend -m "feat: nouveau message plus clair"`,
        cursor_challenge: "Fais un commit dans un projet test. Modifie un fichier supplémentaire. Utilise --amend pour l'inclure. Vérifie avec git log que tu as toujours qu'un seul commit.",
        estimated_minutes: 3,
    },
    {
        id: 'framer-motion-layout',
        topic: 'Animations',
        title: "L'attribut layout de Framer Motion : magique",
        explanation: "Ajoute layout à n'importe quel <motion.div> : il animera automatiquement les changements de taille/position quand le DOM bouge. Zéro CSS supplémentaire.",
        code_lang: 'tsx',
        code_example: `import { motion, AnimatePresence } from 'framer-motion';

<motion.div layout className="bg-white p-4 rounded-2xl">
  <h3>{title}</h3>
  <AnimatePresence>
    {expanded && (
      <motion.p layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {description}
      </motion.p>
    )}
  </AnimatePresence>
</motion.div>`,
        cursor_challenge: "Sur une carte avec un toggle 'Voir plus', ajoute layout à la motion.div parente. Compare le ressenti avant/après — c'est nuit et jour.",
        estimated_minutes: 5,
    },
];

function pickFallbackLesson(avoid: string[]): Lesson {
    const candidates = FALLBACK_LESSONS.filter(l => !avoid.includes(l.id));
    const pool = candidates.length > 0 ? candidates : FALLBACK_LESSONS;
    const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const lesson = pool[dayIndex % pool.length];
    return { ...lesson, offline: true };
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
    /** Variante compacte (sidebar) — montre moins de texte. */
    compact?: boolean;
}

export const DailyLessonCard: React.FC<Props> = ({ level = 'intermediaire', compact = false }) => {
    const [lesson, setLesson] = useState<Lesson | null>(() => loadTodayLesson());
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [done, setDone] = useState<boolean>(() => isDoneToday());
    const [streak, setStreak] = useState<Streak>(() => loadStreak());
    const [copied, setCopied] = useState<'code' | 'challenge' | null>(null);

    useEffect(() => {
        if (!lesson) {
            generateLesson();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateLesson = async (force = false) => {
        if (lesson && !force) return;
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/ai/daily-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, avoid: loadRecent() }),
            });
            if (!res.ok) {
                const fb = pickFallbackLesson(loadRecent());
                setLesson(fb);
                saveTodayLesson(fb);
                if (fb.id) pushRecent(fb.id);
                return;
            }
            const data = await res.json();
            const newLesson: Lesson = data;
            setLesson(newLesson);
            saveTodayLesson(newLesson);
            if (newLesson.id) pushRecent(newLesson.id);
        } catch {
            const fb = pickFallbackLesson(loadRecent());
            setLesson(fb);
            saveTodayLesson(fb);
            if (fb.id) pushRecent(fb.id);
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
            <div className={`rounded-2xl border border-fuchsia-200 dark:border-fuchsia-800/50 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-purple-50 dark:from-fuchsia-900/20 dark:via-pink-900/10 dark:to-purple-900/20 ${compact ? 'p-3' : 'p-4 md:p-5'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`rounded-xl bg-fuchsia-500 text-white flex items-center justify-center shadow-md flex-shrink-0 ${compact ? 'w-9 h-9' : 'w-10 h-10'}`}>
                            <BookOpen size={compact ? 16 : 18} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 flex items-center gap-1.5">
                                Leçon du jour
                                {lesson?.offline && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] text-slate-600 dark:text-slate-300 normal-case font-medium" title="Backend Gemini indisponible — leçon de secours">
                                        <WifiOff size={9} /> hors ligne
                                    </span>
                                )}
                            </div>
                            <h3 className={`font-bold text-slate-800 dark:text-white truncate ${compact ? 'text-sm' : 'text-sm md:text-base'}`}>
                                {loading ? 'Préparation…' : lesson?.title || 'Aucune leçon'}
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {streak.count > 0 && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold ${badge?.color || 'text-slate-600 dark:text-slate-300'}`}>
                                {BadgeIcon ? <BadgeIcon size={12} /> : <Flame size={12} />}
                                {streak.count} j
                                {badge && !compact && <span className="text-[9px] uppercase opacity-70">{badge.label}</span>}
                            </div>
                        )}
                        {done && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <Check size={11} /> Fait
                            </span>
                        )}
                    </div>
                </div>

                {lesson && !loading && !compact && (
                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{lesson.explanation}</p>
                )}

                <div className={`flex items-center justify-between gap-2 flex-wrap ${compact ? 'mt-2' : 'mt-4'}`}>
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
                        {loading ? <Loader2 size={13} className="animate-spin" /> : null}
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
                                    disabled={loading}
                                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-50"
                                >
                                    {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Une autre leçon
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
