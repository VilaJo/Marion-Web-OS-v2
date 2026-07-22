import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    X, Volume2, MessageCircle, Send, Sparkles, Target, Brain, Heart, Zap, Coffee,
    Play, Pause, RotateCcw, CheckCircle2, Timer, ChevronRight
} from 'lucide-react';
import { SOUNDS } from '../constants';
import { apiFetch } from '../services/api';
import { useFocusStore } from '../stores';
import { useSaveProject } from '../services/queries';
import { Project } from '../types';

// Quick prompts for Coach Franck
const COACH_PROMPTS = [
    { icon: Heart, label: "Me calmer", prompt: "Je me sens tendue. Guide-moi pour me calmer en 1 minute." },
    { icon: Target, label: "Me concentrer", prompt: "Aide-moi à choisir une seule priorité claire pour maintenant." },
    { icon: Brain, label: "J'ai besoin d'un conseil", prompt: "Donne-moi un conseil simple et rassurant pour repartir sereinement." },
    { icon: Zap, label: "Motivation douce", prompt: "Donne-moi un petit boost sans pression, juste pour recommencer doucement." },
    { icon: Coffee, label: "Pause consciente", prompt: "Propose-moi une mini pause consciente de 2 minutes." },
];

interface FocusModeProps {
    onExit: () => void;
    currentTask?: string;
    projects?: Project[];
    ambientUrl: string | null;
    isAmbientPlaying: boolean;
    ambientVolume: number;
    onSetAmbientUrl: (url: string | null) => void;
    onToggleAmbient: (playing: boolean) => void;
    onSetVolume: (vol: number) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({ 
    onExit, 
    currentTask,
    projects = [],
    ambientUrl,
    isAmbientPlaying,
    ambientVolume,
    onSetAmbientUrl,
    onToggleAmbient,
    onSetVolume
}) => {
    const {
        state: focusState,
        phase,
        objective,
        resultSummary,
        remainingSeconds,
        settings,
        startSession,
        pauseSession,
        resumeSession,
        resetSession,
        completeSession,
        startNextFocusCycle,
        setObjective,
        setResultSummary,
        linkedProjectId,
        linkedTaskId,
        focusCount,
        setLinkedTask,
        setSettings,
        history,
        getWeeklyMetrics,
    } = useFocusStore();
    const saveProjectMutation = useSaveProject();

    // Determine current sound ID based on URL
    const currentSoundId = SOUNDS.find(s => s.url === ambientUrl)?.id || null;

    const handleSoundToggle = (soundId: string) => {
        const sound = SOUNDS.find(s => s.id === soundId);
        if (!sound) return;

        if (currentSoundId === soundId) {
            onToggleAmbient(!isAmbientPlaying);
        } else {
            onSetAmbientUrl(sound.url);
            onToggleAmbient(true);
        }
    };

    // Chat State (Local)
    const [showChat, setShowChat] = useState(false);
    const [chatHistory, setChatHistory] = useState<{role: 'user'|'model', text: string}[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionObjective, setSessionObjective] = useState(currentTask || objective || '');
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [focusIntent, setFocusIntent] = useState<'calm' | 'focus' | 'advice'>('calm');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeProjects = useMemo(
        () => projects.filter(p => (p.tasks || []).some(t => !t.completed)),
        [projects]
    );

    const selectedProject = useMemo(
        () => projects.find((p) => p.id === linkedProjectId) || null,
        [projects, linkedProjectId]
    );

    const selectableTasks = useMemo(
        () => (selectedProject?.tasks || []).filter(t => !t.completed),
        [selectedProject]
    );
    const weeklyMetrics = useMemo(() => getWeeklyMetrics(), [history, getWeeklyMetrics]);
    const recentSessions = useMemo(() => history.slice(0, 4), [history]);

    useEffect(() => {
        if (focusState === 'idle' && !objective && currentTask) {
            setSessionObjective(currentTask);
            setObjective(currentTask);
        }
    }, [focusState, objective, currentTask, setObjective]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setPrefersReducedMotion(media.matches);
        apply();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, []);

    // Scroll to bottom
    useEffect(() => {
        if (showChat) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, isTyping, showChat]);

    const handleSendMessage = async (directMessage?: string) => {
        const userMsg = directMessage || chatInput;
        if (!userMsg.trim()) return;
        
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput('');
        setIsTyping(true);

        // Prepare context for Coach Franck
        const context = chatHistory.map(msg => ({ role: msg.role, parts: [msg.text] }));
        const focusContext = {
            phase,
            state: focusState,
            objective: objective || sessionObjective,
            remaining_seconds: remainingSeconds,
        };
        
        try {
             const response = await apiFetch('/api/v1/chat/zen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: context, message: userMsg, focus_context: focusContext })
            });
            
            if (!response.ok) {
                setChatHistory(prev => [...prev, { role: 'model', text: "Oups, petit souci technique. Respire et réessaie dans quelques secondes. 🔧" }]);
                setIsTyping(false);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            
            let fullText = "";
            setChatHistory(prev => [...prev, { role: 'model', text: "" }]);

            if(reader) {
                while(true) {
                    const {done, value} = await reader.read();
                    if(done) break;
                    const chunk = decoder.decode(value);
                    fullText += chunk;
                    setChatHistory(prev => {
                        const newHist = [...prev];
                        newHist[newHist.length - 1].text = fullText;
                        return newHist;
                    });
                }
            }

        } catch (e) {
            console.error(e);
            setChatHistory(prev => [...prev, { role: 'model', text: "Connexion interrompue. Prends une grande respiration et réessaie. 🌿" }]);
        } finally {
            setIsTyping(false);
        }
    };

    const timerLabel = useMemo(() => {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, [remainingSeconds]);

    const phaseLabel = useMemo(() => {
        if (phase === 'short_break') return 'Pause courte';
        if (phase === 'long_break') return 'Pause longue';
        return 'Session Focus';
    }, [phase]);

    const defaultObjectiveByIntent: Record<'calm' | 'focus' | 'advice', string> = {
        calm: 'Respirer et retrouver le calme',
        focus: 'Avancer sur une seule priorité',
        advice: 'Recevoir un conseil concret et apaisant',
    };

    const canStart = focusIntent !== 'focus' || (sessionObjective || '').trim().length > 0;

    const handleStart = () => {
        const trimmed = sessionObjective.trim() || defaultObjectiveByIntent[focusIntent];
        if (!trimmed) return;
        setObjective(trimmed);
        startSession({
            objective: trimmed,
            plannedMinutes: settings.focusMinutes,
            linkedProjectId,
            linkedTaskId,
        });
    };

    const handlePrimaryAction = () => {
        if (focusState === 'idle' || focusState === 'completed') {
            if (phase !== 'focus' && focusState === 'completed') {
                startNextFocusCycle();
                return;
            }
            handleStart();
            return;
        }
        if (focusState === 'running') {
            pauseSession();
            return;
        }
        resumeSession();
    };

    const primaryLabel = (() => {
        if (focusState === 'running') return 'Pause';
        if (focusState === 'paused' || focusState === 'break') return 'Reprendre';
        if (focusState === 'completed') return phase === 'focus' ? 'Nouvelle session' : 'Session suivante';
        return 'Démarrer';
    })();

    const primaryIcon = (() => {
        if (focusState === 'running') return <Pause size={16} />;
        if (focusState === 'completed') return <ChevronRight size={16} />;
        return <Play size={16} />;
    })();

    const handleMarkLinkedTaskDone = async () => {
        if (!linkedProjectId || !linkedTaskId) return;
        const project = projects.find((p) => p.id === linkedProjectId);
        if (!project) return;
        const updated = {
            ...project,
            tasks: (project.tasks || []).map((t) =>
                t.id === linkedTaskId ? { ...t, completed: true, column: 'done' as const } : t
            ),
        };
        try {
            await saveProjectMutation.mutateAsync({ project: updated });
            setLinkedTask(undefined, undefined);
        } catch (err) {
            console.error('Failed to mark linked task done', err);
        }
    };

    const isSessionActive = focusState === 'running' || focusState === 'paused' || focusState === 'break';
    const handleExitFocus = () => {
        if (isSessionActive) {
            const canExit = window.confirm('Quitter le mode Focus maintenant ? La session en cours sera interrompue.');
            if (!canExit) return;
        }
        onExit();
    };

    return (
        <div className={`fixed inset-0 z-[200] bg-slate-900 text-white ${prefersReducedMotion ? '' : 'animate-in fade-in duration-700'}`}>
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-[12%] left-[14%] w-80 h-80 rounded-full blur-[120px] ${settings.calmMode ? 'bg-brand-orange/5' : 'bg-brand-orange/10'} ${prefersReducedMotion ? '' : 'animate-pulse'}`}></div>
                <div className={`absolute bottom-[12%] right-[10%] w-80 h-80 rounded-full blur-[120px] ${settings.calmMode ? 'bg-[#4a72c4]/5' : 'bg-[#4a72c4]/10'} ${prefersReducedMotion ? '' : 'animate-pulse'}`} style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 h-full w-full px-3 pt-[max(12px,env(safe-area-inset-top))] pb-[calc(92px+env(safe-area-inset-bottom))] md:px-6 md:pb-28">
                <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 md:gap-5">
                    <header className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 backdrop-blur-xl md:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Mode Focus</h2>
                                <p className="mt-1 text-sm text-slate-300">
                                    Ton espace de tranquillite: respirer, te recentrer, avancer sans pression.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Timer size={14} className="text-brand-orange" />
                                <span>{phaseLabel}</span>
                                <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5">Cycle {focusCount + 1}</span>
                            </div>
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 gap-4 pb-3 text-left">
                            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl md:p-6">
                                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Comment tu veux utiliser ce moment ?</div>
                                <div className="mt-3 grid gap-2 md:grid-cols-3">
                                    {[
                                        { id: 'calm' as const, icon: Heart, title: 'Me calmer', subtitle: 'Respirer et redescendre doucement' },
                                        { id: 'focus' as const, icon: Target, title: 'Me concentrer', subtitle: 'Une seule priorite, sans surcharge' },
                                        { id: 'advice' as const, icon: Brain, title: "J'ai besoin d'un conseil", subtitle: 'Parler avec Franck et repartir sereine' },
                                    ].map((intent) => (
                                        <button
                                            key={intent.id}
                                            onClick={() => {
                                                setFocusIntent(intent.id);
                                                if (!sessionObjective.trim()) {
                                                    setSessionObjective(defaultObjectiveByIntent[intent.id]);
                                                }
                                            }}
                                            className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                                                focusIntent === intent.id
                                                    ? 'border-brand-orange/50 bg-brand-orange/10'
                                                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                                                <intent.icon size={16} className="text-brand-orange" />
                                                {intent.title}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-400">{intent.subtitle}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl md:p-6">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
                                        <Sparkles size={13} className="text-brand-orange" />
                                        Capsule de tranquillite
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {[5, 10, 15].map((preset) => (
                                            <button
                                                key={preset}
                                                onClick={() => setSettings({ focusMinutes: preset })}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                                    settings.focusMinutes === preset
                                                        ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/40'
                                                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:text-white'
                                                }`}
                                            >
                                                {preset} min
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-3 text-5xl md:text-6xl font-serif font-bold leading-none tracking-tight text-white">
                                    {timerLabel}
                                </div>

                                <p className="mt-3 text-sm text-slate-300">
                                    {focusIntent === 'calm' && 'Pose les epaules, respire lentement, et reste simplement ici quelques minutes.'}
                                    {focusIntent === 'focus' && 'Choisis une seule chose utile, puis avance doucement sans te disperser.'}
                                    {focusIntent === 'advice' && 'Si tu veux, ouvre Franck pour un conseil court et rassurant.'}
                                </p>

                                <label className="mt-4 block text-[11px] uppercase tracking-widest text-slate-400 mb-2 font-bold">
                                    Intention du moment
                                </label>
                                <textarea
                                    value={sessionObjective}
                                    onChange={(e) => {
                                        setSessionObjective(e.target.value);
                                        setObjective(e.target.value);
                                    }}
                                    rows={2}
                                    placeholder={defaultObjectiveByIntent[focusIntent]}
                                    className="w-full rounded-2xl bg-slate-800/80 border border-slate-700 text-sm p-3 text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/20 resize-none"
                                />

                                {focusIntent === 'advice' && (
                                    <button
                                        onClick={() => {
                                            setShowChat(true);
                                            if (chatHistory.length === 0) {
                                                void handleSendMessage("J'ai besoin d'un conseil simple pour me calmer et me remettre en route.");
                                            }
                                        }}
                                        className="mt-3 px-3.5 py-2 rounded-xl border border-[#2aada0]/40 bg-[#2aada0]/10 text-[#7fd4c9] hover:text-white text-sm transition-colors"
                                    >
                                        Ouvrir Franck en mode conseil
                                    </button>
                                )}
                            </section>
                        </div>

                        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl md:p-6">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Ambiance</div>
                                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={settings.calmMode}
                                        onChange={(e) => setSettings({ calmMode: e.target.checked })}
                                        className="accent-brand-orange"
                                        aria-label="Activer le mode calme"
                                    />
                                    Mode calme
                                </label>
                            </div>

                            <div className="grid grid-cols-3 md:flex md:items-center md:justify-start gap-4 md:gap-5">
                                {SOUNDS.map(sound => (
                                    <button
                                        key={sound.id}
                                        onClick={() => handleSoundToggle(sound.id)}
                                        className={`flex flex-col items-center gap-2 group transition-all ${currentSoundId === sound.id ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
                                        aria-label={`Activer le son ${sound.label}`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                                            currentSoundId === sound.id && isAmbientPlaying
                                            ? 'border-brand-orange bg-brand-orange/20 text-brand-orange'
                                            : 'border-slate-700 bg-slate-800 text-slate-300 group-hover:border-slate-500'
                                        }`}>
                                            <sound.icon size={20} className={currentSoundId === sound.id && isAmbientPlaying && !prefersReducedMotion ? 'animate-pulse' : ''} />
                                        </div>
                                        <span className="text-xs font-medium tracking-wide text-slate-300">{sound.label}</span>
                                    </button>
                                ))}
                            </div>

                            {currentSoundId && (
                                <div className="w-56 md:w-64 mt-4 flex items-center gap-3 text-slate-400">
                                    <Volume2 size={16} />
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={ambientVolume}
                                        onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-orange"
                                        aria-label="Régler le volume d'ambiance"
                                    />
                                </div>
                            )}
                        </section>

                        <details className="mt-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl" open={showAdvanced}>
                            <summary
                                className="cursor-pointer list-none text-xs uppercase tracking-widest text-slate-400 font-bold"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowAdvanced((prev) => !prev);
                                }}
                            >
                                {showAdvanced ? 'Masquer mode avance' : 'Afficher mode avance (stats et taches)'}
                            </summary>

                            {showAdvanced && (
                                <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Projet et tache lies</div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <select
                                                value={linkedProjectId || ''}
                                                onChange={(e) => setLinkedTask(e.target.value || undefined, undefined)}
                                                className="w-full rounded-xl bg-slate-800 border border-slate-700 text-sm px-3 py-2 text-slate-200"
                                            >
                                                <option value="">Aucun projet lie</option>
                                                {activeProjects.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.clientName}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={linkedTaskId || ''}
                                                onChange={(e) => setLinkedTask(linkedProjectId, e.target.value || undefined)}
                                                disabled={!linkedProjectId}
                                                className="w-full rounded-xl bg-slate-800 border border-slate-700 text-sm px-3 py-2 text-slate-200 disabled:opacity-50"
                                            >
                                                <option value="">Aucune tache liee</option>
                                                {selectableTasks.map((t) => (
                                                    <option key={t.id} value={t.id}>{t.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <textarea
                                            value={resultSummary}
                                            onChange={(e) => setResultSummary(e.target.value)}
                                            rows={3}
                                            placeholder="Bilan de session (optionnel)"
                                            className="mt-3 w-full rounded-2xl bg-slate-800/80 border border-slate-700 text-sm p-3 text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/20 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Stats 7 jours</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-2.5">
                                                <div className="text-slate-500">Sessions</div>
                                                <div className="text-slate-100 text-base font-bold">{weeklyMetrics.sessions}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-2.5">
                                                <div className="text-slate-500">Minutes</div>
                                                <div className="text-slate-100 text-base font-bold">{weeklyMetrics.totalMinutes}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-2.5">
                                                <div className="text-slate-500">Completion</div>
                                                <div className="text-slate-100 text-base font-bold">{weeklyMetrics.completionRate}%</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-2.5">
                                                <div className="text-slate-500">Interruptions</div>
                                                <div className="text-slate-100 text-base font-bold">{weeklyMetrics.interruptions}</div>
                                            </div>
                                        </div>
                                        {recentSessions.length > 0 && (
                                            <div className="mt-3 space-y-1.5">
                                                {recentSessions.map((s) => (
                                                    <div key={s.id} className="rounded-lg border border-slate-700/70 bg-slate-800/60 px-2.5 py-2">
                                                        <div className="text-xs text-slate-200 truncate">{s.objective || 'Session focus'}</div>
                                                        <div className="text-[11px] text-slate-500">{s.actualMinutes} min • {new Date(s.startedAt).toLocaleDateString('fr-CH')}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </details>
                    </div>
                </div>
            </div>

            <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-900/90 backdrop-blur-xl pb-[max(10px,env(safe-area-inset-bottom))] pt-3">
                <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-3 md:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handlePrimaryAction}
                            disabled={!canStart && (focusState === 'idle' || focusState === 'completed')}
                            className="px-4 py-2 rounded-xl bg-eonora-gradient text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {primaryIcon}
                            {primaryLabel}
                        </button>
                        <button
                            onClick={resetSession}
                            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:text-white text-sm flex items-center gap-2 transition-colors"
                        >
                            <RotateCcw size={15} />
                            Réinitialiser
                        </button>
                        {focusState !== 'idle' && focusState !== 'completed' && (
                            <button
                                onClick={() => completeSession(resultSummary)}
                                className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 text-sm flex items-center gap-2 transition-colors"
                            >
                                <CheckCircle2 size={15} />
                                Terminer
                            </button>
                        )}
                        {focusState === 'completed' && linkedProjectId && linkedTaskId && (
                            <button
                                onClick={handleMarkLinkedTaskDone}
                                disabled={saveProjectMutation.isPending}
                                className="px-3.5 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:text-blue-200 text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle2 size={15} />
                                {saveProjectMutation.isPending ? 'Validation...' : 'Marquer tâche faite'}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleExitFocus}
                        className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 transition-all text-sm font-semibold text-slate-200 hover:text-white"
                    >
                        <X size={16} className={!prefersReducedMotion ? 'group-hover:rotate-90 transition-transform' : ''} />
                        Quitter le mode Focus
                    </button>
                </div>
            </footer>

            {/* Zen Chat Button */}
            {!showChat && (
                <button 
                    onClick={() => setShowChat(true)}
                    className={`absolute right-4 bottom-20 md:right-8 md:bottom-24 flex items-center gap-3 px-5 py-3 md:px-6 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold backdrop-blur-sm transition-all border border-white/5 hover:border-white/20 shadow-lg z-20 ${prefersReducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-4'}`}
                >
                    <MessageCircle size={18} className="text-brand-orange" /> <span className="hidden sm:inline">Discuter avec Franck</span><span className="sm:hidden">Franck</span>
                </button>
            )}

            {/* Coach Franck Chat Window */}
            {showChat && (
                <div className="absolute inset-0 md:inset-auto md:bottom-8 md:right-8 md:w-[420px] md:h-[550px] bg-slate-900 border-0 md:border md:border-slate-700/50 md:rounded-3xl flex flex-col overflow-hidden shadow-2xl shadow-black/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 z-20">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-gradient-to-r from-[#7C9A7E]/10 to-[#2aada0]/10">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-2xl bg-eonora-gradient flex items-center justify-center text-white font-serif text-lg shadow-lg shadow-[#4a72c4]/30">
                                    F
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-800"></div>
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white flex items-center gap-2">
                                    Coach Franck
                                    <Sparkles size={12} className="text-orange-400" />
                                </div>
                                <div className="text-[10px] text-slate-400">Mode Focus • Coaching actif</div>
                            </div>
                        </div>
                        <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                        {chatHistory.length === 0 && (
                            <div className="space-y-6 pt-4">
                                {/* Welcome Message */}
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-eonora-gradient flex items-center justify-center text-white font-serif text-sm shrink-0 mt-1">F</div>
                                    <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-slate-700/50 text-sm text-slate-200 leading-relaxed">
                                        <p className="mb-2">Hey ! 🎯</p>
                                        <p className="mb-2">On prend ce moment en douceur. Je peux t'aider a te calmer, clarifier une priorite, ou retrouver de l'elan.</p>
                                        <p className="text-slate-400 text-xs">Dis-moi ce que tu ressens ou choisis un sujet ci-dessous.</p>
                                    </div>
                                </div>
                                
                                {/* Quick Prompts */}
                                <div className="flex flex-wrap gap-2 pl-11">
                                    {COACH_PROMPTS.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSendMessage(item.prompt)}
                                            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-orange-500/50 rounded-xl text-xs text-slate-300 hover:text-white transition-all group"
                                        >
                                            <item.icon size={14} className="text-orange-400 group-hover:scale-110 transition-transform" />
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                {msg.role === 'model' && (
                                    <div className="w-8 h-8 rounded-xl bg-eonora-gradient flex items-center justify-center text-white font-serif text-sm shrink-0 mt-1">F</div>
                                )}
                                <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                    ? 'bg-eonora-gradient text-white rounded-br-none shadow-lg shadow-[#4a72c4]/20' 
                                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        
                        {isTyping && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-xl bg-eonora-gradient flex items-center justify-center text-white font-serif text-sm shrink-0">F</div>
                                <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1.5 border border-slate-700/50">
                                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-slate-700/50 bg-slate-900">
                        <div className="relative">
                            <input 
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-4 pr-12 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500/50 focus:bg-slate-750 transition-all"
                                placeholder="Qu'est-ce qui te préoccupe ?"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(chatInput)}
                                autoFocus
                            />
                            <button 
                                onClick={() => handleSendMessage(chatInput)}
                                disabled={!chatInput.trim() || isTyping}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-eonora-gradient rounded-xl text-white hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 shadow-lg shadow-[#4a72c4]/20"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};