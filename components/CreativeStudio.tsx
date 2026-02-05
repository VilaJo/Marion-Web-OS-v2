import React, { useState, useEffect } from 'react';
import { Palette, Type, Plus, Trash2, Copy, Check, Layout, Grid, Maximize2, X, RefreshCw, Sliders, ExternalLink } from 'lucide-react';
import { Project, MoodboardColor, MoodboardFont, MoodboardImage } from '../types';

interface CreativeStudioProps {
    project: Project;
    onUpdate: (project: Project) => void;
    onNotify: (title: string, message: string) => void;
}

export const CreativeStudio: React.FC<CreativeStudioProps> = ({ project, onUpdate, onNotify }) => {
    const [activeSection, setActiveSection] = useState<'board' | 'identity'>('board');
    
    // Identity State
    const [newColor, setNewColor] = useState('#000000');
    const [newColorName, setNewColorName] = useState('');
    
    const [newFont, setNewFont] = useState('');
    const [fontCategory, setFontCategory] = useState('sans-serif');

    // Moodboard State
    const [dragActive, setDragActive] = useState(false);

    // --- COLOR LOGIC ---
    const handleAddColor = () => {
        if (!newColor) return;
        const newItem: MoodboardColor = { 
            id: `col-${Date.now()}`, 
            type: 'color', 
            hex: newColor, 
            name: newColorName || newColor 
        };
        const currentMoodboard = project.moodboard || [];
        onUpdate({ ...project, moodboard: [...currentMoodboard, newItem] });
        setNewColor('#000000');
        setNewColorName('');
        onNotify('Couleur ajoutée', `${newItem.name} ajouté à la palette.`);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        onNotify('Copié !', text);
    };

    // Helper to generate a lighter/darker shade
    const adjustColor = (color: string, amount: number) => {
        return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
    }

    // --- FONT LOGIC ---
    const handleAddFont = () => {
        if (!newFont) return;
        const newItem: MoodboardFont = {
            id: `font-${Date.now()}`,
            type: 'font',
            name: newFont,
            category: fontCategory as any
        };
        const currentMoodboard = project.moodboard || [];
        onUpdate({ ...project, moodboard: [...currentMoodboard, newItem] });
        setNewFont('');
        onNotify('Police ajoutée', `${newItem.name}`);
    };

    // --- IMAGE LOGIC ---
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newItem: MoodboardImage = {
                        id: `img-${Date.now()}`,
                        type: 'image',
                        url: event.target?.result as string,
                        name: file.name
                    };
                    const currentMoodboard = project.moodboard || [];
                    onUpdate({ ...project, moodboard: [...currentMoodboard, newItem] });
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const removeItem = (id: string) => {
        if (confirm('Supprimer cet élément ?')) {
            const currentMoodboard = project.moodboard || [];
            onUpdate({ ...project, moodboard: currentMoodboard.filter(i => i.id !== id) });
        }
    };

    const colors = (project.moodboard || []).filter(i => i.type === 'color') as MoodboardColor[];
    const fonts = (project.moodboard || []).filter(i => i.type === 'font') as MoodboardFont[];
    const images = (project.moodboard || []).filter(i => i.type === 'image') as MoodboardImage[];

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Toolbar Switcher */}
            <div className="flex justify-center">
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1">
                    <button 
                        onClick={() => setActiveSection('board')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeSection === 'board' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-orange' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layout size={16} /> Moodboard
                    </button>
                    <button 
                        onClick={() => setActiveSection('identity')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeSection === 'identity' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-orange' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Palette size={16} /> Identité (Couleurs & Typos)
                    </button>
                </div>
            </div>

            {/* --- MOODBOARD SECTION --- */}
            {activeSection === 'board' && (
                <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div 
                        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={handleDrop}
                        className={`relative min-h-[400px] border-2 border-dashed rounded-3xl transition-all duration-300 p-6 ${
                            dragActive 
                            ? 'border-brand-orange bg-orange-50/50 dark:bg-orange-900/20 scale-[1.01]' 
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30'
                        }`}
                    >
                        {images.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                                <Grid size={48} className="mb-4 opacity-20" />
                                <p className="font-serif text-lg text-slate-500">Le tableau est vide.</p>
                                <p className="text-sm">Glissez-déposez vos inspirations ici.</p>
                            </div>
                        ) : (
                            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                                {images.map(img => (
                                    <div key={img.id} className="relative group break-inside-avoid">
                                        <img src={img.url} alt="mood" className="w-full rounded-xl shadow-md transition-transform hover:scale-[1.02]" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                                            <button onClick={() => window.open(img.url, '_blank')} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-sm"><Maximize2 size={16}/></button>
                                            <button onClick={() => removeItem(img.id)} className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur-sm"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- IDENTITY SECTION --- */}
            {activeSection === 'identity' && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    
                    {/* COLORS */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif text-xl dark:text-white">Palette</h3>
                            <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={newColor} 
                                    onChange={e => setNewColor(e.target.value)}
                                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0" 
                                />
                                <input 
                                    placeholder="Nom (ex: Bleu Nuit)"
                                    value={newColorName}
                                    onChange={e => setNewColorName(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1 text-sm outline-none w-32 dark:text-white"
                                />
                                <button onClick={handleAddColor} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2 rounded-lg hover:opacity-80"><Plus size={16}/></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {colors.map(color => (
                                <div key={color.id} className="group relative bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex gap-4 overflow-hidden">
                                    {/* Main Color Swatch */}
                                    <div 
                                        className="w-24 h-24 rounded-xl shadow-inner flex items-center justify-center text-xs font-bold text-white/80 cursor-pointer hover:scale-105 transition-transform"
                                        style={{ backgroundColor: color.hex }}
                                        onClick={() => copyToClipboard(color.hex)}
                                    >
                                        HEX
                                    </div>
                                    
                                    {/* Info & Shades */}
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white">{color.name}</h4>
                                                <p className="text-xs text-slate-400 font-mono uppercase">{color.hex}</p>
                                            </div>
                                            <button onClick={() => removeItem(color.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                        </div>
                                        
                                        {/* Auto Generated Shades */}
                                        <div className="flex gap-2 mt-2">
                                            {[20, 40, 60, -20, -40].map((adj, i) => {
                                                const shade = adjustColor(color.hex, adj);
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className="h-6 flex-1 rounded-md cursor-pointer hover:scale-110 transition-transform shadow-sm"
                                                        style={{ backgroundColor: shade }}
                                                        title={shade}
                                                        onClick={() => copyToClipboard(shade)}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {colors.length === 0 && <div className="text-slate-400 italic text-center py-8">Aucune couleur définie.</div>}
                        </div>
                    </div>

                    {/* TYPOGRAPHY */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif text-xl dark:text-white">Typographie</h3>
                            <div className="flex gap-2">
                                <input 
                                    placeholder="Nom (ex: Inter)"
                                    value={newFont}
                                    onChange={e => setNewFont(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1 text-sm outline-none w-32 dark:text-white"
                                />
                                <select 
                                    value={fontCategory} 
                                    onChange={e => setFontCategory(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 text-xs outline-none dark:text-white"
                                >
                                    <option value="sans-serif">Sans</option>
                                    <option value="serif">Serif</option>
                                    <option value="display">Display</option>
                                    <option value="monospace">Mono</option>
                                </select>
                                <button onClick={handleAddFont} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2 rounded-lg hover:opacity-80"><Plus size={16}/></button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {fonts.map(font => (
                                <div key={font.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 relative group">
                                    <button onClick={() => removeItem(font.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                    
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                                            <Type size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg dark:text-white">{font.name}</h4>
                                            <span className="text-xs text-slate-400 uppercase tracking-widest">{font.category}</span>
                                        </div>
                                    </div>

                                    {/* Type Tester Simulation */}
                                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                                        <p className="text-3xl truncate dark:text-white" style={{ fontFamily: font.name, fontWeight: 700 }}>
                                            The quick brown fox
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed" style={{ fontFamily: font.name }}>
                                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
                                        </p>
                                    </div>
                                    
                                    {/* Google Fonts Link Hint */}
                                    <div className="mt-4 pt-2 border-t border-dashed border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        <span className="text-[10px] text-slate-400">Preview (Si installée localement)</span>
                                        <a 
                                            href={`https://fonts.google.com/specimen/${font.name.replace(' ', '+')}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-[10px] text-brand-orange hover:underline flex items-center gap-1"
                                        >
                                            Voir sur Google Fonts <ExternalLink size={10} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                            {fonts.length === 0 && <div className="text-slate-400 italic text-center py-8">Aucune police définie.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
