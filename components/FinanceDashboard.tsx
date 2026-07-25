import React, { useState, useRef, useMemo } from 'react';
import { Project, Invoice, Expense } from '../types';
import { Badge, Modal } from './Shared';
import { EmailWidget as EmailClient } from './email/EmailWidget';
import { formatCurrency, invoiceEffectiveAmount } from '../utils';
import { 
    TrendingUp, 
    FileText, 
    Download, 
    ArrowUpRight, 
    ArrowDownRight,
    Calendar,
    ChevronDown,
    Check,
    ScanLine,
    Trash2,
    ShoppingBag,
    UploadCloud,
    Pizza,
    Send,
    X,
    FileDown,
    Printer,
    Plus,
    BarChart3,
    Clock,
    Users,
    TrendingDown,
    FileSpreadsheet,
    Receipt,
    PiggyBank
} from 'lucide-react';
import { useExpenses, useDeleteExpense, useScanExpense, useAnalytics } from '../services/queries';
import { exportSimpleCSV } from '../utils/exportUtils';
import { printElementAsPdf } from '../utils/pdfExport';
import { useUIStore } from '../stores';
import { applyRelanceTemplate } from '../utils/relanceTemplates';
import { upsertStandaloneInvoice, removeStandaloneInvoice } from '../utils/standaloneInvoicesStorage';
import { RelanceTemplateFields } from './RelanceTemplateFields';
import { voidInvoice, canHardDelete, restoreInvoice, isArchivedStatus, buildCreditNote } from '../utils/invoiceEngine';
import { requestNextInvoiceNumber } from '../services/invoiceNumbering';
import {
    computeDso,
    computeOverdueRatio,
    computeForecast12Months,
    computeVatPayable,
    computeOverdueAlerts,
    checkCompliance,
} from '../utils/financeKpis';
import { Archive, RotateCcw, FileMinus, Shield, ShieldAlert, AlertTriangle } from 'lucide-react';

declare const confetti: any;

type InvoiceWithProject = Invoice & { project: Project | null };

function invoiceRowClientLabel(inv: InvoiceWithProject): string {
    if (inv.project) return inv.project.clientName;
    return inv.clientDisplayName?.trim() || 'Sans dossier';
}

function invoiceRowInitials(inv: InvoiceWithProject): string {
    if (inv.project?.avatarInitials) return inv.project.avatarInitials;
    const name = inv.clientDisplayName?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

interface FinanceDashboardProps {
    projects: Project[];
    /** Factures sans dossier client (localStorage). */
    standaloneInvoices?: Invoice[];
    /** Appelé après modification d'une facture autonome (ex. marquer payé). */
    onStandaloneInvoicesChanged?: () => void;
    onOpenInvoice: (invoice: Invoice, project?: Project | null) => void;
    onUpdateProject: (p: Project) => void;
    currency?: string;
    currentTheme?: string;
    onClose: () => void;
    onCreateInvoice?: () => void;
    onCreateEstimate?: () => void;
}

const FinanceDashboardInner: React.FC<FinanceDashboardProps> = ({
    projects,
    standaloneInvoices = [],
    onStandaloneInvoicesChanged,
    onOpenInvoice,
    onUpdateProject,
    currency = 'CHF',
    currentTheme,
    onClose,
    onCreateInvoice,
    onCreateEstimate,
}) => {
    const relanceTemplatePolite = useUIStore((s) => s.relanceTemplatePolite);
    const relanceTemplateFirm = useUIStore((s) => s.relanceTemplateFirm);
    const relanceTemplateFinal = useUIStore((s) => s.relanceTemplateFinal);
    const reminderFees = useUIStore((s) => s.agencyReminderFees);
    const agencyIde = useUIStore((s) => s.agencyIde);
    const agencyVatNumber = useUIStore((s) => s.agencyVatNumber);
    const [activeTab, setActiveTab] = useState<'revenus' | 'depenses' | 'analytics' | 'temps' | 'tresorerie' | 'export' | 'archives'>('revenus');
    const [period, setPeriod] = useState<'all' | 'year' | 'month'>('year');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [showPeriodMenu, setShowPeriodMenu] = useState(false);
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    
    // Email Reminder State
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    const [reminderData, setReminderData] = useState<{to: string, subject: string, body: string} | null>(null);
    
    // Pizza Mode State
    const [showPizzaModal, setShowPizzaModal] = useState(false);
    
    // Expenses via React Query
    const { data: expenses = [] } = useExpenses();
    const deleteExpenseMutation = useDeleteExpense();
    const scanExpenseMutation = useScanExpense();
    const [isScanning, setIsScanning] = useState(false);
    const [isReminding, setIsReminding] = useState<string | null>(null);
    const [showRelanceTemplates, setShowRelanceTemplates] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Analytics data from backend (real time tracking, conversions, trends)
    const { data: analyticsData } = useAnalytics();

    // --- ACCOUNTING STATE & HELPERS ---
    const [showAccountingModal, setShowAccountingModal] = useState(false);
    const [accountingYear, setAccountingYear] = useState(new Date().getFullYear());
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [accountingView, setAccountingView] = useState<'report' | 'sales' | 'purchases'>('report');

    const generateCSV = (data: any[], type: 'revenus' | 'depenses') => {
        const headers = type === 'revenus' 
            ? ['Date', 'Numéro', 'Client', 'Libellé', 'Montant HT', 'Montant TTC', 'Statut']
            : ['Date', 'Fournisseur', 'Catégorie', 'Description', 'Montant'];
        
        const rows = data.map(item => {
            if (type === 'revenus') {
                return [
                    item.date,
                    item.number,
                    item.clientName || item.project?.clientName || 'Inconnu',
                    "Prestations de services",
                    formatCurrency(invoiceEffectiveAmount(item as Invoice) / 1.081), 
                    formatCurrency(invoiceEffectiveAmount(item as Invoice)),
                    item.status
                ];
            } else {
                return [
                    item.date,
                    item.supplier,
                    item.category,
                    item.description,
                    formatCurrency(item.amount)
                ];
            }
        });

        exportSimpleCSV(headers, rows, `Export_${type}_${accountingYear}.csv`);
    };

    const handleDownloadAccountingPDF = async () => {
        setIsGeneratingReport(true);
        setTimeout(async () => {
            const element = document.getElementById('accounting-report-preview');
            if (!element) {
                setIsGeneratingReport(false);
                return;
            }

            let filename = `Compte_Resultat_${accountingYear}_MarionWeb.pdf`;
            if (accountingView === 'sales') filename = `Journal_Ventes_${accountingYear}_MarionWeb.pdf`;
            if (accountingView === 'purchases') filename = `Journal_Achats_${accountingYear}_MarionWeb.pdf`;

            try {
                await printElementAsPdf(element, filename, { pageMarginMm: 10 });
                confetti({ particleCount: 50, spread: 60, colors: ['#10B981', '#3B82F6'] });
            } catch (err) {
                console.error("PDF Failed", err);
                alert("Erreur lors de la génération du rapport.");
            } finally {
                setIsGeneratingReport(false);
            }
        }, 500);
    };

    const handleExpenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        scanExpenseMutation.mutate(file, {
            onSuccess: (data) => {
                if (data.success) {
                    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                } else {
                    alert("Erreur de scan: " + data.error);
                }
            },
            onError: () => {
                alert("Erreur serveur.");
            },
            onSettled: () => {
                setIsScanning(false);
            },
        });
    };

    const handleDeleteExpense = async (id: string) => {
        if(!confirm("Supprimer cette dépense ?")) return;
        deleteExpenseMutation.mutate(id);
    };

    const handleMarkAsPaid = (e: React.MouseEvent, invoice: Invoice, project: Project | null) => {
        e.stopPropagation();
        const updatedInvoice = { ...invoice, status: 'Paid' as const };
        if (!project) {
            upsertStandaloneInvoice(updatedInvoice);
            onStandaloneInvoicesChanged?.();
            confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 }, colors: ['#10B981', '#34D399'] });
            return;
        }
        const updatedInvoices = project.invoices.map(i => i.id === invoice.id ? updatedInvoice : i);
        onUpdateProject({ ...project, invoices: updatedInvoices });
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 }, colors: ['#10B981', '#34D399'] });
    };

    /**
     * Suppression/annulation conforme CO art. 958f :
     *   - Brouillon → hard delete (confirmation).
     *   - Facture émise → soft delete (Voided + voidedAt + reason).
     */
    const handleVoidOrDelete = (e: React.MouseEvent, invoice: Invoice, project: Project | null) => {
        e.stopPropagation();
        if (canHardDelete(invoice)) {
            const ok = window.confirm(
                `Supprimer définitivement le brouillon ${invoice.number} ? Cette action est irréversible.`
            );
            if (!ok) return;
            if (!project) {
                removeStandaloneInvoice(invoice.id);
                onStandaloneInvoicesChanged?.();
                return;
            }
            const updated = project.invoices.filter(i => i.id !== invoice.id);
            onUpdateProject({ ...project, invoices: updated });
            return;
        }
        const reason = window.prompt(
            `La facture ${invoice.number} a été émise — elle ne peut pas être supprimée (CO art. 958f).\n\nElle sera annulée et archivée (conservée 10 ans, exclue des KPIs).\n\nMotif d'annulation (optionnel) :`,
            ''
        );
        if (reason === null) return;
        const voided = voidInvoice(invoice, reason || undefined);
        if (!project) {
            upsertStandaloneInvoice(voided);
            onStandaloneInvoicesChanged?.();
            return;
        }
        const updated = project.invoices.map(i => i.id === invoice.id ? voided : i);
        onUpdateProject({ ...project, invoices: updated });
    };

    /**
     * Crée une note de crédit liée à une facture payée — règle CO/LTVA :
     * on n'efface pas l'historique, on émet un document d'avoir.
     */
    const handleCreateCreditNote = async (e: React.MouseEvent, invoice: Invoice, project: Project | null) => {
        e.stopPropagation();
        const ok = window.confirm(
            `Émettre une note de crédit (avoir) pour la facture ${invoice.number} ?\n\nUn nouveau document type "Note de crédit" sera créé avec des montants négatifs.`
        );
        if (!ok) return;
        const number = await requestNextInvoiceNumber();
        const creditNote = { ...buildCreditNote(invoice), number };
        if (!project) {
            upsertStandaloneInvoice(creditNote as Invoice);
            onStandaloneInvoicesChanged?.();
            return;
        }
        const updated = [...project.invoices, creditNote as Invoice];
        onUpdateProject({ ...project, invoices: updated });
    };

    /** Restauration depuis l'onglet Archives. */
    const handleRestore = (e: React.MouseEvent, invoice: Invoice, project: Project | null) => {
        e.stopPropagation();
        const restored = restoreInvoice(invoice);
        if (!project) {
            upsertStandaloneInvoice(restored);
            onStandaloneInvoicesChanged?.();
            return;
        }
        const updated = project.invoices.map(i => i.id === invoice.id ? restored : i);
        onUpdateProject({ ...project, invoices: updated });
    };

    const handleRemind = async (e: React.MouseEvent, invoice: Invoice, project: Project | null) => {
        e.stopPropagation();
        if (!project) return;
        setIsReminding(invoice.id);

        // Détermine le niveau de relance (1, 2 ou 3) selon l'historique de relances déjà envoyées.
        const sentCount = invoice.reminders?.length || 0;
        const nextLevel: 1 | 2 | 3 = Math.min(3, sentCount + 1) as 1 | 2 | 3;
        const feeChf = reminderFees[nextLevel - 1] || 0;

        const vars: Record<string, string> = {
            client: project.clientName,
            numero: invoice.number,
            montant: formatCurrency(invoiceEffectiveAmount(invoice), 2),
            echeance: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-CH') : '—',
            frais: formatCurrency(feeChf, 2),
        };
        const template =
            nextLevel === 1 ? relanceTemplatePolite
            : nextLevel === 2 ? relanceTemplateFirm
            : relanceTemplateFinal;
        const subjectPrefix = nextLevel === 1 ? 'Relance' : nextLevel === 2 ? '2ème relance' : 'Mise en demeure';
        let subject = `${subjectPrefix} — facture ${invoice.number}`;
        let body = applyRelanceTemplate(template, vars);

        try {
            const res = await fetch('/api/v1/invoices/remind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: project.clientName,
                    number: invoice.number,
                    amount: invoiceEffectiveAmount(invoice),
                    dueDate: invoice.dueDate,
                    level: nextLevel,
                    feeChf,
                })
            });
            const data = await res.json();

            if (data.subject && data.body) {
                subject = data.subject;
                body = data.body;
                confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 }, colors: ['#b05070', '#4a72c4', '#2aada0'] });
            }
        } catch (err) {
            console.warn("AI generation failed, using local template.");
        } finally {
            // Enregistre l'envoi de la relance + frais sur la facture (persistant)
            const reminderEntry = { level: nextLevel, sentAt: new Date().toISOString(), feeChf: feeChf || undefined };
            const updatedInvoice: Invoice = {
                ...invoice,
                reminders: [...(invoice.reminders || []), reminderEntry],
                history: [
                    ...(invoice.history || []),
                    { at: new Date().toISOString(), actor: 'Marion', action: 'remind', note: `Relance niv. ${nextLevel}${feeChf ? ` (+${feeChf} CHF)` : ''}` },
                ],
            };
            const updatedInvoices = project.invoices.map(i => i.id === invoice.id ? updatedInvoice : i);
            onUpdateProject({ ...project, invoices: updatedInvoices });

            setReminderData({
                to: project.profile.email || '',
                subject: subject,
                body: body,
            });
            setShowEmailComposer(true);
            setIsReminding(null);
        }
    };

    // --- KPIs Phase 6 (Santé financière v2) ---
    // Calculés sur l'ensemble des factures non archivées + récurrentes incluses.
    const flatInvoicesForKpis = useMemo(
        () => [
            ...standaloneInvoices,
            ...projects.flatMap(p => p.invoices),
        ].filter(i => !isArchivedStatus(i.status)),
        [projects, standaloneInvoices],
    );
    const dso = useMemo(() => computeDso(flatInvoicesForKpis), [flatInvoicesForKpis]);
    const overdueRatio = useMemo(() => computeOverdueRatio(flatInvoicesForKpis), [flatInvoicesForKpis]);
    const forecast12 = useMemo(() => computeForecast12Months(flatInvoicesForKpis), [flatInvoicesForKpis]);
    const vatPayable = useMemo(() => computeVatPayable(flatInvoicesForKpis), [flatInvoicesForKpis]);
    const overdueAlerts = useMemo(() => computeOverdueAlerts(projects, standaloneInvoices), [projects, standaloneInvoices]);
    const issuedNumbersThisYear = useMemo(() => {
        const y = new Date().getFullYear();
        return flatInvoicesForKpis
            .filter(i => i.type === 'Invoice' && new Date(i.date).getFullYear() === y && i.status !== 'Draft')
            .map(i => i.number);
    }, [flatInvoicesForKpis]);
    // IBAN principal : on prend "main" comme défaut (Eonora Tech OS hardcoded ailleurs).
    const compliance = useMemo(() => checkCompliance({
        agencyIde,
        agencyVatNumber,
        iban: 'CH91 0020 6206 7850 8040 G',
        issuedNumbers: issuedNumbersThisYear,
    }), [agencyIde, agencyVatNumber, issuedNumbersThisYear]);

    // Aggregation Logic — inclut les factures sans dossier (localStorage)
    const allInvoicesRaw: InvoiceWithProject[] = useMemo(
        () => [
            ...standaloneInvoices.map(i => ({ ...i, project: null })),
            ...projects.flatMap(p => p.invoices.map(i => ({ ...i, project: p }))),
        ],
        [projects, standaloneInvoices],
    );

    // Exclus du dashboard principal : Voided + Archived (conservées 10 ans mais cachées)
    const allInvoices = useMemo(
        () => allInvoicesRaw.filter(i => !isArchivedStatus(i.status)),
        [allInvoicesRaw],
    );

    // Factures annulées/archivées (onglet "Archives")
    const archivedInvoices = useMemo(
        () => allInvoicesRaw.filter(i => isArchivedStatus(i.status)),
        [allInvoicesRaw],
    );

    // Filter Invoices
    const filteredInvoices = allInvoices.filter(inv => {
        const date = new Date(inv.date);
        const now = new Date();
        let matchPeriod = true;
        if (period === 'year') matchPeriod = date.getFullYear() === now.getFullYear();
        else if (period === 'month') matchPeriod = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        let matchStatus = true;
        if (statusFilter === 'paid') matchStatus = inv.status === 'Paid';
        if (statusFilter === 'pending') matchStatus = inv.status === 'Pending' || inv.status === 'Draft' || inv.status === 'Partial';
        return matchPeriod && matchStatus;
    });

    // Filter Expenses
    const filteredExpenses = expenses.filter(exp => {
        const date = new Date(exp.date);
        const now = new Date();
        if (period === 'year') return date.getFullYear() === now.getFullYear();
        if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        return true;
    });

    // KPI Calc
    const totalRevenue = filteredInvoices
        .filter(i => i.status === 'Paid' && i.type === 'Invoice')
        .reduce((sum, i) => sum + invoiceEffectiveAmount(i), 0);

    const pendingRevenue = filteredInvoices
        .filter(i => (i.status === 'Pending' || i.status === 'Draft' || i.status === 'Partial') && i.type === 'Invoice')
        .reduce((sum, i) => {
            const eff = invoiceEffectiveAmount(i);
            if (i.status === 'Partial' && i.payments) {
                const paidAmount = i.payments.reduce((s, p) => s + p.amount, 0);
                return sum + (eff - paidAmount);
            }
            return sum + eff;
        }, 0);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    const getPeriodLabel = () => {
        if (period === 'year') return 'Cette Année';
        if (period === 'month') return 'Ce Mois';
        return 'Tout';
    };

    // --- PIZZA MODE CALCS ---
    const PIZZA_PRICE = 22; // CHF
    const netInPizzas = Math.floor(netProfit / PIZZA_PRICE);
    const expensesInPizzas = Math.floor(totalExpenses / PIZZA_PRICE);
    const revenueInPizzas = Math.floor(totalRevenue / PIZZA_PRICE);

    // Global treasury snapshot (all invoices, all periods) — 3-line summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let snapEncaisse = 0;
    let snapAttente = 0;
    let snapRetard = 0;
    const bumpTreasurySnap = (inv: Invoice) => {
        if (inv.type !== 'Invoice') return;
        // Exclure les factures annulées/archivées des KPIs trésorerie
        if (isArchivedStatus(inv.status)) return;
        if (inv.status === 'Paid') {
            snapEncaisse += invoiceEffectiveAmount(inv);
            return;
        }
        const paid =
            inv.status === 'Partial' && inv.payments
                ? inv.payments.reduce((s, x) => s + x.amount, 0)
                : 0;
        const remaining = Math.max(0, invoiceEffectiveAmount(inv) - paid);
        if (remaining <= 0) return;
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (due && due < todayStart) snapRetard += remaining;
        else snapAttente += remaining;
    };
    for (const inv of standaloneInvoices) bumpTreasurySnap(inv);
    for (const p of projects) {
        for (const inv of p.invoices) bumpTreasurySnap(inv);
    }

    const tabCls = (id: typeof activeTab) =>
        `pb-2 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1 ${
            activeTab === id
                ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`;

    const marginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    const chargesPct = Math.min((totalExpenses / (totalRevenue || 1)) * 100, 100);
    const profitPct = Math.max(0, (netProfit / (totalRevenue || 1)) * 100);

    return (
        <div
            className="flex flex-col gap-2.5 animate-in fade-in duration-200 h-[calc(100vh-6.5rem)] min-h-[480px]"
            onClick={() => { setShowPeriodMenu(false); setShowStatusMenu(false); }}
        >
            {/* Header + actions — one row */}
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                    {currentTheme === 'unicorn' && <span>🍕</span>} Santé financière
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        onClick={() => onCreateInvoice && onCreateInvoice()}
                        className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-medium flex items-center gap-1 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                    >
                        <Plus size={13} /> Facture
                    </button>
                    {currentTheme === 'unicorn' && (
                        <button
                            onClick={() => setShowPizzaModal(true)}
                            className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1 text-slate-600 dark:text-slate-300"
                        >
                            <Pizza size={13} /> Pizza
                        </button>
                    )}
                    <button
                        onClick={() => setShowAccountingModal(true)}
                        className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Exports Comptables & Fiscaux"
                    >
                        <FileDown size={13} /> <span className="hidden sm:inline">Compta</span>
                    </button>
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPeriodMenu(!showPeriodMenu); setShowStatusMenu(false); }}
                            className={`px-2.5 py-1 border rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${showPeriodMenu ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <Calendar size={13} /> {getPeriodLabel()} <ChevronDown size={11} />
                        </button>
                        {showPeriodMenu && (
                            <div className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 p-1 z-50">
                                {['month', 'year', 'all'].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p as any)}
                                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex justify-between items-center ${period === p ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        {p === 'month' ? 'Ce Mois' : p === 'year' ? 'Cette Année' : 'Tout'}
                                        {period === p && <Check size={12} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" aria-label="Fermer">
                        <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Single KPI strip — everything above the fold */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                <div className="flex flex-wrap divide-x divide-slate-200 dark:divide-slate-700">
                    <div className="flex-1 min-w-[100px] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Encaissé</p>
                        <p className="text-sm font-semibold tabular-nums text-[#2aada0] leading-tight">{formatCurrency(snapEncaisse)} <span className="text-[10px] text-slate-400 font-medium">{currency}</span></p>
                    </div>
                    <div className="flex-1 min-w-[100px] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">En attente</p>
                        <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100 leading-tight">{formatCurrency(snapAttente)} <span className="text-[10px] text-slate-400 font-medium">{currency}</span></p>
                    </div>
                    <div className="flex-1 min-w-[100px] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">En retard</p>
                        <p className={`text-sm font-semibold tabular-nums leading-tight ${snapRetard > 0 ? 'text-[#b05070]' : 'text-slate-800 dark:text-slate-100'}`}>{formatCurrency(snapRetard)} <span className="text-[10px] text-slate-400 font-medium">{currency}</span></p>
                    </div>
                    <div className="flex-1 min-w-[110px] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Bénéfice</p>
                        <p className={`text-sm font-semibold tabular-nums leading-tight ${netProfit >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                            {formatCurrency(netProfit)} <span className="text-[10px] text-slate-400 font-medium">{currency}</span>
                        </p>
                        <p className="text-[9px] text-slate-400">marge {marginPct}%</p>
                    </div>
                    <div className="flex-1 min-w-[140px] px-3 py-2 hidden sm:block">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Flux</p>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex mb-1">
                            <div className="h-full bg-[#b05070]" style={{ width: `${chargesPct}%` }} title="Charges" />
                            <div className="h-full bg-[#2aada0]" style={{ width: `${profitPct}%` }} title="Bénéfice" />
                        </div>
                        <p className="text-[10px] tabular-nums text-slate-500 flex justify-between gap-2">
                            <span className="flex items-center gap-0.5"><ArrowUpRight size={9} className="text-[#2aada0]" />{formatCurrency(totalRevenue)}</span>
                            <span className="flex items-center gap-0.5"><ArrowDownRight size={9} className="text-[#b05070]" />{formatCurrency(totalExpenses)}</span>
                        </p>
                    </div>
                    <div className="flex-1 min-w-[72px] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">DSO</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white tabular-nums leading-tight">
                            {dso.days !== null ? dso.days : '—'}
                            {dso.days !== null && <span className="text-[10px] text-slate-400 ml-0.5">j</span>}
                        </p>
                    </div>
                    <div className="flex-1 min-w-[72px] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Impayés</p>
                        <p className={`text-sm font-semibold tabular-nums leading-tight ${overdueRatio.ratio > 0.2 ? 'text-[#b05070]' : 'text-slate-800 dark:text-white'}`}>
                            {(overdueRatio.ratio * 100).toFixed(0)}%
                        </p>
                    </div>
                    <div className="flex-1 min-w-[90px] px-3 py-2 hidden md:block">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">TVA {vatPayable.quarter}</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white tabular-nums leading-tight">
                            {formatCurrency(vatPayable.total)}
                        </p>
                    </div>
                    <div className="flex-1 min-w-[100px] px-3 py-2 hidden lg:block">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1">
                            {compliance.every(c => c.ok) ? <Shield size={9} /> : <ShieldAlert size={9} />} Conformité
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {compliance.map(c => (
                                <span key={c.id} className="inline-flex items-center gap-1 text-[9px]">
                                    <span className={`w-1 h-1 rounded-full ${c.ok ? 'bg-[#2aada0]' : 'bg-[#b05070]'}`} />
                                    <span className={c.ok ? 'text-slate-500' : 'text-[#b05070]'}>{c.label}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Overdue — single compact line */}
            {overdueAlerts.length > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0 text-[11px] overflow-hidden">
                    <AlertTriangle className="text-[#b05070] shrink-0" size={12} />
                    <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">
                        {overdueAlerts.length} retard{overdueAlerts.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-400 truncate">
                        {overdueAlerts.slice(0, 3).map(a => `${a.number} (${a.daysLate}j)`).join(' · ')}
                        {overdueAlerts.length > 3 ? ` · +${overdueAlerts.length - 3}` : ''}
                    </span>
                    <span className="ml-auto tabular-nums text-[#b05070] font-medium shrink-0">
                        {formatCurrency(overdueAlerts.reduce((s, a) => s + a.amountDue, 0))} {currency}
                    </span>
                </div>
            )}

            {/* Tabs + content fill remaining height */}
            <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden">
                <div className="flex gap-3 px-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0">
                    <button onClick={() => setActiveTab('revenus')} className={tabCls('revenus')}>Revenus</button>
                    <button onClick={() => setActiveTab('depenses')} className={tabCls('depenses')}>Dépenses</button>
                    <button onClick={() => setActiveTab('analytics')} className={tabCls('analytics')}><BarChart3 size={13} /> Analytics</button>
                    <button onClick={() => setActiveTab('temps')} className={tabCls('temps')}><Clock size={13} /> Temps</button>
                    <button onClick={() => setActiveTab('tresorerie')} className={tabCls('tresorerie')}><PiggyBank size={13} /> Trésorerie</button>
                    <button onClick={() => setActiveTab('export')} className={tabCls('export')}><FileSpreadsheet size={13} /> Export</button>
                    <button
                        onClick={() => setActiveTab('archives')}
                        className={tabCls('archives')}
                        title="Factures annulées / archivées (conservées 10 ans, exclues des KPIs)"
                    >
                        <Archive size={13} /> Archives
                        {archivedInvoices.length > 0 && (
                            <span className="text-[10px] text-slate-400">{archivedInvoices.length}</span>
                        )}
                    </button>
                </div>

                {/* Tables Content — scrolls inside the page */}
                <div className="flex-1 min-h-0 overflow-auto">
                
                {/* REVENUS TABLE */}
                {activeTab === 'revenus' && (
                    <>
                        {/* Modèles de relance — collapsible (used when sending reminder emails below) */}
                        <div className="border-b border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setShowRelanceTemplates(s => !s)}
                                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Send size={13} className="text-slate-400" />
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Modèles de relance</span>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline">pour le bouton Relancer</span>
                                </div>
                                <ChevronDown
                                    size={16}
                                    className={`text-slate-400 transition-transform ${showRelanceTemplates ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {showRelanceTemplates && (
                                <div className="px-6 pb-5 pt-2 space-y-3 bg-slate-50/40 dark:bg-slate-800/30">
                                    <p className="text-xs text-slate-500">
                                        Variables disponibles : <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{client} {numero} {montant} {echeance}'}</code>
                                    </p>
                                    <RelanceTemplateFields />
                                </div>
                            )}
                        </div>

                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <FileText className="text-slate-400" size={13} />
                                Factures · {filteredInvoices.length}
                            </h3>
                            {filteredInvoices.length === 0 && <span className="text-[11px] text-slate-400 italic">Aucun document pour cette période.</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-400 uppercase font-semibold tracking-widest text-[10px] border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-3 py-2">Numéro</th>
                                        <th className="px-3 py-2">Client</th>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2 text-right">Montant TTC</th>
                                        <th className="px-3 py-2 text-center">Statut</th>
                                        <th className="px-3 py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv) => (
                                        <tr 
                                            key={inv.id} 
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                            onClick={() => {
                                                const { project: openProj, ...invClean } = inv;
                                                onOpenInvoice(invClean as Invoice, openProj);
                                            }}
                                        >
                                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                                                {inv.number}
                                                {inv.type === 'Estimate' && <span className="ml-1.5 text-[9px] bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-slate-500">DEVIS</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                                        {invoiceRowInitials(inv)}
                                                    </div>
                                                    <span className="text-slate-800 dark:text-white font-medium truncate max-w-[160px]">{invoiceRowClientLabel(inv)}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-300 text-[13px] tabular-nums">{new Date(inv.date).toLocaleDateString()}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                                                {formatCurrency(invoiceEffectiveAmount(inv))} {currency}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <Badge color={inv.status === 'Paid' ? 'green' : inv.status === 'Partial' ? 'blue' : inv.status === 'Pending' ? 'yellow' : 'gray'}>
                                                    {inv.status}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-2 text-right flex justify-end gap-1">
                                                {/* Mark Paid */}
                                                {inv.status !== 'Paid' && (
                                                    <button 
                                                        onClick={(e) => handleMarkAsPaid(e, inv, inv.project)}
                                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#2aada0] rounded-md transition-colors"
                                                        title="Marquer comme payé"
                                                    >
                                                        <Check size={15} />
                                                    </button>
                                                )}
                                                
                                                {/* Remind (Only if NOT paid AND NOT Estimate) */}
                                                {inv.status !== 'Paid' && inv.type === 'Invoice' && inv.project && (
                                                    <button 
                                                        onClick={(e) => handleRemind(e, inv, inv.project)}
                                                        disabled={isReminding === inv.id}
                                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md transition-colors disabled:opacity-50"
                                                        title="Relancer par mail"
                                                    >
                                                        {isReminding === inv.id ? <ScanLine className="animate-spin" size={15} /> : <Send size={15} />}
                                                    </button>
                                                )}

                                                <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
                                                    <Download size={15} />
                                                </button>

                                                {/* Note de crédit (uniquement sur facture émise & type Invoice) */}
                                                {inv.type === 'Invoice' && inv.status !== 'Draft' && !inv.parentInvoiceId && (
                                                    <button
                                                        onClick={(e) => handleCreateCreditNote(e, inv, inv.project)}
                                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md transition-colors"
                                                        title="Émettre une note de crédit"
                                                    >
                                                        <FileMinus size={15} />
                                                    </button>
                                                )}

                                                {/* Supprimer (brouillon) / Annuler (facture émise) */}
                                                <button
                                                    onClick={(e) => handleVoidOrDelete(e, inv, inv.project)}
                                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-[#b05070] transition-colors"
                                                    title={canHardDelete(inv) ? 'Supprimer le brouillon' : 'Annuler la facture (conservée 10 ans)'}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* DEPENSES TABLE */}
                {activeTab === 'depenses' && (
                    <>
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                    <ShoppingBag className="text-slate-400" size={13} />
                                    Achats · {filteredExpenses.length}
                                </h3>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isScanning}
                                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 transition-colors"
                                >
                                    {isScanning ? <ScanLine className="animate-spin" size={13}/> : <UploadCloud size={13}/>}
                                    {isScanning ? "Analyse…" : "Scanner"}
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleExpenseUpload} />
                            </div>
                            {filteredExpenses.length === 0 && <span className="text-[11px] text-slate-400 italic">Aucune dépense.</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-400 uppercase font-semibold tracking-widest text-[10px] border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Fournisseur</th>
                                        <th className="px-3 py-2">Catégorie</th>
                                        <th className="px-3 py-2">Description</th>
                                        <th className="px-3 py-2 text-right">Montant</th>
                                        <th className="px-3 py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredExpenses.map((exp) => (
                                        <tr 
                                            key={exp.id} 
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                        >
                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-300 text-[13px] tabular-nums">{new Date(exp.date).toLocaleDateString()}</td>
                                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{exp.supplier}</td>
                                            <td className="px-3 py-2">
                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                                    {exp.category}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs max-w-[200px] truncate" title={exp.description}>{exp.description}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-medium text-[#b05070]">
                                                -{formatCurrency(exp.amount)} {currency}
                                            </td>
                                            <td className="px-3 py-2 text-right flex justify-end gap-1">
                                                {exp.fileUrl && (
                                                    <button 
                                                        onClick={() => fetch('/api/v1/files/open', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ path: `Dépenses/${exp.id}${exp.fileUrl.substring(exp.fileUrl.lastIndexOf('.'))}` }) }) } 
                                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                                                        title="Voir le justificatif"
                                                    >
                                                        <FileText size={15} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteExpense(exp.id)}
                                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-[#b05070] transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="p-3 md:p-4 space-y-4">
                        {/* Conversion KPIs — Linear strip */}
                        {analyticsData && (
                            <div className="flex flex-wrap border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
                                <div className="flex-1 min-w-[120px] px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Devis → Facture</div>
                                    <div className="text-xl font-semibold tabular-nums text-[#4a72c4]">{analyticsData.conversionRates.estimateToInvoice}%</div>
                                </div>
                                <div className="flex-1 min-w-[120px] px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Facture → Payée</div>
                                    <div className="text-xl font-semibold tabular-nums text-[#2aada0]">{analyticsData.conversionRates.invoiceToPaid}%</div>
                                </div>
                                <div className="flex-1 min-w-[120px] px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Délai paiement</div>
                                    <div className="text-xl font-semibold tabular-nums text-slate-800 dark:text-white">{analyticsData.avgPaymentDelay}<span className="text-xs text-slate-400 ml-0.5">j</span></div>
                                </div>
                                <div className="flex-1 min-w-[120px] px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">CA Total</div>
                                    <div className="text-xl font-semibold tabular-nums text-slate-800 dark:text-white">{formatCurrency(analyticsData.totals.totalRevenue)} <span className="text-xs text-slate-400">{currency}</span></div>
                                </div>
                            </div>
                        )}

                        {/* SVG Line Chart - Monthly Revenue Trend */}
                        {analyticsData && analyticsData.monthlyRevenue.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                    <TrendingUp className="text-slate-400" size={16} />
                                    Tendance CA mensuel (12 mois)
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                    {(() => {
                                        const data = analyticsData.monthlyRevenue;
                                        const maxRev = Math.max(...data.map(d => d.revenue), 1);
                                        const W = 600, H = 180, padX = 40, padY = 20;
                                        const chartW = W - padX * 2;
                                        const chartH = H - padY * 2;
                                        const points = data.map((d, i) => ({
                                            x: padX + (i / Math.max(data.length - 1, 1)) * chartW,
                                            y: padY + chartH - (d.revenue / maxRev) * chartH,
                                            label: d.label,
                                            value: d.revenue,
                                        }));
                                        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                        const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + chartH} L ${points[0].x} ${padY + chartH} Z`;
                                        // Y-axis labels
                                        const yLabels = [0, maxRev / 2, maxRev].map(v => ({
                                            y: padY + chartH - (v / maxRev) * chartH,
                                            label: v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0),
                                        }));
                                        return (
                                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                                                {/* Grid lines */}
                                                {yLabels.map((yl, i) => (
                                                    <g key={i}>
                                                        <line x1={padX} y1={yl.y} x2={W - padX} y2={yl.y} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 2" />
                                                        <text x={padX - 4} y={yl.y + 3} textAnchor="end" className="fill-slate-400 text-[8px]">{yl.label}</text>
                                                    </g>
                                                ))}
                                                {/* Area fill */}
                                                <path d={areaPath} fill="url(#areaGradient)" />
                                                <defs>
                                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#2aada0" stopOpacity="0.25" />
                                                        <stop offset="100%" stopColor="#2aada0" stopOpacity="0.02" />
                                                    </linearGradient>
                                                </defs>
                                                {/* Line */}
                                                <path d={linePath} fill="none" stroke="#2aada0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                {/* Data points */}
                                                {points.map((p, i) => (
                                                    <g key={i}>
                                                        <circle cx={p.x} cy={p.y} r="3" fill="#2aada0" stroke="white" strokeWidth="1.5" />
                                                        {/* X-axis labels */}
                                                        {i % 2 === 0 && (
                                                            <text x={p.x} y={H - 4} textAnchor="middle" className="fill-slate-400 text-[7px]">{p.label.split(' ')[0]}</text>
                                                        )}
                                                        <title>{`${p.label}: ${formatCurrency(p.value)} ${currency}`}</title>
                                                    </g>
                                                ))}
                                            </svg>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Top Clients with Real Time & Profitability */}
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                <Users className="text-slate-400" size={16} />
                                Top clients (revenus & temps réel)
                            </h3>
                            {analyticsData && analyticsData.topClients.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Client</th>
                                            <th className="px-4 py-3 text-right">Revenus</th>
                                            <th className="px-4 py-3 text-right">Heures réelles</th>
                                            <th className="px-4 py-3 text-right">CHF/h</th>
                                            <th className="px-4 py-3 text-center">Rentabilité</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {analyticsData.topClients.slice(0, 15).map((c, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                                            {c.client.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-slate-800 dark:text-white">{c.client}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums font-medium text-[#2aada0]">{formatCurrency(c.revenue)} {currency}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{c.hours > 0 ? `${c.hours}h` : '—'}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{c.hourlyRate > 0 ? `${c.hourlyRate.toFixed(0)} ${currency}/h` : '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.hourlyRate >= 150 ? (
                                                        <span className="text-xs font-medium text-[#2aada0]">Excellent</span>
                                                    ) : c.hourlyRate >= 100 ? (
                                                        <span className="text-xs font-medium text-[#7C9A7E]">Bon</span>
                                                    ) : c.hourlyRate >= 50 ? (
                                                        <span className="text-xs font-medium text-slate-500">Moyen</span>
                                                    ) : c.hours > 0 ? (
                                                        <span className="text-xs font-medium text-[#b05070]">Faible</span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="space-y-3">
                                    {(() => {
                                        const revenueByClient = (() => {
                                            let rows = projects.map(p => ({
                                                name: p.clientName,
                                                initials: p.avatarInitials,
                                                revenue: p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0),
                                                pending: p.invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0),
                                            }));
                                            const orphanRev = standaloneInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                            const orphanPend = standaloneInvoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                            if (orphanRev > 0 || orphanPend > 0) {
                                                rows = [...rows, {
                                                    name: 'Sans dossier Marion',
                                                    initials: '···',
                                                    revenue: orphanRev,
                                                    pending: orphanPend,
                                                }];
                                            }
                                            return rows.filter(c => c.revenue > 0 || c.pending > 0).sort((a, b) => b.revenue - a.revenue);
                                        })();
                                        const maxRevenue = Math.max(...revenueByClient.map(c => c.revenue + c.pending), 1);
                                        return revenueByClient.slice(0, 10).map((client, idx) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {client.initials}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{client.name}</span>
                                                        <span className="text-sm tabular-nums font-medium text-[#2aada0]">{formatCurrency(client.revenue)} {currency}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                        <div className="h-full bg-[#2aada0]" style={{ width: `${(client.revenue / maxRevenue) * 100}%` }} />
                                                        <div className="h-full bg-slate-300 dark:bg-slate-500" style={{ width: `${(client.pending / maxRevenue) * 100}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Revenue by Month with N-1 Comparison */}
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                <BarChart3 className="text-slate-400" size={16} />
                                Revenus mensuels (N vs N-1)
                            </h3>
                            <div className="grid grid-cols-12 gap-2">
                                {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                                    const monthlyData = months.map((m, idx) => {
                                        const thisYear = allInvoices.filter(i => {
                                            const d = new Date(i.date);
                                            return d.getFullYear() === currentYear && d.getMonth() === idx && i.status === 'Paid';
                                        }).reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                        const lastYear = allInvoices.filter(i => {
                                            const d = new Date(i.date);
                                            return d.getFullYear() === currentYear - 1 && d.getMonth() === idx && i.status === 'Paid';
                                        }).reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                        return { month: m, thisYear, lastYear };
                                    });
                                    const maxVal = Math.max(...monthlyData.flatMap(d => [d.thisYear, d.lastYear]), 1);
                                    return monthlyData.map((d, idx) => (
                                        <div key={idx} className="flex flex-col items-center">
                                            <div className="flex gap-0.5 items-end h-24 mb-2">
                                                <div 
                                                    className="w-3 bg-slate-300 dark:bg-slate-600 rounded-t" 
                                                    style={{ height: `${(d.lastYear / maxVal) * 100}%`, minHeight: d.lastYear > 0 ? '4px' : '0' }}
                                                    title={`N-1: ${formatCurrency(d.lastYear)} ${currency}`}
                                                />
                                                <div 
                                                    className="w-3 bg-[#2aada0] rounded-t" 
                                                    style={{ height: `${(d.thisYear / maxVal) * 100}%`, minHeight: d.thisYear > 0 ? '4px' : '0' }}
                                                    title={`N: ${formatCurrency(d.thisYear)} ${currency}`}
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium">{d.month}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                            <div className="flex gap-4 mt-4 justify-center text-xs text-slate-400">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> N-1</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2aada0]" /> Cette année</span>
                            </div>
                        </div>

                        {/* Year-over-Year Comparison */}
                        <div className="flex flex-wrap border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
                            <div className="flex-1 min-w-[140px] px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Cette année</p>
                                <p className="text-xl font-semibold text-[#2aada0] tabular-nums">
                                    {allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() && i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0).toLocaleString('fr-CH')} <span className="text-xs text-slate-400 font-medium">{currency}</span>
                                </p>
                            </div>
                            <div className="flex-1 min-w-[140px] px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Année précédente</p>
                                <p className="text-xl font-semibold text-slate-800 dark:text-white tabular-nums">
                                    {allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() - 1 && i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0).toLocaleString('fr-CH')} <span className="text-xs text-slate-400 font-medium">{currency}</span>
                                </p>
                                {(() => {
                                    const thisY = allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() && i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                    const lastY = allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() - 1 && i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                    const diff = lastY > 0 ? ((thisY - lastY) / lastY * 100).toFixed(0) : 0;
                                    return (
                                        <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${Number(diff) >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                            {Number(diff) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {diff}% vs N-1
                                        </p>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Export Button */}
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => {
                                    const data = allInvoices.map(i => ({
                                        ...i,
                                        clientName: i.project.clientName
                                    }));
                                    generateCSV(data, 'revenus');
                                }}
                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                            >
                                <FileSpreadsheet size={14} /> CSV revenus
                            </button>
                            <button 
                                onClick={() => generateCSV(expenses, 'depenses')}
                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                            >
                                <FileSpreadsheet size={14} /> CSV dépenses
                            </button>
                        </div>
                    </div>
                )}

                {/* TIME TRACKING TAB */}
                {activeTab === 'temps' && (
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Clock className="text-slate-400" size={16} />
                                Rapport temps passé
                            </h3>
                        </div>

                        {/* Time by Project */}
                        <div className="space-y-4">
                            {(() => {
                                // Use real time tracking data from analytics if available, fall back to estimates
                                const timeByClient = analyticsData?.timeByClient || {};
                                const projectsWithTime = projects.map(p => {
                                    const realData = timeByClient[p.clientName];
                                    const realHours = realData?.hours || 0;
                                    const estimatedHours = p.tasks.filter(t => t.completed).length * 2 + p.tasks.filter(t => !t.completed).length * 4;
                                    const hours = realHours > 0 ? realHours : estimatedHours;
                                    const isReal = realHours > 0;
                                    const revenue = p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                    const hourlyRate = hours > 0 ? revenue / hours : 0;
                                    return {
                                        name: p.clientName,
                                        initials: p.avatarInitials,
                                        hours,
                                        revenue,
                                        hourlyRate,
                                        status: p.status,
                                        isReal,
                                    };
                                }).filter(p => p.hours > 0 || p.revenue > 0).sort((a, b) => b.hours - a.hours);

                                return (
                                    <>
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Client</th>
                                                    <th className="px-4 py-3 text-right">Heures</th>
                                                    <th className="px-4 py-3 text-right">Revenus</th>
                                                    <th className="px-4 py-3 text-right">Taux horaire</th>
                                                    <th className="px-4 py-3 text-center">Rentabilité</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {projectsWithTime.slice(0, 15).map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                                                    {p.initials}
                                                                </div>
                                                                <span className="font-medium text-slate-800 dark:text-white">{p.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right tabular-nums">
                                                            {p.hours}h
                                                            {!p.isReal && <span className="text-[9px] text-slate-400 ml-1" title="Estimation basée sur les tâches">est.</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-medium text-[#2aada0]">
                                                            {formatCurrency(p.revenue)} {currency}
                                                        </td>
                                                        <td className="px-4 py-3 text-right tabular-nums">
                                                            {p.hourlyRate.toFixed(0)} {currency}/h
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {p.hourlyRate >= 150 ? (
                                                                <span className="text-xs font-medium text-[#2aada0]">Excellent</span>
                                                            ) : p.hourlyRate >= 100 ? (
                                                                <span className="text-xs font-medium text-[#7C9A7E]">Bon</span>
                                                            ) : p.hourlyRate >= 50 ? (
                                                                <span className="text-xs font-medium text-slate-500">Moyen</span>
                                                            ) : (
                                                                <span className="text-xs font-medium text-[#b05070]">Faible</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Summary Stats */}
                                        <div className="flex flex-wrap border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-x divide-slate-200 dark:divide-slate-700 mt-6">
                                            <div className="flex-1 min-w-[100px] px-4 py-3 text-center">
                                                <p className="text-xl font-semibold text-[#4a72c4] tabular-nums">
                                                    {projectsWithTime.reduce((s, p) => s + p.hours, 0)}h
                                                </p>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">Total heures</p>
                                            </div>
                                            <div className="flex-1 min-w-[100px] px-4 py-3 text-center">
                                                <p className="text-xl font-semibold text-[#2aada0] tabular-nums">
                                                    {(() => {
                                                        const totalHours = projectsWithTime.reduce((s, p) => s + p.hours, 0);
                                                        const totalRevenue = projectsWithTime.reduce((s, p) => s + p.revenue, 0);
                                                        return totalHours > 0 ? (totalRevenue / totalHours).toFixed(0) : 0;
                                                    })()} <span className="text-xs text-slate-400 font-medium">{currency}/h</span>
                                                </p>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">Taux moyen</p>
                                            </div>
                                            <div className="flex-1 min-w-[100px] px-4 py-3 text-center">
                                                <p className="text-xl font-semibold text-slate-800 dark:text-white tabular-nums">
                                                    {projectsWithTime.filter(p => p.hourlyRate >= 100).length}
                                                </p>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">Projets rentables</p>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Export */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => {
                                    const data = projects.map(p => {
                                        const hours = p.tasks.filter(t => t.completed).length * 2 + p.tasks.filter(t => !t.completed).length * 4;
                                        const revenue = p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                                        return {
                                            client: p.clientName,
                                            hours,
                                            revenue,
                                            hourlyRate: hours > 0 ? (revenue / hours).toFixed(2) : '0'
                                        };
                                    });
                                    exportSimpleCSV(
                                        ['Client', 'Heures', 'Revenus', 'Taux Horaire'],
                                        data.map(d => [d.client, d.hours, d.revenue, d.hourlyRate]),
                                        `Rapport_Temps_${new Date().getFullYear()}.csv`
                                    );
                                }}
                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                            >
                                <FileSpreadsheet size={14} /> CSV rapport temps
                            </button>
                        </div>
                    </div>
                )}

                {/* TRESORERIE TAB - Treasury Forecast */}
                {activeTab === 'tresorerie' && (
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <PiggyBank className="text-slate-400" size={16} />
                                Prévisions de trésorerie
                            </h3>
                        </div>

                        {/* Prévisionnel 12 mois v2 — récurrentes + moyenne mobile (Phase 6) */}
                        <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl">
                            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                                Prévisionnel 12 mois — récurrentes + tendance
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="text-left py-1.5 pr-3">Mois</th>
                                            <th className="text-right py-1.5 pr-3">Récurrentes</th>
                                            <th className="text-right py-1.5 pr-3">Moyenne mobile</th>
                                            <th className="text-right py-1.5">Total prévu</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {forecast12.map((m) => (
                                            <tr key={m.month}>
                                                <td className="py-1.5 pr-3 font-medium text-slate-600 dark:text-slate-300">{m.label}</td>
                                                <td className="py-1.5 pr-3 text-right tabular-nums text-[#4a72c4]">{m.recurring > 0 ? `+${formatCurrency(m.recurring)}` : '—'}</td>
                                                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{formatCurrency(m.average)}</td>
                                                <td className="py-1.5 text-right tabular-nums font-semibold text-[#2aada0]">{formatCurrency(m.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                                            <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">Total 12 mois</td>
                                            <td className="py-2 pr-3 text-right tabular-nums text-[#4a72c4]">{formatCurrency(forecast12.reduce((s, m) => s + m.recurring, 0))}</td>
                                            <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{formatCurrency(forecast12.reduce((s, m) => s + m.average, 0))}</td>
                                            <td className="py-2 text-right tabular-nums font-semibold text-[#2aada0]">{formatCurrency(forecast12.reduce((s, m) => s + m.total, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 italic">
                                Récurrentes : projections depuis les templates actifs · Moyenne mobile : CA moyen des 6 derniers mois.
                            </p>
                        </div>

                        {(() => {
                            // Calculate treasury forecast
                            const now = new Date();
                            const months: { month: string; income: number; expenses: number; balance: number }[] = [];
                            let runningBalance = 0;

                            // Calculate current balance from paid invoices minus expenses
                            const currentYear = now.getFullYear();
                            const allPaidInvoices = [
                                ...standaloneInvoices.filter(i => i.status === 'Paid'),
                                ...projects.flatMap(p => p.invoices.filter(i => i.status === 'Paid')),
                            ];
                            const totalPaid = allPaidInvoices.reduce((s, i) => s + invoiceEffectiveAmount(i), 0);
                            const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
                            runningBalance = totalPaid - totalExpenses;

                            // Forecast next 6 months
                            for (let i = 0; i < 6; i++) {
                                const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
                                const monthName = forecastDate.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });

                                // Expected income: pending invoices due this month
                                const pendingInvoices = [
                                    ...standaloneInvoices.filter(inv => {
                                        if (inv.status !== 'Pending') return false;
                                        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
                                        return dueDate.getMonth() === forecastDate.getMonth() &&
                                               dueDate.getFullYear() === forecastDate.getFullYear();
                                    }),
                                    ...projects.flatMap(p =>
                                        p.invoices.filter(inv => {
                                        if (inv.status !== 'Pending') return false;
                                        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
                                        return dueDate.getMonth() === forecastDate.getMonth() && 
                                               dueDate.getFullYear() === forecastDate.getFullYear();
                                    })),
                                ];
                                const expectedIncome = pendingInvoices.reduce((s, i) => s + invoiceEffectiveAmount(i), 0);

                                // Estimated expenses (average of past expenses or fixed estimate)
                                const avgMonthlyExpense = expenses.length > 0 
                                    ? totalExpenses / Math.max(1, new Set(expenses.map(e => e.date.substring(0, 7))).size)
                                    : 0;

                                runningBalance += expectedIncome - avgMonthlyExpense;

                                months.push({
                                    month: monthName,
                                    income: expectedIncome,
                                    expenses: avgMonthlyExpense,
                                    balance: runningBalance
                                });
                            }

                            const maxValue = Math.max(...months.map(m => Math.max(m.income, m.expenses, Math.abs(m.balance))));

                            return (
                                <>
                                    {/* Current Balance */}
                                    <div className="flex flex-wrap border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
                                        <div className="flex-1 min-w-[120px] px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Solde actuel</p>
                                            <p className={`text-xl font-semibold tabular-nums ${(totalPaid - totalExpenses) >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                {formatCurrency(totalPaid - totalExpenses, currency)}
                                            </p>
                                        </div>
                                        <div className="flex-1 min-w-[120px] px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">En attente</p>
                                            <p className="text-xl font-semibold tabular-nums text-slate-800 dark:text-white">
                                                {formatCurrency(
                                                    [...standaloneInvoices, ...projects.flatMap(p => p.invoices)].filter(i => i.status === 'Pending' || i.status === 'Draft').reduce((s, i) => s + invoiceEffectiveAmount(i), 0),
                                                    currency)}
                                            </p>
                                        </div>
                                        <div className="flex-1 min-w-[120px] px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Prévision 6 mois</p>
                                            <p className={`text-xl font-semibold tabular-nums ${months[5]?.balance >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                {formatCurrency(months[5]?.balance || 0, currency)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Chart */}
                                    <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Évolution sur 6 mois</h4>
                                        <div className="h-56 flex items-end gap-2">
                                            {months.map((m, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                                    <div className="w-full flex flex-col items-center justify-end h-40 gap-1">
                                                        <div 
                                                            className="w-3.5 bg-[#2aada0] rounded-t transition-all"
                                                            style={{ height: `${maxValue > 0 ? (m.income / maxValue) * 100 : 0}%`, minHeight: m.income > 0 ? '4px' : '0' }}
                                                            title={`Revenus: ${formatCurrency(m.income, currency)}`}
                                                        />
                                                        <div 
                                                            className="w-3.5 bg-[#b05070] rounded-t transition-all"
                                                            style={{ height: `${maxValue > 0 ? (m.expenses / maxValue) * 100 : 0}%`, minHeight: m.expenses > 0 ? '4px' : '0' }}
                                                            title={`Dépenses: ${formatCurrency(m.expenses, currency)}`}
                                                        />
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 text-center capitalize">
                                                        {m.month.split(' ')[0].substring(0, 3)}
                                                    </div>
                                                    <div className={`text-[11px] font-medium tabular-nums ${m.balance >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                        {formatCurrency(m.balance, currency)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-center gap-6 mt-4 text-[11px] text-slate-400">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-[#2aada0] rounded-sm" />
                                                Revenus attendus
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-[#b05070] rounded-sm" />
                                                Dépenses estimées
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Table */}
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Mois</th>
                                                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Revenus</th>
                                                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Dépenses</th>
                                                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Solde</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {months.map((m, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 capitalize">{m.month}</td>
                                                        <td className="px-4 py-2.5 text-right tabular-nums text-[#2aada0] font-medium">+{formatCurrency(m.income, currency)}</td>
                                                        <td className="px-4 py-2.5 text-right tabular-nums text-[#b05070] font-medium">-{formatCurrency(m.expenses, currency)}</td>
                                                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${m.balance >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                            {formatCurrency(m.balance, currency)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* EXPORT TAB - Accounting Export */}
                {activeTab === 'export' && (
                    <div className="p-5 space-y-5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <FileSpreadsheet className="text-slate-400" size={16} />
                                Export comptable
                            </h3>
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Formats compatibles Bexio, Banana, Crésus et tableurs.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* CSV Export */}
                            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl">
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">CSV standard</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">Excel, Google Sheets</p>
                                </div>
                                <div className="space-y-2">
                                    <button 
                                        onClick={() => generateCSV(filteredInvoices, 'revenus')}
                                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                                    >
                                        <span>Journal des ventes</span>
                                        <Download size={14} />
                                    </button>
                                    <button 
                                        onClick={() => generateCSV(expenses as any, 'depenses')}
                                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                                    >
                                        <span>Journal des achats</span>
                                        <Download size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Bexio Format */}
                            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl">
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Bexio</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">Import direct</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        // Bexio CSV format
                                        const headers = ['Date', 'Numéro', 'Client', 'Montant', 'TVA', 'Total TTC', 'Statut'];
                                        const rows = filteredInvoices.map(inv => {
                                            const eff = invoiceEffectiveAmount(inv);
                                            return [
                                            inv.date,
                                            inv.number,
                                            invoiceRowClientLabel(inv),
                                            eff.toFixed(2),
                                            '0.00', // TVA
                                            eff.toFixed(2),
                                            inv.status === 'Paid' ? 'Payé' : 'En attente'
                                        ].join(';');
                                        });
                                        exportSimpleCSV(headers, rows.map(r => r.split(';')), `Export_Bexio_${new Date().getFullYear()}.csv`);
                                    }}
                                    className="w-full px-3 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={14} /> Exporter pour Bexio
                                </button>
                            </div>

                            {/* Banana Format */}
                            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl">
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Banana</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">Comptabilité Banana</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        // Banana accounting format
                                        const headers = ['Date', 'Pièce', 'Description', 'Débit', 'Crédit', 'Compte'];
                                        const rows = filteredInvoices.map(inv => {
                                            const eff = invoiceEffectiveAmount(inv);
                                            return [
                                            inv.date,
                                            inv.number,
                                            `Facture ${invoiceRowClientLabel(inv)}`,
                                            inv.status === 'Paid' ? '' : eff.toFixed(2),
                                            inv.status === 'Paid' ? eff.toFixed(2) : '',
                                            inv.status === 'Paid' ? '1020' : '1100' // Bank or Accounts Receivable
                                        ].join('\t');
                                        });
                                        exportSimpleCSV(headers, rows.map(r => r.split('\t')), `Export_Banana_${new Date().getFullYear()}.txt`, '\t');
                                    }}
                                    className="w-full px-3 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={14} /> Exporter pour Banana
                                </button>
                            </div>

                            {/* Crésus Format */}
                            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl">
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Crésus</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">Comptabilité Crésus</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        // Crésus format (simplified)
                                        const headers = ['Date', 'Libellé', 'Débit', 'Crédit', 'Pièce'];
                                        const rows = filteredInvoices.map(inv => {
                                            const eff = invoiceEffectiveAmount(inv);
                                            return [
                                            inv.date.split('-').reverse().join('.'), // DD.MM.YYYY format
                                            `Fact. ${inv.number} - ${invoiceRowClientLabel(inv)}`,
                                            inv.status === 'Pending' ? eff.toFixed(2) : '',
                                            inv.status === 'Paid' ? eff.toFixed(2) : '',
                                            inv.number
                                        ].join(';');
                                        });
                                        exportSimpleCSV(headers, rows.map(r => r.split(';')), `Export_Cresus_${new Date().getFullYear()}.csv`);
                                    }}
                                    className="w-full px-3 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={14} /> Exporter pour Crésus
                                </button>
                            </div>
                        </div>

                        {/* Full Report */}
                        <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Rapport comptable complet</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Compte de résultat + journaux</p>
                            </div>
                            <button 
                                onClick={() => setShowAccountingModal(true)}
                                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center gap-2"
                            >
                                <Printer size={14} /> Générer le rapport
                            </button>
                        </div>
                    </div>
                )}

                {/* ARCHIVES TAB - Factures annulées / archivées (CO art. 958f) */}
                {activeTab === 'archives' && (
                    <>
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <Archive className="text-slate-400" size={13} />
                                Archives · {archivedInvoices.length}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                Conservées 10 ans (CO art. 958f) — exclues des KPIs.
                            </p>
                        </div>
                        {archivedInvoices.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm italic">Aucune facture annulée ou archivée.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-400 uppercase font-semibold tracking-widest text-[10px] border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="px-3 py-2">Numéro</th>
                                            <th className="px-3 py-2">Client</th>
                                            <th className="px-3 py-2">Date émission</th>
                                            <th className="px-3 py-2">Annulée le</th>
                                            <th className="px-3 py-2 text-right">Montant TTC</th>
                                            <th className="px-3 py-2">Motif</th>
                                            <th className="px-3 py-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {archivedInvoices
                                            .sort((a, b) => (b.voidedAt || b.date).localeCompare(a.voidedAt || a.date))
                                            .map(inv => (
                                            <tr key={inv.id} className="opacity-70 hover:opacity-100 transition-opacity">
                                                <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300 line-through">
                                                    {inv.number}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                    {invoiceRowClientLabel(inv)}
                                                </td>
                                                <td className="px-3 py-2 text-slate-500 text-[13px] tabular-nums">{new Date(inv.date).toLocaleDateString('fr-CH')}</td>
                                                <td className="px-3 py-2 text-slate-500 text-[13px] tabular-nums">
                                                    {inv.voidedAt ? new Date(inv.voidedAt).toLocaleDateString('fr-CH') : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                                    {formatCurrency(invoiceEffectiveAmount(inv))} {inv.currency || currency}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-slate-500 max-w-[220px] truncate" title={inv.voidReason || ''}>
                                                    {inv.voidReason || <span className="italic">—</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <button
                                                        onClick={(e) => handleRestore(e, inv, inv.project)}
                                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#2aada0] rounded-md transition-colors"
                                                        title="Restaurer la facture"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
                </div>
            </div>

            {/* --- ACCOUNTING MODAL --- */}
            <Modal isOpen={showAccountingModal} onClose={() => setShowAccountingModal(false)} title="Clôture Comptable" width="max-w-[95vw] w-full h-[95vh]" noContentPadding={true}>
                <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
                    {/* Toolbar — Linear */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3 border-b border-transparent">
                                {([
                                    ['report', 'Compte de résultat'],
                                    ['sales', 'Journal ventes'],
                                    ['purchases', 'Journal achats'],
                                ] as const).map(([id, label]) => (
                                    <button
                                        key={id}
                                        onClick={() => setAccountingView(id)}
                                        className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                            accountingView === id
                                                ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-white'
                                                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <select
                                value={accountingYear}
                                onChange={(e) => setAccountingYear(parseInt(e.target.value))}
                                className="border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 outline-none"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => generateCSV(filteredInvoices, 'revenus')} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <FileText size={14} /> CSV
                            </button>
                            <button onClick={handleDownloadAccountingPDF} disabled={isGeneratingReport} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50">
                                {isGeneratingReport ? <ScanLine className="animate-spin" size={14} /> : <Printer size={14} />}
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="flex-1 overflow-y-auto p-8" id="accounting-report-preview">
                        <div className="max-w-4xl mx-auto bg-white p-12 shadow-lg rounded-xl min-h-[800px]">
                            
                            {accountingView === 'report' && (
                                <>
                                    {/* Header */}
                                    <div className="border-b border-slate-200 pb-5 mb-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h1 className="text-lg font-semibold tracking-tight text-slate-900 mb-0.5">
                                                    Compte de résultat
                                                </h1>
                                                <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Exercice {accountingYear}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-slate-900 text-sm">Marion Kindynis</p>
                                                <p className="text-xs text-slate-500">Web Designer Indépendante</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Généré le {new Date().toLocaleDateString('fr-CH')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Summary — Linear strip */}
                                    <div className="flex flex-wrap border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-200 mb-8 avoid-break" style={{ pageBreakInside: 'avoid' }}>
                                        <div className="flex-1 min-w-[120px] px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1"><TrendingUp size={10} className="text-[#4a72c4]" /> Produits</p>
                                            <p className="text-lg font-semibold tabular-nums text-[#4a72c4]">{formatCurrency(totalRevenue)}</p>
                                            <p className="text-[10px] text-slate-400">{currency} TTC</p>
                                        </div>
                                        <div className="flex-1 min-w-[120px] px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1"><Receipt size={10} className="text-[#b05070]" /> Charges</p>
                                            <p className="text-lg font-semibold tabular-nums text-[#b05070]">{formatCurrency(totalExpenses)}</p>
                                            <p className="text-[10px] text-slate-400">{currency}</p>
                                        </div>
                                        <div className="flex-1 min-w-[120px] px-4 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1"><PiggyBank size={10} className={netProfit >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'} /> Résultat</p>
                                            <p className={`text-lg font-semibold tabular-nums ${netProfit >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                                            </p>
                                            <p className="text-[10px] text-slate-400">{currency} net</p>
                                        </div>
                                    </div>

                                    {/* Products Section */}
                                    <div className="mb-8">
                                        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Produits d'exploitation</h2>
                                        
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50">
                                                <div>
                                                    <span className="text-sm text-slate-700 font-medium">Chiffre d'affaires HT</span>
                                                    <span className="text-[10px] text-slate-400 ml-2">prestations</span>
                                                </div>
                                                <span className="tabular-nums font-medium text-slate-900 text-sm">{formatCurrency(totalRevenue / 1.081)}</span>
                                            </div>
                                            <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50">
                                                <div>
                                                    <span className="text-sm text-slate-500">TVA collectée</span>
                                                    <span className="text-[10px] text-slate-400 ml-2">8.1%</span>
                                                </div>
                                                <span className="tabular-nums text-slate-500 text-sm">{formatCurrency(totalRevenue - (totalRevenue / 1.081))}</span>
                                            </div>
                                            <div className="flex justify-between items-center px-4 py-3 border-t-2 border-slate-200">
                                                <span className="text-sm font-semibold text-slate-800">Total produits TTC</span>
                                                <span className="tabular-nums font-semibold text-[#4a72c4]">{formatCurrency(totalRevenue)} {currency}</span>
                                            </div>
                                        </div>

                                        {/* Revenue Details Accordion */}
                                        <details className="mt-4 group">
                                            <summary className="cursor-pointer flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium py-2">
                                                <FileText className="w-4 h-4" />
                                                Voir le détail des {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).length} factures
                                                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50 text-slate-500">
                                                        <tr>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">Date</th>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">Client</th>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">N° Facture</th>
                                                            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest">Montant TTC</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).map((inv) => (
                                                            <tr key={inv.id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-2.5 text-slate-600">{new Date(inv.date).toLocaleDateString('fr-CH')}</td>
                                                                <td className="px-4 py-2.5 font-medium text-slate-900">{invoiceRowClientLabel(inv)}</td>
                                                                <td className="px-4 py-2.5 text-slate-600">{inv.number}</td>
                                                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#2aada0]">{formatCurrency(invoiceEffectiveAmount(inv))}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Charges Section */}
                                    <div className="mb-8" style={{ pageBreakBefore: 'auto', pageBreakInside: 'avoid' }}>
                                        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Charges d'exploitation</h2>
                                        
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            {Object.entries(expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).reduce((acc: any, exp) => {
                                                acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
                                                return acc;
                                            }, {})).sort((a: any, b: any) => b[1] - a[1]).map(([cat, amount]: any) => (
                                                <div key={cat} className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                    <span className="text-sm text-slate-700 font-medium">{cat}</span>
                                                    <span className="tabular-nums text-sm text-slate-700">{formatCurrency(amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center px-4 py-3 border-t-2 border-slate-200">
                                                <span className="text-sm font-semibold text-slate-800">Total charges</span>
                                                <span className="tabular-nums font-semibold text-[#b05070]">{formatCurrency(totalExpenses)} {currency}</span>
                                            </div>
                                        </div>

                                        {/* Expenses Details Accordion */}
                                        <details className="mt-4 group">
                                            <summary className="cursor-pointer flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium py-2">
                                                <FileText className="w-4 h-4" />
                                                Voir le détail des {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).length} dépenses
                                                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50 text-slate-500">
                                                        <tr>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">Date</th>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">Fournisseur</th>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">Catégorie</th>
                                                            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest">Montant</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).map((exp) => (
                                                            <tr key={exp.id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-2.5 text-slate-600">{new Date(exp.date).toLocaleDateString('fr-CH')}</td>
                                                                <td className="px-4 py-2.5 font-medium text-slate-900">{exp.supplier}</td>
                                                                <td className="px-4 py-2.5 text-slate-600">{exp.category}</td>
                                                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#b05070]">{formatCurrency(exp.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Final Result */}
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5" style={{ pageBreakInside: 'avoid' }}>
                                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                            <div className="text-center sm:text-left">
                                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Résultat de l'exercice {accountingYear}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{netProfit >= 0 ? 'Bénéfice net' : 'Perte'}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className={`text-3xl tabular-nums font-semibold tracking-tight ${netProfit >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                    {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                                                </p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{currency}</p>
                                            </div>
                                            <div className="text-center sm:text-right">
                                                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Marge</span>
                                                <p className={`tabular-nums font-semibold text-lg mt-0.5 ${netProfit >= 0 ? 'text-[#2aada0]' : 'text-[#b05070]'}`}>
                                                    {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-10 pt-6 border-t border-slate-200 text-center" style={{ pageBreakInside: 'avoid' }}>
                                        <p className="text-xs text-slate-400">
                                            Document généré automatiquement par Eonora Tech OS • {new Date().toLocaleDateString('fr-CH')} à {new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </>
                            )}

                            {accountingView === 'sales' && (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Numéro</th>
                                            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Client</th>
                                            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Date</th>
                                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest">HT</th>
                                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest">TVA</th>
                                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest">TTC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).map(inv => {
                                            const eff = invoiceEffectiveAmount(inv);
                                            return (
                                            <tr key={inv.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2.5 font-medium text-slate-900">{inv.number}</td>
                                                <td className="px-3 py-2.5 text-slate-700">{invoiceRowClientLabel(inv)}</td>
                                                <td className="px-3 py-2.5 text-slate-600">{new Date(inv.date).toLocaleDateString('fr-CH')}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">{formatCurrency(eff / 1.081)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{formatCurrency(eff - (eff / 1.081))}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(eff)}</td>
                                            </tr>
                                        );})}
                                    </tbody>
                                </table>
                            )}

                            {accountingView === 'purchases' && (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Date</th>
                                            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Fournisseur</th>
                                            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest">Catégorie</th>
                                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).map(exp => (
                                            <tr key={exp.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2.5 text-slate-600">{new Date(exp.date).toLocaleDateString('fr-CH')}</td>
                                                <td className="px-3 py-2.5 font-medium text-slate-900">{exp.supplier}</td>
                                                <td className="px-3 py-2.5 text-slate-600">{exp.category}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#b05070]">{formatCurrency(exp.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Email Composer Modal */}
            <Modal isOpen={showEmailComposer} onClose={() => setShowEmailComposer(false)} title="" width="max-w-[95vw] w-full h-[95vh]" noContentPadding={true}>
                <div className="h-full">
                    {reminderData && (
                        <EmailClient 
                            initialCompose={reminderData} 
                            onClose={() => setShowEmailComposer(false)} 
                        />
                    )}
                </div>
            </Modal>

            {/* --- PIZZA MODAL --- */}
            <Modal isOpen={showPizzaModal} onClose={() => setShowPizzaModal(false)} title="" width="max-w-2xl">
                <div className="relative p-8 text-center overflow-hidden bg-[#FFF8F0] border-4 border-[#FFD700] rounded-xl shadow-2xl">
                    {/* Pizza Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#EF4444 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>
                    
                    {/* Floating Pizzas */}
                    <div className="absolute top-4 left-4 text-4xl animate-bounce">🍕</div>
                    <div className="absolute bottom-10 right-10 text-6xl animate-spin-slow">🍕</div>
                    <div className="absolute top-1/2 left-10 text-2xl animate-pulse">🍅</div>

                    <h2 className="font-semibold text-4xl font-bold text-red-600 mb-2 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>Marion Pizza Design Inc.</h2>
                    <p className="text-slate-600 font-bold italic mb-8">Bilan Officiel en Pizzanomics</p>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-orange-200 mb-8 relative z-10">
                        <div className="flex justify-between items-center mb-4 border-b border-orange-100 pb-4">
                            <span className="text-lg font-bold text-slate-700">Montagne de Pâte (CA)</span>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-green-600">+{revenueInPizzas} 🍕</span>
                                <div className="text-xs text-slate-400">{formatCurrency(totalRevenue)} CHF</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mb-4 border-b border-orange-100 pb-4">
                            <span className="text-lg font-bold text-slate-700">Ingrédients (Charges)</span>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-red-500">-{expensesInPizzas} 🍕</span>
                                <div className="text-xs text-slate-400">{formatCurrency(totalExpenses)} CHF</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-2xl font-bold text-slate-800 uppercase">Reste à Déguster</span>
                            <div className="text-right">
                                <span className="text-5xl font-black text-slate-900 dark:text-white drop-shadow-sm">{netInPizzas} 🍕</span>
                                <div className="text-sm font-bold text-slate-500 mt-1">Soit {netInPizzas * 8} parts</div>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 tabular-nums">Taux de conversion : 1 Pizza = {PIZZA_PRICE} CHF (Margherita Standard GE)</p>
                    
                    <button onClick={() => { setShowPizzaModal(false); confetti({ particleCount: 100, shapes: ['circle'], colors: ['#EF4444', '#F59E0B'] }); }} className="mt-6 px-8 py-3 bg-red-500 text-white rounded-full font-bold shadow-lg hover:scale-110 transition-transform border-b-4 border-red-700 active:border-b-0 active:translate-y-1">
                        Miam ! Fermer
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export const FinanceDashboard = React.memo(FinanceDashboardInner);