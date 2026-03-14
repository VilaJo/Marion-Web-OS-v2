import React from 'react';

interface TranscriptTimelineProps {
    segments: string[];
}

export const TranscriptTimeline: React.FC<TranscriptTimelineProps> = ({ segments }) => {
    if (!segments.length) {
        return (
            <div className="rounded-2xl border border-white/60 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 backdrop-blur-sm p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Transcript timeline</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Les segments de transcription apparaitront ici.</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/60 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 backdrop-blur-sm p-4 max-h-56 overflow-y-auto">
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Transcript timeline</p>
            <div className="space-y-2">
                {segments.slice(-10).map((segment, idx) => (
                    <div key={`${segment}-${idx}`} className="rounded-lg border border-slate-200 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/50 p-2">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Segment {Math.max(1, segments.length - 9 + idx)}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{segment}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

