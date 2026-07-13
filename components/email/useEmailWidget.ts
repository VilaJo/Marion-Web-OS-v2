/**
 * useEmailWidget - Centralized state hook for the email widget.
 * Manages: connection, folder navigation, email selection, compose mode,
 *          multi-select, search, and all mutations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { useUIStore } from '../../stores/useUIStore';
import {
    useEmailStatus, useEmails, useEmailConnect, useEmailDisconnect,
    useSendEmail, useDeleteEmail, useMarkRead, useSaveDraft,
    useEmailAIReply, useEmailAISummarize,
    emailKeys,
    type EmailMessage, type EmailAttachment,
} from '../../services/queries';

// ============================================================================
// Types
// ============================================================================

/** Standard folder aliases + any arbitrary IMAP folder name (e.g. "INBOX/ClientName") */
export type FolderAlias = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash' | 'spam' | (string & {});
export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';
export type ViewMode = 'list' | 'read' | 'compose';

export interface ComposeDraft {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
}

export interface EmailWidgetProps {
    clientEmail?: string;
    initialCompose?: { to: string; subject: string; body: string };
    onClose?: () => void;
    /** If true, renders in fullscreen mode (dedicated /emails page) */
    fullscreen?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useEmailWidget(props: EmailWidgetProps) {
    const { clientEmail, initialCompose } = props;
    const queryClient = useQueryClient();
    const { addNotification } = useNotificationStore();
    const signatureSettings = useUIStore(s => s.signatureSettings);

    // ------ Connection ------
    const { data: statusData } = useEmailStatus();
    const isConnected = statusData?.connected ?? false;
    const connectedUsername = statusData?.username ?? '';

    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');

    const connectMutation = useEmailConnect();
    const disconnectMutation = useEmailDisconnect();

    useEffect(() => {
        if (connectedUsername && !emailInput) setEmailInput(connectedUsername);
    }, [connectedUsername]);

    // ------ Navigation ------
    const [currentFolder, setCurrentFolder] = useState<string>('inbox');
    const [view, setView] = useState<ViewMode>(initialCompose ? 'compose' : 'list');
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [emailBody, setEmailBody] = useState<string | undefined>(undefined);
    const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // ------ Compose ------
    const [composeMode, setComposeMode] = useState<ComposeMode>('new');
    const [draft, setDraft] = useState<ComposeDraft>(
        initialCompose
            ? { to: initialCompose.to, cc: '', bcc: '', subject: initialCompose.subject, body: initialCompose.body }
            : { to: '', cc: '', bcc: '', subject: '', body: '' }
    );
    const [composeFiles, setComposeFiles] = useState<File[]>([]);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ------ Selection ------
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // ------ Data ------
    const { data: emails = [], isLoading, refetch: refetchEmails } = useEmails(
        currentFolder === 'starred' ? 'inbox' : currentFolder,
        isConnected
    );

    // ------ IMAP Folders (real folders from Infomaniak) ------
    // Using direct fetch instead of React Query to avoid timing/enabled issues
    const [imapFolders, setImapFolders] = useState<{ name: string; unseen: number }[]>([]);
    const [isFoldersLoading, setIsFoldersLoading] = useState(false);

    useEffect(() => {
        if (!isConnected) {
            setImapFolders([]);
            return;
        }

        let cancelled = false;
        setIsFoldersLoading(true);

        apiFetch('/api/v1/email/folders')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!cancelled) {
                    const folders = (data.folders || []) as { name: string; unseen: number }[];
                    setImapFolders(folders);
                }
            })
            .catch(() => {
                if (!cancelled) setImapFolders([]);
            })
            .finally(() => {
                if (!cancelled) setIsFoldersLoading(false);
            });

        return () => { cancelled = true; };
    }, [isConnected]);

    // Filter starred emails client-side, then by search
    const filteredEmails = (() => {
        let result = currentFolder === 'starred'
            ? emails.filter(e => e.isStarred)
            : emails;

        // Apply search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e =>
                e.subject.toLowerCase().includes(q) ||
                e.from.toLowerCase().includes(q) ||
                (e.snippet || '').toLowerCase().includes(q)
            );
        }

        return result;
    })();

    // ------ Mutations ------
    const sendMutation = useSendEmail();
    const deleteMutation = useDeleteEmail();
    const markReadMutation = useMarkRead();
    const draftMutation = useSaveDraft();
    const aiReplyMutation = useEmailAIReply();
    const aiSummarizeMutation = useEmailAISummarize();

    // Folder change
    useEffect(() => {
        if (isConnected) {
            queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
        }
        setSelectedIds(new Set());
    }, [currentFolder, isConnected]);

    // ------ Signature Eonora Tech ------
    // The HTML signature uses cid:marionweb_logo for the logo image.
    // The backend attaches the actual logo PNG as an inline CID attachment.
    const SIGNATURE_HTML = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;color:#334155;font-size:14px;line-height:1.6">
  <tr>
    <td style="padding-bottom:10px">
      <img src="cid:marionweb_logo" alt="Eonora Tech" width="22" height="20" style="vertical-align:middle;margin-right:6px" />
      <span style="font-size:18px;font-weight:700;color:#334155">Eonora Tech</span>
    </td>
  </tr>
  <tr><td style="padding-bottom:4px"><a href="tel:+41799404847" style="color:#334155;text-decoration:none">+41 79 940 48 47</a></td></tr>
  <tr><td style="padding-bottom:16px"><a href="https://eonoratech.ch/" style="color:#334155;text-decoration:none">https://eonoratech.ch/</a></td></tr>
  <tr>
    <td style="font-size:11px;color:#94a3b8;line-height:1.5;max-width:600px">
      CONFIDENTIALITY NOTICE : This email and any documents or files attached to it may contain confidential information that is legally privileged. In particular, please note that our e-mail messages may originate or be delivered in Switzerland. Article 50 of the Swiss Law on Telecommunications provides that the dissemination or use of non-public information received in error is punishable by up to one year imprisonment. Do not read this e-mail if you are not the intended recipient. If you have received this transmission in error, please immediately notify us by reply e-mail and confirm that you have destroyed the transmission and its attachments. Thank you.
    </td>
  </tr>
</table>`;

    const SIGNATURE_PLAIN = `\n\n--\nEonora Tech\n+41 79 940 48 47\nhttps://eonoratech.ch/`;

    const getSignatureText = useCallback((): string => {
        return SIGNATURE_PLAIN;
    }, []);

    const getSignatureHtml = useCallback((): string => {
        return SIGNATURE_HTML;
    }, []);

    // ====== HANDLERS ======

    const handleLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            await connectMutation.mutateAsync({ username: emailInput, password: passwordInput });
            setPasswordInput('');
            addNotification('Email', 'Connecte avec succes.', 'success');
            if (!initialCompose) {
                queryClient.invalidateQueries({ queryKey: emailKeys.list('inbox') });
            }
        } catch (err: any) {
            setLoginError(err.message || 'Identifiants invalides');
        }
    }, [emailInput, passwordInput, connectMutation, addNotification, initialCompose, queryClient]);

    const handleLogout = useCallback(async () => {
        await disconnectMutation.mutateAsync();
        setPasswordInput('');
        addNotification('Email', 'Deconnecte.', 'info');
    }, [disconnectMutation, addNotification]);

    const handleOpenEmail = useCallback(async (mail: EmailMessage) => {
        setSelectedEmail(mail);
        setEmailBody(undefined);
        setEmailAttachments([]);
        setAiSummary(null);
        setView('read');

        if (mail.isUnread) {
            markReadMutation.mutate({ id: mail.id, folder: currentFolder });
        }

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
    }, [currentFolder, markReadMutation]);

    const handleCompose = useCallback(() => {
        setComposeMode('new');
        setDraft({ to: clientEmail || '', cc: '', bcc: '', subject: '', body: '' });
        setComposeFiles([]);
        setShowCc(false);
        setShowBcc(false);
        setView('compose');
    }, [clientEmail]);

    const handleReply = useCallback(() => {
        if (!selectedEmail) return;
        setComposeMode('reply');
        const quoted = `\n\n\n--- Le ${new Date(selectedEmail.date).toLocaleString()} ---\n${selectedEmail.snippet}`;
        setDraft({
            to: selectedEmail.from.replace(/<.*?>/g, '').trim(),
            cc: '',
            bcc: '',
            subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            body: quoted,
        });
        setComposeFiles([]);
        setShowCc(false);
        setShowBcc(false);
        setView('compose');
    }, [selectedEmail]);

    const handleReplyAll = useCallback(() => {
        if (!selectedEmail) return;
        setComposeMode('replyAll');
        const quoted = `\n\n\n--- Le ${new Date(selectedEmail.date).toLocaleString()} ---\n${selectedEmail.snippet}`;
        const from = selectedEmail.from.replace(/<.*?>/g, '').trim();
        const toAddresses = (selectedEmail.to || '').split(',').map(s => s.trim()).filter(Boolean);
        // Remove ourselves from the CC
        const ccAddresses = toAddresses.filter(addr => addr !== connectedUsername && !addr.includes(connectedUsername));

        setDraft({
            to: from,
            cc: ccAddresses.join(', '),
            bcc: '',
            subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            body: quoted,
        });
        setComposeFiles([]);
        setShowCc(ccAddresses.length > 0);
        setShowBcc(false);
        setView('compose');
    }, [selectedEmail, connectedUsername]);

    const handleForward = useCallback(() => {
        if (!selectedEmail) return;
        setComposeMode('forward');
        const fwd = `\n\n\n---------- Message transféré ----------\nDe : ${selectedEmail.from}\nDate : ${new Date(selectedEmail.date).toLocaleString()}\nSujet : ${selectedEmail.subject}\nÀ : ${selectedEmail.to || ''}\n\n${emailBody || selectedEmail.snippet}`;
        setDraft({
            to: '',
            cc: '',
            bcc: '',
            subject: selectedEmail.subject.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`,
            body: fwd,
        });
        setComposeFiles([]);
        setShowCc(false);
        setShowBcc(false);
        setView('compose');
    }, [selectedEmail, emailBody]);

    const handleDelete = useCallback(async (emailOrIds?: EmailMessage | string[]) => {
        const ids = Array.isArray(emailOrIds)
            ? emailOrIds
            : emailOrIds
                ? [emailOrIds.id]
                : selectedEmail ? [selectedEmail.id] : [];

        if (ids.length === 0) return;

        try {
            for (const id of ids) {
                await deleteMutation.mutateAsync({ id, folder: currentFolder });
            }
            addNotification('Email', ids.length > 1 ? `${ids.length} emails supprimés.` : 'Email supprimé.', 'success');
            if (!Array.isArray(emailOrIds)) {
                setView('list');
                setSelectedEmail(null);
            }
            setSelectedIds(new Set());
        } catch (err: any) {
            addNotification('Email', err.message || 'Erreur de suppression.', 'error');
        }
    }, [selectedEmail, currentFolder, deleteMutation, addNotification]);

    const handleSend = useCallback(async () => {
        try {
            await sendMutation.mutateAsync({
                to: draft.to,
                subject: draft.subject,
                body: draft.body,
                signatureHtml: getSignatureHtml(),
                attachments: composeFiles.length > 0 ? composeFiles : undefined,
            });
            addNotification('Email', `Email envoyé à ${draft.to} !`, 'success');
            setComposeFiles([]);
            setView('list');
        } catch (err: any) {
            addNotification('Email', err.message || "Erreur lors de l'envoi.", 'error');
        }
    }, [draft, composeFiles, sendMutation, addNotification, getSignatureHtml]);

    const handleSaveDraft = useCallback(async () => {
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
    }, [draft, draftMutation, addNotification]);

    const handleMarkUnread = useCallback(async (mail?: EmailMessage) => {
        const target = mail || selectedEmail;
        if (!target) return;
        try {
            await apiFetch('/api/v1/email/mark_unread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: target.id, folder: currentFolder }),
            });
            queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
            addNotification('Email', 'Marqué comme non lu.', 'info');
            if (!mail) {
                setView('list');
                setSelectedEmail(null);
            }
        } catch {
            addNotification('Email', 'Erreur.', 'error');
        }
    }, [selectedEmail, currentFolder, queryClient, addNotification]);

    const handleStar = useCallback(async (mail?: EmailMessage) => {
        const target = mail || selectedEmail;
        if (!target) return;
        try {
            await apiFetch('/api/v1/email/star', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: target.id, folder: currentFolder }),
            });
            queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
        } catch {
            addNotification('Email', 'Erreur.', 'error');
        }
    }, [selectedEmail, currentFolder, queryClient, addNotification]);

    const handleUnstar = useCallback(async (mail?: EmailMessage) => {
        const target = mail || selectedEmail;
        if (!target) return;
        try {
            await apiFetch('/api/v1/email/unstar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: target.id, folder: currentFolder }),
            });
            queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
        } catch {
            addNotification('Email', 'Erreur.', 'error');
        }
    }, [selectedEmail, currentFolder, queryClient, addNotification]);

    const handleMove = useCallback(async (toFolder: string, ids?: string[]) => {
        const targetIds = ids || (selectedEmail ? [selectedEmail.id] : []);
        if (targetIds.length === 0) return;
        try {
            for (const id of targetIds) {
                await apiFetch('/api/v1/email/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, fromFolder: currentFolder, toFolder }),
                });
            }
            queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
            queryClient.invalidateQueries({ queryKey: emailKeys.list(toFolder) });
            addNotification('Email', targetIds.length > 1 ? `${targetIds.length} emails déplacés.` : 'Email déplacé.', 'success');
            setView('list');
            setSelectedEmail(null);
            setSelectedIds(new Set());
        } catch {
            addNotification('Email', 'Erreur de déplacement.', 'error');
        }
    }, [selectedEmail, currentFolder, queryClient, addNotification]);

    const handleDownloadAttachment = useCallback(async (att: EmailAttachment) => {
        if (!selectedEmail) return;
        try {
            const res = await apiFetch('/api/v1/email/attachment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedEmail.id, partIndex: att.partIndex, folder: currentFolder }),
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
    }, [selectedEmail, currentFolder, addNotification]);

    const handleDownloadAllAttachments = useCallback(async () => {
        for (const att of emailAttachments) {
            await handleDownloadAttachment(att);
        }
    }, [emailAttachments, handleDownloadAttachment]);

    const handleAIReply = useCallback(async () => {
        if (!selectedEmail) return;
        try {
            const reply = await aiReplyMutation.mutateAsync({
                originalBody: emailBody || selectedEmail.snippet,
                originalFrom: selectedEmail.from,
                originalSubject: selectedEmail.subject,
            });
            setComposeMode('reply');
            setDraft({
                to: selectedEmail.from.replace(/<.*?>/g, '').trim(),
                cc: '',
                bcc: '',
                subject: `Re: ${selectedEmail.subject}`,
                body: reply,
            });
            setComposeFiles([]);
            setView('compose');
            addNotification('Franck', 'Réponse générée !', 'success');
        } catch {
            addNotification('Franck', 'Impossible de générer la réponse.', 'error');
        }
    }, [selectedEmail, emailBody, aiReplyMutation, addNotification]);

    const handleAISummarize = useCallback(async () => {
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
    }, [selectedEmail, emailBody, aiSummarizeMutation, addNotification]);

    const handlePrint = useCallback(() => {
        if (!selectedEmail || !emailBody) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html><head><title>${selectedEmail.subject}</title>
                <style>body{font-family:system-ui,sans-serif;padding:40px;max-width:800px;margin:0 auto}
                h1{font-size:20px;margin-bottom:8px}
                .meta{color:#666;font-size:13px;margin-bottom:24px;border-bottom:1px solid #ddd;padding-bottom:16px}
                .body{font-size:14px;line-height:1.6}</style></head><body>
                <h1>${selectedEmail.subject}</h1>
                <div class="meta">
                    <div>De : ${selectedEmail.from}</div>
                    <div>À : ${selectedEmail.to || ''}</div>
                    <div>Date : ${new Date(selectedEmail.date).toLocaleString()}</div>
                </div>
                <div class="body">${emailBody}</div>
                </body></html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    }, [selectedEmail, emailBody]);

    // ------ Selection helpers ------
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        if (selectedIds.size === filteredEmails.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEmails.map(e => e.id)));
        }
    }, [filteredEmails, selectedIds]);

    const handleBatchMarkRead = useCallback(async () => {
        const ids = Array.from(selectedIds);
        for (const id of ids) {
            try {
                await apiFetch('/api/v1/email/mark_read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, folder: currentFolder }),
                });
            } catch { /* ignore */ }
        }
        queryClient.invalidateQueries({ queryKey: emailKeys.list(currentFolder) });
        setSelectedIds(new Set());
        addNotification('Email', `${ids.length} emails marqués comme lus.`, 'success');
    }, [selectedIds, currentFolder, queryClient, addNotification]);

    // ------ File helpers ------
    const handleAddFiles = useCallback(() => fileInputRef.current?.click(), []);
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setComposeFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);
    const removeFile = useCallback((idx: number) => {
        setComposeFiles(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const handleDropFiles = useCallback((files: FileList) => {
        setComposeFiles(prev => [...prev, ...Array.from(files)]);
    }, []);

    return {
        // Props
        fullscreen: props.fullscreen ?? false,
        clientEmail,
        // Connection
        isConnected,
        connectedUsername,
        emailInput, setEmailInput,
        passwordInput, setPasswordInput,
        loginError,
        connectMutation,
        handleLogin,
        handleLogout,
        // Navigation
        currentFolder, setCurrentFolder,
        view, setView,
        selectedEmail, setSelectedEmail,
        emailBody,
        emailAttachments,
        aiSummary, setAiSummary,
        // IMAP folders
        imapFolders,
        isFoldersLoading,
        // Data
        emails: filteredEmails,
        isLoading,
        refetchEmails,
        // Compose
        composeMode,
        draft, setDraft,
        composeFiles, setComposeFiles,
        showCc, setShowCc,
        showBcc, setShowBcc,
        fileInputRef,
        // Selection
        selectedIds,
        toggleSelect,
        selectAll,
        searchQuery, setSearchQuery,
        // Handlers
        handleOpenEmail,
        handleCompose,
        handleReply,
        handleReplyAll,
        handleForward,
        handleDelete,
        handleSend,
        handleSaveDraft,
        handleMarkUnread,
        handleStar,
        handleUnstar,
        handleMove,
        handleDownloadAttachment,
        handleDownloadAllAttachments,
        handleAIReply,
        handleAISummarize,
        handlePrint,
        handleBatchMarkRead,
        handleAddFiles,
        handleFileChange,
        handleDropFiles,
        removeFile,
        // Mutation states
        sendMutation,
        deleteMutation,
        draftMutation,
        aiReplyMutation,
        aiSummarizeMutation,
    };
}

export type EmailWidgetState = ReturnType<typeof useEmailWidget>;
