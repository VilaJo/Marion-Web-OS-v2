/**
 * EmailList - Email list with search, multi-select, batch actions, and pagination.
 */

import React from 'react';
import {
    Search, RefreshCw, Mail, Trash2, CheckSquare, Square,
    Eye, Archive, Star, Paperclip, User, ArrowLeft
} from 'lucide-react';
import type { EmailWidgetState } from './useEmailWidget';
import type { EmailMessage } from '../../services/queries';

interface Props {
    state: EmailWidgetState;
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FOLDER_LABELS: Record<string, string> = {
    inbox: 'Boîte de réception',
    sent: 'Envoyés',
    drafts: 'Brouillons',
    starred: 'Favoris',
    trash: 'Corbeille',
    spam: 'Spam',
};

/** Get a user-friendly label for any folder (standard or custom IMAP) */
function getFolderLabel(folder: string): string {
    if (FOLDER_LABELS[folder]) return FOLDER_LABELS[folder];
    // For custom IMAP folders, show the last segment
    const parts = folder.includes('/') ? folder.split('/') : folder.split('.');
    return parts[parts.length - 1];
}

export const EmailList: React.FC<Props> = ({ state }) => {
    const hasSelection = state.selectedIds.size > 0;
    const allSelected = state.emails.length > 0 && state.selectedIds.size === state.emails.length;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                    {/* Back button for mobile */}
                    <button
                        onClick={() => state.setView('list')}
                        className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h3 className="text-sm font-bold dark:text-white flex-1 truncate">
                        {getFolderLabel(state.currentFolder)}
                    </h3>
                    <button
                        onClick={() => state.refetchEmails()}
                        className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"
                        title="Actualiser"
                    >
                        <RefreshCw size={14} className={state.isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={state.searchQuery}
                        onChange={(e) => state.setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder:text-slate-400"
                    />
                </div>

            </div>

            {/* Batch actions bar */}
            {hasSelection && (
                <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30">
                    <button
                        onClick={state.selectAll}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
                        title={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    >
                        {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>
                    <span className="text-xs font-bold text-blue-600 mx-1">{state.selectedIds.size}</span>
                    <div className="flex-1" />
                    <button
                        onClick={state.handleBatchMarkRead}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
                        title="Marquer comme lu"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => state.handleMove('trash', Array.from(state.selectedIds))}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
                        title="Archiver"
                    >
                        <Archive size={14} />
                    </button>
                    <button
                        onClick={() => state.handleDelete(Array.from(state.selectedIds))}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/30 rounded transition-colors"
                        title="Supprimer"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}

            {/* Email items */}
            <div className="flex-1 overflow-y-auto">
                {state.emails.map((mail) => (
                    <EmailListItem
                        key={mail.id}
                        mail={mail}
                        isActive={state.selectedEmail?.id === mail.id}
                        isSelected={state.selectedIds.has(mail.id)}
                        isSent={state.currentFolder === 'sent'}
                        onOpen={() => state.handleOpenEmail(mail)}
                        onToggleSelect={() => state.toggleSelect(mail.id)}
                        onStar={() => mail.isStarred ? state.handleUnstar(mail) : state.handleStar(mail)}
                    />
                ))}

                {state.emails.length === 0 && !state.isLoading && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 opacity-60">
                        <Mail size={36} className="mb-3 text-slate-300" />
                        <p className="text-xs font-medium">Aucun email</p>
                    </div>
                )}

                {state.isLoading && (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                        <RefreshCw size={16} className="animate-spin mr-2" />
                        <span className="text-xs">Chargement...</span>
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================================================
// EmailListItem (inline sub-component)
// ============================================================================

interface ItemProps {
    mail: EmailMessage;
    isActive: boolean;
    isSelected: boolean;
    isSent: boolean;
    onOpen: () => void;
    onToggleSelect: () => void;
    onStar: () => void;
}

const EmailListItem: React.FC<ItemProps> = ({ mail, isActive, isSelected, isSent, onOpen, onToggleSelect, onStar }) => {
    return (
        <div
            className={`
                group relative flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-slate-50 dark:border-slate-700/30 transition-all
                ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'}
                ${mail.isUnread ? 'bg-white dark:bg-slate-800/80' : ''}
            `}
        >
            {/* Unread bar */}
            {mail.isUnread && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-r" />
            )}

            {/* Checkbox */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                className={`shrink-0 mt-0.5 p-0.5 rounded transition-all ${isSelected ? 'text-blue-600' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
            >
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0" onClick={onOpen}>
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs truncate flex-1 ${mail.isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                        {isSent ? (mail.to || '—') : mail.from}
                    </span>
                    <span className={`text-[10px] whitespace-nowrap shrink-0 ${mail.isUnread ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        {formatDate(mail.date)}
                    </span>
                </div>
                <div className={`text-xs truncate mb-0.5 ${mail.isUnread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {mail.subject}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex-1">
                        {mail.snippet}
                    </span>
                    {mail.hasAttachments && <Paperclip size={11} className="text-slate-400 shrink-0" />}
                </div>
            </div>

            {/* Star */}
            <button
                onClick={(e) => { e.stopPropagation(); onStar(); }}
                className={`shrink-0 mt-0.5 p-0.5 rounded transition-all ${mail.isStarred ? 'text-amber-400' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
                title={mail.isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
                <Star size={14} fill={mail.isStarred ? 'currentColor' : 'none'} />
            </button>
        </div>
    );
};


function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Hier';
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
        return '';
    }
}
