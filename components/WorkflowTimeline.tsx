/**
 * WorkflowTimeline - Premium visual timeline showing project phase progression.
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

    // Sizes based on compact mode
    const nodeSize = compact ? 'w-10 h-10' : 'w-14 h-14';
    const iconSize = compact ? 16 : 22;
    const checkSize = compact ? 10 : 14;
    const checkBadgeSize = compact ? 'w-4 h-4 -top-0.5 -right-0.5' : 'w-5 h-5 -top-1 -right-1';

    return (
        <div className="w-full">
            {/* Header: title + percentage */}
            <div className="flex items-center justify-between mb-3">
                <span className={`font-serif font-bold text-slate-800 dark:text-white ${compact ? 'text-sm' : 'text-base'}`}>
                    Avancement du projet
                </span>
                <div className="flex items-center gap-2">
                    <span className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 ${compact ? 'text-sm' : 'text-lg'}`}>
                        {progressPercent}%
                    </span>
                </div>
            </div>

            {/* Multi-color progress bar */}
            <div className={`bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden ${compact ? 'h-1.5 mb-5' : 'h-2 mb-7'}`}>
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                        width: `${progressPercent}%`,
                        background: `linear-gradient(90deg, #facc15 0%, #38bdf8 20%, #ec4899 40%, #8b5cf6 60%, #f97316 80%, #10b981 100%)`,
                    }}
                />
            </div>

            {/* Phase nodes with connecting lines */}
            <div className="relative flex items-start justify-between">
                {/* Connecting line (background) - offset for badge/spacer height */}
                <div className={`absolute left-0 right-0 ${compact ? 'top-[36px]' : 'top-[48px]'} mx-auto`}
                     style={{ left: `${100 / (PHASES.length * 2)}%`, right: `${100 / (PHASES.length * 2)}%` }}>
                    <div className={`w-full ${compact ? 'h-0.5' : 'h-[3px]'} bg-slate-200 dark:bg-slate-600 rounded-full`} />
                    {/* Progress overlay */}
                    <div
                        className={`absolute top-0 left-0 ${compact ? 'h-0.5' : 'h-[3px]'} rounded-full transition-all duration-1000 ease-out`}
                        style={{
                            width: currentIdx === 0 ? '0%' : `${(currentIdx / (PHASES.length - 1)) * 100}%`,
                            background: `linear-gradient(90deg, #facc15, #38bdf8, #ec4899, #8b5cf6, #f97316, #10b981)`,
                        }}
                    />
                </div>

                {/* Phase nodes */}
                {PHASES.map((phase, idx) => {
                    const config = WORKFLOW_CONFIG[phase];
                    const Icon = config?.icon;
                    const isCompleted = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isFuture = idx > currentIdx;

                    return (
                        <div key={phase} className="flex flex-col items-center flex-1 relative z-10">
                            {/* "En cours" badge or spacer for alignment */}
                            {isCurrent ? (
                                <div className={`whitespace-nowrap ${compact ? 'mb-1' : 'mb-1.5'}`}>
                                    <span className={`font-bold text-white bg-gradient-to-r from-orange-500 to-pink-500 rounded-full shadow-sm ${compact ? 'text-[7px] px-1.5 py-px' : 'text-[9px] px-2 py-0.5'}`}>
                                        En cours
                                    </span>
                                </div>
                            ) : (
                                <div className={compact ? 'h-[16px]' : 'h-[20px]'} />
                            )}

                            {/* Node circle */}
                            <div className={`relative ${nodeSize} rounded-full flex items-center justify-center transition-all duration-500 ${
                                isCompleted
                                    ? `bg-gradient-to-br ${config?.gradient || 'from-slate-400 to-slate-500'} shadow-md`
                                    : isCurrent
                                    ? `bg-gradient-to-br ${config?.gradient || 'from-orange-400 to-pink-500'} shadow-lg scale-110`
                                    : 'bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600'
                            }`}>
                                {/* Glow ring for current phase */}
                                {isCurrent && (
                                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${config?.gradient || 'from-orange-400 to-pink-500'} opacity-30 animate-ping`}
                                         style={{ animationDuration: '2s' }} />
                                )}

                                {/* Icon */}
                                {Icon && (
                                    <Icon
                                        size={iconSize}
                                        className={`relative z-10 ${
                                            isCompleted || isCurrent ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                                        }`}
                                    />
                                )}

                                {/* Completed check badge */}
                                {isCompleted && (
                                    <div className={`absolute ${checkBadgeSize} bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm border-2 border-emerald-500`}>
                                        <Check size={checkSize} className="text-emerald-500" strokeWidth={3} />
                                    </div>
                                )}
                            </div>

                            {/* Label */}
                            <span className={`font-bold text-center leading-tight mt-2 ${
                                compact ? 'text-[7px]' : 'text-[10px]'
                            } ${
                                isCurrent ? (config?.color || 'text-orange-600')
                                : isCompleted ? 'text-slate-600 dark:text-slate-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}>
                                {config?.label || phase}
                            </span>

                            {/* Description (only in full mode) */}
                            {!compact && config?.desc && (
                                <span className={`text-[8px] text-center leading-tight mt-0.5 ${
                                    isCurrent ? 'text-slate-500 dark:text-slate-400'
                                    : isFuture ? 'text-slate-300 dark:text-slate-600'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}>
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
