import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Wand2, RefreshCw, Check, Type, Square, Circle, Triangle, MousePointer2, Move, Trash2, Layers, Download, Save, Grid, ZoomIn, ZoomOut, Undo, Redo, Image as ImageIcon, Minus, X, Search, Code, Upload, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { sanitizeSVG } from '../utils/sanitize';

// Filter out non-icon exports from Lucide
const ICON_LIST = Object.keys(LucideIcons).filter(key => key !== 'createLucideIcon' && key !== 'default');

interface DesignElement {
    id: string;
    type: 'text' | 'icon' | 'shape' | 'image' | 'line' | 'svg' | 'rect' | 'circle' | 'triangle';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    text?: string;
    fontFamily?: string;
    fontWeight?: string;
    iconName?: string;
    url?: string;
    opacity?: number;
    svgContent?: string; // For raw imported SVG
}

interface LogoLabProps {
    clientName: string;
    initialData?: { elements: DesignElement[], bgColor: string };
    onSave: (svgDataUrl: string, logoData: { elements: DesignElement[], bgColor: string }) => void;
    onClose: () => void;
}

const POPULAR_ICONS = ['Star', 'Heart', 'Zap', 'Hexagon', 'Anchor', 'Award', 'Feather', 'Sun', 'Moon', 'Cloud', 'Music', 'Camera', 'Video', 'Smile'];

const FONTS = ['Montserrat', 'Raleway', 'Roboto', 'Lato', 'Open Sans', 'Oswald', 'Merriweather', 'Playfair Display', 'Courier New'];

export const LogoLab: React.FC<LogoLabProps> = ({ clientName, initialData, onSave, onClose }) => {
    const [mode, setMode] = useState<'design' | 'ai'>('design');
    
    // Load Fonts dynamically
    useEffect(() => {
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${FONTS.filter(f => f !== 'Courier New').map(f => f.replace(/ /g, '+')).join('&family=')}&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => { document.head.removeChild(link); };
    }, []);

    const [elements, setElements] = useState<DesignElement[]>(initialData?.elements || [
        { id: '1', type: 'text', text: clientName, x: 400, y: 300, width: 40, height: 0, rotation: 0, fill: '#000000', stroke: 'none', strokeWidth: 0, fontFamily: 'Montserrat', fontWeight: 'bold', opacity: 1 }
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(initialData ? null : '1');
    const [bgColor, setBgColor] = useState(initialData?.bgColor || '#ffffff');
    const [iconSearch, setIconSearch] = useState('');
    
    // Interaction State
    const [interaction, setInteraction] = useState<{
        type: 'moving' | 'resizing' | 'rotating' | null;
        startPos: { x: number, y: number };
        startEl: DesignElement | null;
        handle?: string; // nw, ne, sw, se for resize
    }>({ type: null, startPos: { x: 0, y: 0 }, startEl: null });

    // AI mode state
    const [aiSvg, setAiSvg] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateAiLogo = async () => {
        setIsGenerating(true);
        try {
            // Placeholder: generate a simple SVG logo with the client name
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="#6366f1"/><text x="100" y="110" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="sans-serif">${clientName.charAt(0).toUpperCase()}</text></svg>`;
            setAiSvg(svg);
        } catch (err) {
            console.error('AI logo generation failed:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const svgRef = useRef<SVGSVGElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- ELEMENT MANAGEMENT ---
    const addElement = (type: DesignElement['type'], iconName?: string, svgContent?: string) => {
        const id = Date.now().toString();
        const newEl: DesignElement = {
            id,
            type,
            x: 400,
            y: 300,
            width: type === 'text' ? 40 : 100,
            height: type === 'line' ? 4 : 100,
            rotation: 0,
            fill: '#000000',
            stroke: type === 'line' ? '#000000' : 'none',
            strokeWidth: type === 'line' ? 4 : 0,
            text: type === 'text' ? 'Texte' : undefined,
            fontFamily: 'Montserrat',
            fontWeight: 'normal',
            iconName,
            svgContent,
            opacity: 1
        };
        setElements(prev => [...prev, newEl]);
        setSelectedId(id);
    };

    const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const id = Date.now().toString();
                const newEl: DesignElement = {
                    id, type: 'image', x: 400, y: 300, width: 200, height: 200, rotation: 0,
                    fill: 'none', stroke: 'none', strokeWidth: 0, url: reader.result as string, opacity: 1
                };
                setElements(prev => [...prev, newEl]);
                setSelectedId(id);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImportSVG = () => {
        const code = prompt("Collez le code SVG ici :");
        if (code && code.includes('<svg')) {
            addElement('svg', undefined, code);
        }
    };

    const updateElement = (id: string, updates: Partial<DesignElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const deleteElement = () => {
        if (selectedId) {
            setElements(prev => prev.filter(el => el.id !== selectedId));
            setSelectedId(null);
        }
    };

    const moveLayer = (direction: 'up' | 'down' | 'top' | 'bottom') => {
        if (!selectedId) return;
        const idx = elements.findIndex(e => e.id === selectedId);
        if (idx === -1) return;
        
        const newElements = [...elements];
        const el = newElements[idx];
        
        if (direction === 'up' && idx < elements.length - 1) {
            [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
        } else if (direction === 'down' && idx > 0) {
            [newElements[idx], newElements[idx - 1]] = [newElements[idx - 1], newElements[idx]];
        } else if (direction === 'top') {
            newElements.splice(idx, 1);
            newElements.push(el);
        } else if (direction === 'bottom') {
            newElements.splice(idx, 1);
            newElements.unshift(el);
        }
        setElements(newElements);
    };

    // --- GEOMETRY HELPERS ---
    const getMouseCoords = (e: React.MouseEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        return {
            x: (e.clientX - CTM.e) / CTM.a,
            y: (e.clientY - CTM.f) / CTM.d
        };
    };

    // --- INTERACTION HANDLERS ---
    const handleMouseDown = (e: React.MouseEvent, id: string | null, type: 'moving' | 'resizing' | 'rotating', handle?: string) => {
        e.stopPropagation();
        if (id) setSelectedId(id);
        
        const el = elements.find(el => el.id === (id || selectedId));
        if (el) {
            setInteraction({
                type,
                startPos: getMouseCoords(e),
                startEl: { ...el },
                handle
            });
        }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!interaction.type || !interaction.startEl) return;

        const currentPos = getMouseCoords(e);
        const dx = currentPos.x - interaction.startPos.x;
        const dy = currentPos.y - interaction.startPos.y;
        const el = interaction.startEl;

        if (interaction.type === 'moving') {
            updateElement(el.id, { x: el.x + dx, y: el.y + dy });
        } 
        else if (interaction.type === 'resizing') {
            let scale = 1;
            const distStart = Math.sqrt(Math.pow(interaction.startPos.x - el.x, 2) + Math.pow(interaction.startPos.y - el.y, 2));
            const distNow = Math.sqrt(Math.pow(currentPos.x - el.x, 2) + Math.pow(currentPos.y - el.y, 2));
            
            if (interaction.handle) {
                scale = distNow / (distStart || 1);
                updateElement(el.id, { 
                    width: el.width * scale, 
                    height: el.height * scale 
                });
            }
        }
        else if (interaction.type === 'rotating') {
            const angle = Math.atan2(currentPos.y - el.y, currentPos.x - el.x) * 180 / Math.PI;
            let rotation = angle + 90;
            updateElement(el.id, { rotation });
        }
    };

    const handleGlobalMouseUp = () => {
        setInteraction({ type: null, startPos: { x: 0, y: 0 }, startEl: null });
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [interaction]);

    // --- RENDER HELPERS ---
    const filteredIcons = useMemo(() => {
        if (!iconSearch) return ICON_LIST.slice(0, 50);
        return ICON_LIST.filter(k => k.toLowerCase().includes(iconSearch.toLowerCase())).slice(0, 100);
    }, [iconSearch]);

    // --- EXPORT ---
    const handleSave = () => {
        if (mode === 'ai' && aiSvg) {
            onSave(`data:image/svg+xml;base64,${btoa(aiSvg)}`, { elements: [], bgColor: '#ffffff' }); // No editable data for AI result yet
            onClose();
        } else {
            if (!svgRef.current) return;
            const prevSelection = selectedId;
            setSelectedId(null);
            setTimeout(() => {
                if (!svgRef.current) return;
                const svgData = new XMLSerializer().serializeToString(svgRef.current);
                const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const reader = new FileReader();
                reader.onload = () => { 
                    onSave(reader.result as string, { elements, bgColor }); 
                    onClose(); 
                };
                reader.readAsDataURL(blob);
                setSelectedId(prevSelection);
            }, 0);
        }
    };

    const selectedElement = elements.find(el => el.id === selectedId);

    return (
        <div className="fixed inset-0 z-[500] bg-[#0F172A] flex flex-col font-sans">
            
            {/* TOOLBAR */}
            <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-lg relative z-20">
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setMode('design')} className={`px-3 py-1.5 text-xs font-bold rounded ${mode === 'design' ? 'bg-white text-slate-900 shadow' : 'text-slate-400'}`}>Design</button>
                        <button onClick={() => setMode('ai')} className={`px-3 py-1.5 text-xs font-bold rounded ${mode === 'ai' ? 'bg-purple-600 text-white shadow' : 'text-slate-400'}`}>AI</button>
                    </div>
                    
                    <div className="h-8 w-px bg-slate-700"></div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => addElement('text')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Texte"><Type size={18} /></button>
                        <button onClick={() => addElement('rect')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Carré"><Square size={18} /></button>
                        <button onClick={() => addElement('circle')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Cercle"><Circle size={18} /></button>
                        <button onClick={() => addElement('triangle')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Triangle"><Triangle size={18} /></button>
                        <button onClick={() => addElement('line')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Ligne"><Minus size={18} /></button>
                        <div className="h-6 w-px bg-slate-700 mx-1"></div>
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Image"><ImageIcon size={18} /></button>
                        <button onClick={handleImportSVG} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Code SVG"><Code size={18} /></button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={addImage} />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold">Fermer</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg font-bold text-sm shadow-lg flex items-center gap-2">
                        <Save size={16} /> Sauvegarder
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT SIDEBAR: ASSETS */}
                {mode === 'design' && (
                    <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
                        <div className="p-4 border-b border-slate-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    value={iconSearch}
                                    onChange={(e) => setIconSearch(e.target.value)}
                                    placeholder="Rechercher icône (EN)..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-orange"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Bibliothèque</h4>
                        <div className="grid grid-cols-4 gap-3">
                            {(iconSearch ? filteredIcons : POPULAR_ICONS).map(key => {
                                // @ts-ignore
                                const Icon = LucideIcons[key];
                                if (!Icon) return null;
                                return (
                                    <button 
                                        key={key} 
                                        onClick={() => addElement('icon', key)}
                                        className="aspect-square flex items-center justify-center bg-slate-700/50 hover:bg-brand-orange/20 hover:text-brand-orange text-slate-400 rounded-lg transition-all"
                                        title={key}
                                    >
                                        <Icon size={20} strokeWidth={1.5} />
                                    </button>
                                )
                            })}
                        </div>
                        </div>
                    </div>
                )}

                {/* CANVAS */}
                <div className="flex-1 bg-[#1e293b] relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
                    
                    {mode === 'design' ? (
                        <div className="relative shadow-2xl rounded-sm overflow-visible">
                            <svg 
                                ref={svgRef}
                                viewBox="0 0 800 600" 
                                className="w-[800px] h-[600px] bg-white cursor-default"
                            >
                                {/* Background & Deselect Area */}
                                <rect 
                                    x="0" y="0" width="800" height="600" 
                                    fill={bgColor} 
                                    onMouseDown={() => setSelectedId(null)} 
                                />

                                {elements.map(el => {
                                    let content;
                                    const transform = `translate(${el.x}, ${el.y}) rotate(${el.rotation})`;
                                    
                                    if (el.type === 'text') {
                                        content = <text fontSize={el.width} fill={el.fill} fontFamily={el.fontFamily} fontWeight={el.fontWeight} textAnchor="middle" dominantBaseline="middle">{el.text}</text>;
                                    } else if (el.type === 'icon' && el.iconName) {
                                        // @ts-ignore
                                        const Icon = LucideIcons[el.iconName];
                                        if (Icon) {
                                            content = <g transform={`translate(-${el.width/2}, -${el.width/2})`}><Icon size={el.width} color={el.fill} strokeWidth={2} opacity={el.opacity} /></g>;
                                        } else {
                                            content = null;
                                        }
                                    } else if (el.type === 'rect') {
                                        content = <rect x={-el.width/2} y={-el.height/2} width={el.width} height={el.height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
                                    } else if (el.type === 'circle') {
                                        content = <circle r={el.width/2} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
                                    } else if (el.type === 'triangle') {
                                        const w = el.width; const h = el.height;
                                        content = <polygon points={`0,${-h/2} ${-w/2},${h/2} ${w/2},${h/2}`} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
                                    } else if (el.type === 'image' && el.url) {
                                        content = <image href={el.url} x={-el.width/2} y={-el.height/2} width={el.width} height={el.height} />;
                                    } else if (el.type === 'line') {
                                        content = <line x1={-el.width/2} y1={0} x2={el.width/2} y2={0} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
                                    } else if (el.type === 'svg' && el.svgContent) {
                                        content = <text fontSize={20} fill="red">SVG Complex</text>;
                                    }

                                    return (
                                        <g 
                                            key={el.id} 
                                            transform={transform}
                                            opacity={el.opacity}
                                            onMouseDown={(e) => handleMouseDown(e, el.id, 'moving')}
                                            style={{ cursor: 'move', pointerEvents: 'all' }}
                                        >
                                            {content}
                                            {/* Selection Box Visual */}
                                            {selectedId === el.id && (
                                                <rect 
                                                    x={-el.width/2 - 10} 
                                                    y={-(el.type === 'line' ? 10 : el.height/2) - 10} 
                                                    width={el.width + 20} 
                                                    height={(el.type === 'line' ? 20 : el.height) + 20} 
                                                    fill="none" stroke="#3B82F6" strokeWidth="2"
                                                    strokeDasharray="5"
                                                    pointerEvents="none"
                                                />
                                            )}
                                        </g>
                                    );
                                })}

                                {selectedId && elements.find(e => e.id === selectedId) && (() => {
                                    const el = elements.find(e => e.id === selectedId)!;
                                    return (
                                        <g transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation})`}>
                                            <rect 
                                                x={el.width/2} y={(el.type === 'line' ? 0 : el.height/2)} width={12} height={12} 
                                                fill="white" stroke="#3B82F6" strokeWidth="2"
                                                transform="translate(-6, -6)"
                                                style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                                                onMouseDown={(e) => handleMouseDown(e, selectedId, 'resizing', 'se')}
                                            />
                                            <line x1={0} y1={-(el.type === 'line' ? 10 : el.height/2) - 10} x2={0} y2={-(el.type === 'line' ? 10 : el.height/2) - 30} stroke="#3B82F6" />
                                            <circle 
                                                cx={0} cy={-(el.type === 'line' ? 10 : el.height/2) - 30} r={6} 
                                                fill="white" stroke="#3B82F6" strokeWidth="2"
                                                style={{ cursor: 'grab', pointerEvents: 'all' }}
                                                onMouseDown={(e) => handleMouseDown(e, selectedId, 'rotating')}
                                            />
                                        </g>
                                    );
                                })()}
                            </svg>
                        </div>
                    ) : (
                        <div className="bg-white p-10 rounded-2xl shadow-xl">
                            {aiSvg ? (
                                <div className="w-64 h-64" dangerouslySetInnerHTML={{ __html: sanitizeSVG(aiSvg) }} />
                            ) : (
                                <div className="text-center">
                                    <Wand2 size={48} className="mx-auto mb-4 text-slate-300" />
                                    <button onClick={generateAiLogo} disabled={isGenerating} className="px-6 py-3 bg-purple-600 text-white rounded-full font-bold">
                                        {isGenerating ? 'Création...' : 'Générer une idée'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT SIDEBAR: PROPERTIES */}
                {mode === 'design' && selectedElement && (
                    <div className="w-72 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">Propriétés</h4>
                            <div className="flex gap-1 bg-slate-700/50 p-1 rounded-lg">
                                <button onClick={() => moveLayer('bottom')} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors" title="Tout en bas (Arrière-plan)"><ChevronsDown size={14}/></button>
                                <button onClick={() => moveLayer('down')} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors" title="Descendre"><ChevronDown size={14}/></button>
                                <button onClick={() => moveLayer('up')} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors" title="Monter"><ChevronUp size={14}/></button>
                                <button onClick={() => moveLayer('top')} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors" title="Tout en haut (Premier plan)"><ChevronsUp size={14}/></button>
                            </div>
                            <button onClick={deleteElement} className="p-1.5 hover:bg-red-900/30 text-red-400 rounded"><Trash2 size={14}/></button>
                        </div>

                        {selectedElement ? (
                            <div className="space-y-6">
                                {/* Text Content */}
                                {selectedElement.type === 'text' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">Texte</label>
                                        <input 
                                            value={selectedElement.text} 
                                            onChange={e => updateElement(selectedElement.id, { text: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                                        />
                                        <select 
                                            value={selectedElement.fontFamily}
                                            onChange={e => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white mt-2"
                                        >
                                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Colors */}
                                {selectedElement.type !== 'image' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">
                                            {selectedElement.type === 'line' ? 'Couleur Trait' : 'Remplissage'}
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="color" 
                                                value={selectedElement.type === 'line' ? selectedElement.stroke : selectedElement.fill}
                                                onChange={e => updateElement(selectedElement.id, selectedElement.type === 'line' ? { stroke: e.target.value } : { fill: e.target.value })}
                                                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                            />
                                            <input 
                                                type="text" 
                                                value={selectedElement.type === 'line' ? selectedElement.stroke : selectedElement.fill}
                                                onChange={e => updateElement(selectedElement.id, selectedElement.type === 'line' ? { stroke: e.target.value } : { fill: e.target.value })}
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Dimensions */}
                                <div className="space-y-4 pt-4 border-t border-slate-700">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-500"><span>Taille</span> <span>{Math.round(selectedElement.width)}px</span></div>
                                        <input type="range" min="10" max="600" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value), height: (selectedElement.type !== 'line' && selectedElement.type !== 'rect' && selectedElement.type !== 'image') ? parseInt(e.target.value) : selectedElement.height })} className="w-full accent-brand-orange" />
                                    </div>
                                    
                                    {(selectedElement.type === 'rect' || selectedElement.type === 'image') && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500">Hauteur</label>
                                            <input 
                                                type="range" 
                                                min="5" max="400" 
                                                value={selectedElement.height} 
                                                onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 0 })}
                                                className="w-full accent-brand-orange"
                                            />
                                        </div>
                                    )}

                                    {selectedElement.type === 'line' && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500">Épaisseur</label>
                                            <input 
                                                type="range" 
                                                min="1" max="50" 
                                                value={selectedElement.strokeWidth} 
                                                onChange={e => updateElement(selectedElement.id, { strokeWidth: parseInt(e.target.value) || 0 })}
                                                className="w-full accent-brand-orange"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-500"><span>Rotation</span> <span>{Math.round(selectedElement.rotation)}°</span></div>
                                        <input type="range" min="0" max="360" value={selectedElement.rotation} onChange={e => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })} className="w-full accent-brand-orange" />
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-500"><span>Opacité</span> <span>{selectedElement.opacity}</span></div>
                                        <input type="range" min="0" max="1" step="0.1" value={selectedElement.opacity} onChange={e => updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })} className="w-full accent-brand-orange" />
                                    </div>
                                </div>

                                {/* Position X/Y (Fine Tuning) */}
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">X</label>
                                        <input type="number" value={Math.round(selectedElement.x)} onChange={e => updateElement(selectedElement.id, { x: parseInt(e.target.value) })} className="w-full bg-slate-900 rounded-lg px-2 py-1 text-sm text-white border-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Y</label>
                                        <input type="number" value={Math.round(selectedElement.y)} onChange={e => updateElement(selectedElement.id, { y: parseInt(e.target.value) })} className="w-full bg-slate-900 rounded-lg px-2 py-1 text-sm text-white border-none" />
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="text-center py-10 text-slate-500">
                                <MousePointer2 size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-xs">Sélectionnez un élément pour le modifier</p>
                            </div>
                        )}

                        {/* GLOBAL CANVAS PROPERTIES (Always Visible) */}
                        <div className="mt-8 pt-6 border-t border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Plan de Travail</h4>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500 block mb-1">Couleur de Fond</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={bgColor} 
                                        onChange={e => setBgColor(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0" 
                                    />
                                    <input 
                                        type="text" 
                                        value={bgColor} 
                                        onChange={e => setBgColor(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs text-white" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};