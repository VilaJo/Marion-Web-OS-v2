import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';

export interface LiveCue {
    cue: string;
    rationale?: string;
    priority?: 'low' | 'medium' | 'high';
}

interface CoachingCardProps {
    cues: LiveCue[];
    loading?: boolean;
    silenceDetected?: boolean;
}

const PRIORITY_STYLE: Record<string, string> = {
    high: 'text-rose-600 dark:text-rose-300 border-rose-400/40 bg-rose-500/10',
    medium: 'text-amber-600 dark:text-amber-200 border-amber-400/40 bg-amber-500/10',
    low: 'text-emerald-600 dark:text-emerald-200 border-emerald-400/40 bg-emerald-500/10',
};

const PRIORITY_LABEL: Record<string, string> = {
    high: 'URGENT',
    medium: 'NORMAL',
    low: 'INFO',
};

export const CoachingCard: React.FC<CoachingCardProps> = ({ cues, loading, silenceDetected }) => {
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());

    const visibleCues = cues.filter((_, i) => !dismissed.has(i));

    const dismiss = (idx: number) => {
        setDismissed((prev) => new Set([...prev, idx]));
    };

    // Reset dismissed when cues list changes (new coaching response)
    React.useEffect(() => {
        setDismissed(new Set());
    }, [cues.length]);

    return (
        <div className="rounded-2xl border border-white/60 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 backdrop-blur-sm p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Coach live</p>
                {loading && <Loader2 size={14} className="animate-spin text-slate-500 dark:text-slate-400" />}
            </div>

            {silenceDetected && (
                <div className="mb-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse flex-shrink-0" />
                    Silence détecté — pensez à relancer
                </div>
            )}

            {visibleCues.length === 0 && !silenceDetected ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">En attente de signaux utiles...</p>
            ) : (
                <div className="space-y-2">
                    {visibleCues.map((cue, idx) => {
                        const originalIdx = cues.indexOf(cue);
                        return (
                            <div
                                key={originalIdx}
                                className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 relative"
                            >
                                <button
                                    onClick={() => dismiss(originalIdx)}
                                    className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
                                    aria-label="Ignorer"
                                >
                                    <X size={12} />
                                </button>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span
                                        className={[
                                            'inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold',
                                            PRIORITY_STYLE[cue.priority || 'medium'],
                                        ].join(' ')}
                                    >
                                        {PRIORITY_LABEL[cue.priority || 'medium']}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-800 dark:text-slate-100 font-medium pr-5">{cue.cue}</p>
                                {cue.rationale && (
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{cue.rationale}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
