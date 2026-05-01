/**
 * ToolbarBottom – Floating bottom toolbar for tool selection
 */
import React from 'react';
import {
    Crop, Sliders, Sparkles, Download, Eye, EyeOff,
    Undo2, Redo2, ImagePlus, WandSparkles,
} from 'lucide-react';
import type { MediaEditorState, MediaEditorActions, ToolMode } from './useMediaEditor';

interface ToolbarBottomProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

const TOOLS: { id: ToolMode; icon: React.ElementType; label: string }[] = [
    { id: 'adjust', icon: Sliders, label: 'Réglages' },
    { id: 'resize', icon: Crop, label: 'Format' },
    { id: 'ai', icon: Sparkles, label: 'IA' },
    { id: 'generate', icon: WandSparkles, label: 'Générer' },
    { id: 'export', icon: Download, label: 'Export' },
];

export const ToolbarBottom: React.FC<ToolbarBottomProps> = ({ state, actions }) => {
    return (
        <div className="absolute bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded-2xl shadow-xl">
                {/* Undo/Redo */}
                <button
                    onClick={actions.undo}
                    disabled={!state.canUndo}
                    className="p-2.5 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                    title="Annuler (Ctrl+Z)"
                >
                    <Undo2 size={18} />
                </button>
                <button
                    onClick={actions.redo}
                    disabled={!state.canRedo}
                    className="p-2.5 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                    title="Rétablir (Ctrl+Shift+Z)"
                >
                    <Redo2 size={18} />
                </button>

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Main tools */}
                {TOOLS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => actions.setActiveTool(state.activeTool === t.id ? 'none' : t.id)}
                        className={`
                            relative p-2.5 rounded-xl transition-all duration-200 group
                            ${state.activeTool === t.id
                                ? 'bg-[var(--brand-orange)] text-white shadow-lg shadow-[var(--brand-orange)]/20 scale-105 -translate-y-0.5'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                            }
                        `}
                    >
                        <t.icon size={20} />
                        <span className={`
                            absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold 
                            bg-slate-800 dark:bg-slate-700 text-white px-2 py-1 rounded-md 
                            opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap 
                            pointer-events-none shadow-lg
                            ${state.activeTool === t.id ? 'hidden' : ''}
                        `}>
                            {t.label}
                        </span>
                    </button>
                ))}

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Compare */}
                <button
                    onClick={() => actions.setShowComparison(!state.showComparison)}
                    className={`
                        p-2.5 rounded-xl transition-all
                        ${state.showComparison
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                        }
                    `}
                    title="Comparer avant/après"
                >
                    {state.showComparison ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>

                {/* New image */}
                <button
                    onClick={actions.handleNewImage}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    title="Nouvelle image"
                >
                    <ImagePlus size={18} />
                </button>
            </div>
        </div>
    );
};
