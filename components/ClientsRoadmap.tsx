/**
 * ClientsRoadmap — Linear-style 3-month horizontal timeline of dated tasks
 */

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Project, ProjectStatus, WorkflowPhase } from '../types';

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
    projectId: string;
    clientName: string;
    avatarInitials: string;
    avatarColor?: string;
    avatarImage?: string;
};

const PRIORITY_COLORS = ['#b05070', '#4a72c4', '#2aada0', '#7C9A7E'];

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function daysInMonth(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function monthLabel(d: Date): string {
    return d.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
}

function buildDemoProjects(): Project[] {
    const now = new Date();
    const iso = (offsetDays: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().slice(0, 10);
    };
    const mk = (name: string, color: string, tasks: { title: string; offset: number }[]): Project => ({
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
            completed: false,
            priority: 'Medium' as const,
            column: 'todo' as const,
            phase: WorkflowPhase.DESIGN,
            dueDate: iso(t.offset),
        })),
        invoices: [],
        brandKit: { colors: [], fonts: [] },
        credentials: [],
    });

    return [
        mk('Atelier Nord', 'from-[#4a72c4] to-[#2aada0]', [
            { title: 'Wireframes homepage', offset: 3 },
            { title: 'Revue design', offset: 18 },
            { title: 'Livraison v1', offset: 45 },
        ]),
        mk('Clinique Léman', 'from-[#b05070] to-[#4a72c4]', [
            { title: 'Formulaire RDV', offset: 7 },
            { title: 'SEO local', offset: 28 },
        ]),
        mk('Maison Verte', 'from-[#7C9A7E] to-[#2aada0]', [
            { title: 'Photos produits', offset: 12 },
            { title: 'Checkout Stripe', offset: 35 },
            { title: 'Go-live', offset: 60 },
        ]),
    ];
}

export const ClientsRoadmap: React.FC<ClientsRoadmapProps> = ({
    projects,
    onOpenProject,
    searchQuery,
}) => {
    const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
    const [useDemo, setUseDemo] = useState(false);

    const months = useMemo(
        () => [anchor, addMonths(anchor, 1), addMonths(anchor, 2)],
        [anchor],
    );

    const sourceProjects = useDemo ? buildDemoProjects() : projects;

    const { rows, hasDatedTasks } = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? sourceProjects.filter((p) => p.clientName.toLowerCase().includes(query))
            : sourceProjects;

        const rangeStart = months[0];
        const rangeEnd = addMonths(months[2], 1);
        const rangeStartMs = rangeStart.getTime();
        const rangeEndMs = rangeEnd.getTime();

        let dated = 0;
        const mapped = filtered.map((project) => {
            const tasks: TimelineTask[] = project.tasks
                .filter((t) => t.dueDate)
                .map((t) => {
                    dated += 1;
                    return {
                        id: t.id,
                        title: t.title,
                        dueDate: t.dueDate!,
                        completed: t.completed,
                        projectId: project.id,
                        clientName: project.clientName,
                        avatarInitials: project.avatarInitials,
                        avatarColor: project.avatarColor,
                        avatarImage: project.avatarImage,
                    };
                })
                .filter((t) => {
                    const ms = new Date(t.dueDate).getTime();
                    return ms >= rangeStartMs && ms < rangeEndMs;
                });
            return { project, tasks };
        }).filter((row) => row.tasks.length > 0 || !useDemo);

        // In real mode, still show clients even without dated tasks in range (empty row)
        const rowsOut = useDemo
            ? mapped.filter((r) => r.tasks.length > 0)
            : mapped.length > 0
                ? filtered.map((project) => ({
                    project,
                    tasks: mapped.find((m) => m.project.id === project.id)?.tasks ?? [],
                }))
                : [];

        return { rows: rowsOut, hasDatedTasks: dated > 0 };
    }, [sourceProjects, searchQuery, months, useDemo]);

    const totalDays = months.reduce((sum, m) => sum + daysInMonth(m), 0);
    const rangeStart = months[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOffsetDays = Math.floor((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const todayPct = todayOffsetDays >= 0 && todayOffsetDays <= totalDays
        ? (todayOffsetDays / totalDays) * 100
        : null;

    const positionForDate = (dateStr: string): number => {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const offset = Math.floor((d.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
        return Math.min(100, Math.max(0, (offset / totalDays) * 100));
    };

    return (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setAnchor((a) => addMonths(a, -1))}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Mois précédent"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setAnchor(startOfMonth(new Date()))}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        Aujourd&apos;hui
                    </button>
                    <button
                        type="button"
                        onClick={() => setAnchor((a) => addMonths(a, 1))}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Mois suivant"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <span className="ml-2 text-xs font-medium text-slate-500 capitalize">
                        {monthLabel(months[0])} → {monthLabel(months[2])}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setUseDemo((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        useDemo
                            ? 'border-[#4a72c4]/40 bg-[#4a72c4]/10 text-[#4a72c4]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Sparkles size={12} />
                    {useDemo ? 'Données réelles' : 'Démo'}
                </button>
            </div>

            {!hasDatedTasks && !useDemo && rows.length > 0 && (
                <div className="px-3 py-2 text-[11px] text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    Aucune tâche datée sur ces 3 mois — ajoute des dueDate ou active la Démo.
                </div>
            )}

            {rows.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500">
                    Aucun client à afficher.
                    {!useDemo && (
                        <button
                            type="button"
                            onClick={() => setUseDemo(true)}
                            className="block mx-auto mt-2 text-[11px] font-medium text-[#4a72c4] hover:underline"
                        >
                            Charger une démo
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                        {/* Month headers */}
                        <div className="flex border-b border-slate-100 dark:border-slate-800">
                            <div className="w-44 shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-r border-slate-100 dark:border-slate-800">
                                Client
                            </div>
                            <div className="flex-1 flex relative">
                                {months.map((m) => (
                                    <div
                                        key={m.toISOString()}
                                        className="flex-1 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-r border-slate-100 dark:border-slate-800 last:border-r-0 capitalize"
                                        style={{ flexGrow: daysInMonth(m), flexBasis: 0 }}
                                    >
                                        {monthLabel(m)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows */}
                        {rows.map(({ project, tasks }, rowIdx) => (
                            <div
                                key={project.id}
                                className="flex border-b border-slate-50 dark:border-slate-800/80 last:border-b-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <button
                                    type="button"
                                    onClick={() => !useDemo && onOpenProject(project.id)}
                                    className="w-44 shrink-0 px-3 py-3 flex items-center gap-2 border-r border-slate-100 dark:border-slate-800 text-left"
                                >
                                    <div
                                        className={`w-7 h-7 rounded-md bg-gradient-to-br ${project.avatarColor || 'from-[#4a72c4] to-[#2aada0]'} flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden`}
                                    >
                                        {project.avatarImage ? (
                                            <img src={project.avatarImage} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            project.avatarInitials
                                        )}
                                    </div>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                        {project.clientName}
                                    </span>
                                </button>
                                <div className="flex-1 relative py-3 min-h-[48px]">
                                    {/* Today marker */}
                                    {todayPct !== null && (
                                        <div
                                            className="absolute top-0 bottom-0 w-px bg-[#b05070]/70 z-10 pointer-events-none"
                                            style={{ left: `${todayPct}%` }}
                                            title="Aujourd'hui"
                                        />
                                    )}
                                    {/* Month grid lines */}
                                    <div className="absolute inset-0 flex pointer-events-none">
                                        {months.map((m) => (
                                            <div
                                                key={`grid-${m.toISOString()}`}
                                                className="border-r border-slate-50 dark:border-slate-800/60 last:border-r-0"
                                                style={{ flexGrow: daysInMonth(m), flexBasis: 0 }}
                                            />
                                        ))}
                                    </div>
                                    {tasks.map((task, i) => {
                                        const left = positionForDate(task.dueDate);
                                        const color = PRIORITY_COLORS[(rowIdx + i) % PRIORITY_COLORS.length];
                                        return (
                                            <div
                                                key={task.id}
                                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 max-w-[140px]"
                                                style={{ left: `${left}%` }}
                                                title={`${task.title} · ${task.dueDate}`}
                                            >
                                                <div
                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium truncate border bg-white dark:bg-slate-900 shadow-sm ${
                                                        task.completed ? 'opacity-50 line-through' : ''
                                                    }`}
                                                    style={{ borderColor: `${color}55`, color }}
                                                >
                                                    {task.title}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsRoadmap;
