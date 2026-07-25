/**
 * ClientsGrid — compact card view alternative to ClientsTable
 */

import React, { useMemo } from 'react';
import { FolderOpen, Clock, CheckSquare } from 'lucide-react';
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

const HEALTH_DOT: Record<'good' | 'warning' | 'danger', string> = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-[#b05070]',
};

function openTasksCount(project: Project): number {
    return project.tasks.filter(
        (t) => t.column === 'todo' || t.column === 'doing' || (!t.column && !t.completed),
    ).length;
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
        }));
    }, [projects, searchQuery]);

    if (rows.length === 0) {
        return (
            <div className="w-full rounded-md border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
                    <FolderOpen size={22} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Aucun client dans ce dossier</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map(({ project, health, nextDeadline, pending, openTasks }) => (
                <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="text-left rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600 transition-colors p-3.5 flex flex-col gap-3"
                >
                    <div className="flex items-start gap-3">
                        <div
                            className={`w-9 h-9 rounded-md bg-gradient-to-br ${project.avatarColor || 'from-[#4a72c4] to-[#2aada0]'} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`}
                        >
                            {project.avatarImage ? (
                                <img src={project.avatarImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                                project.avatarInitials
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {project.clientName}
                                </h3>
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[health]}`}
                                    title={health === 'good' ? 'Sain' : health === 'warning' ? 'À surveiller' : 'Urgent'}
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{project.phase} · {project.status}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[#7C9A7E]"
                                style={{ width: `${project.progress}%` }}
                            />
                        </div>
                        <span className="text-[10px] tabular-nums text-slate-400 w-8 text-right">
                            {project.progress}%
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                            <CheckSquare size={11} /> {openTasks}
                        </span>
                        {nextDeadline && (
                            <span className="inline-flex items-center gap-1 truncate">
                                <Clock size={11} /> {formatRelativeDate(nextDeadline.date)}
                            </span>
                        )}
                        {pending > 0 && (
                            <span className="ml-auto font-medium text-[#2aada0] tabular-nums">
                                {formatCurrencyWithSymbol(pending, 'CHF', 0)}
                            </span>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
};

export default ClientsGrid;
