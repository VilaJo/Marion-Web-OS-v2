import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LiveCue {
    cue: string;
    rationale?: string;
    priority?: 'low' | 'medium' | 'high';
}

interface CoachingCardProps {
    cues: LiveCue[];
    loading?: boolean;
}

const PRIORITY_STYLE: Record<string, string> = {
    high: 'text-rose-300 border-rose-400/40 bg-rose-500/10',
    medium: 'text-amber-200 border-amber-400/40 bg-amber-500/10',
    low: 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10',
};

export const CoachingCard: React.FC<CoachingCardProps> = ({ cues, loading }) => {
    const topCue = cues[0];
    return (
        <div className="rounded-2xl border border-white/60 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 backdrop-blur-sm p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Coach live</p>
                {loading ? <Loader2 size={14} className="animate-spin text-slate-500 dark:text-slate-400" /> : null}
            </div>
            {!topCue ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">En attente de signaux utiles...</p>
            ) : (
                <div className="space-y-2">
                    <div
                        className={[
                            'inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold',
                            PRIORITY_STYLE[topCue.priority || 'medium'] || PRIORITY_STYLE.medium,
                        ].join(' ')}
                    >
                        Priorite {(topCue.priority || 'medium').toUpperCase()}
                    </div>
                    <p className="text-slate-800 dark:text-slate-100 font-medium">{topCue.cue}</p>
                    {topCue.rationale ? <p className="text-xs text-slate-500 dark:text-slate-400">{topCue.rationale}</p> : null}
                    {cues.length > 1 ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-500">+ {cues.length - 1} autre(s) suggestion(s)</p>
                    ) : null}
                </div>
            )}
        </div>
    );
};

