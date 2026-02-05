import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoicePayment, InvoiceTemplate, Project } from '../types';
import { Plus, Trash2, Download, Save, RefreshCw, X, Clock, Wand2, Calendar, CreditCard, Link2, BookmarkPlus, Check, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../utils';

declare const confetti: any;

interface InvoiceBuilderProps {
    invoice: Invoice;
    project?: Project;
    allProjects?: Project[];
    onSave: (invoice: Invoice, projectId: string) => void;
    onClose: () => void;
    currency?: string;
    currentTheme?: string;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ invoice, project, allProjects = [], onSave, onClose, currency = 'CHF', currentTheme }) => {
    // Manually editable sender info and invoice title
    const [senderName, setSenderName] = useState<string>('Marion Kindynis');
    const [senderAddress, setSenderAddress] = useState<string>('4A chemin du Port • 1246 • Corsier');
    const [invoiceTitle, setInvoiceTitle] = useState<string>('Facture');
    const [paymentTerms, setPaymentTerms] = useState<string>('30 jours');

    const [currentInvoice, setCurrentInvoice] = useState<Invoice>({ ...invoice });
    const [selectedProjectId, setSelectedProjectId] = useState<string>(project?.id || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [qrImage, setQrImage] = useState<string | null>(null);

    // Time Tracking State
    const [pendingLogs, setPendingLogs] = useState<any[]>([]);
    const [hourlyRate, setHourlyRate] = useState(120);

    // Template State
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    const [templateSaved, setTemplateSaved] = useState(false);

    // Payments State (paiements partiels)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [newPaymentMethod, setNewPaymentMethod] = useState<InvoicePayment['method']>('Virement');
    const [newPaymentNote, setNewPaymentNote] = useState('');

    // Footer note
    const [footerNote, setFooterNote] = useState(invoice.footerNote || '');

    // Load templates from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('marion_invoice_templates');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setTemplates(parsed);
                // Auto-load default template if creating new invoice
                if (!invoice.id || invoice.id.startsWith('new-')) {
                    const defaultTpl = parsed.find((t: InvoiceTemplate) => t.name === 'Par défaut') || parsed[0];
                    if (defaultTpl) {
                        setSenderName(defaultTpl.senderName);
                        setSenderAddress(defaultTpl.senderAddress);
                        setPaymentTerms(defaultTpl.paymentTerms);
                        setSelectedBankId(defaultTpl.bankId);
                        if (defaultTpl.footerNote) setFooterNote(defaultTpl.footerNote);
                    }
                }
            } catch (e) { console.error('Failed to load templates', e); }
        }
    }, []);

    // Save template
    const handleSaveTemplate = (name: string = 'Par défaut') => {
        const newTemplate: InvoiceTemplate = {
            id: `tpl-${Date.now()}`,
            name,
            senderName,
            senderAddress,
            paymentTerms,
            bankId: selectedBankId,
            footerNote: footerNote || undefined,
            createdAt: new Date().toISOString()
        };
        const existingIndex = templates.findIndex(t => t.name === name);
        let updated: InvoiceTemplate[];
        if (existingIndex >= 0) {
            updated = [...templates];
            updated[existingIndex] = newTemplate;
        } else {
            updated = [...templates, newTemplate];
        }
        setTemplates(updated);
        localStorage.setItem('marion_invoice_templates', JSON.stringify(updated));
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 2000);
    };

    // Load template
    const handleLoadTemplate = (tpl: InvoiceTemplate) => {
        setSenderName(tpl.senderName);
        setSenderAddress(tpl.senderAddress);
        setPaymentTerms(tpl.paymentTerms);
        setSelectedBankId(tpl.bankId);
        if (tpl.footerNote) setFooterNote(tpl.footerNote);
        setShowTemplateMenu(false);
    };

    // Bank Accounts (Updated with correct IBAN from PDF)
    const BANK_ACCOUNTS = [
        {
            id: 'main',
            label: 'Compte Principal (Suisse)',
            bankName: 'Banque Suisse',
            iban: 'CH91 0020 6206 7850 8040 G',
            address: '4A chemin du Port, 1246 Corsier',
            currency: 'CHF'
        },
        {
            id: 'revolut',
            label: 'Revolut (EUR/USD)',
            bankName: 'Revolut Bank UAB',
            iban: 'LT35 3250 0771 7520 9958',
            bic: 'REVOLT21',
            address: 'Konstitucijos ave. 21B, 08130, Vilnius, Lithuania',
            currency: 'EUR'
        }
    ];
    const [selectedBankId, setSelectedBankId] = useState('main');
    const activeBank = BANK_ACCOUNTS.find(b => b.id === selectedBankId) || BANK_ACCOUNTS[0];
    const activeProject = allProjects.find(p => p.id === selectedProjectId) || project;

    // --- Effects ---
    useEffect(() => {
        if (!currentInvoice.currency) setCurrentInvoice(prev => ({ ...prev, currency: currency }));
        if (!currentInvoice.id || !currentInvoice.dueDate) {
             const defaultDue = new Date();
             defaultDue.setDate(defaultDue.getDate() + 30);
             setCurrentInvoice(prev => ({ ...prev, dueDate: defaultDue.toISOString().split('T')[0] }));
        }
    }, []);

    // Sync Client Data
    useEffect(() => {
        if (activeProject) {
            const fields = activeProject.profile.customFields || [];
            const addressField = activeProject.profile.address || fields.find(f => f.key.includes('Adresse'))?.value;
            const generatedAddress = addressField || `${activeProject.clientName}\n${activeProject.profile.email || ''}`;
            
            if (!currentInvoice.clientAddress) {
                setCurrentInvoice(prev => ({ ...prev, clientAddress: generatedAddress.trim() }));
            }
            
            fetch('http://127.0.0.1:5003/api/time/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeProject.id })
            })
            .then(res => res.json())
            .then(data => {
                if (data.logs) setPendingLogs(data.logs.filter((l: any) => l.status === 'pending'));
            }).catch(console.error);
        }
    }, [selectedProjectId]);

    // --- Calculations ---
    const calculateSubtotal = () => currentInvoice.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const calculateVAT = () => 0;
    const calculateTotal = () => calculateSubtotal() + calculateVAT();

    // Payments helpers
    const totalPaid = (currentInvoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = calculateTotal() - totalPaid;

    const handleAddPayment = () => {
        const amount = parseFloat(newPaymentAmount);
        if (isNaN(amount) || amount <= 0) return;
        const newPayment: InvoicePayment = {
            id: `pay-${Date.now()}`,
            amount,
            date: newPaymentDate,
            method: newPaymentMethod,
            note: newPaymentNote || undefined
        };
        const updatedPayments = [...(currentInvoice.payments || []), newPayment];
        const newTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
        const invoiceTotal = calculateTotal();
        let newStatus: Invoice['status'] = currentInvoice.status;
        if (newTotal >= invoiceTotal) newStatus = 'Paid';
        else if (newTotal > 0) newStatus = 'Partial';
        setCurrentInvoice(prev => ({ ...prev, payments: updatedPayments, status: newStatus }));
        setShowPaymentModal(false);
        setNewPaymentAmount('');
        setNewPaymentNote('');
    };

    const handleRemovePayment = (paymentId: string) => {
        const updatedPayments = (currentInvoice.payments || []).filter(p => p.id !== paymentId);
        const newTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
        const invoiceTotal = calculateTotal();
        let newStatus: Invoice['status'] = 'Pending';
        if (newTotal >= invoiceTotal) newStatus = 'Paid';
        else if (newTotal > 0) newStatus = 'Partial';
        setCurrentInvoice(prev => ({ ...prev, payments: updatedPayments, status: newStatus }));
    };

    // Generate Stripe-like payment link (simulated)
    const generatePaymentLink = () => {
        const baseUrl = 'https://pay.marion-web.app';
        const params = new URLSearchParams({
            inv: currentInvoice.number,
            amount: formatCurrency(calculateTotal(), 2),
            currency: currentInvoice.currency || 'CHF',
            client: activeProject?.clientName || 'Client'
        });
        const link = `${baseUrl}/invoice?${params.toString()}`;
        setCurrentInvoice(prev => ({ ...prev, paymentLink: link }));
        navigator.clipboard.writeText(link);
    };

    // --- QR Code Fetching (Corrected Backend Route) ---
    useEffect(() => {
        if (activeBank.id !== 'main' || (currentInvoice.currency !== 'CHF' && currentInvoice.currency !== 'EUR' && currentInvoice.currency !== '€')) {
            setQrImage(null);
            return;
        }

        const fetchQR = async () => {
            try {
                // Address Parsing
                const rawAddr = currentInvoice.clientAddress || '';
                const clientLines = rawAddr.split('\n');
                const zipCityLine = clientLines.find(l => /\d{4}/.test(l)) || '';
                const zipMatch = zipCityLine.match(/(\d{4})\s+(.+)/);

                const payload = {
                    amount: calculateTotal(),
                    currency: currentInvoice.currency === '€' ? 'EUR' : currentInvoice.currency || 'CHF',
                    reference: currentInvoice.number,
                    iban: activeBank.iban.replace(/\s/g, ''),
                    debtor: {
                        name: activeProject?.clientName || "Client Inconnu",
                        address: clientLines[0] || "Adresse Inconnue",
                        zip: zipMatch ? zipMatch[1] : "1000",
                        city: zipMatch ? zipMatch[2] : "Lausanne",
                        country: 'CH'
                    },
                    message: `Facture ${currentInvoice.number}`
                };

                const res = await fetch('http://127.0.0.1:5003/api/generate-qr', { // Using correct route
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success && data.image) {
                    setQrImage(data.image);
                }
            } catch (e) {
                console.error("Failed to fetch QR", e);
            }
        };

        const timeout = setTimeout(fetchQR, 800);
        return () => clearTimeout(timeout);

    }, [calculateTotal(), currentInvoice.currency, selectedBankId, currentInvoice.clientAddress, activeBank]);

    // --- Actions ---
    const updateField = (field: keyof Invoice, value: any) => setCurrentInvoice(prev => ({ ...prev, [field]: value }));
    
    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        const newItems = currentInvoice.items.map(item => item.id === id ? { ...item, [field]: value } : item);
        setCurrentInvoice(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => setCurrentInvoice(prev => ({ ...prev, items: [...prev.items, { id: `item-${Date.now()}`, desc: '', quantity: 1, price: 0 }] }));
    const removeItem = (id: string) => setCurrentInvoice(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));

    const handleImportTime = () => {
        if (pendingLogs.length === 0) return;
        const hours = parseFloat((pendingLogs.reduce((acc, log) => acc + log.duration, 0) / 3600).toFixed(2));
        setCurrentInvoice(prev => ({ ...prev, items: [...prev.items, {
            id: `time-${Date.now()}`,
            desc: `Prestations horaires (${new Date(pendingLogs[0].startTime).toLocaleDateString()})`,
            quantity: hours,
            price: hourlyRate
        }]}));
    };

    const handleSave = () => {
        if (!selectedProjectId) { alert("Veuillez sélectionner un client."); return; }

        if (!currentInvoice.number || !currentInvoice.date) {
            alert("Merci de renseigner au minimum le numéro et la date de la facture.");
            return;
        }

        const hasLines = currentInvoice.items.length > 0;
        const total = calculateTotal();
        if (!hasLines || total <= 0) {
            alert("Ajoute au moins une ligne avec un montant positif avant d’enregistrer.");
            return;
        }

        setIsSaving(true);
        setTimeout(async () => {
            // Mark logs as billed if needed
            if (currentInvoice.items.some(i => i.desc.includes('Prestations horaires')) && pendingLogs.length > 0) {
                await fetch('http://127.0.0.1:5003/api/time/mark_billed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId: selectedProjectId, logIds: pendingLogs.map(l => l.id) })
                });
            }
            onSave({ ...currentInvoice, amount: calculateTotal() }, selectedProjectId);
            setIsSaving(false);
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
            onClose();
        }, 800);
    };

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        setTimeout(async () => {
            const element = document.getElementById('invoice-paper');
            if (!element) return;
            const opt: any = {
                margin: 0,
                filename: `${currentInvoice.type === 'Invoice' ? 'Facture' : 'Devis'}_${currentInvoice.number}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            try {
                // @ts-ignore
                const html2pdf = (await import('html2pdf.js')).default;
                await html2pdf().set(opt).from(element).save();
            } catch (e) { alert("Erreur PDF"); }
            finally { setIsGenerating(false); }
        }, 500);
    };

    const SWISS_CROSS_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZmlsbD0iI0ZGMDAwMCIgZD0iTTAgMGgzMnYzMkgweiIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik0xMyA1aDZ2Nmg2djZ2NmgzbTAtNmgtNnY2aC02di02SDV2LTZoNlY1Ii8+PC9zdmc+";
    return (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col items-center">
            
            {/* Top Toolbar (Floating) */}
            <div className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex justify-between items-center shadow-sm z-50">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                    <h2 className="font-serif font-bold text-lg dark:text-white">Éditeur {currentInvoice.type === 'Invoice' ? 'Facture' : 'Devis'}</h2>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Template Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors"
                        >
                            <BookmarkPlus size={14} /> Template <ChevronDown size={12} />
                        </button>
                        {showTemplateMenu && (
                            <div className="absolute top-full mt-1 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 min-w-[200px] overflow-hidden">
                                <button 
                                    onClick={() => { handleSaveTemplate('Par défaut'); setShowTemplateMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-brand-orange hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <Save size={12} /> Sauvegarder comme défaut
                                </button>
                                {templates.length > 0 && (
                                    <>
                                        <div className="border-t border-slate-100 dark:border-slate-700" />
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">Charger</div>
                                        {templates.map(tpl => (
                                            <button 
                                                key={tpl.id}
                                                onClick={() => handleLoadTemplate(tpl)}
                                                className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
                                            >
                                                {tpl.name}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {templateSaved && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><Check size={12} /> Sauvé</span>}

                    <select 
                        value={selectedBankId} 
                        onChange={(e) => setSelectedBankId(e.target.value)} 
                        className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold"
                    >
                        {BANK_ACCOUNTS.map(acc => <option key={acc.id} value={acc.id}>{acc.label} - {acc.currency}</option>)}
                    </select>

                    <select 
                        value={currentInvoice.currency || 'CHF'}
                        onChange={e => updateField('currency', e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold"
                    >
                        <option value="CHF">CHF</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>
                    
                    {pendingLogs.length > 0 && (
                        <button onClick={handleImportTime} className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors">
                            <Clock size={14} /> Importer Temps
                        </button>
                    )}

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                    {/* Payment Link Button */}
                    <button 
                        onClick={generatePaymentLink}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                        title="Générer lien de paiement"
                    >
                        <CreditCard size={14} /> Lien paiement
                    </button>

                    <button onClick={handleDownloadPDF} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-white rounded-lg font-bold text-xs transition-colors">
                        {isGenerating ? <RefreshCw className="animate-spin" size={14}/> : <Download size={14} />} PDF
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-brand-orange text-white rounded-lg font-bold text-xs shadow-md hover:shadow-lg transition-all">
                        {isSaving ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14} />} Enregistrer
                    </button>
                </div>
            </div>

            {/* Document Scroll Area */}
            <div className="flex-1 w-full overflow-y-auto bg-slate-200 dark:bg-black/50 p-8 flex justify-center">
                
                {/* THE A4 PAPER (WYSIWYG) */}
                <div 
                    id="invoice-paper"
                    className="bg-white text-black shadow-2xl relative transition-all font-sans"
                    style={{ width: '210mm', minHeight: '290mm', padding: '0', display: 'flex', flexDirection: 'column' }}
                >
                    {/* TOP SECTION (Custom Layout based on Facture LN Avocats.pdf) */}
                    <div className="px-[15mm] py-[10mm] flex-1">
                        
                        {/* Header: Logo and Sender (Top Left) */}
                        <div className="flex items-start gap-5 mb-10">
                            <img src="/logo-marion.png" alt="Marion Logo" className="h-14 w-auto mt-1 flex-shrink-0" />
                            <div className="min-w-[50mm]">
                                <div className="text-lg font-bold text-slate-900 leading-tight">
                                    {isGenerating ? (
                                        senderName
                                    ) : (
                                        <input 
                                            value={senderName}
                                            onChange={e => setSenderName(e.target.value)}
                                            className="w-full bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-brand-orange"
                                        />
                                    )}
                                </div>
                                <div className="text-xs text-slate-600">
                                    {isGenerating ? (
                                        senderAddress
                                    ) : (
                                        <textarea
                                            value={senderAddress}
                                            onChange={e => setSenderAddress(e.target.value)}
                                            className="w-full bg-transparent outline-none resize-none border-b border-transparent hover:border-slate-300 focus:border-brand-orange h-8"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Client Address + Invoice Details row */}
                        <div className="mb-10 flex justify-between">
                            {/* Client Address (Left) */}
                            <div className="w-[80mm]">
                                <input 
                                    value={currentInvoice.clientDisplayName || activeProject?.clientName || ''}
                                    onChange={e => updateField('clientDisplayName', e.target.value)}
                                    className="w-full font-bold text-base bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-brand-orange p-0 mb-1"
                                />
                                <textarea 
                                    value={currentInvoice.clientAddress} 
                                    onChange={e => updateField('clientAddress', e.target.value)}
                                    placeholder="Adresse du client..."
                                    className="w-full text-xs text-slate-700 bg-transparent resize-none whitespace-pre-wrap outline-none border-transparent hover:border-slate-200 focus:border-brand-orange transition-colors h-20 leading-relaxed"
                                />
                            </div>

                            {/* Invoice Details (Right) - aligned to right margin */}
                            <div className="text-[10px] space-y-1.5">
                                <table className="ml-auto">
                                    <tbody>
                                        <tr>
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">Numéro de facture</td>
                                            <td className="text-slate-800 text-right py-0.5 w-[30mm]">
                                                {isGenerating ? (
                                                    currentInvoice.number
                                                ) : (
                                                    <input 
                                                        value={currentInvoice.number}
                                                        onChange={e => updateField('number', e.target.value)}
                                                        className="w-full bg-transparent outline-none text-slate-800 text-right"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">Date de facturation</td>
                                            <td className="text-slate-800 text-right py-0.5 w-[30mm]">
                                                {isGenerating ? (
                                                    currentInvoice.date
                                                ) : (
                                                    <input 
                                                        type="date" 
                                                        value={currentInvoice.date}
                                                        onChange={e => updateField('date', e.target.value)}
                                                        className="w-full bg-transparent outline-none cursor-pointer text-slate-800 text-right"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">Conditions de paiement</td>
                                            <td className="text-slate-800 text-right py-0.5 w-[30mm]">
                                                {isGenerating ? (
                                                    paymentTerms
                                                ) : (
                                                    <input 
                                                        value={paymentTerms}
                                                        onChange={e => setPaymentTerms(e.target.value)}
                                                        className="w-full bg-transparent outline-none text-slate-800 text-right"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">Échéance</td>
                                            <td className="text-slate-800 text-right py-0.5 w-[30mm]">
                                                {isGenerating ? (
                                                    currentInvoice.dueDate || ''
                                                ) : (
                                                    <input 
                                                        type="date" 
                                                        value={currentInvoice.dueDate || ''}
                                                        onChange={e => updateField('dueDate', e.target.value)}
                                                        className="w-full bg-transparent outline-none cursor-pointer text-slate-800 text-right"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Main Title */}
                        <input
                            value={invoiceTitle}
                            onChange={e => setInvoiceTitle(e.target.value)}
                            className="text-2xl font-bold text-slate-900 mb-5 mt-8 bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-brand-orange block"
                        />

                        {/* Items Table */}
                        <div className="mb-6">
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-800">
                                        <th className="text-left py-2 px-3 font-bold">Description</th>
                                        <th className="text-right py-2 px-3 font-bold w-24">Prix unitaire</th>
                                        <th className="text-right py-2 px-3 font-bold w-24">Montant</th>
                                        <th className="w-6 print:hidden"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentInvoice.items.map((item) => (
                                        <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 px-3 align-top">
                                                {isGenerating ? (
                                                    <div className="text-slate-800 whitespace-pre-wrap">{item.desc}</div>
                                                ) : (
                                                    <input 
                                                        value={item.desc} 
                                                        onChange={e => updateItem(item.id, 'desc', e.target.value)}
                                                        placeholder="Description..."
                                                        className="w-full bg-transparent outline-none text-slate-800"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right align-top">
                                                {isGenerating ? (
                                                    <div className="text-slate-800">{formatCurrency(item.price, 2)}</div>
                                                ) : (
                                                    <input 
                                                        type="number" 
                                                        value={item.price} 
                                                        onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value))}
                                                        className="w-full bg-transparent outline-none text-slate-800 text-right"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right align-top font-bold text-slate-900">
                                                {formatCurrency(item.price * item.quantity, 2)}
                                            </td>
                                            <td className="py-2.5 px-1 text-center print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!isGenerating && <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            {!isGenerating && (
                                <button 
                                    onClick={addItem} 
                                    className="w-full py-1.5 border-2 border-dashed border-slate-100 hover:border-brand-orange/50 text-slate-300 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2 mt-1 print:hidden"
                                >
                                    <Plus size={12} /> Ajouter une ligne
                                </button>
                            )}
                        </div>

                        {/* Total */}
                        <div className="flex justify-end mb-4 border-t-2 border-slate-900 pt-2">
                            <div className="w-48 flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-900">Total {currentInvoice.currency}</span>
                                <span className="text-base font-bold text-slate-900">{formatCurrency(calculateTotal(), 2)}</span>
                            </div>
                        </div>

                        {/* Paiements partiels (Acomptes) */}
                        {(currentInvoice.payments && currentInvoice.payments.length > 0) && (
                            <div className="flex justify-end mb-4">
                                <div className="w-48 space-y-1 text-[11px]">
                                    {currentInvoice.payments.map(payment => (
                                        <div key={payment.id} className="flex justify-between items-center text-slate-600 group">
                                            <span className="flex items-center gap-1.5">
                                                <Check size={10} className="text-green-500" />
                                                Acompte - {payment.date}
                                                {!isGenerating && (
                                                    <button 
                                                        onClick={() => handleRemovePayment(payment.id)}
                                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity print:hidden"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                )}
                                            </span>
                                            <span className="text-green-600 font-medium">-{formatCurrency(payment.amount, 2)} {currentInvoice.currency}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                                        <span className="font-bold text-slate-900">Net à payer</span>
                                        <span className={`text-sm font-bold ${remainingAmount <= 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                            {remainingAmount <= 0 ? 'PAYÉ' : `${formatCurrency(remainingAmount, 2)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lien de paiement en ligne */}
                        {currentInvoice.paymentLink && (
                            <div className="flex justify-end mb-4">
                                <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5 flex items-center gap-2 text-[10px]">
                                    <CreditCard size={12} className="text-emerald-600" />
                                    <span className="text-slate-600">Payer en ligne :</span>
                                    <a href={currentInvoice.paymentLink} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold hover:underline truncate max-w-[150px]">
                                        {currentInvoice.paymentLink.replace('https://', '').split('?')[0]}
                                    </a>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(currentInvoice.paymentLink || '')}
                                        className="text-slate-400 hover:text-emerald-600 print:hidden"
                                    >
                                        <Link2 size={10} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Note de bas de facture */}
                        {!isGenerating ? (
                            <div className="mb-6">
                                <textarea
                                    value={footerNote}
                                    onChange={e => {
                                        setFooterNote(e.target.value);
                                        setCurrentInvoice(prev => ({ ...prev, footerNote: e.target.value }));
                                    }}
                                    placeholder="Note ou conditions particulières (CGV, remerciements, etc.)..."
                                    className="w-full text-[10px] text-slate-500 bg-transparent resize-none outline-none border border-dashed border-transparent hover:border-slate-200 focus:border-brand-orange p-2 rounded transition-colors print:hidden"
                                    rows={2}
                                />
                            </div>
                        ) : footerNote ? (
                            <div className="mb-6 text-[10px] text-slate-500 whitespace-pre-wrap">{footerNote}</div>
                        ) : null}
                    </div>

                    {/* Footer / Divider */}
                    <div className="px-[15mm] mb-4">
                        <div className="border-t border-dotted border-slate-400 w-full mb-2"></div>
                        <div className="flex justify-between text-[9px] text-slate-500">
                            <span>{senderAddress.split('•')[0]?.trim()} • {senderAddress.split('•')[1]?.trim()}</span>
                            <span>N° IDE CHE-265.310.079</span>
                        </div>
                    </div>

                    {/* BOTTOM SECTION (Swiss QR or SEPA) */}
                    {(activeBank.id === 'main' && ['CHF', 'EUR', '€'].includes(currentInvoice.currency || 'CHF')) ? (
                        <div className="w-full border-t border-dashed border-slate-300 relative break-inside-avoid shrink-0 bg-white" style={{ height: '105mm', padding: '0' }}>
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-slate-400 print:hidden">
                                <span className="text-xs font-mono">BVR / QR (Zone Protegée)</span>
                            </div>

                            <div className="flex h-full font-sans text-black text-xs leading-tight">
                                {/* Receipt */}
                                <div className="w-[62mm] h-full p-[5mm] border-r border-dashed border-slate-300 flex flex-col shrink-0">
                                    <h3 className="font-bold text-sm mb-3">Reçu</h3>
                                    <div className="mb-3">
                                        <p className="font-bold mb-1">Compte / Payable à</p>
                                        <p>{activeBank.iban}</p>
                                        <p>{senderName}</p>
                                        <div className="text-xs">{senderAddress.split('•')[0].trim()}</div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold mb-1">Payable par</p>
                                        <p>{currentInvoice.clientDisplayName || activeProject?.clientName}</p>
                                        <div className="whitespace-pre-line">{currentInvoice.clientAddress}</div>
                                    </div>
                                    <div className="mt-auto">
                                        <p className="font-bold mb-1">Montant</p>
                                        <div className="flex gap-4 font-bold text-sm">
                                            <span>{currentInvoice.currency}</span>
                                            <span>{formatCurrency(calculateTotal(), 2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Part */}
                                <div className="flex-1 h-full p-[5mm] flex flex-col">
                                    <h3 className="font-bold text-base mb-3">Section de paiement</h3>
                                    <div className="flex gap-6 h-full">
                                        <div className="w-[46mm] shrink-0">
                                            <div className="w-[46mm] h-[46mm] border border-black flex items-center justify-center bg-white mb-4 relative">
                                                {qrImage ? (
                                                    <img src={qrImage} alt="Swiss QR" className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400">
                                                        <span className="text-xs">QR...</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-4">
                                                <p className="font-bold mb-1">Montant</p>
                                                <div className="flex gap-2 font-bold text-base">
                                                    <span>{currentInvoice.currency}</span>
                                                    <span>{formatCurrency(calculateTotal(), 2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <div className="mb-3">
                                                <p className="font-bold mb-1">Compte / Payable à</p>
                                                <p>{activeBank.iban}</p>
                                                <p>{senderName}</p>
                                                <div className="text-xs opacity-80">{senderAddress.split('•')[0].trim()}</div>
                                            </div>
                                            <div className="mb-3">
                                                <p className="font-bold mb-1">Référence</p>
                                                <p>{currentInvoice.number}</p>
                                            </div>
                                            <div className="flex-1">
                                                 <p className="font-bold mb-1">Payable par</p>
                                                 <p>{currentInvoice.clientDisplayName || activeProject?.clientName}</p>
                                                 <div className="whitespace-pre-line">{currentInvoice.clientAddress}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full border-t-2 border-slate-100 p-8 text-center text-slate-500 bg-slate-50">
                            <p className="font-bold text-sm mb-2 uppercase tracking-widest">Informations de Paiement</p>
                            <p>Merci de régler le montant de <strong>{formatCurrency(calculateTotal(), 2)} {currentInvoice.currency}</strong> par virement bancaire.</p>
                            <div className="mt-4 p-4 bg-white border border-slate-200 inline-block rounded-xl shadow-sm text-left relative">
                                <p><span className="font-bold text-slate-400 w-20 inline-block">Banque :</span> {activeBank.bankName}</p>
                                <p><span className="font-bold text-slate-400 w-20 inline-block">IBAN :</span> {activeBank.iban}</p>
                                {activeBank.bic && <p><span className="font-bold text-slate-400 w-20 inline-block">BIC/SWIFT :</span> {activeBank.bic}</p>}
                                <p><span className="font-bold text-slate-400 w-20 inline-block">Adresse :</span> {activeBank.address}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={() => setShowPaymentModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Enregistrer un acompte</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant reçu</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newPaymentAmount}
                                        onChange={e => setNewPaymentAmount(e.target.value)}
                                        placeholder={`Restant: ${formatCurrency(remainingAmount, 2)}`}
                                        className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-lg px-4 py-3 outline-none text-lg font-bold dark:text-white"
                                        autoFocus
                                    />
                                    <span className="text-lg font-bold text-slate-400">{currentInvoice.currency}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={newPaymentDate}
                                        onChange={e => setNewPaymentDate(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Méthode</label>
                                    <select
                                        value={newPaymentMethod}
                                        onChange={e => setNewPaymentMethod(e.target.value as InvoicePayment['method'])}
                                        className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
                                    >
                                        <option value="Virement">Virement</option>
                                        <option value="Carte">Carte</option>
                                        <option value="Stripe">Stripe</option>
                                        <option value="Espèces">Espèces</option>
                                        <option value="Autre">Autre</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Note (optionnel)</label>
                                <input
                                    type="text"
                                    value={newPaymentNote}
                                    onChange={e => setNewPaymentNote(e.target.value)}
                                    placeholder="Ex: Acompte 30%"
                                    className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddPayment}
                                    className="flex-1 px-4 py-2 bg-brand-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
                                >
                                    Enregistrer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};