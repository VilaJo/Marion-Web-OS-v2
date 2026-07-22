/**
 * ClientsTable — vue tableau de la page Clients (explorateur)
 *
 * Remplace la grille de cartes par une liste dense, triable et filtrable,
 * pensée pour naviguer vite entre les dossiers clients.
 */

import React, { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, FolderOpen } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { formatCurrencyWithSymbol } from '../utils';
import { getProjectHealth, getNextDeadline, getPendingAmount } from '../utils/projectHealth';

export interface ClientsTableProps {
    projects: Project[];
    onOpenProject: (projectId: string) => void;
    searchQuery: string;
}

type SortKey = 'default' | 'deadline' | 'nom' | 'progression';
type SortDir = 'asc' | 'desc';

const STATUS_PRIORITY: Record<ProjectStatus, number> = {
    [ProjectStatus.EN_COURS]: 1,
    [ProjectStatus.MAINTENANCE]: 2,
    [ProjectStatus.ASSOCIATION]: 3,
    [ProjectStatus.PROSPECT]: 4,
    [ProjectStatus.ARCHIVED]: 5,
};

const HEALTH_DOT_CLASSES: Record<'good' | 'warning' | 'danger', string> = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-[#b05070]',
};

function openTasksCount(project: Project): number {
    return project.tasks.filter(t => t.column === 'todo' || t.column === 'doing' || (!t.column && !t.completed)).length;
}

function nextActionLabel(project: Project): string {
    const nextTask = project.tasks.filter(t => !t.completed)[0];
    return nextTask?.title || '';
}

function formatDeadline(dateString: string | null): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
}

function daysUntil(dateString: string): number {
    const target = new Date(dateString);
    const now = new Date();
    return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function initialsColorClasses(project: Project): string {
    return project.avatarColor || 'from-[#4a72c4] to-[#2aada0]';
}

export const ClientsTable: React.FC<ClientsTableProps> = ({ projects, onOpenProject, searchQuery }) => {
    const [sortKey, setSortKey] = useState<SortKey>('default');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const rows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? projects.filter(p => p.clientName.toLowerCase().includes(query))
            : projects;

        const withMeta = filtered.map(project => {
            const health = getProjectHealth(project);
            const nextDeadline = getNextDeadline(project);
            return { project, health, nextDeadline };
        });

        const dir = sortDir === 'asc' ? 1 : -1;

        withMeta.sort((a, b) => {
            switch (sortKey) {
                case 'nom':
                    return dir * a.project.clientName.localeCompare(b.project.clientName, 'fr');
                case 'progression':
                    return dir * (a.project.progress - b.project.progress);
                case 'deadline': {
                    const aTime = a.nextDeadline ? new Date(a.nextDeadline.date).getTime() : Infinity;
                    const bTime = b.nextDeadline ? new Date(b.nextDeadline.date).getTime() : Infinity;
                    return dir * (aTime - bTime);
                }
                case 'default': {
                    const statusDiff = (STATUS_PRIORITY[a.project.status] ?? 999) - (STATUS_PRIORITY[b.project.status] ?? 999);
                    if (statusDiff !== 0) return statusDiff;
                    const aTime = a.nextDeadline ? new Date(a.nextDeadline.date).getTime() : Infinity;
                    const bTime = b.nextDeadline ? new Date(b.nextDeadline.date).getTime() : Infinity;
                    return aTime - bTime;
                }
                default: {
                    const _exhaustive: never = sortKey;
                    return _exhaustive;
                }
            }
        });

        return withMeta;
    }, [projects, searchQuery, sortKey, sortDir]);

    if (rows.length === 0) {
        return (
            <div className="w-full bg-[#FAF7F2] dark:bg-[#23262B] rounded-2xl border border-[#e7e0d4] dark:border-slate-700/50 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
                    <FolderOpen size={28} className="text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Aucun client dans ce dossier</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#FAF7F2] dark:bg-[#23262B] rounded-2xl border border-[#e7e0d4] dark:border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-[#EFE9DE] dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                            <SortableHeader label="Client" sortKey="nom" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3" />
                            <th className="text-left px-4 py-3 font-semibold">Phase</th>
                            <SortableHeader label="Progression" sortKey="progression" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3" />
                            <th className="text-left px-4 py-3 font-semibold">Tâches</th>
                            <SortableHeader label="Deadline" sortKey="deadline" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3" />
                            <th className="text-left px-4 py-3 font-semibold">Santé</th>
                            <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Prochaine action</th>
                            <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Montant dû</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ project, health, nextDeadline }, idx) => {
                            const pendingAmount = getPendingAmount(project);
                            const withinWeek = !!nextDeadline && daysUntil(nextDeadline.date) <= 7;
                            const isDangerRow = health === 'danger' || withinWeek;
                            const isWarningRow = !isDangerRow && health === 'warning';
                            const borderClass = isDangerRow
                                ? 'border-l-[3px] border-l-[#b05070]'
                                : isWarningRow
                                ? 'border-l-[3px] border-l-amber-400'
                                : 'border-l-[3px] border-l-transparent';
                            const zebraClass = idx % 2 === 1 ? 'bg-white/40 dark:bg-white/[0.02]' : '';

                            return (
                                <tr
                                    key={project.id}
                                    onClick={() => onOpenProject(project.id)}
                                    className={`cursor-pointer transition-colors hover:bg-[#7C9A7E]/10 dark:hover:bg-[#7C9A7E]/10 ${borderClass} ${zebraClass}`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${initialsColorClasses(project)} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`}>
                                                {project.avatarImage ? (
                                                    <img src={project.avatarImage} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    project.avatarInitials
                                                )}
                                            </div>
                                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{project.clientName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{project.phase}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 min-w-[100px]">
                                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-[#7C9A7E]"
                                                    style={{ width: `${project.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 w-9 text-right">{project.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{openTasksCount(project)}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDeadline(nextDeadline?.date ?? null)}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_DOT_CLASSES[health]}`}
                                            title={health === 'good' ? 'Sain' : health === 'warning' ? 'À surveiller' : 'Urgent'}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[180px] hidden md:table-cell">
                                        {nextActionLabel(project) || '—'}
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        {pendingAmount > 0 ? (
                                            <span className="text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                                                {formatCurrencyWithSymbol(pendingAmount, 'CHF', 0)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface SortableHeaderProps {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    dir: SortDir;
    onSort: (key: SortKey) => void;
    className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ label, sortKey, activeKey, dir, onSort, className }) => {
    const isActive = activeKey === sortKey;
    const Icon = isActive ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
        <th className={className}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`flex items-center gap-1 font-semibold uppercase tracking-wide transition-colors ${
                    isActive ? 'text-[#7C9A7E]' : 'hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
                {label}
                <Icon size={12} />
            </button>
        </th>
    );
};

export default ClientsTable;
