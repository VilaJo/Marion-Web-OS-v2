import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, StickyNote, Save, Search, Undo2, Pin, ArrowLeft, Mic, Sparkles, Wand2, Check, X, Command, MessageSquare, Palette, ChevronDown, Clock, Star, Grid, List, Filter } from 'lucide-react';
import { Card } from './Shared';
import { useUndoStore } from '../stores/useUndoStore';

// --- Types & Constants ---

export interface Note {
    id: string;
    title: string;
    content: string;
    theme: string;
    date: string;
    pinned?: boolean;
    tags?: string[];
}

// Premium paper themes with gradients
const NOTE_THEMES = [
    { id: 'pearl', bg: 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900', text: 'text-slate-800 dark:text-slate-100', border: 'border-slate-200/60 dark:border-slate-700/60', accent: '#64748b', name: 'Perle' },
    { id: 'cream', bg: 'bg-gradient-to-br from-[#FDFCF8] to-[#F5F0E6] dark:from-[#2C2B28] dark:to-[#1E1D1A]', text: 'text-[#4A453E] dark:text-[#EAE0D5]', border: 'border-[#E6E2DD]/60 dark:border-[#444]/60', accent: '#8B7355', name: 'Crème' },
    { id: 'ocean', bg: 'bg-gradient-to-br from-[#E8F4FC] to-[#D0E8F7] dark:from-[#1A2635] dark:to-[#0F1A24]', text: 'text-[#1E3A5F] dark:text-[#B8D4E8]', border: 'border-[#B8D4E8]/60 dark:border-[#2A4158]/60', accent: '#3B82F6', name: 'Océan' },
    { id: 'forest', bg: 'bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] dark:from-[#1A2E1C] dark:to-[#0F1F10]', text: 'text-[#1B5E20] dark:text-[#A5D6A7]', border: 'border-[#A5D6A7]/60 dark:border-[#2E5930]/60', accent: '#22C55E', name: 'Forêt' },
    { id: 'sunset', bg: 'bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] dark:from-[#2E2318] dark:to-[#1F170E]', text: 'text-[#E65100] dark:text-[#FFCC80]', border: 'border-[#FFCC80]/60 dark:border-[#5D4037]/60', accent: '#F97316', name: 'Coucher' },
    { id: 'lavender', bg: 'bg-gradient-to-br from-[#F3E5F5] to-[#E1BEE7] dark:from-[#2D1F33] dark:to-[#1A1221]', text: 'text-[#6A1B9A] dark:text-[#CE93D8]', border: 'border-[#CE93D8]/60 dark:border-[#4A235A]/60', accent: '#A855F7', name: 'Lavande' },
    { id: 'rose', bg: 'bg-gradient-to-br from-[#FCE4EC] to-[#F8BBD9] dark:from-[#2D1A22] dark:to-[#1F1017]', text: 'text-[#AD1457] dark:text-[#F48FB1]', border: 'border-[#F48FB1]/60 dark:border-[#5D2A41]/60', accent: '#EC4899', name: 'Rose' },
];

const AI_ACTIONS = [
    { id: 'improve', label: 'Reformuler', icon: Sparkles, desc: 'Améliore le style' },
    { id: 'summarize', label: 'Résumer', icon: MessageSquare, desc: 'Version courte' },
    { id: 'tasks', label: 'Créer Checklist', icon: Check, desc: 'Extraire les tâches' },
    { id: 'continue', label: 'Continuer', icon: Command, desc: 'Étendre le texte' },
];

// --- Components ---

const MarkdownRenderer: React.FC<{ content: string; maxLines?: number }> = ({ content, maxLines = 4 }) => {
    if (!content) return <span className="opacity-40 italic text-sm">Note vide...</span>;
    const lines = content.split('\n').filter(l => l.trim());
    return (
        <div className="space-y-1 text-[13px] leading-relaxed">
            {lines.slice(0, maxLines).map((line, i) => {
                if (line.startsWith('# ')) return <div key={i} className="font-semibold text-sm">{line.replace('# ', '')}</div>;
                if (line.startsWith('- [ ]')) return <div key={i} className="flex items-center gap-2 opacity-70"><div className="w-3 h-3 border border-current rounded-sm opacity-50"></div><span className="truncate">{line.replace('- [ ]', '').trim()}</span></div>;
                if (line.startsWith('- [x]')) return <div key={i} className="flex items-center gap-2 opacity-50 line-through"><Check size={12} /><span className="truncate">{line.replace('- [x]', '').trim()}</span></div>;
                if (line.startsWith('- ')) return <div key={i} className="flex items-center gap-2 opacity-70"><span className="w-1 h-1 rounded-full bg-current"></span><span className="truncate">{line.replace('- ', '')}</span></div>;
                return <p key={i} className="truncate opacity-80">{line}</p>;
            })}
            {lines.length > maxLines && <div className="text-[10px] opacity-40 font-medium">+{lines.length - maxLines} lignes</div>}
        </div>
    );
};

const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const QuickNotes: React.FC = () => {
    // Undo support
    const pushUndo = useUndoStore((s) => s.pushUndo);

    // Data
    const [notes, setNotes] = useState<Note[]>([]);
    const [history, setHistory] = useState<Note[][]>([]);
    
    // UI
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    
    // Editor
    const [isEditing, setIsEditing] = useState(false);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    
    // Form
    const [formTitle, setFormTitle] = useState("");
    const [formContent, setFormContent] = useState("");
    const [activeThemeId, setActiveThemeId] = useState(NOTE_THEMES[0].id);
    const [isPinned, setIsPinned] = useState(false);

    // AI & Voice
    const [isListening, setIsListening] = useState(false);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [showAIMenu, setShowAIMenu] = useState(false);
    const [showColorMenu, setShowColorMenu] = useState(false);
    
    const recognitionRef = useRef<any>(null);
    const activeTheme = NOTE_THEMES.find(t => t.id === activeThemeId) || NOTE_THEMES[0];

    // --- Logic ---

    const fetchNotes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/notes');
            const data = await res.json();
            if (data.notes) {
                const enriched = data.notes.map((n: any) => ({
                    ...n,
                    theme: NOTE_THEMES.find(t => n.color?.includes(t.id) || n.theme === t.id)?.id || 'pearl'
                }));
                setNotes(enriched);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchNotes(); }, []);

    const saveToHistory = () => setHistory(prev => [notes, ...prev].slice(0, 10));
    const handleUndo = () => { if(history.length > 0) { setNotes(history[0]); setHistory(prev => prev.slice(1)); } };

    const handleSave = async () => {
        saveToHistory();
        const newNote: Note = {
            id: selectedNote?.id || `n-${Date.now()}`,
            title: formTitle || 'Sans titre',
            content: formContent,
            theme: activeThemeId,
            date: new Date().toISOString(),
            pinned: isPinned
        };

        if (selectedNote) setNotes(notes.map(n => n.id === newNote.id ? newNote : n));
        else setNotes([newNote, ...notes]);

        setIsEditing(false);

        try {
            await fetch('/api/v1/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newNote, color: activeThemeId })
            });
        } catch (e) { console.error("Save failed", e); }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const note = notes.find(n => n.id === id);
        if (!note) return;
        const previousNotes = [...notes];
        saveToHistory();
        setNotes(notes.filter(n => n.id !== id));
        if (selectedNote?.id === id) setIsEditing(false);
        try { await fetch(`/api/v1/notes?id=${id}`, { method: 'DELETE' }); } catch (err) {}
        pushUndo({
            description: `Note "${note.title || 'Sans titre'}" supprimée`,
            restore: async () => {
                setNotes(previousNotes);
                // Re-create on server
                try {
                    await fetch('/api/v1/notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(note),
                    });
                } catch { /* ignore */ }
            },
        });
    };

    const handleTogglePin = async (note: Note, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const updated = { ...note, pinned: !note.pinned };
        setNotes(notes.map(n => n.id === note.id ? updated : n));
        try {
            await fetch('/api/v1/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updated, color: updated.theme })
            });
        } catch (e) {}
    };

    // --- AI ---
    const handleAIAction = async (action: string) => {
        if (!formContent) return;
        setIsProcessingAI(true);
        try {
            const res = await fetch('/api/v1/notes/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: formContent, action })
            });
            const data = await res.json();
            if (data.success) {
                if (action === 'continue') setFormContent(prev => prev + " " + data.result);
                else setFormContent(data.result);
                setShowAIMenu(false);
            }
        } catch (e) { alert("Erreur IA"); } finally { setIsProcessingAI(false); }
    };

    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            alert("Dictée non supportée."); return;
        }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'fr-FR';
            recognitionRef.current.onresult = (event: any) => {
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
                }
                if (final) setFormContent(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + final);
            };
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    // --- Editor ---
    const openNew = () => {
        setFormTitle(""); setFormContent(""); setActiveThemeId('pearl'); setIsPinned(false); setSelectedNote(null); setIsEditing(true);
    };
    const openEdit = (n: Note) => {
        setFormTitle(n.title); setFormContent(n.content); setActiveThemeId(n.theme || 'pearl'); setIsPinned(n.pinned || false); setSelectedNote(n); setIsEditing(true);
    };

    // --- Views ---
    const filteredNotes = useMemo(() => {
        return notes
            .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (a.pinned === b.pinned ? new Date(b.date).getTime() - new Date(a.date).getTime() : a.pinned ? -1 : 1));
    }, [notes, searchQuery]);

    const pinnedNotes = filteredNotes.filter(n => n.pinned);
    const recentNotes = filteredNotes.filter(n => !n.pinned);

    return (
        <div className="flex flex-col h-full min-h-[600px] relative bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-eonora-gradient flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-none">
                            <StickyNote size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Notes</h2>
                            <p className="text-xs text-slate-400">{notes.length} notes • {pinnedNotes.length} épinglées</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {history.length > 0 && (
                            <button onClick={handleUndo} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <Undo2 size={18}/>
                            </button>
                        )}
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                            <button 
                                onClick={() => setViewMode('grid')} 
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}
                            >
                                <Grid size={16} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')} 
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                        <button 
                            onClick={openNew} 
                            className="bg-eonora-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                        >
                            <Plus size={18} /> Nouvelle
                        </button>
                    </div>
                </div>
                
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher dans vos notes..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-100/80 dark:bg-slate-800/50 border border-transparent focus:border-orange-300 dark:focus:border-orange-700 rounded-2xl outline-none transition-all text-sm"
                    />
                </div>
            </div>

            {/* Notes Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#b05070]/15 to-[#4a72c4]/15 dark:from-[#b05070]/25 dark:to-[#4a72c4]/25 flex items-center justify-center animate-pulse">
                            <StickyNote size={24} className="text-eo-rose" />
                        </div>
                        <p className="text-sm text-slate-400">Chargement des notes...</p>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                            <StickyNote size={36} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">Aucune note</p>
                            <p className="text-sm text-slate-400">Commencez par créer votre première note</p>
                        </div>
                        <button 
                            onClick={openNew}
                            className="mt-2 px-5 py-2.5 bg-eonora-gradient text-white rounded-xl font-medium text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            <Plus size={16} /> Créer une note
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Pinned Section */}
                        {pinnedNotes.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <Pin size={14} className="text-orange-500" />
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Épinglées</span>
                                </div>
                                <div className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                                    {pinnedNotes.map(note => (
                                        <NoteCard key={note.id} note={note} viewMode={viewMode} onOpen={openEdit} onDelete={handleDelete} onTogglePin={handleTogglePin} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent Section */}
                        {recentNotes.length > 0 && (
                            <div>
                                {pinnedNotes.length > 0 && (
                                    <div className="flex items-center gap-2 mb-3 px-1">
                                        <Clock size={14} className="text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Récentes</span>
                                    </div>
                                )}
                                <div className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                                    {recentNotes.map(note => (
                                        <NoteCard key={note.id} note={note} viewMode={viewMode} onOpen={openEdit} onDelete={handleDelete} onTogglePin={handleTogglePin} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Editor Overlay */}
            {isEditing && (
                <div className={`absolute inset-0 z-50 flex flex-col ${activeTheme.bg} ${activeTheme.text} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
                    
                    {/* Editor Header */}
                    <div className={`px-6 py-4 flex justify-between items-center border-b ${activeTheme.border} bg-white/50 dark:bg-black/20 backdrop-blur-sm`}>
                        <button 
                            onClick={() => setIsEditing(false)} 
                            className="flex items-center gap-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <ArrowLeft size={18} /> Retour
                        </button>
                        
                        <div className="flex items-center gap-3 text-xs opacity-50">
                            <Clock size={14} />
                            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <span>•</span>
                            <span>{formContent.length} caractères</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsPinned(!isPinned)} 
                                className={`p-2.5 rounded-xl transition-all ${isPinned ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 dark:shadow-none' : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-60 hover:opacity-100'}`}
                            >
                                <Pin size={18} />
                            </button>
                            <button 
                                onClick={handleSave} 
                                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                            >
                                <Save size={16} /> Sauvegarder
                            </button>
                        </div>
                    </div>

                    {/* Editor Content */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-2xl mx-auto py-12 px-6">
                            <input 
                                className="w-full text-4xl lg:text-5xl font-bold bg-transparent border-none outline-none placeholder:opacity-20 mb-8 leading-tight"
                                placeholder="Titre de la note..."
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                            />
                            <textarea 
                                className="w-full min-h-[50vh] bg-transparent border-none outline-none text-lg leading-relaxed resize-none placeholder:opacity-20"
                                placeholder="Commencez à écrire... Utilisez # pour les titres, - pour les listes"
                                value={formContent}
                                onChange={e => setFormContent(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Floating Toolbar */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
                        <div className="flex items-center gap-1 p-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl rounded-2xl">
                            
                            {/* Theme Picker */}
                            <div className="relative">
                                <button 
                                    onClick={() => { setShowColorMenu(!showColorMenu); setShowAIMenu(false); }} 
                                    className={`p-3 rounded-xl transition-all ${showColorMenu ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <div className="w-5 h-5 rounded-lg" style={{ background: activeTheme.accent }}></div>
                                </button>
                                {showColorMenu && (
                                    <div className="absolute bottom-full mb-3 left-0 flex gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-bottom-2">
                                        {NOTE_THEMES.map(t => (
                                            <button 
                                                key={t.id} 
                                                onClick={() => { setActiveThemeId(t.id); setShowColorMenu(false); }}
                                                className={`group relative w-8 h-8 rounded-xl transition-all hover:scale-110 ${activeThemeId === t.id ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                                                style={{ background: t.accent }}
                                                title={t.name}
                                            >
                                                {activeThemeId === t.id && <Check size={14} className="absolute inset-0 m-auto text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                            {/* Voice */}
                            <button 
                                onClick={toggleListening} 
                                className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                            >
                                <Mic size={20} />
                            </button>

                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                            {/* AI Magic */}
                            <div className="relative">
                                <button 
                                    onClick={() => { setShowAIMenu(!showAIMenu); setShowColorMenu(false); }}
                                    disabled={!formContent}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
                                >
                                    {isProcessingAI ? <Wand2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    <span>IA</span>
                                    <ChevronDown size={14} className={`transition-transform ${showAIMenu ? 'rotate-180' : ''}`} />
                                </button>
                                {showAIMenu && !isProcessingAI && (
                                    <div className="absolute bottom-full mb-3 right-0 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2">
                                        {AI_ACTIONS.map(action => (
                                            <button
                                                key={action.id}
                                                onClick={() => handleAIAction(action.id)}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                    <action.icon size={16} className="text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{action.label}</div>
                                                    <div className="text-[10px] text-slate-400">{action.desc}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

// --- Note Card Component ---
interface NoteCardProps {
    note: Note;
    viewMode: 'grid' | 'list';
    onOpen: (note: Note) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    onTogglePin: (note: Note, e?: React.MouseEvent) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, viewMode, onOpen, onDelete, onTogglePin }) => {
    const theme = NOTE_THEMES.find(t => t.id === note.theme) || NOTE_THEMES[0];
    
    if (viewMode === 'list') {
        return (
            <div 
                onClick={() => onOpen(note)}
                className={`group relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${theme.bg} border ${theme.border}`}
            >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: theme.accent }}></div>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate ${theme.text}`}>{note.title}</h3>
                    <p className={`text-xs truncate opacity-60 ${theme.text}`}>{note.content || 'Note vide'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeDate(note.date)}</span>
                    <button onClick={(e) => onTogglePin(note, e)} className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${note.pinned ? 'text-orange-500' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Pin size={14} className={note.pinned ? 'fill-current' : ''} />
                    </button>
                    <button onClick={(e) => onDelete(note.id, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div 
            onClick={() => onOpen(note)}
            className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${theme.bg} border ${theme.border}`}
        >
            {/* Pin indicator */}
            {note.pinned && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                    <Pin size={12} className="text-white fill-current" />
                </div>
            )}
            
            {/* Content */}
            <div className="mb-3">
                <h3 className={`font-semibold text-base mb-2 pr-4 line-clamp-2 ${theme.text}`}>{note.title}</h3>
                <div className={theme.text}>
                    <MarkdownRenderer content={note.content} maxLines={4} />
                </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100/50 dark:border-slate-700/50">
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock size={10} />
                    {formatRelativeDate(note.date)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => onTogglePin(note, e)} 
                        className={`p-1.5 rounded-lg transition-colors ${note.pinned ? 'text-orange-500' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                    >
                        <Pin size={14} className={note.pinned ? 'fill-current' : ''} />
                    </button>
                    <button 
                        onClick={(e) => onDelete(note.id, e)} 
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
