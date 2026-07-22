import React from 'react';

export type MeetingStage = 'pre' | 'in' | 'post';

interface StatusRailProps {
    stage: MeetingStage;
}

const STEPS: Array<{ id: MeetingStage; label: string }> = [
    { id: 'pre', label: 'Pre-call' },
    { id: 'in', label: 'In-call' },
    { id: 'post', label: 'Post-call' },
];

export const StatusRail: React.FC<StatusRailProps> = ({ stage }) => {
    const activeIdx = STEPS.findIndex((s) => s.id === stage);

    return (
        <div className="flex items-center gap-3" aria-label="Meeting progress">
            {STEPS.map((step, idx) => {
                const isActive = idx === activeIdx;
                const isDone = idx < activeIdx;
                return (
                    <div key={step.id} className="flex items-center gap-3">
                        <div
                            className={[
                                'h-7 min-w-[98px] rounded-full px-3 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center',
                                isActive
                                    ? 'bg-eonora-gradient text-white shadow-sm'
                                    : isDone
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
                                        : 'bg-white/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
                            ].join(' ')}
                        >
                            {step.label}
                        </div>
                        {idx < STEPS.length - 1 ? <div className="w-6 h-px bg-slate-300 dark:bg-slate-700" /> : null}
                    </div>
                );
            })}
        </div>
    );
};

