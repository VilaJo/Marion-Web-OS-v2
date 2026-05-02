/**
 * ScreenshotToPrompt — réutilisable
 *
 * Drop-zone image -> POST /ai/wp-studio/screenshot-to-prompt -> renvoie un prompt
 * Cursor prêt à coller. Bouton de copie + bouton "Sauver dans la bibliothèque"
 * (push direct dans le localStorage `cursor_prompt_library`).
 *
 * Utilisé dans :
 *  - pages/WpStudioPage.tsx (mode "outils rapides")
 *  - pages/PromptLibraryPage.tsx (onglet "Capture → prompt")
 *  - components/ClientView.tsx (onglet Refonte)
 */

import React, { useCallback, useRef, useState } from 'react';
import {
    Upload, Image as ImageIcon, Loader2, Copy, Check, BookmarkPlus, Wand2,
    AlertCircle, X, Sparkles,
} from 'lucide-react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenshotPromptResult {
    title: string;
    tags: string[];
    category: string;
    cursor_prompt: string;
    design_tokens?: {
        colors?: string[];
        typography?: string;
        spacing?: string;
        radius?: string;
    };
    notes?: string;
}

interface Props {
    /** Pré-rempli "context" envoyé au backend */
    defaultContext?: string;
    /** Affichage compact (carte plus petite, moins d'options) */
    compact?: boolean;
    /** Callback quand un prompt a été sauvegardé en bibliothèque */
    onSavedToLibrary?: (result: ScreenshotPromptResult) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROMPT_LIBRARY_KEY = 'cursor_prompt_library';
const PROMPT_LIBRARY_INIT_KEY = 'cursor_prompt_library_initialized';

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function pushToPromptLibrary(result: ScreenshotPromptResult) {
    try {
        const raw = localStorage.getItem(PROMPT_LIBRARY_KEY);
        const list: any[] = raw ? JSON.parse(raw) : [];
        list.unshift({
            id: `wp-studio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: result.title || 'Section capturée',
            content: result.cursor_prompt,
            category: ['landing-page', 'ecommerce', 'portfolio', 'refonte', 'composant', 'autre'].includes(result.category)
                ? result.category
                : 'autre',
            tags: result.tags || [],
            rating: 4,
            usageCount: 0,
            createdAt: new Date().toISOString(),
        });
        localStorage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify(list));
        localStorage.setItem(PROMPT_LIBRARY_INIT_KEY, 'true');
    } catch (e) {
        console.warn('Could not push prompt to library', e);
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScreenshotToPrompt: React.FC<Props> = ({
    defaultContext = '',
    compact = false,
    onSavedToLibrary,
}) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);
    const [context, setContext] = useState(defaultContext);
    const [style, setStyle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScreenshotPromptResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        setResult(null);
        setSaved(false);
        if (!file.type.startsWith('image/')) {
            setError("Ce n'est pas une image (JPEG, PNG, WebP, etc.)");
            return;
        }
        if (file.size > 6 * 1024 * 1024) {
            setError('Image trop lourde (max 6 Mo). Compresse-la ou recadre-la.');
            return;
        }
        try {
            const dataUrl = await fileToDataUrl(file);
            setPreviewUrl(dataUrl);
            setImageData(dataUrl);
        } catch {
            setError('Impossible de lire le fichier.');
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const f = items[i].getAsFile();
                if (f) {
                    handleFile(f);
                    e.preventDefault();
                    break;
                }
            }
        }
    }, [handleFile]);

    const handleGenerate = async () => {
        if (!imageData) {
            setError('Charge d\'abord une capture.');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiFetch('/api/v1/ai/wp-studio/screenshot-to-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    context: context.trim() || undefined,
                    style: style.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Génération impossible.');
                return;
            }
            setResult(data);
        } catch {
            setError('Impossible de joindre le serveur.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.cursor_prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setError('Impossible de copier.');
        }
    };

    const handleSave = () => {
        if (!result) return;
        pushToPromptLibrary(result);
        setSaved(true);
        onSavedToLibrary?.(result);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleReset = () => {
        setPreviewUrl(null);
        setImageData(null);
        setResult(null);
        setError(null);
        setCopied(false);
        setSaved(false);
    };

    return (
        <div
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden"
            onPaste={handlePaste}
        >
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
                    <Wand2 size={18} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm">Capture → Prompt Cursor</h3>
                    <p className="text-[11px] text-white/85">Glisse une section, je te génère le prompt prêt à coller</p>
                </div>
            </div>

            <div className={`p-4 space-y-4 ${compact ? '' : 'md:p-5'}`}>
                {!previewUrl ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                            isDragging
                                ? 'border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20'
                                : 'border-slate-300 dark:border-slate-600 hover:border-fuchsia-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                    >
                        <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Glisse une image ici</p>
                        <p className="text-xs text-slate-500 mt-1">ou clique, ou colle (⌘+V) — JPG/PNG/WebP, 6 Mo max</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                            }}
                        />
                    </div>
                ) : (
                    <div className="relative">
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full max-h-72 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                        />
                        <button
                            onClick={handleReset}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-white text-slate-600 hover:text-slate-900 shadow"
                            aria-label="Retirer"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {!compact && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contexte</label>
                            <input
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="Section pricing pour SaaS B2B"
                                className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Style souhaité (optionnel)</label>
                            <input
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                placeholder="Minimaliste, dark mode, accent violet"
                                className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-fuchsia-400"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {imageData && !result && (
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-semibold disabled:opacity-50 hover:brightness-105 transition-all"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {loading ? 'Analyse en cours…' : 'Générer le prompt Cursor'}
                    </button>
                )}

                {result && (
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">{result.title}</h4>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {(result.tags || []).map(t => (
                                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300">
                                            #{t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {result.category}
                            </span>
                        </div>

                        <div className="rounded-xl bg-slate-900 dark:bg-black text-slate-100 p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                            {result.cursor_prompt}
                        </div>

                        {result.design_tokens && (
                            <details className="text-xs">
                                <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Design tokens détectés</summary>
                                <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                                    {result.design_tokens.colors && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] text-slate-500">Couleurs :</span>
                                            {result.design_tokens.colors.map(c => (
                                                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono">
                                                    <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ background: c }} />
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {result.design_tokens.typography && (
                                        <div className="text-[11px]"><strong className="text-slate-500">Typo :</strong> {result.design_tokens.typography}</div>
                                    )}
                                    {result.design_tokens.spacing && (
                                        <div className="text-[11px]"><strong className="text-slate-500">Espacement :</strong> {result.design_tokens.spacing}</div>
                                    )}
                                    {result.design_tokens.radius && (
                                        <div className="text-[11px]"><strong className="text-slate-500">Radius :</strong> {result.design_tokens.radius}</div>
                                    )}
                                </div>
                            </details>
                        )}

                        {result.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">{result.notes}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                            >
                                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                {copied ? 'Copié !' : 'Copier le prompt'}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-semibold"
                            >
                                {saved ? <Check size={14} /> : <BookmarkPlus size={14} />}
                                {saved ? 'Ajouté à la bibliothèque' : 'Sauver dans bibliothèque'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <ImageIcon size={14} /> Nouvelle image
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScreenshotToPrompt;
