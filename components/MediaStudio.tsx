import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { 
    Wand2, Image as ImageIcon, Download, X, UploadCloud, 
    Crop, Sliders, Palette, Monitor, Smartphone, Instagram, 
    Facebook, Linkedin, Maximize2, RotateCcw, Share2, Check,
    Loader2, Sparkles, Layout, Scan, Eye, Minus, Plus, Move, Layers,
    Code, Grid, Zap, Terminal, Box, ImagePlus
} from 'lucide-react';

interface MediaStudioProps { 
    onClose: () => void;
}

type ToolMode = 'none' | 'resize' | 'ai' | 'adjust' | 'export';

// Base64 Noise Pattern
const NOISE_PATTERN = "data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.4'/%3E%3C/svg%3E";

const TerminalLogs = ({ active, action }: { active: boolean; action: string }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (active) {
            setLogs([]);
            const messages = [
                `INITIALIZING_NEURAL_NET...`,
                `LOADING_MODEL_${action.toUpperCase()}...`,
                `ALLOCATING_TENSORS...`,
                `OPTIMIZING_VECTORS...`,
                `APPLYING_TRANSFORMS...`,
                `RENDERING_OUTPUT...`,
                `FINALIZING...`
            ];
            
            let i = 0;
            const interval = setInterval(() => {
                if (i < messages.length) {
                    setLogs(prev => [...prev, `> ${messages[i]} [OK]`]);
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 400); 
            return () => clearInterval(interval);
        }
    }, [active, action]);

    useLayoutEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    if (!active) return null;

    return (
        <div className="absolute bottom-32 right-8 w-80 bg-black/90 border border-green-500/30 p-4 rounded-xl font-mono text-[10px] text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)] z-50 pointer-events-none animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 mb-2 border-b border-green-500/30 pb-2">
                <Terminal size={12} />
                <span className="font-bold">FRANCK_TERMINAL_V2</span>
            </div>
            <div className="flex flex-col gap-1 opacity-80 max-h-48 overflow-y-auto custom-scrollbar">
                {logs.map((log, i) => (
                    <div key={i} className="truncate">{log}</div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
};

export const MediaStudio: React.FC<MediaStudioProps> = ({ onClose }) => {
    const [activeTool, setActiveTool] = useState<ToolMode>('ai');
    const [viewMode, setViewMode] = useState<'canvas' | 'mockup'>('canvas');
    const [mockupType, setMockupType] = useState<'phone' | 'desktop'>('phone');
    
    const [image, setImage] = useState<string | null>(null);
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentAction, setCurrentAction] = useState("");
    const [palette, setPalette] = useState<string[]>([]);
    const [showComparison, setShowComparison] = useState(false); 
    
    // Editing State
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [grayscale, setGrayscale] = useState(0);
    const [blur, setBlur] = useState(0);
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [scale, setScale] = useState(1);
    
    // Pan State
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // Resize State
    const [selectedPreset, setSelectedPreset] = useState<string>('original');
    const [customDims, setCustomDims] = useState({ width: 1080, height: 1080 });
    const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp' | 'svg'>('png');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null); 
    
    const [imgLoaded, setImgLoaded] = useState(false);

    // Image Caching
    const originalImgObj = useRef<HTMLImageElement | null>(null);
    const currentImgObj = useRef<HTMLImageElement | null>(null);

    const handleNewImage = () => {
        setImage(null);
        setOriginalImage(null);
        setOriginalFile(null);
        setPalette([]);
        setActiveTool('ai');
        setImgLoaded(false); 
        setPan({ x: 0, y: 0 }); // Reset pan
        setScale(1); // Reset zoom
        
        // Reset edits
        setBrightness(100); setContrast(100); setSaturation(100);
        setGrayscale(0); setBlur(0); setRotation(0); setFlipH(false);
        setSelectedPreset('original');
        
        // Clear refs
        originalImgObj.current = null;
        currentImgObj.current = null;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (viewMode !== 'canvas' || !image) return;
        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning) return;
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setOriginalFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = ev.target?.result as string;
                setImage(result);
                setOriginalImage(result);
                setImgLoaded(false); // New image, reset load
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProcessAI = async (action: string) => {
        if (!originalFile) return;
        setIsProcessing(true);
        setCurrentAction(action);

        const formData = new FormData();
        formData.append('file', originalFile); 
        formData.append('preset', action);

        try {
            let endpoint = 'resize';
            if (action === 'palette') endpoint = 'palette';
            if (action === 'vectorize') endpoint = 'vectorize';
            if (action === 'upscale') endpoint = 'upscale';
            if (action === 'remove_bg') endpoint = 'remove_bg';

            const res = await fetch(`http://127.0.0.1:5003/api/media/${endpoint}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                if (action === 'palette') {
                    setPalette(data.palette);
                } else {
                    setImage(data.image);
                    const img = new Image(); 
                    img.src = data.image; 
                    img.onload = () => { 
                        currentImgObj.current = img; 
                        setImgLoaded(true); // Ensure redraw triggers
                    };
                    if (action === 'vectorize') setExportFormat('svg');
                }
            } else {
                alert('Erreur: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Erreur serveur");
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setCurrentAction("");
            }, 1000);
        }
    };

    const handleDownload = () => {
        if (image?.startsWith('data:image/svg+xml')) {
            const link = document.createElement('a');
            link.href = image;
            link.download = `franck_vector_${Date.now()}.svg`;
            link.click();
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.href = canvas.toDataURL(`image/${exportFormat}`);
        link.download = `franck_edit_${Date.now()}.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`;
        link.click();
    };

    // Main Canvas Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image || !imgLoaded || !currentImgObj.current) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = currentImgObj.current;
        if (img.naturalWidth === 0) return;

        // 1. Calculate Dimensions
        let baseW = img.naturalWidth;
        let baseH = img.naturalHeight;
        
        // If rotated 90 or 270, swap dimensions for calculation
        if (rotation % 180 !== 0) { 
            baseW = img.naturalHeight; 
            baseH = img.naturalWidth; 
        }

        let targetW = baseW;
        let targetH = baseH;

        // Apply Presets (Crop Targets)
        if (selectedPreset === 'web') { targetW = 1920; targetH = 1080; } 
        else if (selectedPreset === 'insta') { targetW = 1080; targetH = 1080; } 
        else if (selectedPreset === 'story') { targetW = 1080; targetH = 1920; } 
        else if (selectedPreset === 'custom') { targetW = customDims.width; targetH = customDims.height; }

        // 2. Set Canvas Size
        canvas.width = targetW;
        canvas.height = targetH;
        
        // 3. Draw
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.save();
        
        // Filters
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) blur(${blur}px)`;
        
        // Center & Transform
        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, 1);
        
        // Draw centered
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        
        ctx.restore();

    }, [imgLoaded, image, brightness, contrast, saturation, grayscale, blur, rotation, flipH, selectedPreset, customDims]);


    return (
        <div className="fixed inset-0 z-[500] bg-[#02040a] text-white font-sans overflow-hidden selection:bg-brand-orange selection:text-white flex flex-col">
            
            <div className="absolute inset-0 pointer-events-none perspective-[1000px]">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [transform:rotateX(45deg)_scale(2)] origin-bottom opacity-30"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("${NOISE_PATTERN}")` }}></div>
            </div>

            {/* HEADER */}
            <div className="relative z-50 flex justify-between items-center p-6 bg-black/60 backdrop-blur-xl border-b border-white/10">
                <div className="flex items-center gap-4 px-6 py-3 rounded-full shadow-[0_0_30px_-10px_rgba(255,126,95,0.3)]">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                    <span className="font-mono text-xs text-brand-orange tracking-[0.2em]">ATELIER_MEDIA_V3.0</span>
                </div>

                {image && (
                    <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-1 gap-1">
                        {[
                            { id: 'canvas', icon: Layout, label: 'STUDIO' },
                            { id: 'mockup', icon: Box, label: '3D VIEW' },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setViewMode(t.id as any)}
                                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 ${viewMode === t.id ? 'bg-white/20 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <t.icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {image && (
                        <button onClick={handleNewImage} className="p-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-full border border-white/10 transition-all duration-300 group" title="Nouvelle image">
                            <ImagePlus size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full border border-red-500/30 hover:border-red-500 transition-all duration-300 group">
                        <X size={20} className="group-hover:rotate-90 transition-transform" />
                    </button>
                </div>
            </div>

            <TerminalLogs active={isProcessing} action={currentAction} />

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex relative pb-20 overflow-hidden" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div 
                    ref={canvasContainerRef}
                    className={`flex-1 flex items-center justify-center p-8 z-10 relative h-full w-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    // Prevent text selection during drag
                    style={{ userSelect: 'none' }} 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => { setImage(ev.target?.result as string); setOriginalImage(ev.target?.result as string); };
                            reader.readAsDataURL(file);
                            setOriginalFile(file);
                        }
                    }}
                >
                    {!image ? (
                        <div onClick={() => fileInputRef.current?.click()} className="relative group cursor-pointer">
                            <div className="absolute inset-0 bg-brand-orange/20 blur-[100px] rounded-full animate-pulse"></div>
                            <div className="relative w-96 h-64 border border-dashed border-slate-700 bg-black/40 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center gap-6 group-hover:border-brand-orange/50 group-hover:bg-brand-orange/5 transition-all duration-500">
                                <UploadCloud size={64} className="text-slate-500 group-hover:text-brand-orange transition-colors duration-500 group-hover:scale-110" />
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">INITIALISATION</h2>
                                    <p className="text-xs text-slate-500 font-mono tracking-widest">DROP_IMAGE_FILE_HERE</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Hidden Image for reliable loading */}
                            <img 
                                src={image} 
                                className="absolute pointer-events-none opacity-0"
                                onLoad={(e) => {
                                    currentImgObj.current = e.currentTarget;
                                    setImgLoaded(true);
                                }}
                            />

                            {viewMode === 'canvas' ? (
                                <div 
                                    className={`flex items-center justify-center transition-all duration-100 ease-out ${showComparison ? 'gap-8 flex-row' : ''}`}
                                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
                                >
                                    {showComparison && originalImage && (
                                        <div className="flex-col items-center justify-center p-1 border border-white/10 bg-black/40 backdrop-blur-sm shadow-2xl relative inline-flex">
                                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded scale-[0.5] origin-top-left">ORIGINAL</div>
                                            <img src={originalImage} alt="Original" className="max-w-[80vw] max-h-[70vh] object-contain pointer-events-none" />
                                        </div>
                                    )}

                                    <div className={`relative p-1 border border-white/10 bg-black/40 backdrop-blur-sm shadow-2xl group ${showComparison ? 'inline-flex' : 'inline-flex'}`}>
                                        <div className="absolute top-2 right-2 bg-brand-orange text-white text-[10px] font-bold px-2 py-1 rounded z-10 scale-[0.5] origin-top-right">EDITED</div>
                                        <canvas ref={canvasRef} className="max-w-[80vw] max-h-[70vh] object-contain pointer-events-none" />
                                        {isProcessing && <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="w-full h-1 bg-brand-orange/80 shadow-[0_0_15px_#FF7E5F] absolute top-0 animate-[scan_2s_linear_infinite]"></div></div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="relative flex items-center justify-center w-full h-full animate-in zoom-in duration-500">
                                    <div className="flex gap-4 mb-8 justify-center absolute top-0 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2">
                                        <button onClick={() => setMockupType('phone')} className={`px-4 py-2 rounded-lg text-xs font-bold ${mockupType === 'phone' ? 'bg-white text-black' : 'bg-black/50 text-slate-400'}`}>iPhone</button>
                                        <button onClick={() => setMockupType('desktop')} className={`px-4 py-2 rounded-lg text-xs font-bold ${mockupType === 'desktop' ? 'bg-white text-black' : 'bg-black/50 text-slate-400'}`}>MacBook</button>
                                    </div>
                                    
                                    {mockupType === 'phone' ? (
                                        <div className="relative w-[300px] h-[600px] border-[12px] border-black rounded-[3rem] shadow-2xl bg-black overflow-hidden mx-auto ring-1 ring-white/20">
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-20"></div>
                                            <img src={image || ""} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-8 left-8 right-8 text-white z-10 drop-shadow-md">
                                                <div className="text-sm font-bold">@marion.design</div>
                                                <div className="text-[10px] opacity-80">En direct de l'Atelier</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative w-[800px] aspect-video border-[12px] border-t-[12px] border-b-[24px] border-gray-800 rounded-xl shadow-2xl bg-black overflow-hidden ring-1 ring-white/20">
                                            <img src={image || ""} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Controls Overlay (Fixed position, not scaled/panned) */}
                            {viewMode === 'canvas' && (
                                <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-xl z-40" onMouseDown={(e) => e.stopPropagation()}>
                                    <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.1, s - 0.1)); }} className="p-2 hover:text-brand-orange"><Minus size={14}/></button>
                                    <span className="font-mono text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                                    <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.1)); }} className="p-2 hover:text-brand-orange"><Plus size={14}/></button>
                                    <div className="w-px h-4 bg-white/10 mx-2"></div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowComparison(!showComparison); }} 
                                        className={`flex items-center gap-2 text-xs font-bold transition-colors ${showComparison ? 'text-brand-orange' : 'hover:text-brand-orange'}`}
                                    >
                                        <Eye size={14} /> {showComparison ? 'MASQUER' : 'COMPARER'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {image && (
                    <div className="w-80 flex-shrink-0 flex flex-col gap-4 p-8 z-40 relative">
                        {activeTool === 'ai' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-[10px] font-mono text-brand-orange tracking-widest mb-4 flex items-center gap-2">
                                        <Sparkles size={12} /> NEURAL_OPERATIONS
                                    </h3>
                                    <div className="grid gap-3">
                                        <button onClick={() => handleProcessAI('remove_bg')} disabled={isProcessing} className="group relative p-4 bg-white/5 hover:bg-brand-orange/10 border border-white/10 hover:border-brand-orange/50 rounded-xl transition-all text-left">
                                            <div className="flex justify-between items-start mb-2"><Layers className="text-slate-400 group-hover:text-brand-orange transition-colors" size={20} />{isProcessing && <Loader2 className="animate-spin text-brand-orange" size={16} />}</div>
                                            <div className="font-bold text-sm text-white">Détourage Auto</div>
                                            <div className="text-[10px] text-slate-500 mt-1 font-mono">REMOVE_BACKGROUND_V2</div>
                                        </button>
                                        <button onClick={() => handleProcessAI('vectorize')} disabled={isProcessing} className="group relative p-4 bg-white/5 hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all text-left">
                                            <div className="flex justify-between items-start mb-2"><Code className="text-slate-400 group-hover:text-purple-400 transition-colors" size={20} /></div>
                                            <div className="font-bold text-sm text-white">Vectorisation SVG</div>
                                            <div className="text-[10px] text-slate-500 mt-1 font-mono">BITMAP_TO_VECTOR</div>
                                        </button>
                                        <button onClick={() => handleProcessAI('upscale')} disabled={isProcessing} className="group relative p-4 bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/50 rounded-xl transition-all text-left">
                                            <div className="flex justify-between items-start mb-2"><Zap className="text-slate-400 group-hover:text-blue-400 transition-colors" size={20} /></div>
                                            <div className="font-bold text-sm text-white">Upscale HD</div>
                                            <div className="text-[10px] text-slate-500 mt-1 font-mono">ENHANCE_RESOLUTION</div>
                                        </button>
                                        <button onClick={() => handleProcessAI('palette')} disabled={isProcessing} className="group relative p-4 bg-white/5 hover:bg-pink-500/10 border border-white/10 hover:border-pink-500/50 rounded-xl transition-all text-left">
                                            <div className="flex justify-between items-start mb-2"><Palette className="text-slate-400 group-hover:text-pink-400 transition-colors" size={20} /></div>
                                            <div className="font-bold text-sm text-white">Extraction Palette</div>
                                            <div className="text-[10px] text-slate-500 mt-1 font-mono">COLOR_ANALYSIS</div>
                                        </button>
                                    </div>
                                    {palette.length > 0 && (
                                        <div className="p-4 bg-black/40 rounded-xl border border-white/5 mt-4">
                                            <div className="text-[10px] font-mono text-slate-500 mb-3">EXTRACTED_DATA</div>
                                            <div className="flex flex-wrap gap-2">
                                                {palette.map(c => <div key={c} onClick={() => navigator.clipboard.writeText(c)} className="w-10 h-10 rounded-lg cursor-pointer hover:scale-110 transition-transform shadow-lg ring-1 ring-white/10" style={{ backgroundColor: c }} title={c}></div>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTool === 'resize' && (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-mono text-brand-orange tracking-widest mb-4 flex items-center gap-2"><Crop size={12} /> DIMENSION_MATRIX</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'insta', label: 'Instagram', sub: '1:1 Square', icon: Instagram },
                                        { id: 'story', label: 'Story', sub: '9:16 Vertical', icon: Smartphone },
                                        { id: 'web', label: 'Web Hero', sub: '16:9', icon: Monitor },
                                        { id: 'original', label: 'Original', sub: 'Native', icon: ImageIcon }
                                    ].map(p => (
                                        <button key={p.id} onClick={() => setSelectedPreset(p.id)} className={`p-3 rounded-xl border text-left transition-all ${selectedPreset === p.id ? 'bg-brand-orange/20 border-brand-orange' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                            <p.icon size={20} />
                                            <span className={`font-bold text-sm ${selectedPreset === p.id ? 'text-white' : 'text-slate-300'}`}>{p.label}</span>
                                            <span className="text-[10px] text-slate-500 font-mono block">{p.sub}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <div className="text-[10px] font-mono text-slate-500 mb-3">CUSTOM_OVERRIDE</div>
                                    <div className="flex gap-2">
                                        <div className="bg-black/40 rounded-lg p-2 border border-white/10 flex-1">
                                            <label className="text-[9px] text-slate-500 block mb-1">WIDTH</label>
                                            <input type="number" value={customDims.width} onChange={e => { setCustomDims({...customDims, width: Number(e.target.value)}); setSelectedPreset('custom'); }} className="bg-transparent w-full text-sm font-mono outline-none text-white" />
                                        </div>
                                        <div className="bg-black/40 rounded-lg p-2 border border-white/10 flex-1">
                                            <label className="text-[9px] text-slate-500 block mb-1">HEIGHT</label>
                                            <input type="number" value={customDims.height} onChange={e => { setCustomDims({...customDims, height: Number(e.target.value)}); setSelectedPreset('custom'); }} className="bg-transparent w-full text-sm font-mono outline-none text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTool === 'adjust' && (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-mono text-brand-orange tracking-widest mb-4 flex items-center gap-2"><Sliders size={12} /> IMAGE_PARAMETERS</h3>
                                {[{ label: 'Brightness', val: brightness, set: setBrightness, min: 0, max: 200 }, { label: 'Contrast', val: contrast, set: setContrast, min: 0, max: 200 }, { label: 'Saturation', val: saturation, set: setSaturation, min: 0, max: 200 }, { label: 'Blur', val: blur, set: setBlur, min: 0, max: 20 }].map(f => (
                                    <div key={f.label} className="group">
                                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-2"><span>{f.label.toUpperCase()}</span><span className="text-white">{f.val}</span></div>
                                        <input type="range" min={f.min} max={f.max} value={f.val} onChange={e => f.set(Number(e.target.value))} className="w-full accent-brand-orange h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-orange hover:accent-white transition-all"/>
                                    </div>
                                ))}
                                <div className="flex gap-2 pt-4">
                                    <button onClick={() => setRotation(r => r - 90)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold flex items-center justify-center gap-2"><RotateCcw size={12} /> -90°</button>
                                    <button onClick={() => setFlipH(!flipH)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-center flex items-center justify-center gap-2"><Move size={12} /> Mirror</button>
                                </div>
                            </div>
                        )}

                        {activeTool === 'export' && (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-mono text-brand-orange tracking-widest mb-4 flex items-center gap-2"><Share2 size={12} /> FINAL_RENDER</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {['png', 'jpeg', 'webp', 'svg'].map(fmt => (
                                        <button key={fmt} onClick={() => setExportFormat(fmt as any)} className={`p-3 rounded-xl border text-center transition-all ${exportFormat === fmt ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}>
                                            <div className="text-xs font-bold uppercase">{fmt}</div>
                                        </button>
                                    ))}
                                </div>
                                <button onClick={handleDownload} className="w-full py-4 bg-brand-orange hover:bg-orange-500 text-white rounded-xl font-bold shadow-[0_0_30px_-5px_rgba(255,126,95,0.6)] hover:shadow-[0_0_40px_-5px_rgba(255,126,95,0.8)] transition-all flex items-center justify-center gap-2 mt-4"><Download size={18} /> TÉLÉCHARGER</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {image && (
                <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
                    <div className="pointer-events-auto bg-[#131b2e]/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex items-center gap-2 shadow-2xl">
                        {[
                            { id: 'resize', icon: Crop, label: 'Format' },
                            { id: 'adjust', icon: Sliders, label: 'Réglages' },
                            { id: 'ai', icon: Sparkles, label: 'AI Magic' },
                            { id: 'export', icon: Share2, label: 'Export' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTool(activeTool === t.id ? 'none' : t.id as ToolMode)}
                                className={`p-3 rounded-xl transition-all duration-300 relative group ${activeTool === t.id ? 'bg-white text-black shadow-lg scale-110 -translate-y-2' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <t.icon size={24} />
                                <span className={`absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-black/80 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none ${activeTool === t.id ? 'hidden' : ''}`}>
                                    {t.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
            <canvas ref={useRef<HTMLCanvasElement>(null)} className="hidden" />
        </div>
    );
};