/**
 * ClientsTable — Linear dense table of clients on the Dashboard
 */

import React, { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, FolderOpen } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { formatCurrencyWithSymbol } from '../utils';
import {
    getProjectHealth, getNextDeadline, getPendingAmount,
    getFolderStatusColor, getFolderStatusAvatar,
} from '../utils/projectHealth';

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
    good: 'bg-[#2aada0]',
    warning: 'bg-amber-400',
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
    return getFolderStatusAvatar(project.status);
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
            <div className="w-full rounded-2xl flex flex-col items-center justify-center py-16 text-center fun-sticker dark:border dark:border-slate-700 dark:bg-slate-900/40 dark:shadow-none">
                <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
                    <FolderOpen size={18} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Aucun client dans ce dossier</p>
            </div>
        );
    }

    return (
        <div className="w-full rounded-2xl overflow-hidden fun-sticker fun-sticker-sun dark:border dark:border-slate-700 dark:bg-slate-900/40 dark:shadow-none">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                            <SortableHeader label="Client" sortKey="nom" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="text-left px-4 py-2.5" />
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Phase</th>
                            <SortableHeader label="Progression" sortKey="progression" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="text-left px-4 py-2.5" />
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Tâches</th>
                            <SortableHeader label="Deadline" sortKey="deadline" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="text-left px-4 py-2.5" />
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Santé</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Prochaine action</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell">Montant dû</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map(({ project, health, nextDeadline }) => {
                            const pendingAmount = getPendingAmount(project);
                            const withinWeek = !!nextDeadline && daysUntil(nextDeadline.date) <= 7;
                            const folderColor = getFolderStatusColor(project.status);

                            return (
                                <tr
                                    key={project.id}
                                    onClick={() => onOpenProject(project.id)}
                                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-[3px]"
                                    style={{ borderLeftColor: folderColor }}
                                >
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${initialsColorClasses(project)} flex items-center justify-center text-white text-[10px] font-semibold shrink-0 overflow-hidden`}>
                                                {project.avatarImage ? (
                                                    <img src={project.avatarImage} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    project.avatarInitials
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block font-medium text-slate-900 dark:text-slate-100 truncate">{project.clientName}</span>
                                                <span className="block text-[10px] truncate md:hidden" style={{ color: folderColor }}>{project.status}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[13px]">{project.phase}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2 min-w-[100px]">
                                            <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${project.progress}%`, backgroundColor: folderColor }}
                                                />
                                            </div>
                                            <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400 w-8 text-right">{project.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{openTasksCount(project)}</td>
                                    <td className={`px-4 py-2.5 whitespace-nowrap tabular-nums text-[13px] ${withinWeek ? 'text-[#b05070] font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {formatDeadline(nextDeadline?.date ?? null)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span
                                            className={`inline-block w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASSES[health]}`}
                                            title={health === 'good' ? 'Sain' : health === 'warning' ? 'À surveiller' : 'Urgent'}
                                        />
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[180px] hidden md:table-cell text-[13px]">
                                        {nextActionLabel(project) || '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right hidden md:table-cell">
                                        {pendingAmount > 0 ? (
                                            <span className="text-[#2aada0] font-medium whitespace-nowrap tabular-nums text-[13px]">
                                                {formatCurrencyWithSymbol(pendingAmount, 'CHF', 0)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
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
                className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                    isActive ? 'text-slate-800 dark:text-slate-100' : 'hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
                {label}
                <Icon size={11} />
            </button>
        </th>
    );
};

export default ClientsTable;
