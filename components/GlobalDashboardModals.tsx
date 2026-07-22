/**
 * Modales globales — disponibles depuis toutes les routes (pas seulement le Dashboard).
 */
import React, { Suspense, useEffect, useState } from 'react';
import { useUIStore, useProjectStore, useNotificationStore, useUndoStore } from '../stores';
import { useProjects, useSaveProject } from '../services/queries';
import { Modal } from './Shared';
import { SplashScreen } from './SplashScreen';
import { sanitizeHTML } from '../utils/sanitize';
import { formatCurrency } from '../utils';
import { loadStandaloneInvoices, upsertStandaloneInvoice, removeStandaloneInvoice } from '../utils/standaloneInvoicesStorage';
import { generateBriefing } from '../services/geminiService';
import { CalendarEvent, Invoice, Project, ProjectStatus } from '../types';
import { Coffee } from 'lucide-react';

const InvoiceBuilder = React.lazy(() => import('./InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));
const GoalsKPIs = React.lazy(() => import('./GoalsKPIs').then(m => ({ default: m.GoalsKPIs })));
const DocumentTemplates = React.lazy(() => import('./DocumentTemplates').then(m => ({ default: m.DocumentTemplates })));
const Agenda = React.lazy(() => import('./Agenda').then(m => ({ default: m.Agenda })));

export const GlobalDashboardModals: React.FC = () => {
    const { data: projects = [] } = useProjects();
    const saveProjectMutation = useSaveProject();
    const { events, addActivity, addEvent, updateEvent, deleteEvent } = useProjectStore();
    const { addNotification } = useNotificationStore();
    const pushUndo = useUndoStore((s) => s.pushUndo);
    const {
        currency, briefingVocal,
        showGlobalInvoiceModal, setShowGlobalInvoiceModal,
        currentInvoiceToEdit, setCurrentInvoiceToEdit,
        showMondayBriefing, setShowMondayBriefing,
        showGoalsKPIs, setShowGoalsKPIs,
        showDocTemplates, setShowDocTemplates,
        showAgendaModal, setShowAgendaModal,
    } = useUIStore();

    const [briefingContent, setBriefingContent] = useState('');
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [, setStandaloneRev] = useState(0);

    useEffect(() => {
        if (!showMondayBriefing || isBriefingLoading || briefingContent) return;

        const loadBriefing = async () => {
            setIsBriefingLoading(true);
            setBriefingContent('');
            const activeProjects = projects.filter(p => p.status === ProjectStatus.EN_COURS);
            const revenue = projects.flatMap(p => p.invoices).filter(i => i.status === 'Paid').reduce((acc, i) => acc + (i.amount || 0), 0);
            const urgentTasks = projects.flatMap(p => p.tasks).filter(t => t.priority === 'High' && !t.completed);
            const nextEvents = events.filter(e => new Date(e.date) >= new Date()).slice(0, 3);
            const context = `
            DATETIME: ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.
            AGENDA: ${nextEvents.map(e => `- ${e.date} à ${e.startTime}: ${e.title}`).join('\n')}
            PROJETS ACTIFS: ${activeProjects.length} (${activeProjects.map(p => p.clientName).join(', ')}).
            FINANCE: ${formatCurrency(Math.round(revenue), 0)} encaissés.
            URGENCES: ${urgentTasks.length > 0 ? urgentTasks.map(t => `- ${t.title}`).join('\n') : "Rien d'urgent !"}
        `;
            const html = await generateBriefing(context);
            setBriefingContent(html);
            setIsBriefingLoading(false);
            if (briefingVocal && 'speechSynthesis' in window) {
                const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const utterance = new SpeechSynthesisUtterance(plainText);
                utterance.lang = 'fr-FR';
                utterance.rate = 1.1;
                window.speechSynthesis.speak(utterance);
            }
        };

        void loadBriefing();
    }, [showMondayBriefing, projects, events, briefingVocal, briefingContent, isBriefingLoading]);

    const handleAddEvent = (event: CalendarEvent) => {
        addEvent(event);
        if (event.type === 'Call ou rdv pro') {
            addActivity('meeting_scheduled', `Réunion: ${event.title}`, undefined, undefined, event.date);
        }
    };

    const handleUpdateEvent = (updatedEvent: CalendarEvent) => {
        updateEvent(updatedEvent);
    };

    const handleDeleteEvent = (eventId: string) => {
        const eventToDelete = events.find(e => e.id === eventId);
        if (!eventToDelete) return;
        deleteEvent(eventId);
        pushUndo({
            description: `Événement "${eventToDelete.title}" supprimé`,
            restore: () => { addEvent(eventToDelete); },
        });
    };

    const handleSaveGlobalInvoice = (invoice: Invoice, projectId: string): boolean | void => {
        if (!projectId.trim()) {
            upsertStandaloneInvoice(invoice);
            setStandaloneRev((r) => r + 1);
            addNotification(
                'Facture enregistrée',
                `La facture ${invoice.number} est enregistrée sur cet appareil.`,
                'finance',
                '/finances',
            );
            addActivity('invoice_created', `Facture ${invoice.number} créée`, undefined, invoice.clientDisplayName || 'Sans dossier', `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
            setShowGlobalInvoiceModal(false);
            return;
        }

        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
            addNotification('Erreur', 'Ce dossier client est introuvable.', 'error');
            return false;
        }

        removeStandaloneInvoice(invoice.id);
        setStandaloneRev((r) => r + 1);

        const targetProject = { ...projects[projectIndex] };
        const existingIdx = targetProject.invoices.findIndex(i => i.id === invoice.id);
        if (existingIdx >= 0) {
            targetProject.invoices = [...targetProject.invoices];
            targetProject.invoices[existingIdx] = invoice;
        } else {
            targetProject.invoices = [...targetProject.invoices, invoice];
        }

        saveProjectMutation.mutate({ project: targetProject }, {
            onError: () => addNotification('Erreur Sauvegarde', 'La facture n’a pas pu être enregistrée.', 'error'),
        });
        addNotification('Facture Enregistrée', `La facture ${invoice.number} a été sauvegardée.`, 'finance', '/finances');
        addActivity('invoice_created', `Facture ${invoice.number} créée`, targetProject.id, targetProject.clientName, `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
        setShowGlobalInvoiceModal(false);
    };

    return (
        <>
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

            <Modal
                isOpen={showMondayBriefing}
                onClose={() => { setShowMondayBriefing(false); setBriefingContent(''); }}
                title="Briefing du Lundi"
                width="max-w-[95vw] w-full h-[95vh]"
            >
                <div className="bg-[#fffdf9] dark:bg-slate-800/50 p-8 rounded-[32px] border border-[#f5ece0] dark:border-slate-700/50 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-900/10 rounded-bl-full flex items-start justify-end p-6">
                        <Coffee className="text-orange-200 dark:text-orange-800 w-12 h-12" />
                    </div>
                    {isBriefingLoading ? (
                        <div className="min-h-[300px] flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 bg-orange-100 dark:bg-slate-800 rounded-full flex items-center justify-center animate-bounce">
                                <Coffee className="text-brand-orange" size={28} />
                            </div>
                            <p className="font-serif text-lg text-slate-400 animate-pulse">Franck prépare votre café et analyse l&apos;agenda...</p>
                        </div>
                    ) : (
                        <div className="briefing-content min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-700" dangerouslySetInnerHTML={{ __html: sanitizeHTML(briefingContent) }} />
                    )}
                </div>
            </Modal>

            {showGoalsKPIs && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" /></div>}>
                    <GoalsKPIs projects={projects} currency={currency} onClose={() => setShowGoalsKPIs(false)} />
                </Suspense>
            )}

            {showDocTemplates && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>}>
                    <DocumentTemplates onClose={() => setShowDocTemplates(false)} />
                </Suspense>
            )}

            <Modal isOpen={showAgendaModal} onClose={() => setShowAgendaModal(false)} title="Agenda" width="max-w-5xl">
                <Suspense fallback={<div className="min-h-[300px] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#7C9A7E] border-t-transparent rounded-full" /></div>}>
                    <Agenda
                        events={events}
                        onAddEvent={handleAddEvent}
                        onUpdateEvent={handleUpdateEvent}
                        onDeleteEvent={handleDeleteEvent}
                    />
                </Suspense>
            </Modal>

        </>
    );
};

/** Ouvre le builder facture depuis n'importe quelle page. */
export function openGlobalInvoiceModal(
    setCurrentInvoiceToEdit: (v: { invoice: Invoice; project?: Project }) => void,
    setShowGlobalInvoiceModal: (v: boolean) => void,
    invoice?: Invoice,
    project?: Project,
) {
    if (invoice) {
        setCurrentInvoiceToEdit({ invoice, project });
    } else {
        setCurrentInvoiceToEdit({
            invoice: {
                id: `inv-${Date.now()}`,
                number: `F${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                date: new Date().toISOString().split('T')[0],
                amount: 0,
                status: 'Draft',
                type: 'Invoice',
                items: [],
                clientAddress: '',
            },
        });
    }
    setShowGlobalInvoiceModal(true);
}
