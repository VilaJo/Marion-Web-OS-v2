/**
 * Project health & display helpers — extracted from components/ProjectCard.tsx
 * so they can be reused by the Clients explorer (ClientsFolderTree, ClientsTable)
 * without importing the full card component.
 */

import { Project, ProjectStatus } from '../types';
import { invoiceEffectiveAmount } from '../utils';

/** Couleurs dossier = rail sidebar Dashboard / Roadmap */
export const FOLDER_STATUS_COLOR: Record<ProjectStatus, string> = {
    [ProjectStatus.EN_COURS]: '#2aada0',
    [ProjectStatus.MAINTENANCE]: '#4a72c4',
    [ProjectStatus.ASSOCIATION]: '#7C9A7E',
    [ProjectStatus.PROSPECT]: '#b05070',
    [ProjectStatus.ARCHIVED]: '#8A8A8E',
};

/** Dégradé avatar aligné sur le dossier (fiches / tableau) */
export const FOLDER_STATUS_AVATAR: Record<ProjectStatus, string> = {
    [ProjectStatus.EN_COURS]: 'from-[#2aada0] to-[#1e8f85]',
    [ProjectStatus.MAINTENANCE]: 'from-[#4a72c4] to-[#3a5ba8]',
    [ProjectStatus.ASSOCIATION]: 'from-[#7C9A7E] to-[#647D66]',
    [ProjectStatus.PROSPECT]: 'from-[#b05070] to-[#8f3f5a]',
    [ProjectStatus.ARCHIVED]: 'from-[#8A8A8E] to-[#6b6b70]',
};

export const getFolderStatusColor = (status: ProjectStatus): string =>
    FOLDER_STATUS_COLOR[status] ?? FOLDER_STATUS_COLOR[ProjectStatus.PROSPECT];

export const getFolderStatusAvatar = (status: ProjectStatus): string =>
    FOLDER_STATUS_AVATAR[status] ?? FOLDER_STATUS_AVATAR[ProjectStatus.PROSPECT];

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
    const hex = getFolderStatusColor(status);
    switch (status) {
        case ProjectStatus.EN_COURS:
            return {
                primary: hex, secondary: '#1e8f85',
                cardBg: 'bg-[#2aada0]/5 dark:bg-[#2aada0]/10',
                border: 'border-[#2aada0]/25 dark:border-[#2aada0]/30',
                glow1: 'bg-[#2aada0]/40', glow2: 'bg-[#4a72c4]/30',
                bar: 'bg-[#2aada0]',
                barHover: 'from-[#2aada0] to-[#1e8f85]',
                avatarBg: FOLDER_STATUS_AVATAR[status],
                avatarText: 'text-white',
                progress: 'from-[#2aada0] to-[#1e8f85]',
                hoverBorder: 'hover:border-[#2aada0]/50',
                hoverShadow: 'hover:shadow-none',
                hoverText: 'group-hover:text-[#2aada0]',
            };
        case ProjectStatus.MAINTENANCE:
            return {
                primary: hex, secondary: '#3a5ba8',
                cardBg: 'bg-[#4a72c4]/5 dark:bg-[#4a72c4]/10',
                border: 'border-[#4a72c4]/25 dark:border-[#4a72c4]/30',
                glow1: 'bg-[#4a72c4]/40', glow2: 'bg-[#2aada0]/25',
                bar: 'bg-[#4a72c4]',
                barHover: 'from-[#4a72c4] to-[#3a5ba8]',
                avatarBg: FOLDER_STATUS_AVATAR[status],
                avatarText: 'text-white',
                progress: 'from-[#4a72c4] to-[#3a5ba8]',
                hoverBorder: 'hover:border-[#4a72c4]/50',
                hoverShadow: 'hover:shadow-none',
                hoverText: 'group-hover:text-[#4a72c4]',
            };
        case ProjectStatus.ASSOCIATION:
            return {
                primary: hex, secondary: '#647D66',
                cardBg: 'bg-[#7C9A7E]/5 dark:bg-[#7C9A7E]/10',
                border: 'border-[#7C9A7E]/25 dark:border-[#7C9A7E]/30',
                glow1: 'bg-[#7C9A7E]/40', glow2: 'bg-[#2aada0]/25',
                bar: 'bg-[#7C9A7E]',
                barHover: 'from-[#7C9A7E] to-[#647D66]',
                avatarBg: FOLDER_STATUS_AVATAR[status],
                avatarText: 'text-white',
                progress: 'from-[#7C9A7E] to-[#647D66]',
                hoverBorder: 'hover:border-[#7C9A7E]/50',
                hoverShadow: 'hover:shadow-none',
                hoverText: 'group-hover:text-[#7C9A7E]',
            };
        case ProjectStatus.PROSPECT:
            return {
                primary: hex, secondary: '#8f3f5a',
                cardBg: 'bg-[#b05070]/5 dark:bg-[#b05070]/10',
                border: 'border-[#b05070]/25 dark:border-[#b05070]/30',
                glow1: 'bg-[#b05070]/40', glow2: 'bg-[#4a72c4]/25',
                bar: 'bg-[#b05070]',
                barHover: 'from-[#b05070] to-[#8f3f5a]',
                avatarBg: FOLDER_STATUS_AVATAR[status],
                avatarText: 'text-white',
                progress: 'from-[#b05070] to-[#8f3f5a]',
                hoverBorder: 'hover:border-[#b05070]/50',
                hoverShadow: 'hover:shadow-none',
                hoverText: 'group-hover:text-[#b05070]',
            };
        case ProjectStatus.ARCHIVED:
            return {
                primary: hex, secondary: '#6b6b70',
                cardBg: 'bg-[#8A8A8E]/5 dark:bg-[#8A8A8E]/10',
                border: 'border-[#8A8A8E]/25 dark:border-[#8A8A8E]/30',
                glow1: 'bg-[#8A8A8E]/40', glow2: 'bg-slate-400/30',
                bar: 'bg-[#8A8A8E]',
                barHover: 'from-[#8A8A8E] to-[#6b6b70]',
                avatarBg: FOLDER_STATUS_AVATAR[status],
                avatarText: 'text-white',
                progress: 'from-[#8A8A8E] to-[#6b6b70]',
                hoverBorder: 'hover:border-[#8A8A8E]/50',
                hoverShadow: 'hover:shadow-none',
                hoverText: 'group-hover:text-[#8A8A8E]',
            };
        default: {
            const _exhaustive: never = status;
            return _exhaustive;
        }
    }
};
