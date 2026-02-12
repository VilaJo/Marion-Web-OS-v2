/**
 * Offline Store - Online/offline detection and mutation queue
 *
 * When the app goes offline, POST/PUT/DELETE mutations are queued
 * in localStorage and replayed automatically when connectivity returns.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedMutation {
    id: string;
    url: string;
    method: string;
    body: string;
    headers?: Record<string, string>;
    timestamp: number;
    retries: number;
    description: string;
}

interface OfflineState {
    isOnline: boolean;
    queue: QueuedMutation[];
    isSyncing: boolean;

    setOnline: (online: boolean) => void;
    enqueue: (mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>) => void;
    dequeue: (id: string) => void;
    processQueue: () => Promise<void>;
    clearQueue: () => void;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'marion_offline_queue';
const MAX_RETRIES = 3;

const loadQueue = (): QueuedMutation[] => {
    try {
        const saved = localStorage.getItem(QUEUE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch { /* ignore */ }
    return [];
};

const persistQueue = (queue: QueuedMutation[]) => {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch { /* ignore */ }
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOfflineStore = create<OfflineState>((set, get) => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    queue: loadQueue(),
    isSyncing: false,

    setOnline: (online) => set({ isOnline: online }),

    enqueue: (mutation) => {
        const entry: QueuedMutation = {
            ...mutation,
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            retries: 0,
        };
        const newQueue = [...get().queue, entry];
        set({ queue: newQueue });
        persistQueue(newQueue);
    },

    dequeue: (id) => {
        const newQueue = get().queue.filter(q => q.id !== id);
        set({ queue: newQueue });
        persistQueue(newQueue);
    },

    processQueue: async () => {
        const { queue, isSyncing } = get();
        if (isSyncing || queue.length === 0) return;

        set({ isSyncing: true });

        const remaining: QueuedMutation[] = [];

        for (const mutation of queue) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...(mutation.headers || {}),
                };
                // Re-inject current auth token
                const token = sessionStorage.getItem('marion_token');
                if (token) headers['X-Marion-Token'] = token;

                const response = await fetch(mutation.url, {
                    method: mutation.method,
                    headers,
                    body: mutation.body || undefined,
                });

                if (!response.ok && mutation.retries < MAX_RETRIES) {
                    remaining.push({ ...mutation, retries: mutation.retries + 1 });
                }
                // If ok or max retries exceeded, drop it
            } catch {
                // Network still down or other error — keep in queue
                if (mutation.retries < MAX_RETRIES) {
                    remaining.push({ ...mutation, retries: mutation.retries + 1 });
                }
            }
        }

        set({ queue: remaining, isSyncing: false });
        persistQueue(remaining);
    },

    clearQueue: () => {
        set({ queue: [] });
        persistQueue([]);
    },
}));
