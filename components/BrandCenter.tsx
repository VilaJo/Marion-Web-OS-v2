import React, { useState, useRef } from 'react';
import { Project, BrandColor, BrandFont } from '../types';
import { X, Plus, Trash2, Wand2, Palette, Type, Download, Eye, Check, AlertTriangle, Copy, RefreshCw, LayoutTemplate, FileText, Image as ImageIcon } from 'lucide-react';
import { Modal, Card } from './Shared';
import { printElementAsPdf } from '../utils/pdfExport';

declare const confetti: any;

interface BrandCenterProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onUpdate: (updated: Project) => void;
}

// --- Helper: Contrast Calculation ---
const getLuminance = (hex: string) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

const getContrastRatio = (hex1: string, hex2: string) => {
    const lum1 = getLuminance(hex1);
    const lum2 = getLuminance(hex2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
};

const ContrastBadge = ({ ratio }: { ratio: number }) => {
    let grade = 'Fail';
    let color = 'bg-red-500';
    
    if (ratio >= 7) { grade = 'AAA'; color = 'bg-emerald-500'; }
    else if (ratio >= 4.5) { grade = 'AA'; color = 'bg-green-500'; }
    else if (ratio >= 3) { grade = 'AA Large'; color = 'bg-yellow-500'; }

    return (
        <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${color}`}>
            {grade} ({ratio.toFixed(1)})
        </span>
    );
};

// Familles de polices courantes (web + système) pour le menu déroulant et l'autocomplétion
const FONT_FAMILIES = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Source Sans 3', 'Nunito', 'Raleway',
    'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Georgia', 'Times New Roman',
    'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Manrope', 'Figtree', 'Space Grotesk', 'Sora',
    'Work Sans', 'IBM Plex Sans', 'Lexend', 'Urbanist', 'Rubik', 'Quicksand', 'Karla',
    'Bebas Neue', 'Oswald', 'Barlow', 'Jost', 'Cormorant Garamond', 'Libre Baskerville',
    'Fira Sans', 'Ubuntu', 'Noto Sans', 'Roboto Condensed', 'Bitter', 'Fraunces',
    'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Inconsolata',
    'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'system-ui', 'sans-serif', 'serif'
].sort((a, b) => a.localeCompare(b));

export const BrandCenter: React.FC<BrandCenterProps> = ({ isOpen, onClose, project, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'colors' | 'typo' | 'export'>('colors');
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [openFontFamilyIdx, setOpenFontFamilyIdx] = useState<number | null>(null);
    
    // Local state for editing before save
    const [colors, setColors] = useState<BrandColor[]>(project.brandKit?.colors || []);
    const [fonts, setFonts] = useState<BrandFont[]>(project.brandKit?.fonts || []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        onUpdate({
            ...project,
            brandKit: { colors, fonts }
        });
        confetti({ particleCount: 50, spread: 60, colors: colors.map(c => c.hex) });
        onClose();
    };

    // --- Color Logic ---
    const addColor = () => setColors([...colors, { name: 'New Color', hex: '#000000' }]);
    const removeColor = (idx: number) => setColors(colors.filter((_, i) => i !== idx));
    const updateColor = (idx: number, field: keyof BrandColor, value: string) => {
        const newColors = [...colors];
        // @ts-ignore
        newColors[idx][field] = value;
        setColors(newColors);
    };

    const handleCopyColor = (hex: string) => {
        if (!hex) return;
        try {
            navigator.clipboard.writeText(hex);
            // Petit feedback visuel discret
            confetti?.({ particleCount: 16, spread: 40, origin: { x: 0.1, y: 0.1 } });
        } catch (e) {
            console.error('Clipboard error', e);
        }
    };

    const extractFromLogo = async () => {
        if (!project.avatarImage && !fileInputRef.current?.files?.[0]) {
            alert("Il faut une image de profil ou uploader un fichier.");
            return;
        }

        setIsExtracting(true);
        const formData = new FormData();
        
        // Priority to uploaded file, else convert base64 avatar to blob?
        // For simplicity in this demo, we'll ask user to upload logo if not present or re-upload to be sure.
        // Or better: Trigger the file input click.
        if (!fileInputRef.current?.files?.[0]) {
            fileInputRef.current?.click();
            setIsExtracting(false);
            return;
        }

        formData.append('file', fileInputRef.current.files[0]);

        try {
            const res = await fetch('/api/v1/media/palette', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const newExtractedColors = data.palette.map((hex: string, i: number) => ({
                    name: i === 0 ? 'Primary' : i === 1 ? 'Secondary' : `Accent ${i-1}`,
                    hex: hex
                }));
                // Merge or Replace? Let's append.
                setColors([...colors, ...newExtractedColors]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) extractFromLogo();
    };

    // --- Font Logic ---
    const addFont = () => setFonts([...fonts, { name: 'Raleway', type: 'Sans-Serif', usage: 'Body' }]);
    const removeFont = (idx: number) => setFonts(fonts.filter((_, i) => i !== idx));
    const updateFont = (idx: number, field: keyof BrandFont, value: string) => {
        const newFonts = [...fonts];
        // @ts-ignore
        newFonts[idx][field] = value;
        setFonts(newFonts);
    };

    // --- Export Logic ---
    const generateCSS = () => {
        const vars = colors.map(c => `  --color-${c.name.toLowerCase().replace(/\s/g, '-')}: ${c.hex};`).join('\n');
        return `:root {\n${vars}\n}`;
    };

    const getSlug = () => {
        return (project.clientName || 'brand-kit')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'brand-kit';
    };

    const handleDownloadJSON = () => {
        const payload = {
            client: project.clientName,
            brandKit: {
                colors,
                fonts,
            },
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const slug = getSlug();

        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}-brand-kit.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleGeneratePDF = async () => {
        setIsExportingPDF(true);
        // Laisse le temps au DOM de peindre le bloc caché
        setTimeout(async () => {
            const element = document.getElementById('brand-pdf');
            if (!element) {
                setIsExportingPDF(false);
                alert("Impossible de trouver le contenu à exporter.");
                return;
            }
            const slug = getSlug();
            try {
                await printElementAsPdf(element, `${slug}-brand-kit.pdf`, { pageMarginMm: 0 });
            } catch (e) {
                console.error(e);
                alert("Erreur lors de la génération du PDF Brand Center.");
            } finally {
                setIsExportingPDF(false);
            }
        }, 300);
    };

    // --- Logo Export Variations ---
    const handleExportLogoVariations = async () => {
        if (!project.avatarImage) {
            alert("Aucun logo défini pour ce projet. Uploadez d'abord une image.");
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = project.avatarImage;

        img.onload = () => {
            const sizes = [
                { name: 'logo-color', size: 512, filter: null },
                { name: 'logo-white', size: 512, filter: 'brightness(0) invert(1)' },
                { name: 'logo-black', size: 512, filter: 'brightness(0)' },
                { name: 'favicon', size: 32, filter: null },
                { name: 'favicon-192', size: 192, filter: null },
                { name: 'favicon-512', size: 512, filter: null },
            ];

            const slug = getSlug();

            sizes.forEach(({ name, size, filter }) => {
                canvas.width = size;
                canvas.height = size;
                ctx.clearRect(0, 0, size, size);
                
                if (filter) {
                    ctx.filter = filter;
                } else {
                    ctx.filter = 'none';
                }

                // Draw centered and scaled
                const scale = Math.min(size / img.width, size / img.height);
                const x = (size - img.width * scale) / 2;
                const y = (size - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                // Download
                const link = document.createElement('a');
                link.download = `${slug}-${name}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            });

            confetti({ particleCount: 50, spread: 60 });
        };

        img.onerror = () => {
            alert("Erreur lors du chargement du logo.");
        };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" width="max-w-5xl">
            <div className="flex flex-col h-[80vh] relative">
                {/* Header */}
                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <LayoutTemplate size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Brand Center</h2>
                            <p className="text-sm text-slate-500">Gérez l'identité visuelle de {project.clientName}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">Annuler</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-brand-orange text-white rounded-lg font-bold hover:scale-105 transition-transform shadow-lg">Sauvegarder</button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 space-y-2">
                        <button 
                            onClick={() => setActiveTab('colors')}
                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors ${activeTab === 'colors' ? 'bg-slate-100 dark:bg-slate-700 text-brand-orange' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <Palette size={18} /> Couleurs & Accessibilité
                        </button>
                        <button 
                            onClick={() => setActiveTab('typo')}
                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors ${activeTab === 'typo' ? 'bg-slate-100 dark:bg-slate-700 text-brand-orange' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <Type size={18} /> Typographie
                        </button>
                        <button 
                            onClick={() => setActiveTab('export')}
                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors ${activeTab === 'export' ? 'bg-slate-100 dark:bg-slate-700 text-brand-orange' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <Download size={18} /> Export Dev
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900">
                        
                        {/* --- COLORS TAB --- */}
                        {activeTab === 'colors' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Palette</h3>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isExtracting}
                                            className="px-4 py-2 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-xs font-bold hover:bg-purple-100 flex items-center gap-2"
                                        >
                                            {isExtracting ? <RefreshCw className="animate-spin" size={14} /> : <Wand2 size={14} />}
                                            Extraire via IA
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
                                        <button onClick={addColor} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-2">
                                            <Plus size={14} /> Ajouter
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {colors.map((color, idx) => (
                                        <div key={idx} className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4 group bg-slate-50 dark:bg-slate-800/50">
                                            <div className="relative">
                                                <input 
                                                    type="color" 
                                                    value={color.hex}
                                                    onChange={(e) => updateColor(idx, 'hex', e.target.value)}
                                                    className="w-12 h-12 rounded-xl cursor-pointer opacity-0 absolute inset-0 z-10"
                                                />
                                                <div className="w-12 h-12 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600" style={{ backgroundColor: color.hex }}></div>
                                            </div>
                                            <div className="flex-1">
                                                <input 
                                                    value={color.name}
                                                    onChange={(e) => updateColor(idx, 'name', e.target.value)}
                                                    className="w-full bg-transparent font-bold text-sm text-slate-700 dark:text-slate-200 outline-none mb-1"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        value={color.hex}
                                                        onChange={(e) => updateColor(idx, 'hex', e.target.value)}
                                                        className="w-full bg-transparent tabular-nums text-xs text-slate-400 outline-none uppercase"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyColor(color.hex)}
                                                        className="p-1.5 rounded-full text-slate-300 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Copier le code couleur"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <button onClick={() => removeColor(idx)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Eye size={20} className="text-blue-500" /> Contrôleur d'Accessibilité (WCAG)
                                    </h3>
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="text-left p-2 text-xs text-slate-400 font-normal">TEXTE \ FOND</th>
                                                    {colors.map((bg, i) => (
                                                        <th key={i} className="p-2">
                                                            <div className="w-8 h-8 rounded mx-auto border border-slate-200" style={{ backgroundColor: bg.hex }} title={bg.name}></div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {colors.map((text, i) => (
                                                    <tr key={i}>
                                                        <td className="p-2 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                                                            <div className="w-4 h-4 rounded border border-slate-200" style={{ backgroundColor: text.hex }}></div>
                                                            {text.name}
                                                        </td>
                                                        {colors.map((bg, j) => {
                                                            if (i === j) return <td key={j} className="text-center p-2 opacity-20">-</td>;
                                                            const ratio = getContrastRatio(text.hex, bg.hex);
                                                            return (
                                                                <td key={j} className="text-center p-2">
                                                                    <ContrastBadge ratio={ratio} />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TYPO TAB --- */}
                        {activeTab === 'typo' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Typographie</h3>
                                    <button onClick={addFont} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-2">
                                        <Plus size={14} /> Ajouter
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {fonts.map((font, idx) => (
                                        <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50/50 dark:bg-slate-800/50 relative group">
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100">
                                                <button onClick={() => removeFont(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div className="relative">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Famille</label>
                                                    <input 
                                                        value={font.name}
                                                        onChange={(e) => updateFont(idx, 'name', e.target.value)}
                                                        onFocus={() => setOpenFontFamilyIdx(idx)}
                                                        onBlur={() => setTimeout(() => setOpenFontFamilyIdx(null), 180)}
                                                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold outline-none"
                                                        placeholder="Ex: Montserrat, Raleway..."
                                                        autoComplete="off"
                                                    />
                                                    {openFontFamilyIdx === idx && (
                                                        <div 
                                                            className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl py-1"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            {FONT_FAMILIES
                                                                .filter(f => f.toLowerCase().includes((font.name || '').toLowerCase()))
                                                                .map((fam) => (
                                                                    <button
                                                                        key={fam}
                                                                        type="button"
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            updateFont(idx, 'name', fam);
                                                                            setOpenFontFamilyIdx(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                                        style={{ fontFamily: fam }}
                                                                    >
                                                                        {fam}
                                                                    </button>
                                                                ))}
                                                            {FONT_FAMILIES.filter(f => f.toLowerCase().includes((font.name || '').toLowerCase())).length === 0 && (
                                                                <div className="px-3 py-2 text-sm text-slate-400">Aucune correspondance</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
                                                    <select 
                                                        value={font.type}
                                                        onChange={(e) => updateFont(idx, 'type', e.target.value as any)}
                                                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none"
                                                    >
                                                        <option>Sans-Serif</option>
                                                        <option>Serif</option>
                                                        <option>Display</option>
                                                        <option>Mono</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Usage</label>
                                                    <select 
                                                        value={font.usage}
                                                        onChange={(e) => updateFont(idx, 'usage', e.target.value as any)}
                                                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none"
                                                    >
                                                        <option>Title</option>
                                                        <option>Body</option>
                                                        <option>Accent</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Live Preview */}
                                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                                <div style={{ fontFamily: font.name }}>
                                                    <div className="text-3xl font-bold mb-2 truncate" style={{ fontStyle: font.type === 'Serif' ? 'italic' : 'normal' }}>The quick brown fox jumps over the lazy dog.</div>
                                                    <div className="text-base opacity-80 truncate">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* --- EXPORT TAB --- */}
                        {activeTab === 'export' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Export Développeur</h3>
                                
                                <div className="bg-slate-900 rounded-2xl p-6 relative group">
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText(generateCSS()); confetti({ particleCount: 30 }); }}
                                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                        title="Copier"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <pre className="tabular-nums text-sm text-emerald-400 overflow-x-auto">
                                        {generateCSS()}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <Card 
                                        className="p-4 border-dashed border-2 border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-brand-orange hover:text-brand-orange cursor-pointer transition-colors"
                                        onClick={handleDownloadJSON}
                                    >
                                        <Download size={24} className="mb-2" />
                                        <span className="font-bold">Télécharger JSON</span>
                                        <span className="mt-1 text-[11px] text-slate-400 text-center">
                                            Palette + typos au format exploitable
                                        </span>
                                    </Card>
                                    <Card 
                                        className={`p-4 border-dashed border-2 border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-brand-orange hover:text-brand-orange cursor-pointer transition-colors ${isExportingPDF ? 'opacity-70' : ''}`}
                                        onClick={isExportingPDF ? undefined : handleGeneratePDF}
                                    >
                                        {isExportingPDF ? (
                                            <RefreshCw size={24} className="mb-2 animate-spin" />
                                        ) : (
                                            <FileText size={24} className="mb-2" />
                                        )}
                                        <span className="font-bold">Générer PDF</span>
                                        <span className="mt-1 text-[11px] text-slate-400 text-center">
                                            Spec complète + Recettes UI
                                        </span>
                                    </Card>
                                    <Card 
                                        className={`p-4 border-dashed border-2 border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-purple-500 hover:text-purple-500 cursor-pointer transition-colors ${!project.avatarImage ? 'opacity-50' : ''}`}
                                        onClick={project.avatarImage ? handleExportLogoVariations : undefined}
                                    >
                                        <ImageIcon size={24} className="mb-2" />
                                        <span className="font-bold">Export Logo</span>
                                        <span className="mt-1 text-[11px] text-slate-400 text-center">
                                            Couleur, noir, blanc, favicon
                                        </span>
                                    </Card>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Hidden PDF layout for Brand Kit export */}
                <div
                    id="brand-pdf"
                    className="bg-white text-slate-900"
                    style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', minHeight: '297mm', padding: '20mm' }}
                >
                    <h1 className="text-2xl font-bold mb-1">Brand Kit – {project.clientName}</h1>
                    <p className="text-xs text-slate-500 mb-6">
                        Généré depuis Marion Web OS – section Brand Center.
                    </p>

                    <section className="mb-8">
                        <h2 className="text-base font-semibold mb-3">1. Couleurs</h2>
                        {colors.length === 0 ? (
                            <p className="text-xs text-slate-500">Aucune couleur définie.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {colors.map((c, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-md border border-slate-200"
                                            style={{ backgroundColor: c.hex }}
                                        />
                                        <div>
                                            <div className="text-sm font-semibold">{c.name}</div>
                                            <div className="text-xs tabular-nums text-slate-500">{c.hex}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="mb-8">
                        <h2 className="text-base font-semibold mb-3">2. Typographies</h2>
                        {fonts.length === 0 ? (
                            <p className="text-xs text-slate-500">Aucune typographie définie.</p>
                        ) : (
                            <div className="space-y-3">
                                {fonts.map((f, idx) => (
                                    <div key={idx} className="border border-slate-200 rounded-md p-3">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold">{f.name}</span>
                                            <span className="text-xs text-slate-500">
                                                {f.type} • {f.usage}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600" style={{ fontFamily: f.name }}>
                                            The quick brown fox jumps over the lazy dog 0123456789
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="mb-8">
                        <h2 className="text-base font-semibold mb-3">3. Variables CSS</h2>
                        <pre className="text-[10px] leading-snug bg-slate-50 border border-slate-200 rounded-md p-3 whitespace-pre-wrap">
{generateCSS()}
                        </pre>
                    </section>

                    {/* Section 4: Recettes UI */}
                    <section style={{ pageBreakBefore: 'always' }}>
                        <h2 className="text-base font-semibold mb-4">4. Recettes UI</h2>
                        <p className="text-xs text-slate-500 mb-6">Exemples de composants utilisant l'identité visuelle définie.</p>
                        
                        {/* Buttons */}
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold mb-3">Boutons</h3>
                            <div className="flex flex-wrap gap-3">
                                {colors.slice(0, 3).map((c, idx) => (
                                    <div key={idx} className="flex flex-col gap-2">
                                        <button
                                            style={{ 
                                                backgroundColor: c.hex, 
                                                color: getLuminance(c.hex) > 0.5 ? '#1a1a1a' : '#ffffff',
                                                fontFamily: fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                                padding: '10px 24px',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                fontSize: '14px',
                                                border: 'none'
                                            }}
                                        >
                                            Bouton {c.name}
                                        </button>
                                        <button
                                            style={{ 
                                                backgroundColor: 'transparent', 
                                                color: c.hex,
                                                fontFamily: fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                                padding: '10px 24px',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                fontSize: '14px',
                                                border: `2px solid ${c.hex}`
                                            }}
                                        >
                                            Outline {c.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cards */}
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold mb-3">Cartes</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div 
                                    style={{ 
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        padding: '20px',
                                        backgroundColor: '#ffffff'
                                    }}
                                >
                                    <div 
                                        style={{ 
                                            fontFamily: fonts.find(f => f.usage === 'Title')?.name || 'Montserrat',
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            marginBottom: '8px',
                                            color: colors[0]?.hex || '#1a1a1a'
                                        }}
                                    >
                                        Titre de la carte
                                    </div>
                                    <div 
                                        style={{ 
                                            fontFamily: fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                            fontSize: '13px',
                                            color: '#64748b',
                                            lineHeight: 1.5
                                        }}
                                    >
                                        Description courte du contenu de cette carte. Utilise la typographie Body et les couleurs de la marque.
                                    </div>
                                </div>
                                <div 
                                    style={{ 
                                        borderRadius: '12px',
                                        padding: '20px',
                                        backgroundColor: colors[0]?.hex || '#1a1a1a',
                                        color: getLuminance(colors[0]?.hex || '#1a1a1a') > 0.5 ? '#1a1a1a' : '#ffffff'
                                    }}
                                >
                                    <div 
                                        style={{ 
                                            fontFamily: fonts.find(f => f.usage === 'Title')?.name || 'Montserrat',
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            marginBottom: '8px'
                                        }}
                                    >
                                        Carte colorée
                                    </div>
                                    <div 
                                        style={{ 
                                            fontFamily: fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                            fontSize: '13px',
                                            opacity: 0.9,
                                            lineHeight: 1.5
                                        }}
                                    >
                                        Variante avec fond coloré utilisant la couleur primaire de la marque.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hero Block */}
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold mb-3">Bloc Hero</h3>
                            <div 
                                style={{ 
                                    borderRadius: '16px',
                                    padding: '40px',
                                    background: colors.length >= 2 
                                        ? `linear-gradient(135deg, ${colors[0].hex} 0%, ${colors[1].hex} 100%)`
                                        : colors[0]?.hex || '#667eea',
                                    color: '#ffffff',
                                    textAlign: 'center'
                                }}
                            >
                                <div 
                                    style={{ 
                                        fontFamily: fonts.find(f => f.usage === 'Title')?.name || 'Montserrat',
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        marginBottom: '12px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    Titre principal du Hero
                                </div>
                                <div 
                                    style={{ 
                                        fontFamily: fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                        fontSize: '14px',
                                        opacity: 0.9,
                                        marginBottom: '20px',
                                        maxWidth: '400px',
                                        marginLeft: 'auto',
                                        marginRight: 'auto'
                                    }}
                                >
                                    Sous-titre ou description accrocheuse pour captiver l'attention des visiteurs.
                                </div>
                                <button
                                    style={{ 
                                        backgroundColor: '#ffffff',
                                        color: colors[0]?.hex || '#667eea',
                                        fontFamily: fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                        padding: '12px 32px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                        border: 'none',
                                        boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                                    }}
                                >
                                    Appel à l'action
                                </button>
                            </div>
                        </div>

                        {/* Typography Scale */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3">Échelle typographique</h3>
                            <div className="space-y-2 border border-slate-200 rounded-lg p-4">
                                {[
                                    { label: 'H1', size: '32px', weight: 700 },
                                    { label: 'H2', size: '24px', weight: 700 },
                                    { label: 'H3', size: '20px', weight: 600 },
                                    { label: 'Body', size: '16px', weight: 400 },
                                    { label: 'Small', size: '14px', weight: 400 },
                                    { label: 'Caption', size: '12px', weight: 500 },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-baseline gap-4">
                                        <span className="text-[10px] text-slate-400 w-12">{item.label}</span>
                                        <span 
                                            style={{ 
                                                fontFamily: item.label.startsWith('H') 
                                                    ? fonts.find(f => f.usage === 'Title')?.name || 'Montserrat'
                                                    : fonts.find(f => f.usage === 'Body')?.name || 'Raleway',
                                                fontSize: item.size,
                                                fontWeight: item.weight,
                                                color: '#1a1a1a'
                                            }}
                                        >
                                            {project.clientName || 'Exemple de texte'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </Modal>
    );
};
