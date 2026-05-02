/**
 * Dashboard Page - Main dashboard view
 * Extracted from App.tsx for route-based navigation
 */

import React, { Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus, CalendarEvent, WorkflowPhase, Invoice, Activity } from '../types';
import { formatCurrency, formatCurrencyWithSymbol } from '../utils';
import { sanitizeHTML } from '../utils/sanitize';
import { useProjectStore, useUIStore, useNotificationStore, useUndoStore } from '../stores';
import { useProjects, useSaveProject, useMoveProject, useCreateClientFolder, useInitDatabase, useUpdateProjectCache, useCreateGoogleEvent } from '../services/queries';
import { generateBriefing } from '../services/geminiService';
import { ProjectCard } from '../components/ProjectCard';
import { Card, Modal, EmptyState } from '../components/Shared';
import { SplashScreen } from '../components/SplashScreen';
import { NewClientScreen, NewClientData } from '../components/NewClientScreen';

// Lazy loaded components
const Agenda = React.lazy(() => import('../components/Agenda').then(m => ({ default: m.Agenda })));
const FinancialHealthWidget = React.lazy(() => import('../components/FinancialHealthWidget').then(m => ({ default: m.FinancialHealthWidget })));
const Importer = React.lazy(() => import('../components/Importer').then(m => ({ default: m.Importer })));
const InvoiceBuilder = React.lazy(() => import('../components/InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));
const GoalsKPIs = React.lazy(() => import('../components/GoalsKPIs').then(m => ({ default: m.GoalsKPIs })));
const DocumentTemplates = React.lazy(() => import('../components/DocumentTemplates').then(m => ({ default: m.DocumentTemplates })));
const MessagingHub = React.lazy(() => import('../components/MessagingHub').then(m => ({ default: m.MessagingHub })));
const DailyLessonCard = React.lazy(() => import('../components/DailyLessonCard').then(m => ({ default: m.DailyLessonCard })));

import {
    Search, Plus, RefreshCw, Database, Clock, DollarSign,
    FolderPlus, Archive, CheckCircle, User, Palette,
    Calendar, Upload, FileText, Coffee, Briefcase, Download,
    ChevronRight, ArrowRight, X, History,
} from 'lucide-react';
import { exportCSV, exportSingleSheetXLSX, type CSVColumn } from '../utils/exportUtils';

declare const confetti: any;

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

// ============================================================================
// Dashboard Component
// ============================================================================

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    // --- React Query ---
    const { data: projects = [], isFetching: isRefreshing, refetch: refetchProjects } = useProjects();
    const saveProjectMutation = useSaveProject();
    const moveProjectMutation = useMoveProject();
    const createClientFolder = useCreateClientFolder();
    const initDatabase = useInitDatabase();
    const createGoogleEventMutation = useCreateGoogleEvent();
    const updateProjectCache = useUpdateProjectCache();
    const pushUndo = useUndoStore((s) => s.pushUndo);

    // --- Stores ---
    const {
        events, activities, filter, searchQuery,
        addActivity, setFilter, setSearchQuery,
        addEvent, updateEvent, deleteEvent,
    } = useProjectStore();

    const {
        theme, currency, showImporter, showGlobalInvoiceModal,
        showGoalsKPIs, showDocTemplates, showMessagingHub, showMondayBriefing,
        currentInvoiceToEdit, briefingVocal,
        setShowImporter, setShowGlobalInvoiceModal,
        setShowGoalsKPIs, setShowDocTemplates, setShowMessagingHub,
        setShowMondayBriefing, setCurrentInvoiceToEdit,
    } = useUIStore();

    const { addNotification } = useNotificationStore();

    // --- Local State ---
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [briefingContent, setBriefingContent] = useState('');
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [showAllActivities, setShowAllActivities] = useState(false);

    // Module-level sets persist across mount/unmount cycles

    // ========================================================================
    // Notification Schedulers
    // ========================================================================

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

    // Invoice overdue & client inactivity notifications (batched)
    useEffect(() => {
        if (projects.length === 0) return;
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        // Overdue invoices
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

        // Inactive clients
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

    // Maintenance notifications (once per session per alert)
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

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleOpenProject = (project: Project) => {
        navigate(`/client/${encodeURIComponent(project.id)}`);
    };

    const handleCreateClient = async (data: NewClientData) => {
        const trimmed = data.name.trim();
        if (!trimmed) {
            addNotification('Nom requis', 'Merci de saisir un nom de client.', 'error');
            return;
        }

        const normalize = (s: string) => s.replace(/[^a-zA-Z0-9 \-_]/g, '').trim().toLowerCase();
        const safeName = normalize(trimmed);
        if (!safeName) {
            addNotification('Nom invalide', 'Le nom du client contient uniquement des caractères spéciaux.', 'error');
            return;
        }

        if (projects.some(p => normalize(p.clientName) === safeName)) {
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
        const predictedPath = `${targetFolder}/${safeName}`;

        createClientFolder.mutate(
            { clientName: trimmed, status: data.status },
            {
                onSuccess: () => {
                    const cleanLinks = Object.fromEntries(
                        Object.entries(data.links).filter(([, v]) => v.trim())
                    );

                    const newProject: Project = {
                        id: predictedPath,
                        clientName: trimmed,
                        avatarInitials: trimmed.substring(0, 2).toUpperCase(),
                        avatarColor: data.avatarColor,
                        avatarImage: data.avatarImage,
                        status: data.status,
                        phase: WorkflowPhase.DISCOVERY,
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
                            createdAt: new Date().toISOString(),
                        })),
                        invoices: [],
                        brandKit: { colors: [], fonts: [] },
                        credentials: [],
                        links: Object.keys(cleanLinks).length > 0 ? cleanLinks : undefined,
                    };

                    updateProjectCache(newProject);
                    addNotification('Client Créé', `Dossier "${trimmed}" prêt dans ${targetFolder}.`, 'success', `/client/${encodeURIComponent(newProject.id)}`);
                    addActivity('project_created', `Nouveau client: ${trimmed}`, newProject.id, trimmed);

                    // If a template was chosen with cursor prompts, suggest them in the
                    // Prompt Library (notification with quick-link). Marion can ignore.
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
                                    content: title, // Marion peut éditer
                                    category: 'cursor',
                                    tags: [data.templateId || 'template', trimmed],
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
                    navigate(`/client/${encodeURIComponent(newProject.id)}`);
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                },
                onError: (error: any) => {
                    if (error.status === 409 || (error.data?.error && String(error.data.error).includes('already exists'))) {
                        addNotification('Client déjà présent', `Le dossier pour "${trimmed}" existe déjà sur le disque.`, 'warning');
                    } else {
                        addNotification('Erreur Création', error.message || `Impossible de créer le dossier pour ${trimmed}.`, 'error');
                    }
                },
                onSettled: () => {
                    setIsCreatingClient(false);
                },
            }
        );
    };

    const handleUpdateProject = async (updated: Project, oldId?: string) => {
        saveProjectMutation.mutate({ project: updated, oldId }, {
            onError: () => {
                addNotification("Erreur Sauvegarde", "Vos modifications n'ont pas été enregistrées.", "error");
            },
        });
    };

    const handleOpenGlobalInvoiceModal = (invoice?: Invoice, project?: Project) => {
        if (invoice) {
            setCurrentInvoiceToEdit({ invoice, project });
        } else {
            const newInv: Invoice = {
                id: `inv-${Date.now()}`,
                number: `F${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                date: new Date().toISOString().split('T')[0],
                amount: 0,
                status: 'Draft',
                type: 'Invoice',
                items: [],
                clientAddress: ''
            };
            setCurrentInvoiceToEdit({ invoice: newInv });
        }
        setShowGlobalInvoiceModal(true);
    };

    const handleSaveGlobalInvoice = (invoice: Invoice, projectId: string) => {
        if (!projectId) {
            addNotification('Facture Créée', `La facture ${invoice.number} a été générée (sans client associé). Télécharge le PDF.`, 'finance', '/finances');
            addActivity('invoice_created', `Facture ${invoice.number} créée`, undefined, invoice.clientDisplayName || 'Sans client', `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
            setShowGlobalInvoiceModal(false);
            return;
        }

        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) return;

        const targetProject = { ...projects[projectIndex] };
        const existingIdx = targetProject.invoices.findIndex(i => i.id === invoice.id);
        if (existingIdx >= 0) {
            targetProject.invoices = [...targetProject.invoices];
            targetProject.invoices[existingIdx] = invoice;
        } else {
            targetProject.invoices = [...targetProject.invoices, invoice];
        }

        saveProjectMutation.mutate({ project: targetProject });
        addNotification('Facture Enregistrée', `La facture ${invoice.number} a été sauvegardée.`, 'finance', '/finances');
        addActivity('invoice_created', `Facture ${invoice.number} créée`, targetProject.id, targetProject.clientName, `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
        setShowGlobalInvoiceModal(false);
    };

    const handleAddEvent = (event: CalendarEvent) => {
        addEvent(event);
        if (event.type === 'Call ou rdv pro') {
            addActivity('meeting_scheduled', `Réunion: ${event.title}`, undefined, undefined, event.date);
        }
        confetti({ particleCount: 30, spread: 40, colors: ['#5BBFBA', '#F0B7A4'] });
    };

    const handleUpdateEvent = (updatedEvent: CalendarEvent) => {
        updateEvent(updatedEvent);
    };

    const handleDeleteEvent = (eventId: string) => {
        const eventToDelete = events.find(e => e.id === eventId);
        if (!eventToDelete) return;

        // Execute deletion
        deleteEvent(eventId);

        // Undo support
        pushUndo({
            description: `Événement "${eventToDelete.title}" supprimé`,
            restore: () => {
                addEvent(eventToDelete);
            },
        });
    };

    const handleStatusCycle = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        const statuses = [ProjectStatus.EN_COURS, ProjectStatus.MAINTENANCE, ProjectStatus.ASSOCIATION, ProjectStatus.PROSPECT];
        const currentIndex = statuses.indexOf(project.status);
        const nextStatus = currentIndex === -1 ? statuses[0] : statuses[(currentIndex + 1) % statuses.length];
        const previousStatus = project.status;

        // Optimistic update
        updateProjectCache({ ...project, status: nextStatus });
        addActivity('project_status_changed', `${project.clientName} → ${nextStatus}`, project.id, project.clientName);
        confetti({ particleCount: 30, spread: 50, origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }, colors: ['#FF7E5F', '#FEB47B'] });

        moveProjectMutation.mutate(
            { clientName: project.clientName, newStatus: nextStatus },
            {
                onSuccess: (data) => {
                    if (data.path) {
                        updateProjectCache({ ...project, id: data.path as string, status: nextStatus });
                    }
                },
                onError: (error) => {
                    // Rollback optimistic update
                    updateProjectCache({ ...project, status: previousStatus });
                    addNotification('Erreur Statut', error.message || `Impossible de déplacer le dossier.`, 'error');
                },
            }
        );
    };

    const handleCreateDatabase = async () => {
        try { await initDatabase.mutateAsync(); } catch { /* ignore */ }
        await handleCreateClient({
            name: "Dossier_Exemple",
            status: ProjectStatus.PROSPECT,
            avatarColor: "from-[#FF7E5F] to-[#d946ef]",
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

    const handleMorningBriefing = async () => {
        setShowMondayBriefing(true);
        setIsBriefingLoading(true);
        setBriefingContent('');
        const activeProjects = projects.filter(p => p.status === ProjectStatus.EN_COURS);
        const revenue = projects.flatMap(p => p.invoices).filter(i => i.status === 'Paid').reduce((acc, i) => acc + i.amount, 0);
        const urgentTasks = projects.flatMap(p => p.tasks).filter(t => t.priority === 'High' && !t.completed);
        const nextEvents = events.filter(e => new Date(e.date) >= new Date()).slice(0, 3);
        const context = `
            DATETIME: ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.
            AGENDA: ${nextEvents.map(e => `- ${e.date} à ${e.startTime}: ${e.title}`).join('\n')}
            PROJETS ACTIFS: ${activeProjects.length} (${activeProjects.map(p => p.clientName).join(', ')}).
            FINANCE: ${formatCurrencyWithSymbol(Math.round(revenue), 'CHF', 0)} encaissés.
            URGENCES: ${urgentTasks.length > 0 ? urgentTasks.map(t => `- ${t.title}`).join('\n') : "Rien d'urgent !"}
        `;
        const html = await generateBriefing(context);
        setIsBriefingLoading(false);
        setBriefingContent(html);
        if (briefingVocal && 'speechSynthesis' in window) {
            const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'fr-FR';
            utterance.rate = 1.1;
            const voices = window.speechSynthesis.getVoices();
            const frenchVoice = voices.find(v => v.lang.includes('fr') && !v.name.includes('Google'));
            if (frenchVoice) utterance.voice = frenchVoice;
            window.speechSynthesis.speak(utterance);
        }
    };

    // ========================================================================
    // Computed Values
    // ========================================================================

    const statusPriority: Record<string, number> = {
        [ProjectStatus.EN_COURS]: 1,
        [ProjectStatus.MAINTENANCE]: 2,
        [ProjectStatus.ASSOCIATION]: 3,
        [ProjectStatus.PROSPECT]: 4,
        [ProjectStatus.ARCHIVED]: 5
    };

    const filteredProjects = projects
        .filter(p => {
            let matchesFilter = filter === 'Tous';
            if (!matchesFilter) {
                if (filter === 'En cours') matchesFilter = p.status === ProjectStatus.EN_COURS;
                else if (filter === 'Maintenance') matchesFilter = p.status === ProjectStatus.MAINTENANCE;
                else if (filter === 'Association') matchesFilter = p.status === ProjectStatus.ASSOCIATION;
                else if (filter === 'Prospect') matchesFilter = p.status === ProjectStatus.PROSPECT;
                else if (filter === 'Archivé') matchesFilter = p.status === ProjectStatus.ARCHIVED;
            }
            const matchesSearch = p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        })
        .sort((a, b) => {
            const statusDiff = (statusPriority[a.status] || 999) - (statusPriority[b.status] || 999);
            if (statusDiff !== 0) return statusDiff;
            return a.clientName.localeCompare(b.clientName, 'fr');
        });

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="animate-in fade-in slide-in-from-left-8 duration-500">
            {/* DAILY LESSON CARD (Marion 2030 Atelier Edition) */}
            <div className="mb-4 md:mb-6">
                <Suspense fallback={<Card className="h-24 animate-pulse" />}>
                    <DailyLessonCard />
                </Suspense>
            </div>

            {/* TOP ROW: Agenda + Financial */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8 mb-4 md:mb-8">
                <div className="lg:col-span-2 space-y-4 md:space-y-8 animate-in slide-in-from-left-8 duration-700">
                    <div id="agenda-widget">
                        <Suspense fallback={<Card className="h-64 animate-pulse" />}>
                            <Agenda
                                events={events}
                                onAddEvent={handleAddEvent}
                                onUpdateEvent={handleUpdateEvent}
                                onDeleteEvent={handleDeleteEvent}
                            />
                        </Suspense>
                    </div>
                </div>
                <div className="lg:col-span-2 h-full animate-in slide-in-from-right-8 duration-700">
                    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
                        <FinancialHealthWidget
                            projects={projects}
                            currency={currency}
                            onClick={() => navigate('/finances')}
                            currentTheme={theme}
                            onCreateInvoice={() => handleOpenGlobalInvoiceModal()}
                            onAddCalendarEvent={(evt) => {
                                createGoogleEventMutation.mutate(evt, {
                                    onSuccess: () => addNotification('📅 Événement créé', `"${evt.title}" ajouté à l'agenda le ${evt.date} à ${evt.startTime}${evt.addMeet ? ' avec Meet' : ''}`, 'success'),
                                    onError: () => {
                                        handleAddEvent({ id: `local-${Date.now()}`, title: evt.title, date: evt.date, startTime: evt.startTime, duration: evt.duration, type: 'Call ou rdv pro', source: 'local' });
                                    },
                                });
                            }}
                            onAddReminder={(todoId, text, remindAt) => {
                                addNotification('Rappel ajouté', `Je te rappellerai: ${text}`, 'deadline');
                                const dateStr = `${remindAt.getFullYear()}-${String(remindAt.getMonth() + 1).padStart(2, '0')}-${String(remindAt.getDate()).padStart(2, '0')}`;
                                const timeStr = `${String(remindAt.getHours()).padStart(2, '0')}:${String(remindAt.getMinutes()).padStart(2, '0')}`;
                                addEvent({
                                    id: `reminder-${todoId}`,
                                    title: text,
                                    date: dateStr,
                                    startTime: timeStr,
                                    duration: 15,
                                    type: 'Perso',
                                    source: 'local',
                                    isAppEvent: true
                                });
                            }}
                        />
                    </Suspense>
                </div>
            </div>

            {/* ACTIVITY WIDGET */}
            {activities.length > 0 && (() => {
                const activityConfig: Record<Activity['type'], { icon: React.ReactNode; color: string; borderColor: string; getLink: (act: Activity) => string | null; label: string }> = {
                    invoice_created: { icon: <FileText size={14} />, color: 'text-emerald-500', borderColor: 'border-l-emerald-500', getLink: () => '/finances', label: 'Facture' },
                    invoice_paid: { icon: <DollarSign size={14} />, color: 'text-green-500', borderColor: 'border-l-green-500', getLink: () => '/finances', label: 'Paiement' },
                    project_created: { icon: <FolderPlus size={14} />, color: 'text-blue-500', borderColor: 'border-l-blue-500', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Nouveau client' },
                    project_archived: { icon: <Archive size={14} />, color: 'text-slate-500', borderColor: 'border-l-slate-400', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Archivage' },
                    project_status_changed: { icon: <RefreshCw size={14} />, color: 'text-purple-500', borderColor: 'border-l-purple-500', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Statut' },
                    task_completed: { icon: <CheckCircle size={14} />, color: 'text-emerald-500', borderColor: 'border-l-emerald-500', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Tâche' },
                    client_updated: { icon: <User size={14} />, color: 'text-orange-500', borderColor: 'border-l-orange-500', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Client' },
                    brand_updated: { icon: <Palette size={14} />, color: 'text-pink-500', borderColor: 'border-l-pink-500', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Branding' },
                    meeting_scheduled: { icon: <Calendar size={14} />, color: 'text-blue-500', borderColor: 'border-l-blue-500', getLink: () => '/agenda', label: 'Réunion' },
                    file_uploaded: { icon: <Upload size={14} />, color: 'text-cyan-500', borderColor: 'border-l-cyan-500', getLink: (a) => a.projectId ? `/client/${encodeURIComponent(a.projectId)}` : null, label: 'Fichier' },
                };

                const timeAgo = (ts: string) => {
                    const diff = Date.now() - new Date(ts).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return "À l'instant";
                    if (mins < 60) return `Il y a ${mins} min`;
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) return `Il y a ${hours}h`;
                    return `Il y a ${Math.floor(hours / 24)}j`;
                };

                const groupByDay = (acts: Activity[]) => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const yesterdayStart = todayStart - 86400000;
                    const weekStart = todayStart - 6 * 86400000;

                    const groups: { label: string; items: Activity[] }[] = [
                        { label: "Aujourd'hui", items: [] },
                        { label: 'Hier', items: [] },
                        { label: 'Cette semaine', items: [] },
                        { label: 'Plus ancien', items: [] },
                    ];

                    for (const act of acts) {
                        const t = new Date(act.timestamp).getTime();
                        if (t >= todayStart) groups[0].items.push(act);
                        else if (t >= yesterdayStart) groups[1].items.push(act);
                        else if (t >= weekStart) groups[2].items.push(act);
                        else groups[3].items.push(act);
                    }
                    return groups.filter(g => g.items.length > 0);
                };

                const renderActivityRow = (act: Activity, compact = false) => {
                    const cfg = activityConfig[act.type];
                    const link = cfg.getLink(act);
                    const Tag = link ? 'button' : 'div';
                    return (
                        <Tag
                            key={act.id}
                            {...(link ? { onClick: () => { navigate(link); setShowAllActivities(false); } } : {})}
                            className={`w-full text-left flex items-center gap-3 ${compact ? 'py-2' : 'py-2.5'} px-3 rounded-xl border-l-[3px] ${cfg.borderColor} transition-all ${
                                link 
                                    ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer group' 
                                    : 'cursor-default'
                            }`}
                        >
                            <div className={`p-1.5 bg-white dark:bg-slate-700/80 rounded-lg shadow-sm ${cfg.color} flex-shrink-0`}>
                                {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700 dark:text-slate-200 truncate`}>{act.title}</p>
                                <div className="flex items-center gap-2">
                                    {act.projectName && <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{act.projectName}</span>}
                                    {act.description && <span className="text-[11px] text-slate-400 truncate">· {act.description}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(act.timestamp)}</span>
                                {link && <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-brand-orange transition-colors" />}
                            </div>
                        </Tag>
                    );
                };

                return (
                    <>
                    <div className="mb-4 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="p-5">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Clock size={18} className="text-brand-orange" /> Activité récente
                                </h3>
                                <button
                                    onClick={() => setShowAllActivities(true)}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-orange transition-colors font-medium"
                                >
                                    {activities.length} actions <ArrowRight size={12} />
                                </button>
                            </div>
                            <div className="space-y-1">
                                {activities.slice(0, 5).map((act) => renderActivityRow(act))}
                            </div>
                            {activities.length > 5 && (
                                <button
                                    onClick={() => setShowAllActivities(true)}
                                    className="mt-3 w-full py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-orange transition-colors flex items-center justify-center gap-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    Voir tout l'historique <History size={12} />
                                </button>
                            )}
                        </Card>
                    </div>

                    {/* Full Activity History Modal */}
                    {showAllActivities && (
                        <Modal isOpen={showAllActivities} onClose={() => setShowAllActivities(false)} title="Historique d'activité" width="max-w-3xl">
                            <div className="w-full max-w-2xl mx-auto max-h-[80vh] flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="font-serif text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                        <History size={22} className="text-brand-orange" /> Historique d'activité
                                    </h2>
                                    <button onClick={() => setShowAllActivities(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <X size={20} className="text-slate-400" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-6">
                                    {groupByDay(activities).map((group) => (
                                        <div key={group.label}>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{group.label}</h3>
                                                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/50" />
                                                <span className="text-[10px] text-slate-400">{group.items.length}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {group.items.map((act) => renderActivityRow(act, true))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Modal>
                    )}
                    </>
                );
            })()}

            {/* SEARCH, FILTERS & PROJECT CARDS */}
            <div className="space-y-4 md:space-y-8 mb-4 md:mb-8">
                <div id="dashboard-search" className="bg-white/40 dark:bg-slate-800/30 p-2 md:p-3 rounded-2xl md:rounded-3xl backdrop-blur-sm flex items-center gap-2 md:gap-3">
                    <div className="relative flex items-center gap-2 flex-shrink-0 w-48 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            id="dashboard-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..."
                            className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-transparent dark:border-slate-700/50 focus:border-orange-300 dark:focus:border-orange-600 shadow-sm focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 w-full transition-all outline-none text-sm dark:text-slate-100 dark:placeholder-slate-400"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto flex-1 no-scrollbar">
                        {['En cours', 'Maintenance', 'Association', 'Prospect', 'Archivé', 'Tous'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                                    filter === f
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                    : 'bg-white dark:bg-slate-800/60 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-slate-700/80'
                                }`}
                            >
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        id="new-client-filter-button"
                        onClick={() => projects.length === 0 ? handleCreateDatabase() : setShowImporter(true)}
                        className={`px-3 md:px-5 py-1.5 md:py-2 rounded-full text-white transition-all duration-300 flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase whitespace-nowrap group flex-shrink-0 ${
                            projects.length === 0
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse shadow-lg'
                            : 'bg-gradient-to-r from-[#FF7E5F] to-[#d946ef] hover:scale-105 shadow-md'
                        }`}
                    >
                        {projects.length === 0 ? (
                            <><Database size={12} /> <span className="hidden sm:inline">Database</span></>
                        ) : (
                            <><Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" /> <span>Nouveau</span></>
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
                                { header: 'CA Total (payé)', key: 'revenue', format: (_, row) => String(row.invoices?.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0) },
                                { header: 'Nb Projets', key: 'projectCount', format: () => '1' },
                                { header: 'Nb Tâches', key: 'taskCount', format: (_, row) => String(row.tasks?.length || 0) },
                                { header: 'Factures en attente', key: 'pending', format: (_, row) => String(row.invoices?.filter((i: any) => i.status !== 'Paid').reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0) },
                            ];
                            const clientData = projects.map(p => ({ ...p }));
                            exportCSV(clientData, clientColumns, `Export_Clients_${new Date().getFullYear()}.csv`);
                        }}
                        className="p-2 bg-white dark:bg-slate-800/60 rounded-xl text-slate-400 hover:text-emerald-500 hover:shadow-md transition-all flex-shrink-0 dark:border dark:border-slate-700/50"
                        title="Exporter la liste clients (CSV)"
                    >
                        <Download size={16} />
                    </button>
                    <button
                        onClick={() => refetchProjects()}
                        disabled={isRefreshing}
                        className="p-2 bg-white dark:bg-slate-800/60 rounded-xl text-slate-400 hover:text-brand-orange hover:shadow-md transition-all disabled:opacity-50 flex-shrink-0 dark:border dark:border-slate-700/50"
                        title="Actualiser les dossiers"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 animate-in slide-in-from-bottom-8 duration-500 px-0">
                    {!isRefreshing && projects.length === 0 ? (
                        <div className="col-span-1 sm:col-span-2 xl:col-span-3">
                            <EmptyState
                                title="Aucun projet"
                                message="Créez votre premier projet pour commencer."
                                icon={Briefcase}
                                actionLabel="Créer un projet"
                                onAction={() => setShowImporter(true)}
                            />
                        </div>
                    ) : (
                        <>
                            {filteredProjects.map(p => (
                                <ProjectCard
                                    key={p.id}
                                    project={p}
                                    onClick={() => handleOpenProject(p)}
                                    onStatusCycle={(e) => handleStatusCycle(e, p)}
                                />
                            ))}
                            <div
                                id="new-project-card"
                                onClick={() => setShowImporter(true)}
                                className="group rounded-4xl p-6 border-2 border-dashed border-slate-300 dark:border-slate-600/50 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:border-brand-orange hover:text-brand-orange hover:bg-white/30 dark:hover:bg-slate-800/30 cursor-pointer transition-all min-h-[280px]"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300 shadow-inner">
                                    <Plus size={32} />
                                </div>
                                <span className="font-serif text-xl">Nouveau Projet</span>
                                <span className="text-xs mt-2 opacity-60 font-sans">Créer un client & dossier</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ============================================================== */}
            {/* MODALS managed by Dashboard (domain-specific)                  */}
            {/* ============================================================== */}

            {/* New Client Fullscreen */}
            <NewClientScreen
                isOpen={showImporter}
                onClose={() => setShowImporter(false)}
                onCreate={handleCreateClient}
                isCreating={isCreatingClient}
            />

            {/* Invoice Builder Modal */}
            <Modal isOpen={showGlobalInvoiceModal} onClose={() => setShowGlobalInvoiceModal(false)} title="" width="max-w-6xl">
                {currentInvoiceToEdit && (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement facture..." />}>
                        <InvoiceBuilder
                            invoice={currentInvoiceToEdit.invoice}
                            project={currentInvoiceToEdit.project}
                            allProjects={projects}
                            onClose={() => setShowGlobalInvoiceModal(false)}
                            onSave={handleSaveGlobalInvoice}
                            currency={currency}
                        />
                    </Suspense>
                )}
            </Modal>

            {/* Monday Briefing Modal */}
            <Modal isOpen={showMondayBriefing} onClose={() => setShowMondayBriefing(false)} title="Briefing du Lundi" width="max-w-[95vw] w-full h-[95vh]">
                <div className="bg-[#fffdf9] dark:bg-slate-800/50 p-8 rounded-[32px] border border-[#f5ece0] dark:border-slate-700/50 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-900/10 rounded-bl-full flex items-start justify-end p-6">
                        <Coffee className="text-orange-200 dark:text-orange-800 w-12 h-12" />
                    </div>
                    {isBriefingLoading ? (
                        <div className="min-h-[300px] flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 bg-orange-100 dark:bg-slate-800 rounded-full flex items-center justify-center animate-bounce">
                                <Coffee className="text-brand-orange" size={28} />
                            </div>
                            <p className="font-serif text-lg text-slate-400 animate-pulse">Franck prépare votre café et analyse l'agenda...</p>
                        </div>
                    ) : (
                        <div className="briefing-content min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-700" dangerouslySetInnerHTML={{ __html: sanitizeHTML(briefingContent) }} />
                    )}
                </div>
            </Modal>

            {/* Goals & KPIs */}
            {showGoalsKPIs && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" /></div>}>
                    <GoalsKPIs projects={projects} currency={currency} onClose={() => setShowGoalsKPIs(false)} />
                </Suspense>
            )}

            {/* Document Templates */}
            {showDocTemplates && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>}>
                    <DocumentTemplates onClose={() => setShowDocTemplates(false)} />
                </Suspense>
            )}

            {/* Messaging Hub */}
            {showMessagingHub && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>}>
                    <MessagingHub projects={projects} onClose={() => setShowMessagingHub(false)} />
                </Suspense>
            )}
        </div>
    );
};

export default Dashboard;
