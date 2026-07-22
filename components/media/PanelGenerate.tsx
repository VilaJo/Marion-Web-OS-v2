/**
 * PanelGenerate – AI image generation via Imagen
 *
 * Marion can describe an image, choose a style and ratio, and the result
 * is loaded directly into the canvas for further editing.
 */
import React, { useState } from 'react';
import {
    WandSparkles, Loader2, AlertCircle, Camera,
    Image as ImageIcon, Layers, Brush, Monitor, Droplet,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import type { MediaEditorState, MediaEditorActions } from './useMediaEditor';

interface PanelGenerateProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

const STYLES = [
    { id: 'photorealistic', label: 'Photo', icon: Camera, hint: 'Photo réaliste pro' },
    { id: 'illustration',   label: 'Illustration', icon: Brush, hint: 'Vectoriel coloré' },
    { id: 'flat',           label: 'Flat', icon: Layers, hint: 'Design plat épuré' },
    { id: 'mockup',         label: 'Mockup', icon: Monitor, hint: 'Maquette UI/Web' },
    { id: 'watercolor',     label: 'Aquarelle', icon: Droplet, hint: 'Peinture douce' },
];

const RATIOS: { id: string; label: string; w: number; h: number }[] = [
    { id: '16:9', label: 'Paysage', w: 32, h: 18 },
    { id: '1:1',  label: 'Carré',   w: 24, h: 24 },
    { id: '9:16', label: 'Portrait', w: 18, h: 32 },
    { id: '4:3',  label: 'Classique', w: 28, h: 21 },
];

export const PanelGenerate: React.FC<PanelGenerateProps> = ({ actions }) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('photorealistic');
    const [ratio, setRatio] = useState('16:9');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        setError(null);
        try {
            const res = await apiFetch('/api/v1/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt.trim(), style, ratio }),
            });
            const data = await res.json();
            if (!res.ok || !data.image) {
                throw new Error(data.error || 'Génération échouée');
            }
            actions.loadImageFromDataUrl(data.image, `ai-${Date.now()}.png`);
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2">
                <WandSparkles size={14} className="text-[var(--brand-orange)]" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Génération IA
                </h3>
            </div>

            {/* Prompt */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Décris ton image
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Ex: un hero section pour un site SaaS, dégradé violet et bleu, illustration moderne d'un dashboard, style minimaliste"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-[var(--brand-orange)] resize-none"
                    disabled={isGenerating}
                />
            </div>

            {/* Style picker */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {STYLES.map(s => {
                        const active = style === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setStyle(s.id)}
                                disabled={isGenerating}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                    active
                                        ? 'bg-[var(--brand-orange)] text-white border-transparent shadow-sm'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[var(--brand-orange)]/40'
                                }`}
                                title={s.hint}
                            >
                                <s.icon size={14} />
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Ratio picker */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                    {RATIOS.map(r => {
                        const active = ratio === r.id;
                        return (
                            <button
                                key={r.id}
                                onClick={() => setRatio(r.id)}
                                disabled={isGenerating}
                                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                                    active
                                        ? 'bg-[var(--brand-orange)]/10 border-[var(--brand-orange)] text-[var(--brand-orange)]'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[var(--brand-orange)]/40'
                                }`}
                                title={r.id}
                            >
                                <div
                                    className={`bg-current ${active ? 'opacity-80' : 'opacity-30'}`}
                                    style={{ width: r.w, height: r.h, borderRadius: 2 }}
                                />
                                <span>{r.id}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Generate button */}
            <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-eonora-gradient text-white text-sm font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGenerating ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Génération en cours...
                    </>
                ) : (
                    <>
                        <WandSparkles size={16} />
                        Générer l'image
                    </>
                )}
            </button>

            {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
                <ImageIcon size={12} className="flex-shrink-0 mt-0.5" />
                <span>L'image générée sera chargée automatiquement dans l'éditeur, prête à être ajustée et exportée.</span>
            </div>
        </div>
    );
};
