/**
 * ProjectCard & StatusChart - Extracted from App.tsx
 * Reusable project display components
 */

import React from 'react';
import { Project, ProjectStatus } from '../types';
import { formatCurrencyWithSymbol } from '../utils';
import {
    getProjectHealth, getPendingAmount, getTotalRevenue,
    getNextDeadline, getStatusColors, formatRelativeDate,
} from '../utils/projectHealth';
import {
    CheckSquare, Clock, DollarSign, Mail, Calendar,
    ArrowUpRight, PieChart
} from 'lucide-react';
import { Card, Badge } from './Shared';

// Helper functions (getProjectHealth, getPendingAmount, getTotalRevenue,
// getNextDeadline, getStatusColors, formatRelativeDate) now live in
// utils/projectHealth.ts — re-exported here for existing importers.
export { getProjectHealth, getPendingAmount, getTotalRevenue, getNextDeadline, getStatusColors, formatRelativeDate };

// ============================================================================
// ProjectCard Component
// ============================================================================

interface ProjectCardProps {
    project: Project;
    onClick: () => void;
    onStatusCycle: (e: React.MouseEvent) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = React.memo(({ project, onClick, onStatusCycle }) => {
    const health = getProjectHealth(project);
    const pendingAmount = getPendingAmount(project);
    const totalRevenue = getTotalRevenue(project);
    const nextDeadline = getNextDeadline(project);
    const pendingTasks = project.tasks.filter(t => !t.completed).length;
    const colors = getStatusColors(project.status);

    return (
        <Card
            onClick={onClick}
            className={`group transition-all duration-500 cursor-pointer 
            ${colors.cardBg} ${colors.border}
            hover:scale-[1.03] ${colors.hoverBorder}
            ${colors.hoverShadow} 
            relative overflow-hidden`}
        >
            {/* Hover Glow Effects */}
            <div className={`absolute -right-20 -top-20 w-64 h-64 ${colors.glow1} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0`}></div>
            <div className={`absolute -left-20 -bottom-20 w-64 h-64 ${colors.glow2} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0`}></div>

            {/* Left Accent Bar */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${colors.bar} opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10`} style={{ boxShadow: `0 0 10px ${colors.primary}80` }} />

            {/* Health Indicator */}
            <div className={`absolute top-3 right-3 w-2 h-2 rounded-full z-20 ${
                health === 'good' ? 'bg-emerald-400' :
                health === 'warning' ? 'bg-amber-400' :
                'bg-red-400 animate-pulse'
            }`} />

            {/* Header */}
            <div className="flex justify-between items-start mb-3 md:mb-4 relative z-10">
                <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1">
                    <div
                        className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl md:rounded-3xl bg-gradient-to-br ${colors.avatarBg} flex items-center justify-center text-lg md:text-xl font-serif font-bold shadow-inner border border-white/50 dark:border-white/5 group-hover:scale-110 transition-transform duration-300 group-hover:rotate-3 group-hover:shadow-lg ${colors.avatarText} shrink-0`}
                    >
                        {project.avatarInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`font-serif text-lg md:text-xl leading-tight text-slate-800 dark:text-slate-100 ${colors.hoverText} transition-colors truncate`}>
                            {project.clientName}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">{project.phase}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                    <Badge color={
                        project.status === ProjectStatus.EN_COURS ? 'green' :
                        project.status === ProjectStatus.MAINTENANCE ? 'blue' :
                        project.status === ProjectStatus.ASSOCIATION ? 'green' :
                        project.status === ProjectStatus.PROSPECT ? 'pink' : 'gray'
                    }>
                        {project.status === ProjectStatus.ARCHIVED && project.archiveCategory
                            ? `Archivé - ${project.archiveCategory}`
                            : project.status}
                    </Badge>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4 relative z-10">
                <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
                    <span>Progression</span>
                    <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                        className={`bg-gradient-to-r ${colors.progress} h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)]`}
                        style={{ width: `${project.progress}%` }}
                    />
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-2 mb-3 relative z-10">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                    <CheckSquare size={12} className="text-brand-orange" />
                    <span>{pendingTasks}</span>
                </span>
                {pendingAmount > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                        <Clock size={12} />
                        {formatCurrencyWithSymbol(pendingAmount, 'CHF', 0)}
                    </span>
                ) : totalRevenue > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                        <DollarSign size={12} />
                        {formatCurrencyWithSymbol(totalRevenue, 'CHF', 0)}
                    </span>
                ) : null}
                {project.unreadEmailCount !== undefined && project.unreadEmailCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg animate-pulse">
                        <Mail size={12} /> {project.unreadEmailCount}
                    </span>
                )}
            </div>

            {/* Next Deadline */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 relative z-10">
                {nextDeadline ? (
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Calendar size={12} className="text-purple-500" />
                            <span className="font-medium">Deadline</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[100px]">
                                {nextDeadline.title}
                            </span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                new Date(nextDeadline.date) < new Date()
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                            }`}>
                                {formatRelativeDate(nextDeadline.date)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Prochaine action</span>
                        <span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[150px]">
                            {project.tasks.filter(t => !t.completed)[0]?.title || "Rien à faire ✨"}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
});

// ============================================================================
// StatusChart Component
// ============================================================================

export const StatusChart = ({ projects, onClick }: { projects: Project[], onClick: () => void }) => {
    const total = projects.length;
    const active = projects.filter(p => p.status === ProjectStatus.EN_COURS).length;
    const prospect = projects.filter(p => p.status === ProjectStatus.PROSPECT).length;
    const archived = projects.filter(p => p.status === ProjectStatus.ARCHIVED).length;

    const activePct = total > 0 ? (active / total) * 100 : 0;
    const prospectPct = total > 0 ? (prospect / total) * 100 : 0;

    return (
        <Card onClick={onClick} className="p-6 relative overflow-hidden group cursor-pointer hover:border-brand-orange transition-colors">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-brand-orange transition-opacity">
                <ArrowUpRight size={18} />
            </div>
            <h3 className="font-serif text-lg opacity-80 mb-6 flex items-center gap-2">
                <PieChart size={18} /> Distribution
            </h3>

            <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                        <path className="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-yellow-400 drop-shadow-md" strokeDasharray={`${prospectPct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        <path className="text-brand-orange drop-shadow-md" strokeDasharray={`${activePct}, 100`} strokeDashoffset={-prospectPct} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-serif font-bold text-slate-800 dark:text-white">{total}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Total</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-brand-orange shadow-sm"></span>
                            <span className="text-slate-600 dark:text-slate-300">Actifs</span>
                        </div>
                        <span className="font-bold">{active}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></span>
                            <span className="text-slate-600 dark:text-slate-300">Prospects</span>
                        </div>
                        <span className="font-bold">{prospect}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                            <span className="text-slate-600 dark:text-slate-300">Archivés</span>
                        </div>
                        <span className="font-bold">{archived}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};
