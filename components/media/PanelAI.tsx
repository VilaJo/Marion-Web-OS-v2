/**
 * PanelAI – AI operations: remove background, upscale, extract palette, compress
 */
import React, { useState } from 'react';
import {
    Layers, Zap, Palette, Minimize2, Loader2,
    Check, Copy, Sparkles
} from 'lucide-react';
import type { MediaEditorState, MediaEditorActions } from './useMediaEditor';

interface PanelAIProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

const AI_ACTIONS = [
    {
        id: 'remove_bg',
        label: 'Suppression arrière-plan',
        description: 'Détourage automatique avec IA',
        icon: Layers,
        color: 'orange',
    },
    {
        id: 'upscale',
        label: 'Agrandir HD',
        description: 'Amélioration de résolution 2×',
        icon: Zap,
        color: 'blue',
    },
    {
        id: 'palette',
        label: 'Extraire la palette',
        description: 'Analyse des couleurs dominantes',
        icon: Palette,
        color: 'pink',
    },
    {
        id: 'compress',
        label: 'Compression web',
        description: 'Optimiser le poids pour le web',
        icon: Minimize2,
        color: 'green',
    },
];

const COLOR_MAP: Record<string, string> = {
    orange: 'var(--brand-orange)',
    blue: 'rgb(59 130 246)',
    pink: 'rgb(236 72 153)',
    green: 'rgb(34 197 94)',
};

export const PanelAI: React.FC<PanelAIProps> = ({ state, actions }) => {
    const [copiedColor, setCopiedColor] = useState<string | null>(null);

    const handleCopyColor = async (color: string) => {
        try {
            await navigator.clipboard.writeText(color);
            setCopiedColor(color);
            setTimeout(() => setCopiedColor(null), 1500);
        } catch { /* ignore */ }
    };

    return (
        <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--brand-orange)]" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Intelligence Artificielle
                </h3>
            </div>

            {/* AI Action cards */}
            <div className="space-y-2">
                {AI_ACTIONS.map(action => {
                    const isActive = state.isProcessing && state.currentAction === action.id;
                    const accentColor = COLOR_MAP[action.color] || COLOR_MAP.orange;

                    return (
                        <button
                            key={action.id}
                            onClick={() => actions.handleProcessAI(action.id)}
                            disabled={state.isProcessing}
                            className={`
                                group w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200
                                border
                                ${isActive
                                    ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                                    : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm disabled:opacity-50 disabled:pointer-events-none'
                                }
                            `}
                        >
                            <div
                                className={`
                                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                                    ${isActive ? 'animate-pulse' : 'group-hover:scale-105'}
                                `}
                                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                            >
                                {isActive ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <action.icon size={18} />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-700 dark:text-white">
                                    {action.label}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {isActive ? 'Traitement en cours...' : action.description}
                                </div>
                            </div>
                            {isActive && (
                                <div className="w-12">
                                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{ width: `${state.processingProgress}%`, backgroundColor: accentColor }}
                                        />
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Palette display */}
            {state.palette.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4">
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Palette extraite
                    </h4>
                    <div className="flex flex-col gap-2">
                        {state.palette.map(color => (
                            <button
                                key={color}
                                onClick={() => handleCopyColor(color)}
                                className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group"
                            >
                                <div
                                    className="w-8 h-8 rounded-lg shadow-sm ring-1 ring-black/5 flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="text-xs font-mono text-slate-600 dark:text-slate-300 flex-1 text-left">
                                    {color}
                                </span>
                                {copiedColor === color ? (
                                    <Check size={14} className="text-green-500" />
                                ) : (
                                    <Copy size={14} className="text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 transition-colors" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
