import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, ArrowLeft, Loader2, File, Image as ImageIcon, Film, Music, Code, ExternalLink, Download, MoreVertical, Trash2, Edit2, Move } from 'lucide-react';
import { FinderItem } from '../types';

interface FileExplorerProps {
    items: FinderItem[];
    currentPath: string;
    onNavigate: (item: FinderItem) => void;
    onBack: () => void;
    isLoading: boolean;
    onRename?: (item: FinderItem, newName: string) => void;
    onDelete?: (item: FinderItem) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ items, currentPath, onNavigate, onBack, isLoading, onRename, onDelete }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: FinderItem } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleRightClick = (e: React.MouseEvent, item: FinderItem) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    const startRenaming = (item: FinderItem) => {
        setRenamingId(item.name); // Using name as ID for simplicity in this context
        setRenameValue(item.name);
        setContextMenu(null);
    };

    const submitRename = () => {
        if (renamingId && onRename && renameValue.trim() !== renamingId) {
            const item = items.find(i => i.name === renamingId);
            if (item) onRename(item, renameValue.trim());
        }
        setRenamingId(null);
    };

    const handleDelete = (item: FinderItem) => {
        if (confirm(`Voulez-vous vraiment supprimer "${item.name}" ?`)) {
            if (onDelete) onDelete(item);
        }
        setContextMenu(null);
    };
    
    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <ImageIcon size={20} className="text-purple-500" />;
        if (['mp4', 'mov', 'webm'].includes(ext || '')) return <Film size={20} className="text-red-500" />;
        if (['mp3', 'wav', 'ogg'].includes(ext || '')) return <Music size={20} className="text-blue-500" />;
        if (['js', 'ts', 'tsx', 'py', 'html', 'css', 'json'].includes(ext || '')) return <Code size={20} className="text-green-500" />;
        if (['pdf'].includes(ext || '')) return <FileText size={20} className="text-red-600" />;
        return <File size={20} className="text-slate-400" />;
    };

    const handleOpenInFinder = async () => {
        try {
            await fetch('/api/v1/files/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: currentPath })
            });
        } catch (e) {
            console.error("Failed to open finder", e);
        }
    };

    return (
        <div ref={containerRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[500px] relative">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                <button 
                    onClick={onBack} 
                    disabled={!currentPath}
                    className="p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-1 tabular-nums text-xs text-slate-500 dark:text-slate-400 truncate px-2 py-1.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm select-all">
                    root/{currentPath}
                </div>
                <button 
                    onClick={handleOpenInFinder}
                    className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-brand-orange transition-colors flex items-center gap-2 text-xs font-bold"
                    title="Ouvrir dans le Finder (Mac)"
                >
                    <ExternalLink size={16} /> <span className="hidden sm:inline">Finder</span>
                </button>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-2" onContextMenu={(e) => e.preventDefault()}>
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-400 gap-2">
                        <Loader2 className="animate-spin" /> Chargement...
                    </div>
                ) : items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50">
                        <Folder size={48} strokeWidth={1} />
                        <span className="text-sm">Dossier vide</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1">
                        {items.map((item) => (
                            <div 
                                key={item.name}
                                draggable={item.type === 'file'}
                                onDragStart={(e) => {
                                    if (item.type === 'file') {
                                        const fileUrl = `/files/${currentPath ? currentPath + '/' : ''}${item.name}`;
                                        e.dataTransfer.setData("DownloadURL", `application/octet-stream:${item.name}:${fileUrl}`);
                                    }
                                }}
                                onClick={() => onNavigate(item)}
                                onContextMenu={(e) => handleRightClick(e, item)}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative select-none"
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    {item.type === 'folder' ? (
                                        <Folder size={20} className="text-brand-orange fill-orange-50 dark:fill-orange-900/20" />
                                    ) : (
                                        getFileIcon(item.name)
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {renamingId === item.name ? (
                                        <input 
                                            autoFocus
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full bg-white dark:bg-slate-900 border border-brand-orange rounded px-1 py-0.5 text-sm outline-none"
                                        />
                                    ) : (
                                        <>
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-brand-orange transition-colors">
                                                {item.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {item.type === 'folder' ? 'Dossier' : item.name.split('.').pop()?.toUpperCase() + ' File'}
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                {/* Quick Actions on Hover (if not context menu) */}
                                {item.type === 'file' && !renamingId && (
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                                        <a 
                                            href={`/files/${currentPath ? currentPath + '/' : ''}${item.name}`} 
                                            download={item.name}
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-2 text-slate-400 hover:text-brand-orange rounded-full hover:bg-white dark:hover:bg-slate-700"
                                            title="Télécharger"
                                        >
                                            <Download size={16} />
                                        </a>
                                    </div>
                                )}
                                <div className="opacity-0 group-hover:opacity-100 sm:hidden">
                                     <button onClick={(e) => { e.stopPropagation(); handleRightClick(e, item); }} className="p-2 text-slate-400">
                                        <MoreVertical size={16} />
                                     </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 w-48 py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 dark:border-slate-700 mb-1">
                        {contextMenu.item.name}
                    </div>
                    <button onClick={() => startRenaming(contextMenu.item)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Edit2 size={14} /> Renommer
                    </button>
                    {contextMenu.item.type === 'file' && (
                         <a 
                            href={`/files/${currentPath ? currentPath + '/' : ''}${contextMenu.item.name}`} 
                            download={contextMenu.item.name}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-600 dark:text-slate-300"
                        >
                            <Download size={14} /> Télécharger
                        </a>
                    )}
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                    <button onClick={() => handleDelete(contextMenu.item)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-500">
                        <Trash2 size={14} /> Supprimer
                    </button>
                </div>
            )}
        </div>
    );
};
