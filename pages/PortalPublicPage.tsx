/**
 * PortalPublicPage - Standalone public client portal.
 *
 * This page is rendered at /portal/:token, completely outside the main App layout.
 * It has its own authentication (PIN), its own design, and is mobile-first.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    CheckCircle, Circle, Clock, Send, Upload, File, Image, FileText,
    ExternalLink, MessageSquare, ChevronDown, Loader2, Lock, X, Paperclip,
    Eye, Globe, Figma, ArrowRight, AlertCircle, Download, User,
    CreditCard, FileCheck, Shield, Calendar, DollarSign, Mail,
} from 'lucide-react';
import { WorkflowPhase } from '../types';
import { WorkflowTimeline } from '../components/WorkflowTimeline';
import { WORKFLOW_CONFIG } from '../constants';
import { Language, portalT, DATE_LOCALES } from '../translations/i18n';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = '';  // same origin

const PHASES = Object.values(WorkflowPhase);

const FILE_CATEGORIES_RAW = [
    { value: 'image', labelKey: 'catImage', icon: Image },
    { value: 'logo', labelKey: 'catLogo', icon: Eye },
    { value: 'text', labelKey: 'catText', icon: FileText },
    { value: 'document', labelKey: 'catDocument', icon: File },
    { value: 'other', labelKey: 'catOther', icon: Paperclip },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function portalFetch(url: string, opts: RequestInit = {}) {
    const sessionToken = sessionStorage.getItem('portal_session');
    const headers: Record<string, string> = {
        ...(opts.headers as Record<string, string> || {}),
    };
    if (sessionToken) headers['X-Portal-Token'] = sessionToken;
    if (!(opts.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(`${API_BASE}${url}`, { ...opts, headers });
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

const PortalPublicPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();

    // Auth state
    const [authState, setAuthState] = useState<'loading' | 'pin' | 'authenticated' | 'not_found'>('loading');
    const [hasPin, setHasPin] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [clientNamePreview, setClientNamePreview] = useState('');

    // Portal data
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Smooth scroll to section
    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Lightbox
    const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);

    // Comment form
    const [commentAuthor, setCommentAuthor] = useState('');
    const [commentText, setCommentText] = useState('');
    const [commentSending, setCommentSending] = useState(false);

    // Upload
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploadCategory, setUploadCategory] = useState('other');
    const [uploadNote, setUploadNote] = useState('');
    const [uploadAuthor, setUploadAuthor] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    // Account data is now included in main portal data (data.account)

    // Language - derived from portal settings (returned in API response)
    const lang: Language = (data?.settings?.language as Language) || 'fr';
    const t = portalT[lang];
    const dateLocale = DATE_LOCALES[lang];
    const FILE_CATEGORIES = FILE_CATEGORIES_RAW.map(c => ({ ...c, label: t[c.labelKey] || c.labelKey }));

    // ------ Check portal exists ------
    useEffect(() => {
        if (!token) { setAuthState('not_found'); return; }
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/portal/${token}/check`);
                if (!res.ok) { setAuthState('not_found'); return; }
                const info = await res.json();
                if (!info.exists) { setAuthState('not_found'); return; }
                setHasPin(info.hasPin);
                setClientNamePreview(info.clientName || '');
                // Check if we have a valid session already
                const existing = sessionStorage.getItem('portal_session');
                if (existing) {
                    const testRes = await portalFetch(`/api/v1/portal/${token}`);
                    if (testRes.ok) {
                        setAuthState('authenticated');
                        const d = await testRes.json();
                        setData(d);
                        return;
                    }
                    sessionStorage.removeItem('portal_session');
                }
                if (info.hasPin) {
                    setAuthState('pin');
                } else {
                    // No PIN → auto-authenticate
                    await doAuth('');
                }
            } catch {
                setAuthState('not_found');
            }
        })();
    }, [token]);

    // ------ Auth with PIN ------
    const doAuth = async (pin: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/v1/portal/${token}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: t.incorrectCode }));
                setPinError(err.error || t.incorrectCode);
                return;
            }
            const { sessionToken } = await res.json();
            sessionStorage.setItem('portal_session', sessionToken);
            setAuthState('authenticated');
            await loadPortalData();
        } catch {
            setPinError(t.connectionError);
        }
    };

    // ------ Load data ------
    const loadPortalData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await portalFetch(`/api/v1/portal/${token}`);
            if (res.ok) {
                setData(await res.json());
            }
        } catch { /* silent */ }
        setLoading(false);
    }, [token]);

    // ------ Submit comment ------
    const handleComment = async () => {
        if (!commentAuthor.trim() || !commentText.trim() || !token) return;
        setCommentSending(true);
        try {
            const res = await portalFetch(`/api/v1/portal/${token}/comment`, {
                method: 'POST',
                body: JSON.stringify({ author: commentAuthor, text: commentText }),
            });
            if (res.ok) {
                setCommentText('');
                await loadPortalData();
            }
        } catch { /* silent */ }
        setCommentSending(false);
    };

    // ------ Upload files ------
    const handleUpload = async () => {
        if (uploadFiles.length === 0 || !token) return;
        setUploading(true);
        setUploadProgress(0);
        const total = uploadFiles.length;
        let done = 0;
        for (const file of uploadFiles) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('category', uploadCategory);
            fd.append('note', uploadNote);
            fd.append('authorName', uploadAuthor || 'Client');
            try {
                await portalFetch(`/api/v1/portal/${token}/upload`, { method: 'POST', body: fd });
            } catch { /* skip */ }
            done++;
            setUploadProgress(Math.round((done / total) * 100));
        }
        setUploadFiles([]);
        setUploadNote('');
        setUploadProgress(0);
        setUploading(false);
        await loadPortalData();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        setUploadFiles(prev => [...prev, ...files]);
    };

    // ------ Renders ------

    // Not found
    if (authState === 'not_found') {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-md flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="text-red-500" size={32} />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-800 mb-2">{t.notFound}</h1>
                    <p className="text-slate-500">{t.notFoundDesc}</p>
                </div>
            </div>
        );
    }

    // Loading
    if (authState === 'loading') {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
        );
    }

    // PIN entry
    if (authState === 'pin') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 border border-slate-200 bg-white rounded-md flex items-center justify-center mx-auto mb-4">
                            <Lock className="text-slate-500" size={20} />
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight text-slate-800">{t.clientPortal}</h1>
                        {clientNamePreview && <p className="text-slate-500 mt-1">{clientNamePreview}</p>}
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-slate-200">
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{t.accessCode}</label>
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={pinInput}
                            onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                            onKeyDown={e => e.key === 'Enter' && doAuth(pinInput)}
                            placeholder="••••"
                            className="w-full text-center text-2xl tracking-[0.5em] py-3 px-4 bg-white border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all"
                            autoFocus
                        />
                        {pinError && (
                            <p className="text-red-500 text-sm mt-2 text-center">{pinError}</p>
                        )}
                        <button
                            onClick={() => doAuth(pinInput)}
                            disabled={pinInput.length < 4}
                            className="w-full mt-4 py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium rounded-md disabled:opacity-40 transition-all"
                        >
                            {t.accessPortal}
                        </button>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-6">{t.poweredBy} Eonora Tech</p>
                </div>
            </div>
        );
    }

    // Authenticated - show portal
    if (!data) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
        );
    }

    const settings = data.settings || {};
    const currentPhaseIndex = PHASES.indexOf(data.phase);
    const progressPercent = data.progress || ((currentPhaseIndex + 1) / PHASES.length) * 100;

    return (
        <div className="min-h-screen bg-white">
            {/* Header — Brand bar */}
            <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo-eonora-mark.png" alt="Eonora Tech OS" className="w-8 h-8 object-contain" />
                        <span className="font-semibold text-slate-800 text-sm tracking-tight">Eonora Tech OS</span>
                    </div>
                    <nav className="hidden sm:flex items-center gap-0 border-b border-transparent text-sm">
                        {[
                            ...(settings.showAccount ? [{ id: 'section-account', label: t.myAccount }] : []),
                            { id: 'section-overview', label: t.overview },
                            ...(settings.showDeliverables ? [{ id: 'section-deliverables', label: t.deliverables }] : []),
                            { id: 'section-activity', label: t.activity },
                            ...(settings.allowComments ? [{ id: 'section-comments', label: t.comments }] : []),
                            ...(settings.allowUploads ? [{ id: 'section-files', label: t.files }] : []),
                        ].map(sec => (
                            <button
                                key={sec.id}
                                onClick={() => scrollTo(sec.id)}
                                className="px-3 py-2 font-medium text-slate-500 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-all"
                            >
                                {sec.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Project hero */}
            <div className="max-w-5xl mx-auto px-4 pt-8 pb-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{t.projectPortal}</p>
                <h1 className="font-semibold tracking-tight text-2xl sm:text-3xl text-slate-900">
                    {settings.clientName || data.clientName}
                </h1>
                {settings.customMessage && (
                    <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">{settings.customMessage}</p>
                )}
            </div>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">

                {/* ============ MON COMPTE ============ */}
                {settings.showAccount && (
                    <section id="section-account" className="scroll-mt-24 pt-2 space-y-6">
                        <h2 className="font-semibold tracking-tight text-slate-800 text-xl flex items-center gap-2">
                            <User size={20} className="text-slate-400" />
                            {t.myAccount}
                        </h2>

                        {data.account ? (
                            <>
                                {/* ---- Subscription Overview ---- */}
                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                        <Shield size={16} className="text-emerald-500" /> {t.subscriptionMaintenance}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Contract status */}
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                                <FileCheck size={18} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">{t.contract}</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {data.account.maintenance?.hasContract ? (
                                                        <span className="text-emerald-600">{t.active}</span>
                                                    ) : (
                                                        <span className="text-slate-400">{t.notSubscribed}</span>
                                                    )}
                                                </p>
                                                {data.account.maintenance?.contractSignDate && (
                                                    <p className="text-[10px] text-slate-400">
                                                        {t.since} {formatDate(data.account.maintenance.contractSignDate, dateLocale)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Monthly price */}
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                                <CreditCard size={18} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">{t.monthlyRate}</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {data.account.maintenance?.monthlyPrice != null && data.account.maintenance.monthlyPrice > 0
                                                        ? `${data.account.maintenance.monthlyPrice.toLocaleString(dateLocale)} ${t.perMonth}`
                                                        : <span className="text-slate-400">--</span>}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Free maintenance end */}
                                        {data.account.maintenance?.freeMaintenanceEndDate && (
                                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl sm:col-span-2">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                                    <Calendar size={18} className="text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">{t.freeMaintenanceUntil}</p>
                                                    <p className="text-sm font-semibold text-slate-800">
                                                        {formatDate(data.account.maintenance.freeMaintenanceEndDate, dateLocale)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ---- Billing History ---- */}
                                {data.account.invoices?.length > 0 && (
                                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <DollarSign size={16} className="text-emerald-500" /> {t.billingHistory}
                                        </h3>
                                        <div className="overflow-x-auto -mx-2">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-200">
                                                        <th className="pb-2 px-2 font-medium">{t.tableNumber}</th>
                                                        <th className="pb-2 px-2 font-medium">{t.tableDate}</th>
                                                        <th className="pb-2 px-2 font-medium text-right">{t.tableAmount}</th>
                                                        <th className="pb-2 px-2 font-medium text-center">{t.tableStatus}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {data.account.invoices.map((inv: any) => (
                                                        <tr key={inv.id} className="hover:bg-slate-50/50">
                                                            <td className="py-3 px-2 font-medium text-slate-700">{inv.number}</td>
                                                            <td className="py-3 px-2 text-slate-500">{formatDate(inv.date, dateLocale)}</td>
                                                            <td className="py-3 px-2 text-right font-semibold text-slate-800">
                                                                {inv.amount?.toLocaleString(dateLocale)} {inv.currency || 'CHF'}
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                                                    inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                                                    inv.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                                    inv.status === 'Partial' ? 'bg-slate-100 text-blue-700' :
                                                                    'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {inv.status === 'Paid' && <CheckCircle size={12} />}
                                                                    {inv.status === 'Pending' && <Clock size={12} />}
                                                                    {inv.status === 'Paid' ? t.statusPaid :
                                                                     inv.status === 'Pending' ? t.statusPending :
                                                                     inv.status === 'Partial' ? t.statusPartial : t.statusDraft}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ---- Documents ---- */}
                                {data.account.documents?.length > 0 && (
                                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <FileText size={16} className="text-slate-500" /> {t.myDocuments}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {data.account.documents.map((doc: any) => {
                                                const typeConfig: Record<string, { color: string; bg: string; label: string }> = {
                                                    contract: { color: 'text-slate-500', bg: 'bg-slate-100', label: t.typeContract },
                                                    invoice: { color: 'text-emerald-600', bg: 'bg-emerald-100', label: t.typeInvoice },
                                                    quote: { color: 'text-slate-500', bg: 'bg-slate-100', label: t.typeQuote },
                                                    report: { color: 'text-slate-600', bg: 'bg-slate-100', label: t.typeReport },
                                                    other: { color: 'text-slate-600', bg: 'bg-slate-100', label: t.typeOther },
                                                };
                                                const cfg = typeConfig[doc.docType] || typeConfig.other;
                                                return (
                                                    <a
                                                        key={doc.id}
                                                        href={`/api/v1/portal/${token}/document/${doc.id}/download`}
                                                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group"
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                                                            <FileText size={18} className={cfg.color} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 truncate">{doc.title}</p>
                                                            <p className="text-xs text-slate-400">
                                                                <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                                                                {doc.sizeBytes > 0 && <> · {formatSize(doc.sizeBytes)}</>}
                                                            </p>
                                                        </div>
                                                        <Download size={16} className="text-gray-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ---- Contact Support ---- */}
                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                        <Mail size={16} className="text-slate-400" /> {t.needHelp}
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        {t.helpDescription}
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <a
                                            href="mailto:marion@eonoratech.ch"
                                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl hover:shadow-sm transition-all"
                                        >
                                            <Mail size={14} /> marion@eonoratech.ch
                                        </a>
                                        {settings.allowComments && (
                                            <button
                                                onClick={() => scrollTo('section-comments')}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
                                            >
                                                <MessageSquare size={14} /> {t.sendMessage}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </section>
                )}

                {/* ============ OVERVIEW ============ */}
                <div id="section-overview">
                    {/* Timeline */}
                    {settings.showTimeline && (
                        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <WorkflowTimeline currentPhase={data.phase as WorkflowPhase} />
                        </section>
                    )}

                    {/* Tasks */}
                    {settings.showTasks && data.tasks?.length > 0 && (
                        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
                            <h2 className="font-semibold tracking-tight text-slate-800 mb-4">{t.currentTasks}</h2>
                            <div className="space-y-2">
                                {data.tasks.filter((tk: any) => !tk.completed).slice(0, 8).map((task: any) => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                        <Circle size={14} className="text-gray-300 flex-shrink-0" />
                                        <span className="text-sm text-slate-700 flex-1">{task.title}</span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            task.priority === 'High' ? 'bg-red-100 text-red-600' :
                                            task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>{task.priority}</span>
                                    </div>
                                ))}
                                {data.tasks.filter((tk: any) => tk.completed).length > 0 && (
                                    <p className="text-xs text-emerald-500 font-medium mt-2">
                                        {data.tasks.filter((tk: any) => tk.completed).length} {t.completedTasks}
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Recent updates */}
                    {settings.showUpdates && data.updates?.length > 0 && (
                        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
                            <h2 className="font-semibold tracking-tight text-slate-800 mb-4">{t.latestUpdates}</h2>
                            <div className="space-y-4">
                                {data.updates.map((u: any) => (
                                    <div key={u.id} className="border-l-2 border-slate-300 pl-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            {u.phase && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                    {WORKFLOW_CONFIG[u.phase as WorkflowPhase]?.label || u.phase}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-400">{formatDate(u.createdAt, dateLocale)}</span>
                                        </div>
                                        <h3 className="font-semibold text-sm text-slate-800">{u.title}</h3>
                                        {u.content && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{u.content}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* ============ DELIVERABLES ============ */}
                {settings.showDeliverables && (
                    <section id="section-deliverables" className="scroll-mt-24 pt-2">
                        <h2 className="font-semibold tracking-tight text-slate-800 text-xl mb-4">{t.deliverables}</h2>
                        {(!data.deliverables || data.deliverables.length === 0) ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                                <File size={40} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-slate-400">{t.noDeliverablesYet}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {data.deliverables.map((d: any) => {
                                    const imgExts = ['png','jpg','jpeg','gif','webp','svg','bmp'];
                                    const nameExt = (d.originalName || d.filePath || '').split('.').pop()?.toLowerCase() || '';
                                    const isImage = d.filePath && (d.type === 'image' || imgExts.includes(nameExt));
                                    const imgSrc = isImage ? `${API_BASE}/api/v1/portal/${token}/deliverable/${d.id}/download` : null;
                                    const downloadUrl = d.filePath ? `${API_BASE}/api/v1/portal/${token}/deliverable/${d.id}/download?download=1` : null;
                                    return (
                                    <div key={d.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        {/* Thumbnail / preview */}
                                        {imgSrc ? (
                                            <div className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer group"
                                                 onClick={() => setLightbox({ src: imgSrc, title: d.title })}>
                                                <img src={imgSrc} alt={d.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <Eye size={24} className="text-white drop-shadow-sm" />
                                                </div>
                                            </div>
                                        ) : d.thumbnail ? (
                                            <div className="h-40 bg-slate-100 overflow-hidden cursor-pointer group"
                                                 onClick={() => setLightbox({ src: d.thumbnail, title: d.title })}>
                                                <img src={d.thumbnail} alt={d.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            </div>
                                        ) : (
                                            <div className={`h-24 flex items-center justify-center ${
                                                d.type === 'figma' ? 'bg-purple-50' :
                                                d.type === 'website' ? 'bg-blue-50' :
                                                d.type === 'image' ? 'bg-pink-50' :
                                                'bg-slate-50'
                                            }`}>
                                                {d.type === 'figma' ? <Figma size={32} className="text-purple-400" /> :
                                                 d.type === 'website' ? <Globe size={32} className="text-blue-400" /> :
                                                 d.type === 'image' ? <Image size={32} className="text-pink-400" /> :
                                                 <File size={32} className="text-slate-400" />}
                                            </div>
                                        )}
                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[10px] font-semibold uppercase text-slate-400">{d.type}</span>
                                                    <h3 className="font-semibold text-slate-800">{d.title}</h3>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {downloadUrl && (
                                                        <a href={downloadUrl} download
                                                           className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
                                                           title={t.download}>
                                                            <Download size={16} />
                                                        </a>
                                                    )}
                                                    {d.url && (
                                                        <a href={d.url} target="_blank" rel="noopener noreferrer"
                                                           className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors">
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            {d.description && <p className="text-sm text-slate-500 mt-2">{d.description}</p>}
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* ============ ACTIVITY ============ */}
                <section id="section-activity" className="scroll-mt-24 pt-2">
                        <h2 className="font-semibold tracking-tight text-slate-800 text-xl mb-4">{t.activityFeed}</h2>
                        {(() => {
                            // Merge updates + comments into chronological feed
                            const items: any[] = [];
                            (data.updates || []).forEach((u: any) => items.push({ ...u, _type: 'update', _date: u.createdAt }));
                            (data.comments || []).forEach((c: any) => items.push({ ...c, _type: 'comment', _date: c.createdAt }));
                            (data.clientFiles || []).forEach((f: any) => items.push({ ...f, _type: 'file', _date: f.createdAt }));
                            items.sort((a, b) => new Date(b._date || 0).getTime() - new Date(a._date || 0).getTime());

                            if (items.length === 0) {
                                return (
                                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                                        <Clock size={40} className="text-gray-300 mx-auto mb-3" />
                                        <p className="text-slate-400">{t.noActivity}</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-3">
                                    {items.map((item, idx) => (
                                        <div key={`${item._type}-${item.id}-${idx}`}
                                             className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                                    item._type === 'update' ? 'bg-slate-100' :
                                                    item._type === 'file' ? 'bg-slate-100' :
                                                    item.isAdmin ? 'bg-slate-100' : 'bg-slate-100'
                                                }`}>
                                                    {item._type === 'update' ? <ArrowRight size={14} className="text-slate-400" /> :
                                                     item._type === 'file' ? <Upload size={14} className="text-slate-500" /> :
                                                     <MessageSquare size={14} className="text-slate-500" />}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700">
                                                    {item._type === 'update' ? 'Eonora Tech' :
                                                     item._type === 'file' ? (item.authorName || 'Client') :
                                                     item.author}
                                                </span>
                                                <span className="text-[10px] text-slate-400 ml-auto">{formatDate(item._date, dateLocale)}</span>
                                            </div>
                                            <div className="pl-9">
                                                {item._type === 'update' && (
                                                    <>
                                                        <p className="font-medium text-sm text-slate-800">{item.title}</p>
                                                        {item.content && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{item.content}</p>}
                                                    </>
                                                )}
                                                {item._type === 'comment' && (
                                                    <p className="text-sm text-slate-600">{item.text}</p>
                                                )}
                                                {item._type === 'file' && (
                                                    <div className="flex items-center gap-2">
                                                        <File size={14} className="text-slate-400" />
                                                        <span className="text-sm text-slate-700">{item.originalName}</span>
                                                        <span className="text-xs text-slate-400">{formatSize(item.sizeBytes || 0)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                </section>

                {/* ============ COMMENTS ============ */}
                {settings.allowComments && (
                    <section id="section-comments" className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm scroll-mt-24">
                        <h2 className="font-semibold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
                            <MessageSquare size={18} className="text-slate-400" />
                            {t.comments} ({data.comments?.length || 0})
                        </h2>
                        {/* Comment list */}
                        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                            {(data.comments || []).map((c: any) => (
                                <div key={c.id} className={`p-3 rounded-xl ${c.isAdmin ? 'bg-slate-50 border border-slate-200' : 'bg-slate-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                                            c.isAdmin ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {c.author?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <span className="text-sm font-semibold text-slate-700">{c.author}</span>
                                        {c.isAdmin && <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Eonora Tech</span>}
                                        <span className="text-[10px] text-slate-400 ml-auto">{formatDate(c.createdAt, dateLocale)}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 pl-8">{c.text}</p>
                                </div>
                            ))}
                            {(!data.comments || data.comments.length === 0) && (
                                <p className="text-sm text-slate-400 text-center py-4 italic">{t.noCommentsYet}</p>
                            )}
                        </div>
                        {/* New comment form */}
                        <div className="border-t border-slate-200 pt-4">
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={commentAuthor}
                                    onChange={e => setCommentAuthor(e.target.value)}
                                    placeholder={t.yourName}
                                    className="w-36 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-400"
                                />
                                <input
                                    type="text"
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                                    placeholder={t.yourMessage}
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-400"
                                />
                                <button
                                    onClick={handleComment}
                                    disabled={commentSending || !commentText.trim() || !commentAuthor.trim()}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-xl hover:shadow-md disabled:opacity-40 transition-all"
                                >
                                    {commentSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ============ FILES (Upload) ============ */}
                {settings.allowUploads && (
                    <section id="section-files" className="space-y-6 scroll-mt-24">
                        <h2 className="font-semibold tracking-tight text-slate-800 text-xl">{t.sendFiles}</h2>

                        {/* Upload zone */}
                        <div
                            className={`bg-white rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                                dragOver ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                            }`}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={e => {
                                    const files = Array.from(e.target.files || []);
                                    setUploadFiles(prev => [...prev, ...files]);
                                    e.target.value = '';
                                }}
                            />
                            <Upload size={40} className={`mx-auto mb-3 ${dragOver ? 'text-slate-400' : 'text-gray-300'}`} />
                            <p className="text-slate-600 font-medium">{t.dropFilesHere}</p>
                            <p className="text-xs text-slate-400 mt-1">{t.orClickToSelect}</p>
                        </div>

                        {/* Selected files */}
                        {uploadFiles.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                                <h3 className="text-sm font-semibold text-slate-600">{t.selectedFiles} ({uploadFiles.length})</h3>
                                <div className="space-y-2">
                                    {uploadFiles.map((f, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                                            <File size={14} className="text-slate-400" />
                                            <span className="flex-1 text-slate-700 truncate">{f.name}</span>
                                            <span className="text-xs text-slate-400">{formatSize(f.size)}</span>
                                            <button onClick={(e) => { e.stopPropagation(); setUploadFiles(prev => prev.filter((_, i) => i !== idx)); }}
                                                    className="text-slate-400 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.category}</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {FILE_CATEGORIES.map(cat => (
                                            <button
                                                key={cat.value}
                                                onClick={() => setUploadCategory(cat.value)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                                    uploadCategory === cat.value
                                                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                                        : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <cat.icon size={12} /> {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Author & Note */}
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={uploadAuthor}
                                        onChange={e => setUploadAuthor(e.target.value)}
                                        placeholder={t.yourName}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={uploadNote}
                                        onChange={e => setUploadNote(e.target.value)}
                                        placeholder={t.noteOptional}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-400"
                                    />
                                </div>

                                {/* Progress + Send */}
                                {uploading && (
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-800 rounded-full transition-all"
                                             style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                )}
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading || uploadFiles.length === 0}
                                    className="w-full py-3 bg-slate-900 hover:bg-slate-700 text-white font-semibold rounded-xl hover:shadow-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                >
                                    {uploading ? (
                                        <><Loader2 size={16} className="animate-spin" /> {t.uploadingProgress} {uploadProgress}%</>
                                    ) : (
                                        <><Upload size={16} /> {t.sendNFiles.replace('{n}', String(uploadFiles.length)).replace('{s}', uploadFiles.length > 1 ? 's' : '')}</>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Already uploaded files */}
                        {data.clientFiles?.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                <h3 className="text-sm font-semibold text-slate-600 mb-3">{t.filesAlreadySent}</h3>
                                <div className="space-y-2">
                                    {data.clientFiles.map((f: any) => (
                                        <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                f.category === 'image' || f.category === 'logo' ? 'bg-pink-100' :
                                                f.category === 'document' ? 'bg-slate-100' :
                                                f.category === 'text' ? 'bg-yellow-100' :
                                                'bg-slate-100'
                                            }`}>
                                                {f.category === 'image' || f.category === 'logo' ? <Image size={14} className="text-pink-500" /> :
                                                 f.category === 'document' ? <FileText size={14} className="text-slate-500" /> :
                                                 <File size={14} className="text-slate-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 truncate">{f.originalName}</p>
                                                <p className="text-xs text-slate-400">{formatSize(f.sizeBytes)} · {formatDate(f.createdAt, dateLocale)}</p>
                                            </div>
                                            <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 mt-12 py-6 text-center">
                <p className="text-xs text-slate-400">
                    {t.poweredBy}{' '}
                    <a href="https://eonoratech.ch" target="_blank" rel="noopener noreferrer"
                       className="text-slate-400 hover:underline font-medium">
                        Eonora Tech
                    </a>
                </p>
            </footer>

            {/* ============ LIGHTBOX ============ */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]"
                    onClick={() => setLightbox(null)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setLightbox(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    >
                        <X size={24} />
                    </button>

                    {/* Title */}
                    <div className="absolute top-4 left-4 text-white">
                        <h3 className="font-semibold text-lg drop-shadow-sm">{lightbox.title}</h3>
                    </div>

                    {/* Download button */}
                    <a
                        href={`${lightbox.src}${lightbox.src.includes('?') ? '&' : '?'}download=1`}
                        download
                        onClick={e => e.stopPropagation()}
                        className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-medium transition-colors"
                    >
                        <Download size={16} /> {t.download}
                    </a>

                    {/* Image */}
                    <img
                        src={lightbox.src}
                        alt={lightbox.title}
                        onClick={e => e.stopPropagation()}
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
};

export default PortalPublicPage;
