/**
 * InvoiceHistoryDrawer — Timeline read-only des `AuditEntry` d'une facture.
 *
 * Spécification Phase 5 :
 *   - Drawer latéral (overlay à droite) qui affiche les événements de la
 *     facture dans l'ordre chronologique.
 *   - Lecture seule — l'audit log est append-only, on ne le réécrit jamais.
 *   - Icône + couleur par action (create/edit/send/pay/void/etc.).
 */

import React from 'react';
import { X, FileText, Send, CheckCircle, Edit2, Ban, Archive, RotateCcw, Repeat, FileMinus, Mail, AlertCircle } from 'lucide-react';
import type { Invoice, InvoiceAuditEntry } from '../types';

interface InvoiceHistoryDrawerProps {
    invoice: Invoice;
    isOpen: boolean;
    onClose: () => void;
}

const ICON_BY_ACTION: Record<InvoiceAuditEntry['action'], { icon: React.ElementType; color: string; label: string }> = {
    create: { icon: FileText, color: 'text-slate-500 bg-slate-100', label: 'Création' },
    edit: { icon: Edit2, color: 'text-blue-600 bg-blue-50', label: 'Édition' },
    send: { icon: Send, color: 'text-indigo-600 bg-indigo-50', label: 'Envoi' },
    issue: { icon: FileText, color: 'text-emerald-600 bg-emerald-50', label: 'Émission' },
    pay: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Paiement' },
    'partial-pay': { icon: CheckCircle, color: 'text-amber-600 bg-amber-50', label: 'Paiement partiel' },
    remind: { icon: Mail, color: 'text-purple-600 bg-purple-50', label: 'Relance' },
    void: { icon: Ban, color: 'text-red-600 bg-red-50', label: 'Annulation' },
    archive: { icon: Archive, color: 'text-slate-500 bg-slate-100', label: 'Archivage' },
    restore: { icon: RotateCcw, color: 'text-emerald-600 bg-emerald-50', label: 'Restauration' },
    'credit-note': { icon: FileMinus, color: 'text-amber-700 bg-amber-50', label: 'Note de crédit' },
    'recurrence-tick': { icon: Repeat, color: 'text-indigo-500 bg-indigo-50', label: 'Récurrence' },
};

export const InvoiceHistoryDrawer: React.FC<InvoiceHistoryDrawerProps> = ({ invoice, isOpen, onClose }) => {
    if (!isOpen) return null;

    const entries = [...(invoice.history || [])].sort((a, b) => a.at.localeCompare(b.at));

    return (
        <div className="fixed inset-0 z-[70]" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30" />
            <aside
                className="absolute top-0 right-0 h-full w-[400px] max-w-[90vw] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                        <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">Journal de la facture</h3>
                        <p className="text-xs text-slate-500">{invoice.number}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        aria-label="Fermer"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6">
                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                            <AlertCircle size={32} className="mb-3 opacity-40" />
                            <p className="text-sm">Aucun événement enregistré pour cette facture.</p>
                        </div>
                    ) : (
                        <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-5 pl-6">
                            {entries.map((entry, idx) => {
                                const meta = ICON_BY_ACTION[entry.action] || { icon: FileText, color: 'text-slate-500 bg-slate-100', label: entry.action };
                                const Icon = meta.icon;
                                return (
                                    <li key={`${entry.at}-${idx}`} className="ml-1">
                                        <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-2 ring-white dark:ring-slate-900 ${meta.color}`}>
                                            <Icon size={12} />
                                        </span>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{meta.label}</div>
                                        <div className="text-[11px] text-slate-400">
                                            {new Date(entry.at).toLocaleString('fr-CH', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            })} — {entry.actor}
                                        </div>
                                        {entry.note && (
                                            <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                                {entry.note}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </aside>
        </div>
    );
};

export default InvoiceHistoryDrawer;
