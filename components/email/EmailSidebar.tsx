/**
 * EmailSidebar - Folder navigation with real IMAP folders from Infomaniak.
 *
 * Shows:
 *   1. Standard folders (Inbox, Sent, Drafts, Starred, Trash, Spam)
 *   2. Client/custom IMAP folders that Marion created on Infomaniak
 *   3. Fullscreen toggle + compose + logout
 */

import React, { useState, useMemo } from 'react';
import {
    Inbox, Send, FileText, Star, Trash2, AlertOctagon,
    Edit, LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    Maximize2, X, FolderOpen, Folder, RefreshCw
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { EmailWidgetState } from './useEmailWidget';

interface Props {
    state: EmailWidgetState;
    collapsed: boolean;
    onToggle: () => void;
}

/** Standard folder aliases rendered with dedicated icons */
const STANDARD_FOLDERS: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'inbox',   label: 'Boîte de réception', icon: <Inbox size={18} /> },
    { id: 'sent',    label: 'Envoyés',            icon: <Send size={18} /> },
    { id: 'drafts',  label: 'Brouillons',         icon: <FileText size={18} /> },
    { id: 'starred', label: 'Favoris',            icon: <Star size={18} /> },
    { id: 'trash',   label: 'Corbeille',          icon: <Trash2 size={18} /> },
    { id: 'spam',    label: 'Spam',               icon: <AlertOctagon size={18} /> },
];

/**
 * IMAP folder names that map to standard folders — these are excluded
 * from the "Classement" section since they already appear at the top.
 * All comparisons are case-insensitive.
 */
const STANDARD_IMAP_NAMES = new Set([
    'inbox',
    'sent', 'sent items', 'sent messages', 'inbox.sent', 'inbox/sent',
    'drafts', 'draft', 'inbox.drafts', 'inbox/drafts',
    'trash', 'deleted items', 'deleted messages', 'inbox.trash', 'inbox/trash',
    'junk', 'spam', 'inbox.junk', 'inbox/junk', 'inbox.spam', 'inbox/spam',
    'archive', 'archives', 'inbox.archive', 'inbox/archive',
    'notes', 'templates', 'outbox',
]);

export const EmailSidebar: React.FC<Props> = ({ state, collapsed, onToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [clientsExpanded, setClientsExpanded] = useState(true);

    const isFullscreen = location.pathname === '/emails';

    // Build unread count map from IMAP folders data
    const unseenMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const f of state.imapFolders) {
            map[f.name.toLowerCase()] = f.unseen;
        }
        return map;
    }, [state.imapFolders]);

    // Inbox unseen count (check multiple possible names)
    const inboxUnseen = unseenMap['inbox'] || 0;

    // Extract custom/client IMAP folders (anything that's NOT a standard system folder)
    const clientFolders = useMemo(() => {
        return state.imapFolders
            .filter(f => !STANDARD_IMAP_NAMES.has(f.name.toLowerCase()))
            .sort((a, b) => {
                // Sort by display name
                const na = displayName(a.name);
                const nb = displayName(b.name);
                return na.localeCompare(nb, 'fr');
            });
    }, [state.imapFolders]);

    const handleStandardFolderClick = (folderId: string) => {
        state.setCurrentFolder(folderId);
        state.setView('list');
        state.setSelectedEmail(null);
    };

    const handleClientFolderClick = (imapFolderName: string) => {
        state.setCurrentFolder(imapFolderName);
        state.setView('list');
        state.setSelectedEmail(null);
    };

    return (
        <div className={`${collapsed ? 'w-0 overflow-hidden lg:w-16' : 'w-60'} shrink-0 flex flex-col bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700/50 transition-all duration-300`}>
            {/* Compose + fullscreen buttons */}
            <div className={`p-3 ${collapsed ? 'px-2' : 'px-4'} space-y-2`}>
                <button
                    onClick={state.handleCompose}
                    className={`w-full flex items-center justify-center gap-2 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-200 dark:shadow-none transition-all active:scale-95 ${collapsed ? 'px-0' : 'px-4'}`}
                >
                    <Edit size={16} />
                    {!collapsed && <span>Nouveau</span>}
                </button>

                {/* Fullscreen toggle */}
                {!collapsed && (
                    <button
                        onClick={() => isFullscreen ? navigate(-1) : navigate('/emails')}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                    >
                        {isFullscreen ? <X size={14} /> : <Maximize2 size={14} />}
                        <span>{isFullscreen ? 'Fermer plein écran' : 'Plein écran'}</span>
                    </button>
                )}
                {collapsed && (
                    <button
                        onClick={() => isFullscreen ? navigate(-1) : navigate('/emails')}
                        className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"
                        title={isFullscreen ? 'Fermer plein écran' : 'Plein écran'}
                    >
                        {isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}
                    </button>
                )}
            </div>

            {/* Scrollable area: standard folders + client folders */}
            <div className="flex-1 overflow-y-auto">
                {/* ---- Standard folders ---- */}
                <nav className="py-2">
                    {!collapsed && (
                        <div className="px-4 mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dossiers</span>
                        </div>
                    )}
                    {STANDARD_FOLDERS.map(folder => {
                        const isActive = state.currentFolder === folder.id;
                        const unseen = folder.id === 'inbox' ? inboxUnseen : 0;

                        return (
                            <button
                                key={folder.id}
                                onClick={() => handleStandardFolderClick(folder.id)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-2 text-left text-sm font-medium transition-all
                                    ${isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                    }
                                    ${collapsed ? 'justify-center px-0' : ''}
                                `}
                                title={folder.label}
                            >
                                <span className="shrink-0">{folder.icon}</span>
                                {!collapsed && (
                                    <>
                                        <span className="truncate flex-1">{folder.label}</span>
                                        {unseen > 0 && (
                                            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                                {unseen}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* ---- Client / custom IMAP folders (always visible when connected) ---- */}
                {state.isConnected && (
                    <div className="border-t border-slate-200 dark:border-slate-700/50 py-2">
                        {!collapsed ? (
                            <>
                                <button
                                    onClick={() => setClientsExpanded(!clientsExpanded)}
                                    className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <FolderOpen size={14} className="text-slate-400 shrink-0" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">
                                        Classement
                                    </span>
                                    {clientsExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                                </button>

                                {clientsExpanded && (
                                    <div className="mt-1">
                                        {/* Loading state */}
                                        {state.isFoldersLoading && clientFolders.length === 0 && (
                                            <div className="flex items-center gap-2 px-4 py-3 text-slate-400">
                                                <RefreshCw size={12} className="animate-spin" />
                                                <span className="text-[11px]">Chargement des dossiers...</span>
                                            </div>
                                        )}

                                        {/* Empty state */}
                                        {!state.isFoldersLoading && clientFolders.length === 0 && (
                                            <div className="px-4 py-3 text-[11px] text-slate-400 italic">
                                                {state.imapFolders.length === 0
                                                    ? 'Chargement en cours ou aucun dossier détecté...'
                                                    : `${state.imapFolders.length} dossiers IMAP trouvés, tous classés comme standard.`
                                                }
                                            </div>
                                        )}

                                        {/* Folder list */}
                                        {clientFolders.map(folder => {
                                            const isActive = state.currentFolder === folder.name;
                                            const name = displayName(folder.name);

                                            return (
                                                <button
                                                    key={folder.name}
                                                    onClick={() => handleClientFolderClick(folder.name)}
                                                    className={`
                                                        w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-all
                                                        ${isActive
                                                            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-r-2 border-brand-orange font-bold'
                                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
                                                        }
                                                    `}
                                                    title={folder.name}
                                                >
                                                    <Folder size={16} className={`shrink-0 ${isActive ? 'text-brand-orange' : 'text-slate-400'}`} />
                                                    <span className="truncate flex-1 text-xs">{name}</span>
                                                    {folder.unseen > 0 && (
                                                        <span className="bg-brand-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                                                            {folder.unseen}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Collapsed: show folder icon that expands sidebar */
                            <button
                                onClick={onToggle}
                                className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-blue-500 rounded transition-colors"
                                title={`${clientFolders.length} dossiers`}
                            >
                                <FolderOpen size={18} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom actions */}
            <div className={`p-3 border-t border-slate-200 dark:border-slate-700/50 space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
                {!collapsed && (
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 truncate">
                        {state.connectedUsername}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button
                        onClick={state.handleLogout}
                        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                        title="Déconnexion"
                    >
                        <LogOut size={14} />
                        {!collapsed && <span>Déconnexion</span>}
                    </button>
                    <button
                        onClick={onToggle}
                        className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors hidden lg:block"
                        title={collapsed ? 'Déplier' : 'Replier'}
                    >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
};


/** Get a display-friendly name from an IMAP folder path (e.g. "INBOX/Acme Corp" → "Acme Corp") */
function displayName(imapName: string): string {
    const parts = imapName.includes('/') ? imapName.split('/') : imapName.split('.');
    return parts[parts.length - 1];
}
