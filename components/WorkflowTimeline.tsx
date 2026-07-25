/**
 * WorkflowTimeline - Linear/Eonora stepper for project phase progression.
 *
 * Used in:
 *   - ClientPortal.tsx (admin preview, compact mode)
 *   - PortalPublicPage.tsx (client-facing, full mode)
 */

import React from 'react';
import { WorkflowPhase } from '../types';
import { WORKFLOW_CONFIG } from '../constants';
import { Check } from 'lucide-react';

const PHASES = Object.values(WorkflowPhase);

interface WorkflowTimelineProps {
    currentPhase: WorkflowPhase;
    compact?: boolean;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ currentPhase, compact = false }) => {
    const currentIdx = PHASES.indexOf(currentPhase);
    const progressPercent = Math.round(((currentIdx + 1) / PHASES.length) * 100);

    const nodeSize = compact ? 'w-7 h-7' : 'w-8 h-8';
    const iconSize = compact ? 12 : 14;
    const checkSize = compact ? 10 : 12;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3">
                <span className={`font-semibold uppercase tracking-widest text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                    Avancement du projet
                </span>
                <span className={`font-medium tabular-nums text-slate-500 ${compact ? 'text-xs' : 'text-sm'}`}>
                    {progressPercent}%
                </span>
            </div>

            <div className={`bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ${compact ? 'h-1 mb-4' : 'h-1 mb-6'}`}>
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${progressPercent}%`,
                        background: 'linear-gradient(120deg, #b05070 0%, #4a72c4 55%, #2aada0 100%)',
                    }}
                />
            </div>

            <div className="relative flex items-start justify-between">
                <div
                    className={`absolute left-0 right-0 ${compact ? 'top-[13px]' : 'top-[15px]'} mx-auto`}
                    style={{ left: `${100 / (PHASES.length * 2)}%`, right: `${100 / (PHASES.length * 2)}%` }}
                >
                    <div className="w-full h-px bg-slate-200 dark:bg-slate-700" />
                    <div
                        className="absolute top-0 left-0 h-px transition-all duration-500 ease-out"
                        style={{
                            width: currentIdx === 0 ? '0%' : `${(currentIdx / (PHASES.length - 1)) * 100}%`,
                            background: '#2aada0',
                        }}
                    />
                </div>

                {PHASES.map((phase, idx) => {
                    const config = WORKFLOW_CONFIG[phase];
                    const Icon = config?.icon;
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                        <div key={phase} className="flex flex-col items-center flex-1 relative z-10">
                            <div
                                className={`relative ${nodeSize} rounded-full flex items-center justify-center border-2 transition-colors ${
                                    isCompleted
                                        ? 'bg-slate-800 dark:bg-slate-200 border-slate-800 dark:border-slate-200'
                                        : isCurrent
                                        ? 'bg-white dark:bg-slate-900 border-[#2aada0]'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                {isCompleted ? (
                                    <Check size={checkSize} className="text-white dark:text-slate-900" strokeWidth={2.5} />
                                ) : Icon ? (
                                    <Icon
                                        size={iconSize}
                                        className={isCurrent ? 'text-[#2aada0]' : 'text-slate-300 dark:text-slate-600'}
                                    />
                                ) : null}
                            </div>

                            <span
                                className={`text-center leading-tight mt-2 uppercase tracking-widest ${
                                    compact ? 'text-[8px]' : 'text-[10px]'
                                } ${
                                    isCurrent
                                        ? 'font-semibold text-slate-900 dark:text-white'
                                        : isCompleted
                                        ? 'font-medium text-slate-500 dark:text-slate-400'
                                        : 'font-medium text-slate-300 dark:text-slate-600'
                                }`}
                            >
                                {config?.label || phase}
                            </span>

                            {!compact && config?.desc && (
                                <span
                                    className={`text-[10px] text-center leading-tight mt-0.5 max-w-[5.5rem] ${
                                        isCurrent ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'
                                    }`}
                                >
                                    {config.desc}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
