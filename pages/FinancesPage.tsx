/**
 * FinancesPage - Route-based finance dashboard view
 * Route: /finances
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useProjectStore, useNotificationStore } from '../stores';
import { useProjects, useSaveProject } from '../services/queries';
import { SplashScreen } from '../components/SplashScreen';
import { Invoice, Project } from '../types';
import { formatCurrency } from '../utils';
import { loadStandaloneInvoices, upsertStandaloneInvoice, removeStandaloneInvoice } from '../utils/standaloneInvoicesStorage';
import { requestNextInvoiceNumber } from '../services/invoiceNumbering';
import { runRecurrenceTick } from '../services/recurrenceTick';

const FinanceDashboard = React.lazy(() => import('../components/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));
const InvoiceBuilder = React.lazy(() => import('../components/InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));

import { Modal } from '../components/Shared';

export const FinancesPage: React.FC = () => {
    const navigate = useNavigate();
    const { data: projects = [] } = useProjects();
    const saveProjectMutation = useSaveProject();
    const { theme, currency, showGlobalInvoiceModal, currentInvoiceToEdit, setShowGlobalInvoiceModal, setCurrentInvoiceToEdit } = useUIStore();
    const { addActivity } = useProjectStore();
    const { addNotification } = useNotificationStore();

    const [standaloneRev, setStandaloneRev] = useState(0);
    const standaloneInvoices = useMemo(() => loadStandaloneInvoices(), [standaloneRev]);

    // Tick des factures récurrentes — 1× par session, idempotent (cf. recurrenceTick.ts).
    const tickedRef = useRef(false);
    useEffect(() => {
        if (tickedRef.current) return;
        if (projects.length === 0 && standaloneInvoices.length === 0) return;
        tickedRef.current = true;
        runRecurrenceTick(projects, standaloneInvoices, {
            onUpdateProject: (p) => saveProjectMutation.mutate({ project: p }),
            onUpsertStandalone: (inv) => {
                upsertStandaloneInvoice(inv);
                setStandaloneRev((r) => r + 1);
            },
            onNotify: (msg) => addNotification('Facture récurrente', msg, 'finance'),
        }).catch((err) => console.warn('Recurrence tick failed:', err));
    }, [projects.length, standaloneInvoices.length]);

    const openInvoiceModal = async (invoice?: Invoice, project?: Project | null) => {
        if (!invoice) {
            const number = await requestNextInvoiceNumber();
            const newInv: Invoice = {
                id: `inv-${Date.now()}`,
                number,
                date: new Date().toISOString().split('T')[0],
                amount: 0,
                status: 'Draft',
                type: 'Invoice',
                items: [],
                clientAddress: '',
                paymentTermsDays: 30,
                history: [{ at: new Date().toISOString(), actor: 'Marion', action: 'create' }],
            };
            setCurrentInvoiceToEdit({ invoice: newInv });
        } else {
            setCurrentInvoiceToEdit({ invoice, project: project ?? undefined });
        }
        setShowGlobalInvoiceModal(true);
    };

    const handleSaveInvoice = (invoice: Invoice, projectId: string): boolean | void => {
        if (!projectId.trim()) {
            upsertStandaloneInvoice(invoice);
            setStandaloneRev((r) => r + 1);
            addNotification(
                'Facture enregistrée',
                `La facture ${invoice.number} est enregistrée sur cet appareil (sans dossier Marion). Pour la copier aussi dans un dossier sur le disque, associe un dossier puis enregistre à nouveau.`,
                'finance',
            );
            addActivity(
                'invoice_created',
                `Facture ${invoice.number} créée`,
                undefined,
                invoice.clientDisplayName || 'Sans dossier',
                `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`,
            );
            setShowGlobalInvoiceModal(false);
            return;
        }

        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
            addNotification('Erreur', 'Ce dossier client est introuvable. Rafraîchissez la page.', 'error');
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

        saveProjectMutation.mutate(
            { project: targetProject },
            {
                onError: () => {
                    addNotification('Erreur Sauvegarde', 'La facture n’a pas pu être enregistrée.', 'error');
                },
            },
        );
        addNotification('Facture Enregistrée', `La facture ${invoice.number} a été sauvegardée dans le dossier client.`, 'finance');
        addActivity('invoice_created', `Facture ${invoice.number} créée`, targetProject.id, targetProject.clientName, `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
        setShowGlobalInvoiceModal(false);
    };

    const handleUpdateProject = (updated: Project) => {
        saveProjectMutation.mutate({ project: updated });
    };

    return (
        <div className="animate-in fade-in slide-in-from-left-8 duration-500">
            <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des finances..." />}>
                <FinanceDashboard
                    projects={projects}
                    standaloneInvoices={standaloneInvoices}
                    onStandaloneInvoicesChanged={() => setStandaloneRev((r) => r + 1)}
                    onOpenInvoice={(inv, proj) => openInvoiceModal(inv, proj)}
                    onUpdateProject={handleUpdateProject}
                    currency={currency}
                    currentTheme={theme}
                    onClose={() => navigate('/')}
                    onCreateInvoice={() => openInvoiceModal()}
                />
            </Suspense>

            {/* Invoice Builder Modal (opened from within finance dashboard) */}
            <Modal isOpen={showGlobalInvoiceModal} onClose={() => setShowGlobalInvoiceModal(false)} title="" width="max-w-6xl">
                {currentInvoiceToEdit && (
                    <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement facture..." />}>
                        <InvoiceBuilder
                            invoice={currentInvoiceToEdit.invoice}
                            project={currentInvoiceToEdit.project}
                            allProjects={projects}
                            onClose={() => setShowGlobalInvoiceModal(false)}
                            onSave={handleSaveInvoice}
                            currency={currency}
                        />
                    </Suspense>
                )}
            </Modal>
        </div>
    );
};

export default FinancesPage;
