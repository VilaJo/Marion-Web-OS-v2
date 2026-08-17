/**
 * Todo Store - Daily to-do list shared across Dashboard widget & TodoPanel
 *
 * Keys: marion_daily_todos, marion_daily_todos_date
 * On a new day, completed tasks are cleared; open ones carry over.
 * Calendar-linked todos (id cal-*) are refreshed from today's events.
 */

import { create } from 'zustand';
import { CalendarEvent } from '../types';
import {
    buildCalendarTodosForDay,
    isCalendarLinkedTodoId,
    migrateLegacyTodoCategory,
    TODO_CATEGORIES,
} from '../utils/todoCalendarSync';

export type TodoCategory = 'Rendez-vous' | 'Client' | 'Deadlines' | 'Facturation' | 'Perso';

export interface DailyTodo {
    id: string;
    text: string;
    done: boolean;
    remindAt?: string;
    category?: TodoCategory;
}

const STORAGE_KEY = 'marion_daily_todos';
const DATE_KEY = 'marion_daily_todos_date';

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function normalizeTodo(t: DailyTodo): DailyTodo {
    return {
        ...t,
        category: migrateLegacyTodoCategory(t.category) as TodoCategory | undefined,
    };
}

function readFromStorage(): DailyTodo[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        const savedDate = localStorage.getItem(DATE_KEY);
        const list = (parsed as DailyTodo[]).map(normalizeTodo);
        if (savedDate === todayIso()) return list;
        // New day: keep unfinished manual tasks; drop calendar-linked (re-synced)
        return list.filter((t) => !t.done && !isCalendarLinkedTodoId(t.id));
    } catch {
        return [];
    }
}

function persist(todos: DailyTodo[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        localStorage.setItem(DATE_KEY, todayIso());
    } catch {
        /* ignore quota / private mode */
    }
}

interface TodoState {
    todos: DailyTodo[];
    addTodo: (todo: Omit<DailyTodo, 'id'> & { id?: string }) => string;
    updateTodo: (id: string, patch: Partial<Omit<DailyTodo, 'id'>>) => void;
    removeTodo: (id: string) => void;
    toggleTodo: (id: string) => void;
    loadFromStorage: () => void;
    /** Merge today's calendar events into the todo list (upsert cal-* entries). */
    syncFromCalendar: (events: CalendarEvent[], day?: string) => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
    todos: readFromStorage(),

    addTodo: (todo) => {
        const id = todo.id || `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const next: DailyTodo = {
            id,
            text: todo.text,
            done: todo.done ?? false,
            remindAt: todo.remindAt,
            category: (migrateLegacyTodoCategory(todo.category) as TodoCategory) ?? 'Perso',
        };
        const existing = get().todos.find((t) => t.id === id);
        const todos = existing
            ? get().todos.map((t) => (t.id === id ? { ...t, text: next.text, category: next.category, remindAt: next.remindAt } : t))
            : [...get().todos, next];
        persist(todos);
        set({ todos });
        return id;
    },

    updateTodo: (id, patch) => {
        const todos = get().todos.map((t) =>
            t.id === id
                ? {
                      ...t,
                      ...patch,
                      category: patch.category
                          ? (migrateLegacyTodoCategory(patch.category) as TodoCategory)
                          : t.category,
                  }
                : t,
        );
        persist(todos);
        set({ todos });
    },

    removeTodo: (id) => {
        const todos = get().todos.filter((t) => t.id !== id);
        persist(todos);
        set({ todos });
    },

    toggleTodo: (id) => {
        const todos = get().todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
        persist(todos);
        set({ todos });
    },

    loadFromStorage: () => {
        set({ todos: readFromStorage() });
    },

    syncFromCalendar: (events, day = todayIso()) => {
        const fromCal = buildCalendarTodosForDay(events, day);
        const desiredIds = new Set(fromCal.map((t) => t.id));
        const current = get().todos;

        const keptManual = current.filter((t) => !isCalendarLinkedTodoId(t.id));
        const keptCalDone = current.filter(
            (t) => isCalendarLinkedTodoId(t.id) && t.done && desiredIds.has(t.id),
        );
        const doneMap = new Map(keptCalDone.map((t) => [t.id, t]));

        const upserted = fromCal.map((t) => {
            const prev = doneMap.get(t.id) || current.find((c) => c.id === t.id);
            return {
                id: t.id,
                text: t.text,
                category: t.category,
                remindAt: t.remindAt,
                done: prev?.done ?? false,
            } as DailyTodo;
        });

        // Preserve order: calendar blocks first (by time), then manual
        const todos = [...upserted, ...keptManual];
        persist(todos);
        set({ todos });
    },
}));

export { TODO_CATEGORIES };
