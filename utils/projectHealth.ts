/**
 * Project health & display helpers — extracted from components/ProjectCard.tsx
 * so they can be reused by the Clients explorer (ClientsFolderTree, ClientsTable)
 * without importing the full card component.
 */

import { Project, ProjectStatus } from '../types';
import { invoiceEffectiveAmount } from '../utils';

export const getProjectHealth = (project: Project): 'good' | 'warning' | 'danger' => {
    const overdueInvoices = project.invoices.filter(i =>
        i.status === 'Pending' && i.dueDate && new Date(i.dueDate) < new Date()
    ).length;
    const pendingTasks = project.tasks.filter(t => !t.completed).length;
    const hasOverdueTasks = project.tasks.some(t =>
        !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
    );

    if (overdueInvoices > 0 || hasOverdueTasks) return 'danger';
    if (pendingTasks > 10 || project.invoices.some(i => i.status === 'Pending')) return 'warning';
    return 'good';
};

export const getPendingAmount = (project: Project): number => {
    return project.invoices
        .filter(i =>
            i.type === 'Invoice' &&
            (i.status === 'Pending' || i.status === 'Partial' || i.status === 'Draft'),
        )
        .reduce((sum, inv) => {
            const eff = invoiceEffectiveAmount(inv);
            const paid = inv.payments?.reduce((p, pay) => p + pay.amount, 0) || 0;
            return sum + Math.max(0, eff - paid);
        }, 0);
};

export const getTotalRevenue = (project: Project): number => {
    return project.invoices
        .filter(i => i.status === 'Paid')
        .reduce((sum, inv) => sum + invoiceEffectiveAmount(inv), 0);
};

export const getNextDeadline = (project: Project): { title: string; date: string } | null => {
    const taskWithDeadline = project.tasks
        .filter(t => !t.completed && t.dueDate)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

    if (taskWithDeadline) {
        return { title: taskWithDeadline.title, date: taskWithDeadline.dueDate! };
    }
    return null;
};

export const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "demain";
    if (diffDays > 1 && diffDays <= 7) return `dans ${diffDays}j`;
    if (diffDays > 7) return date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
    if (diffDays === -1) return "hier";
    return `il y a ${Math.abs(diffDays)}j`;
};

interface StatusColorSet {
    primary: string;
    secondary: string;
    cardBg: string;
    border: string;
    glow1: string;
    glow2: string;
    bar: string;
    barHover: string;
    avatarBg: string;
    avatarText: string;
    progress: string;
    hoverBorder: string;
    hoverShadow: string;
    hoverText: string;
}

export const getStatusColors = (status: ProjectStatus): StatusColorSet => {
    switch (status) {
        case ProjectStatus.EN_COURS:
            return {
                primary: '#10B981', secondary: '#34D399',
                cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
                border: 'border-emerald-100/50 dark:border-emerald-900/30',
                glow1: 'bg-emerald-500/60', glow2: 'bg-teal-400/50',
                bar: 'bg-gradient-to-b from-emerald-400 to-teal-500',
                barHover: 'from-emerald-400 to-teal-500',
                avatarBg: 'from-emerald-50 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30',
                avatarText: 'text-emerald-600 dark:text-emerald-400',
                progress: 'from-emerald-400 via-teal-400 to-cyan-400',
                hoverBorder: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/60',
                hoverShadow: 'hover:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.5)] dark:hover:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.3)]',
                hoverText: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-300',
            };
        case ProjectStatus.MAINTENANCE:
            return {
                primary: '#F97316', secondary: '#FB923C',
                cardBg: 'bg-orange-50/50 dark:bg-orange-950/20',
                border: 'border-orange-100/50 dark:border-orange-900/30',
                glow1: 'bg-orange-500/60', glow2: 'bg-amber-400/50',
                bar: 'bg-gradient-to-b from-orange-400 to-amber-500',
                barHover: 'from-orange-400 to-amber-500',
                avatarBg: 'from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
                avatarText: 'text-orange-600 dark:text-orange-400',
                progress: 'from-orange-400 via-amber-400 to-yellow-400',
                hoverBorder: 'hover:border-orange-400/60 dark:hover:border-orange-500/60',
                hoverShadow: 'hover:shadow-[0_20px_50px_-12px_rgba(249,115,22,0.5)] dark:hover:shadow-[0_20px_50px_-12px_rgba(249,115,22,0.3)]',
                hoverText: 'group-hover:text-orange-600 dark:group-hover:text-orange-300',
            };
        case ProjectStatus.ASSOCIATION:
            return {
                primary: '#8B5CF6', secondary: '#A78BFA',
                cardBg: 'bg-violet-50/50 dark:bg-violet-950/20',
                border: 'border-violet-100/50 dark:border-violet-900/30',
                glow1: 'bg-violet-500/60', glow2: 'bg-purple-400/50',
                bar: 'bg-gradient-to-b from-violet-400 to-purple-500',
                barHover: 'from-violet-400 to-purple-500',
                avatarBg: 'from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30',
                avatarText: 'text-violet-600 dark:text-violet-400',
                progress: 'from-violet-400 via-purple-400 to-fuchsia-400',
                hoverBorder: 'hover:border-violet-400/60 dark:hover:border-violet-500/60',
                hoverShadow: 'hover:shadow-[0_20px_50px_-12px_rgba(139,92,246,0.5)] dark:hover:shadow-[0_20px_50px_-12px_rgba(139,92,246,0.3)]',
                hoverText: 'group-hover:text-violet-600 dark:group-hover:text-violet-300',
            };
        case ProjectStatus.PROSPECT:
            return {
                primary: '#3B82F6', secondary: '#60A5FA',
                cardBg: 'bg-blue-50/50 dark:bg-blue-950/20',
                border: 'border-blue-100/50 dark:border-blue-900/30',
                glow1: 'bg-blue-500/60', glow2: 'bg-indigo-400/50',
                bar: 'bg-gradient-to-b from-blue-400 to-indigo-500',
                barHover: 'from-blue-400 to-indigo-500',
                avatarBg: 'from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30',
                avatarText: 'text-blue-600 dark:text-blue-400',
                progress: 'from-blue-400 via-indigo-400 to-sky-400',
                hoverBorder: 'hover:border-blue-400/60 dark:hover:border-blue-500/60',
                hoverShadow: 'hover:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.5)] dark:hover:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.3)]',
                hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-300',
            };
        case ProjectStatus.ARCHIVED:
            return {
                primary: '#64748B', secondary: '#94A3B8',
                cardBg: 'bg-slate-50/50 dark:bg-slate-900/20',
                border: 'border-slate-100/50 dark:border-slate-800/30',
                glow1: 'bg-slate-400/60', glow2: 'bg-gray-400/50',
                bar: 'bg-gradient-to-b from-slate-400 to-gray-500',
                barHover: 'from-slate-400 to-gray-500',
                avatarBg: 'from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-800',
                avatarText: 'text-slate-500 dark:text-slate-400',
                progress: 'from-slate-400 via-gray-400 to-slate-500',
                hoverBorder: 'hover:border-slate-400/60 dark:hover:border-slate-500/60',
                hoverShadow: 'hover:shadow-[0_20px_50px_-12px_rgba(100,116,139,0.5)] dark:hover:shadow-[0_20px_50px_-12px_rgba(100,116,139,0.3)]',
                hoverText: 'group-hover:text-slate-600 dark:group-hover:text-slate-300',
            };
        default: {
            const _exhaustive: never = status;
            return _exhaustive;
        }
    }
};
