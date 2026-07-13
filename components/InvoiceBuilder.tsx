import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoicePayment, InvoiceTemplate, Project, SwissVatRate } from '../types';
import { Plus, Trash2, Download, Save, RefreshCw, X, Clock, Wand2, Calendar, CreditCard, Link2, BookmarkPlus, Check, ChevronDown, Globe, Repeat, History } from 'lucide-react';
import { InvoiceHistoryDrawer } from './InvoiceHistoryDrawer';
import { formatCurrency } from '../utils';
import { apiFetch } from '../services/api';
import { Language, LANGUAGE_OPTIONS, invoiceT } from '../translations/i18n';
import { printElementAsPdf } from '../utils/pdfExport';
import { useUIStore } from '../stores';
import { computeInvoiceTotals } from '../utils/invoiceEngine';
import {
    isValidIban,
    isQrIban,
    chooseReferenceMode,
    generateReferenceForMode,
    formatQrReference,
    type QrReferenceMode,
} from '../utils/swissQrBill';

declare const confetti: any;

// ---------------------------------------------------------------------------
// Address parsing helpers — used to fill the Swiss QR debtor/creditor blocks
// from free-form text (clients can enter addresses any way they want).
// ---------------------------------------------------------------------------

interface ParsedAddress {
    street: string;
    zip: string;
    city: string;
    country: string;
}

/** Detect a postal code anywhere in a string. Supports CH (4 digits),
 *  FR/DE/ES/IT (5 digits), UK (alphanumeric).
 */
function extractZipAndCity(line: string): { zip: string; city: string } | null {
    if (!line) return null;
    // Try "1234 Ville" / "75001 Paris" / "10115 Berlin"
    let m = line.match(/(\d{4,5})\s+([A-Za-zÀ-ÿ' \-.]+)/);
    if (m) return { zip: m[1].trim(), city: m[2].trim() };
    // Try "Ville 1234" (rare)
    m = line.match(/([A-Za-zÀ-ÿ' \-.]+)\s+(\d{4,5})/);
    if (m) return { zip: m[2].trim(), city: m[1].trim() };
    return null;
}

/** Parse a free-form client address into structured fields.
 *  Accepts multi-line ("Rue X 1\n1234 Ville\nFrance") OR single-line
 *  with comma separators ("Rue X 1, 1234 Ville, France").
 */
export function parseAddress(raw: string): ParsedAddress {
    const result: ParsedAddress = { street: '', zip: '', city: '', country: 'CH' };
    if (!raw || !raw.trim()) return result;
    // Normalize: split on newlines OR commas (but only commas if no newlines).
    const hasNewline = raw.includes('\n');
    const parts = (hasNewline ? raw.split('\n') : raw.split(','))
        .map(p => p.trim())
        .filter(Boolean);

    // Find the line with the postal code first.
    let zipCityIdx = -1;
    for (let i = 0; i < parts.length; i++) {
        const found = extractZipAndCity(parts[i]);
        if (found) {
            result.zip = found.zip;
            result.city = found.city;
            zipCityIdx = i;
            break;
        }
    }
    // The street is everything before the zip line (joined by space).
    if (zipCityIdx > 0) {
        result.street = parts.slice(0, zipCityIdx).join(', ').trim();
    } else if (zipCityIdx === -1 && parts.length > 0) {
        // No zip detected — first part is the street, last part may be city.
        result.street = parts[0];
        if (parts.length >= 2) result.city = parts[parts.length - 1];
    }
    // The country is whatever comes after the zip line, if any.
    if (zipCityIdx >= 0 && zipCityIdx < parts.length - 1) {
        const tail = parts[parts.length - 1].trim();
        // Common country names → ISO code (Swiss QR-bill needs ISO)
        const countryMap: Record<string, string> = {
            'suisse': 'CH', 'switzerland': 'CH', 'schweiz': 'CH', 'svizzera': 'CH',
            'france': 'FR', 'francia': 'FR',
            'allemagne': 'DE', 'germany': 'DE', 'deutschland': 'DE',
            'italie': 'IT', 'italy': 'IT', 'italia': 'IT',
            'espagne': 'ES', 'spain': 'ES', 'españa': 'ES',
            'belgique': 'BE', 'belgium': 'BE', 'belgië': 'BE',
            'luxembourg': 'LU',
            'autriche': 'AT', 'austria': 'AT',
            'royaume-uni': 'GB', 'uk': 'GB', 'united kingdom': 'GB',
            'usa': 'US', 'états-unis': 'US', 'united states': 'US',
        };
        const k = tail.toLowerCase();
        result.country = countryMap[k] || (tail.length === 2 ? tail.toUpperCase() : 'CH');
    }
    return result;
}

/** Parse Marion's sender address. Uses the same engine but starts with the
 *  legacy "•"-separated format ("4A chemin du Port • 1246 • Corsier").
 */
export function parseSenderAddress(raw: string): ParsedAddress {
    if (!raw) return { street: '4A chemin du Port', zip: '1246', city: 'Corsier', country: 'CH' };
    if (raw.includes('•')) {
        const parts = raw.split('•').map(p => p.trim()).filter(Boolean);
        return {
            street: parts[0] || '',
            zip: parts[1] || '',
            city: parts[2] || '',
            country: parts[3] || 'CH',
        };
    }
    return parseAddress(raw);
}

interface InvoiceBuilderProps {
    invoice: Invoice;
    project?: Project;
    allProjects?: Project[];
    /** Return false to keep the editor open (validation / persistence refused synchronously). */
    onSave: (invoice: Invoice, projectId: string) => boolean | void;
    onClose: () => void;
    currency?: string;
    currentTheme?: string;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ invoice, project, allProjects = [], onSave, onClose, currency = 'CHF', currentTheme }) => {
    const tjhFromSettings = useUIStore((s) => s.tjh);
    const agencyIde = useUIStore((s) => s.agencyIde);
    const agencyVatNumber = useUIStore((s) => s.agencyVatNumber);
    const defaultVatRate = useUIStore((s) => s.defaultVatRate);
    // Manually editable sender info and invoice title
    const [senderName, setSenderName] = useState<string>('Marion Kindynis');
    const [senderAddress, setSenderAddress] = useState<string>('4A chemin du Port\n1246 Corsier\nSuisse');
    const [invoiceTitle, setInvoiceTitle] = useState<string>('');
    const [paymentTerms, setPaymentTerms] = useState<string>('');

    const [currentInvoice, setCurrentInvoice] = useState<Invoice>({ ...invoice });
    const [selectedProjectId, setSelectedProjectId] = useState<string>(project?.id || '');

    useEffect(() => {
        setSelectedProjectId(project?.id || '');
    }, [project?.id]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [qrImage, setQrImage] = useState<string | null>(null);
    /** Set when /api/v1/generate-qr fails (e.g. missing Python package `segno`). */
    const [qrError, setQrError] = useState<string | null>(null);

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

    // History drawer
    const [showHistory, setShowHistory] = useState(false);

    // Language for the invoice document
    const [lang, setLang] = useState<Language>('fr');
    const t = invoiceT[lang];

    // Sync defaults when language changes (only if still at default value or empty)
    useEffect(() => {
        if (!invoiceTitle || invoiceTitle === invoiceT.fr.invoice || invoiceTitle === invoiceT.en.invoice || invoiceTitle === invoiceT.es.invoice) {
            setInvoiceTitle(t.invoice);
        }
        if (!paymentTerms || paymentTerms === invoiceT.fr.defaultPaymentTerms || paymentTerms === invoiceT.en.defaultPaymentTerms || paymentTerms === invoiceT.es.defaultPaymentTerms) {
            setPaymentTerms(t.defaultPaymentTerms);
        }
    }, [lang]);

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
            beneficiary: 'Marion Kindynis',
            address: '4A chemin du Port, 1246 Corsier',
            currency: 'CHF'
        },
        {
            id: 'revolut',
            label: 'Revolut (EUR)',
            bankName: 'Revolut Bank UAB',
            iban: 'LT35 3250 0771 7520 9958',
            bic: 'REVOLT21',
            correspondentBic: 'CHASDEFX',
            beneficiary: 'Marion Kindynis',
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

    useEffect(() => {
        const n = parseFloat(String(tjhFromSettings).replace(',', '.'));
        if (!Number.isNaN(n) && n > 0) setHourlyRate(n);
    }, [tjhFromSettings]);

    // Sync Client Data
    useEffect(() => {
        if (activeProject) {
            const fields = activeProject.profile.customFields || [];
            const addressField = activeProject.profile.address || fields.find(f => f.key.includes('Adresse'))?.value;
            const generatedAddress = addressField || `${activeProject.clientName}\n${activeProject.profile.email || ''}`;
            
            if (!currentInvoice.clientAddress) {
                setCurrentInvoice(prev => ({ ...prev, clientAddress: generatedAddress.trim() }));
            }
            
            fetch('/api/v1/time/get', {
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
    // Mode TVA "actif" si au moins une ligne porte explicitement un vatRate.
    // Sinon mode legacy : pas de TVA appliquée, pas de ventilation.
    const vatActive = currentInvoice.items.some((it) => typeof it.vatRate === 'number');
    const totals = React.useMemo(() => computeInvoiceTotals(currentInvoice.items), [currentInvoice.items]);
    const calculateSubtotal = () => totals.subtotalHt;
    const calculateVAT = () => totals.totalVat;
    const calculateTotal = () => totals.totalTtc;

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
        const baseUrl = 'https://pay.eonoratech.app';
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

    const removePaymentLink = () => {
        setCurrentInvoice(prev => ({ ...prev, paymentLink: undefined }));
    };

    // --- QR Code Fetching ---
    useEffect(() => {
        if (activeBank.id !== 'main' || (currentInvoice.currency !== 'CHF' && currentInvoice.currency !== 'EUR' && currentInvoice.currency !== '€')) {
            setQrImage(null);
            setQrError(null);
            return;
        }

        const fetchQR = async () => {
            setQrError(null);
            try {
                // ---- Debtor (client) parsing -----------------------------------
                // Accept multi-line addresses ("Rue X 1\n1234 Ville\nPays"),
                // single-line ("Rue X 1, 1234 Ville, Pays") and missing pieces.
                const debtor = parseAddress(currentInvoice.clientAddress || '');

                // ---- Creditor (Marion) parsing ---------------------------------
                // senderAddress is something like "4A chemin du Port • 1246 • Corsier"
                // or any free text. We split on bullets first, fallback to comma/newline.
                const creditor = parseSenderAddress(senderAddress);

                // ---- Référence QR-bill v2.0 ----------------------------------
                // QR-IBAN ⇒ QRR (27 digits, mod10 récursif).
                // IBAN normal ⇒ SCOR (Creditor Reference RF, ISO 11649) si possible,
                //               sinon NON (message libre seul).
                const ibanRaw = activeBank.iban.replace(/\s/g, '');
                const refMode: QrReferenceMode = currentInvoice.qr?.referenceType
                    ?? chooseReferenceMode(ibanRaw, isQrIban(ibanRaw) ? 'QRR' : 'SCOR');
                let refValue: string | undefined = currentInvoice.qr?.reference;
                if (!refValue || refValue.trim() === '') {
                    try {
                        refValue = generateReferenceForMode(refMode, currentInvoice.number);
                    } catch {
                        refValue = undefined;
                    }
                }

                const payload = {
                    amount: calculateTotal(),
                    currency: currentInvoice.currency === '€' ? 'EUR' : currentInvoice.currency || 'CHF',
                    iban: ibanRaw,
                    reference_type: refMode,
                    reference: refValue || '',
                    message: `${t.invoice} ${currentInvoice.number}`,
                    creditor: {
                        name: senderName || activeBank.beneficiary || 'Marion Kindynis',
                        address: creditor.street,
                        zip: creditor.zip,
                        city: creditor.city,
                        country: creditor.country || 'CH',
                    },
                    debtor: {
                        name: currentInvoice.clientDisplayName || activeProject?.clientName || t.unknownClient,
                        address: debtor.street,
                        zip: debtor.zip,
                        city: debtor.city,
                        country: debtor.country || 'CH',
                    },
                };

                const res = await apiFetch('/api/v1/generate-qr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                let data: { success?: boolean; image?: string; error?: string } = {};
                try {
                    data = await res.json();
                } catch {
                    setQrImage(null);
                    setQrError(t.qrLoadError);
                    return;
                }
                if (!res.ok || !data.success || !data.image) {
                    setQrImage(null);
                    const apiErr = (data.error || '').trim();
                    const segnoMissing =
                        apiErr.toLowerCase().includes('segno');
                    setQrError(
                        segnoMissing
                            ? `${t.qrLoadError} ${t.qrSegnoMissingHint}`
                            : `${t.qrLoadError}${apiErr ? ` (${apiErr})` : ''}`
                    );
                    return;
                }
                setQrImage(data.image);
                setQrError(null);
            } catch (e) {
                console.error('Failed to fetch QR', e);
                setQrImage(null);
                setQrError(t.qrLoadError);
            }
        };

        const timeout = setTimeout(fetchQR, 800);
        return () => clearTimeout(timeout);

    }, [calculateTotal(), currentInvoice.currency, selectedBankId, currentInvoice.clientAddress, currentInvoice.clientDisplayName, activeBank, senderAddress, senderName, lang]);

    // --- Actions ---
    const updateField = (field: keyof Invoice, value: any) => setCurrentInvoice(prev => ({ ...prev, [field]: value }));

    const subtotalFromItems = (items: typeof currentInvoice.items) =>
        items.reduce((acc, item) => {
            const q = Number(item.quantity);
            const p = Number(item.price);
            return acc + (Number.isFinite(q) ? q : 0) * (Number.isFinite(p) ? p : 0);
        }, 0);

    const parseMoneyInput = (raw: string) => {
        if (raw === '' || raw === '-') return 0;
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : 0;
    };
    
    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setCurrentInvoice(prev => {
            const newItems = prev.items.map(item => (item.id === id ? { ...item, [field]: value } : item));
            return { ...prev, items: newItems, amount: subtotalFromItems(newItems) };
        });
    };

    /** Une seule colonne « Montant » : on stocke quantité = 1, prix unitaire = montant de ligne. */
    const updateItemMontant = (id: string, montant: number) => {
        setCurrentInvoice(prev => {
            const newItems = prev.items.map(item =>
                item.id === id ? { ...item, quantity: 1, price: montant } : item
            );
            return { ...prev, items: newItems, amount: subtotalFromItems(newItems) };
        });
    };

    const addItem = () => {
        setCurrentInvoice(prev => {
            const base: InvoiceItem = { id: `item-${Date.now()}`, desc: '', quantity: 1, price: 0 };
            // Si une autre ligne a déjà un taux TVA, on hérite du même taux par défaut.
            const existingRate = prev.items.find(it => typeof it.vatRate === 'number')?.vatRate;
            if (typeof existingRate === 'number') base.vatRate = existingRate;
            else if (defaultVatRate > 0) base.vatRate = defaultVatRate;
            const items = [...prev.items, base];
            return { ...prev, items, amount: subtotalFromItems(items) };
        });
    };

    /** Bascule globale Activer/Désactiver TVA — applique le taux par défaut à toutes les lignes. */
    const toggleVatMode = () => {
        setCurrentInvoice(prev => {
            const hasAny = prev.items.some(it => typeof it.vatRate === 'number');
            const items = prev.items.map(it => {
                if (hasAny) {
                    // Désactivation : on retire vatRate sans toucher au prix.
                    const { vatRate, vatExempt, ...rest } = it as any;
                    return rest as InvoiceItem;
                }
                return { ...it, vatRate: defaultVatRate || 8.1 } as InvoiceItem;
            });
            return { ...prev, items };
        });
    };

    /** Met à jour le taux TVA d'une ligne (ou la marque exonérée). */
    const updateItemVat = (id: string, rate: SwissVatRate, exempt = false) => {
        setCurrentInvoice(prev => {
            const items = prev.items.map(it => it.id === id ? { ...it, vatRate: rate, vatExempt: exempt } : it);
            return { ...prev, items };
        });
    };
    const removeItem = (id: string) => {
        setCurrentInvoice(prev => {
            const items = prev.items.filter(i => i.id !== id);
            return { ...prev, items, amount: subtotalFromItems(items) };
        });
    };

    const handleImportTime = () => {
        if (pendingLogs.length === 0) return;
        const hours = parseFloat((pendingLogs.reduce((acc, log) => acc + log.duration, 0) / 3600).toFixed(2));
        setCurrentInvoice(prev => {
            const lineTotal = hours * hourlyRate;
            const items = [...prev.items, {
                id: `time-${Date.now()}`,
                desc: `${t.hourlyServices} (${new Date(pendingLogs[0].startTime).toLocaleDateString()})`,
                quantity: 1,
                price: lineTotal,
            }];
            return { ...prev, items, amount: subtotalFromItems(items) };
        });
    };

    /**
     * Récupère le taux de change vers CHF pour la devise donnée.
     * Utilisé à la save d'une facture multi-devise pour figer le `fxRateChf`,
     * conformément à la pratique CH (le montant CHF historique reste stable
     * même si le taux fluctue ensuite).
     */
    const fetchFxRateChf = async (fromCurrency: string): Promise<number | undefined> => {
        const iso = fromCurrency === '€' ? 'EUR' : fromCurrency === '$' ? 'USD' : fromCurrency === '£' ? 'GBP' : fromCurrency;
        if (!iso || iso === 'CHF') return 1;
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/CHF');
            if (!res.ok) return undefined;
            const data = await res.json();
            const rate = data?.rates?.[iso];
            if (!rate || !Number.isFinite(Number(rate)) || Number(rate) <= 0) return undefined;
            // L'API retourne combien d'unités de la devise pour 1 CHF.
            // fxRateChf = combien de CHF pour 1 unité = 1 / rate.
            return 1 / Number(rate);
        } catch {
            return undefined;
        }
    };

    const handleSave = () => {

        if (!currentInvoice.number || !currentInvoice.date) {
            alert(t.fillRequired);
            return;
        }

        const hasLines = currentInvoice.items.length > 0;
        const total = calculateTotal();
        if (!hasLines || total <= 0) {
            alert(t.addAtLeastOneLine);
            return;
        }

        setIsSaving(true);
        setTimeout(async () => {
            // Mark logs as billed if needed
            if (currentInvoice.items.some(i => i.desc.includes('Prestations horaires')) && pendingLogs.length > 0) {
                await fetch('/api/v1/time/mark_billed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId: selectedProjectId, logIds: pendingLogs.map(l => l.id) })
                });
            }
            // Multi-devise : si l'invoice n'est pas en CHF et n'a pas encore de
            // taux figé, on le récupère maintenant pour archive historique.
            let fxRateChf = currentInvoice.fxRateChf;
            if (!fxRateChf && currentInvoice.currency && currentInvoice.currency !== 'CHF') {
                fxRateChf = await fetchFxRateChf(currentInvoice.currency);
            }
            const payload: Invoice = {
                ...currentInvoice,
                amount: calculateTotal(),
                subtotalHt: totals.subtotalHt,
                totalVat: totals.totalVat,
                totalTtc: totals.totalTtc,
                vatBreakdown: totals.vatBreakdown.length > 0 ? totals.vatBreakdown : undefined,
                fxRateChf,
                history: [
                    ...(currentInvoice.history || []),
                    { at: new Date().toISOString(), actor: 'Marion', action: 'edit', note: `Édition (total ${totals.totalTtc.toFixed(2)} ${currentInvoice.currency || 'CHF'})` },
                ],
            };
            const ok = onSave(payload, selectedProjectId);
            setIsSaving(false);
            if (ok === false) return;
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
            onClose();
        }, 800);
    };

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        setTimeout(async () => {
            const element = document.getElementById('invoice-paper');
            if (!element) return;
            const filename = `${currentInvoice.type === 'Invoice' ? t.invoice : t.estimate}_${currentInvoice.number}.pdf`;
            try {
                await printElementAsPdf(element, filename, { pageMarginMm: 0 });
            } catch (e) { alert(t.pdfError); }
            finally { setIsGenerating(false); }
        }, 500);
    };

    const SWISS_CROSS_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZmlsbD0iI0ZGMDAwMCIgZD0iTTAgMGgzMnYzMkgweiIvPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik0xMyA1aDZ2Nmg2djZ2NmgzbTAtNmgtNnY2aC02di02SDV2LTZoNlY1Ii8+PC9zdmc+";
    return (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col items-center">
            
            {/* Top Toolbar */}
            <div className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center gap-3 shadow-sm z-50 min-w-0">
                <div className="flex items-center gap-3 shrink-0">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                    <h2 className="font-serif font-bold text-lg dark:text-white whitespace-nowrap">{currentInvoice.type === 'Invoice' ? t.editorInvoice : t.editorEstimate}</h2>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1 justify-end pb-0.5 [scrollbar-width:thin]">
                    {/* Template Dropdown */}
                    <div className="relative shrink-0">
                        <button 
                            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                        >
                            <BookmarkPlus size={14} /> {t.template} <ChevronDown size={12} />
                        </button>
                        {showTemplateMenu && (
                            <div className="absolute top-full mt-1 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 min-w-[200px] overflow-hidden">
                                <button 
                                    onClick={() => { handleSaveTemplate('Par défaut'); setShowTemplateMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-brand-orange hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <Save size={12} /> {t.saveAsDefault}
                                </button>
                                {templates.length > 0 && (
                                    <>
                                        <div className="border-t border-slate-100 dark:border-slate-700" />
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">{t.load}</div>
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
                    {templateSaved && <span className="text-xs text-green-600 font-bold flex items-center gap-1 shrink-0 whitespace-nowrap"><Check size={12} /> {t.saved}</span>}

                    <select 
                        value={selectedBankId} 
                        onChange={(e) => setSelectedBankId(e.target.value)} 
                        className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold shrink-0 max-w-[200px]"
                    >
                        {BANK_ACCOUNTS.map(acc => <option key={acc.id} value={acc.id}>{acc.label} - {acc.currency}</option>)}
                    </select>

                    <select 
                        value={currentInvoice.currency || 'CHF'}
                        onChange={e => updateField('currency', e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold shrink-0"
                    >
                        <option value="CHF">CHF</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>

                    {allProjects.length > 0 && (
                        <select
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold max-w-[220px] shrink-0"
                            title={t.chooseProjectFolder}
                        >
                            <option value="">{t.chooseProjectFolder}</option>
                            {allProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.clientName}</option>
                            ))}
                        </select>
                    )}

                    {/* Language selector */}
                    <select
                        value={lang}
                        onChange={e => setLang(e.target.value as Language)}
                        className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold shrink-0"
                    >
                        {LANGUAGE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.flag} {opt.label}</option>
                        ))}
                    </select>
                    
                    {pendingLogs.length > 0 && (
                        <button onClick={handleImportTime} className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors shrink-0 whitespace-nowrap">
                            <Clock size={14} /> {t.importTime}
                        </button>
                    )}

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>

                    {/* Payment Link Button */}
                    {currentInvoice.paymentLink ? (
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => navigator.clipboard.writeText(currentInvoice.paymentLink || '')}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors whitespace-nowrap"
                                title="Copier le lien de paiement"
                            >
                                <Link2 size={14} /> Lien actif
                            </button>
                            <button
                                onClick={removePaymentLink}
                                className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                title="Retirer le lien de paiement"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={generatePaymentLink}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors shrink-0 whitespace-nowrap"
                            title={t.generatePaymentLink}
                        >
                            <CreditCard size={14} /> {t.paymentLink}
                        </button>
                    )}

                    {/* Récurrence */}
                    <div className="relative shrink-0">
                        <select
                            value={currentInvoice.recurrence?.frequency || ''}
                            onChange={(e) => {
                                const freq = e.target.value as 'monthly' | 'quarterly' | 'yearly' | '';
                                if (!freq) {
                                    setCurrentInvoice(prev => ({ ...prev, recurrence: undefined }));
                                    return;
                                }
                                const next = new Date();
                                if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
                                else if (freq === 'quarterly') next.setMonth(next.getMonth() + 3);
                                else if (freq === 'yearly') next.setFullYear(next.getFullYear() + 1);
                                setCurrentInvoice(prev => ({
                                    ...prev,
                                    recurrence: { frequency: freq, nextRunAt: next.toISOString().split('T')[0] },
                                }));
                            }}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${currentInvoice.recurrence ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                            title="Configurer la récurrence (génère automatiquement un brouillon à chaque échéance)"
                        >
                            <option value="">↺ Une fois</option>
                            <option value="monthly">↺ Mensuelle</option>
                            <option value="quarterly">↺ Trimestrielle</option>
                            <option value="yearly">↺ Annuelle</option>
                        </select>
                    </div>

                    {/* Historique (journal d'audit) — désactivé tant qu'on n'a pas d'entrées */}
                    <button
                        onClick={() => setShowHistory(true)}
                        disabled={!(currentInvoice.history && currentInvoice.history.length > 0)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                        title="Voir le journal d'audit de cette facture"
                    >
                        <History size={14} /> Historique
                    </button>

                    <button onClick={handleDownloadPDF} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-white rounded-lg font-bold text-xs transition-colors shrink-0 whitespace-nowrap">
                        {isGenerating ? <RefreshCw className="animate-spin" size={14}/> : <Download size={14} />} PDF
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-brand-orange text-white rounded-lg font-bold text-xs shadow-md hover:shadow-lg transition-all shrink-0 whitespace-nowrap mr-1">
                        {isSaving ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14} />} {t.save}
                    </button>
                </div>
            </div>

            {/* Document Scroll Area */}
            <div className="flex-1 w-full overflow-y-auto bg-slate-200 dark:bg-black/50 p-8 flex justify-center">
                
                {/* THE A4 PAPER (WYSIWYG) — exact A4 size so the Swiss QR-bill
                    section sits flush at the bottom (105mm zone, per ISO 20022 spec). */}
                <div 
                    id="invoice-paper"
                    className="bg-white text-black shadow-2xl relative transition-all font-sans"
                    style={{ width: '210mm', minHeight: '297mm', padding: '0', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
                >
                    {/* TOP SECTION (Custom Layout based on Facture LN Avocats.pdf) */}
                    <div className="px-[15mm] py-[10mm] flex-1">
                        
                        {/* Header: Sender (Top Left) — logo retiré, l'expéditeur suffit */}
                        <div className="flex items-start gap-5 mb-10">
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
                                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                    {isGenerating ? (
                                        senderAddress
                                    ) : (
                                        <textarea
                                            value={senderAddress}
                                            onChange={e => setSenderAddress(e.target.value)}
                                            rows={3}
                                            placeholder={"4A chemin du Port\n1246 Corsier\nSuisse"}
                                            className="w-full bg-transparent outline-none resize-y border border-transparent hover:border-slate-300 focus:border-brand-orange min-h-[3.5rem] leading-relaxed p-1"
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
                                    placeholder={t.clientAddressPlaceholder}
                                    rows={4}
                                    className="w-full text-xs text-slate-700 bg-transparent resize-y whitespace-pre-wrap outline-none border border-transparent hover:border-slate-200 focus:border-brand-orange transition-colors min-h-[5rem] leading-relaxed p-1"
                                />
                            </div>

                            {/* Invoice Details (Right) - aligned to right margin */}
                            <div className="text-[10px] space-y-1.5">
                                <table className="ml-auto">
                                    <tbody>
                                        <tr>
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">{t.invoiceNumber}</td>
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
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">{t.invoiceDate}</td>
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
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">{t.paymentTerms}</td>
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
                                            <td className="font-bold text-slate-600 text-right pr-4 py-0.5">{t.dueDate}</td>
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
                            {/* Toggle TVA — visible en édition uniquement, n'altère pas le rendu print/PDF si désactivé */}
                            {!isGenerating && (
                                <div className="flex justify-end mb-2 print:hidden">
                                    <button
                                        type="button"
                                        onClick={toggleVatMode}
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors ${vatActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        title={vatActive ? 'Désactiver la TVA sur cette facture' : 'Activer la TVA suisse sur cette facture'}
                                    >
                                        {vatActive ? `TVA: ON` : 'TVA: OFF'}
                                    </button>
                                </div>
                            )}
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-800">
                                        <th className="text-left py-2 px-3 font-bold">{t.description}</th>
                                        {vatActive && <th className="text-center py-2 px-2 font-bold w-20">TVA</th>}
                                        <th className="text-right py-2 px-3 font-bold w-32">{vatActive ? `${t.amount} HT` : t.amount}</th>
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
                                                        placeholder={t.descriptionPlaceholder}
                                                        className="w-full bg-transparent outline-none text-slate-800"
                                                    />
                                                )}
                                            </td>
                                            {vatActive && (
                                                <td className="py-2.5 px-2 align-top text-center">
                                                    {isGenerating ? (
                                                        <span className="tabular-nums text-slate-600">
                                                            {item.vatExempt ? 'Exo.' : (typeof item.vatRate === 'number' ? `${item.vatRate}%` : '—')}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            value={item.vatExempt ? 'exo' : String(item.vatRate ?? 0)}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                if (v === 'exo') updateItemVat(item.id, 0, true);
                                                                else updateItemVat(item.id, Number(v) as SwissVatRate, false);
                                                            }}
                                                            className="bg-transparent text-[10px] outline-none cursor-pointer tabular-nums text-slate-700 hover:text-brand-orange"
                                                        >
                                                            <option value="0">0%</option>
                                                            <option value="2.6">2.6%</option>
                                                            <option value="3.8">3.8%</option>
                                                            <option value="8.1">8.1%</option>
                                                            <option value="exo">Exo.</option>
                                                        </select>
                                                    )}
                                                </td>
                                            )}
                                            <td className="py-2.5 px-3 text-right align-top font-bold text-slate-900">
                                                {(() => {
                                                    const q = Number(item.quantity);
                                                    const qn = Number.isFinite(q) && q > 0 ? q : 1;
                                                    const pn = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
                                                    const lineTot = qn * pn;
                                                    return isGenerating ? (
                                                        formatCurrency(lineTot, 2)
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            step={0.01}
                                                            value={Math.round(lineTot * 100) / 100}
                                                            onChange={e => updateItemMontant(item.id, parseMoneyInput(e.target.value))}
                                                            className="w-full max-w-[8.5rem] ml-auto bg-transparent outline-none text-slate-900 text-right tabular-nums font-bold"
                                                        />
                                                    );
                                                })()}
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
                                    <Plus size={12} /> {t.addLine}
                                </button>
                            )}
                        </div>

                        {/* Récap TVA + Total — récap inséré dans la zone totaux existante (pas de bloc visuel ajouté en mode legacy) */}
                        {vatActive && totals.vatBreakdown.length > 0 && (
                            <div className="flex justify-end mb-2">
                                <div className="w-56 text-[10px] text-slate-600 space-y-0.5 tabular-nums">
                                    <div className="flex justify-between">
                                        <span>Sous-total HT</span>
                                        <span>{formatCurrency(totals.subtotalHt, 2)}</span>
                                    </div>
                                    {totals.vatBreakdown.map((b) => (
                                        <div key={b.rate} className="flex justify-between">
                                            <span>TVA {b.rate.toFixed(b.rate % 1 === 0 ? 0 : 1)}% sur {formatCurrency(b.netHt, 2)}</span>
                                            <span>{formatCurrency(b.vat, 2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Total */}
                        <div className="flex justify-end mb-4 border-t-2 border-slate-900 pt-2">
                            <div className="w-48 flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-900">{vatActive ? `${t.total} TTC` : t.total} {currentInvoice.currency}</span>
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
                                                {t.deposit} - {payment.date}
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
                                        <span className="font-bold text-slate-900">{t.netDue}</span>
                                        <span className={`text-sm font-bold ${remainingAmount <= 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                            {remainingAmount <= 0 ? t.paid : `${formatCurrency(remainingAmount, 2)}`}
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
                                    <span className="text-slate-600">{t.payOnline}</span>
                                    <a href={currentInvoice.paymentLink} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold hover:underline truncate max-w-[150px]">
                                        {currentInvoice.paymentLink.replace('https://', '').split('?')[0]}
                                    </a>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(currentInvoice.paymentLink || '')}
                                        className="text-slate-400 hover:text-emerald-600 print:hidden"
                                        title="Copier le lien"
                                    >
                                        <Link2 size={10} />
                                    </button>
                                    <button
                                        onClick={removePaymentLink}
                                        className="text-slate-400 hover:text-red-500 print:hidden"
                                        title="Retirer le lien de paiement"
                                    >
                                        <X size={10} />
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
                                    placeholder={t.footerPlaceholder}
                                    className="w-full text-[10px] text-slate-500 bg-transparent resize-none outline-none border border-dashed border-transparent hover:border-slate-200 focus:border-brand-orange p-2 rounded transition-colors print:hidden"
                                    rows={2}
                                />
                            </div>
                        ) : footerNote ? (
                            <div className="mb-6 text-[10px] text-slate-500 whitespace-pre-wrap">{footerNote}</div>
                        ) : null}
                    </div>

                    {/* Footer / Divider — mentions légales suisses */}
                    <div className="px-[15mm] mb-4">
                        <div className="border-t border-dotted border-slate-400 w-full mb-2"></div>
                        <div className="flex justify-between text-[9px] text-slate-500 gap-4">
                            <span className="truncate">{
                                senderAddress.includes('•')
                                    ? senderAddress.split('•').map(s => s.trim()).filter(Boolean).join(' • ')
                                    : senderAddress.split('\n').map(s => s.trim()).filter(Boolean).join(' • ')
                            }</span>
                            <span className="flex-shrink-0">
                                {[
                                    agencyIde && `N° IDE ${agencyIde}`,
                                    agencyVatNumber && `N° TVA ${agencyVatNumber}`,
                                ].filter(Boolean).join(' • ') || 'N° IDE non renseigné'}
                            </span>
                        </div>
                    </div>

                    {/* BOTTOM SECTION (Swiss QR or SEPA)
                        Swiss QR-bill spec: 210mm × 105mm exactement, fixé au bas de la page A4.
                        Récépissé 62mm | Section paiement 148mm. */}
                    {(activeBank.id === 'main' && ['CHF', 'EUR', '€'].includes(currentInvoice.currency || 'CHF')) ? (
                        <div
                            className="w-full border-t border-dashed border-slate-300 relative break-inside-avoid shrink-0 bg-white"
                            style={{ width: '210mm', height: '105mm', padding: '0', boxSizing: 'border-box' }}
                        >
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-slate-400 print:hidden">
                                <span className="text-xs tabular-nums">{t.qrZone}</span>
                            </div>

                            <div className="flex h-full font-sans text-black text-xs leading-tight" style={{ boxSizing: 'border-box' }}>
                                {/* Récépissé — 62mm × 105mm (spec Swiss QR-bill).
                                    Padding-left 15mm pour aligner le texte avec le contenu de la facture au-dessus
                                    (qui utilise px-[15mm]). Padding-right/y restent à 5mm (standard QR-bill). */}
                                <div className="h-full pl-[15mm] pr-[5mm] py-[5mm] border-r border-dashed border-slate-300 flex flex-col shrink-0" style={{ width: '62mm', boxSizing: 'border-box' }}>
                                    <h3 className="font-bold text-sm mb-3">{t.receipt}</h3>
                                    <div className="mb-3">
                                        <p className="font-bold mb-1">{t.payableTo}</p>
                                        <p className="whitespace-nowrap font-mono tracking-tight" style={{ fontSize: '8pt' }}>{activeBank.iban}</p>
                                        <p>{senderName}</p>
                                        <div className="text-xs whitespace-pre-line">{(() => {
                                            const a = parseSenderAddress(senderAddress);
                                            return [a.street, [a.zip, a.city].filter(Boolean).join(' ')].filter(Boolean).join('\n');
                                        })()}</div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold mb-1">{t.payableBy}</p>
                                        <p>{currentInvoice.clientDisplayName || activeProject?.clientName}</p>
                                        <div className="whitespace-pre-line">{currentInvoice.clientAddress}</div>
                                    </div>
                                    <div className="mt-auto">
                                        <p className="font-bold mb-1">{t.amount}</p>
                                        <div className="flex gap-4 font-bold text-sm">
                                            <span>{currentInvoice.currency}</span>
                                            <span>{formatCurrency(calculateTotal(), 2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Section paiement — 148mm × 105mm (spec Swiss QR-bill).
                                    Padding-right 15mm pour aligner avec le bord droit de la facture (px-[15mm]). */}
                                <div className="h-full pl-[5mm] pr-[15mm] py-[5mm] flex flex-col" style={{ width: '148mm', boxSizing: 'border-box' }}>
                                    <h3 className="font-bold text-base mb-3">{t.paymentSection}</h3>
                                    <div className="flex gap-6 h-full">
                                        <div className="shrink-0" style={{ width: '46mm' }}>
                                            <div className="border border-black flex items-center justify-center bg-white mb-4 relative" style={{ width: '46mm', height: '46mm', boxSizing: 'border-box' }}>
                                                {qrImage ? (
                                                    <img src={qrImage} alt="Swiss QR" className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center pointer-events-none">
                                                        {qrError ? (
                                                            <span className="text-[7px] leading-tight text-red-600 print:text-[6px]">{qrError}</span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">{t.qrPending}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-4">
                                                <p className="font-bold mb-1">{t.amount}</p>
                                                <div className="flex gap-2 font-bold text-base">
                                                    <span>{currentInvoice.currency}</span>
                                                    <span>{formatCurrency(calculateTotal(), 2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <div className="mb-3">
                                                <p className="font-bold mb-1">{t.payableTo}</p>
                                                <p className="whitespace-nowrap font-mono tracking-tight" style={{ fontSize: '9pt' }}>{activeBank.iban}</p>
                                                <p>{senderName}</p>
                                                <div className="text-xs opacity-80 whitespace-pre-line">{(() => {
                                                    const a = parseSenderAddress(senderAddress);
                                                    return [a.street, [a.zip, a.city].filter(Boolean).join(' ')].filter(Boolean).join('\n');
                                                })()}</div>
                                            </div>
                                            {(() => {
                                                // Affiche la référence QRR/SCOR si calculable, sinon le n° de facture (message libre)
                                                const ibanRaw = activeBank.iban.replace(/\s/g, '');
                                                const mode = chooseReferenceMode(ibanRaw, isQrIban(ibanRaw) ? 'QRR' : 'SCOR');
                                                let ref: string | undefined;
                                                try { ref = generateReferenceForMode(mode, currentInvoice.number); } catch { ref = undefined; }
                                                if (mode === 'NON' || !ref) return null;
                                                const formatted = mode === 'QRR' ? formatQrReference(ref) : ref;
                                                return (
                                                    <div className="mb-3">
                                                        <p className="font-bold mb-1">{t.reference}</p>
                                                        <p className="font-mono tracking-tight" style={{ fontSize: '9pt' }}>{formatted}</p>
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex-1">
                                                 <p className="font-bold mb-1">{t.payableBy}</p>
                                                 <p>{currentInvoice.clientDisplayName || activeProject?.clientName}</p>
                                                 <div className="whitespace-pre-line">{currentInvoice.clientAddress}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full border-t-2 border-slate-100 px-8 py-10 text-center text-slate-600 bg-gradient-to-b from-slate-50 to-white">
                            <p className="font-bold text-xs mb-1 uppercase tracking-[0.25em] text-slate-400">{t.paymentInfo}</p>
                            <p className="text-sm mt-2">{t.sepaInstruction} <strong className="text-slate-800">{formatCurrency(calculateTotal(), 2)} {currentInvoice.currency}</strong> {t.sepaInstructionEnd}</p>
                            <div className="mt-6 mx-auto max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
                                <table className="w-full text-sm">
                                    <tbody>
                                        {activeBank.beneficiary && (
                                            <tr className="border-b border-slate-100">
                                                <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-400 whitespace-nowrap w-44">{t.beneficiary}</td>
                                                <td className="py-2.5 pr-5 text-slate-700">{activeBank.beneficiary}</td>
                                            </tr>
                                        )}
                                        <tr className="border-b border-slate-100">
                                            <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-400 whitespace-nowrap w-44">{t.iban}</td>
                                            <td className="py-2.5 pr-5 text-slate-700 font-mono tracking-wide">{activeBank.iban}</td>
                                        </tr>
                                        {activeBank.bic && (
                                            <tr className="border-b border-slate-100">
                                                <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-400 whitespace-nowrap w-44">{t.bic}</td>
                                                <td className="py-2.5 pr-5 text-slate-700 font-mono">{activeBank.bic}</td>
                                            </tr>
                                        )}
                                        {activeBank.correspondentBic && (
                                            <tr className="border-b border-slate-100">
                                                <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-400 whitespace-nowrap w-44">{t.correspondentBic}</td>
                                                <td className="py-2.5 pr-5 text-slate-700 font-mono">{activeBank.correspondentBic}</td>
                                            </tr>
                                        )}
                                        <tr className="border-b border-slate-100">
                                            <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-400 whitespace-nowrap w-44">{t.bank}</td>
                                            <td className="py-2.5 pr-5 text-slate-700">{activeBank.bankName}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-400 whitespace-nowrap w-44">{t.address}</td>
                                            <td className="py-2.5 pr-5 text-slate-700">{activeBank.address}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={() => setShowPaymentModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 dark:text-white">{t.registerDeposit}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.amountReceived}</label>
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
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.date}</label>
                                    <input
                                        type="date"
                                        value={newPaymentDate}
                                        onChange={e => setNewPaymentDate(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.method}</label>
                                    <select
                                        value={newPaymentMethod}
                                        onChange={e => setNewPaymentMethod(e.target.value as InvoicePayment['method'])}
                                        className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
                                    >
                                        <option value="Virement">{t.methodTransfer}</option>
                                        <option value="Carte">{t.methodCard}</option>
                                        <option value="Stripe">{t.methodStripe}</option>
                                        <option value="Espèces">{t.methodCash}</option>
                                        <option value="Autre">{t.methodOther}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.noteOptional}</label>
                                <input
                                    type="text"
                                    value={newPaymentNote}
                                    onChange={e => setNewPaymentNote(e.target.value)}
                                    placeholder={t.notePlaceholder}
                                    className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {t.cancel}
                                </button>
                                <button
                                    onClick={handleAddPayment}
                                    className="flex-1 px-4 py-2 bg-brand-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
                                >
                                    {t.save}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Drawer (audit log timeline) */}
            <InvoiceHistoryDrawer
                invoice={currentInvoice}
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
            />
        </div>
    );
};