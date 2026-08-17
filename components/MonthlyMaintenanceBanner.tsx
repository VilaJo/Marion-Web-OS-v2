/**
 * Bandeau sticky — rappel maintenance à partir du 25 du mois.
 * Liste les clients du dossier Maintenance avec coche « Fait ».
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, ChevronDown, ChevronUp, Wrench, X } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { useMonthlyMaintenanceStore, useProjectStore } from '../stores';
import {
    formatMonthLabel,
    monthKeyFromDate,
    shouldShowMonthlyMaintenanceBanner,
} from '../utils/monthlyMaintenance';
import { FOLDER_STATUS_COLOR } from '../utils/projectHealth';

interface MonthlyMaintenanceBannerProps {
    projects: Project[];
}

export const MonthlyMaintenanceBanner: React.FC<MonthlyMaintenanceBannerProps> = ({ projects }) => {
    const navigate = useNavigate();
    const setFilter = useProjectStore((s) => s.setFilter);
    const enabled = useMonthlyMaintenanceStore((s) => s.enabled);
    const lastOkMonth = useMonthlyMaintenanceStore((s) => s.lastOkMonth);
    const doneByMonth = useMonthlyMaintenanceStore((s) => s.doneByMonth);
    const toggleClientDone = useMonthlyMaintenanceStore((s) => s.toggleClientDone);
    const completeMonth = useMonthlyMaintenanceStore((s) => s.completeMonth);

    const [expanded, setExpanded] = useState(true);
    const [dismissedSession, setDismissedSession] = useState(false);

    const monthKey = monthKeyFromDate();
    const visible = shouldShowMonthlyMaintenanceBanner({ enabled, lastOkMonth, doneByMonth }) && !dismissedSession;

    const clients = useMemo(
        () =>
            projects
                .filter((p) => p.status === ProjectStatus.MAINTENANCE && p.maintenance?.active !== false)
                .slice()
                .sort((a, b) => a.clientName.localeCompare(b.clientName, 'fr')),
        [projects],
    );

    const doneIds = doneByMonth[monthKey] || [];
    const doneCount = clients.filter((c) => doneIds.includes(c.id)).length;
    const accent = FOLDER_STATUS_COLOR[ProjectStatus.MAINTENANCE];

    if (!visible) return null;

    const handleOpenFolder = () => {
        setFilter(ProjectStatus.MAINTENANCE);
        navigate('/');
    };

    const handleComplete = () => {
        const pending = clients.length - doneCount;
        if (pending > 0) {
            const ok = window.confirm(
                `${pending} client${pending > 1 ? 's' : ''} non coché${pending > 1 ? 's' : ''}. Terminer la maintenance du mois quand même ?`,
            );
            if (!ok) return;
        }
        completeMonth(monthKey);
    };

    return (
        <div
            className="sticky top-[4.5rem] md:top-0 z-40 mb-4 rounded-xl border shadow-sm overflow-hidden"
            style={{ borderColor: `${accent}55`, background: 'var(--eonora-surface, #fff)' }}
            role="region"
            aria-label="Rappel maintenance du mois"
        >
            <div
                className="px-3 md:px-4 py-3 flex flex-wrap items-center gap-2 md:gap-3"
                style={{ background: `${accent}12` }}
            >
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: accent }}
                >
                    <Wrench size={18} />
                </div>
                <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Maintenance du mois — {formatMonthLabel(monthKey)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        {clients.length === 0
                            ? 'Aucun client dans le dossier Maintenance.'
                            : `${doneCount}/${clients.length} client${clients.length > 1 ? 's' : ''} fait${doneCount > 1 ? 's' : ''} — passe la tournée, puis valide.`}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={handleOpenFolder}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800"
                    >
                        Voir Maintenance
                    </button>
                    <button
                        type="button"
                        onClick={handleComplete}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                        style={{ backgroundColor: accent }}
                    >
                        <CheckCircle2 size={14} />
                        OK, c’est fait
                    </button>
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Réduire la liste' : 'Afficher la liste'}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setDismissedSession(true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Masquer jusqu’au prochain rechargement (le rappel revient tant que le mois n’est pas OK)"
                        aria-label="Masquer temporairement"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {expanded && clients.length > 0 && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto bg-white dark:bg-[#151516]">
                    {clients.map((client) => {
                        const done = doneIds.includes(client.id);
                        return (
                            <li key={client.id} className="flex items-center gap-2 px-3 md:px-4 py-2.5">
                                <button
                                    type="button"
                                    onClick={() => toggleClientDone(client.id, monthKey)}
                                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                        done
                                            ? 'text-white border-transparent'
                                            : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-slate-400'
                                    }`}
                                    style={done ? { backgroundColor: accent } : undefined}
                                    aria-pressed={done}
                                    aria-label={done ? `${client.clientName} fait` : `Marquer ${client.clientName} fait`}
                                >
                                    <Check size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/client/${encodeURIComponent(client.id)}`)}
                                    className={`flex-1 text-left text-sm font-medium truncate ${
                                        done
                                            ? 'text-slate-400 line-through'
                                            : 'text-slate-800 dark:text-slate-100 hover:underline'
                                    }`}
                                >
                                    {client.clientName}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
