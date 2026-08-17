/**
 * Panneau dans le dossier Maintenance — activer le rappel du 25 + checklist du mois.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Wrench } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { useMonthlyMaintenanceStore } from '../stores';
import {
    formatLastOkLabel,
    formatMonthLabel,
    isMaintenanceReminderWindow,
    monthKeyFromDate,
} from '../utils/monthlyMaintenance';
import { FOLDER_STATUS_COLOR } from '../utils/projectHealth';

interface MonthlyMaintenancePanelProps {
    projects: Project[];
}

export const MonthlyMaintenancePanel: React.FC<MonthlyMaintenancePanelProps> = ({ projects }) => {
    const navigate = useNavigate();
    const enabled = useMonthlyMaintenanceStore((s) => s.enabled);
    const lastOkMonth = useMonthlyMaintenanceStore((s) => s.lastOkMonth);
    const doneByMonth = useMonthlyMaintenanceStore((s) => s.doneByMonth);
    const setEnabled = useMonthlyMaintenanceStore((s) => s.setEnabled);
    const toggleClientDone = useMonthlyMaintenanceStore((s) => s.toggleClientDone);
    const completeMonth = useMonthlyMaintenanceStore((s) => s.completeMonth);

    const monthKey = monthKeyFromDate();
    const inWindow = isMaintenanceReminderWindow();
    const monthDone = lastOkMonth === monthKey;
    const accent = FOLDER_STATUS_COLOR[ProjectStatus.MAINTENANCE];

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

    return (
        <div className="mt-3 rounded-lg border border-[#E0DFDB] dark:border-[#262626] bg-white dark:bg-[#151516] overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 dark:border-[#262626] flex items-center gap-2">
                <Wrench size={14} style={{ color: accent }} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8A8A8E]">
                    Rappel mensuel
                </p>
            </div>

            <div className="p-3 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => setEnabled(!enabled)}
                        className={`relative mt-0.5 w-10 h-6 rounded-full transition-colors shrink-0 ${
                            enabled ? '' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        style={enabled ? { backgroundColor: accent } : undefined}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                enabled ? 'translate-x-4' : ''
                            }`}
                        />
                    </button>
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                            Rappel le 25 de chaque mois
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Un bandeau liste les clients Maintenance à passer. Tu coches, puis OK.
                        </span>
                    </span>
                </label>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dernière fois : <span className="font-medium text-slate-700 dark:text-slate-200">{formatLastOkLabel(lastOkMonth)}</span>
                    {!enabled && ' · Prochain rappel : 25 du mois (si activé)'}
                    {enabled && !inWindow && !monthDone && ' · Prochain bandeau : 25'}
                    {enabled && inWindow && monthDone && ` · ${formatMonthLabel(monthKey)} validé ✓`}
                    {enabled && inWindow && !monthDone && ` · En cours : ${doneCount}/${clients.length}`}
                </p>

                {enabled && inWindow && !monthDone && clients.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-[#262626]">
                        {clients.map((client) => {
                            const done = doneIds.includes(client.id);
                            return (
                                <div key={client.id} className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleClientDone(client.id, monthKey)}
                                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                            done ? 'text-white border-transparent' : 'border-slate-300 dark:border-slate-600'
                                        }`}
                                        style={done ? { backgroundColor: accent } : undefined}
                                        aria-pressed={done}
                                    >
                                        <Check size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/client/${encodeURIComponent(client.id)}`)}
                                        className={`text-xs truncate text-left ${
                                            done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200 hover:underline'
                                        }`}
                                    >
                                        {client.clientName}
                                    </button>
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => {
                                const pending = clients.length - doneCount;
                                if (pending > 0) {
                                    const ok = window.confirm(
                                        `${pending} client${pending > 1 ? 's' : ''} non coché${pending > 1 ? 's' : ''}. Terminer quand même ?`,
                                    );
                                    if (!ok) return;
                                }
                                completeMonth(monthKey);
                            }}
                            className="mt-2 w-full px-2.5 py-1.5 rounded-md text-xs font-semibold text-white"
                            style={{ backgroundColor: accent }}
                        >
                            OK, c’est fait
                        </button>
                    </div>
                )}

                {enabled && clients.length === 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300/90">
                        Aucun client dans ce dossier — déplace un client en Maintenance pour qu’il apparaisse le 25.
                    </p>
                )}
            </div>
        </div>
    );
};
