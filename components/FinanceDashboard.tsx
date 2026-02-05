import React, { useState, useEffect, useRef } from 'react';
import { Project, Invoice, Expense } from '../types';
import { Card, Badge, Modal } from './Shared';
import { EmailClient } from './EmailClient'; // Import EmailClient
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
    FileSpreadsheet
} from 'lucide-react';

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

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ projects, onOpenInvoice, onUpdateProject, currency = 'CHF', currentTheme, onClose, onCreateInvoice, onCreateEstimate }) => {
    const [activeTab, setActiveTab] = useState<'revenus' | 'depenses' | 'analytics' | 'temps'>('revenus');
    const [period, setPeriod] = useState<'all' | 'year' | 'month'>('year');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [showPeriodMenu, setShowPeriodMenu] = useState(false);
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    
    // Email Reminder State
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    const [reminderData, setReminderData] = useState<{to: string, subject: string, body: string} | null>(null);
    
    // Pizza Mode State
    const [showPizzaModal, setShowPizzaModal] = useState(false);
    
    // Expenses State
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isReminding, setIsReminding] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch expenses on mount
    useEffect(() => {
        const fetchExpenses = async () => {
            try {
                const res = await fetch('http://127.0.0.1:5003/api/expenses');
                const data = await res.json();
                if (data.expenses) setExpenses(data.expenses);
            } catch (e) {
                console.error("Failed to load expenses", e);
            }
        };
        fetchExpenses();
    }, []);

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
                    item.project?.clientName || 'Inconnu',
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

        const csvContent = [
            headers.join(';'),
            ...rows.map((r: any[]) => r.join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Export_${type}_${accountingYear}.csv`;
        link.click();
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

            const opt = {
                margin: 0,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            try {
                // @ts-ignore
                const html2pdf = (await import('html2pdf.js')).default;
                await html2pdf().set(opt).from(element).save();
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
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('http://127.0.0.1:5003/api/expenses/scan', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setExpenses([data.expense, ...expenses]);
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
            } else {
                alert("Erreur de scan: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Erreur serveur.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if(!confirm("Supprimer cette dépense ?")) return;
        try {
            await fetch(`http://127.0.0.1:5003/api/expenses/${id}`, { method: 'DELETE' });
            setExpenses(expenses.filter(e => e.id !== id));
        } catch(e) { console.error(e); }
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
        
        let subject = `Relance facture ${invoice.number}`;
        let body = `Bonjour,\n\nSauf erreur de notre part, la facture ${invoice.number} du ${new Date(invoice.date).toLocaleDateString()} est toujours en attente de paiement.\n\nMerci de faire le nécessaire.\n\nCordialement,\nMarion`;

        try {
            const res = await fetch('http://127.0.0.1:5003/api/invoices/remind', {
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
            console.warn("AI generation failed, using template.");
        } finally {
            setReminderData({
                to: project.profile.email || '',
                subject: subject,
                body: body
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

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]" onClick={() => { setShowPeriodMenu(false); setShowStatusMenu(false); }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 rounded-t-3xl">
                <div className="flex-1">
                    <h2 className="text-3xl font-serif text-slate-800 dark:text-white flex items-center gap-2">
                        {currentTheme === 'unicorn' && <span className="animate-bounce">🍕</span>} Santé Financière
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Vue d'ensemble de la trésorerie et du bénéfice.</p>
                </div>
                <div className="flex items-center gap-3">
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
                                <span className="font-mono font-bold text-slate-800 dark:text-white text-lg">
                                    {formatCurrency(totalRevenue)} {currency}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                                    <ArrowDownRight size={12} className="text-red-500" /> Sorties (Charges)
                                </span>
                                <span className="font-mono font-bold text-slate-800 dark:text-white text-lg">
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
                                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
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
                                            <td className="px-6 py-4 text-right font-mono font-bold text-red-600">
                                                -{formatCurrency(exp.amount)} {currency}
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                {exp.fileUrl && (
                                                    <button 
                                                        onClick={() => fetch('http://127.0.0.1:5003/api/files/open', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ path: `Dépenses/${exp.id}${exp.fileUrl.substring(exp.fileUrl.lastIndexOf('.'))}` }) }) } 
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
                        {/* Revenue by Client */}
                        <div>
                            <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <Users className="text-blue-500" size={20} />
                                Revenus par Client
                            </h3>
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
                                                    <span className="text-sm font-mono font-bold text-emerald-600">{formatCurrency(client.revenue)} {currency}</span>
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
                                <div className="text-3xl font-bold text-emerald-600 font-mono">
                                    {allInvoices.filter(i => new Date(i.date).getFullYear() === new Date().getFullYear() && i.status === 'Paid').reduce((s, i) => s + i.amount, 0).toLocaleString('fr-CH')} {currency}
                                </div>
                            </Card>
                            <Card className="p-4">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Année Précédente</h4>
                                <div className="text-3xl font-bold text-slate-500 font-mono">
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
                                // Fetch time logs would be from backend - for now simulate from project data
                                const projectsWithTime = projects.map(p => {
                                    // In a real app, this would come from time tracking data
                                    const estimatedHours = p.tasks.filter(t => t.completed).length * 2 + p.tasks.filter(t => !t.completed).length * 4;
                                    const revenue = p.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
                                    const hourlyRate = estimatedHours > 0 ? revenue / estimatedHours : 0;
                                    return {
                                        name: p.clientName,
                                        initials: p.avatarInitials,
                                        hours: estimatedHours,
                                        revenue,
                                        hourlyRate,
                                        status: p.status
                                    };
                                }).filter(p => p.hours > 0 || p.revenue > 0).sort((a, b) => b.hours - a.hours);

                                return (
                                    <>
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Client</th>
                                                    <th className="px-4 py-3 text-right">Heures (est.)</th>
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
                                                        <td className="px-4 py-3 text-right font-mono">{p.hours}h</td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                                                            {formatCurrency(p.revenue)} {currency}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono">
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
                                    const csv = ['Client;Heures;Revenus;Taux Horaire', ...data.map(d => `${d.client};${d.hours};${d.revenue};${d.hourlyRate}`)].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = `Rapport_Temps_${new Date().getFullYear()}.csv`;
                                    link.click();
                                }}
                                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-200 flex items-center gap-2"
                            >
                                <FileSpreadsheet size={16} /> Export CSV Rapport Temps
                            </button>
                        </div>
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
                        <div className="max-w-4xl mx-auto bg-white p-12 shadow-sm min-h-[800px]">
                            <div className="text-center mb-12">
                                <h1 className="text-2xl font-serif font-bold text-slate-900 uppercase tracking-widest mb-2">
                                    {accountingView === 'report' ? 'Compte de Résultat' : accountingView === 'sales' ? 'Journal des Ventes' : 'Journal des Achats'}
                                </h1>
                                <p className="text-slate-500">Exercice {accountingYear} - {currency}</p>
                            </div>

                            {accountingView === 'report' && (
                                <div className="space-y-12">
                                    {/* Products */}
                                    <div>
                                        <h3 className="text-sm font-bold text-emerald-600 uppercase border-b border-emerald-100 pb-2 mb-4">Produits (Recettes)</h3>
                                        <div className="flex justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-600">Chiffre d'Affaires HT</span>
                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">{formatCurrency(totalRevenue / 1.081)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-600">TVA Collectée (Est. 8.1%)</span>
                                            <span className="font-mono text-slate-400">{formatCurrency(totalRevenue - (totalRevenue / 1.081))}</span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-emerald-50 px-4 rounded-lg mt-2 mb-6">
                                            <span className="font-bold text-emerald-800">Total Produits TTC</span>
                                            <span className="font-mono font-extrabold text-emerald-800">{formatCurrency(totalRevenue)}</span>
                                        </div>

                                        {/* Detailed Revenue Table */}
                                        <div className="pl-4 border-l-2 border-emerald-100">
                                            <h4 className="text-xs font-bold text-emerald-500 uppercase mb-3">Détail des écritures (Ventes)</h4>
                                            <table className="w-full text-xs text-left">
                                                <thead className="text-slate-400 border-b border-slate-100">
                                                    <tr>
                                                        <th className="pb-2 font-normal">Date</th>
                                                        <th className="pb-2 font-normal">Client</th>
                                                        <th className="pb-2 font-normal">Facture</th>
                                                        <th className="pb-2 font-normal text-right">Montant</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 text-slate-600">
                                                    {filteredInvoices.filter(i => i.status === 'Paid' && new Date(i.date).getFullYear() === accountingYear).map(inv => (
                                                        <tr key={inv.id}>
                                                            <td className="py-2">{new Date(inv.date).toLocaleDateString('fr-CH')}</td>
                                                            <td className="py-2 font-medium">{inv.project.clientName}</td>
                                                            <td className="py-2">{inv.number}</td>
                                                            <td className="py-2 text-right font-mono">{formatCurrency(inv.amount)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Charges */}
                                    <div>
                                        <h3 className="text-sm font-bold text-red-600 uppercase border-b border-red-100 pb-2 mb-4">Charges (Dépenses)</h3>
                                        {Object.entries(expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).reduce((acc: any, exp) => { // Added year filter for expenses here
                                            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
                                            return acc;
                                        }, {})).map(([cat, amount]: any) => (
                                            <div key={cat} className="flex justify-between py-2 border-b border-slate-100">
                                                <span className="text-slate-600">{cat}</span>
                                                <span className="font-mono">{formatCurrency(amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between py-2 bg-red-50 px-4 rounded-lg mt-2 mb-6">
                                            <span className="font-bold text-red-800">Total Charges</span>
                                            <span className="font-mono font-extrabold text-red-800">{formatCurrency(totalExpenses)}</span>
                                        </div>

                                        {/* Detailed Expenses Table */}
                                        <div className="pl-4 border-l-2 border-red-100">
                                            <h4 className="text-xs font-bold text-red-500 uppercase mb-3">Détail des écritures (Achats)</h4>
                                            <table className="w-full text-xs text-left">
                                                <thead className="text-slate-400 border-b border-slate-100">
                                                    <tr>
                                                        <th className="pb-2 font-normal">Date</th>
                                                        <th className="pb-2 font-normal">Fournisseur</th>
                                                        <th className="pb-2 font-normal">Catégorie</th>
                                                        <th className="pb-2 font-normal text-right">Montant</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 text-slate-600">
                                                    {expenses.filter(e => new Date(e.date).getFullYear() === accountingYear).map(exp => (
                                                        <tr key={exp.id}>
                                                            <td className="py-2">{new Date(exp.date).toLocaleDateString('fr-CH')}</td>
                                                            <td className="py-2 font-medium">{exp.supplier}</td>
                                                            <td className="py-2">{exp.category}</td>
                                                            <td className="py-2 text-right font-mono">{formatCurrency(exp.amount)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Result */}
                                    <div className="mt-12 p-6 bg-slate-900 text-white rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xl font-serif font-bold">Résultat Net</span>
                                            <span className={`text-2xl font-mono font-extrabold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)} {currency}
                                            </span>
                                        </div>
                                    </div>
                                </div>
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
            <Modal isOpen={showEmailComposer} onClose={() => setShowEmailComposer(false)} title="" width="max-w-4xl" noContentPadding={true}>
                <div className="h-[600px]">
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

                    <h2 className="font-serif text-4xl font-bold text-red-600 mb-2 tracking-tight" style={{ fontFamily: 'Comic Sans MS, cursive' }}>Marion Pizza Design Inc.</h2>
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

                    <p className="text-xs text-slate-400 font-mono">Taux de conversion : 1 Pizza = {PIZZA_PRICE} CHF (Margherita Standard GE)</p>
                    
                    <button onClick={() => { setShowPizzaModal(false); confetti({ particleCount: 100, shapes: ['circle'], colors: ['#EF4444', '#F59E0B'] }); }} className="mt-6 px-8 py-3 bg-red-500 text-white rounded-full font-bold shadow-lg hover:scale-110 transition-transform border-b-4 border-red-700 active:border-b-0 active:translate-y-1">
                        Miam ! Fermer
                    </button>
                </div>
            </Modal>
        </div>
    );
};