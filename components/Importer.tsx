import React, { useState, useEffect } from 'react';
import { FinderItem } from '../types';
import { Folder, File, ChevronRight, HardDrive, Download, RefreshCw } from 'lucide-react';

interface ImporterProps {
    data: FinderItem[]; // Kept for compatibility but unused
    onImport: (name: string) => void;
    onClose: () => void;
}

export const Importer: React.FC<ImporterProps> = ({ onImport, onClose }) => {
    const [currentPath, setCurrentPath] = useState<string>(""); // Root = Desktop
    const [items, setItems] = useState<FinderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selection, setSelection] = useState<string | null>(null);
    const [pathHistory, setPathHistory] = useState<string[]>([]);

    const fetchFiles = async (path: string) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/files/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            const data = await res.json();
            if (data.items) {
                setItems(data.items);
            }
        } catch (e) {
            console.error("Failed to load files", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles(currentPath);
    }, [currentPath]);

    const handleNavigate = (item: FinderItem) => {
        if (item.type === 'folder') {
            setPathHistory([...pathHistory, currentPath]);
            setCurrentPath(item.id); // id is relative path
            setSelection(null);
        }
    };

    const handleBack = () => {
        if (pathHistory.length > 0) {
            const prev = pathHistory[pathHistory.length - 1];
            setCurrentPath(prev);
            setPathHistory(pathHistory.slice(0, -1));
            setSelection(null);
        }
    };

    const handleSelect = (item: FinderItem) => {
        setSelection(item.id);
        // Simulate double click to enter if folder
        if (item.type === 'folder' && selection === item.id) {
            handleNavigate(item);
        }
    };

    const handleImportAction = () => {
        const selectedItem = items.find(i => i.id === selection);
        if (selectedItem) {
            // Logic to clean name "01.Maison_Fleur" -> "Maison Fleur"
            const cleanName = selectedItem.name.replace(/^\d+\./, '').replace(/_/g, ' ');
            onImport(cleanName);
        }
    };

    return (
        <div className="h-[500px] flex flex-col bg-[#ECECEC] dark:bg-gray-800 rounded-xl overflow-hidden text-sm font-sans select-none">
            {/* Finder Toolbar */}
            <div className="h-12 bg-[#F6F6F6] dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 flex items-center px-4 space-x-4">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={onClose}></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex space-x-2 text-gray-500">
                    <button onClick={handleBack} disabled={pathHistory.length === 0} className="disabled:opacity-30 hover:bg-gray-200 rounded p-1">
                        <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                </div>
                <div className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    Desktop {currentPath ? `/ ${currentPath}` : ''}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-48 bg-[#F1F3F5] dark:bg-gray-800/50 backdrop-blur p-2 border-r border-gray-200 dark:border-gray-600 hidden md:block">
                    <div className="text-xs text-gray-400 font-bold mb-2 px-2 uppercase tracking-wide">Favoris</div>
                    <div 
                        onClick={() => { setCurrentPath(""); setPathHistory([]); }}
                        className={`px-2 py-1 rounded cursor-pointer flex items-center gap-2 ${currentPath === "" ? 'bg-blue-500 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        <HardDrive size={14} /> Bureau (Desktop)
                    </div>
                </div>

                {/* Main View */}
                <div className="flex-1 bg-white dark:bg-gray-900 p-2 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center text-gray-400">
                            <RefreshCw className="animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 content-start">
                            {items.length === 0 && (
                                <div className="col-span-full text-center py-10 text-gray-400 italic">Dossier vide</div>
                            )}
                            {items.map((item) => (
                                <div 
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={`flex flex-col items-center justify-start p-2 rounded-lg cursor-pointer transition-colors border border-transparent ${selection === item.id ? 'bg-blue-100 dark:bg-blue-900 border-blue-200' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    {item.type === 'folder' ? (
                                        <Folder className="w-12 h-12 text-blue-400 fill-current mb-2 drop-shadow-sm" />
                                    ) : (
                                        <File className="w-10 h-12 text-gray-400 mb-2 drop-shadow-sm" />
                                    )}
                                    <span className="text-center text-xs break-words w-full leading-tight px-1 line-clamp-2" title={item.name}>{item.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs text-gray-400">{items.length} éléments</span>
                <button 
                    onClick={handleImportAction}
                    disabled={!selection}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    Importer le dossier
                </button>
            </div>
        </div>
    );
};