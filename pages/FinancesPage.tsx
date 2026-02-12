/**
 * FinancesPage - Route-based finance dashboard view
 * Route: /finances
 */

import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useProjectStore, useNotificationStore } from '../stores';
import { useProjects, useSaveProject, useUpdateProjectCache } from '../services/queries';
import { SplashScreen } from '../components/SplashScreen';
import { Invoice, Project } from '../types';
import { formatCurrency } from '../utils';

const FinanceDashboard = React.lazy(() => import('../components/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));
const InvoiceBuilder = React.lazy(() => import('../components/InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));

import { Modal } from '../components/Shared';

export const FinancesPage: React.FC = () => {
    const navigate = useNavigate();
    const { data: projects = [] } = useProjects();
    const saveProjectMutation = useSaveProject();
    const updateProjectCache = useUpdateProjectCache();
    const { theme, currency, showGlobalInvoiceModal, currentInvoiceToEdit, setShowGlobalInvoiceModal, setCurrentInvoiceToEdit } = useUIStore();
    const { addActivity } = useProjectStore();
    const { addNotification } = useNotificationStore();

    const handleOpenInvoice = (invoice?: Invoice, project?: Project) => {
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

    const handleSaveInvoice = (invoice: Invoice, projectId: string) => {
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

        saveProjectMutation.mutate(targetProject);
        addNotification('Facture Enregistrée', `La facture ${invoice.number} a été sauvegardée.`, 'finance');
        addActivity('invoice_created', `Facture ${invoice.number} créée`, targetProject.id, targetProject.clientName, `${formatCurrency(invoice.amount, 2)} ${invoice.currency || 'CHF'}`);
        setShowGlobalInvoiceModal(false);
    };

    const handleUpdateProject = (updated: Project) => {
        updateProjectCache(updated);
        saveProjectMutation.mutate(updated);
    };

    return (
        <div className="animate-in fade-in slide-in-from-left-8 duration-500">
            <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des finances..." />}>
                <FinanceDashboard
                    projects={projects}
                    onOpenInvoice={handleOpenInvoice}
                    onUpdateProject={handleUpdateProject}
                    currency={currency}
                    currentTheme={theme}
                    onClose={() => navigate('/')}
                    onCreateInvoice={() => handleOpenInvoice()}
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
