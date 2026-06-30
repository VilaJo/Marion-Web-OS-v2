/**
 * InvoicePage - Route-based invoice builder view
 * Route: /client/:id/invoice
 *
 * Supports optional ?invoiceId=xxx query param to edit an existing invoice.
 * Without the param, creates a new invoice for the given client.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useUIStore, useProjectStore, useNotificationStore } from '../stores';
import { useProjects, useSaveProject } from '../services/queries';
import { SplashScreen } from '../components/SplashScreen';
import { Invoice } from '../types';
import { formatCurrency } from '../utils';
import { requestNextInvoiceNumber } from '../services/invoiceNumbering';

const InvoiceBuilder = React.lazy(() => import('../components/InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));

export const InvoicePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const { data: projects = [], isLoading } = useProjects();
    const saveProjectMutation = useSaveProject();
    const { theme, currency } = useUIStore();
    const { addActivity } = useProjectStore();
    const { addNotification } = useNotificationStore();

    const decodedId = id ? decodeURIComponent(id) : '';
    const project = projects.find(p => p.id === decodedId);

    // Redirect if project not found after loading
    useEffect(() => {
        if (!project && projects.length > 0 && decodedId) {
            navigate('/', { replace: true });
        }
    }, [project, projects.length, decodedId, navigate]);

    // Allocated invoice number for new invoices (fetched async from backend)
    const [allocatedNumber, setAllocatedNumber] = useState<string | null>(null);
    const requestedNumberRef = React.useRef(false);
    const invoiceId = searchParams.get('invoiceId');

    useEffect(() => {
        // Only allocate when creating a brand new invoice (no ?invoiceId=).
        if (invoiceId || !project || requestedNumberRef.current) return;
        requestedNumberRef.current = true;
        requestNextInvoiceNumber()
            .then((n) => setAllocatedNumber(n))
            .catch(() => setAllocatedNumber(`F${new Date().getFullYear()}-DRAFT-${Date.now().toString().slice(-6)}`));
    }, [invoiceId, project]);

    // Resolve existing invoice or create a new one
    const invoice = useMemo<Invoice | null>(() => {
        if (!project) return null;

        if (invoiceId) {
            const existing = project.invoices.find(i => i.id === invoiceId);
            if (existing) return existing;
        }

        // New invoice — wait for backend-allocated number
        if (!allocatedNumber) return null;
        return {
            id: `inv-${Date.now()}`,
            number: allocatedNumber,
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            status: 'Draft',
            type: 'Invoice',
            items: [],
            clientAddress: project.profile?.address || '',
            paymentTermsDays: 30,
            history: [{ at: new Date().toISOString(), actor: 'Marion', action: 'create' }],
        };
    }, [project, invoiceId, allocatedNumber]);

    const handleSave = (savedInvoice: Invoice, projectId: string): boolean | void => {
        const targetProject = projects.find(p => p.id === projectId);
        if (!targetProject) {
            addNotification('Erreur', 'Projet introuvable.', 'error');
            return false;
        }

        const updatedProject = { ...targetProject };
        const existingIdx = updatedProject.invoices.findIndex(i => i.id === savedInvoice.id);
        if (existingIdx >= 0) {
            updatedProject.invoices = [...updatedProject.invoices];
            updatedProject.invoices[existingIdx] = savedInvoice;
        } else {
            updatedProject.invoices = [...updatedProject.invoices, savedInvoice];
        }

        saveProjectMutation.mutate(
            { project: updatedProject },
            {
                onError: () => {
                    addNotification('Erreur Sauvegarde', 'La facture n’a pas pu être enregistrée.', 'error');
                },
            },
        );
        addNotification('Facture Enregistrée', `La facture ${savedInvoice.number} a été sauvegardée.`, 'finance', '/finances');
        addActivity('invoice_created', `Facture ${savedInvoice.number} créée`, updatedProject.id, updatedProject.clientName, `${formatCurrency(savedInvoice.amount, 2)} ${savedInvoice.currency || 'CHF'}`);
        navigate(`/client/${encodeURIComponent(projectId)}`);
    };

    const handleClose = () => {
        if (project) {
            navigate(`/client/${encodeURIComponent(project.id)}`);
        } else {
            navigate('/');
        }
    };

    if (!project || !invoice) {
        return <SplashScreen visible={true} loadingText="Chargement de la facture..." />;
    }

    return (
        <div className="animate-in fade-in slide-in-from-left-8 duration-500">
            <Suspense fallback={<SplashScreen visible={true} loadingText={`Ouverture facture ${project.clientName}...`} />}>
                <InvoiceBuilder
                    invoice={invoice}
                    project={project}
                    allProjects={projects}
                    onClose={handleClose}
                    onSave={handleSave}
                    currency={currency}
                    currentTheme={theme}
                />
            </Suspense>
        </div>
    );
};

export default InvoicePage;
