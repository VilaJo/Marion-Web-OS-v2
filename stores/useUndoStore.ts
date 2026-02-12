/**
 * Undo Store - Toast-based undo for destructive actions
 *
 * When a destructive action is performed (delete task, invoice, note, etc.),
 * an entry is pushed with a restore callback. A toast is shown for 5 seconds.
 * If the user clicks "Annuler", the restore callback is executed.
 * If the toast expires, the entry is discarded.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndoEntry {
    id: string;
    description: string;
    restore: () => Promise<void> | void;
    expiresAt: number;
}

interface UndoState {
    entries: UndoEntry[];
    pushUndo: (entry: Omit<UndoEntry, 'id' | 'expiresAt'>) => void;
    executeUndo: (id: string) => Promise<void>;
    undoLast: () => Promise<void>;
    dismissEntry: (id: string) => void;
    clearExpired: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNDO_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUndoStore = create<UndoState>((set, get) => ({
    entries: [],

    pushUndo: (entry) => {
        const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newEntry: UndoEntry = {
            ...entry,
            id,
            expiresAt: Date.now() + UNDO_TIMEOUT_MS,
        };

        set(state => ({
            entries: [...state.entries, newEntry],
        }));

        // Auto-dismiss after timeout
        setTimeout(() => {
            set(state => ({
                entries: state.entries.filter(e => e.id !== id),
            }));
        }, UNDO_TIMEOUT_MS);
    },

    executeUndo: async (id) => {
        const entry = get().entries.find(e => e.id === id);
        if (!entry) return;

        // Remove from list immediately
        set(state => ({
            entries: state.entries.filter(e => e.id !== id),
        }));

        // Execute restore
        await entry.restore();
    },

    undoLast: async () => {
        const { entries, executeUndo } = get();
        if (entries.length === 0) return;
        const last = entries[entries.length - 1];
        await executeUndo(last.id);
    },

    dismissEntry: (id) => {
        set(state => ({
            entries: state.entries.filter(e => e.id !== id),
        }));
    },

    clearExpired: () => {
        const now = Date.now();
        set(state => ({
            entries: state.entries.filter(e => e.expiresAt > now),
        }));
    },
}));
