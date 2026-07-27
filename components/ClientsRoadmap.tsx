/**
 * ClientsRoadmap — Linear-style project timeline (3 months)
 *
 * Left: client list with open-task counts.
 * Right: month/week grid, task bars ending on due dates, diamond milestones, today line.
 */

import React, { useMemo, useState } from 'react';
import {
    ChevronLeft, ChevronRight, Sparkles, Circle, CheckCircle2, CircleDot, Folder, FolderOpen,
} from 'lucide-react';
import { Project, ProjectStatus, WorkflowPhase } from '../types';
import { getNextDeadline, getProjectHealth, FOLDER_STATUS_COLOR } from '../utils/projectHealth';

export interface ClientsRoadmapProps {
    projects: Project[];
    onOpenProject: (projectId: string) => void;
    searchQuery: string;
}

type TimelineTask = {
    id: string;
    title: string;
    dueDate: string;
    completed: boolean;
    column?: string;
};

const DEFAULT_BAR_DAYS = 14;

/** Couleurs par étape kanban (todo / doing / done) + retard */
const STAGE_COLOR = {
    todo: '#8B92A5',
    doing: '#4a72c4',
    done: '#2aada0',
    overdue: '#b05070',
} as const;

type StageKey = keyof typeof STAGE_COLOR;

function stageOf(task: TimelineTask, overdue: boolean): StageKey {
    if (task.completed || task.column === 'done') return 'done';
    if (overdue) return 'overdue';
    if (task.column === 'doing') return 'doing';
    return 'todo';
}

const FOLDER_ORDER: ProjectStatus[] = [
    ProjectStatus.EN_COURS,
    ProjectStatus.MAINTENANCE,
    ProjectStatus.ASSOCIATION,
    ProjectStatus.PROSPECT,
    ProjectStatus.ARCHIVED,
];

const STATUS_DOT = FOLDER_STATUS_COLOR;

const HEALTH_DOT: Record<'good' | 'warning' | 'danger', string> = {
    good: '#2aada0',
    warning: '#d4a017',
    danger: '#b05070',
};

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function daysInMonth(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function monthShort(d: Date): string {
    return d.toLocaleDateString('fr-CH', { month: 'short' }).replace('.', '').toUpperCase();
}

function buildDemoProjects(): Project[] {
    const now = new Date();
    const iso = (offsetDays: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().slice(0, 10);
    };
    const mk = (
        name: string,
        color: string,
        tasks: { title: string; offset: number; completed?: boolean; column?: 'todo' | 'doing' | 'done' }[],
    ): Project => ({
        id: `demo/${name.toLowerCase().replace(/\s+/g, '-')}`,
        clientName: name,
        avatarInitials: name.slice(0, 2).toUpperCase(),
        avatarColor: color,
        status: ProjectStatus.EN_COURS,
        phase: WorkflowPhase.DESIGN,
        progress: 40,
        createdAt: now.toISOString(),
        profile: { email: '', phone: '', website: '', address: '', driveLink: '', serverAccess: '', customFields: [] },
        tasks: tasks.map((t, i) => ({
            id: `demo-task-${name}-${i}`,
            title: t.title,
            completed: Boolean(t.completed),
            priority: 'Medium' as const,
            column: t.column || (t.completed ? 'done' : 'todo'),
            phase: WorkflowPhase.DESIGN,
            dueDate: iso(t.offset),
        })),
        invoices: [],
        brandKit: { colors: [], fonts: [] },
        credentials: [],
    });

    return [
        mk('Atelier Nord', 'from-[#4a72c4] to-[#2aada0]', [
            { title: 'UI Refresh', offset: 8, column: 'doing' },
            { title: 'Core screens', offset: 22 },
            { title: 'Polish', offset: 40 },
            { title: 'Public Beta', offset: 62 },
        ]),
        mk('Clinique Léman', 'from-[#b05070] to-[#4a72c4]', [
            { title: 'Formulaire RDV', offset: 5, completed: true, column: 'done' },
            { title: 'SEO local', offset: 28 },
            { title: 'Go-live', offset: 55 },
        ]),
        mk('Maison Verte', 'from-[#7C9A7E] to-[#2aada0]', [
            { title: 'Photos produits', offset: 12 },
            { title: 'Checkout Stripe', offset: 35 },
            { title: 'Livraison v1', offset: 68 },
        ]),
        mk('Bureau Alpin', 'from-[#4a72c4] to-[#b05070]', [
            { title: 'Infra stability', offset: 15, column: 'doing' },
            { title: 'Mobile apps', offset: 48 },
        ]),
    ];
}

function StatusIcon({ task, color }: { task: TimelineTask; color: string }) {
    if (task.completed || task.column === 'done') {
        return <CheckCircle2 size={12} className="shrink-0" style={{ color }} />;
    }
    if (task.column === 'doing') {
        return <CircleDot size={12} className="shrink-0" style={{ color }} />;
    }
    return <Circle size={12} className="shrink-0" style={{ color }} />;
}

export const ClientsRoadmap: React.FC<ClientsRoadmapProps> = ({
    projects,
    onOpenProject,
    searchQuery,
}) => {
    const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
    const [useDemo, setUseDemo] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [folder, setFolder] = useState<string>('Tous');

    const months = useMemo(
        () => [anchor, addMonths(anchor, 1), addMonths(anchor, 2)],
        [anchor],
    );

    const sourceProjects = useDemo ? buildDemoProjects() : projects;

    const folderCounts = useMemo(() => {
        const counts: Record<string, number> = { Tous: sourceProjects.length };
        for (const status of FOLDER_ORDER) {
            counts[status] = sourceProjects.filter((p) => p.status === status).length;
        }
        return counts;
    }, [sourceProjects]);

    const { rows, hasDatedTasks } = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let filtered = sourceProjects;
        if (folder !== 'Tous') {
            filtered = filtered.filter((p) => p.status === folder);
        }
        if (query) {
            filtered = filtered.filter((p) => p.clientName.toLowerCase().includes(query));
        }

        const rangeStart = months[0];
        const rangeEnd = addMonths(months[2], 1);
        const rangeStartMs = rangeStart.getTime();
        const rangeEndMs = rangeEnd.getTime();

        let dated = 0;
        const mapped = filtered.map((project) => {
            const openCount = project.tasks.filter((t) => !t.completed && t.column !== 'done').length;
            const next = getNextDeadline(project);
            const health = getProjectHealth(project);
            const tasks: TimelineTask[] = project.tasks
                .filter((t) => t.dueDate)
                .map((t) => {
                    dated += 1;
                    return {
                        id: t.id,
                        title: t.title,
                        dueDate: t.dueDate!,
                        completed: t.completed,
                        column: t.column,
                    };
                })
                .filter((t) => {
                    const ms = new Date(t.dueDate).getTime();
                    return ms >= rangeStartMs && ms < rangeEndMs;
                })
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            return { project, tasks, openCount, next, health };
        });

        mapped.sort((a, b) => {
            // Active work first, then soonest deadline, then name
            if (b.openCount !== a.openCount) return b.openCount - a.openCount;
            const ad = a.next?.date || '9999';
            const bd = b.next?.date || '9999';
            if (ad !== bd) return ad.localeCompare(bd);
            return a.project.clientName.localeCompare(b.project.clientName, 'fr');
        });

        const rowsOut = useDemo
            ? mapped.filter((r) => r.tasks.length > 0)
            : mapped;

        return { rows: rowsOut, hasDatedTasks: dated > 0 };
    }, [sourceProjects, searchQuery, months, useDemo, folder]);

    const totalDays = months.reduce((sum, m) => sum + daysInMonth(m), 0);
    const rangeStart = months[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOffsetDays = Math.floor((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const todayPct = todayOffsetDays >= 0 && todayOffsetDays <= totalDays
        ? (todayOffsetDays / totalDays) * 100
        : null;

    const dayOffset = (dateStr: string): number => {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        return Math.floor((d.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    };

    const pct = (days: number) => Math.min(100, Math.max(0, (days / totalDays) * 100));

    /** Week tick marks under each month (approx every 7 days) */
    const weekTicks = useMemo(() => {
        const ticks: { label: string; pct: number }[] = [];
        let offset = 0;
        for (const m of months) {
            const dim = daysInMonth(m);
            for (let day = 1; day <= dim; day += 7) {
                ticks.push({
                    label: String(day),
                    pct: ((offset + day - 1) / totalDays) * 100,
                });
            }
            offset += dim;
        }
        return ticks;
    }, [months, totalDays]);

    const visibleRows = selectedId
        ? rows.filter((r) => r.project.id === selectedId)
        : rows;

    const totalOpen = rows.reduce((n, r) => n + r.openCount, 0);

    const formatDue = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }).replace('.', '');
    };

    return (
        <div className="rounded-lg border border-[#E4E6EA] dark:border-[#262626] bg-white dark:bg-[#151516] overflow-hidden flex flex-col md:flex-row min-h-[460px] shadow-sm dark:shadow-none">
            {/* Left rail — dossiers + clients */}
            <aside className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-[#E4E6EA] dark:border-[#262626] flex flex-col bg-[#F4F5F7] dark:bg-[#111318] max-h-[70vh] md:max-h-none">
                {/* Dossiers */}
                <div className="border-b border-slate-100 dark:border-[#262626]">
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8A8A8E]">
                            Dossiers
                        </span>
                        <span className="text-[10px] tabular-nums text-slate-400 dark:text-[#8A8A8E]">
                            {folderCounts.Tous}
                        </span>
                    </div>
                    <div className="px-1.5 pb-2 space-y-0.5 max-h-40 overflow-y-auto md:max-h-none">
                        <button
                            type="button"
                            onClick={() => { setFolder('Tous'); setSelectedId(null); }}
                            className={`relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[13px] transition-colors ${
                                folder === 'Tous'
                                    ? 'bg-slate-200/70 dark:bg-white/[0.06] text-slate-900 dark:text-white font-medium'
                                    : 'text-slate-600 dark:text-[#8A8A8E] hover:bg-slate-100/80 dark:hover:bg-white/[0.03]'
                            }`}
                        >
                            {folder === 'Tous' && (
                                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#4a72c4]" />
                            )}
                            {folder === 'Tous' ? <FolderOpen size={13} className="shrink-0" /> : <Folder size={13} className="shrink-0 opacity-70" />}
                            <span className="flex-1 truncate">Tous</span>
                            <span className="text-[11px] tabular-nums text-slate-400 dark:text-[#8A8A8E]">{folderCounts.Tous}</span>
                        </button>
                        {FOLDER_ORDER.map((status) => {
                            const active = folder === status;
                            return (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => { setFolder(status); setSelectedId(null); }}
                                    className={`relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[13px] transition-colors ${
                                        active
                                            ? 'bg-slate-200/70 dark:bg-white/[0.06] text-slate-900 dark:text-white font-medium'
                                            : 'text-slate-600 dark:text-[#8A8A8E] hover:bg-slate-100/80 dark:hover:bg-white/[0.03]'
                                    }`}
                                >
                                    {active && (
                                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#4a72c4]" />
                                    )}
                                    <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: STATUS_DOT[status] }}
                                    />
                                    <span className="flex-1 truncate">{status}</span>
                                    <span className="text-[11px] tabular-nums text-slate-400 dark:text-[#8A8A8E]">
                                        {folderCounts[status] || 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Clients */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-[#262626] flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8A8A8E]">
                        Clients
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-400 dark:text-[#8A8A8E]">
                        {rows.length} · {totalOpen} ouvertes
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto py-1 min-h-0">
                    <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-[13px] transition-colors ${
                            selectedId === null
                                ? 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-900 dark:text-white font-medium'
                                : 'text-slate-600 dark:text-[#8A8A8E] hover:bg-slate-100/80 dark:hover:bg-white/[0.03]'
                        }`}
                    >
                        <span>Tous les clients</span>
                        <span className="text-[11px] tabular-nums text-slate-400 dark:text-[#8A8A8E]">{rows.length}</span>
                    </button>
                    {rows.length === 0 && (
                        <p className="px-3 py-4 text-[12px] text-slate-400 dark:text-[#8A8A8E]">
                            Aucun client dans ce dossier.
                        </p>
                    )}
                    {rows.map(({ project, openCount, next, health }) => {
                        const active = selectedId === project.id;
                        return (
                            <button
                                key={project.id}
                                type="button"
                                onClick={() => setSelectedId(project.id === selectedId ? null : project.id)}
                                onDoubleClick={() => !useDemo && onOpenProject(project.id)}
                                className={`relative w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                                    active
                                        ? 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-900 dark:text-white'
                                        : 'text-slate-600 dark:text-[#8A8A8E] hover:bg-slate-100/80 dark:hover:bg-white/[0.03]'
                                }`}
                                title="Clic = filtrer · Double-clic = ouvrir"
                            >
                                {active && (
                                    <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-[#4a72c4]" />
                                )}
                                <span
                                    className={`mt-0.5 w-6 h-6 rounded-[6px] bg-gradient-to-br ${project.avatarColor || 'from-[#4a72c4] to-[#2aada0]'} flex items-center justify-center text-white text-[9px] font-semibold shrink-0 overflow-hidden`}
                                >
                                    {project.avatarImage ? (
                                        <img src={project.avatarImage} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        project.avatarInitials
                                    )}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-1.5">
                                        <span className={`truncate text-[13px] ${active ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {project.clientName}
                                        </span>
                                        <span
                                            className="w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: HEALTH_DOT[health] }}
                                            title={health}
                                        />
                                    </span>
                                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-[#8A8A8E]">
                                        <span
                                            className="w-1 h-1 rounded-full shrink-0"
                                            style={{ backgroundColor: STATUS_DOT[project.status] || '#8A8A8E' }}
                                        />
                                        <span className="truncate">{project.status}</span>
                                        {next && (
                                            <>
                                                <span className="opacity-40">·</span>
                                                <span className="truncate tabular-nums">{formatDue(next.date)}</span>
                                            </>
                                        )}
                                    </span>
                                </span>
                                <span className={`text-[11px] tabular-nums shrink-0 mt-0.5 ${
                                    openCount > 0
                                        ? 'text-slate-600 dark:text-slate-300 font-medium'
                                        : 'text-slate-400 dark:text-[#8A8A8E]'
                                }`}>
                                    {openCount}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Timeline */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-[#262626]">
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => setAnchor((a) => addMonths(a, -1))}
                            className="p-1 rounded text-slate-500 dark:text-[#8A8A8E] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                            title="Mois précédent"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setAnchor(startOfMonth(new Date()))}
                            className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                            Aujourd&apos;hui
                        </button>
                        <button
                            type="button"
                            onClick={() => setAnchor((a) => addMonths(a, 1))}
                            className="p-1 rounded text-slate-500 dark:text-[#8A8A8E] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                            title="Mois suivant"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-slate-400 dark:text-[#8A8A8E]">
                            {([
                                ['todo', 'À faire'],
                                ['doing', 'En cours'],
                                ['done', 'Terminé'],
                                ['overdue', 'Retard'],
                            ] as const).map(([key, label]) => (
                                <span key={key} className="inline-flex items-center gap-1">
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: STAGE_COLOR[key] }}
                                    />
                                    {label}
                                </span>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setUseDemo((v) => !v)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                                useDemo
                                    ? 'text-[#4a72c4] bg-[#4a72c4]/10'
                                    : 'text-slate-500 dark:text-[#8A8A8E] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                            }`}
                        >
                            <Sparkles size={11} />
                            {useDemo ? 'Données réelles' : 'Démo'}
                        </button>
                    </div>
                </div>

                {!hasDatedTasks && !useDemo && rows.length > 0 && (
                    <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-[#8A8A8E] border-b border-slate-100 dark:border-[#262626]">
                        Aucune tâche datée sur ces 3 mois — ajoute des échéances ou active la Démo.
                    </div>
                )}

                {visibleRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-sm text-slate-500">
                        Aucun client à afficher.
                        {!useDemo && (
                            <button
                                type="button"
                                onClick={() => setUseDemo(true)}
                                className="mt-2 text-[11px] font-medium text-[#4a72c4] hover:underline"
                            >
                                Charger une démo
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto">
                        <div className="min-w-[680px]">
                            {/* Month + week header */}
                            <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#151516]/95 backdrop-blur-sm border-b border-slate-100 dark:border-[#262626]">
                                <div className="flex">
                                    <div className="w-40 shrink-0" />
                                    <div className="flex-1 flex relative h-7">
                                        {months.map((m) => (
                                            <div
                                                key={m.toISOString()}
                                                className="flex items-end px-2 pb-0.5 text-[10px] font-semibold tracking-[0.16em] text-slate-400 dark:text-[#8A8A8E] border-r border-slate-100 dark:border-[#262626]/80 last:border-r-0"
                                                style={{ flexGrow: daysInMonth(m), flexBasis: 0 }}
                                            >
                                                {monthShort(m)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex h-5">
                                    <div className="w-40 shrink-0" />
                                    <div className="flex-1 relative">
                                        {weekTicks.map((t) => (
                                            <span
                                                key={`${t.pct}-${t.label}`}
                                                className="absolute top-0 text-[9px] tabular-nums text-slate-400/80 dark:text-[#8A8A8E]/80 -translate-x-1/2"
                                                style={{ left: `${t.pct}%` }}
                                            >
                                                {t.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Rows */}
                            {visibleRows.map(({ project, tasks }) => {
                                return (
                                    <div
                                        key={project.id}
                                        className="flex border-b border-slate-50 dark:border-white/[0.04] last:border-b-0 group/row"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => !useDemo && onOpenProject(project.id)}
                                            className="w-40 shrink-0 px-3 py-3.5 flex items-center gap-2 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.03] border-r border-transparent group-hover/row:border-slate-100 dark:group-hover/row:border-white/[0.04]"
                                        >
                                            <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
                                                {project.clientName}
                                            </span>
                                        </button>

                                        <div
                                            className="flex-1 relative"
                                            style={{ minHeight: Math.max(64, 36 + tasks.length * 36) }}
                                        >
                                            {/* Vertical week grid (dashed) */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {weekTicks.map((t) => (
                                                    <div
                                                        key={`grid-${t.pct}`}
                                                        className="absolute top-0 bottom-0 border-l border-dashed border-slate-200/70 dark:border-white/[0.055]"
                                                        style={{ left: `${t.pct}%` }}
                                                    />
                                                ))}
                                                {months.slice(1).map((m) => {
                                                    let off = 0;
                                                    for (const mm of months) {
                                                        if (mm.getTime() === m.getTime()) break;
                                                        off += daysInMonth(mm);
                                                    }
                                                    return (
                                                        <div
                                                            key={`month-${m.toISOString()}`}
                                                            className="absolute top-0 bottom-0 border-l border-slate-200 dark:border-white/[0.1]"
                                                            style={{ left: `${pct(off)}%` }}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {/* Today */}
                                            {todayPct !== null && (
                                                <div
                                                    className="absolute top-0 bottom-0 w-px bg-[#b05070] z-20 pointer-events-none"
                                                    style={{ left: `${todayPct}%` }}
                                                    title="Aujourd'hui"
                                                >
                                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#b05070]" />
                                                </div>
                                            )}

                                            {/* Task bars — schedule track; solid fill = done / en cours jusqu'à aujourd'hui */}
                                            {tasks.map((task, i) => {
                                                const endOff = dayOffset(task.dueDate);
                                                const startOff = Math.max(0, endOff - DEFAULT_BAR_DAYS);
                                                const left = pct(startOff);
                                                const width = Math.max(2.8, pct(endOff) - left);
                                                const top = 12 + i * 36;
                                                const done = task.completed || task.column === 'done';
                                                const doing = task.column === 'doing';
                                                const overdue = !done && todayOffsetDays > endOff;
                                                const span = Math.max(1, endOff - startOff);
                                                const stage = stageOf(task, overdue);
                                                const barColor = STAGE_COLOR[stage];

                                                // Planned = dashed only. Doing = calendar progress. Done/overdue = full.
                                                let fillPct = 0;
                                                if (done || overdue) {
                                                    fillPct = 100;
                                                } else if (doing) {
                                                    if (todayOffsetDays <= startOff) fillPct = 10;
                                                    else if (todayOffsetDays >= endOff) fillPct = 100;
                                                    else fillPct = ((todayOffsetDays - startOff) / span) * 100;
                                                }

                                                let statusLabel: string;
                                                switch (stage) {
                                                    case 'done':
                                                        statusLabel = 'Terminé';
                                                        break;
                                                    case 'overdue':
                                                        statusLabel = 'En retard';
                                                        break;
                                                    case 'doing':
                                                        statusLabel = 'En cours';
                                                        break;
                                                    case 'todo':
                                                        statusLabel = 'À faire';
                                                        break;
                                                    default: {
                                                        const _exhaustive: never = stage;
                                                        statusLabel = _exhaustive;
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={task.id}
                                                        className="absolute z-10"
                                                        style={{ left: `${left}%`, width: `${width}%`, top }}
                                                        title={`${task.title} · échéance ${task.dueDate} · ${statusLabel}`}
                                                    >
                                                        <div className="flex items-center gap-1 mb-0.5 -ml-0.5 min-w-0">
                                                            <StatusIcon task={task} color={barColor} />
                                                            <span className={`text-[11px] font-medium truncate ${done ? 'text-slate-400 dark:text-[#8A8A8E] line-through' : 'text-slate-700 dark:text-slate-100'}`}>
                                                                {task.title}
                                                            </span>
                                                        </div>
                                                        <div className="relative h-[7px]">
                                                            {/* Schedule track (dashed, stage-tinted) */}
                                                            <div
                                                                className="absolute inset-0 rounded-full"
                                                                style={{
                                                                    backgroundImage: `repeating-linear-gradient(90deg, ${barColor}66 0 3px, transparent 3px 7px)`,
                                                                    backgroundColor: `${barColor}14`,
                                                                }}
                                                            />
                                                            {/* Progress fill — only done / doing / overdue */}
                                                            {fillPct > 0 && (
                                                                <div
                                                                    className={`absolute inset-y-0 left-0 rounded-full ${done ? 'opacity-55' : 'opacity-100'}`}
                                                                    style={{
                                                                        width: `${fillPct}%`,
                                                                        backgroundColor: barColor,
                                                                    }}
                                                                />
                                                            )}
                                                            {/* Milestone diamond at due date */}
                                                            <div
                                                                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 border border-white dark:border-[#151516]"
                                                                style={{
                                                                    right: -2,
                                                                    backgroundColor: barColor,
                                                                    opacity: done ? 0.55 : 1,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {tasks.length === 0 && (
                                                <div className="absolute inset-0 flex items-center px-3">
                                                    <span className="text-[11px] text-slate-400 dark:text-[#8A8A8E] italic">Pas d’échéance</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientsRoadmap;
