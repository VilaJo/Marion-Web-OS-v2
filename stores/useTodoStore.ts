/**
 * Todo Store - Daily to-do list shared across Dashboard widget & TodoPanel
 *
 * Keys: marion_daily_todos, marion_daily_todos_date
 * On a new day, completed tasks are cleared; open ones carry over.
 */

import { create } from 'zustand';

export type TodoCategory = 'Client' | 'Finance' | 'Perso';

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

function readFromStorage(): DailyTodo[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        const savedDate = localStorage.getItem(DATE_KEY);
        if (savedDate === todayIso()) return parsed as DailyTodo[];
        // New day: keep unfinished tasks only
        return (parsed as DailyTodo[]).filter((t) => !t.done);
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
            category: todo.category ?? 'Perso',
        };
        const todos = [...get().todos, next];
        persist(todos);
        set({ todos });
        return id;
    },

    updateTodo: (id, patch) => {
        const todos = get().todos.map((t) => (t.id === id ? { ...t, ...patch } : t));
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
}));
