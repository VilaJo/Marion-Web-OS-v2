/**
 * useMediaEditor – Centralized state management hook for the Media Studio
 *
 * Handles: image state, filters, undo/redo, zoom/pan, crop, resize presets,
 * AI operations, export settings.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '../../services/api';

// ──────────────────────────── Types ────────────────────────────

export type ToolMode = 'none' | 'resize' | 'ai' | 'adjust' | 'export';
export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface Filters {
    brightness: number;   // 0-200, default 100
    contrast: number;     // 0-200, default 100
    saturation: number;   // 0-200, default 100
    sharpness: number;    // 0-200, default 100
    blur: number;         // 0-20, default 0
    grayscale: number;    // 0-100, default 0
}

export interface ResizePreset {
    id: string;
    label: string;
    sub: string;
    width: number;
    height: number;
    category: string;
}

export interface CropState {
    active: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface HistoryEntry {
    imageDataUrl: string;
    filters: Filters;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
}

export interface MediaEditorState {
    // Image
    image: string | null;
    originalImage: string | null;
    originalFile: File | null;
    imageDimensions: { width: number; height: number };
    // Filters
    filters: Filters;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
    // View
    activeTool: ToolMode;
    scale: number;
    pan: { x: number; y: number };
    showComparison: boolean;
    comparisonPosition: number;
    // Resize
    selectedPreset: string;
    customDims: { width: number; height: number };
    lockRatio: boolean;
    // Crop
    crop: CropState;
    // Export
    exportFormat: ExportFormat;
    exportQuality: number;
    // AI
    isProcessing: boolean;
    processingProgress: number;
    currentAction: string;
    palette: string[];
    error: string | null;
    // Undo
    canUndo: boolean;
    canRedo: boolean;
    // Status
    hasImage: boolean;
    fileName: string;
}

export interface MediaEditorActions {
    // Image
    handleUpload: (file: File) => void;
    handleNewImage: () => void;
    handleDrop: (e: React.DragEvent) => void;
    // Filters
    setFilter: (key: keyof Filters, value: number) => void;
    resetFilters: () => void;
    setRotation: (deg: number) => void;
    rotate90: (direction: 'cw' | 'ccw') => void;
    toggleFlipH: () => void;
    toggleFlipV: () => void;
    // View
    setActiveTool: (t: ToolMode) => void;
    setScale: (s: number | ((prev: number) => number)) => void;
    setPan: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    resetView: () => void;
    setShowComparison: (v: boolean) => void;
    setComparisonPosition: (v: number) => void;
    // Resize
    setSelectedPreset: (id: string) => void;
    setCustomDims: (d: { width: number; height: number }) => void;
    setLockRatio: (v: boolean) => void;
    // Crop
    setCrop: (c: CropState) => void;
    applyCrop: () => void;
    cancelCrop: () => void;
    // Export
    setExportFormat: (f: ExportFormat) => void;
    setExportQuality: (q: number) => void;
    handleDownload: () => Promise<void>;
    copyToClipboard: () => Promise<void>;
    // AI
    handleProcessAI: (action: string) => Promise<void>;
    clearError: () => void;
    // Undo
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;
    // Refs
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

// ──────────────────────────── Defaults ────────────────────────────

const DEFAULT_FILTERS: Filters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpness: 100,
    blur: 0,
    grayscale: 0,
};

export const RESIZE_PRESETS: ResizePreset[] = [
    { id: 'original', label: 'Original', sub: 'Taille native', width: 0, height: 0, category: 'Général' },
    { id: 'insta-post', label: 'Instagram Post', sub: '1080 × 1080', width: 1080, height: 1080, category: 'Instagram' },
    { id: 'insta-story', label: 'Instagram Story', sub: '1080 × 1920', width: 1080, height: 1920, category: 'Instagram' },
    { id: 'insta-reel', label: 'Reel Cover', sub: '1080 × 1350', width: 1080, height: 1350, category: 'Instagram' },
    { id: 'fb-cover', label: 'Facebook Cover', sub: '820 × 312', width: 820, height: 312, category: 'Facebook' },
    { id: 'fb-post', label: 'Facebook Post', sub: '1200 × 630', width: 1200, height: 630, category: 'Facebook' },
    { id: 'linkedin-banner', label: 'LinkedIn Banner', sub: '1584 × 396', width: 1584, height: 396, category: 'LinkedIn' },
    { id: 'linkedin-post', label: 'LinkedIn Post', sub: '1200 × 627', width: 1200, height: 627, category: 'LinkedIn' },
    { id: 'web-hero', label: 'Web Hero', sub: '1920 × 1080', width: 1920, height: 1080, category: 'Web' },
    { id: 'og-image', label: 'OG Image', sub: '1200 × 630', width: 1200, height: 630, category: 'Web' },
    { id: 'favicon', label: 'Favicon', sub: '512 × 512', width: 512, height: 512, category: 'Web' },
    { id: 'custom', label: 'Libre', sub: 'Personnalisé', width: 0, height: 0, category: 'Général' },
];

const MAX_HISTORY = 20;

// ──────────────────────────── Hook ────────────────────────────

export function useMediaEditor() {
    // ──── Image state ────
    const [image, setImage] = useState<string | null>(null);
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    // ──── Filters ────
    const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);

    // ──── View ────
    const [activeTool, setActiveTool] = useState<ToolMode>('ai');
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [showComparison, setShowComparison] = useState(false);
    const [comparisonPosition, setComparisonPosition] = useState(50);

    // ──── Resize ────
    const [selectedPreset, setSelectedPreset] = useState('original');
    const [customDims, setCustomDims] = useState({ width: 1080, height: 1080 });
    const [lockRatio, setLockRatio] = useState(true);

    // ──── Crop ────
    const [crop, setCrop] = useState<CropState>({ active: false, x: 0, y: 0, width: 0, height: 0 });

    // ──── Export ────
    const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
    const [exportQuality, setExportQuality] = useState(92);

    // ──── AI ────
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [currentAction, setCurrentAction] = useState('');
    const [palette, setPalette] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // ──── Undo/Redo ────
    const historyRef = useRef<HistoryEntry[]>([]);
    const historyIndexRef = useRef(-1);

    // ──── Refs ────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ──── History helpers ────
    const pushHistory = useCallback(() => {
        if (!image) return;
        const entry: HistoryEntry = {
            imageDataUrl: image,
            filters: { ...filters },
            rotation,
            flipH,
            flipV,
        };
        // Truncate forward history
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(entry);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
    }, [image, filters, rotation, flipH, flipV]);

    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        const entry = historyRef.current[historyIndexRef.current];
        setImage(entry.imageDataUrl);
        setFilters({ ...entry.filters });
        setRotation(entry.rotation);
        setFlipH(entry.flipH);
        setFlipV(entry.flipV);
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        const entry = historyRef.current[historyIndexRef.current];
        setImage(entry.imageDataUrl);
        setFilters({ ...entry.filters });
        setRotation(entry.rotation);
        setFlipH(entry.flipH);
        setFlipV(entry.flipV);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);

    // ──── Image loading ────
    const loadImage = useCallback((file: File) => {
        setFileName(file.name);
        setOriginalFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setImage(dataUrl);
            setOriginalImage(dataUrl);
            // Get dimensions
            const img = new Image();
            img.onload = () => {
                setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                setCustomDims({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.src = dataUrl;
            // Push initial history
            historyRef.current = [{
                imageDataUrl: dataUrl,
                filters: { ...DEFAULT_FILTERS },
                rotation: 0,
                flipH: false,
                flipV: false,
            }];
            historyIndexRef.current = 0;
        };
        reader.readAsDataURL(file);
    }, []);

    const handleUpload = useCallback((file: File) => {
        loadImage(file);
        setActiveTool('adjust');
    }, [loadImage]);

    const handleNewImage = useCallback(() => {
        setImage(null);
        setOriginalImage(null);
        setOriginalFile(null);
        setFileName('');
        setPalette([]);
        setActiveTool('ai');
        setImageDimensions({ width: 0, height: 0 });
        setPan({ x: 0, y: 0 });
        setScale(1);
        setShowComparison(false);
        setFilters({ ...DEFAULT_FILTERS });
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setSelectedPreset('original');
        setCrop({ active: false, x: 0, y: 0, width: 0, height: 0 });
        historyRef.current = [];
        historyIndexRef.current = -1;
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleUpload(file);
        }
    }, [handleUpload]);

    // ──── Filters ────
    const setFilter = useCallback((key: keyof Filters, value: number) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetFilters = useCallback(() => {
        pushHistory();
        setFilters({ ...DEFAULT_FILTERS });
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
    }, [pushHistory]);

    const rotate90 = useCallback((direction: 'cw' | 'ccw') => {
        pushHistory();
        setRotation(prev => prev + (direction === 'cw' ? 90 : -90));
    }, [pushHistory]);

    const toggleFlipH = useCallback(() => {
        pushHistory();
        setFlipH(prev => !prev);
    }, [pushHistory]);

    const toggleFlipV = useCallback(() => {
        pushHistory();
        setFlipV(prev => !prev);
    }, [pushHistory]);

    // ──── View ────
    const resetView = useCallback(() => {
        setScale(1);
        setPan({ x: 0, y: 0 });
    }, []);

    // ──── Crop ────
    const applyCrop = useCallback(() => {
        if (!crop.active || !image) return;
        pushHistory();

        const img = new Image();
        img.onload = () => {
            const cvs = document.createElement('canvas');
            cvs.width = crop.width;
            cvs.height = crop.height;
            const ctx = cvs.getContext('2d')!;
            ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            const dataUrl = cvs.toDataURL('image/png');
            setImage(dataUrl);
            setImageDimensions({ width: crop.width, height: crop.height });
            setCrop({ active: false, x: 0, y: 0, width: 0, height: 0 });
        };
        img.src = image;
    }, [crop, image, pushHistory]);

    const cancelCrop = useCallback(() => {
        setCrop({ active: false, x: 0, y: 0, width: 0, height: 0 });
    }, []);

    const clearError = useCallback(() => setError(null), []);

    // ──── AI Processing ────
    const handleProcessAI = useCallback(async (action: string) => {
        if (!originalFile && !image) return;
        pushHistory();
        setIsProcessing(true);
        setCurrentAction(action);
        setProcessingProgress(0);
        setError(null);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setProcessingProgress(prev => {
                if (prev >= 90) { clearInterval(progressInterval); return 90; }
                return prev + Math.random() * 15;
            });
        }, 300);

        try {
            const formData = new FormData();
            
            // If we have modified image (not the original file), convert to blob
            if (image && image !== originalImage) {
                const resp = await fetch(image);
                const blob = await resp.blob();
                formData.append('file', blob, fileName || 'image.png');
            } else if (originalFile) {
                formData.append('file', originalFile);
            }

            // For compress action, add quality/format params
            if (action === 'compress') {
                formData.append('quality', String(exportQuality));
                formData.append('format', exportFormat === 'png' ? 'webp' : exportFormat);
            }

            const endpoint = action;
            const res = await apiFetch(`/api/v1/media/${endpoint}`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erreur serveur (${res.status})`);
            }

            const data = await res.json();

            if (data.success) {
                if (action === 'palette') {
                    setPalette(data.palette || []);
                } else if (data.image) {
                    setImage(data.image);
                    // Update dimensions for the new image
                    const newImg = new Image();
                    newImg.onload = () => {
                        setImageDimensions({ width: newImg.naturalWidth, height: newImg.naturalHeight });
                    };
                    newImg.src = data.image;
                }
                setProcessingProgress(100);
            } else {
                throw new Error(data.error || 'Erreur inconnue');
            }
        } catch (err: any) {
            console.error('AI processing error:', err);
            const msg = err?.message || 'Erreur lors du traitement. Veuillez réessayer.';
            setError(msg);
        } finally {
            clearInterval(progressInterval);
            setTimeout(() => {
                setIsProcessing(false);
                setCurrentAction('');
                setProcessingProgress(0);
            }, 600);
        }
    }, [originalFile, image, originalImage, fileName, pushHistory, exportQuality, exportFormat]);

    // ──── Export (async – loads image properly) ────
    const loadImageAsync = useCallback((src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }, []);

    const getExportCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
        if (!image) return null;
        const img = await loadImageAsync(image);

        const canvas = document.createElement('canvas');

        // Determine target dimensions
        const preset = RESIZE_PRESETS.find(p => p.id === selectedPreset);
        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;
        if (preset && preset.width > 0 && preset.id !== 'original') {
            targetW = preset.width;
            targetH = preset.height;
        } else if (selectedPreset === 'custom') {
            targetW = customDims.width;
            targetH = customDims.height;
        }

        // Handle rotation swap
        const isRotated90 = Math.abs(rotation % 180) !== 0;
        if (isRotated90) {
            canvas.width = targetH;
            canvas.height = targetW;
        } else {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // Apply filters
        const filterParts: string[] = [];
        if (filters.brightness !== 100) filterParts.push(`brightness(${filters.brightness}%)`);
        if (filters.contrast !== 100) filterParts.push(`contrast(${filters.contrast}%)`);
        if (filters.saturation !== 100) filterParts.push(`saturate(${filters.saturation}%)`);
        if (filters.grayscale > 0) filterParts.push(`grayscale(${filters.grayscale}%)`);
        if (filters.blur > 0) filterParts.push(`blur(${filters.blur}px)`);
        if (filterParts.length) ctx.filter = filterParts.join(' ');

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
        ctx.restore();

        return canvas;
    }, [image, selectedPreset, customDims, rotation, flipH, flipV, filters, loadImageAsync]);

    const handleDownload = useCallback(async () => {
        const canvas = await getExportCanvas();
        if (!canvas) return;

        const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : exportFormat === 'webp' ? 'image/webp' : 'image/png';
        const quality = exportFormat === 'png' ? undefined : exportQuality / 100;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        const baseName = fileName ? fileName.replace(/\.[^.]+$/, '') : 'marion-media';
        const ext = exportFormat === 'jpeg' ? 'jpg' : exportFormat;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${baseName}_edited.${ext}`;
        link.click();
    }, [getExportCanvas, exportFormat, exportQuality, fileName]);

    const copyToClipboard = useCallback(async () => {
        const canvas = await getExportCanvas();
        if (!canvas) return;
        try {
            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), 'image/png');
            });
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }, [getExportCanvas]);

    // ──── Preset change: set custom dims ────
    useEffect(() => {
        const preset = RESIZE_PRESETS.find(p => p.id === selectedPreset);
        if (preset && preset.width > 0) {
            setCustomDims({ width: preset.width, height: preset.height });
        } else if (selectedPreset === 'original' && imageDimensions.width > 0) {
            setCustomDims({ width: imageDimensions.width, height: imageDimensions.height });
        }
    }, [selectedPreset, imageDimensions]);

    // ──── Build return ────
    const state: MediaEditorState = {
        image,
        originalImage,
        originalFile,
        imageDimensions,
        filters,
        rotation,
        flipH,
        flipV,
        activeTool,
        scale,
        pan,
        showComparison,
        comparisonPosition,
        selectedPreset,
        customDims,
        lockRatio,
        crop,
        exportFormat,
        exportQuality,
        isProcessing,
        processingProgress,
        currentAction,
        palette,
        error,
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1,
        hasImage: !!image,
        fileName,
    };

    const actions: MediaEditorActions = {
        handleUpload,
        handleNewImage,
        handleDrop,
        setFilter,
        resetFilters,
        setRotation,
        rotate90,
        toggleFlipH,
        toggleFlipV,
        setActiveTool,
        setScale,
        setPan,
        resetView,
        setShowComparison,
        setComparisonPosition,
        setSelectedPreset,
        setCustomDims,
        setLockRatio,
        setCrop,
        applyCrop,
        cancelCrop,
        setExportFormat,
        setExportQuality,
        handleDownload,
        copyToClipboard,
        handleProcessAI,
        clearError,
        undo,
        redo,
        pushHistory,
        canvasRef,
        fileInputRef,
    };

    return { state, actions };
}
