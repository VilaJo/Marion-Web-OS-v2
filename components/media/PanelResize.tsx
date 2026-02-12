/**
 * PanelResize – Resize presets (social media, web, custom) with visual preview
 */
import React, { useMemo } from 'react';
import { Instagram, Facebook, Linkedin, Globe, Maximize2, Lock, Unlock } from 'lucide-react';
import type { MediaEditorState, MediaEditorActions } from './useMediaEditor';
import { RESIZE_PRESETS } from './useMediaEditor';

interface PanelResizeProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    'Instagram': Instagram,
    'Facebook': Facebook,
    'LinkedIn': Linkedin,
    'Web': Globe,
    'Général': Maximize2,
};

export const PanelResize: React.FC<PanelResizeProps> = ({ state, actions }) => {
    // Group presets by category
    const groupedPresets = useMemo(() => {
        const groups: Record<string, typeof RESIZE_PRESETS> = {};
        RESIZE_PRESETS.forEach(p => {
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });
        return groups;
    }, []);

    return (
        <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Format & Dimensions
            </h3>

            {/* Preset categories */}
            <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-1">
                {Object.entries(groupedPresets).map(([category, presets]) => {
                    const CategoryIcon = CATEGORY_ICONS[category] || Maximize2;
                    return (
                        <div key={category}>
                            <div className="flex items-center gap-2 mb-2">
                                <CategoryIcon size={12} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {category}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                                {presets.map(preset => {
                                    const isActive = state.selectedPreset === preset.id;
                                    // Mini preview aspect ratio
                                    const previewW = preset.width || state.imageDimensions.width || 100;
                                    const previewH = preset.height || state.imageDimensions.height || 100;
                                    const aspect = previewW / previewH;
                                    const boxW = aspect >= 1 ? 28 : 28 * aspect;
                                    const boxH = aspect >= 1 ? 28 / aspect : 28;

                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => actions.setSelectedPreset(preset.id)}
                                            className={`
                                                flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                                                ${isActive
                                                    ? 'bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[var(--brand-orange)]'
                                                    : 'bg-slate-50 dark:bg-slate-700/30 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                                                }
                                            `}
                                        >
                                            {/* Mini aspect preview */}
                                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                                                <div
                                                    className={`rounded-[3px] transition-colors ${isActive ? 'bg-[var(--brand-orange)]/30 border border-[var(--brand-orange)]/50' : 'bg-slate-200 dark:bg-slate-600 border border-slate-300 dark:border-slate-500'}`}
                                                    style={{ width: boxW, height: boxH }}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className={`text-xs font-semibold truncate ${isActive ? 'text-[var(--brand-orange)]' : ''}`}>
                                                    {preset.label}
                                                </div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                                    {preset.sub}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Custom dimensions */}
            <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Dimensions personnalisées
                    </h4>
                    <button
                        onClick={() => actions.setLockRatio(!state.lockRatio)}
                        className={`p-1.5 rounded-lg transition-colors ${state.lockRatio ? 'text-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        title={state.lockRatio ? 'Ratio verrouillé' : 'Ratio libre'}
                    >
                        {state.lockRatio ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <label className="text-[9px] text-slate-400 font-medium block mb-1">Largeur</label>
                        <input
                            type="number"
                            value={state.customDims.width}
                            onChange={e => {
                                const w = Number(e.target.value);
                                if (state.lockRatio && state.imageDimensions.width > 0) {
                                    const ratio = state.imageDimensions.height / state.imageDimensions.width;
                                    actions.setCustomDims({ width: w, height: Math.round(w * ratio) });
                                } else {
                                    actions.setCustomDims({ ...state.customDims, width: w });
                                }
                                actions.setSelectedPreset('custom');
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm tabular-nums outline-none text-slate-700 dark:text-white focus:border-[var(--brand-orange)] transition-colors"
                        />
                    </div>
                    <span className="text-slate-300 dark:text-slate-600 mt-4">×</span>
                    <div className="flex-1">
                        <label className="text-[9px] text-slate-400 font-medium block mb-1">Hauteur</label>
                        <input
                            type="number"
                            value={state.customDims.height}
                            onChange={e => {
                                const h = Number(e.target.value);
                                if (state.lockRatio && state.imageDimensions.height > 0) {
                                    const ratio = state.imageDimensions.width / state.imageDimensions.height;
                                    actions.setCustomDims({ width: Math.round(h * ratio), height: h });
                                } else {
                                    actions.setCustomDims({ ...state.customDims, height: h });
                                }
                                actions.setSelectedPreset('custom');
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm tabular-nums outline-none text-slate-700 dark:text-white focus:border-[var(--brand-orange)] transition-colors"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
