/**
 * Focus Store - Focus session engine, persistence and metrics.
 */

import { create } from 'zustand';
import { FocusPhase, FocusSession, FocusSessionState, FocusSettings } from '../types';

const SETTINGS_KEY = 'marion_focus_settings';
const HISTORY_KEY = 'marion_focus_history';

const defaultSettings: FocusSettings = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartNextPhase: false,
    muteToastsDuringFocus: true,
    calmMode: true,
};

const loadSettings = (): FocusSettings => {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return defaultSettings;
        return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {
        return defaultSettings;
    }
};

const loadHistory = (): FocusSession[] => {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const persistSettings = (settings: FocusSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const persistHistory = (history: FocusSession[]) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
};

let timerRef: ReturnType<typeof setInterval> | null = null;

interface StartSessionPayload {
    objective: string;
    plannedMinutes?: number;
    linkedTaskId?: string;
    linkedProjectId?: string;
}

interface FocusState {
    state: FocusSessionState;
    phase: FocusPhase;
    settings: FocusSettings;
    history: FocusSession[];

    sessionId: string | null;
    objective: string;
    resultSummary: string;
    linkedTaskId?: string;
    linkedProjectId?: string;

    plannedMinutes: number;
    phaseTotalSeconds: number;
    remainingSeconds: number;
    runStartedAtMs: number | null;
    runStartedRemainingSeconds: number;
    startedAtIso: string | null;
    interruptionCount: number;
    focusCount: number;

    startSession: (payload: StartSessionPayload) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    resetSession: () => void;
    completeSession: (resultSummary?: string) => void;
    startNextFocusCycle: () => void;
    setResultSummary: (text: string) => void;
    setObjective: (text: string) => void;
    setLinkedTask: (projectId?: string, taskId?: string) => void;
    setSettings: (partial: Partial<FocusSettings>) => void;
    tick: () => void;
    getWeeklyMetrics: () => {
        sessions: number;
        totalMinutes: number;
        completionRate: number;
        interruptions: number;
    };
}

const stopTimer = () => {
    if (timerRef) {
        clearInterval(timerRef);
        timerRef = null;
    }
};

const phaseSeconds = (phase: FocusPhase, settings: FocusSettings) => {
    if (phase === 'short_break') return settings.shortBreakMinutes * 60;
    if (phase === 'long_break') return settings.longBreakMinutes * 60;
    return settings.focusMinutes * 60;
};

const nowIso = () => new Date().toISOString();

export const useFocusStore = create<FocusState>((set, get) => ({
    state: 'idle',
    phase: 'focus',
    settings: loadSettings(),
    history: loadHistory(),

    sessionId: null,
    objective: '',
    resultSummary: '',
    linkedTaskId: undefined,
    linkedProjectId: undefined,

    plannedMinutes: loadSettings().focusMinutes,
    phaseTotalSeconds: loadSettings().focusMinutes * 60,
    remainingSeconds: loadSettings().focusMinutes * 60,
    runStartedAtMs: null,
    runStartedRemainingSeconds: loadSettings().focusMinutes * 60,
    startedAtIso: null,
    interruptionCount: 0,
    focusCount: 0,

    startSession: ({ objective, plannedMinutes, linkedTaskId, linkedProjectId }) => {
        const settings = get().settings;
        const minutes = plannedMinutes || settings.focusMinutes;
        const total = minutes * 60;
        stopTimer();
        const sessionId = `focus-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set({
            state: 'running',
            phase: 'focus',
            sessionId,
            objective: objective.trim(),
            resultSummary: '',
            linkedTaskId,
            linkedProjectId,
            plannedMinutes: minutes,
            phaseTotalSeconds: total,
            remainingSeconds: total,
            runStartedAtMs: Date.now(),
            runStartedRemainingSeconds: total,
            startedAtIso: nowIso(),
            interruptionCount: 0,
        });
        timerRef = setInterval(() => get().tick(), 1000);
    },

    pauseSession: () => {
        const st = get();
        if (st.state !== 'running' && !(st.state === 'break' && st.runStartedAtMs != null)) return;
        const elapsed = st.runStartedAtMs ? Math.floor((Date.now() - st.runStartedAtMs) / 1000) : 0;
        const remaining = Math.max(0, st.runStartedRemainingSeconds - elapsed);
        stopTimer();
        set({
            state: st.phase === 'focus' ? 'paused' : 'break',
            remainingSeconds: remaining,
            runStartedAtMs: null,
            runStartedRemainingSeconds: remaining,
            interruptionCount: st.interruptionCount + (st.phase === 'focus' ? 1 : 0),
        });
    },

    resumeSession: () => {
        const st = get();
        if (st.state !== 'paused' && st.state !== 'break') return;
        set({
            state: st.phase === 'focus' ? 'running' : 'break',
            runStartedAtMs: Date.now(),
            runStartedRemainingSeconds: st.remainingSeconds,
        });
        stopTimer();
        timerRef = setInterval(() => get().tick(), 1000);
    },

    resetSession: () => {
        stopTimer();
        const settings = get().settings;
        const total = settings.focusMinutes * 60;
        set({
            state: 'idle',
            phase: 'focus',
            sessionId: null,
            objective: '',
            resultSummary: '',
            linkedTaskId: undefined,
            linkedProjectId: undefined,
            plannedMinutes: settings.focusMinutes,
            phaseTotalSeconds: total,
            remainingSeconds: total,
            runStartedAtMs: null,
            runStartedRemainingSeconds: total,
            startedAtIso: null,
            interruptionCount: 0,
        });
    },

    completeSession: (resultSummary = '') => {
        const st = get();
        stopTimer();

        if (st.phase === 'focus' && st.startedAtIso && st.sessionId) {
            const elapsedSec = Math.max(0, st.phaseTotalSeconds - st.remainingSeconds);
            const completed: FocusSession = {
                id: st.sessionId,
                startedAt: st.startedAtIso,
                endedAt: nowIso(),
                plannedMinutes: st.plannedMinutes,
                actualMinutes: Math.max(1, Math.round(elapsedSec / 60)),
                objective: st.objective,
                resultSummary: resultSummary || st.resultSummary || '',
                state: 'completed',
                linkedTaskId: st.linkedTaskId,
                linkedProjectId: st.linkedProjectId,
                interruptionCount: st.interruptionCount,
            };
            const history = [completed, ...st.history].slice(0, 200);
            persistHistory(history);

            set({
                history,
                state: 'completed',
                resultSummary: completed.resultSummary,
                runStartedAtMs: null,
            });
            return;
        }

        set({ state: 'completed', runStartedAtMs: null });
    },

    startNextFocusCycle: () => {
        const st = get();
        const total = st.settings.focusMinutes * 60;
        set({
            state: 'running',
            phase: 'focus',
            plannedMinutes: st.settings.focusMinutes,
            phaseTotalSeconds: total,
            remainingSeconds: total,
            runStartedAtMs: Date.now(),
            runStartedRemainingSeconds: total,
            sessionId: `focus-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            startedAtIso: nowIso(),
            interruptionCount: 0,
            resultSummary: '',
        });
        stopTimer();
        timerRef = setInterval(() => get().tick(), 1000);
    },

    setResultSummary: (text) => set({ resultSummary: text }),
    setObjective: (text) => set({ objective: text }),
    setLinkedTask: (projectId, taskId) => set({ linkedProjectId: projectId, linkedTaskId: taskId }),

    setSettings: (partial) => {
        const next = { ...get().settings, ...partial };
        persistSettings(next);
        const st = get();
        if (st.state === 'idle' || st.state === 'completed') {
            const nextSeconds = phaseSeconds(st.phase, next);
            set({
                settings: next,
                plannedMinutes: st.phase === 'focus' ? next.focusMinutes : st.plannedMinutes,
                phaseTotalSeconds: nextSeconds,
                remainingSeconds: nextSeconds,
                runStartedRemainingSeconds: nextSeconds,
            });
            return;
        }
        set({ settings: next });
    },

    tick: () => {
        const st = get();
        if (st.runStartedAtMs == null) return;

        const elapsed = Math.floor((Date.now() - st.runStartedAtMs) / 1000);
        const remaining = Math.max(0, st.runStartedRemainingSeconds - elapsed);

        if (remaining > 0) {
            set({ remainingSeconds: remaining });
            return;
        }

        // Phase done
        if (st.phase === 'focus') {
            // Save completed session first
            const elapsedSec = st.phaseTotalSeconds;
            const completed: FocusSession = {
                id: st.sessionId || `focus-${Date.now()}`,
                startedAt: st.startedAtIso || nowIso(),
                endedAt: nowIso(),
                plannedMinutes: st.plannedMinutes,
                actualMinutes: Math.max(1, Math.round(elapsedSec / 60)),
                objective: st.objective,
                resultSummary: st.resultSummary || '',
                state: 'completed',
                linkedTaskId: st.linkedTaskId,
                linkedProjectId: st.linkedProjectId,
                interruptionCount: st.interruptionCount,
            };
            const history = [completed, ...st.history].slice(0, 200);
            persistHistory(history);

            const nextFocusCount = st.focusCount + 1;
            const isLongBreak = nextFocusCount % Math.max(1, st.settings.longBreakEvery) === 0;
            const nextPhase: FocusPhase = isLongBreak ? 'long_break' : 'short_break';
            const nextSeconds = phaseSeconds(nextPhase, st.settings);

            set({
                history,
                focusCount: nextFocusCount,
                phase: nextPhase,
                state: 'break',
                phaseTotalSeconds: nextSeconds,
                remainingSeconds: nextSeconds,
                runStartedAtMs: st.settings.autoStartNextPhase ? Date.now() : null,
                runStartedRemainingSeconds: nextSeconds,
            });

            if (st.settings.autoStartNextPhase) {
                stopTimer();
                timerRef = setInterval(() => get().tick(), 1000);
            } else {
                stopTimer();
            }
            return;
        }

        // Break finished -> next focus cycle
        const nextFocusSeconds = st.settings.focusMinutes * 60;
        set({
            phase: 'focus',
            state: st.settings.autoStartNextPhase ? 'running' : 'idle',
            plannedMinutes: st.settings.focusMinutes,
            phaseTotalSeconds: nextFocusSeconds,
            remainingSeconds: nextFocusSeconds,
            runStartedAtMs: st.settings.autoStartNextPhase ? Date.now() : null,
            runStartedRemainingSeconds: nextFocusSeconds,
            sessionId: st.settings.autoStartNextPhase ? `focus-${Date.now()}-${Math.random().toString(36).slice(2)}` : null,
            startedAtIso: st.settings.autoStartNextPhase ? nowIso() : null,
            interruptionCount: 0,
            resultSummary: '',
        });
        if (!st.settings.autoStartNextPhase) stopTimer();
    },

    getWeeklyMetrics: () => {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekly = get().history.filter((h) => new Date(h.startedAt).getTime() >= weekAgo);
        const sessions = weekly.length;
        const totalMinutes = weekly.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
        const interruptions = weekly.reduce((acc, s) => acc + (s.interruptionCount || 0), 0);
        const completionRate = sessions === 0
            ? 0
            : Math.round((weekly.filter(s => (s.actualMinutes || 0) >= Math.max(1, (s.plannedMinutes || 0) * 0.7)).length / sessions) * 100);

        return { sessions, totalMinutes, completionRate, interruptions };
    },
}));

