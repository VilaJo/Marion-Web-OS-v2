/**
 * EditorCanvas – Main canvas area with zoom, pan, wheel zoom, comparison slider
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Minus, Plus, RotateCcw, Maximize2 } from 'lucide-react';
import type { MediaEditorState, MediaEditorActions } from './useMediaEditor';

interface EditorCanvasProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ state, actions }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const [imgLoaded, setImgLoaded] = useState(false);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const prevImageRef = useRef<string | null>(null);

    // Reset imgLoaded when image source changes so the onLoad fires a real state change
    useEffect(() => {
        if (state.image !== prevImageRef.current) {
            prevImageRef.current = state.image;
            setImgLoaded(false);
        }
    }, [state.image]);

    // ──── Canvas rendering ────
    useEffect(() => {
        const canvas = actions.canvasRef.current;
        if (!canvas || !state.image || !imgLoaded || !imgRef.current) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = imgRef.current;
        if (img.naturalWidth === 0) return;

        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;

        // Apply resize preset
        if (state.selectedPreset !== 'original' && state.selectedPreset !== 'custom') {
            const presets: Record<string, [number, number]> = {
                'insta-post': [1080, 1080],
                'insta-story': [1080, 1920],
                'insta-reel': [1080, 1350],
                'fb-cover': [820, 312],
                'fb-post': [1200, 630],
                'linkedin-banner': [1584, 396],
                'linkedin-post': [1200, 627],
                'web-hero': [1920, 1080],
                'og-image': [1200, 630],
                'favicon': [512, 512],
            };
            const dims = presets[state.selectedPreset];
            if (dims) { targetW = dims[0]; targetH = dims[1]; }
        } else if (state.selectedPreset === 'custom') {
            targetW = state.customDims.width;
            targetH = state.customDims.height;
        }

        canvas.width = targetW;
        canvas.height = targetH;

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.save();

        // Filters
        const filterParts: string[] = [];
        if (state.filters.brightness !== 100) filterParts.push(`brightness(${state.filters.brightness}%)`);
        if (state.filters.contrast !== 100) filterParts.push(`contrast(${state.filters.contrast}%)`);
        if (state.filters.saturation !== 100) filterParts.push(`saturate(${state.filters.saturation}%)`);
        if (state.filters.grayscale > 0) filterParts.push(`grayscale(${state.filters.grayscale}%)`);
        if (state.filters.blur > 0) filterParts.push(`blur(${state.filters.blur}px)`);
        if (filterParts.length) ctx.filter = filterParts.join(' ');

        // Transform
        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate((state.rotation * Math.PI) / 180);
        ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
        ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
        ctx.restore();

    }, [imgLoaded, state.image, state.filters, state.rotation, state.flipH, state.flipV, state.selectedPreset, state.customDims, actions.canvasRef]);

    // ──── Wheel zoom ────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        actions.setScale((prev: number) => Math.max(0.1, Math.min(5, prev + delta)));
    }, [actions]);

    // ──── Pan ────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (isDraggingSlider) return;
        setIsPanning(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, [isDraggingSlider]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        actions.setPan((prev: { x: number; y: number }) => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, [isPanning, actions]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // ──── Comparison slider ────
    const handleComparisonDrag = useCallback((e: React.MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        actions.setComparisonPosition(Math.max(0, Math.min(100, x)));
    }, [actions]);

    const handleSliderDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDraggingSlider(true);
        handleComparisonDrag(e);

        const handleMove = (ev: MouseEvent) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = ((ev.clientX - rect.left) / rect.width) * 100;
            actions.setComparisonPosition(Math.max(0, Math.min(100, x)));
        };
        const handleUp = () => {
            setIsDraggingSlider(false);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, [handleComparisonDrag, actions]);

    return (
        <div
            ref={containerRef}
            className={`flex-1 flex flex-col items-center justify-center relative overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ userSelect: 'none' }}
        >
            {/* Hidden image for loading – drives canvas rendering */}
            <img
                ref={(el) => { imgRef.current = el; }}
                src={state.image || ''}
                className="absolute pointer-events-none opacity-0"
                style={{ width: 1, height: 1 }}
                onLoad={() => setImgLoaded(true)}
            />

            {/* Canvas with pan/zoom */}
            <div
                className="relative"
                style={{
                    transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.scale})`,
                    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                }}
            >
                {state.showComparison && state.originalImage ? (
                    // Comparison mode: original underneath, edited on top with clip
                    <div className="relative inline-block" onMouseDown={handleSliderDown}>
                        {/* Original image */}
                        <img
                            src={state.originalImage}
                            className="max-w-[70vw] max-h-[65vh] object-contain rounded-lg shadow-2xl pointer-events-none"
                            alt="Original"
                        />
                        {/* Edited (canvas) clipped */}
                        <div
                            className="absolute inset-0 overflow-hidden pointer-events-none"
                            style={{ clipPath: `inset(0 ${100 - state.comparisonPosition}% 0 0)` }}
                        >
                            <canvas
                                ref={actions.canvasRef}
                                className="max-w-[70vw] max-h-[65vh] object-contain rounded-lg"
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                        {/* Slider line */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-10"
                            style={{ left: `${state.comparisonPosition}%` }}
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize">
                                <div className="flex gap-0.5">
                                    <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
                                    <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
                                </div>
                            </div>
                        </div>
                        {/* Labels */}
                        <div className="absolute top-3 left-3 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm pointer-events-none">
                            AVANT
                        </div>
                        <div className="absolute top-3 right-3 bg-[var(--brand-orange)] text-white text-[10px] font-bold px-2 py-1 rounded-md pointer-events-none">
                            APRÈS
                        </div>
                    </div>
                ) : (
                    // Normal mode: just the canvas
                    <div className="relative inline-block">
                        <canvas
                            ref={actions.canvasRef}
                            className="max-w-[70vw] max-h-[65vh] object-contain rounded-lg shadow-2xl"
                        />
                        {/* Processing overlay */}
                        {state.isProcessing && (
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden mb-3">
                                        <div
                                            className="h-full bg-[var(--brand-orange)] rounded-full transition-all duration-300"
                                            style={{ width: `${state.processingProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-white text-xs font-medium">{state.currentAction === 'remove_bg' ? 'Suppression de l\'arrière-plan...' : state.currentAction === 'upscale' ? 'Amélioration en cours...' : state.currentAction === 'palette' ? 'Extraction des couleurs...' : state.currentAction === 'compress' ? 'Compression en cours...' : 'Traitement en cours...'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Zoom controls floating top-center */}
            <div
                className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-lg z-30"
                onMouseDown={e => e.stopPropagation()}
            >
                <button
                    onClick={() => actions.setScale((s: number) => Math.max(0.1, s - 0.15))}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                    <Minus size={14} className="text-slate-600 dark:text-slate-300" />
                </button>
                <span className="text-xs font-medium tabular-nums w-12 text-center text-slate-600 dark:text-slate-300">
                    {Math.round(state.scale * 100)}%
                </span>
                <button
                    onClick={() => actions.setScale((s: number) => Math.min(5, s + 0.15))}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                    <Plus size={14} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                <button
                    onClick={actions.resetView}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="Réinitialiser la vue"
                >
                    <Maximize2 size={14} className="text-slate-600 dark:text-slate-300" />
                </button>
            </div>

            {/* Dimensions display bottom-center */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm px-3 py-1 rounded-full">
                {state.imageDimensions.width} × {state.imageDimensions.height}px
                {state.rotation !== 0 && ` · ${state.rotation}°`}
            </div>
        </div>
    );
};
