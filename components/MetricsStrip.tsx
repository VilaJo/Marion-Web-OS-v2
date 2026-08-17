/**
 * MetricsStrip — 4 clickable KPI capsules at the top of the Dashboard
 */

import React, { useMemo } from 'react';
import { Users, Wallet, AlertTriangle, ListTodo } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { formatCurrencyWithSymbol } from '../utils';
import { getPendingAmount, getNextDeadline } from '../utils/projectHealth';
import { useTodoStore } from '../stores/useTodoStore';
import { useUIStore } from '../stores/useUIStore';

export interface MetricsStripProps {
    projects: Project[];
    onFilterUrgent?: () => void;
    onOpenFinances?: () => void;
    onFilterActive?: () => void;
}

interface MetricItem {
    key: string;
    label: string;
    value: string;
    accent: string;
    icon: React.ElementType;
    onClick?: () => void;
}

export const MetricsStrip: React.FC<MetricsStripProps> = ({
    projects,
    onFilterUrgent,
    onOpenFinances,
    onFilterActive,
}) => {
    const openTodos = useTodoStore((s) => s.todos.filter((t) => !t.done).length);
    const setShowTodoPanel = useUIStore((s) => s.setShowTodoPanel);

    const stats = useMemo(() => {
        const activeClients = projects.filter(
            (p) => p.status === ProjectStatus.EN_COURS || p.status === ProjectStatus.MAINTENANCE,
        ).length;
        const pendingCa = projects.reduce((sum, p) => sum + getPendingAmount(p), 0);
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const urgentDeadlines = projects.filter((p) => {
            const next = getNextDeadline(p);
            if (!next) return false;
            const t = new Date(next.date).getTime();
            return t <= now + weekMs;
        }).length;
        return { activeClients, pendingCa, urgentDeadlines };
    }, [projects]);

    const items: MetricItem[] = [
        {
            key: 'clients',
            label: 'Clients actifs',
            value: String(stats.activeClients),
            accent: '#4a72c4',
            icon: Users,
            onClick: onFilterActive,
        },
        {
            key: 'ca',
            label: 'CA en attente',
            value: formatCurrencyWithSymbol(stats.pendingCa, 'CHF', 0),
            accent: '#2aada0',
            icon: Wallet,
            onClick: onOpenFinances,
        },
        {
            key: 'deadlines',
            label: 'Deadlines urgentes',
            value: String(stats.urgentDeadlines),
            accent: '#b05070',
            icon: AlertTriangle,
            onClick: onFilterUrgent,
        },
        {
            key: 'todos',
            label: 'Tâches ouvertes',
            value: String(openTodos),
            accent: '#7C9A7E',
            icon: ListTodo,
            onClick: () => setShowTodoPanel(true),
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.key}
                        type="button"
                        onClick={item.onClick}
                        className="fun-metric group flex items-center gap-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 px-3.5 py-2.5 text-left hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                        style={{ ['--accent']: item.accent } as React.CSSProperties}
                    >
                        <span
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.accent}18`, color: item.accent }}
                        >
                            <Icon size={15} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">
                                {item.label}
                            </span>
                            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums truncate">
                                {item.value}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default MetricsStrip;
