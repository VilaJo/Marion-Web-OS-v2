import React, { useState, useEffect, useRef } from 'react';
import {
    Mail, Lock, RefreshCw, AlertCircle, User, AtSign, Send, X, ArrowLeft,
    Edit, Trash2, Reply, Forward, Star, Inbox, Save, Mic, Paperclip,
    Download, FileText, Sparkles, Bot
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { sanitizeHTML } from '../utils/sanitize';
import { useNotificationStore } from '../stores/useNotificationStore';
import {
    useEmailStatus, useEmails, useEmailConnect, useEmailDisconnect,
    useSendEmail, useDeleteEmail, useMarkRead, useSaveDraft,
    useEmailAIReply, useEmailAISummarize,
    emailKeys,
    type EmailMessage, type EmailAttachment,
} from '../services/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores/useUIStore';

interface EmailClientProps {
    clientEmail?: string;
    initialCompose?: { to: string, subject: string, body: string };
    onClose?: () => void;
}

export const EmailClient: React.FC<EmailClientProps> = ({ clientEmail, initialCompose, onClose }) => {
    const queryClient = useQueryClient();
    const { addNotification } = useNotificationStore();
    const signatureSettings = useUIStore(s => s.signatureSettings);

    // Phase 4.3: Build signature text from settings
    const getSignatureText = (): string => {
        if (signatureSettings.mode === 'html' && signatureSettings.html) {
            // Strip HTML for plain-text email
            const tmp = document.createElement('div');
            tmp.innerHTML = signatureSettings.html;
            return '\n\n--\n' + (tmp.textContent || tmp.innerText || '');
        }
        if (signatureSettings.mode === 'standard' && signatureSettings.name) {
            let sig = '\n\n--\n' + signatureSettings.name;
            if (signatureSettings.role) sig += '\n' + signatureSettings.role;
            return sig;
        }
        return '';
    };

    // Auth inputs
    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');

    // View State
    const [view, setView] = useState<'list' | 'read' | 'compose'>(initialCompose ? 'compose' : 'list');
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [emailBody, setEmailBody] = useState<string | undefined>(undefined);
    const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
    const [draft, setDraft] = useState(initialCompose || { to: '', subject: '', body: '' });
    const [currentFolder, setCurrentFolder] = useState<'inbox' | 'sent' | 'drafts'>('inbox');
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // Compose attachments (Phase 2.5)
    const [composeFiles, setComposeFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Voice Dictation
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const recognitionRef = useRef<any>(null);
    const draftBodyRef = useRef(draft.body);

    // React Query hooks (Phase 4.1)
    const { data: statusData } = useEmailStatus();
    const isConnected = statusData?.connected ?? false;
    const connectedUsername = statusData?.username ?? '';

    const { data: emails = [], isLoading, refetch: refetchEmails } = useEmails(currentFolder, isConnected);

    const connectMutation = useEmailConnect();
    const disconnectMutation = useEmailDisconnect();
    const sendMutation = useSendEmail();
    const deleteMutation = useDeleteEmail();
    const markReadMutation = useMarkRead();
    const draftMutation = useSaveDraft();
    const aiReplyMutation = useEmailAIReply();
    const aiSummarizeMutation = useEmailAISummarize();

    useEffect(() => {
        draftBodyRef.current = draft.body;
    }, [draft.body]);

    // Set email input from connection status
    useEffect(() => {
        if (connectedUsername && !emailInput) {
            setEmailInput(connectedUsername);
        }
    }, [connectedUsername]);

    // Refetch when folder changes
    useEffect(() => {
        if (isConnected) {
            queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
        }
    }, [currentFolder, isConnected]);

    // Voice dictation
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
                setDraft(prev => ({ ...prev, body: cur + sep + finalTranscript }));
            }
            if (currentInterim) setInterimText(currentInterim);
        };
        recognition.start();
    };

    // ====== HANDLERS ======

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            await connectMutation.mutateAsync({ username: emailInput, password: passwordInput });
            setPasswordInput('');
            addNotification('Email', 'Connecté avec succès.', 'success');
            if (!initialCompose) {
                queryClient.invalidateQueries({ queryKey: emailKeys.list('inbox') });
            }
        } catch (err: any) {
            setLoginError(err.message || 'Identifiants invalides');
        }
    };

    const handleLogout = async () => {
        await disconnectMutation.mutateAsync();
        setPasswordInput('');
        addNotification('Email', 'Déconnecté.', 'info');
    };

    const handleOpenEmail = async (mail: EmailMessage) => {
        setSelectedEmail(mail);
        setEmailBody(undefined);
        setEmailAttachments([]);
        setAiSummary(null);
        setView('read');

        // Mark as read (Phase 1.3)
        if (mail.isUnread) {
            markReadMutation.mutate({ id: mail.id, folder: currentFolder });
        }

        // Fetch body
        try {
            const res = await apiFetch('/api/v1/email/body', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: mail.id, folder: currentFolder }),
            });
            const data = await res.json();
            if (data.success) {
                setEmailBody(data.html || '');
                setEmailAttachments(data.attachments || []);
            } else {
                setEmailBody(mail.snippet || '');
            }
        } catch {
            setEmailBody(mail.snippet || '');
        }
    };

    const handleCompose = () => {
        setDraft({ to: clientEmail || '', subject: '', body: getSignatureText() });
        setComposeFiles([]);
        setView('compose');
    };

    const handleReply = () => {
        if (!selectedEmail) return;
        const quoted = `\n\n\n--- Le ${new Date(selectedEmail.date).toLocaleString()} ---\n${selectedEmail.snippet}`;
        setDraft({
            to: selectedEmail.from.replace(/<.*?>/g, '').trim(),
            subject: `Re: ${selectedEmail.subject}`,
            body: getSignatureText() + quoted,
        });
        setComposeFiles([]);
        setView('compose');
    };

    // Phase 2.2: Forward
    const handleForward = () => {
        if (!selectedEmail) return;
        const fwd = `\n\n\n---------- Forwarded message ----------\nDe : ${selectedEmail.from}\nDate : ${new Date(selectedEmail.date).toLocaleString()}\nSujet : ${selectedEmail.subject}\n\n${emailBody || selectedEmail.snippet}`;
        setDraft({
            to: '',
            subject: `Fwd: ${selectedEmail.subject}`,
            body: getSignatureText() + fwd,
        });
        setComposeFiles([]);
        setView('compose');
    };

    // Phase 2.1: Delete
    const handleDelete = async () => {
        if (!selectedEmail) return;
        try {
            await deleteMutation.mutateAsync({ id: selectedEmail.id, folder: currentFolder });
            addNotification('Email', 'Email supprimé.', 'success');
            setView('list');
            setSelectedEmail(null);
        } catch (err: any) {
            addNotification('Email', err.message || 'Erreur de suppression.', 'error');
        }
    };

    const handleSendDraft = async () => {
        try {
            await sendMutation.mutateAsync({
                to: draft.to,
                subject: draft.subject,
                body: draft.body,
                attachments: composeFiles.length > 0 ? composeFiles : undefined,
            });
            addNotification('Email', `Email envoyé à ${draft.to} !`, 'success');
            setComposeFiles([]);
            setView('list');
        } catch (err: any) {
            addNotification('Email', err.message || "Erreur lors de l'envoi.", 'error');
        }
    };

    const handleSaveDraft = async () => {
        try {
            await draftMutation.mutateAsync({
                to: draft.to,
                subject: draft.subject,
                body: draft.body,
            });
            addNotification('Email', 'Brouillon enregistré.', 'success');
            setView('list');
        } catch (err: any) {
            addNotification('Email', err.message || 'Erreur sauvegarde brouillon.', 'error');
        }
    };

    // Phase 5.1: AI Reply
    const handleAIReply = async () => {
        if (!selectedEmail) return;
        try {
            const reply = await aiReplyMutation.mutateAsync({
                originalBody: emailBody || selectedEmail.snippet,
                originalFrom: selectedEmail.from,
                originalSubject: selectedEmail.subject,
            });
            setDraft({
                to: selectedEmail.from.replace(/<.*?>/g, '').trim(),
                subject: `Re: ${selectedEmail.subject}`,
                body: reply,
            });
            setComposeFiles([]);
            setView('compose');
            addNotification('Franck', 'Réponse générée !', 'success');
        } catch {
            addNotification('Franck', 'Impossible de générer la réponse.', 'error');
        }
    };

    // Phase 5.2: AI Summarize
    const handleAISummarize = async () => {
        if (!selectedEmail) return;
        try {
            const summary = await aiSummarizeMutation.mutateAsync({
                body: emailBody || selectedEmail.snippet,
                subject: selectedEmail.subject,
            });
            setAiSummary(summary);
        } catch {
            addNotification('Franck', 'Impossible de résumer.', 'error');
        }
    };

    // Phase 2.5: Attachment helpers
    const [isDragging, setIsDragging] = useState(false);
    const handleAddFiles = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setComposeFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
        // Reset the input so the same file can be re-added
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const removeFile = (idx: number) => setComposeFiles(prev => prev.filter((_, i) => i !== idx));

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setComposeFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    const handleDownloadAttachment = async (att: EmailAttachment) => {
        if (!selectedEmail) return;
        try {
            const res = await apiFetch('/api/v1/email/attachment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedEmail.id,
                    partIndex: att.partIndex,
                    folder: currentFolder,
                }),
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            addNotification('Email', 'Impossible de télécharger la pièce jointe.', 'error');
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ====== RENDERERS ======

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl">
                <div className="w-full max-w-sm">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none text-blue-600 animate-in zoom-in duration-500">
                            <Mail size={40} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-center mb-2 dark:text-white text-slate-800">Email Client</h3>
                    <p className="text-center text-slate-500 text-sm mb-8 leading-relaxed">
                        Connectez votre compte pour gérer les emails {clientEmail ? <span>de <strong className="text-slate-800 dark:text-slate-200">{clientEmail}</strong></span> : "récents"}.
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <div className="relative">
                                <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                    placeholder="marion@agence.ch"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {loginError && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={16} /> {loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={connectMutation.isPending}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-70 transform active:scale-95"
                        >
                            {connectMutation.isPending ? <RefreshCw className="animate-spin" /> : "Connexion"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (view === 'compose') {
        return (
            <div
                className={`h-full flex flex-col animate-in slide-in-from-right-4 duration-300 bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 relative transition-all ${isDragging ? 'ring-2 ring-brand-orange ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Drag overlay */}
                {isDragging && (
                    <div className="absolute inset-0 bg-orange-50/80 dark:bg-orange-900/20 rounded-3xl z-50 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-center">
                            <Paperclip size={40} className="mx-auto mb-3 text-brand-orange animate-bounce" />
                            <p className="text-lg font-bold text-brand-orange">Déposez vos fichiers ici</p>
                            <p className="text-sm text-orange-500/70 mt-1">pour les joindre à l'email</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-serif font-bold dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-brand-orange flex items-center justify-center">
                            <Edit size={16} />
                        </div>
                        Nouveau Message
                    </h3>
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4 flex-1 flex flex-col">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">À</label>
                        <input
                            value={draft.to}
                            onChange={e => setDraft({ ...draft, to: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Sujet</label>
                        <input
                            value={draft.subject}
                            onChange={e => setDraft({ ...draft, subject: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-orange dark:text-white"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
                            {isListening && <span className="text-xs font-bold text-red-500 animate-pulse mr-2">{interimText || '...'}</span>}
                        </div>
                        <textarea
                            value={draft.body}
                            onChange={e => setDraft({ ...draft, body: e.target.value })}
                            className="w-full h-full min-h-[200px] bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-brand-orange dark:text-white resize-none"
                        />
                    </div>

                    {/* Compose Attachments (Phase 2.5) */}
                    {composeFiles.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Paperclip size={10} /> Pièces jointes ({composeFiles.length})
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {composeFiles.map((f, idx) => {
                                    const isImage = f.type.startsWith('image/');
                                    return (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs group">
                                            <div className={`w-6 h-6 rounded flex items-center justify-center ${isImage ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                                                <FileText size={12} />
                                            </div>
                                            <span className="font-semibold truncate max-w-[140px] dark:text-slate-200">{f.name}</span>
                                            <span className="text-slate-400">{formatSize(f.size)}</span>
                                            <button onClick={() => removeFile(idx)} className="text-slate-300 hover:text-red-500 transition-colors ml-1">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

                <div className="flex flex-wrap justify-end gap-2 md:gap-3 mt-4 md:mt-6">
                    <button
                        onClick={handleAddFiles}
                        className="p-3 md:px-4 md:py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-xl transition-all flex items-center gap-2 text-sm font-bold min-w-[44px] min-h-[44px] justify-center"
                        title="Ajouter des pièces jointes"
                    >
                        <Paperclip size={18} />
                        <span className="hidden md:inline">Joindre</span>
                    </button>
                    <button
                        onClick={toggleListening}
                        className={`p-3 rounded-xl transition-all flex items-center justify-center min-w-[44px] min-h-[44px] ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                        title="Dicter l'email"
                    >
                        <Mic size={20} />
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        disabled={draftMutation.isPending}
                        className="p-3 md:px-6 md:py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center"
                    >
                        {draftMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} <span className="hidden md:inline">Brouillon</span>
                    </button>
                    <button
                        onClick={handleSendDraft}
                        disabled={sendMutation.isPending}
                        className="px-6 py-3 md:px-8 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-200 dark:shadow-none transition-all flex items-center gap-2 min-h-[44px]"
                    >
                        {sendMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />} Envoyer
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'read' && selectedEmail) {
        return (
            <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
                {/* Header Actions */}
                <div className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-slate-100 dark:border-slate-700">
                    <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px]">
                        <ArrowLeft size={18} /> Retour
                    </button>
                    <div className="flex gap-1 md:gap-2 overflow-x-auto">
                        <button onClick={handleReply} className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center" title="Répondre"><Reply size={18} /></button>
                        <button onClick={handleForward} className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center hidden md:flex" title="Transférer"><Forward size={18} /></button>
                        <button onClick={handleAIReply} disabled={aiReplyMutation.isPending} className="p-2.5 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center" title="Franck répond">
                            {aiReplyMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Bot size={18} />}
                        </button>
                        <button onClick={handleAISummarize} disabled={aiSummarizeMutation.isPending} className="p-2.5 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center hidden md:flex" title="Résumer avec IA">
                            {aiSummarizeMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        </button>
                        <button onClick={handleDelete} disabled={deleteMutation.isPending} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center" title="Supprimer">
                            {deleteMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                    </div>
                </div>

                {/* AI Summary (Phase 5.2) */}
                {aiSummary && (
                    <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center gap-2 mb-2 text-purple-700 dark:text-purple-300">
                            <Sparkles size={14} />
                            <span className="text-xs font-bold uppercase tracking-wider">Résumé IA</span>
                            <button onClick={() => setAiSummary(null)} className="ml-auto text-purple-400 hover:text-purple-600">
                                <X size={14} />
                            </button>
                        </div>
                        <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">{aiSummary}</p>
                    </div>
                )}

                {/* Email Content */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white mb-4">{selectedEmail.subject}</h2>

                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {(currentFolder === 'sent' ? (selectedEmail.to || '?') : selectedEmail.from).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">
                                {currentFolder === 'sent' ? `À : ${selectedEmail.to || '—'}` : selectedEmail.from}
                            </div>
                            {currentFolder !== 'sent' && selectedEmail.to && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">À : {selectedEmail.to}</div>
                            )}
                            {currentFolder === 'sent' && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">De : {selectedEmail.from}</div>
                            )}
                            <div className="text-xs text-slate-400 mt-0.5">{new Date(selectedEmail.date).toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {emailBody === undefined ? (
                            <div className="flex items-center gap-2 text-slate-400 py-4">
                                <RefreshCw size={14} className="animate-spin" /> Chargement du message...
                            </div>
                        ) : emailBody ? (
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(emailBody) }} />
                        ) : (
                            <p className="whitespace-pre-wrap">{selectedEmail.snippet}</p>
                        )}
                    </div>

                    {/* Attachments (Phase 2.4) */}
                    {emailAttachments.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Paperclip size={12} /> Pièces jointes ({emailAttachments.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {emailAttachments.map((att) => {
                                    const isImage = att.contentType?.startsWith('image/');
                                    const isPdf = att.contentType === 'application/pdf';
                                    return (
                                        <button
                                            key={att.partIndex}
                                            onClick={() => handleDownloadAttachment(att)}
                                            className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-xs font-medium transition-colors group text-left"
                                        >
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isImage ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-500' : isPdf ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                                                {isImage ? <Download size={16} /> : <FileText size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate dark:text-slate-200 font-semibold">{att.filename}</div>
                                                <div className="text-slate-400 text-[10px] mt-0.5">{formatSize(att.size)} • {att.contentType?.split('/')[1]?.toUpperCase() || 'FICHIER'}</div>
                                            </div>
                                            <Download size={14} className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 md:mb-4 px-1 gap-2">
                <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-lg font-serif font-bold dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                            <Inbox size={16} />
                        </div>
                        <span className="truncate">{currentFolder === 'inbox' ? 'Boîte de réception' : currentFolder === 'sent' ? 'Envoyés' : 'Brouillons'}</span>
                    </h3>
                    <p className="text-xs font-medium text-slate-400 mt-1 ml-10 truncate">
                        {currentFolder === 'inbox' ? `${emails.filter(e => e.isUnread).length} non lus` : `${emails.length} messages`}
                    </p>
                </div>
                <div className="flex gap-1 md:gap-2 shrink-0">
                    <button
                        onClick={handleCompose}
                        className="p-2.5 bg-brand-orange text-white rounded-lg shadow-md hover:scale-105 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Nouveau Message"
                    >
                        <Edit size={18} />
                    </button>
                    <button
                        onClick={() => refetchEmails()}
                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Actualiser"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="hidden md:flex px-3 py-2 text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all items-center"
                    >
                        Déconnexion
                    </button>
                </div>
            </div>

            {/* Folder Tabs */}
            <div className="flex gap-3 md:gap-4 px-2 mb-3 md:mb-4 border-b border-slate-100 dark:border-slate-700 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setCurrentFolder('inbox')}
                    className={`pb-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center ${currentFolder === 'inbox' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Reçus
                </button>
                <button
                    onClick={() => setCurrentFolder('sent')}
                    className={`pb-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center ${currentFolder === 'sent' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Envoyés
                </button>
                <button
                    onClick={() => setCurrentFolder('drafts')}
                    className={`pb-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap min-h-[44px] flex items-center ${currentFolder === 'drafts' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Brouillons
                </button>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto pr-1 md:pr-2 -mr-1 md:-mr-2 space-y-2 md:space-y-3 pb-4">
                {emails.map((mail) => (
                    <div
                        key={mail.id}
                        onClick={() => handleOpenEmail(mail)}
                        className={`
                            group relative p-3.5 md:p-5 rounded-xl md:rounded-2xl cursor-pointer transition-all duration-300
                            bg-white dark:bg-slate-800 
                            border ${mail.isUnread ? 'border-blue-400 dark:border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md'}
                        `}
                    >
                        {mail.isUnread && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-2xl shadow-[0_0_10px_#3b82f6]"></div>
                        )}

                        <div className="flex justify-between items-start mb-2 pl-3">
                            <div className={`text-sm truncate pr-4 flex-1 ${mail.isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                                {mail.subject}
                            </div>
                            <div className={`text-[10px] whitespace-nowrap px-2 py-1 rounded-md ${mail.isUnread ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 font-bold' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 font-medium'}`}>
                                {new Date(mail.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 pl-3">
                            <User size={12} />
                            {currentFolder === 'sent' ? (
                                <span>À : {mail.to || '—'}</span>
                            ) : (
                                <span>{mail.from}</span>
                            )}
                            {mail.hasAttachments && (
                                <span className="ml-auto flex items-center gap-1 text-slate-400 dark:text-slate-500" title="Pièces jointes">
                                    <Paperclip size={12} />
                                </span>
                            )}
                        </div>

                        <p className={`text-xs line-clamp-2 leading-relaxed pl-3 pr-2 ${mail.isUnread ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            {mail.snippet}
                        </p>
                    </div>
                ))}

                {emails.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
                        <Mail size={48} className="mb-4 text-slate-300" />
                        <p className="text-sm font-medium">Aucun email trouvé</p>
                        {clientEmail && <p className="text-xs mt-1">avec {clientEmail}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};
