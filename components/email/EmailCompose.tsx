/**
 * EmailCompose - Full compose view with CC/BCC, attachments, drag-drop, dictation.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    X, Send, Save, Paperclip, Mic, FileText, RefreshCw, ArrowLeft,
    ChevronDown, ChevronUp, Reply, ReplyAll, Forward, Edit, Receipt
} from 'lucide-react';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { EmailWidgetState } from './useEmailWidget';

interface Props {
    state: EmailWidgetState;
}

const MODE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    new:      { label: 'Nouveau message',  icon: <Edit size={14} /> },
    reply:    { label: 'Répondre',         icon: <Reply size={14} /> },
    replyAll: { label: 'Répondre à tous',  icon: <ReplyAll size={14} /> },
    forward:  { label: 'Transférer',       icon: <Forward size={14} /> },
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EmailCompose: React.FC<Props> = ({ state }) => {
    const { addNotification } = useNotificationStore();
    const [isDragging, setIsDragging] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [showInvoicePicker, setShowInvoicePicker] = useState(false);
    const recognitionRef = useRef<any>(null);
    const draftBodyRef = useRef(state.draft.body);

    useEffect(() => {
        draftBodyRef.current = state.draft.body;
    }, [state.draft.body]);

    const modeInfo = MODE_LABELS[state.composeMode] || MODE_LABELS.new;

    // ---- Voice dictation ----
    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            addNotification('Dictée', 'Non supportée par ce navigateur.', 'error');
            return;
        }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            setInterimText('');
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';
        recognition.onstart = () => { setIsListening(true); setInterimText('Écoute en cours...'); };
        recognition.onend = () => { setIsListening(false); setInterimText(''); };
        recognition.onerror = () => { setIsListening(false); setInterimText('Erreur micro'); };
        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let currentInterim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    currentInterim += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                const cur = draftBodyRef.current;
                const sep = cur && !cur.endsWith(' ') && !cur.endsWith('\n') ? ' ' : '';
                state.setDraft(prev => ({ ...prev, body: cur + sep + finalTranscript }));
            }
            if (currentInterim) setInterimText(currentInterim);
        };
        recognition.start();
    };

    // ---- Drag & drop ----
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            state.handleDropFiles(e.dataTransfer.files);
        }
    };

    return (
        <div
            className={`flex flex-col h-full relative transition-all ${isDragging ? 'ring-2 ring-brand-orange ring-inset' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-orange-50/80 dark:bg-orange-900/20 z-50 flex items-center justify-center backdrop-blur-sm rounded-xl">
                    <div className="text-center">
                        <Paperclip size={36} className="mx-auto mb-2 text-brand-orange animate-bounce" />
                        <p className="text-sm font-bold text-brand-orange">Déposez vos fichiers ici</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
                <button
                    onClick={() => state.setView(state.selectedEmail ? 'read' : 'list')}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2 text-sm font-bold dark:text-white">
                    <span className="text-brand-orange">{modeInfo.icon}</span>
                    {modeInfo.label}
                </div>
                <div className="flex-1" />
                <button
                    onClick={() => state.setView(state.selectedEmail ? 'read' : 'list')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Facture liée (via Franck / Ma journée) */}
            {state.invoiceHint && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 text-amber-800 dark:text-amber-200 text-xs shrink-0">
                    <Receipt size={14} className="shrink-0" />
                    <span className="flex-1 truncate">
                        Facture liée : <strong>{state.invoiceHint.invoiceNumber}</strong>
                        {state.invoiceHint.clientName ? ` — ${state.invoiceHint.clientName}` : ''}
                        {state.invoiceHint.amount != null ? ` (${state.invoiceHint.amount} ${state.invoiceHint.currency || 'CHF'})` : ''}
                    </span>
                    <button
                        onClick={state.clearInvoiceHint}
                        className="text-amber-500 hover:text-amber-700 shrink-0"
                        title="Retirer la référence facture"
                    >
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* To */}
                <FieldRow label="À">
                    <input
                        value={state.draft.to}
                        onChange={e => state.setDraft(prev => ({ ...prev, to: e.target.value }))}
                        className="flex-1 bg-transparent outline-none text-sm dark:text-white"
                        placeholder="destinataire@email.com"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                        {!state.showCc && (
                            <button
                                onClick={() => state.setShowCc(true)}
                                className="text-[10px] font-bold text-slate-400 hover:text-blue-500 px-1.5 py-0.5 rounded transition-colors"
                            >
                                CC
                            </button>
                        )}
                        {!state.showBcc && (
                            <button
                                onClick={() => state.setShowBcc(true)}
                                className="text-[10px] font-bold text-slate-400 hover:text-blue-500 px-1.5 py-0.5 rounded transition-colors"
                            >
                                BCC
                            </button>
                        )}
                    </div>
                </FieldRow>

                {/* CC */}
                {state.showCc && (
                    <FieldRow label="CC">
                        <input
                            value={state.draft.cc}
                            onChange={e => state.setDraft(prev => ({ ...prev, cc: e.target.value }))}
                            className="flex-1 bg-transparent outline-none text-sm dark:text-white"
                            placeholder="copie@email.com"
                        />
                        <button onClick={() => { state.setShowCc(false); state.setDraft(prev => ({ ...prev, cc: '' })); }}
                            className="text-slate-400 hover:text-red-500 p-0.5"><X size={12} /></button>
                    </FieldRow>
                )}

                {/* BCC */}
                {state.showBcc && (
                    <FieldRow label="BCC">
                        <input
                            value={state.draft.bcc}
                            onChange={e => state.setDraft(prev => ({ ...prev, bcc: e.target.value }))}
                            className="flex-1 bg-transparent outline-none text-sm dark:text-white"
                            placeholder="copie cachée@email.com"
                        />
                        <button onClick={() => { state.setShowBcc(false); state.setDraft(prev => ({ ...prev, bcc: '' })); }}
                            className="text-slate-400 hover:text-red-500 p-0.5"><X size={12} /></button>
                    </FieldRow>
                )}

                {/* Subject */}
                <FieldRow label="Sujet">
                    <input
                        value={state.draft.subject}
                        onChange={e => state.setDraft(prev => ({ ...prev, subject: e.target.value }))}
                        className="flex-1 bg-transparent outline-none text-sm font-semibold dark:text-white"
                        placeholder="Objet de l'email"
                    />
                </FieldRow>

                {/* Body */}
                <div className="flex-1 min-h-0">
                    <div className="flex justify-between items-center mb-1 px-1">
                        {isListening && (
                            <span className="text-xs font-bold text-red-500 animate-pulse">{interimText || '...'}</span>
                        )}
                    </div>
                    <textarea
                        value={state.draft.body}
                        onChange={e => state.setDraft(prev => ({ ...prev, body: e.target.value }))}
                        className="w-full min-h-[200px] bg-transparent border-none outline-none text-sm leading-relaxed dark:text-white resize-none"
                        placeholder="Tapez votre message ici..."
                    />
                </div>

                {/* Signature preview */}
                <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 mt-2">
                    <div className="px-1">
                        <div className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest mb-2">Signature</div>
                        <div className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 13, lineHeight: 1.6 }}>
                            <div style={{ paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <img
                                    src="data:image/png;base64,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"
                                    alt="M"
                                    width={22}
                                    height={20}
                                    style={{ display: 'inline-block' }}
                                />
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>Eonora Tech</span>
                            </div>
                            <div style={{ paddingBottom: 2 }}>
                                <a href="tel:+41799404847" style={{ color: '#334155', textDecoration: 'none' }}>+41 79 940 48 47</a>
                            </div>
                            <div style={{ paddingBottom: 10 }}>
                                <a href="https://eonoratech.ch/" style={{ color: '#334155', textDecoration: 'none' }}>https://eonoratech.ch/</a>
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, maxWidth: 540 }}>
                                CONFIDENTIALITY NOTICE : This email and any documents or files attached to it may contain confidential information that is legally privileged. In particular, please note that our e-mail messages may originate or be delivered in Switzerland. Article 50 of the Swiss Law on Telecommunications provides that the dissemination or use of non-public information received in error is punishable by up to one year imprisonment. Do not read this e-mail if you are not the intended recipient. If you have received this transmission in error, please immediately notify us by reply e-mail and confirm that you have destroyed the transmission and its attachments. Thank you.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attachments */}
                {state.composeFiles.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Paperclip size={10} /> Pièces jointes ({state.composeFiles.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {state.composeFiles.map((f, idx) => {
                                const isImage = f.type.startsWith('image/');
                                return (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-xs">
                                        <div className={`w-6 h-6 rounded flex items-center justify-center ${isImage ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                                            <FileText size={12} />
                                        </div>
                                        <span className="font-semibold truncate max-w-[120px] dark:text-slate-200">{f.name}</span>
                                        <span className="text-slate-400">{formatSize(f.size)}</span>
                                        <button onClick={() => state.removeFile(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden file input */}
            <input ref={state.fileInputRef} type="file" multiple className="hidden" onChange={state.handleFileChange} />

            {/* Bottom bar */}
            <div className="shrink-0 relative flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/30">
                <button
                    onClick={state.handleAddFiles}
                    className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Joindre des fichiers"
                >
                    <Paperclip size={18} />
                </button>
                <button
                    onClick={toggleListening}
                    className={`p-2.5 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    title="Dictée vocale"
                >
                    <Mic size={18} />
                </button>
                <button
                    onClick={() => setShowInvoicePicker((v) => !v)}
                    disabled={state.openInvoiceOptions.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                    title={state.openInvoiceOptions.length === 0 ? 'Aucune facture ouverte' : 'Joindre un résumé de facture'}
                >
                    <Receipt size={16} /> Joindre facture (PDF)… <ChevronDown size={12} className={showInvoicePicker ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>

                {showInvoicePicker && (
                    <div className="absolute bottom-full left-4 mb-2 w-80 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-20 py-1">
                        {state.openInvoiceOptions.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-slate-400">Aucune facture ouverte à joindre.</p>
                        ) : (
                            state.openInvoiceOptions.map((row) => (
                                <button
                                    key={row.invoiceId}
                                    onClick={() => { state.attachInvoiceSummary(row); setShowInvoicePicker(false); }}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                >
                                    <span className="truncate">
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{row.invoiceNumber}</span>
                                        <span className="text-slate-400"> — {row.clientName}</span>
                                    </span>
                                    <span className="shrink-0 text-slate-400">{row.amount} {row.currency}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}

                <div className="flex-1" />

                <button
                    onClick={state.handleSaveDraft}
                    disabled={state.draftMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
                >
                    {state.draftMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                    Brouillon
                </button>
                <button
                    onClick={state.handleSend}
                    disabled={state.sendMutation.isPending || !state.draft.to.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-200 dark:shadow-none transition-all active:scale-95"
                >
                    {state.sendMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
                    Envoyer
                </button>
            </div>
        </div>
    );
};


// ============================================================================
// FieldRow helper
// ============================================================================

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-700/30">
        <span className="text-[10px] font-bold text-slate-400 uppercase w-8 shrink-0">{label}</span>
        {children}
    </div>
);
