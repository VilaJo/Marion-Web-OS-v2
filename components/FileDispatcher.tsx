import React, { useState, useEffect, useRef } from 'react';
import { Bot, Check, Edit2, Folder, X, FileText, Image as ImageIcon, ChevronRight, Loader2, ArrowRight, UploadCloud, Eye, CheckCircle2 } from 'lucide-react';

// @ts-ignore
import franckAvatar from '../assets/franck-avatar.png';

// Franck Avatar Component
const FranckAvatar: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
    <img src={franckAvatar} alt="Franck" className={`${className} rounded-full object-cover`} />
);

interface FileItem {
    id: string;
    file: File;
    status: 'pending' | 'analyzing' | 'ready' | 'completed' | 'error';
    analysis?: {
        client: string;
        newName: string;
        folder: string;
        reason: string;
        tempPath: string;
    };
    previewUrl?: string;
    // Local form state for each item
    manualData?: {
        client: string;
        newName: string;
        folder: string;
    }
}

interface FileDispatcherProps {
    files: File[];
    onClose: () => void;
    onSuccess: () => void;
    existingClients: string[];
}

export const FileDispatcher: React.FC<FileDispatcherProps> = ({ files: initialFiles, onClose, onSuccess, existingClients }) => {
    // Queue Management
    const [queue, setQueue] = useState<FileItem[]>([]);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cardsRef = useRef<HTMLDivElement>(null);

    const [customFolderModes, setCustomFolderModes] = useState<Record<string, boolean>>({});

    // Initial Load
    useEffect(() => {
        initialFiles.forEach(file => addFileToQueue(file));
    }, []);

    // Trigger Analysis
    useEffect(() => {
        const pendingFile = queue.find(f => f.status === 'pending');
        if (pendingFile) {
            analyzeFile(pendingFile.id);
        }
    }, [queue]);

    // Cleanup URLs
    useEffect(() => {
        return () => {
            queue.forEach(item => {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            });
        };
    }, []);

    const addFileToQueue = (file: File) => {
        const id = Math.random().toString(36).substr(2, 9);
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
        
        let previewUrl: string | undefined;
        
        if (isPdf) {
            // Force PDF mime type for preview to ensure browser renders it
            const blob = file.slice(0, file.size, 'application/pdf');
            previewUrl = URL.createObjectURL(blob);
        } else if (isImage) {
            previewUrl = URL.createObjectURL(file);
        }
        
        const newItem: FileItem = { id, file, status: 'pending', previewUrl };
        
        setQueue(prev => {
            const newQueue = [...prev, newItem];
            if (!activeFileId) setActiveFileId(id);
            return newQueue;
        });
    };

    const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach(file => addFileToQueue(file));
        }
    };

    const analyzeFile = async (id: string) => {
        setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'analyzing' } : f));

        const item = queue.find(f => f.id === id);
        if (!item) return;

        const formData = new FormData();
        formData.append('file', item.file);

        try {
            const res = await fetch('/api/files/dispatch', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                setQueue(prev => prev.map(f => f.id === id ? {
                    ...f,
                    status: 'ready',
                    analysis: {
                        client: data.suggestion.client,
                        newName: data.suggestion.newName,
                        folder: data.suggestion.folder,
                        reason: data.suggestion.reason,
                        tempPath: data.tempPath
                    },
                    manualData: {
                        client: data.suggestion.client !== 'Unknown' ? data.suggestion.client : '',
                        newName: data.suggestion.newName,
                        folder: data.suggestion.folder
                    }
                } : f));
            } else {
                setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f));
            }
        } catch (e) {
            console.error("Analysis failed", e);
            setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f));
        }
    };

    const updateManualData = (id: string, field: string, value: string) => {
        setQueue(prev => prev.map(f => f.id === id ? {
            ...f,
            manualData: { ...f.manualData!, [field]: value }
        } : f));
    };

    const handleDispatchSingle = async (id: string) => {
        const item = queue.find(f => f.id === id);
        if (!item || !item.analysis || !item.manualData) return;

        // Optimistic update
        setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'completed' } : f));

        try {
            await fetch('/api/files/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: item.analysis.tempPath,
                    client: item.manualData.client,
                    newName: item.manualData.newName,
                    folder: item.manualData.folder
                })
            });
            
            // Auto-advance
            const next = queue.find(f => f.id !== id && f.status !== 'completed');
            if (next) {
                setActiveFileId(next.id);
                scrollToCard(next.id);
            } else {
                // All done?
                const allDone = queue.every(f => f.id === id || f.status === 'completed');
                if (allDone) setTimeout(onSuccess, 800);
            }

        } catch (e) {
            alert("Erreur transfert.");
            setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'ready' } : f));
        }
    };

    const scrollToCard = (id: string) => {
        const el = document.getElementById(`card-${id}`);
        if (el && cardsRef.current) {
            cardsRef.current.scrollTo({ top: el.offsetTop - cardsRef.current.offsetTop - 20, behavior: 'smooth' });
        }
    };

    const selectFile = (id: string) => {
        setActiveFileId(id);
        scrollToCard(id);
    };

    const activeItem = queue.find(f => f.id === activeFileId);
    const completedCount = queue.filter(f => f.status === 'completed').length;
    const progress = (completedCount / queue.length) * 100;

    return (
        <div className="fixed inset-0 z-[300] bg-[#0f172a]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-[1600px] h-[90vh] bg-white dark:bg-[#1e293b] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-white/10 relative">
                
                {/* GLOBAL PROGRESS BAR */}
                <div className="absolute top-0 left-0 h-1.5 bg-brand-orange transition-all duration-500 z-50 shadow-[0_0_10px_rgba(255,126,95,0.5)]" style={{ width: `${progress}%` }}></div>

                {/* HEADER */}
                <div className="h-16 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between px-8 bg-slate-50/50 dark:bg-[#0f172a]/50">
                    <div className="flex items-center gap-3">
                        <UploadCloud className="text-brand-orange" size={24} />
                        <h2 className="font-serif text-xl font-bold text-slate-800 dark:text-white">Salle de Tri Franck</h2>
                        <span className="bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded-full font-bold text-slate-500 dark:text-slate-300">
                            {completedCount} / {queue.length} traités
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* MAIN CONTENT GRID */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* COL 1: FILE LIST (Source) */}
                    <div className="w-64 bg-slate-50 dark:bg-[#0f172a]/30 border-r border-slate-200 dark:border-slate-700/50 flex flex-col">
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {queue.map(item => (
                                <div 
                                    key={item.id}
                                    onClick={() => selectFile(item.id)}
                                    className={`p-3 rounded-xl cursor-pointer transition-all border flex items-center gap-3 group ${
                                        activeFileId === item.id 
                                        ? 'bg-white dark:bg-slate-700 border-brand-orange shadow-md' 
                                        : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                                    } ${item.status === 'completed' ? 'opacity-50' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                                        {item.previewUrl ? <img src={item.previewUrl} className="w-full h-full object-cover" /> : <FileText size={14} className="text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold truncate dark:text-slate-200">{item.file.name}</div>
                                        <div className="text-[10px] text-slate-400 capitalize">{item.status}</div>
                                    </div>
                                    {item.status === 'completed' && <CheckCircle2 size={14} className="text-green-500" />}
                                </div>
                            ))}
                            
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 hover:border-brand-orange hover:text-brand-orange hover:bg-orange-50/10 cursor-pointer transition-colors mt-4"
                            >
                                <UploadCloud size={16} /> <span>Ajouter</span>
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleAddMoreFiles} />
                            </div>
                        </div>
                    </div>

                    {/* COL 2: CENTRAL PREVIEW (Visual) */}
                    <div className="flex-1 bg-slate-100 dark:bg-[#0f172a] relative overflow-hidden flex flex-col">
                        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
                        
                        <div className="relative z-10 w-full h-full p-8 flex items-center justify-center">
                            {activeItem ? (
                                activeItem.previewUrl ? (
                                    (activeItem.file.type === 'application/pdf' || activeItem.file.name.toLowerCase().endsWith('.pdf')) ? (
                                        <div className="relative w-full h-full rounded-2xl shadow-2xl overflow-hidden bg-white group">
                                            <iframe 
                                                src={activeItem.previewUrl} 
                                                className="w-full h-full border-none"
                                                title="PDF Preview"
                                            />
                                            {/* Overlay Button for PDF */}
                                            <div className="absolute bottom-4 right-4 z-20">
                                                <a 
                                                    href={activeItem.previewUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold shadow-lg hover:bg-brand-orange transition-colors"
                                                >
                                                    <Eye size={14} /> Ouvrir le PDF
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <img src={activeItem.previewUrl} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in duration-300" alt="Preview" />
                                    )
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400">
                                        <FileText size={80} className="mb-4 opacity-50" />
                                        <p className="font-serif text-xl">Aperçu non disponible</p>
                                        <p className="text-sm opacity-60">{activeItem.file.name}</p>
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center text-slate-400">
                                    <UploadCloud size={64} className="mb-4 opacity-20" />
                                    <p className="text-lg">Sélectionnez un fichier à traiter</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COL 3: INTELLIGENCE FEED (Action) */}
                    <div ref={cardsRef} className="w-[450px] bg-white dark:bg-[#1e293b] border-l border-slate-200 dark:border-slate-700 overflow-y-auto p-6 space-y-6 scroll-smooth">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 sticky top-0 bg-white dark:bg-[#1e293b] py-2 z-10">
                            Analyses & Actions
                        </div>

                        {queue.map(item => (
                            <div 
                                id={`card-${item.id}`}
                                key={item.id} 
                                onClick={() => setActiveFileId(item.id)}
                                className={`rounded-2xl border transition-all duration-300 ${
                                    activeFileId === item.id 
                                    ? 'border-brand-orange shadow-lg ring-1 ring-brand-orange/20 scale-[1.02]' 
                                    : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                                } ${item.status === 'completed' ? 'bg-slate-50 dark:bg-slate-800/50 grayscale-[0.5]' : 'bg-white dark:bg-slate-800'}`}
                            >
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-start gap-3">
                                    <FranckAvatar className="w-8 h-8" />
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-700 dark:text-white flex justify-between">
                                            <span>Analyse Franck</span>
                                            {item.status === 'analyzing' && <Loader2 size={12} className="animate-spin text-brand-orange"/>}
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                            {item.status === 'analyzing' ? 'Lecture du document...' : 
                                             item.status === 'pending' ? 'En attente...' :
                                             item.analysis?.client !== 'Unknown' ? `J'ai reconnu ${item.analysis?.client}.` : 
                                             "Client non identifié."}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {/* Client Input */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Client</label>
                                        <select 
                                            value={item.manualData?.client || ''}
                                            onChange={(e) => updateManualData(item.id, 'client', e.target.value)}
                                            disabled={item.status === 'completed'}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange transition-colors"
                                        >
                                            <option value="" disabled>Choisir...</option>
                                            {existingClients.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    {/* Filename Input */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nom</label>
                                        <input 
                                            value={item.manualData?.newName || ''}
                                            onChange={(e) => updateManualData(item.id, 'newName', e.target.value)}
                                            disabled={item.status === 'completed'}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-brand-orange transition-colors"
                                        />
                                    </div>

                                    {/* Folder Selection */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dossier</label>
                                        
                                        {!customFolderModes[item.id] ? (
                                            <div className="flex gap-2">
                                                <select
                                                    value={item.manualData?.folder || ''}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'custom') {
                                                            setCustomFolderModes(prev => ({ ...prev, [item.id]: true }));
                                                            updateManualData(item.id, 'folder', '');
                                                        } else {
                                                            updateManualData(item.id, 'folder', e.target.value);
                                                        }
                                                    }}
                                                    disabled={item.status === 'completed'}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange transition-colors"
                                                >
                                                    <option value="" disabled>Choisir un dossier...</option>
                                                    <option value="0. Admin">0. Admin</option>
                                                    <option value="0. Admin/2. Factures">0. Admin/2. Factures</option>
                                                    <option value="1. Charte graphique">1. Charte graphique</option>
                                                    <option value="2. Logo">2. Logo</option>
                                                    <option value="3. Site internet">3. Site internet</option>
                                                    <option value="3. Site internet/Textes">3. Site internet/Textes</option>
                                                    <option value="3. Site internet/Visuels">3. Site internet/Visuels</option>
                                                    <option value="custom" className="font-bold text-brand-orange">+ Autre (Nouveau dossier)</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    autoFocus
                                                    placeholder="Nom du nouveau dossier..."
                                                    value={item.manualData?.folder || ''}
                                                    onChange={(e) => updateManualData(item.id, 'folder', e.target.value)}
                                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand-orange"
                                                />
                                                <button 
                                                    onClick={() => setCustomFolderModes(prev => ({ ...prev, [item.id]: false }))}
                                                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    {item.status !== 'completed' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDispatchSingle(item.id); }}
                                            disabled={!item.manualData?.client || item.status !== 'ready'}
                                            className="w-full py-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Valider <ArrowRight size={14} />
                                        </button>
                                    )}
                                    
                                    {item.status === 'completed' && (
                                        <div className="w-full py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                                            <Check size={14} /> Classé
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};