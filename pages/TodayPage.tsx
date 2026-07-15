/**
 * "Ma journée" — prioritized agenda, tasks, and invoice alerts for the next 7 days.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { useProjects } from '../services/queries';
import { Project, CalendarEvent, Task, Invoice } from '../types';
import { formatCurrency } from '../utils';
import { Calendar, AlertTriangle, CheckSquare, FileText, ChevronRight, Sun, Bot, Sparkles, Mail, MessageCircle } from 'lucide-react';

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

function clientEmail(p: Project): string {
    const profile = (p as any).profile || {};
    return String(profile.email || profile.contactEmail || (p as any).email || '').trim();
}

export const TodayPage: React.FC = () => {
    const navigate = useNavigate();
    const { data: projects = [] } = useProjects();
    const { events } = useProjectStore();
    const { setShowChat, setShowMondayBriefing } = useUIStore();

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
                title: task.title,
                subtitle: `Tâche en retard — ${projectName}`,
                onClick: () => navigate(`/client/${encodeURIComponent(projectId)}`),
                tone: 'warning',
            });
        }
        for (const e of todayEvents) {
            if (items.length >= 3) break;
            items.push({
                key: `ev-${e.id}`,
                title: e.title,
                subtitle: `Aujourd'hui · ${e.startTime || ''}`,
                onClick: () => navigate('/'),
                tone: 'info',
            });
        }
        for (const row of urgentTasks) {
            if (items.length >= 3) break;
            if (items.some((it) => it.key === `task-${row.task.id}`)) continue;
            items.push({
                key: `task-${row.task.id}`,
                title: row.task.title,
                subtitle: `Priorité haute — ${row.projectName}`,
                onClick: () => navigate(`/client/${encodeURIComponent(row.projectId)}`),
                tone: 'warning',
            });
        }
        for (const { invoice: inv, project: p } of invoiceAlerts) {
            if (items.length >= 3) break;
            if (items.some((it) => it.key === `inv-${inv.id}`)) continue;
            items.push({
                key: `inv-${inv.id}`,
                title: `Échéance : ${inv.number}`,
                subtitle: `${p.clientName} · ${inv.dueDate}`,
                onClick: () => navigate(`/client/${encodeURIComponent(p.id)}/invoice?invoiceId=${encodeURIComponent(inv.id)}`),
                tone: 'info',
            });
        }
        return items.slice(0, 3);
    }, [overdueInvoices, overdueTasks, todayEvents, urgentTasks, invoiceAlerts, navigate]);

    const askFranck = (prompt?: string) => {
        if (prompt) {
            try {
                sessionStorage.setItem('franck_seed_prompt', prompt);
            } catch {
                // ignore
            }
        }
        setShowChat(true);
    };

    const openReminderEmail = (p: Project, inv: Invoice) => {
        const to = clientEmail(p);
        const amount = formatCurrency(inv.amount, 0);
        const currency = inv.currency || 'CHF';
        navigate('/emails', {
            state: {
                compose: {
                    to,
                    subject: `Relance facture ${inv.number} — ${p.clientName}`,
                    body:
                        `Bonjour,\n\n` +
                        `Sauf erreur de ma part, la facture ${inv.number} (${amount} ${currency}) ` +
                        `échue le ${inv.dueDate || '—'} est toujours en attente de règlement.\n\n` +
                        `Merci de me confirmer la réception de ce message ou de procéder au paiement.\n\n` +
                        `Cordialement,\nMarion`,
                    invoiceHint: {
                        projectId: p.id,
                        invoiceId: inv.id,
                        invoiceNumber: inv.number,
                        clientName: p.clientName,
                        amount: inv.amount,
                        currency,
                        dueDate: inv.dueDate,
                    },
                },
            },
        });
    };

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
                <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setShowMondayBriefing(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orange-50 text-brand-orange border border-orange-200 hover:bg-orange-100 transition-colors"
                    >
                        <Sparkles size={14} /> Briefing
                    </button>
                    <button
                        type="button"
                        onClick={() => askFranck('Qu’est-ce que je dois faire en priorité aujourd’hui ?')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
                    >
                        <Bot size={14} /> Franck
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/emails')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                        <Mail size={14} /> Emails
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/finances')}
                        className="text-sm font-semibold text-brand-orange hover:underline px-2"
                    >
                        Finances
                    </button>
                </div>
            </div>

            <section className="rounded-2xl border border-violet-200/70 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500 mb-2 flex items-center gap-1">
                    <MessageCircle size={12} /> Demande rapide à Franck
                </p>
                <div className="flex flex-wrap gap-2">
                    {[
                        'Qu’est-ce que je dois faire en priorité aujourd’hui ?',
                        'Résume mon agenda et mes factures en retard',
                        overdueInvoices[0]
                            ? `Prépare une relance pour ${overdueInvoices[0].project.clientName}`
                            : 'Aide-moi à planifier ma journée',
                    ].map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => askFranck(prompt)}
                            className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 hover:border-violet-400 transition-colors"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            </section>

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
                                <li key={e.id}>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/')}
                                        className="w-full text-sm text-slate-700 dark:text-slate-200 flex justify-between gap-2 hover:text-brand-orange text-left"
                                    >
                                        <span>{e.title}</span>
                                        <span className="text-slate-400 tabular-nums">{e.startTime}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-5">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                        <FileText size={18} className="text-emerald-500" /> Factures (3 jours)
                    </h3>
                    {invoiceAlerts.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucune échéance dans les 3 prochains jours.</p>
                    ) : (
                        <ul className="space-y-2 max-h-56 overflow-y-auto">
                            {invoiceAlerts.slice(0, 12).map(({ invoice: inv, project: p }) => {
                                const late = !!(inv.dueDate && new Date(inv.dueDate + 'T12:00:00') < today);
                                return (
                                    <li key={inv.id} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/client/${encodeURIComponent(p.id)}/invoice?invoiceId=${encodeURIComponent(inv.id)}`)}
                                            className="flex-1 text-left text-sm flex justify-between gap-2 hover:text-brand-orange min-w-0"
                                        >
                                            <span className="truncate">
                                                {p.clientName} · {inv.number}
                                                {late ? ' · retard' : ''}
                                            </span>
                                            <span className="text-slate-400 shrink-0">
                                                {inv.dueDate} · {formatCurrency(inv.amount, 0)} {inv.currency || 'CHF'}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openReminderEmail(p, inv)}
                                            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
                                            title="Préparer un email de relance"
                                        >
                                            Relancer
                                        </button>
                                    </li>
                                );
                            })}
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
                        <button
                            key={d.iso}
                            type="button"
                            onClick={() => navigate('/')}
                            className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-2 text-center hover:border-brand-orange/40 transition-colors"
                        >
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">{d.label}</p>
                            <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">
                                {d.eventCount ? `${d.eventCount} év.` : '—'}
                            </p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">{d.invoiceDue ? `${d.invoiceDue} fact.` : ''}</p>
                        </button>
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
