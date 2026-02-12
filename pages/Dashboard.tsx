/**
 * Dashboard Page - Main dashboard view
 * Extracted from App.tsx for route-based navigation
 */

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus, CalendarEvent, WorkflowPhase, Invoice, Activity } from '../types';
import { formatCurrency, formatCurrencyWithSymbol } from '../utils';
import { sanitizeHTML } from '../utils/sanitize';
import { useProjectStore, useUIStore, useNotificationStore, useUndoStore } from '../stores';
import { useProjects, useSaveProject, useMoveProject, useCreateClientFolder, useInitDatabase, useUpdateProjectCache, useDeleteCalendarEvent } from '../services/queries';
import { generateBriefing } from '../services/geminiService';
import { ProjectCard } from '../components/ProjectCard';
import { Card, Modal, EmptyState } from '../components/Shared';
import { SplashScreen } from '../components/SplashScreen';

// Lazy loaded components
const Agenda = React.lazy(() => import('../components/Agenda').then(m => ({ default: m.Agenda })));
const FinancialHealthWidget = React.lazy(() => import('../components/FinancialHealthWidget').then(m => ({ default: m.FinancialHealthWidget })));
const Importer = React.lazy(() => import('../components/Importer').then(m => ({ default: m.Importer })));
const InvoiceBuilder = React.lazy(() => import('../components/InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));
const GoalsKPIs = React.lazy(() => import('../components/GoalsKPIs').then(m => ({ default: m.GoalsKPIs })));
const DocumentTemplates = React.lazy(() => import('../components/DocumentTemplates').then(m => ({ default: m.DocumentTemplates })));
const MessagingHub = React.lazy(() => import('../components/MessagingHub').then(m => ({ default: m.MessagingHub })));

import {
    Search, Plus, RefreshCw, Database, Clock, DollarSign,
    FolderPlus, Archive, CheckCircle, User, Palette,
    Calendar, Upload, FileText, Coffee, Briefcase
} from 'lucide-react';

declare const confetti: any;

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
    const updateProjectCache = useUpdateProjectCache();
    const deleteCalendarEventMutation = useDeleteCalendarEvent();
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
    const [newClientStatus, setNewClientStatus] = useState<ProjectStatus>(ProjectStatus.PROSPECT);
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientWebsite, setNewClientWebsite] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [briefingContent, setBriefingContent] = useState('');
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);

    // --- Notification Scheduling Refs ---
    const notifiedEventsRef = useRef(new Set<string>());
    const notifiedInvoicesRef = useRef(new Set<string>());
    const notifiedInactiveClientsRef = useRef(new Set<string>());
    const notifiedMaintenanceRef = useRef(new Set<string>());

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
                    if (diffMinutes === 30 && !notifiedEventsRef.current.has(event.id + '_30min')) {
                        addNotification('🔔 Rappel', `"${event.title}" dans 30 minutes.`, 'deadline');
                        notifiedEventsRef.current.add(event.id + '_30min');
                    }
                    return;
                }

                if (diffMinutes === 15 && !notifiedEventsRef.current.has(event.id + '_15min')) {
                    addNotification('⏳ Bientôt', `"${event.title}" commence dans 15 minutes.`, 'info');
                    notifiedEventsRef.current.add(event.id + '_15min');
                }

                if (diffMinutes === 1 && !notifiedEventsRef.current.has(event.id + '_1min')) {
                    const notifType = event.type === 'Deadline' ? 'deadline' : 'warning';
                    const title = event.type === 'Deadline' ? '🔥 Deadline Imminente' : '🚀 Ça commence !';
                    addNotification(title, `"${event.title}" démarre dans 1 minute.`, notifType);
                    notifiedEventsRef.current.add(event.id + '_1min');
                    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                }
            });
        };
        const interval = setInterval(checkSchedule, 10000);
        return () => clearInterval(interval);
    }, [events, addNotification]);

    // Invoice overdue notifications
    useEffect(() => {
        const checkInvoices = () => {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            projects.forEach(project => {
                project.invoices.forEach(inv => {
                    if (inv.status !== 'Paid' && inv.dueDate) {
                        const dueDate = new Date(inv.dueDate);
                        if (dueDate < today && !notifiedInvoicesRef.current.has(inv.id)) {
                            addNotification(
                                'Retard de Paiement 💸',
                                `La facture ${inv.number} de ${project.clientName} est échue depuis le ${new Date(inv.dueDate).toLocaleDateString()}.`,
                                'finance',
                                `/client/${encodeURIComponent(project.id)}`,
                            );
                            notifiedInvoicesRef.current.add(inv.id);
                        }
                    }
                });
            });
        };
        checkInvoices();
        const interval = setInterval(checkInvoices, 60000);
        return () => clearInterval(interval);
    }, [projects, addNotification]);

    // Client inactivity notifications (2 weeks)
    useEffect(() => {
        const checkInactiveClients = () => {
            const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
            activeProjects.forEach(project => {
                const projectActivities = activities.filter(a => a.projectId === project.id);
                const lastActivity = projectActivities.length > 0
                    ? new Date(projectActivities[0].timestamp).getTime()
                    : new Date(project.createdAt).getTime();
                const inactiveDuration = now - lastActivity;
                if (inactiveDuration > TWO_WEEKS_MS && !notifiedInactiveClientsRef.current.has(project.id)) {
                    const daysInactive = Math.floor(inactiveDuration / (24 * 60 * 60 * 1000));
                    addNotification(
                        '💤 Client en sommeil',
                        `Tu n'as pas bossé sur "${project.clientName}" depuis ${daysInactive} jours.`,
                        'warning',
                        `/client/${encodeURIComponent(project.id)}`,
                    );
                    notifiedInactiveClientsRef.current.add(project.id);
                }
            });
        };
        if (projects.length > 0) checkInactiveClients();
        const interval = setInterval(checkInactiveClients, 3600000);
        return () => clearInterval(interval);
    }, [projects, activities, addNotification]);

    // Maintenance notifications
    useEffect(() => {
        const checkMaintenanceAlerts = () => {
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
                    if (today >= oneMonthBefore && today <= endDate && !notifiedMaintenanceRef.current.has(notifKey)) {
                        addNotification('🔧 Maintenance Expirante', `La maintenance offerte de "${project.clientName}" expire dans ${daysUntilExpiry} jours.`, 'warning', `/client/${encodeURIComponent(project.id)}`);
                        notifiedMaintenanceRef.current.add(notifKey);
                    }
                }
                if (maintenance.billingDates?.length) {
                    maintenance.billingDates.forEach(dateStr => {
                        const billingDate = new Date(dateStr);
                        const daysUntilBilling = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const notifKey = `billing_${project.id}_${dateStr}`;
                        if (daysUntilBilling === 1 && !notifiedMaintenanceRef.current.has(notifKey)) {
                            addNotification('💰 Facturation Demain', `N'oublie pas de facturer la maintenance de "${project.clientName}" demain.`, 'finance', `/client/${encodeURIComponent(project.id)}`);
                            notifiedMaintenanceRef.current.add(notifKey);
                        }
                        if (daysUntilBilling === 0 && !notifiedMaintenanceRef.current.has(notifKey + '_today')) {
                            addNotification('🔔 Facturation Aujourd\'hui', `C'est le jour de facturation pour la maintenance de "${project.clientName}" !`, 'finance', `/client/${encodeURIComponent(project.id)}`);
                            notifiedMaintenanceRef.current.add(notifKey + '_today');
                        }
                    });
                }
            });
        };
        if (projects.length > 0) checkMaintenanceAlerts();
        const interval = setInterval(checkMaintenanceAlerts, 3600000);
        return () => clearInterval(interval);
    }, [projects, addNotification]);

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleOpenProject = (project: Project) => {
        navigate(`/client/${encodeURIComponent(project.id)}`);
    };

    const handleCreateClient = async (rawName: string) => {
        const trimmed = rawName.trim();
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

        const targetFolder = newClientStatus === ProjectStatus.ACTIVE ? 'Actifs' : 'Prospects';
        const predictedPath = `${targetFolder}/${safeName}`;

        createClientFolder.mutate(
            { clientName: trimmed, status: newClientStatus },
            {
                onSuccess: () => {
                    const newProject: Project = {
                        id: predictedPath,
                        clientName: trimmed,
                        avatarInitials: trimmed.substring(0, 2).toUpperCase(),
                        status: newClientStatus,
                        phase: WorkflowPhase.DISCOVERY,
                        progress: 0,
                        createdAt: new Date().toISOString(),
                        profile: { email: newClientEmail, phone: newClientPhone, website: newClientWebsite, customFields: [] },
                        tasks: [],
                        invoices: [],
                        brandKit: { colors: [], fonts: [] },
                        credentials: []
                    };

                    // Optimistically add to cache
                    updateProjectCache(newProject);
                    addNotification('Client Créé', `Dossier "${trimmed}" prêt dans ${targetFolder}.`, 'success', `/client/${encodeURIComponent(newProject.id)}`);
                    addActivity('project_created', `Nouveau client: ${trimmed}`, newProject.id, trimmed);
                    setNewClientEmail('');
                    setNewClientPhone('');
                    setNewClientWebsite('');
                    setNewClientStatus(ProjectStatus.PROSPECT);
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
        // Optimistically update cache
        updateProjectCache(updated, oldId);

        saveProjectMutation.mutate(updated, {
            onSuccess: (data) => {
                if (data.success && data.progress !== undefined) {
                    updateProjectCache({ ...updated, progress: data.progress }, oldId);
                }
            },
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

        // Save via React Query mutation (includes optimistic update)
        saveProjectMutation.mutate(targetProject);
        addNotification('Facture Enregistrée', `La facture ${invoice.number} a été sauvegardée.`, 'finance', '/finances');
        addActivity('invoice_created', `Facture ${invoice.number} créée`, targetProject.id, targetProject.clientName, `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
        setShowGlobalInvoiceModal(false);
    };

    const handleAddEvent = (event: CalendarEvent) => {
        addEvent(event);
        addNotification('Agenda Mis à jour', `"${event.title}" ajouté pour le ${event.date}.`, 'success');
        if (event.type === 'Meeting') {
            addActivity('meeting_scheduled', `Réunion: ${event.title}`, undefined, undefined, event.date);
        }
        confetti({ particleCount: 30, spread: 40, colors: ['#5BBFBA', '#F0B7A4'] });
    };

    const handleUpdateEvent = (updatedEvent: CalendarEvent) => {
        updateEvent(updatedEvent);
        addNotification('Agenda Modifié', `"${updatedEvent.title}" a été mis à jour.`, 'info');
    };

    const handleDeleteEvent = (eventId: string) => {
        const eventToDelete = events.find(e => e.id === eventId);
        if (!eventToDelete) return;

        // Execute deletion
        if (eventToDelete.source === 'iCal' && eventToDelete.calendarName) {
            deleteCalendarEventMutation.mutate({
                id: eventId,
                calendarName: eventToDelete.calendarName,
            });
        }
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
        const statuses = [ProjectStatus.ACTIVE, ProjectStatus.PROSPECT, ProjectStatus.PRO_BONO, ProjectStatus.PERSO];
        const currentIndex = statuses.indexOf(project.status);
        const nextStatus = currentIndex === -1 ? statuses[0] : statuses[(currentIndex + 1) % statuses.length];
        const previousStatus = project.status;

        // Optimistic update
        updateProjectCache({ ...project, status: nextStatus });
        addNotification('Statut Changé', `${project.clientName} est passé en ${nextStatus}.`, 'info', `/client/${encodeURIComponent(project.id)}`);
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
        await handleCreateClient("Dossier_Exemple");
        addNotification("Base de données Initialisée", "Le dossier est prêt sur votre Bureau.", "success");
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    };

    const handleMorningBriefing = async () => {
        setShowMondayBriefing(true);
        setIsBriefingLoading(true);
        setBriefingContent('');
        const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
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
        [ProjectStatus.ACTIVE]: 1,
        [ProjectStatus.PROSPECT]: 2,
        [ProjectStatus.PERSO]: 3,
        [ProjectStatus.PRO_BONO]: 4,
        [ProjectStatus.ARCHIVED]: 5
    };

    const filteredProjects = projects
        .filter(p => {
            let matchesFilter = filter === 'Tous';
            if (!matchesFilter) {
                if (filter === 'Actif') matchesFilter = p.status === ProjectStatus.ACTIVE;
                else if (filter === 'Prospect') matchesFilter = p.status === ProjectStatus.PROSPECT;
                else if (filter === 'Pro Bono') matchesFilter = p.status === ProjectStatus.PRO_BONO;
                else if (filter === 'Perso') matchesFilter = p.status === ProjectStatus.PERSO;
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
                                    type: 'Personal',
                                    source: 'local',
                                    isAppEvent: true
                                });
                            }}
                        />
                    </Suspense>
                </div>
            </div>

            {/* ACTIVITY WIDGET */}
            {activities.length > 0 && (
                <div className="mb-4 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Clock size={18} className="text-brand-orange" /> Activité récente
                            </h3>
                            <span className="text-xs text-slate-400">{activities.length} actions</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
                            {activities.slice(0, 8).map((act) => {
                                const icons: Record<Activity['type'], React.ReactNode> = {
                                    invoice_created: <FileText size={14} className="text-emerald-500" />,
                                    invoice_paid: <DollarSign size={14} className="text-green-500" />,
                                    project_created: <FolderPlus size={14} className="text-blue-500" />,
                                    project_archived: <Archive size={14} className="text-slate-500" />,
                                    project_status_changed: <RefreshCw size={14} className="text-purple-500" />,
                                    task_completed: <CheckCircle size={14} className="text-emerald-500" />,
                                    client_updated: <User size={14} className="text-orange-500" />,
                                    brand_updated: <Palette size={14} className="text-pink-500" />,
                                    meeting_scheduled: <Calendar size={14} className="text-blue-500" />,
                                    file_uploaded: <Upload size={14} className="text-cyan-500" />,
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
                                return (
                                    <div key={act.id} className="flex-shrink-0 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 min-w-[200px] max-w-[250px] border border-slate-100 dark:border-slate-700/50 hover:border-brand-orange/50 transition-colors cursor-default">
                                        <div className="flex items-start gap-2">
                                            <div className="p-1.5 bg-white dark:bg-slate-700/80 rounded-lg shadow-sm">{icons[act.type]}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{act.title}</p>
                                                {act.projectName && <p className="text-xs text-slate-500 truncate">{act.projectName}</p>}
                                                {act.description && <p className="text-xs text-slate-400 truncate">{act.description}</p>}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 text-right">{timeAgo(act.timestamp)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            )}

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
                        {['Actif', 'Archivé', 'Perso', 'Pro Bono', 'Prospect', 'Tous'].map(f => (
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

            {/* New Client Modal */}
            <Modal isOpen={showImporter} onClose={() => setShowImporter(false)} title="Nouveau Client">
                <div className="p-6 space-y-8">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Identité du Client</label>
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-orange to-pink-500 rounded-2xl opacity-20 group-focus-within:opacity-100 transition-opacity duration-500 blur"></div>
                            <div className="relative bg-white dark:bg-slate-800/90 rounded-2xl p-1">
                                <input
                                    autoFocus
                                    placeholder="Ex: Maison de la Fleur..."
                                    className="w-full text-2xl font-serif p-4 rounded-xl bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-300"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateClient((e.target as HTMLInputElement).value); }}
                                    id="new-client-input"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Coordonnées (Optionnel)</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input placeholder="Email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white text-sm" />
                            <input placeholder="Téléphone" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white text-sm" />
                            <input placeholder="Site Web" value={newClientWebsite} onChange={(e) => setNewClientWebsite(e.target.value)} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white text-sm" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Statut de démarrage</label>
                        <select value={newClientStatus} onChange={(e) => setNewClientStatus(e.target.value as ProjectStatus)} className="w-full bg-slate-50 dark:bg-slate-800/80 dark:border dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-orange dark:text-white">
                            {Object.values(ProjectStatus).map((status) => (<option key={status} value={status}>{status}</option>))}
                        </select>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">F</div>
                            Franck préparera les dossiers.
                        </div>
                        <button
                            onClick={() => { const input = document.getElementById('new-client-input') as HTMLInputElement; if (input?.value) handleCreateClient(input.value); }}
                            disabled={isCreatingClient}
                            className={`px-8 py-3 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-full font-bold text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-200/50 dark:shadow-none transition-all duration-300 ${isCreatingClient ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 hover:shadow-[0_0_20px_rgba(255,126,95,0.5)]'}`}
                        >
                            {isCreatingClient ? 'Création…' : 'Créer le dossier'}
                        </button>
                    </div>
                </div>
            </Modal>

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
