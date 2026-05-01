/**
 * MediaStudio – Main container for the media editor
 *
 * Layout: Header top, Canvas center, Side panel right, Toolbar bottom.
 * Replaces the old monolithic MediaStudio component.
 */
import React, { useEffect } from 'react';
import { X, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { useMediaEditor } from './useMediaEditor';
import { UploadView } from './UploadView';
import { EditorCanvas } from './EditorCanvas';
import { ToolbarBottom } from './ToolbarBottom';
import { PanelAdjust } from './PanelAdjust';
import { PanelResize } from './PanelResize';
import { PanelAI } from './PanelAI';
import { PanelExport } from './PanelExport';
import { PanelGenerate } from './PanelGenerate';

interface MediaStudioProps {
    onClose: () => void;
}

export const MediaStudio: React.FC<MediaStudioProps> = ({ onClose }) => {
    const { state, actions } = useMediaEditor();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) actions.handleUpload(file);
    };

    // Determine which side panel to show
    const renderPanel = () => {
        switch (state.activeTool) {
            case 'adjust': return <PanelAdjust state={state} actions={actions} />;
            case 'resize': return <PanelResize state={state} actions={actions} />;
            case 'ai': return <PanelAI state={state} actions={actions} />;
            case 'export': return <PanelExport state={state} actions={actions} />;
            case 'generate': return <PanelGenerate state={state} actions={actions} />;
            default: return null;
        }
    };

    // Generate panel is the only one available without an image (to create one)
    const panel = state.hasImage || state.activeTool === 'generate'
        ? renderPanel()
        : null;

    return (
        <div className="fixed inset-0 z-[500] bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
            {/* ─── HEADER ─── */}
            <div className="relative z-50 flex items-center justify-between px-3 md:px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                        <ImageIcon size={16} className="text-[var(--brand-orange)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-800 dark:text-white">Atelier Médias</h1>
                        {state.fileName && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                                {state.fileName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Quick info center */}
                {state.hasImage && (
                    <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="tabular-nums">
                            {state.imageDimensions.width} × {state.imageDimensions.height}px
                        </span>
                        {state.rotation !== 0 && (
                            <span className="tabular-nums">{state.rotation}°</span>
                        )}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                    <X size={20} />
                </button>
            </div>

            {/* ─── MAIN AREA ─── */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                {/* Canvas / Upload area */}
                {state.hasImage ? (
                    <EditorCanvas state={state} actions={actions} />
                ) : (
                    <UploadView actions={actions} />
                )}

                {/* Side panel - bottom sheet on mobile, sidebar on desktop */}
                {panel && (
                    <div className="max-h-[40vh] md:max-h-none md:h-auto w-full md:w-72 xl:w-80 flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar p-4 md:p-5">
                        {panel}
                    </div>
                )}
            </div>

            {/* ─── BOTTOM TOOLBAR ─── */}
            {state.hasImage && (
                <ToolbarBottom state={state} actions={actions} />
            )}

            {/* Error toast */}
            {state.error && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg max-w-md">
                        <AlertTriangle size={16} className="flex-shrink-0" />
                        <span className="text-sm">{state.error}</span>
                        <button
                            onClick={actions.clearError}
                            className="ml-2 text-red-400 hover:text-red-600 dark:hover:text-red-200 flex-shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                type="file"
                ref={actions.fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
};
