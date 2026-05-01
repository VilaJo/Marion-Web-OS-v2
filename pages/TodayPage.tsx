/**
 * "Ma journée" — prioritized agenda, tasks, and invoice alerts for the next 7 days.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores';
import { useProjects } from '../services/queries';
import { Project, CalendarEvent, Task, Invoice } from '../types';
import { formatCurrency } from '../utils';
import { Calendar, AlertTriangle, CheckSquare, FileText, ChevronRight, Sun } from 'lucide-react';

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

export const TodayPage: React.FC = () => {
    const navigate = useNavigate();
    const { data: projects = [] } = useProjects();
    const { events } = useProjectStore();

    const today = startOfDay(new Date());
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const todayEvents = useMemo(
        () => events.filter((e: CalendarEvent) => e.date === todayStr),
        [events, todayStr],
    );

    type TaskRow = { task: Task; projectName: string; projectId: string };
    const overdueTasks = useMemo(() => {
        const rows: TaskRow[] = [];
        for (const p of projects) {
            for (const t of p.tasks) {
                if (t.completed || !t.dueDate) continue;
                if (t.dueDate < todayStr) rows.push({ task: t, projectName: p.clientName, projectId: p.id });
            }
        }
        return rows.sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || ''));
    }, [projects, todayStr]);

    const urgentTasks = useMemo(() => {
        const rows: TaskRow[] = [];
        for (const p of projects) {
            for (const t of p.tasks) {
                if (t.completed || t.priority !== 'High') continue;
                rows.push({ task: t, projectName: p.clientName, projectId: p.id });
            }
        }
        return rows.slice(0, 12);
    }, [projects]);

    type InvRow = { invoice: Invoice; project: Project };
    const invoiceAlerts = useMemo(() => {
        const rows: InvRow[] = [];
        const limit = addDays(today, 3);
        const limitStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
        for (const p of projects) {
            for (const inv of p.invoices) {
                if (inv.type !== 'Invoice') continue;
                if (inv.status === 'Paid') continue;
                if (!inv.dueDate) continue;
                const due = startOfDay(new Date(inv.dueDate + 'T12:00:00'));
                if (due <= limit) rows.push({ invoice: inv, project: p });
            }
        }
        rows.sort((a, b) => (a.invoice.dueDate || '').localeCompare(b.invoice.dueDate || ''));
        return rows;
    }, [projects, today]);

    const overdueInvoices = useMemo(
        () => invoiceAlerts.filter(({ invoice: inv }) => inv.dueDate && new Date(inv.dueDate + 'T12:00:00') < today),
        [invoiceAlerts, today],
    );

    const weekDays = useMemo(() => {
        const days: { label: string; iso: string; eventCount: number; invoiceDue: number }[] = [];
        for (let i = 0; i < 7; i++) {
            const d = addDays(today, i);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const eventCount = events.filter((e: CalendarEvent) => e.date === iso).length;
            let invoiceDue = 0;
            for (const p of projects) {
                for (const inv of p.invoices) {
                    if (inv.type !== 'Invoice' || inv.status === 'Paid' || !inv.dueDate) continue;
                    if (inv.dueDate === iso) invoiceDue += 1;
                }
            }
            days.push({
                label: d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' }),
                iso,
                eventCount,
                invoiceDue,
            });
        }
        return days;
    }, [events, projects, today]);

    const topThree = useMemo(() => {
        const items: { key: string; title: string; subtitle: string; onClick: () => void; tone: 'danger' | 'warning' | 'info' }[] = [];
        if (overdueInvoices[0]) {
            const { invoice: inv, project: p } = overdueInvoices[0];
            items.push({
                key: `inv-${inv.id}`,
                title: `Facture en retard : ${inv.number}`,
                subtitle: p.clientName,
                onClick: () => navigate(`/client/${encodeURIComponent(p.id)}/invoice?invoiceId=${encodeURIComponent(inv.id)}`),
                tone: 'danger',
            });
        }
        if (overdueTasks[0]) {
            const { task, projectName, projectId } = overdueTasks[0];
            items.push({
                key: `task-${task.id}`,
                title: `Tâche en retard : ${task.title}`,
                subtitle: projectName,
                onClick: () => navigate(`/client/${encodeURIComponent(projectId)}`),
                tone: 'warning',
            });
        }
        if (todayEvents[0]) {
            const ev = todayEvents[0];
            items.push({
                key: `ev-${ev.id}`,
                title: `Aujourd'hui : ${ev.title}`,
                subtitle: `${ev.startTime || ''} · ${ev.type || ''}`,
                onClick: () => navigate('/'),
                tone: 'info',
            });
        }
        while (items.length < 3) {
            if (items.length >= 3) break;
            const ut = urgentTasks.find((u) => !items.some((it) => it.key === `task-${u.task.id}`));
            if (ut) {
                items.push({
                    key: `task-${ut.task.id}`,
                    title: `Priorité : ${ut.task.title}`,
                    subtitle: ut.projectName,
                    onClick: () => navigate(`/client/${encodeURIComponent(ut.projectId)}`),
                    tone: 'warning',
                });
                continue;
            }
            const ia = invoiceAlerts.find((row) => !items.some((it) => it.key === `inv-${row.invoice.id}`));
            if (ia) {
                items.push({
                    key: `inv-${ia.invoice.id}`,
                    title: `Échéance proche : ${ia.invoice.number}`,
                    subtitle: ia.project.clientName,
                    onClick: () => navigate(`/client/${encodeURIComponent(ia.project.id)}`),
                    tone: 'info',
                });
                continue;
            }
            break;
        }
        return items.slice(0, 3);
    }, [overdueInvoices, overdueTasks, todayEvents, urgentTasks, invoiceAlerts, navigate]);

    const toneRing = (t: string) =>
        t === 'danger'
            ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/20'
            : t === 'warning'
              ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20'
              : 'border-sky-200 dark:border-sky-900/50 bg-sky-50/80 dark:bg-sky-950/20';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-8 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Sun className="text-brand-orange" size={28} /> Ma journée
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/finances')}
                    className="text-sm font-semibold text-brand-orange hover:underline self-start sm:self-auto"
                >
                    Voir les finances
                </button>
            </div>

            <section>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Trois priorités</h2>
                {topThree.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Rien d&apos;urgent détecté. Profite-en pour avancer un projet créatif.</p>
                ) : (
                    <ul className="space-y-3">
                        {topThree.map((it) => (
                            <li key={it.key}>
                                <button
                                    type="button"
                                    onClick={it.onClick}
                                    className={`w-full text-left rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 transition hover:brightness-[1.02] ${toneRing(it.tone)}`}
                                >
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{it.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{it.subtitle}</p>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-400 shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-5">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                        <Calendar size={18} className="text-brand-orange" /> Agenda du jour
                    </h3>
                    {todayEvents.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucun événement prévu aujourd&apos;hui.</p>
                    ) : (
                        <ul className="space-y-2">
                            {todayEvents.map((e) => (
                                <li key={e.id} className="text-sm text-slate-700 dark:text-slate-200 flex justify-between gap-2">
                                    <span>{e.title}</span>
                                    <span className="text-slate-400 tabular-nums">{e.startTime}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-5">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                        <FileText size={18} className="text-emerald-500" /> Factures (7 jours)
                    </h3>
                    {invoiceAlerts.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucune échéance dans les 3 prochains jours.</p>
                    ) : (
                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {invoiceAlerts.slice(0, 12).map(({ invoice: inv, project: p }) => (
                                <li key={inv.id}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/client/${encodeURIComponent(p.id)}/invoice?invoiceId=${encodeURIComponent(inv.id)}`)}
                                        className="w-full text-left text-sm flex justify-between gap-2 hover:text-brand-orange"
                                    >
                                        <span className="truncate">
                                            {p.clientName} · {inv.number}
                                        </span>
                                        <span className="text-slate-400 shrink-0">
                                            {inv.dueDate} · {formatCurrency(inv.amount, 0)} {inv.currency || 'CHF'}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-5">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <CheckSquare size={18} className="text-violet-500" /> Cette semaine
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {weekDays.map((d) => (
                        <div
                            key={d.iso}
                            className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-2 text-center"
                        >
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">{d.label}</p>
                            <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">
                                {d.eventCount ? `${d.eventCount} év.` : '—'}
                            </p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">{d.invoiceDue ? `${d.invoiceDue} fact.` : ''}</p>
                        </div>
                    ))}
                </div>
            </section>

            {(overdueTasks.length > 0 || urgentTasks.length > 0) && (
                <section className="rounded-3xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                        <AlertTriangle size={18} className="text-amber-500" /> Tâches à traiter
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {[...overdueTasks.slice(0, 6), ...urgentTasks.filter((u) => !overdueTasks.some((o) => o.task.id === u.task.id)).slice(0, 4)].map(
                            ({ task, projectName, projectId }) => (
                                <li key={task.id}>
                                    <button type="button" className="text-left hover:underline w-full" onClick={() => navigate(`/client/${encodeURIComponent(projectId)}`)}>
                                        <span className="font-medium text-slate-800 dark:text-slate-100">{task.title}</span>
                                        <span className="text-slate-500"> — {projectName}</span>
                                    </button>
                                </li>
                            ),
                        )}
                    </ul>
                </section>
            )}
        </div>
    );
};

export default TodayPage;
