/**
 * UndoToast - Shows undo toasts for destructive actions
 *
 * Renders at the bottom-left of the screen, stacked.
 * Each toast has a countdown bar and an "Annuler" button.
 */

import React, { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { useUndoStore } from '../stores/useUndoStore';

const UNDO_DURATION = 5000;

const UndoToastItem: React.FC<{
    id: string;
    description: string;
    expiresAt: number;
}> = ({ id, description, expiresAt }) => {
    const executeUndo = useUndoStore((s) => s.executeUndo);
    const dismissEntry = useUndoStore((s) => s.dismissEntry);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = expiresAt - Date.now();
            const pct = Math.max(0, (remaining / UNDO_DURATION) * 100);
            setProgress(pct);
            if (pct <= 0) clearInterval(interval);
        }, 50);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return (
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 min-w-[300px] max-w-[400px]">
            <div className="flex items-center gap-3 px-4 py-3">
                <Undo2 size={16} className="text-amber-400 flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{description}</span>
                <button
                    onClick={() => executeUndo(id)}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 uppercase tracking-wide px-2 py-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                >
                    Annuler
                </button>
                <button
                    onClick={() => dismissEntry(id)}
                    className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                >
                    <X size={14} />
                </button>
            </div>
            {/* Countdown bar */}
            <div className="h-0.5 bg-slate-700">
                <div
                    className="h-full bg-amber-400 transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export const UndoToastContainer: React.FC = () => {
    const entries = useUndoStore((s) => s.entries);

    if (entries.length === 0) return null;

    return (
        <div
            className="fixed bottom-6 left-6 z-[9998] flex flex-col gap-2"
            role="status"
            aria-live="polite"
        >
            {entries.map((entry) => (
                <UndoToastItem
                    key={entry.id}
                    id={entry.id}
                    description={entry.description}
                    expiresAt={entry.expiresAt}
                />
            ))}
        </div>
    );
};
