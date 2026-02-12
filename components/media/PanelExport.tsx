/**
 * PanelExport – Export options: format, quality, download, clipboard
 */
import React, { useMemo } from 'react';
import { Download, Clipboard, FileImage, Image as ImageIcon } from 'lucide-react';
import type { MediaEditorState, MediaEditorActions, ExportFormat } from './useMediaEditor';

interface PanelExportProps {
    state: MediaEditorState;
    actions: MediaEditorActions;
}

const FORMATS: { id: ExportFormat; label: string; description: string; showQuality: boolean }[] = [
    { id: 'png', label: 'PNG', description: 'Sans perte, transparent', showQuality: false },
    { id: 'jpeg', label: 'JPEG', description: 'Compressé, photo', showQuality: true },
    { id: 'webp', label: 'WebP', description: 'Moderne, léger', showQuality: true },
];

export const PanelExport: React.FC<PanelExportProps> = ({ state, actions }) => {
    const showQuality = state.exportFormat !== 'png';

    // Estimate file size (rough approximation)
    const estimatedSize = useMemo(() => {
        const pixels = state.imageDimensions.width * state.imageDimensions.height;
        if (pixels === 0) return '';
        let bytesPerPixel: number;
        switch (state.exportFormat) {
            case 'png': bytesPerPixel = 2.5; break;
            case 'jpeg': bytesPerPixel = 0.3 * (state.exportQuality / 100); break;
            case 'webp': bytesPerPixel = 0.2 * (state.exportQuality / 100); break;
            default: bytesPerPixel = 1;
        }
        const totalBytes = pixels * bytesPerPixel;
        if (totalBytes < 1024) return `~${Math.round(totalBytes)} o`;
        if (totalBytes < 1024 * 1024) return `~${Math.round(totalBytes / 1024)} Ko`;
        return `~${(totalBytes / (1024 * 1024)).toFixed(1)} Mo`;
    }, [state.imageDimensions, state.exportFormat, state.exportQuality]);

    return (
        <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Export
            </h3>

            {/* Format selection */}
            <div className="space-y-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Format</span>
                <div className="grid grid-cols-3 gap-2">
                    {FORMATS.map(fmt => (
                        <button
                            key={fmt.id}
                            onClick={() => actions.setExportFormat(fmt.id)}
                            className={`
                                flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all duration-200 border
                                ${state.exportFormat === fmt.id
                                    ? 'bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/30 text-[var(--brand-orange)]'
                                    : 'bg-slate-50 dark:bg-slate-700/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                                }
                            `}
                        >
                            <span className="text-sm font-bold uppercase">{fmt.label}</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">{fmt.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quality slider */}
            {showQuality && (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Qualité</span>
                        <span className="text-[11px] tabular-nums font-medium text-[var(--brand-orange)]">
                            {state.exportQuality}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={100}
                        value={state.exportQuality}
                        onChange={e => actions.setExportQuality(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-orange)] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                        style={{
                            background: `linear-gradient(to right, var(--brand-orange) 0%, var(--brand-orange) ${state.exportQuality}%, rgb(226 232 240) ${state.exportQuality}%, rgb(226 232 240) 100%)`,
                        }}
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                        <span>Léger</span>
                        <span>Maximum</span>
                    </div>
                </div>
            )}

            {/* Size estimate */}
            {estimatedSize && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                        <FileImage size={14} className="text-slate-400" />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Poids estimé</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-white tabular-nums">
                        {estimatedSize}
                    </span>
                </div>
            )}

            {/* File name preview */}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Fichier : </span>
                {state.fileName ? state.fileName.replace(/\.[^.]+$/, '') : 'marion-media'}_edited.{state.exportFormat === 'jpeg' ? 'jpg' : state.exportFormat}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
                <button
                    onClick={actions.handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--brand-orange)] hover:bg-[#e06d4f] text-white rounded-xl font-bold text-sm shadow-lg shadow-[var(--brand-orange)]/20 hover:shadow-[var(--brand-orange)]/30 transition-all"
                >
                    <Download size={16} />
                    Télécharger
                </button>
                <button
                    onClick={actions.copyToClipboard}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-medium text-sm transition-all"
                >
                    <Clipboard size={14} />
                    Copier dans le presse-papier
                </button>
            </div>
        </div>
    );
};
