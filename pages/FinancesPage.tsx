/**
 * FinancesPage - Route-based finance dashboard view
 * Route: /finances
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useNotificationStore } from '../stores';
import { useProjects, useSaveProject } from '../services/queries';
import { SplashScreen } from '../components/SplashScreen';
import { Invoice, Project } from '../types';
import { loadStandaloneInvoices, upsertStandaloneInvoice } from '../utils/standaloneInvoicesStorage';
import { requestNextInvoiceNumber } from '../services/invoiceNumbering';
import { runRecurrenceTick } from '../services/recurrenceTick';

const FinanceDashboard = React.lazy(() => import('../components/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));

export const FinancesPage: React.FC = () => {
    const navigate = useNavigate();
    const { data: projects = [] } = useProjects();
    const saveProjectMutation = useSaveProject();
    const { theme, currency, setShowGlobalInvoiceModal, setCurrentInvoiceToEdit } = useUIStore();
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
        </div>
    );
};

export default FinancesPage;
