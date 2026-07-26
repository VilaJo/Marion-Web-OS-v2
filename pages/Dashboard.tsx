/**
 * Dashboard Page — Clients explorer + Mission Control (v2.13.0)
 *
 * MetricsStrip, YachtBar, TodoWidget, view toggle (cards | table | roadmap).
 * Agenda / Santé Financière restent hors de cette page (header).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus, WorkflowPhase } from '../types';
import { invoiceEffectiveAmount } from '../utils';
import { useProjectStore, useUIStore, useNotificationStore } from '../stores';
import { useProjects, useCreateClientFolder, useInitDatabase, useUpdateProjectCache, useSaveProject } from '../services/queries';
import { EmptyState } from '../components/Shared';
import { NewClientScreen, NewClientData } from '../components/NewClientScreen';
import { ClientsFolderTree } from '../components/ClientsFolderTree';
import { ClientsTable } from '../components/ClientsTable';
import { ClientsGrid } from '../components/ClientsGrid';
import { ClientsRoadmap } from '../components/ClientsRoadmap';
import { MetricsStrip } from '../components/MetricsStrip';
import { YachtBar } from '../components/YachtBar';
import { TodoWidget } from '../components/TodoWidget';

import {
    Search, Plus, RefreshCw, Database, Briefcase, Download,
    LayoutGrid, List, CalendarDays,
} from 'lucide-react';
import { exportCSV, type CSVColumn } from '../utils/exportUtils';

declare const confetti: any;

type DashboardViewMode = 'cards' | 'table' | 'roadmap';
const VIEW_MODE_KEY = 'marion_dashboard_view_mode';

function readViewMode(): DashboardViewMode {
    try {
        const v = localStorage.getItem(VIEW_MODE_KEY);
        if (v === 'cards' || v === 'table' || v === 'roadmap') return v;
    } catch { /* ignore */ }
    return 'table';
}

function persistentSet(key: string): Set<string> {
    const raw = sessionStorage.getItem(key);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    return new Proxy(set, {
        get(target, prop, receiver) {
            if (prop === 'add') {
                return (value: string) => {
                    target.add(value);
                    sessionStorage.setItem(key, JSON.stringify([...target]));
                    return target;
                };
            }
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        },
    });
}

const _notifiedEvents = persistentSet('_notifiedEvents');
const _notifiedInvoices = persistentSet('_notifiedInvoices');
const _notifiedInactiveClients = persistentSet('_notifiedInactiveClients');
const _notifiedMaintenance = persistentSet('_notifiedMaintenance');

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    const { data: projects = [], isFetching: isRefreshing, refetch: refetchProjects } = useProjects();
    const createClientFolder = useCreateClientFolder();
    const saveProject = useSaveProject();
    const initDatabase = useInitDatabase();
    const updateProjectCache = useUpdateProjectCache();

    const {
        events, activities,
        filter: selectedFolder, searchQuery,
        addActivity, setFilter: setSelectedFolder, setSearchQuery,
    } = useProjectStore();

    const { showImporter, setShowImporter } = useUIStore();
    const { addNotification } = useNotificationStore();

    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [viewMode, setViewMode] = useState<DashboardViewMode>(readViewMode);

    useEffect(() => {
        try {
            localStorage.setItem(VIEW_MODE_KEY, viewMode);
        } catch { /* ignore */ }
    }, [viewMode]);

    // Agenda notifications (15min / 1min before events)
    useEffect(() => {
        const checkSchedule = () => {
            const now = new Date();
            events.forEach(event => {
                const [hours, minutes] = event.startTime.split(':').map(Number);
                const [year, month, day] = event.date.split('-').map(Number);
                const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                const diffMs = eventDate.getTime() - now.getTime();
                const diffMinutes = Math.ceil(diffMs / (1000 * 60));
                const isReminder = event.id.startsWith('reminder-');

                if (isReminder) {
                    if (diffMinutes === 30 && !_notifiedEvents.has(event.id + '_30min')) {
                        addNotification('🔔 Rappel', `"${event.title}" dans 30 minutes.`, 'deadline');
                        _notifiedEvents.add(event.id + '_30min');
                    }
                    return;
                }

                if (diffMinutes === 15 && !_notifiedEvents.has(event.id + '_15min')) {
                    addNotification('⏳ Bientôt', `"${event.title}" commence dans 15 minutes.`, 'info');
                    _notifiedEvents.add(event.id + '_15min');
                }

                if (diffMinutes === 1 && !_notifiedEvents.has(event.id + '_1min')) {
                    const notifType = event.type === 'Deadlines' ? 'deadline' : 'warning';
                    const title = event.type === 'Deadlines' ? '🔥 Deadline Imminente' : '🚀 Ça commence !';
                    addNotification(title, `"${event.title}" démarre dans 1 minute.`, notifType);
                    _notifiedEvents.add(event.id + '_1min');
                    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                }
            });
        };
        const interval = setInterval(checkSchedule, 10000);
        return () => clearInterval(interval);
    }, [events, addNotification]);

    useEffect(() => {
        if (projects.length === 0) return;
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const newOverdue: string[] = [];
        projects.forEach(project => {
            project.invoices.forEach(inv => {
                if (inv.status !== 'Paid' && inv.dueDate) {
                    const dueDate = new Date(inv.dueDate);
                    if (dueDate < todayStart && !_notifiedInvoices.has(inv.id)) {
                        newOverdue.push(`${inv.number} (${project.clientName})`);
                        _notifiedInvoices.add(inv.id);
                    }
                }
            });
        });
        if (newOverdue.length === 1) {
            addNotification('Retard de Paiement 💸', `Facture ${newOverdue[0]} en retard.`, 'finance', '/finances');
        } else if (newOverdue.length > 1) {
            addNotification('Retard de Paiement 💸', `${newOverdue.length} factures en retard : ${newOverdue.slice(0, 3).join(', ')}${newOverdue.length > 3 ? '…' : ''}.`, 'finance', '/finances');
        }

        const newInactive: string[] = [];
        const activeProjects = projects.filter(p => p.status === ProjectStatus.EN_COURS);
        activeProjects.forEach(project => {
            const projectActivities = activities.filter(a => a.projectId === project.id);
            const lastActivity = projectActivities.length > 0
                ? new Date(projectActivities[0].timestamp).getTime()
                : new Date(project.createdAt).getTime();
            if (now - lastActivity > TWO_WEEKS_MS && !_notifiedInactiveClients.has(project.id)) {
                newInactive.push(project.clientName);
                _notifiedInactiveClients.add(project.id);
            }
        });
        if (newInactive.length === 1) {
            addNotification('💤 Client en sommeil', `Aucune activité sur "${newInactive[0]}" depuis plus de 2 semaines.`, 'warning');
        } else if (newInactive.length > 1) {
            addNotification('💤 Clients en sommeil', `${newInactive.length} clients sans activité depuis 2+ semaines.`, 'warning');
        }
    }, [projects, activities, addNotification]);

    useEffect(() => {
        if (projects.length === 0) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maintenanceProjects = projects.filter(p => p.phase === 'Maintenance' && p.maintenance);
        maintenanceProjects.forEach(project => {
            const maintenance = project.maintenance!;
            if (maintenance.freeMaintenanceEndDate) {
                const endDate = new Date(maintenance.freeMaintenanceEndDate);
                const oneMonthBefore = new Date(endDate);
                oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
                const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const notifKey = `maintenance_expiry_${project.id}_${maintenance.freeMaintenanceEndDate}`;
                if (today >= oneMonthBefore && today <= endDate && !_notifiedMaintenance.has(notifKey)) {
                    addNotification('🔧 Maintenance Expirante', `La maintenance offerte de "${project.clientName}" expire dans ${daysUntilExpiry} jours.`, 'warning', `/client/${encodeURIComponent(project.id)}`);
                    _notifiedMaintenance.add(notifKey);
                }
            }
            if (maintenance.billingDates?.length) {
                maintenance.billingDates.forEach(dateStr => {
                    const billingDate = new Date(dateStr);
                    const daysUntilBilling = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const notifKey = `billing_${project.id}_${dateStr}`;
                    if (daysUntilBilling === 1 && !_notifiedMaintenance.has(notifKey)) {
                        addNotification('💰 Facturation Demain', `N'oublie pas de facturer la maintenance de "${project.clientName}" demain.`, 'finance', `/client/${encodeURIComponent(project.id)}`);
                        _notifiedMaintenance.add(notifKey);
                    }
                    if (daysUntilBilling === 0 && !_notifiedMaintenance.has(notifKey + '_today')) {
                        addNotification('🔔 Facturation Aujourd\'hui', `C'est le jour de facturation pour la maintenance de "${project.clientName}" !`, 'finance', `/client/${encodeURIComponent(project.id)}`);
                        _notifiedMaintenance.add(notifKey + '_today');
                    }
                });
            }
        });
    }, [projects, addNotification]);

    const handleOpenProject = (projectId: string) => {
        navigate(`/client/${encodeURIComponent(projectId)}`);
    };

    const handleCreateClient = async (data: NewClientData) => {
        const trimmed = data.name.trim();
        if (!trimmed) {
            addNotification('Nom requis', 'Merci de saisir un nom de client.', 'error');
            return;
        }

        // Match backend folder naming (api/files_bp.py) — preserve case, no lowercasing
        const safeFolderName = trimmed.replace(/[^a-zA-Z0-9 \-_]/g, '').trim();
        const normalizeKey = (s: string) => s.replace(/[^a-zA-Z0-9 \-_]/g, '').trim().toLowerCase();
        if (!safeFolderName) {
            addNotification('Nom invalide', 'Le nom du client contient uniquement des caractères spéciaux.', 'error');
            return;
        }

        if (projects.some(p => normalizeKey(p.clientName) === normalizeKey(safeFolderName))) {
            addNotification('Client déjà existant', `Un client nommé "${trimmed}" existe déjà.`, 'warning');
            return;
        }

        if (isCreatingClient) return;
        setIsCreatingClient(true);

        const statusFolderMap: Record<string, string> = {
            [ProjectStatus.EN_COURS]: '1. En cours',
            [ProjectStatus.MAINTENANCE]: '2. Maintenances',
            [ProjectStatus.ASSOCIATION]: '3. Associations',
            [ProjectStatus.PROSPECT]: '4. Prospects',
            [ProjectStatus.ARCHIVED]: '5. Archivés',
        };
        const targetFolder = statusFolderMap[data.status] || '4. Prospects';

        createClientFolder.mutate(
            { clientName: trimmed, status: data.status },
            {
                onSuccess: (created: { id?: string; clientName?: string }) => {
                    const cleanLinks = Object.fromEntries(
                        Object.entries(data.links).filter(([, v]) => v.trim())
                    );

                    // Prefer server-returned id (correct casing) so scan/save/roadmap stay aligned
                    const projectId = created?.id || `${targetFolder}/${created?.clientName || safeFolderName}`;
                    const displayName = created?.clientName || safeFolderName;

                    const newProject: Project = {
                        id: projectId,
                        clientName: displayName,
                        avatarInitials: displayName.substring(0, 2).toUpperCase(),
                        avatarColor: data.avatarColor,
                        avatarImage: data.avatarImage,
                        status: data.status,
                        phase: data.templateTasks?.length
                            ? (data.templateTasks[0].phase || WorkflowPhase.DISCOVERY)
                            : WorkflowPhase.DISCOVERY,
                        progress: 0,
                        createdAt: new Date().toISOString(),
                        profile: data.profile,
                        tasks: (data.templateTasks || []).map((t, idx) => ({
                            id: `task-${Date.now()}-${idx}`,
                            title: t.title,
                            completed: false,
                            priority: t.priority,
                            column: 'todo' as const,
                            phase: t.phase,
                            dueDate: t.dueDate,
                            createdAt: new Date().toISOString(),
                        })),
                        invoices: [],
                        brandKit: { colors: [], fonts: [] },
                        credentials: [],
                        links: Object.keys(cleanLinks).length > 0 ? cleanLinks : undefined,
                    };

                    // Persist tasks + dueDates to disk — cache-only was wiped by scan invalidate
                    saveProject.mutate(
                        { project: newProject },
                        {
                            onSuccess: () => {
                                updateProjectCache(newProject);
                                addNotification(
                                    'Client Créé',
                                    data.templateTasks?.length
                                        ? `« ${displayName} » prêt — ${data.templateTasks.length} tâches sur la Roadmap.`
                                        : `Dossier « ${displayName} » prêt dans ${targetFolder}.`,
                                    'success',
                                    `/client/${encodeURIComponent(newProject.id)}`,
                                );
                                addActivity('project_created', `Nouveau client: ${displayName}`, newProject.id, displayName);

                                if (data.cursorPrompts && data.cursorPrompts.length > 0) {
                                    try {
                                        const STORAGE_KEY = 'cursor_prompt_library_v1';
                                        const INIT_MARKER_KEY = 'cursor_prompt_library_initialized';
                                        const raw = localStorage.getItem(STORAGE_KEY);
                                        const existing = raw ? JSON.parse(raw) : [];
                                        const existingTitles = new Set(existing.map((p: any) => (p.title || '').toLowerCase()));
                                        const toAdd = data.cursorPrompts
                                            .filter(title => !existingTitles.has(title.toLowerCase()))
                                            .map((title, i) => ({
                                                id: `tpl-${data.templateId}-${Date.now()}-${i}`,
                                                title,
                                                content: title,
                                                category: 'cursor',
                                                tags: [data.templateId || 'template', displayName],
                                                rating: 0,
                                                createdAt: new Date().toISOString(),
                                                fromTemplate: data.templateId,
                                            }));
                                        if (toAdd.length > 0) {
                                            const merged = [...toAdd, ...existing];
                                            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                                            localStorage.setItem(INIT_MARKER_KEY, 'true');
                                            addNotification(
                                                'Prompts suggérés',
                                                `${toAdd.length} prompt(s) Cursor ajouté(s) à ta bibliothèque pour ce projet.`,
                                                'info',
                                                '/prompts',
                                            );
                                        }
                                    } catch { /* ignore localStorage errors */ }
                                }

                                setShowImporter(false);
                                try {
                                    localStorage.setItem(VIEW_MODE_KEY, 'roadmap');
                                } catch { /* ignore */ }
                                setViewMode('roadmap');
                                navigate('/');
                                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                            },
                            onError: () => {
                                updateProjectCache(newProject);
                                addNotification(
                                    'Client créé (partiel)',
                                    'Dossier OK, mais les tâches n’ont pas pu être enregistrées. Réessaie depuis la fiche client.',
                                    'warning',
                                    `/client/${encodeURIComponent(newProject.id)}`,
                                );
                                setShowImporter(false);
                                navigate(`/client/${encodeURIComponent(newProject.id)}`);
                            },
                            onSettled: () => {
                                setIsCreatingClient(false);
                            },
                        },
                    );
                },
                onError: (error: any) => {
                    if (error.status === 409 || (error.data?.error && String(error.data.error).includes('already exists'))) {
                        addNotification('Client déjà présent', `Le dossier pour "${trimmed}" existe déjà sur le disque.`, 'warning');
                    } else {
                        addNotification('Erreur Création', error.message || `Impossible de créer le dossier pour ${trimmed}.`, 'error');
                    }
                    setIsCreatingClient(false);
                },
            }
        );
    };

    const handleCreateDatabase = async () => {
        try { await initDatabase.mutateAsync(); } catch { /* ignore */ }
        await handleCreateClient({
            name: "Dossier_Exemple",
            status: ProjectStatus.PROSPECT,
            avatarColor: "from-[#b05070] to-[#2aada0]",
            profile: {
                email: "",
                phone: "",
                website: "",
                address: "",
                driveLink: "",
                serverAccess: "",
                customFields: [],
            },
            links: {},
        });
        addNotification("Base de données Initialisée", "Le dossier est prêt sur votre Bureau.", "success");
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    };

    const folderFilteredProjects = useMemo(() => {
        if (selectedFolder === 'Tous') return projects;
        return projects.filter(p => p.status === selectedFolder);
    }, [projects, selectedFolder]);

    const viewButtons: { mode: DashboardViewMode; icon: React.ElementType; label: string }[] = [
        { mode: 'cards', icon: LayoutGrid, label: 'Cartes' },
        { mode: 'table', icon: List, label: 'Tableau' },
        { mode: 'roadmap', icon: CalendarDays, label: 'Roadmap' },
    ];

    return (
        <div className="animate-in fade-in slide-in-from-left-8 duration-500">
            {projects.length > 0 && (
                <MetricsStrip
                    projects={projects}
                    onFilterActive={() => setSelectedFolder(ProjectStatus.EN_COURS)}
                    onOpenFinances={() => navigate('/finances')}
                    onFilterUrgent={() => setSelectedFolder(ProjectStatus.EN_COURS)}
                />
            )}

            {projects.length > 0 && (
                <YachtBar
                    projects={projects}
                    onOpenFinances={() => navigate('/finances')}
                />
            )}

            {projects.length > 0 && <TodoWidget />}

            {/* TOP BAR: search + view toggle + actions — Linear */}
            <div id="dashboard-search" className="flex flex-wrap items-center gap-2 mb-4 md:mb-5">
                <div className="relative flex items-center flex-1 min-w-[180px] md:flex-none md:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        id="dashboard-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un client…"
                        className="pl-8 pr-3 py-1.5 rounded-md bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500 w-full outline-none text-sm dark:text-slate-100 dark:placeholder-slate-500"
                    />
                </div>

                <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-0.5 shrink-0">
                    {viewButtons.map(({ mode, icon: Icon, label }) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            title={label}
                            className={`p-1.5 rounded-md transition-colors ${
                                viewMode === mode
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                            <Icon size={15} />
                        </button>
                    ))}
                </div>

                <div className="flex-1 hidden md:block" />
                <button
                    id="new-client-filter-button"
                    onClick={() => projects.length === 0 ? handleCreateDatabase() : setShowImporter(true)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                        projects.length === 0
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200'
                    }`}
                >
                    {projects.length === 0 ? (
                        <><Database size={14} /> <span className="hidden sm:inline">Database</span></>
                    ) : (
                        <><Plus size={14} /> Nouveau</>
                    )}
                </button>
                <button
                    onClick={() => {
                        const clientColumns: CSVColumn[] = [
                            { header: 'Nom', key: 'clientName' },
                            { header: 'Email', key: 'email', format: (_, row) => row.profile?.email || '' },
                            { header: 'Téléphone', key: 'phone', format: (_, row) => row.profile?.phone || '' },
                            { header: 'Statut', key: 'status' },
                            { header: 'Date création', key: 'createdAt', format: (v) => v ? new Date(v).toLocaleDateString('fr-CH') : '' },
                            { header: 'CA Total (payé)', key: 'revenue', format: (_, row) => String(row.invoices?.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + invoiceEffectiveAmount(i as any), 0) || 0) },
                            { header: 'Nb Projets', key: 'projectCount', format: () => '1' },
                            { header: 'Nb Tâches', key: 'taskCount', format: (_, row) => String(row.tasks?.length || 0) },
                            { header: 'Factures en attente', key: 'pending', format: (_, row) => String(row.invoices?.filter((i: any) => i.status !== 'Paid').reduce((s: number, i: any) => s + invoiceEffectiveAmount(i as any), 0) || 0) },
                        ];
                        const clientData = projects.map(p => ({ ...p }));
                        exportCSV(clientData, clientColumns, `Export_Clients_${new Date().getFullYear()}.csv`);
                    }}
                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                    title="Exporter la liste clients (CSV)"
                >
                    <Download size={15} />
                </button>
                <button
                    onClick={() => refetchProjects()}
                    disabled={isRefreshing}
                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
                    title="Actualiser les dossiers"
                >
                    <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {!isRefreshing && projects.length === 0 ? (
                <EmptyState
                    title="Aucun projet"
                    message="Créez votre premier projet pour commencer."
                    icon={Briefcase}
                    actionLabel="Créer un projet"
                    onAction={() => setShowImporter(true)}
                />
            ) : (
                <div className="flex flex-col md:flex-row gap-3 md:gap-6 animate-in slide-in-from-bottom-8 duration-500">
                    {viewMode !== 'roadmap' && (
                        <div className="md:w-[220px] md:flex-shrink-0">
                            <ClientsFolderTree
                                projects={projects}
                                selected={selectedFolder}
                                onSelect={setSelectedFolder}
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        {viewMode === 'cards' && (
                            <ClientsGrid
                                projects={folderFilteredProjects}
                                onOpenProject={handleOpenProject}
                                searchQuery={searchQuery}
                            />
                        )}
                        {viewMode === 'table' && (
                            <ClientsTable
                                projects={folderFilteredProjects}
                                onOpenProject={handleOpenProject}
                                searchQuery={searchQuery}
                            />
                        )}
                        {viewMode === 'roadmap' && (
                            <ClientsRoadmap
                                projects={projects}
                                onOpenProject={handleOpenProject}
                                searchQuery={searchQuery}
                            />
                        )}
                    </div>
                </div>
            )}

            <NewClientScreen
                isOpen={showImporter}
                onClose={() => setShowImporter(false)}
                onCreate={handleCreateClient}
                isCreating={isCreatingClient}
            />
        </div>
    );
};

export default Dashboard;
