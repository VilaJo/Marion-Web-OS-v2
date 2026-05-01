import React, { useState, useRef } from 'react';
import { Project, Invoice, Expense } from '../types';
import { Card, Badge, Modal } from './Shared';
import { EmailWidget as EmailClient } from './email/EmailWidget';
import { formatCurrency } from '../utils';
import { 
    TrendingUp, 
    CreditCard, 
    FileText, 
    Download, 
    ArrowUpRight, 
    ArrowDownRight,
    DollarSign,
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
    PieChart,
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

declare const confetti: any;

interface FinanceDashboardProps {
    projects: Project[];
    onOpenInvoice: (invoice: Invoice, project: Project) => void;
    onUpdateProject: (p: Project) => void;
    currency?: string;
    currentTheme?: string;
    onClose: () => void;
    onCreateInvoice?: () => void;
    onCreateEstimate?: () => void;
}

const FinanceDashboardInner: React.FC<FinanceDashboardProps> = ({ projects, onOpenInvoice, onUpdateProject, currency = 'CHF', currentTheme, onClose, onCreateInvoice, onCreateEstimate }) => {
    const relanceTemplatePolite = useUIStore((s) => s.relanceTemplatePolite);
    const relanceTemplateFirm = useUIStore((s) => s.relanceTemplateFirm);
    const [activeTab, setActiveTab] = useState<'revenus' | 'depenses' | 'analytics' | 'temps' | 'tresorerie' | 'export'>('revenus');
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
                    formatCurrency(item.amount / 1.081), 
                    formatCurrency(item.amount),
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

    const handleMarkAsPaid = (e: React.MouseEvent, invoice: Invoice, project: Project) => {
        e.stopPropagation();
        const updatedInvoice = { ...invoice, status: 'Paid' as const };
        const updatedInvoices = project.invoices.map(i => i.id === invoice.id ? updatedInvoice : i);
        onUpdateProject({ ...project, invoices: updatedInvoices });
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 }, colors: ['#10B981', '#34D399'] });
    };

    const handleRemind = async (e: React.MouseEvent, invoice: Invoice, project: Project) => {
        e.stopPropagation();
        setIsReminding(invoice.id);

        const vars: Record<string, string> = {
            client: project.clientName,
            numero: invoice.number,
            montant: formatCurrency(invoice.amount, 2),
            echeance: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-CH') : '—',
        };
        let subject = `Relance facture ${invoice.number}`;
        let body = applyRelanceTemplate(relanceTemplatePolite, vars);

        try {
            const res = await fetch('/api/v1/invoices/remind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: project.clientName,
                    number: invoice.number,
                    amount: invoice.amount,
                    dueDate: invoice.dueDate
                })
            });
            const data = await res.json();
            
            if (data.subject && data.body) {
                subject = data.subject;
                body = data.body;
                confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 }, colors: ['#a855f7', '#ec4899'] });
            }
        } catch (err) {
            console.warn("AI generation failed, using firm template.");
            body = applyRelanceTemplate(relanceTemplateFirm, vars);
        } finally {
            setReminderData({
                to: project.profile.email || '',
                subject: subject,
                body: body,
            });
            setShowEmailComposer(true);
            setIsReminding(null);
        }
    };

    // Aggregation Logic
    const allInvoices = projects.flatMap(p => p.invoices.map(i => ({ ...i, project: p })));
    
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
        .reduce((sum, i) => sum + i.amount, 0);

    const pendingRevenue = filteredInvoices
        .filter(i => (i.status === 'Pending' || i.status === 'Draft' || i.status === 'Partial') && i.type === 'Invoice')
        .reduce((sum, i) => {
            if (i.status === 'Partial' && i.payments) {
                const paidAmount = i.payments.reduce((s, p) => s + p.amount, 0);
                return sum + (i.amount - paidAmount);
            }
            return sum + i.amount;
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
    for (const p of projects) {
        for (const inv of p.invoices) {
            if (inv.type !== 'Invoice') continue;
            if (inv.status === 'Paid') {
                snapEncaisse += inv.amount;
                continue;
            }
            const paid =
                inv.status === 'Partial' && inv.payments
                    ? inv.payments.reduce((s, x) => s + x.amount, 0)
                    : 0;
            const remaining = Math.max(0, inv.amount - paid);
            if (remaining <= 0) continue;
            const due = inv.dueDate ? new Date(inv.dueDate) : null;
            if (due && due < todayStart) snapRetard += remaining;
            else snapAttente += remaining;
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]" onClick={() => { setShowPeriodMenu(false); setShowStatusMenu(false); }}>
            {/* Header */}
            <div className="flex flex-col gap-4 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 rounded-t-3xl">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                    <h2 className="text-3xl font-serif text-slate-800 dark:text-white flex items-center gap-2">
                        {currentTheme === 'unicorn' && <span className="animate-bounce">🍕</span>} Santé Financière
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Vue d'ensemble de la trésorerie et du bénéfice.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* NEW: Creation Buttons */}
                    <button 
                        onClick={() => onCreateInvoice && onCreateInvoice()}
                        className="px-6 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                        <Plus size={16} /> Facture
                    </button>

                    {/* PIZZA MODE BUTTON (UNICORN ONLY) */}
                    {currentTheme === 'unicorn' && (
                        <button 
                            onClick={() => setShowPizzaModal(true)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-red-200 animate-pulse"
                        >
                            <Pizza size={16} /> Mode Pizza
                        </button>
                    )}

                    {/* Accounting Button */}
                    <button 
                        onClick={() => setShowAccountingModal(true)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        title="Exports Comptables & Fiscaux"
                    >
                        <FileDown size={16} /> <span className="hidden sm:inline">Compta</span>
                    </button>

                    {/* Period Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowPeriodMenu(!showPeriodMenu); setShowStatusMenu(false); }}
                            className={`px-4 py-2 border rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${showPeriodMenu ? 'bg-orange-50 border-orange-200 text-brand-orange' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                        >
                            <Calendar size={16} /> {getPeriodLabel()} <ChevronDown size={14} />
                        </button>
                        {showPeriodMenu && (
                            <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 p-1 z-50">
                                {['month', 'year', 'all'].map((p) => (
                                    <button 
                                        key={p}
                                        onClick={() => setPeriod(p as any)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex justify-between items-center ${period === p ? 'bg-orange-50 text-brand-orange' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        {p === 'month' ? 'Ce Mois' : p === 'year' ? 'Cette Année' : 'Tout'}
                                        {period === p && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Custom Close Button */}
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors group">
                        <X className="w-6 h-6 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
                    </button>
                </div>
                </div>
                <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-emerald-700/80 dark:text-emerald-400/90">Encaissé (factures payées)</p>
                        <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">{formatCurrency(snapEncaisse)} {currency}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-amber-800/80 dark:text-amber-300/90">En attente</p>
                        <p className="text-xl font-bold text-amber-900 dark:text-amber-200 tabular-nums">{formatCurrency(snapAttente)} {currency}</p>
                    </div>
                    <div className="rounded-2xl bg-rose-50/90 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-rose-800/80 dark:text-rose-300/90">En retard (échu)</p>
                        <p className="text-xl font-bold text-rose-900 dark:text-rose-200 tabular-nums">{formatCurrency(snapRetard)} {currency}</p>
                    </div>
                </div>
            </div>

            {/* Financial Health Widget (Unified) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-8 items-center">
                    
                    {/* Left: Net Profit (The "Performance") */}
                    <div className="flex-1 w-full lg:w-auto">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-3 rounded-2xl ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Bénéfice Net</h3>
                                <div className={`text-4xl font-serif font-bold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(netProfit)}{' '}
                                    <span className="text-2xl text-slate-400">{currency}</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-2 pl-14">
                            Cela représente <strong className={netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0}%
                            </strong> de marge sur le chiffre d'affaires.
                        </p>
                    </div>

                    {/* Right: Distribution Visualizer */}
                    <div className="flex-1 w-full lg:w-auto border-l border-slate-100 dark:border-slate-700 lg:pl-8">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Flux de Trésorerie</h4>
                        
                        {/* Visual Bar */}
                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex mb-6">
                            <div 
                                className="h-full bg-red-400 dark:bg-red-500 transition-all duration-1000"
                                style={{ width: `${Math.min((totalExpenses / (totalRevenue || 1)) * 100, 100)}%` }}
                                title="Dépenses"
                            />
                            <div 
                                className="h-full bg-emerald-400 dark:bg-emerald-500 transition-all duration-1000"
                                style={{ width: `${Math.max(0, (netProfit / (totalRevenue || 1)) * 100)}%` }}
                                title="Bénéfice"
                            />
                        </div>

                        {/* Legend / Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                                    <ArrowUpRight size={12} className="text-emerald-500" /> Entrées (CA)
                                </span>
                                <span className="tabular-nums font-bold text-slate-800 dark:text-white text-lg">
                                    {formatCurrency(totalRevenue)} {currency}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                                    <ArrowDownRight size={12} className="text-red-500" /> Sorties (Charges)
                                </span>
                                <span className="tabular-nums font-bold text-slate-800 dark:text-white text-lg">
                                    {formatCurrency(totalExpenses)} {currency}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('revenus')}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all px-4 whitespace-nowrap ${activeTab === 'revenus' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Revenus
                </button>
                <button 
                    onClick={() => setActiveTab('depenses')}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'depenses' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Dépenses
                </button>
                <button 
                    onClick={() => setActiveTab('analytics')}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'analytics' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <BarChart3 size={16} /> Analytics
                </button>
                <button 
                    onClick={() => setActiveTab('temps')}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'temps' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Clock size={16} /> Temps
                </button>
                <button 
                    onClick={() => setActiveTab('tresorerie')}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'tresorerie' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <PiggyBank size={16} /> Trésorerie
                </button>
                <button 
                    onClick={() => setActiveTab('export')}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'export' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <FileSpreadsheet size={16} /> Export
                </button>
            </div>

            {/* Tables Content */}
            <Card className="p-0 overflow-hidden min-h-[400px]">
                
                {/* REVENUS TABLE */}
                {activeTab === 'revenus' && (
                    <>
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="text-slate-400" size={20} />
                                Factures Clients
                            </h3>
                            {filteredInvoices.length === 0 && <span className="text-xs text-slate-400 italic">Aucun document pour cette période.</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Numéro</th>
                                        <th className="px-6 py-4">Client</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Montant TTC</th>
                                        <th className="px-6 py-4 text-center">Statut</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv) => (
                                        <tr 
                                            key={inv.id} 
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                            onClick={() => onOpenInvoice(inv, inv.project)}
                                        >
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                {inv.number}
                                                {inv.type === 'Estimate' && <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">DEVIS</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                                        {inv.project.avatarInitials}
                                                    </div>
                                                    <span className="text-slate-900 dark:text-white font-bold">{inv.project.clientName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-900 dark:text-slate-200">{new Date(inv.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(inv.amount)} {currency}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge color={inv.status === 'Paid' ? 'green' : inv.status === 'Partial' ? 'blue' : inv.status === 'Pending' ? 'yellow' : 'gray'}>
                                                    {inv.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                {/* Mark Paid */}
                                                {inv.status !== 'Paid' && (
                                                    <button 
                                                        onClick={(e) => handleMarkAsPaid(e, inv, inv.project)}
                                                        className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-full transition-colors"
                                                        title="Marquer comme payé"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                
                                                {/* Remind (Only if NOT paid AND NOT Estimate) */}
                                                {inv.status !== 'Paid' && inv.type === 'Invoice' && (
                                                    <button 
                                                        onClick={(e) => handleRemind(e, inv, inv.project)}
                                                        disabled={isReminding === inv.id}
                                                        className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-full transition-colors disabled:opacity-50"
                                                        title="Relancer par mail"
                                                    >
                                                        {isReminding === inv.id ? <ScanLine className="animate-spin" size={16} /> : <Send size={16} />}
                                                    </button>
                                                )}

                                                <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-brand-orange transition-colors">
                                                    <Download size={16} />
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
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <ShoppingBag className="text-slate-400" size={20} />
                                    Achats & Charges
                                </h3>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isScanning}
                                    className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold hover:border-brand-orange text-slate-600 dark:text-slate-300 flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    {isScanning ? <ScanLine className="animate-spin" size={16}/> : <UploadCloud size={16}/>}
                                    {isScanning ? "Analyse..." : "Scanner une facture"}
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleExpenseUpload} />
                            </div>
                            {filteredExpenses.length === 0 && <span className="text-xs text-slate-400 italic">Aucune dépense enregistrée.</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Fournisseur</th>
                                        <th className="px-6 py-4">Catégorie</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4 text-right">Montant</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredExpenses.map((exp) => (
                                        <tr 
                                            key={exp.id} 
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                        >
                                            <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{new Date(exp.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{exp.supplier}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold text-slate-900 dark:text-white">
                                                    {exp.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-900 dark:text-slate-300 text-xs max-w-[200px] truncate" title={exp.description}>{exp.description}</td>
                                            <td className="px-6 py-4 text-right tabular-nums font-bold text-red-600">
                                                -{formatCurrency(exp.amount)} {currency}
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                {exp.fileUrl && (
                                                    <button 
                                                        onClick={() => fetch('/api/v1/files/open', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ path: `Dépenses/${exp.id}${exp.fileUrl.substring(exp.fileUrl.lastIndexOf('.'))}` }) }) } 
                                                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-blue-500 transition-colors"
                                                        title="Voir le justificatif"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteExpense(exp.id)}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
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
                    <div className="p-6 space-y-8">
                        {/* Conversion KPIs */}
                        {analyticsData && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-blue-600 tabular-nums">{analyticsData.conversionRates.estimateToInvoice}%</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold mt-1">Devis → Facture</div>
                                </Card>
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-emerald-600 tabular-nums">{analyticsData.conversionRates.invoiceToPaid}%</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold mt-1">Facture → Payée</div>
                                </Card>
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-purple-600 tabular-nums">{analyticsData.avgPaymentDelay}j</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold mt-1">Délai paiement moy.</div>
                                </Card>
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-orange-600 tabular-nums">{formatCurrency(analyticsData.totals.totalRevenue)}</div>
                                    <div className="text-xs text-slate-500 uppercase font-bold mt-1">CA Total {currency}</div>
                                </Card>
                            </div>
                        )}

                        {/* SVG Line Chart - Monthly Revenue Trend */}
                        {analyticsData && analyticsData.monthlyRevenue.length > 0 && (
                            <div>
                                <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                    <TrendingUp className="text-emerald-500" size={20} />
                                    Tendance CA Mensuel (12 mois)
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
                                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                                                    </linearGradient>
                                                </defs>
                                                {/* Line */}
                                                <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                {/* Data points */}
                                                {points.map((p, i) => (
                                                    <g key={i}>
                                                        <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
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
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <Users className="text-blue-500" size={20} />
                                Top Clients (Revenus & Temps réel)
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
                                                <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-600">{formatCurrency(c.revenue)} {currency}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{c.hours > 0 ? `${c.hours}h` : '—'}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{c.hourlyRate > 0 ? `${c.hourlyRate.toFixed(0)} ${currency}/h` : '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.hourlyRate >= 150 ? (
                                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">Excellent</span>
                                                    ) : c.hourlyRate >= 100 ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-bold">Bon</span>
                                                    ) : c.hourlyRate >= 50 ? (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold">Moyen</span>
                                                    ) : c.hours > 0 ? (
                                                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">Faible</span>
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
                                        const revenueByClient = projects.map(p => ({
                                            name: p.clientName,
                                            initials: p.avatarInitials,
                                            revenue: p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
                                            pending: p.invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0)
                                        })).filter(c => c.revenue > 0 || c.pending > 0).sort((a, b) => b.revenue - a.revenue);
                                        const maxRevenue = Math.max(...revenueByClient.map(c => c.revenue + c.pending), 1);
                                        return revenueByClient.slice(0, 10).map((client, idx) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {client.initials}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{client.name}</span>
                                                        <span className="text-sm tabular-nums font-bold text-emerald-600">{formatCurrency(client.revenue)} {currency}</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                        <div className="h-full bg-emerald-500" style={{ width: `${(client.revenue / maxRevenue) * 100}%` }} />
                                                        <div className="h-full bg-yellow-400" style={{ width: `${(client.pending / maxRevenue) * 100}%` }} />
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
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <BarChart3 className="text-purple-500" size={20} />
                                Revenus Mensuels (N vs N-1)
                            </h3>
                            <div className="grid grid-cols-12 gap-2">
                                {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                                    const monthlyData = months.map((m, idx) => {
                                        const thisYear = allInvoices.filter(i => {
                                            const d = new Date(i.date);
                                            return d.getFullYear() === currentYear && d.getMonth() === idx && i.status === 'Paid';
                                        }).reduce((s, i) => s + i.amount, 0);
                                        const lastYear = allInvoices.filter(i => {
                                            const d = new Date(i.date);
                                            return d.getFullYear() === currentYear - 1 && d.getMonth() === idx && i.status === 'Paid';
                                        }).reduce((s, i) => s + i.amount, 0);
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
                                                    className="w-3 bg-emerald-500 rounded-t" 
                                                    style={{ height: `${(d.thisYear / maxVal) * 100}%`, minHeight: d.thisYear > 0 ? '4px' : '0' }}
                                                    title={`N: ${formatCurrency(d.thisYear)} ${currency}`}
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium">{d.month}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                            <div className="flex gap-4 mt-4 justify-center text-xs">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" /> N-1</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Cette année</span>
                            </div>
                        </div>

                        {/* Year-over-Year Comparison */}
                        <div className="grid grid-cols-2 gap-6">
                            <Card className="p-4">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Cette Année</h4>
                                <div className="text-3xl font-bold text-emerald-600 tabular-nums">
                                    {allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() && i.status === 'Paid').reduce((s, i) => s + i.amount, 0).toLocaleString('fr-CH')} {currency}
                                </div>
                            </Card>
                            <Card className="p-4">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Année Précédente</h4>
                                <div className="text-3xl font-bold text-slate-500 tabular-nums">
                                    {allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() - 1 && i.status === 'Paid').reduce((s, i) => s + i.amount, 0).toLocaleString('fr-CH')} {currency}
                                </div>
                                {(() => {
                                    const thisY = allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() && i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
                                    const lastY = allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() - 1 && i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
                                    const diff = lastY > 0 ? ((thisY - lastY) / lastY * 100).toFixed(0) : 0;
                                    return (
                                        <div className={`text-sm mt-2 flex items-center gap-1 ${Number(diff) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {Number(diff) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            {diff}% vs N-1
                                        </div>
                                    );
                                })()}
                            </Card>
                        </div>

                        {/* Export Button */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => {
                                    const data = allInvoices.map(i => ({
                                        ...i,
                                        clientName: i.project.clientName
                                    }));
                                    generateCSV(data, 'revenus');
                                }}
                                className="px-4 py-2 bg-emerald-100 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-200 flex items-center gap-2"
                            >
                                <FileSpreadsheet size={16} /> Export CSV Revenus
                            </button>
                            <button 
                                onClick={() => generateCSV(expenses, 'depenses')}
                                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200 flex items-center gap-2"
                            >
                                <FileSpreadsheet size={16} /> Export CSV Dépenses
                            </button>
                        </div>
                    </div>
                )}

                {/* TIME TRACKING TAB */}
                {activeTab === 'temps' && (
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Clock className="text-blue-500" size={20} />
                                Rapport Temps Passé
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
                                    const revenue = p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
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
                                                        <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-600">
                                                            {formatCurrency(p.revenue)} {currency}
                                                        </td>
                                                        <td className="px-4 py-3 text-right tabular-nums">
                                                            {p.hourlyRate.toFixed(0)} {currency}/h
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {p.hourlyRate >= 150 ? (
                                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">Excellent</span>
                                                            ) : p.hourlyRate >= 100 ? (
                                                                <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-bold">Bon</span>
                                                            ) : p.hourlyRate >= 50 ? (
                                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold">Moyen</span>
                                                            ) : (
                                                                <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">Faible</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Summary Stats */}
                                        <div className="grid grid-cols-3 gap-4 mt-6">
                                            <Card className="p-4 text-center">
                                                <div className="text-2xl font-bold text-blue-600">
                                                    {projectsWithTime.reduce((s, p) => s + p.hours, 0)}h
                                                </div>
                                                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Total Heures</div>
                                            </Card>
                                            <Card className="p-4 text-center">
                                                <div className="text-2xl font-bold text-emerald-600">
                                                    {(() => {
                                                        const totalHours = projectsWithTime.reduce((s, p) => s + p.hours, 0);
                                                        const totalRevenue = projectsWithTime.reduce((s, p) => s + p.revenue, 0);
                                                        return totalHours > 0 ? (totalRevenue / totalHours).toFixed(0) : 0;
                                                    })()} {currency}/h
                                                </div>
                                                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Taux Moyen</div>
                                            </Card>
                                            <Card className="p-4 text-center">
                                                <div className="text-2xl font-bold text-purple-600">
                                                    {projectsWithTime.filter(p => p.hourlyRate >= 100).length}
                                                </div>
                                                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Projets Rentables</div>
                                            </Card>
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
                                        const revenue = p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
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
                                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-200 flex items-center gap-2"
                            >
                                <FileSpreadsheet size={16} /> Export CSV Rapport Temps
                            </button>
                        </div>
                    </div>
                )}

                {/* TRESORERIE TAB - Treasury Forecast */}
                {activeTab === 'tresorerie' && (
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <PiggyBank className="text-emerald-500" size={20} />
                                Prévisions de Trésorerie
                            </h3>
                        </div>

                        {(() => {
                            // Calculate treasury forecast
                            const now = new Date();
                            const months: { month: string; income: number; expenses: number; balance: number }[] = [];
                            let runningBalance = 0;

                            // Calculate current balance from paid invoices minus expenses
                            const currentYear = now.getFullYear();
                            const allPaidInvoices = projects.flatMap(p => p.invoices.filter(i => i.status === 'Paid'));
                            const totalPaid = allPaidInvoices.reduce((s, i) => s + i.amount, 0);
                            const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
                            runningBalance = totalPaid - totalExpenses;

                            // Forecast next 6 months
                            for (let i = 0; i < 6; i++) {
                                const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
                                const monthName = forecastDate.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });

                                // Expected income: pending invoices due this month
                                const pendingInvoices = projects.flatMap(p => 
                                    p.invoices.filter(inv => {
                                        if (inv.status !== 'Pending') return false;
                                        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
                                        return dueDate.getMonth() === forecastDate.getMonth() && 
                                               dueDate.getFullYear() === forecastDate.getFullYear();
                                    })
                                );
                                const expectedIncome = pendingInvoices.reduce((s, i) => s + i.amount, 0);

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
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <Card className="p-4">
                                            <div className="text-sm text-slate-500 uppercase font-bold mb-1">Solde Actuel</div>
                                            <div className={`text-2xl font-bold ${(totalPaid - totalExpenses) >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {formatCurrency(totalPaid - totalExpenses, currency)}
                                            </div>
                                        </Card>
                                        <Card className="p-4">
                                            <div className="text-sm text-slate-500 uppercase font-bold mb-1">Factures en Attente</div>
                                            <div className="text-2xl font-bold text-amber-600" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {formatCurrency(projects.flatMap(p => p.invoices.filter(i => i.status === 'Pending')).reduce((s, i) => s + i.amount, 0), currency)}
                                            </div>
                                        </Card>
                                        <Card className="p-4">
                                            <div className="text-sm text-slate-500 uppercase font-bold mb-1">Prévision 6 mois</div>
                                            <div className={`text-2xl font-bold ${months[5]?.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                {formatCurrency(months[5]?.balance || 0, currency)}
                                            </div>
                                        </Card>
                                    </div>

                                    {/* Chart */}
                                    <Card className="p-6">
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase">Évolution sur 6 mois</h4>
                                        <div className="h-64 flex items-end gap-2">
                                            {months.map((m, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                                    <div className="w-full flex flex-col items-center justify-end h-48 gap-1">
                                                        {/* Income bar */}
                                                        <div 
                                                            className="w-4 bg-emerald-400 rounded-t transition-all hover:bg-emerald-500"
                                                            style={{ height: `${maxValue > 0 ? (m.income / maxValue) * 100 : 0}%`, minHeight: m.income > 0 ? '4px' : '0' }}
                                                            title={`Revenus: ${formatCurrency(m.income, currency)}`}
                                                        />
                                                        {/* Expense bar */}
                                                        <div 
                                                            className="w-4 bg-red-400 rounded-t transition-all hover:bg-red-500"
                                                            style={{ height: `${maxValue > 0 ? (m.expenses / maxValue) * 100 : 0}%`, minHeight: m.expenses > 0 ? '4px' : '0' }}
                                                            title={`Dépenses: ${formatCurrency(m.expenses, currency)}`}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-slate-500 text-center capitalize" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                        {m.month.split(' ')[0].substring(0, 3)}
                                                    </div>
                                                    <div className={`text-xs font-bold ${m.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                        {formatCurrency(m.balance, currency)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-emerald-400 rounded" />
                                                <span className="text-slate-500">Revenus attendus</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-red-400 rounded" />
                                                <span className="text-slate-500">Dépenses estimées</span>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Detailed Table */}
                                    <Card className="overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800">
                                                <tr>
                                                    <th className="p-3 text-left text-xs font-bold text-slate-500 uppercase">Mois</th>
                                                    <th className="p-3 text-right text-xs font-bold text-slate-500 uppercase">Revenus Attendus</th>
                                                    <th className="p-3 text-right text-xs font-bold text-slate-500 uppercase">Dépenses Estimées</th>
                                                    <th className="p-3 text-right text-xs font-bold text-slate-500 uppercase">Solde Prévisionnel</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {months.map((m, idx) => (
                                                    <tr key={idx} className="border-t border-slate-100 dark:border-slate-700">
                                                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300 capitalize" style={{ fontFamily: 'Raleway, sans-serif' }}>{m.month}</td>
                                                        <td className="p-3 text-right text-emerald-600 font-medium" style={{ fontFamily: 'Raleway, sans-serif' }}>+{formatCurrency(m.income, currency)}</td>
                                                        <td className="p-3 text-right text-red-500 font-medium" style={{ fontFamily: 'Raleway, sans-serif' }}>-{formatCurrency(m.expenses, currency)}</td>
                                                        <td className={`p-3 text-right font-bold ${m.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={{ fontFamily: 'Raleway, sans-serif' }}>
                                                            {formatCurrency(m.balance, currency)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Card>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* EXPORT TAB - Accounting Export */}
                {activeTab === 'export' && (
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileSpreadsheet className="text-blue-500" size={20} />
                                Export Comptable
                            </h3>
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Exportez vos données dans des formats compatibles avec les logiciels comptables (Bexio, Banana, Crésus, etc.)
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* CSV Export */}
                            <Card className="p-6 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                        <FileText className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Export CSV Standard</h4>
                                        <p className="text-xs text-slate-500">Compatible Excel, Google Sheets</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => generateCSV(filteredInvoices, 'revenus')}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-between"
                                    >
                                        <span>Journal des Ventes</span>
                                        <Download size={16} />
                                    </button>
                                    <button 
                                        onClick={() => generateCSV(expenses as any, 'depenses')}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-between"
                                    >
                                        <span>Journal des Achats</span>
                                        <Download size={16} />
                                    </button>
                                </div>
                            </Card>

                            {/* Bexio Format */}
                            <Card className="p-6 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                        <Receipt className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Format Bexio</h4>
                                        <p className="text-xs text-slate-500">Import direct dans Bexio</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        // Bexio CSV format
                                        const headers = ['Date', 'Numéro', 'Client', 'Montant', 'TVA', 'Total TTC', 'Statut'];
                                        const rows = filteredInvoices.map(inv => [
                                            inv.date,
                                            inv.number,
                                            projects.find(p => p.invoices.some(i => i.id === inv.id))?.clientName || '',
                                            inv.amount.toFixed(2),
                                            '0.00', // TVA
                                            inv.amount.toFixed(2),
                                            inv.status === 'Paid' ? 'Payé' : 'En attente'
                                        ].join(';'));
                                        exportSimpleCSV(headers, rows.map(r => r.split(';')), `Export_Bexio_${new Date().getFullYear()}.csv`);
                                    }}
                                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={16} /> Exporter pour Bexio
                                </button>
                            </Card>

                            {/* Banana Format */}
                            <Card className="p-6 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                                        <FileSpreadsheet className="w-6 h-6 text-yellow-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Format Banana</h4>
                                        <p className="text-xs text-slate-500">Compatible Banana Comptabilité</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        // Banana accounting format
                                        const headers = ['Date', 'Pièce', 'Description', 'Débit', 'Crédit', 'Compte'];
                                        const rows = filteredInvoices.map(inv => [
                                            inv.date,
                                            inv.number,
                                            `Facture ${projects.find(p => p.invoices.some(i => i.id === inv.id))?.clientName || ''}`,
                                            inv.status === 'Paid' ? '' : inv.amount.toFixed(2),
                                            inv.status === 'Paid' ? inv.amount.toFixed(2) : '',
                                            inv.status === 'Paid' ? '1020' : '1100' // Bank or Accounts Receivable
                                        ].join('\t'));
                                        exportSimpleCSV(headers, rows.map(r => r.split('\t')), `Export_Banana_${new Date().getFullYear()}.txt`, '\t');
                                    }}
                                    className="w-full px-4 py-3 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={16} /> Exporter pour Banana
                                </button>
                            </Card>

                            {/* Crésus Format */}
                            <Card className="p-6 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                        <PieChart className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Format Crésus</h4>
                                        <p className="text-xs text-slate-500">Compatible Crésus Comptabilité</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        // Crésus format (simplified)
                                        const headers = ['Date', 'Libellé', 'Débit', 'Crédit', 'Pièce'];
                                        const rows = filteredInvoices.map(inv => [
                                            inv.date.split('-').reverse().join('.'), // DD.MM.YYYY format
                                            `Fact. ${inv.number} - ${projects.find(p => p.invoices.some(i => i.id === inv.id))?.clientName || ''}`,
                                            inv.status === 'Pending' ? inv.amount.toFixed(2) : '',
                                            inv.status === 'Paid' ? inv.amount.toFixed(2) : '',
                                            inv.number
                                        ].join(';'));
                                        exportSimpleCSV(headers, rows.map(r => r.split(';')), `Export_Cresus_${new Date().getFullYear()}.csv`);
                                    }}
                                    className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download size={16} /> Exporter pour Crésus
                                </button>
                            </Card>
                        </div>

                        {/* Full Report */}
                        <Card className="p-6 mt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>Rapport Comptable Complet</h4>
                                    <p className="text-xs text-slate-500" style={{ fontFamily: 'Raleway, sans-serif' }}>Compte de résultat + journaux</p>
                                </div>
                                <button 
                                    onClick={() => setShowAccountingModal(true)}
                                    className="px-6 py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
                                >
                                    <Printer size={16} /> Générer le Rapport
                                </button>
                            </div>
                        </Card>
                    </div>
                )}
            </Card>

            {/* --- ACCOUNTING MODAL --- */}
            <Modal isOpen={showAccountingModal} onClose={() => setShowAccountingModal(false)} title="Clôture Comptable" width="max-w-[95vw] w-full h-[95vh]" noContentPadding={true}>
                <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                <button onClick={() => setAccountingView('report')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${accountingView === 'report' ? 'bg-white dark:bg-slate-600 shadow text-brand-orange' : 'text-slate-500'}`}>Compte de Résultat</button>
                                <button onClick={() => setAccountingView('sales')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${accountingView === 'sales' ? 'bg-white dark:bg-slate-600 shadow text-brand-orange' : 'text-slate-500'}`}>Journal Ventes</button>
                                <button onClick={() => setAccountingView('purchases')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${accountingView === 'purchases' ? 'bg-white dark:bg-slate-600 shadow text-brand-orange' : 'text-slate-500'}`}>Journal Achats</button>
                            </div>
                            <select 
                                value={accountingYear} 
                                onChange={(e) => setAccountingYear(parseInt(e.target.value))}
                                className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 font-bold text-slate-700 dark:text-slate-200 outline-none"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => generateCSV(filteredInvoices, 'revenus')} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold hover:bg-green-100 transition-colors">
                                <FileText size={16} /> Export CSV
                            </button>
                            <button onClick={handleDownloadAccountingPDF} disabled={isGeneratingReport} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50">
                                {isGeneratingReport ? <ScanLine className="animate-spin" size={16} /> : <Printer size={16} />}
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="flex-1 overflow-y-auto p-8" id="accounting-report-preview">
                        <div className="max-w-4xl mx-auto bg-white p-12 shadow-lg rounded-xl min-h-[800px]">
                            
                            {accountingView === 'report' && (
                                <>
                                    {/* Header with branding */}
                                    <div className="border-b-4 border-slate-900 pb-6 mb-8">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h1 className="text-3xl font-serif font-bold text-slate-900 mb-1">
                                                    Compte de Résultat
                                                </h1>
                                                <p className="text-slate-500 text-sm">Exercice comptable {accountingYear}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-serif font-bold text-slate-900">Marion Kindynis</p>
                                                <p className="text-xs text-slate-500">Web Designer Indépendante</p>
                                                <p className="text-xs text-slate-400 mt-1">Généré le {new Date().toLocaleDateString('fr-CH')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Summary Cards */}
                                    <div className="grid grid-cols-3 gap-4 mb-10 avoid-break" style={{ pageBreakInside: 'avoid' }}>
                                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                                    <TrendingUp className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Produits</span>
                                            </div>
                                            <p className="text-2xl tabular-nums font-bold text-emerald-700">{formatCurrency(totalRevenue)}</p>
                                            <p className="text-xs text-emerald-600 mt-1">{currency} TTC</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                                    <Receipt className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Charges</span>
                                            </div>
                                            <p className="text-2xl tabular-nums font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
                                            <p className="text-xs text-red-600 mt-1">{currency}</p>
                                        </div>
                                        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-50 to-indigo-100 border-blue-200' : 'from-orange-50 to-red-100 border-red-200'} rounded-xl p-5 border`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-8 h-8 ${netProfit >= 0 ? 'bg-blue-500' : 'bg-red-500'} rounded-lg flex items-center justify-center`}>
                                                    <PiggyBank className="w-4 h-4 text-white" />
                                                </div>
                                                <span className={`text-xs font-bold uppercase tracking-wider ${netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Résultat</span>
                                            </div>
                                            <p className={`text-2xl tabular-nums font-bold ${netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                                {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                                            </p>
                                            <p className={`text-xs mt-1 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{currency} Net</p>
                                        </div>
                                    </div>

                                    {/* Products Section */}
                                    <div className="mb-10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-900">Produits d'Exploitation</h2>
                                                <p className="text-xs text-slate-500">Chiffre d'affaires et recettes</p>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-slate-50 rounded-xl p-6 space-y-3">
                                            <div className="flex justify-between items-center py-3 border-b border-slate-200">
                                                <div>
                                                    <span className="text-slate-700 font-medium">Chiffre d'Affaires HT</span>
                                                    <span className="text-xs text-slate-400 ml-2">(Prestations de services)</span>
                                                </div>
                                                <span className="tabular-nums font-bold text-slate-900 text-lg">{formatCurrency(totalRevenue / 1.081)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-200">
                                                <div>
                                                    <span className="text-slate-500">TVA Collectée</span>
                                                    <span className="text-xs text-slate-400 ml-2">(8.1%)</span>
                                                </div>
                                                <span className="tabular-nums text-slate-500">{formatCurrency(totalRevenue - (totalRevenue / 1.081))}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-4 bg-emerald-100 -mx-6 px-6 rounded-b-xl mt-4">
                                                <span className="font-bold text-emerald-800 text-lg">Total Produits TTC</span>
                                                <span className="tabular-nums font-black text-emerald-800 text-xl">{formatCurrency(totalRevenue)} {currency}</span>
                                            </div>
                                        </div>

                                        {/* Revenue Details Accordion */}
                                        <details className="mt-4 group">
                                            <summary className="cursor-pointer flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2">
                                                <FileText className="w-4 h-4" />
                                                Voir le détail des {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).length} factures
                                                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="mt-3 border border-emerald-100 rounded-xl overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-emerald-50 text-emerald-700">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold">Date</th>
                                                            <th className="px-4 py-3 text-left font-semibold">Client</th>
                                                            <th className="px-4 py-3 text-left font-semibold">N° Facture</th>
                                                            <th className="px-4 py-3 text-right font-semibold">Montant TTC</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-emerald-50">
                                                        {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).map((inv, idx) => (
                                                            <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'}>
                                                                <td className="px-4 py-3 text-slate-600">{new Date(inv.date).toLocaleDateString('fr-CH')}</td>
                                                                <td className="px-4 py-3 font-medium text-slate-900">{inv.project.clientName}</td>
                                                                <td className="px-4 py-3 text-slate-600">{inv.number}</td>
                                                                <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{formatCurrency(inv.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Charges Section */}
                                    <div className="mb-10" style={{ pageBreakBefore: 'auto', pageBreakInside: 'avoid' }}>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                                <Receipt className="w-5 h-5 text-red-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-900">Charges d'Exploitation</h2>
                                                <p className="text-xs text-slate-500">Dépenses et frais professionnels</p>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-slate-50 rounded-xl p-6 space-y-3">
                                            {Object.entries(expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).reduce((acc: any, exp) => {
                                                acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
                                                return acc;
                                            }, {})).sort((a: any, b: any) => b[1] - a[1]).map(([cat, amount]: any, idx) => (
                                                <div key={cat} className="flex justify-between items-center py-3 border-b border-slate-200 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                                        <span className="text-slate-700 font-medium">{cat}</span>
                                                    </div>
                                                    <span className="tabular-nums text-slate-700">{formatCurrency(amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center py-4 bg-red-100 -mx-6 px-6 rounded-b-xl mt-4">
                                                <span className="font-bold text-red-800 text-lg">Total Charges</span>
                                                <span className="tabular-nums font-black text-red-800 text-xl">{formatCurrency(totalExpenses)} {currency}</span>
                                            </div>
                                        </div>

                                        {/* Expenses Details Accordion */}
                                        <details className="mt-4 group">
                                            <summary className="cursor-pointer flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium py-2">
                                                <FileText className="w-4 h-4" />
                                                Voir le détail des {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).length} dépenses
                                                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="mt-3 border border-red-100 rounded-xl overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-red-50 text-red-700">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold">Date</th>
                                                            <th className="px-4 py-3 text-left font-semibold">Fournisseur</th>
                                                            <th className="px-4 py-3 text-left font-semibold">Catégorie</th>
                                                            <th className="px-4 py-3 text-right font-semibold">Montant</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-red-50">
                                                        {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).map((exp, idx) => (
                                                            <tr key={exp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                                                                <td className="px-4 py-3 text-slate-600">{new Date(exp.date).toLocaleDateString('fr-CH')}</td>
                                                                <td className="px-4 py-3 font-medium text-slate-900">{exp.supplier}</td>
                                                                <td className="px-4 py-3 text-slate-600">{exp.category}</td>
                                                                <td className="px-4 py-3 text-right tabular-nums font-bold text-red-700">{formatCurrency(exp.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Final Result */}
                                    <div className={`rounded-2xl p-8 border-2 ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-blue-50 border-emerald-300' : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'}`} style={{ pageBreakInside: 'avoid' }}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-slate-500 text-sm uppercase tracking-widest mb-1">Résultat de l'Exercice {accountingYear}</p>
                                                <h3 className={`text-2xl font-serif font-bold ${netProfit >= 0 ? 'text-slate-900' : 'text-red-900'}`}>Bénéfice {netProfit >= 0 ? 'Net' : '(Perte)'}</h3>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-4xl tabular-nums font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                                                </p>
                                                <p className="text-slate-500 text-sm mt-1">{currency}</p>
                                            </div>
                                        </div>
                                        
                                        {/* Profit Margin */}
                                        <div className={`mt-6 pt-6 border-t flex justify-between items-center ${netProfit >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
                                            <span className="text-slate-600 text-sm font-medium">Marge bénéficiaire</span>
                                            <span className={`tabular-nums font-bold text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-10 pt-6 border-t border-slate-200 text-center" style={{ pageBreakInside: 'avoid' }}>
                                        <p className="text-xs text-slate-400">
                                            Document généré automatiquement par Marion Web OS • {new Date().toLocaleDateString('fr-CH')} à {new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </>
                            )}

                            {accountingView === 'sales' && (
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="p-2">Numéro</th>
                                            <th className="p-2">Client</th>
                                            <th className="p-2">Date</th>
                                            <th className="p-2 text-right">HT</th>
                                            <th className="p-2 text-right">TVA</th>
                                            <th className="p-2 text-right">TTC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).map(inv => (
                                            <tr key={inv.id}>
                                                <td className="p-2 font-bold text-black dark:text-white">{inv.number}</td>
                                                <td className="p-2 text-black dark:text-white">{inv.project.clientName}</td>
                                                <td className="p-2 text-black dark:text-white">{new Date(inv.date).toLocaleDateString('fr-CH')}</td>
                                                <td className="p-2 text-right font-bold text-black dark:text-white">{formatCurrency(inv.amount / 1.081)}</td>
                                                <td className="p-2 text-right text-black dark:text-white">{formatCurrency(inv.amount - (inv.amount / 1.081))}</td>
                                                <td className="p-2 text-right font-extrabold text-black dark:text-white">{formatCurrency(inv.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {accountingView === 'purchases' && (
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Fournisseur</th>
                                            <th className="p-2">Catégorie</th>
                                            <th className="p-2 text-right">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).map(exp => (
                                            <tr key={exp.id}>
                                                <td className="p-2 text-black dark:text-white">{new Date(exp.date).toLocaleDateString('fr-CH')}</td>
                                                <td className="p-2 font-bold text-black dark:text-white">{exp.supplier}</td>
                                                <td className="p-2 text-black dark:text-white">{exp.category}</td>
                                                <td className="p-2 text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(exp.amount)}</td>
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
                <div className="relative p-8 text-center overflow-hidden bg-[#FFF8F0] border-4 border-[#FFD700] rounded-3xl shadow-2xl">
                    {/* Pizza Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#EF4444 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>
                    
                    {/* Floating Pizzas */}
                    <div className="absolute top-4 left-4 text-4xl animate-bounce">🍕</div>
                    <div className="absolute bottom-10 right-10 text-6xl animate-spin-slow">🍕</div>
                    <div className="absolute top-1/2 left-10 text-2xl animate-pulse">🍅</div>

                    <h2 className="font-serif text-4xl font-bold text-red-600 mb-2 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>Marion Pizza Design Inc.</h2>
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
                                <span className="text-5xl font-black text-brand-orange drop-shadow-sm">{netInPizzas} 🍕</span>
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