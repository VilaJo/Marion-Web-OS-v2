/**
 * PanelAdjust – Image adjustment sliders (brightness, contrast, etc.) + rotation/flip
 */
import React from 'react';
import { RotateCw, RotateCcw, FlipHorizontal2, FlipVertical2, RefreshCcw } from 'lucide-react';
import type { MediaEditorState, MediaEditorActions, Filters } from './useMediaEditor';

interface PanelAdjustProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

const SLIDERS: { key: keyof Filters; label: string; min: number; max: number; default: number; unit: string }[] = [
    { key: 'brightness', label: 'Luminosité', min: 0, max: 200, default: 100, unit: '%' },
    { key: 'contrast', label: 'Contraste', min: 0, max: 200, default: 100, unit: '%' },
    { key: 'saturation', label: 'Saturation', min: 0, max: 200, default: 100, unit: '%' },
    { key: 'sharpness', label: 'Netteté', min: 0, max: 200, default: 100, unit: '%' },
    { key: 'blur', label: 'Flou', min: 0, max: 20, default: 0, unit: 'px' },
    { key: 'grayscale', label: 'Niveaux de gris', min: 0, max: 100, default: 0, unit: '%' },
];

export const PanelAdjust: React.FC<PanelAdjustProps> = ({ state, actions }) => {
    return (
        <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Réglages
                </h3>
                <button
                    onClick={actions.resetFilters}
                    className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-[var(--brand-orange)] transition-colors"
                >
                    <RefreshCcw size={12} />
                    Réinitialiser
                </button>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
                {SLIDERS.map(s => {
                    const value = state.filters[s.key];
                    const isModified = value !== s.default;
                    // Percentage position for gradient track
                    const pct = ((value - s.min) / (s.max - s.min)) * 100;

                    return (
                        <div key={s.key} className="group">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className={`text-[11px] font-medium ${isModified ? 'text-[var(--brand-orange)]' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {s.label}
                                </span>
                                <span className={`text-[11px] tabular-nums font-medium ${isModified ? 'text-[var(--brand-orange)]' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {value}{s.unit}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={s.min}
                                max={s.max}
                                value={value}
                                onChange={e => actions.setFilter(s.key, Number(e.target.value))}
                                onMouseUp={() => actions.pushHistory()}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-orange)] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                                style={{
                                    background: `linear-gradient(to right, var(--brand-orange) 0%, var(--brand-orange) ${pct}%, rgb(226 232 240) ${pct}%, rgb(226 232 240) 100%)`,
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Rotation & Flip */}
            <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4">
                <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Transformation
                </h4>
                <div className="grid grid-cols-4 gap-2">
                    <button
                        onClick={() => actions.rotate90('ccw')}
                        className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                        title="Rotation -90°"
                    >
                        <RotateCcw size={16} />
                        <span className="text-[9px] font-medium">-90°</span>
                    </button>
                    <button
                        onClick={() => actions.rotate90('cw')}
                        className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                        title="Rotation +90°"
                    >
                        <RotateCw size={16} />
                        <span className="text-[9px] font-medium">+90°</span>
                    </button>
                    <button
                        onClick={actions.toggleFlipH}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-colors ${state.flipH ? 'bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        title="Miroir horizontal"
                    >
                        <FlipHorizontal2 size={16} />
                        <span className="text-[9px] font-medium">Miroir H</span>
                    </button>
                    <button
                        onClick={actions.toggleFlipV}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-colors ${state.flipV ? 'bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        title="Miroir vertical"
                    >
                        <FlipVertical2 size={16} />
                        <span className="text-[9px] font-medium">Miroir V</span>
                    </button>
                </div>
            </div>

            {/* Quick info */}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-2">
                Raccourcis : Ctrl+Z pour annuler, Ctrl+Shift+Z pour rétablir
            </div>
        </div>
    );
};
