/**
 * EmailReader - Full email reading pane with complete toolbar.
 */

import React from 'react';
import {
    ArrowLeft, Reply, ReplyAll, Forward, Trash2, Archive,
    AlertOctagon, Star, EyeOff, Printer, Download,
    Bot, Sparkles, RefreshCw, Paperclip, FileText, X, MoreHorizontal
} from 'lucide-react';
import { sanitizeHTML } from '../../utils/sanitize';
import type { EmailWidgetState } from './useEmailWidget';

interface Props {
    state: EmailWidgetState;
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EmailReader: React.FC<Props> = ({ state }) => {
    const email = state.selectedEmail!;
    const [showMore, setShowMore] = React.useState(false);

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 shrink-0 overflow-x-auto">
                {/* Back (mobile) */}
                <button
                    onClick={() => state.setView('list')}
                    className="lg:hidden p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors shrink-0"
                >
                    <ArrowLeft size={18} />
                </button>

                {/* Reply */}
                <ToolbarBtn
                    icon={<Reply size={16} />}
                    label="Répondre"
                    onClick={state.handleReply}
                />
                <ToolbarBtn
                    icon={<ReplyAll size={16} />}
                    label="Répondre à tous"
                    onClick={state.handleReplyAll}
                />
                <ToolbarBtn
                    icon={<Forward size={16} />}
                    label="Transférer"
                    onClick={state.handleForward}
                />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" />

                {/* Actions */}
                <ToolbarBtn
                    icon={<Archive size={16} />}
                    label="Archiver"
                    onClick={() => state.handleMove('trash')}
                />
                <ToolbarBtn
                    icon={<AlertOctagon size={16} />}
                    label="Spam"
                    onClick={() => state.handleMove('spam')}
                />
                <ToolbarBtn
                    icon={<Trash2 size={16} />}
                    label="Supprimer"
                    onClick={() => state.handleDelete()}
                    className="hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    isPending={state.deleteMutation.isPending}
                />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" />

                {/* Flags */}
                <ToolbarBtn
                    icon={<EyeOff size={16} />}
                    label="Marquer non lu"
                    onClick={() => state.handleMarkUnread()}
                />
                <ToolbarBtn
                    icon={<Star size={16} fill={email.isStarred ? 'currentColor' : 'none'} />}
                    label={email.isStarred ? 'Retirer favoris' : 'Ajouter favoris'}
                    onClick={() => email.isStarred ? state.handleUnstar() : state.handleStar()}
                    className={email.isStarred ? 'text-amber-400' : ''}
                />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" />

                {/* Print & download */}
                <ToolbarBtn
                    icon={<Printer size={16} />}
                    label="Imprimer"
                    onClick={state.handlePrint}
                />
                {state.emailAttachments.length > 0 && (
                    <ToolbarBtn
                        icon={<Download size={16} />}
                        label="Tout télécharger"
                        onClick={state.handleDownloadAllAttachments}
                    />
                )}

                <div className="flex-1" />

                {/* AI */}
                <ToolbarBtn
                    icon={state.aiReplyMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Bot size={16} />}
                    label="IA: Répondre"
                    onClick={state.handleAIReply}
                    className="text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                />
                <ToolbarBtn
                    icon={state.aiSummarizeMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    label="IA: Résumer"
                    onClick={state.handleAISummarize}
                    className="text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                />
            </div>

            {/* AI Summary */}
            {state.aiSummary && (
                <div className="mx-4 mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center gap-2 mb-1.5 text-purple-700 dark:text-purple-300">
                        <Sparkles size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Résumé IA</span>
                        <button onClick={() => state.setAiSummary(null)} className="ml-auto text-purple-400 hover:text-purple-600">
                            <X size={12} />
                        </button>
                    </div>
                    <p className="text-xs text-purple-800 dark:text-purple-200 leading-relaxed">{state.aiSummary}</p>
                </div>
            )}

            {/* Email content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Subject */}
                <h2 className="text-xl font-serif font-bold text-slate-800 dark:text-white mb-4 leading-tight">
                    {email.subject}
                </h2>

                {/* Sender / recipient meta */}
                <div className="flex items-start gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {(state.currentFolder === 'sent' ? (email.to || '?') : email.from).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200">
                            {state.currentFolder === 'sent' ? `À : ${email.to || '—'}` : email.from}
                        </div>
                        {state.currentFolder !== 'sent' && email.to && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">À : {email.to}</div>
                        )}
                        {state.currentFolder === 'sent' && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">De : {email.from}</div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{new Date(email.date).toLocaleString('fr-FR')}</div>
                    </div>
                </div>

                {/* Body */}
                <div className="prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {state.emailBody === undefined ? (
                        <div className="flex items-center gap-2 text-slate-400 py-4">
                            <RefreshCw size={14} className="animate-spin" /> Chargement du message...
                        </div>
                    ) : state.emailBody ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(state.emailBody) }} />
                    ) : (
                        <p className="whitespace-pre-wrap">{email.snippet}</p>
                    )}
                </div>

                {/* Attachments */}
                {state.emailAttachments.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Paperclip size={12} /> Pièces jointes ({state.emailAttachments.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {state.emailAttachments.map((att) => {
                                const isImage = att.contentType?.startsWith('image/');
                                const isPdf = att.contentType === 'application/pdf';
                                return (
                                    <button
                                        key={att.partIndex}
                                        onClick={() => state.handleDownloadAttachment(att)}
                                        className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-xs font-medium transition-colors group text-left"
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isImage ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-500' : isPdf ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate dark:text-slate-200 font-semibold">{att.filename}</div>
                                            <div className="text-slate-400 text-[10px] mt-0.5">
                                                {formatSize(att.size)} {att.contentType?.split('/')[1]?.toUpperCase() || 'FICHIER'}
                                            </div>
                                        </div>
                                        <Download size={14} className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick reply bar */}
            <div className="shrink-0 border-t border-slate-100 dark:border-slate-700/50 px-4 py-3 bg-slate-50 dark:bg-slate-900/30">
                <button
                    onClick={state.handleReply}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:border-blue-300 transition-all"
                >
                    <Reply size={14} />
                    <span>Répondre...</span>
                </button>
            </div>
        </div>
    );
};


// ============================================================================
// ToolbarBtn helper
// ============================================================================

const ToolbarBtn: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    className?: string;
    isPending?: boolean;
}> = ({ icon, label, onClick, className = '', isPending }) => (
    <button
        onClick={onClick}
        disabled={isPending}
        className={`p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all shrink-0 ${className}`}
        title={label}
    >
        {isPending ? <RefreshCw size={16} className="animate-spin" /> : icon}
    </button>
);
