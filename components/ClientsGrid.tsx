/**
 * ClientsGrid — Linear card view of clients on the Dashboard
 */

import React, { useMemo } from 'react';
import { FolderOpen, Clock, CheckSquare, ArrowUpRight } from 'lucide-react';
import { Project } from '../types';
import { formatCurrencyWithSymbol } from '../utils';
import {
    getProjectHealth, getPendingAmount, getNextDeadline, formatRelativeDate,
} from '../utils/projectHealth';

export interface ClientsGridProps {
    projects: Project[];
    onOpenProject: (projectId: string) => void;
    searchQuery: string;
}

const HEALTH_META: Record<'good' | 'warning' | 'danger', { dot: string; bar: string; label: string }> = {
    good: { dot: 'bg-[#2aada0]', bar: 'bg-[#2aada0]', label: 'Sain' },
    warning: { dot: 'bg-amber-400', bar: 'bg-amber-400', label: 'À surveiller' },
    danger: { dot: 'bg-[#b05070]', bar: 'bg-[#b05070]', label: 'Urgent' },
};

function openTasksCount(project: Project): number {
    return project.tasks.filter(
        (t) => t.column === 'todo' || t.column === 'doing' || (!t.column && !t.completed),
    ).length;
}

function nextActionLabel(project: Project): string {
    const nextTask = project.tasks.filter((t) => !t.completed)[0];
    return nextTask?.title || '';
}

export const ClientsGrid: React.FC<ClientsGridProps> = ({
    projects,
    onOpenProject,
    searchQuery,
}) => {
    const rows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return (query
            ? projects.filter((p) => p.clientName.toLowerCase().includes(query))
            : projects
        ).map((project) => ({
            project,
            health: getProjectHealth(project),
            nextDeadline: getNextDeadline(project),
            pending: getPendingAmount(project),
            openTasks: openTasksCount(project),
            nextAction: nextActionLabel(project),
        }));
    }, [projects, searchQuery]);

    if (rows.length === 0) {
        return (
            <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900/40">
                <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
                    <FolderOpen size={18} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Aucun client dans ce dossier</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map(({ project, health, nextDeadline, pending, openTasks, nextAction }) => {
                const meta = HEALTH_META[health];
                return (
                    <button
                        key={project.id}
                        type="button"
                        onClick={() => onOpenProject(project.id)}
                        className="group relative text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors overflow-hidden flex flex-col"
                    >
                        <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${meta.bar}`} />

                        <div className="p-4 flex flex-col gap-3.5 flex-1">
                            <div className="flex items-start gap-3">
                                <div
                                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${project.avatarColor || 'from-[#4a72c4] to-[#2aada0]'} flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden`}
                                >
                                    {project.avatarImage ? (
                                        <img src={project.avatarImage} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        project.avatarInitials
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                                            {project.clientName}
                                        </h3>
                                        <ArrowUpRight
                                            size={14}
                                            className="text-slate-300 group-hover:text-slate-500 dark:group-hover:text-slate-400 shrink-0 mt-0.5 transition-colors"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 truncate">
                                            {project.phase}
                                        </span>
                                        <span className="text-slate-300 dark:text-slate-600">·</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {project.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[#2aada0] transition-all"
                                        style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                                    />
                                </div>
                                <span className="text-[11px] tabular-nums font-medium text-slate-500 dark:text-slate-400 w-8 text-right">
                                    {project.progress}%
                                </span>
                            </div>

                            {nextAction ? (
                                <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate">
                                    <span className="text-slate-400">Prochaine · </span>
                                    {nextAction}
                                </p>
                            ) : (
                                <p className="text-[12px] text-slate-400 italic">Aucune tâche ouverte</p>
                            )}

                            <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                    <CheckSquare size={11} className="text-slate-400" /> {openTasks}
                                </span>
                                {nextDeadline && (
                                    <span className="inline-flex items-center gap-1 truncate">
                                        <Clock size={11} className="text-slate-400" />
                                        {formatRelativeDate(nextDeadline.date)}
                                    </span>
                                )}
                                <span className="ml-auto inline-flex items-center gap-1.5 shrink-0">
                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                    <span className="text-[10px] font-medium text-slate-400">{meta.label}</span>
                                </span>
                                {pending > 0 && (
                                    <span className="font-semibold text-[#2aada0] tabular-nums shrink-0">
                                        {formatCurrencyWithSymbol(pending, 'CHF', 0)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default ClientsGrid;
