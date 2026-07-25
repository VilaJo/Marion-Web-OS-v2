/**
 * YachtBar — full-width Linear progress toward the yearly net-profit goal
 * Placed on the Dashboard above the To-do du jour strip.
 */

import React, { useMemo } from 'react';
import { Ship } from 'lucide-react';
import { Project, Invoice } from '../types';
import { formatCurrency, invoiceEffectiveAmount } from '../utils';
import { useExpenses } from '../services/queries';
import { loadStandaloneInvoices } from '../utils/standaloneInvoicesStorage';

const YACHT_PRICE = 300_000;

export interface YachtBarProps {
    projects: Project[];
    standaloneInvoices?: Invoice[];
    onOpenFinances?: () => void;
}

export const YachtBar: React.FC<YachtBarProps> = ({
    projects,
    standaloneInvoices,
    onOpenFinances,
}) => {
    const { data: expenses = [] } = useExpenses();

    const standalones = useMemo(
        () => standaloneInvoices ?? loadStandaloneInvoices(),
        [standaloneInvoices],
    );

    const { netProfit, yachtProgress } = useMemo(() => {
        const year = new Date().getFullYear();
        const allInvoices = [...standalones, ...projects.flatMap((p) => p.invoices)].filter(
            (i) => i.status !== 'Voided' && i.status !== 'Archived',
        );
        const totalRevenue = allInvoices
            .filter(
                (i) =>
                    i.status === 'Paid' &&
                    i.type === 'Invoice' &&
                    new Date(i.date).getFullYear() === year,
            )
            .reduce((sum, i) => sum + invoiceEffectiveAmount(i), 0);
        const totalExpenses = expenses
            .filter((e) => new Date(e.date).getFullYear() === year)
            .reduce((sum, e) => sum + e.amount, 0);
        const profit = totalRevenue - totalExpenses;
        const progress = Math.min(100, Math.max(0, (profit / YACHT_PRICE) * 100));
        return { netProfit: profit, yachtProgress: progress };
    }, [projects, standalones, expenses]);

    const remaining = Math.max(0, YACHT_PRICE - netProfit);

    return (
        <button
            type="button"
            onClick={onOpenFinances}
            className="w-full mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 px-4 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
            title="Ouvrir Santé financière"
        >
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Ship size={14} className="text-[#4a72c4] shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Yacht Bar
                    </span>
                    <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                        Objectif {formatCurrency(YACHT_PRICE, 0)} CHF · bénéfice net {new Date().getFullYear()}
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {formatCurrency(netProfit, 0)} <span className="text-[10px] text-slate-400 font-medium">CHF</span>
                    </span>
                    <span className="text-xs font-semibold text-[#4a72c4]">
                        {yachtProgress.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${yachtProgress}%`,
                        background: 'linear-gradient(90deg, #b05070 0%, #4a72c4 55%, #2aada0 100%)',
                    }}
                />
            </div>

            <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-slate-400">
                    {netProfit >= YACHT_PRICE
                        ? 'Objectif atteint'
                        : `Reste ${formatCurrency(remaining, 0)} CHF`}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                    {formatCurrency(YACHT_PRICE, 0)} CHF
                </span>
            </div>
        </button>
    );
};

export default YachtBar;
