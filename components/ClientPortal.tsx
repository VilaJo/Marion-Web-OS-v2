/**
 * ClientPortal - Admin-side portal management.
 *
 * Sections:
 *   1. Configuration (toggle, PIN, share link, toggles per feature)
 *   2. Livrables (CRUD with type, URL, description, visibility)
 *   3. Updates (progress journal entries)
 *   4. Commentaires (client comments + admin replies)
 *   5. Fichiers reçus (files uploaded by client)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Project, WorkflowPhase, ClientPortalSettings, PortalDeliverable, PortalUpdate, PortalClientFile, ClientPortalComment, PortalDocument, PortalDocumentType } from '../types';
import { Card, Badge, Modal } from './Shared';
import {
    Link2, Copy, Check, Eye, EyeOff, MessageSquare, Settings, ExternalLink,
    Send, Plus, Trash2, Edit3, GripVertical, Globe, Image, File, FileText,
    Figma, Upload, Download, CheckCircle, Clock, Circle, RefreshCw,
    AlertCircle, X, ChevronDown, ChevronUp, Lock, Shield, Monitor, ArrowRight,
    CreditCard, FileCheck, Calendar, DollarSign, Mail, User,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { WORKFLOW_CONFIG } from '../constants';
import { WorkflowTimeline } from './WorkflowTimeline';
import { Language, LANGUAGE_OPTIONS, portalT, DATE_LOCALES } from '../translations/i18n';
import { useAppConfig, useTunnelStatus } from '../hooks/useAppConfig';

declare const confetti: any;

interface ClientPortalProps {
    project: Project;
    onUpdateProject: (project: Project) => void;
    onNotify: (title: string, message: string, type?: any) => void;
}

const generateShareToken = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;

const generatePin = () =>
    String(Math.floor(1000 + Math.random() * 9000));

const DELIVERABLE_TYPES_RAW = [
    { value: 'website', labelKey: 'typeWebsite', icon: Globe },
    { value: 'figma', labelKey: 'typeFigma', icon: Figma },
    { value: 'image', labelKey: 'typeImage', icon: Image },
    { value: 'link', labelKey: 'typeLink', icon: Link2 },
    { value: 'file', labelKey: 'typeFile', icon: File },
] as const;

const PHASES = Object.values(WorkflowPhase);

function formatDate(dateStr?: string, locale = 'fr-CH'): string {
    if (!dateStr) return '';
    try {
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(new Date(dateStr));
    } catch { return dateStr; }
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({ project, onUpdateProject, onNotify }) => {
    // ---- Portal settings ----
    const portalSettings: ClientPortalSettings = project.portalSettings || {
        enabled: false,
        shareToken: generateShareToken(),
        pin: '',
        showTasks: true,
        showTimeline: true,
        allowComments: true,
        showDeliverables: true,
        showUpdates: true,
        allowUploads: true,
    };

    // ---- Language ----
    const lang: Language = portalSettings.language || 'fr';
    const t = portalT[lang];

    // ---- State ----
    const [activeSection, setActiveSection] = useState<'preview' | 'config' | 'deliverables' | 'updates' | 'comments' | 'files' | 'documents'>('preview');
    const [copied, setCopied] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Deliverables
    const [deliverables, setDeliverables] = useState<PortalDeliverable[]>([]);
    const [showDeliverableModal, setShowDeliverableModal] = useState(false);
    const [editingDeliverable, setEditingDeliverable] = useState<Partial<PortalDeliverable> | null>(null);
    const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
    const [uploadingDeliverable, setUploadingDeliverable] = useState(false);

    // Updates
    const [updates, setUpdates] = useState<PortalUpdate[]>([]);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [editingUpdate, setEditingUpdate] = useState<Partial<PortalUpdate>>({ title: '', content: '', phase: '' });

    // Comments
    const [comments, setComments] = useState<ClientPortalComment[]>([]);
    const [replyText, setReplyText] = useState('');
    const [unseenComments, setUnseenComments] = useState(0);

    // Client files
    const [clientFiles, setClientFiles] = useState<PortalClientFile[]>([]);
    const [unseenFiles, setUnseenFiles] = useState(0);

    // Portal documents
    const [portalDocuments, setPortalDocuments] = useState<PortalDocument[]>([]);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docTitle, setDocTitle] = useState('');
    const [docType, setDocType] = useState<PortalDocumentType>('other');
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // ---- URL ----
    // Prefer the Cloudflare Tunnel public URL when configured so the link Marion
    // copies actually works for the client outside her own Mac (127.0.0.1).
    const { publicBaseUrl } = useAppConfig();
    const tunnelStatus = useTunnelStatus();
    const portalOrigin = publicBaseUrl || window.location.origin;
    const portalUrl = `${portalOrigin}/portal/${portalSettings.shareToken}`;
    const isLocalPreviewOnly = !publicBaseUrl;
    const isTunnelDown = !!publicBaseUrl && !tunnelStatus.running;
    const isTunnelUp = !!publicBaseUrl && tunnelStatus.running;

    // ---- Load data ----
    const loadPortalData = useCallback(async () => {
        const pid = project.id;
        try {
            const [delRes, updRes, comRes, filRes, unseenRes, docRes] = await Promise.all([
                apiFetch(`/api/v1/portal/deliverables/${pid}`),
                apiFetch(`/api/v1/portal/updates/${pid}`),
                apiFetch(`/api/v1/portal/comments/${pid}`),
                apiFetch(`/api/v1/portal/client-files/${pid}`),
                apiFetch(`/api/v1/portal/unseen/${pid}`),
                apiFetch(`/api/v1/portal/documents/${pid}`),
            ]);
            if (delRes.ok) setDeliverables(await delRes.json());
            if (updRes.ok) setUpdates(await updRes.json());
            if (comRes.ok) setComments(await comRes.json());
            if (filRes.ok) setClientFiles(await filRes.json());
            if (unseenRes.ok) {
                const u = await unseenRes.json();
                setUnseenComments(u.comments || 0);
                setUnseenFiles(u.files || 0);
            }
            if (docRes.ok) setPortalDocuments(await docRes.json());
        } catch { /* silent */ }
    }, [project.id]);

    useEffect(() => { loadPortalData(); }, [loadPortalData]);

    // ---- Settings helpers ----
    const handleUpdateSettings = (key: keyof ClientPortalSettings, value: any) => {
        const newSettings = { ...portalSettings, [key]: value };
        onUpdateProject({ ...project, portalSettings: newSettings });
    };

    const handleTogglePortal = () => {
        const newSettings = { ...portalSettings, enabled: !portalSettings.enabled };
        if (!newSettings.shareToken) newSettings.shareToken = generateShareToken();
        onUpdateProject({ ...project, portalSettings: newSettings });
        if (!portalSettings.enabled) {
            onNotify(t.portalEnabled, t.portalEnabledMsg.replace('{name}', project.clientName), 'success');
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(portalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        try { confetti?.({ particleCount: 20, spread: 40, origin: { y: 0.7 } }); } catch {}
    };

    const handleRegenerateLink = () => {
        handleUpdateSettings('shareToken', generateShareToken());
        onNotify(t.linkRegenerated, t.newLinkCreated, 'info');
    };

    const handleGeneratePin = () => {
        const pin = generatePin();
        handleUpdateSettings('pin', pin);
        onNotify(t.pinCodeNotif, t.newCode.replace('{pin}', pin), 'info');
    };

    const handleSetPin = (newSettings: ClientPortalSettings) => {
        onUpdateProject({ ...project, portalSettings: newSettings });
        // Also persist the pin hash to the backend
        apiFetch('/api/v1/projects/save', {
            method: 'POST',
            body: JSON.stringify({
                ...project,
                portalSettings: newSettings,
            }),
        }).catch(() => {});
    };

    // ---- Deliverable CRUD ----
    const handleSaveDeliverable = async () => {
        if (!editingDeliverable?.title) return;
        setUploadingDeliverable(true);
        try {
            let res: Response;
            if (deliverableFile) {
                // Use FormData for file upload
                const fd = new FormData();
                fd.append('projectId', String(project.id));
                fd.append('type', editingDeliverable.type || 'file');
                fd.append('title', editingDeliverable.title || '');
                fd.append('url', editingDeliverable.url || '');
                fd.append('description', editingDeliverable.description || '');
                fd.append('visible', editingDeliverable.visible !== false ? 'true' : 'false');
                fd.append('sortOrder', String(editingDeliverable.sortOrder || 0));
                if (editingDeliverable.id) fd.append('id', String(editingDeliverable.id));
                fd.append('file', deliverableFile);

                const token = sessionStorage.getItem('marion_token');
                res = await fetch('/api/v1/portal/deliverable', {
                    method: 'POST',
                    headers: { 'X-Marion-Token': token || '' },
                    body: fd,
                });
            } else {
                res = await apiFetch('/api/v1/portal/deliverable', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...editingDeliverable,
                        projectId: project.id,
                    }),
                });
            }
            if (res.ok) {
                setShowDeliverableModal(false);
                setEditingDeliverable(null);
                setDeliverableFile(null);
                await loadPortalData();
                onNotify(t.deliverableSaved, editingDeliverable.title, 'success');
            }
        } catch {}
        setUploadingDeliverable(false);
    };

    const handleDeleteDeliverable = async (id: number) => {
        try {
            await apiFetch(`/api/v1/portal/deliverable/${id}`, { method: 'DELETE' });
            await loadPortalData();
        } catch {}
    };

    // ---- Update CRUD ----
    const handleSaveUpdate = async () => {
        if (!editingUpdate.title) return;
        try {
            const res = await apiFetch('/api/v1/portal/update', {
                method: 'POST',
                body: JSON.stringify({ ...editingUpdate, projectId: project.id }),
            });
            if (res.ok) {
                setShowUpdateModal(false);
                setEditingUpdate({ title: '', content: '', phase: '' });
                await loadPortalData();
                onNotify(t.updatePublished, editingUpdate.title, 'success');
            }
        } catch {}
    };

    const handleDeleteUpdate = async (id: number) => {
        try {
            await apiFetch(`/api/v1/portal/update/${id}`, { method: 'DELETE' });
            await loadPortalData();
        } catch {}
    };

    // ---- Comments ----
    const handleReply = async () => {
        if (!replyText.trim()) return;
        try {
            await apiFetch('/api/v1/portal/comment', {
                method: 'POST',
                body: JSON.stringify({ projectId: project.id, text: replyText, author: 'Eonora Tech' }),
            });
            setReplyText('');
            await loadPortalData();
        } catch {}
    };

    const handleDeleteComment = async (id: number | string) => {
        try {
            await apiFetch(`/api/v1/portal/comment/${id}`, { method: 'DELETE' });
            await loadPortalData();
        } catch {}
    };

    const handleMarkCommentsSeen = async () => {
        try {
            await apiFetch(`/api/v1/portal/comments/${project.id}/seen`, { method: 'POST' });
            setUnseenComments(0);
        } catch {}
    };

    // ---- Client files ----
    const handleMarkFilesSeen = async () => {
        try {
            await apiFetch(`/api/v1/portal/client-files/${project.id}/seen`, { method: 'POST' });
            setUnseenFiles(0);
        } catch {}
    };

    const handleDeleteFile = async (id: number) => {
        try {
            await apiFetch(`/api/v1/portal/client-files/${id}`, { method: 'DELETE' });
            await loadPortalData();
        } catch {}
    };

    const handleDownloadFile = (id: number) => {
        window.open(`/api/v1/portal/client-files/${id}/download?X-Marion-Token=${sessionStorage.getItem('marion_token')}`, '_blank');
    };

    // ---- Document CRUD ----
    const handleUploadDocument = async () => {
        if (!docFile || !docTitle.trim()) return;
        setUploadingDoc(true);
        try {
            const fd = new FormData();
            fd.append('projectId', String(project.id));
            fd.append('title', docTitle.trim());
            fd.append('docType', docType);
            fd.append('file', docFile);
            fd.append('visible', 'true');

            const token = sessionStorage.getItem('marion_token');
            const res = await fetch('/api/v1/portal/document', {
                method: 'POST',
                headers: { 'X-Marion-Token': token || '' },
                body: fd,
            });
            if (res.ok) {
                setDocFile(null);
                setDocTitle('');
                setDocType('other');
                await loadPortalData();
                onNotify(t.documentAdded, t.documentAddedMsg.replace('{title}', docTitle.trim()), 'success');
            }
        } catch {}
        setUploadingDoc(false);
    };

    const handleToggleDocVisibility = async (doc: PortalDocument) => {
        try {
            await apiFetch(`/api/v1/portal/document/${doc.id}`, {
                method: 'PUT',
                body: JSON.stringify({ visible: !doc.visible }),
            });
            await loadPortalData();
        } catch {}
    };

    const handleDeleteDocument = async (id: number) => {
        try {
            await apiFetch(`/api/v1/portal/document/${id}`, { method: 'DELETE' });
            await loadPortalData();
        } catch {}
    };

    const handleDownloadDocument = (id: number) => {
        window.open(`/api/v1/portal/document/${id}/download?X-Marion-Token=${sessionStorage.getItem('marion_token')}`, '_blank');
    };

    // ---- Toggle rendering for settings ----
    const ToggleRow = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: () => void }) => (
        <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
            <div>
                <div className="font-bold text-sm text-slate-700 dark:text-white">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
            </div>
            <button
                onClick={onChange}
                className={`w-12 h-6 rounded-full transition-colors ${value ? 'bg-brand-orange' : 'bg-slate-300'}`}
            >
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );

    // ---- Section tabs ----
    const tabs = [
        { key: 'preview', label: t.clientPreview, icon: Monitor },
        { key: 'config', label: t.configuration, icon: Settings },
        { key: 'deliverables', label: t.deliverables, icon: Globe, count: deliverables.length },
        { key: 'updates', label: t.updates, icon: RefreshCw, count: updates.length },
        { key: 'comments', label: t.comments, icon: MessageSquare, count: comments.length, unseen: unseenComments },
        { key: 'files', label: t.filesReceived, icon: Upload, count: clientFiles.length, unseen: unseenFiles },
        { key: 'documents', label: t.documents, icon: FileText, count: portalDocuments.length },
    ] as const;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Link2 size={20} className="text-brand-orange" />
                        {t.clientPortal}
                    </h3>
                    <p className="text-sm text-slate-500">{t.shareProgress}</p>
                </div>
                <button
                    onClick={handleTogglePortal}
                    className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                        portalSettings.enabled
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                >
                    {portalSettings.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                    {portalSettings.enabled ? t.enabled : t.disabled}
                </button>
            </div>

            {/* Share link */}
            {portalSettings.enabled && (
                <Card className="p-4 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 border-orange-200 dark:border-orange-800">
                    {isLocalPreviewOnly && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                            <AlertCircle size={14} className="flex-shrink-0" />
                            <span className="font-medium">Aperçu local uniquement — activez le tunnel pour un vrai lien client</span>
                        </div>
                    )}
                    {isTunnelDown && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                            <AlertCircle size={14} className="flex-shrink-0" />
                            <span className="font-medium">Lien public inactif — lancez LANCER_PORTAIL_PUBLIC.command</span>
                        </div>
                    )}
                    {isTunnelUp && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                            <CheckCircle size={14} className="flex-shrink-0" />
                            <span className="font-medium">Lien public actif</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.shareLink}</label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
                                <input type="text" value={portalUrl} readOnly
                                    className="flex-1 bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none tabular-nums" />
                                <button onClick={handleCopyLink}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-brand-orange transition-colors">
                                    {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                        <button onClick={handleRegenerateLink}
                            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-brand-orange hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors">
                            {t.regenerate}
                        </button>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                           className="p-2 bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors">
                            <ExternalLink size={18} />
                        </a>
                    </div>
                    {/* PIN display */}
                    <div className="mt-3 flex items-center gap-3">
                        <Shield size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-500">{t.pinCode}</span>
                        {portalSettings.pin ? (
                            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {portalSettings.pin}
                            </span>
                        ) : (
                            <span className="text-xs text-slate-400 italic">{t.noPinFreeAccess}</span>
                        )}
                        <button onClick={handleGeneratePin} className="text-xs text-brand-orange hover:underline font-medium">
                            {portalSettings.pin ? t.changePin : t.setPin}
                        </button>
                        {portalSettings.pin && (
                            <button onClick={() => handleUpdateSettings('pin', '')} className="text-xs text-red-400 hover:underline">
                                {t.removePin}
                            </button>
                        )}
                    </div>
                </Card>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => {
                            setActiveSection(tab.key);
                            if (tab.key === 'comments' && unseenComments > 0) handleMarkCommentsSeen();
                            if (tab.key === 'files' && unseenFiles > 0) handleMarkFilesSeen();
                        }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all relative ${
                            activeSection === tab.key
                                ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {'count' in tab && tab.count! > 0 && (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                        )}
                        {'unseen' in tab && tab.unseen! > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                {tab.unseen}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* =========== PREVIEW =========== */}
            {activeSection === 'preview' && (
                <div className="space-y-4">
                    {/* Preview banner */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                        <Monitor size={14} />
                        <span className="font-medium">{t.previewBanner}</span>
                        {portalSettings.enabled && portalSettings.shareToken && (
                            <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                               className="ml-auto flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                {t.openRealPortal} <ExternalLink size={12} />
                            </a>
                        )}
                    </div>

                    {/* Preview container with portal-like styling */}
                    <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Simulated header */}
                        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-3 flex items-center gap-3">
                            <img src="/logo-eonora.png" alt="Eonora Tech OS" className="w-8 h-8 rounded-lg shadow-sm object-contain" />
                            <div>
                                <h4 className="font-serif font-bold text-slate-800 dark:text-white text-sm leading-tight">
                                    {portalSettings.clientName || project.clientName}
                                </h4>
                                <p className="text-[10px] text-slate-400">{t.projectPortal}</p>
                            </div>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Custom message */}
                            {portalSettings.customMessage && (
                                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl p-3 text-xs text-orange-800 dark:text-orange-300">
                                    {portalSettings.customMessage}
                                </div>
                            )}

                            {/* Mon Compte preview */}
                            {portalSettings.showAccount && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-4">
                                    <span className="font-serif font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                        <User size={12} className="text-orange-500" /> {t.myAccount}
                                    </span>

                                    {/* Subscription overview */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                <FileCheck size={14} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-slate-400">{t.contract}</p>
                                                <p className="text-xs font-bold text-slate-700 dark:text-white">
                                                    {project.maintenance?.hasContract
                                                        ? <span className="text-emerald-600">{t.active}</span>
                                                        : <span className="text-slate-400">--</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                <CreditCard size={14} className="text-purple-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-slate-400">{t.rate}</p>
                                                <p className="text-xs font-bold text-slate-700 dark:text-white">
                                                    {project.maintenance?.monthlyPrice
                                                        ? `${project.maintenance.monthlyPrice} CHF/mois`
                                                        : <span className="text-slate-400">--</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoices preview */}
                                    {project.invoices.length > 0 && (
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">{t.billing}</span>
                                            <div className="space-y-1">
                                                {project.invoices.slice(0, 3).map(inv => (
                                                    <div key={inv.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs">
                                                        <span className="font-bold text-slate-700 dark:text-white">{inv.number}</span>
                                                        <span className="text-slate-400">{inv.amount?.toLocaleString('fr-CH')} {inv.currency || 'CHF'}</span>
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                                            inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            inv.status === 'Pending' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
                                                        }`}>
                                                            {inv.status === 'Paid' ? t.statusPaid : inv.status === 'Pending' ? t.statusPending : inv.status === 'Partial' ? t.statusPartial : t.statusDraft}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Documents preview */}
                                    {portalDocuments.filter(d => d.visible).length > 0 && (
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">{t.documents}</span>
                                            <div className="space-y-1">
                                                {portalDocuments.filter(d => d.visible).slice(0, 3).map(doc => {
                                                    const cfg: Record<string, { color: string; bg: string; label: string }> = {
                                                        contract: { color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: t.typeContract },
                                                        invoice: { color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: t.typeInvoice },
                                                        quote: { color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: t.typeQuote },
                                                        report: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: t.typeReport },
                                                        other: { color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-600', label: t.typeOther },
                                                    };
                                                    const c = cfg[doc.docType] || cfg.other;
                                                    return (
                                                        <div key={doc.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs">
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center ${c.bg}`}>
                                                                <FileText size={10} className={c.color} />
                                                            </div>
                                                            <span className="font-bold text-slate-700 dark:text-white truncate flex-1">{doc.title}</span>
                                                            <Download size={10} className="text-slate-300" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact */}
                                    <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                                        <Mail size={12} className="text-orange-500" />
                                        <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">marion@eonoratech.ch</span>
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            {portalSettings.showTimeline && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                                    <WorkflowTimeline currentPhase={project.phase} compact />
                                </div>
                            )}

                            {/* Tasks preview */}
                            {portalSettings.showTasks && project.tasks.filter(t => !t.completed).length > 0 && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                                    <span className="font-serif font-bold text-sm text-slate-800 dark:text-white block mb-3">{t.currentTasks}</span>
                                    <div className="space-y-1.5">
                                        {project.tasks.filter(t => !t.completed).slice(0, 5).map(task => (
                                            <div key={task.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                                <Circle size={10} className="text-slate-300 flex-shrink-0" />
                                                <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{task.title}</span>
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                                    task.priority === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                                    task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
                                                }`}>{task.priority}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Updates preview */}
                            {portalSettings.showUpdates && updates.length > 0 && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                                    <span className="font-serif font-bold text-sm text-slate-800 dark:text-white block mb-3">{t.latestUpdates}</span>
                                    <div className="space-y-3">
                                        {updates.slice(0, 3).map(u => (
                                            <div key={u.id} className="border-l-2 border-orange-300 pl-3">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {u.phase && (
                                                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                                            {WORKFLOW_CONFIG[u.phase as WorkflowPhase]?.label || u.phase}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-slate-400">{formatDate(u.createdAt)}</span>
                                                </div>
                                                <p className="font-bold text-xs text-slate-800 dark:text-white">{u.title}</p>
                                                {u.content && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{u.content}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Deliverables preview */}
                            {portalSettings.showDeliverables && deliverables.filter(d => d.visible).length > 0 && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                                    <span className="font-serif font-bold text-sm text-slate-800 dark:text-white block mb-3">{t.deliverables}</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {deliverables.filter(d => d.visible).map(d => {
                                            const isImg = d.type === 'image' && d.filePath;
                                            const thumbSrc = isImg ? `/api/v1/portal/deliverable/${d.id}/download?X-Marion-Token=${sessionStorage.getItem('marion_token')}` : null;
                                            return (
                                            <div key={d.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg overflow-hidden">
                                                {thumbSrc ? (
                                                    <img src={thumbSrc} alt={d.title} className="w-full h-24 object-cover" />
                                                ) : (
                                                    <div className={`h-12 flex items-center justify-center ${
                                                        d.type === 'figma' ? 'bg-purple-50 dark:bg-purple-900/20' :
                                                        d.type === 'website' ? 'bg-blue-50 dark:bg-blue-900/20' :
                                                        d.type === 'image' ? 'bg-pink-50 dark:bg-pink-900/20' :
                                                        'bg-slate-100 dark:bg-slate-600'
                                                    }`}>
                                                        {d.type === 'figma' ? <Figma size={16} className="text-purple-400" /> :
                                                         d.type === 'website' ? <Globe size={16} className="text-blue-400" /> :
                                                         d.type === 'image' ? <Image size={16} className="text-pink-400" /> :
                                                         d.type === 'link' ? <Link2 size={16} className="text-orange-400" /> :
                                                         <File size={16} className="text-slate-400" />}
                                                    </div>
                                                )}
                                                <div className="p-2">
                                                    <span className="text-[8px] font-bold uppercase text-slate-400">{d.type}</span>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-white truncate">{d.title}</p>
                                                    {d.description && <p className="text-[9px] text-slate-400 truncate mt-0.5">{d.description}</p>}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Comments preview */}
                            {portalSettings.allowComments && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                                    <span className="font-serif font-bold text-sm text-slate-800 dark:text-white block mb-3 flex items-center gap-1.5">
                                        <MessageSquare size={12} className="text-orange-500" />
                                        {t.commentsCount} ({comments.length})
                                    </span>
                                    {comments.length > 0 ? (
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {comments.slice(-5).map(c => (
                                                <div key={c.id} className={`p-2 rounded-lg text-xs ${c.isAdmin ? 'bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold ${
                                                            c.isAdmin ? 'bg-orange-200 text-orange-700' : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                            {c.author?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span className="font-bold text-slate-700 dark:text-white">{c.author}</span>
                                                        {c.isAdmin && <span className="text-[7px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1 py-0.5 rounded">Marion</span>}
                                                    </div>
                                                    <p className="text-slate-600 dark:text-slate-400 pl-5 line-clamp-2">{c.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic text-center py-3">{t.clientCanComment}</p>
                                    )}
                                </div>
                            )}

                            {/* Upload zone preview */}
                            {portalSettings.allowUploads && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                                    <span className="font-serif font-bold text-sm text-slate-800 dark:text-white block mb-3">{t.fileSending}</span>
                                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-4 text-center">
                                        <Upload size={20} className="mx-auto mb-1 text-slate-300" />
                                        <p className="text-xs text-slate-500">{t.dragDropZone}</p>
                                        <p className="text-[9px] text-slate-400">{t.clientCanDrop}</p>
                                    </div>
                                    {clientFiles.length > 0 && (
                                        <div className="mt-3 space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{t.filesAlreadyReceived}</span>
                                            {clientFiles.slice(0, 3).map(f => (
                                                <div key={f.id} className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs">
                                                    <File size={10} className="text-slate-400" />
                                                    <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{f.originalName}</span>
                                                    <CheckCircle size={10} className="text-emerald-500" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Simulated footer */}
                        <div className="border-t border-slate-100 dark:border-slate-700 py-3 text-center">
                            <p className="text-[9px] text-slate-400">
                                {t.poweredBy} <span className="text-orange-500 font-medium">Eonora Tech</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* =========== CONFIG =========== */}
            {activeSection === 'config' && (
                <Card className="p-4">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-white mb-3">{t.portalVisibility}</h4>
                    <div className="mb-4">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.welcomeMessage}</label>
                        <textarea
                            value={portalSettings.customMessage || ''}
                            onChange={e => handleUpdateSettings('customMessage', e.target.value)}
                            placeholder={t.welcomePlaceholder}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                            rows={2}
                        />
                    </div>
                    <div className="mb-4">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.displayedName}</label>
                        <input
                            type="text"
                            value={portalSettings.clientName || ''}
                            onChange={e => handleUpdateSettings('clientName', e.target.value)}
                            placeholder={project.clientName}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                        />
                    </div>
                    <ToggleRow label={t.timeline} desc={t.timelineDesc} value={portalSettings.showTimeline} onChange={() => handleUpdateSettings('showTimeline', !portalSettings.showTimeline)} />
                    <ToggleRow label={t.tasks} desc={t.tasksDesc} value={portalSettings.showTasks} onChange={() => handleUpdateSettings('showTasks', !portalSettings.showTasks)} />
                    <ToggleRow label={t.deliverablesLabel} desc={t.deliverablesDesc} value={portalSettings.showDeliverables} onChange={() => handleUpdateSettings('showDeliverables', !portalSettings.showDeliverables)} />
                    <ToggleRow label={t.updatesLabel} desc={t.updatesDesc} value={portalSettings.showUpdates} onChange={() => handleUpdateSettings('showUpdates', !portalSettings.showUpdates)} />
                    <ToggleRow label={t.commentsLabel} desc={t.commentsDesc} value={portalSettings.allowComments} onChange={() => handleUpdateSettings('allowComments', !portalSettings.allowComments)} />
                    <ToggleRow label={t.uploadLabel} desc={t.uploadDesc} value={portalSettings.allowUploads} onChange={() => handleUpdateSettings('allowUploads', !portalSettings.allowUploads)} />
                    <ToggleRow label={t.accountLabel} desc={t.accountDesc} value={portalSettings.showAccount || false} onChange={() => handleUpdateSettings('showAccount', !portalSettings.showAccount)} />
                    {/* Language selector */}
                    <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                        <div>
                            <div className="font-bold text-sm text-slate-700 dark:text-white">{t.portalLanguage}</div>
                            <div className="text-xs text-slate-400">{t.portalLanguageDesc}</div>
                        </div>
                        <select
                            value={lang}
                            onChange={e => handleUpdateSettings('language', e.target.value)}
                            className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-bold dark:text-white"
                        >
                            {LANGUAGE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.flag} {opt.label}</option>
                            ))}
                        </select>
                    </div>
                </Card>
            )}

            {/* =========== DELIVERABLES =========== */}
            {activeSection === 'deliverables' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-sm text-slate-700 dark:text-white">{t.deliverables} ({deliverables.length})</h4>
                        <button
                            onClick={() => { setEditingDeliverable({ type: 'website', title: '', url: '', description: '', visible: true, sortOrder: deliverables.length }); setShowDeliverableModal(true); }}
                            className="px-3 py-1.5 bg-brand-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 flex items-center gap-1.5"
                        >
                            <Plus size={14} /> {t.add}
                        </button>
                    </div>
                    {deliverables.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400 text-sm italic">
                            {t.noDeliverables}
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {deliverables.map(d => {
                                const isImage = d.type === 'image' && d.filePath;
                                const imgSrc = isImage ? `/api/v1/portal/deliverable/${d.id}/download?X-Marion-Token=${sessionStorage.getItem('marion_token')}` : null;
                                return (
                                <Card key={d.id} className={`p-3 ${!d.visible ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        {/* Thumbnail or icon */}
                                        {imgSrc ? (
                                            <img src={imgSrc} alt={d.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700" />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                d.type === 'website' ? 'bg-blue-100 text-blue-500' :
                                                d.type === 'figma' ? 'bg-purple-100 text-purple-500' :
                                                d.type === 'image' ? 'bg-pink-100 text-pink-500' :
                                                d.type === 'link' ? 'bg-orange-100 text-orange-500' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                {d.type === 'website' ? <Globe size={18} /> :
                                                 d.type === 'figma' ? <Figma size={18} /> :
                                                 d.type === 'image' ? <Image size={18} /> :
                                                 d.type === 'link' ? <Link2 size={18} /> :
                                                 <File size={18} />}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-700 dark:text-white truncate">{d.title}</span>
                                                <span className="text-[10px] text-slate-400 uppercase">{d.type}</span>
                                                {d.filePath && (
                                                    <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">{t.typeFile}</span>
                                                )}
                                            </div>
                                            {d.url && <p className="text-xs text-slate-400 truncate">{d.url}</p>}
                                            {d.originalName && !d.url && <p className="text-xs text-slate-400 truncate">{d.originalName}</p>}
                                        </div>
                                        {d.filePath && (
                                            <button onClick={() => window.open(`/api/v1/portal/deliverable/${d.id}/download?download=1&X-Marion-Token=${sessionStorage.getItem('marion_token')}`, '_blank')}
                                                className="p-1.5 text-slate-400 hover:text-emerald-500 rounded" title={t.download}>
                                                <Download size={14} />
                                            </button>
                                        )}
                                        <button onClick={() => {
                                            setEditingDeliverable(d);
                                            setDeliverableFile(null);
                                            setShowDeliverableModal(true);
                                        }} className="p-1.5 text-slate-400 hover:text-blue-500 rounded">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteDeliverable(d.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    {/* Description */}
                                    {d.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 ml-0 pl-0 border-t border-slate-100 dark:border-slate-700 pt-2">{d.description}</p>
                                    )}
                                </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* =========== UPDATES =========== */}
            {activeSection === 'updates' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-sm text-slate-700 dark:text-white">{t.updatesLabel} ({updates.length})</h4>
                        <button
                            onClick={() => { setEditingUpdate({ title: '', content: '', phase: project.phase }); setShowUpdateModal(true); }}
                            className="px-3 py-1.5 bg-brand-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 flex items-center gap-1.5"
                        >
                            <Plus size={14} /> {t.publish}
                        </button>
                    </div>
                    {updates.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400 text-sm italic">
                            {t.noUpdates}
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {updates.map(u => (
                                <Card key={u.id} className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {u.phase && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                                        {WORKFLOW_CONFIG[u.phase as WorkflowPhase]?.label || u.phase}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400">{formatDate(u.createdAt)}</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-700 dark:text-white">{u.title}</h4>
                                            {u.content && <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{u.content}</p>}
                                        </div>
                                        <button onClick={() => handleDeleteUpdate(u.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded flex-shrink-0">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* =========== COMMENTS =========== */}
            {activeSection === 'comments' && (
                <div className="space-y-3">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                        <MessageSquare size={14} /> {t.commentsCount} ({comments.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {comments.map(c => (
                            <Card key={c.id} className={`p-3 ${c.isAdmin ? 'border-l-2 border-l-brand-orange' : ''}`}>
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                            c.isAdmin ? 'bg-brand-orange/20 text-brand-orange' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                            {c.author?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 dark:text-white">{c.author}</span>
                                        {c.isAdmin && <Badge color="orange">Marion</Badge>}
                                        {!c.seen && !c.isAdmin && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400">{formatDate(c.createdAt || c.timestamp)}</span>
                                        <button onClick={() => handleDeleteComment(c.id)} className="text-slate-400 hover:text-red-500">
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 pl-8">{c.text}</p>
                            </Card>
                        ))}
                        {comments.length === 0 && (
                            <Card className="p-8 text-center text-slate-400 text-sm italic">{t.noComments}</Card>
                        )}
                    </div>
                    {/* Reply */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleReply()}
                            placeholder={t.replyPlaceholder}
                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                        />
                        <button onClick={handleReply} disabled={!replyText.trim()}
                            className="p-2 bg-brand-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-40">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* =========== FILES RECEIVED =========== */}
            {activeSection === 'files' && (
                <div className="space-y-3">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                        <Upload size={14} /> {t.filesReceived} ({clientFiles.length})
                    </h4>
                    {clientFiles.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400 text-sm italic">
                            {t.noFiles}
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {clientFiles.map(f => (
                                <Card key={f.id} className="p-3 flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        f.category === 'image' || f.category === 'logo' ? 'bg-pink-100 text-pink-500' :
                                        f.category === 'document' ? 'bg-blue-100 text-blue-500' :
                                        f.category === 'text' ? 'bg-yellow-100 text-yellow-600' :
                                        'bg-slate-100 text-slate-500'
                                    }`}>
                                        {f.category === 'image' || f.category === 'logo' ? <Image size={18} /> :
                                         f.category === 'document' ? <FileText size={18} /> :
                                         f.category === 'text' ? <FileText size={18} /> :
                                         <File size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-700 dark:text-white truncate">{f.originalName}</span>
                                            {!f.seen && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span>{formatSize(f.sizeBytes)}</span>
                                            <span>·</span>
                                            <span>{f.authorName || 'Client'}</span>
                                            <span>·</span>
                                            <span>{formatDate(f.createdAt)}</span>
                                        </div>
                                        {f.note && <p className="text-xs text-slate-500 mt-0.5 italic">"{f.note}"</p>}
                                    </div>
                                    <button onClick={() => handleDownloadFile(f.id)}
                                        className="p-1.5 text-slate-400 hover:text-blue-500 rounded">
                                        <Download size={16} />
                                    </button>
                                    <button onClick={() => handleDeleteFile(f.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                                        <Trash2 size={14} />
                                    </button>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* =========== DOCUMENTS =========== */}
            {activeSection === 'documents' && (
                <div className="space-y-4">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                        <FileText size={14} /> {t.portalDocuments} ({portalDocuments.length})
                    </h4>
                    <p className="text-xs text-slate-400">
                        {t.docDescription}
                    </p>

                    {/* Upload form */}
                    <Card className="p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">{t.docTitle}</label>
                                <input
                                    type="text"
                                    value={docTitle}
                                    onChange={e => setDocTitle(e.target.value)}
                                    placeholder={t.docTitlePlaceholder}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">{t.docType}</label>
                                <select
                                    value={docType}
                                    onChange={e => setDocType(e.target.value as PortalDocumentType)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                                >
                                    <option value="contract">{t.typeContract}</option>
                                    <option value="invoice">{t.typeInvoice}</option>
                                    <option value="quote">{t.typeQuote}</option>
                                    <option value="report">{t.typeReport}</option>
                                    <option value="other">{t.typeOther}</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex-1 flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:border-brand-orange transition-colors">
                                <Upload size={16} className="text-slate-400" />
                                <span className="text-sm text-slate-500 truncate">
                                    {docFile ? docFile.name : t.chooseFile}
                                </span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.zip"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            setDocFile(f);
                                            if (!docTitle) setDocTitle(f.name.replace(/\.[^.]+$/, ''));
                                        }
                                    }}
                                />
                            </label>
                            <button
                                onClick={handleUploadDocument}
                                disabled={!docFile || !docTitle.trim() || uploadingDoc}
                                className="px-4 py-2.5 bg-brand-orange text-white text-xs font-bold rounded-lg hover:bg-orange-600 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                            >
                                {uploadingDoc ? <><RefreshCw size={14} className="animate-spin" /> {t.uploading}</> : <><Plus size={14} /> {t.add}</>}
                            </button>
                        </div>
                    </Card>

                    {/* Documents list */}
                    {portalDocuments.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400 text-sm italic">
                            {t.noDocs}
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {portalDocuments.map(doc => {
                                const typeConfig: Record<string, { color: string; bg: string; label: string }> = {
                                    contract: { color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: t.typeContract },
                                    invoice: { color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: t.typeInvoice },
                                    quote: { color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: t.typeQuote },
                                    report: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: t.typeReport },
                                    other: { color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', label: t.typeOther },
                                };
                                const cfg = typeConfig[doc.docType] || typeConfig.other;
                                return (
                                    <Card key={doc.id} className={`p-3 flex items-center gap-3 ${!doc.visible ? 'opacity-50' : ''}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                                            <FileText size={18} className={cfg.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-700 dark:text-white truncate">{doc.title}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <span>{doc.originalName}</span>
                                                <span>·</span>
                                                <span>{formatSize(doc.sizeBytes)}</span>
                                                {doc.uploadedAt && <><span>·</span><span>{formatDate(doc.uploadedAt)}</span></>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleToggleDocVisibility(doc)}
                                            className="p-1.5 text-slate-400 hover:text-brand-orange rounded"
                                            title={doc.visible ? t.hide : t.makeVisible}
                                        >
                                            {doc.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button
                                            onClick={() => handleDownloadDocument(doc.id)}
                                            className="p-1.5 text-slate-400 hover:text-blue-500 rounded"
                                        >
                                            <Download size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDocument(doc.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* =========== DELIVERABLE MODAL =========== */}
            <Modal isOpen={showDeliverableModal} onClose={() => { setShowDeliverableModal(false); setEditingDeliverable(null); setDeliverableFile(null); }} title={editingDeliverable?.id ? t.editDeliverable : t.addDeliverable} width="max-w-lg">
                {editingDeliverable && (
                    <div className="space-y-4 p-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">{t.docType}</label>
                            <div className="flex gap-2 flex-wrap">
                                {DELIVERABLE_TYPES_RAW.map(dt => (
                                    <button key={dt.value}
                                        onClick={() => setEditingDeliverable({ ...editingDeliverable, type: dt.value as any })}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                                            editingDeliverable.type === dt.value
                                                ? 'bg-brand-orange text-white'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}>
                                        <dt.icon size={14} /> {t[dt.labelKey]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">{t.titleRequired}</label>
                            <input type="text" value={editingDeliverable.title || ''}
                                onChange={e => setEditingDeliverable({ ...editingDeliverable, title: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange" />
                        </div>

                        {/* URL or File upload */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">{t.urlOrFile}</label>
                            <input type="url" value={editingDeliverable.url || ''}
                                onChange={e => setEditingDeliverable({ ...editingDeliverable, url: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange" />

                            <div className="flex items-center gap-2 my-2">
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-medium">{t.or}</span>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            </div>

                            {/* File drop zone */}
                            <label
                                className={`flex flex-col items-center gap-1.5 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                                    deliverableFile
                                        ? 'border-brand-orange bg-orange-50 dark:bg-orange-900/10'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-orange hover:bg-orange-50/50 dark:hover:bg-orange-900/5'
                                }`}
                            >
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.pdf,.doc,.docx,.txt,.ai,.eps,.psd,.zip,.rar,.fig"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            setDeliverableFile(f);
                                            // Auto-set title from filename if empty
                                            if (!editingDeliverable.title) {
                                                const nameNoExt = f.name.replace(/\.[^.]+$/, '');
                                                setEditingDeliverable({ ...editingDeliverable, title: nameNoExt });
                                            }
                                            // Auto-set type from extension
                                            const ext = f.name.split('.').pop()?.toLowerCase();
                                            if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                                                setEditingDeliverable(prev => prev ? { ...prev, type: 'image' } : prev);
                                            }
                                        }
                                    }}
                                />
                                {deliverableFile ? (
                                    <div className="flex items-center gap-2 w-full">
                                        {deliverableFile.type.startsWith('image/') ? (
                                            <img src={URL.createObjectURL(deliverableFile)} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <File size={16} className="text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-700 dark:text-white truncate">{deliverableFile.name}</p>
                                            <p className="text-[10px] text-slate-400">{formatSize(deliverableFile.size)}</p>
                                        </div>
                                        <button type="button" onClick={e => { e.preventDefault(); setDeliverableFile(null); }}
                                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors">
                                            <X size={14} className="text-red-500" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={20} className="text-slate-300" />
                                        <span className="text-xs text-slate-500">{t.dropFileHere}</span>
                                        <span className="text-[9px] text-slate-400">{t.fileHint}</span>
                                    </>
                                )}
                            </label>

                            {/* Show existing file if editing */}
                            {editingDeliverable.originalName && !deliverableFile && (
                                <div className="flex items-center gap-2 mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <File size={14} className="text-slate-400" />
                                    <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">{editingDeliverable.originalName}</span>
                                    <CheckCircle size={14} className="text-emerald-500" />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">{t.descriptionLabel}</label>
                            <textarea value={editingDeliverable.description || ''}
                                onChange={e => setEditingDeliverable({ ...editingDeliverable, description: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                                rows={2} />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500">{t.visibleToClient}</label>
                            <button
                                onClick={() => setEditingDeliverable({ ...editingDeliverable, visible: !editingDeliverable.visible })}
                                className={`w-10 h-5 rounded-full transition-colors ${editingDeliverable.visible !== false ? 'bg-brand-orange' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${editingDeliverable.visible !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        <button onClick={handleSaveDeliverable}
                            disabled={!editingDeliverable.title || uploadingDeliverable}
                            className="w-full py-2.5 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                            {uploadingDeliverable && <RefreshCw size={14} className="animate-spin" />}
                            {editingDeliverable.id ? t.save : t.add}
                        </button>
                    </div>
                )}
            </Modal>

            {/* =========== UPDATE MODAL =========== */}
            <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title={t.publishUpdate} width="max-w-lg">
                <div className="space-y-4 p-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.phase}</label>
                        <select value={editingUpdate.phase || ''}
                            onChange={e => setEditingUpdate({ ...editingUpdate, phase: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange">
                            <option value="">{t.noPhase}</option>
                            {PHASES.map(p => (
                                <option key={p} value={p}>{WORKFLOW_CONFIG[p]?.label || p}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.titleRequired}</label>
                        <input type="text" value={editingUpdate.title || ''}
                            onChange={e => setEditingUpdate({ ...editingUpdate, title: e.target.value })}
                            placeholder={t.titlePlaceholder}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.content}</label>
                        <textarea value={editingUpdate.content || ''}
                            onChange={e => setEditingUpdate({ ...editingUpdate, content: e.target.value })}
                            placeholder={t.contentPlaceholder}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                            rows={4} />
                    </div>
                    <button onClick={handleSaveUpdate}
                        disabled={!editingUpdate.title}
                        className="w-full py-2.5 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors">
                        {t.publish}
                    </button>
                </div>
            </Modal>
        </div>
    );
};
