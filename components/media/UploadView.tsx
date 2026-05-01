/**
 * UploadView – Drag & drop upload screen for the Media Studio
 */
import React, { useState, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, FileImage, WandSparkles } from 'lucide-react';
import type { MediaEditorActions } from './useMediaEditor';

interface UploadViewProps {
    actions: MediaEditorActions;
}

export const UploadView: React.FC<UploadViewProps> = ({ actions }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        actions.handleDrop(e);
    }, [actions]);

    const handleClick = useCallback(() => {
        actions.fileInputRef.current?.click();
    }, [actions]);

    return (
        <div
            className="flex-1 flex items-center justify-center p-8"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div
                onClick={handleClick}
                className={`
                    relative group cursor-pointer w-full max-w-lg transition-all duration-500
                    ${isDragOver ? 'scale-105' : ''}
                `}
            >
                {/* Background glow */}
                <div className={`
                    absolute -inset-4 rounded-[2rem] transition-all duration-500
                    ${isDragOver
                        ? 'bg-[var(--brand-orange)]/20 blur-[60px]'
                        : 'bg-[var(--brand-orange)]/5 blur-[40px] group-hover:bg-[var(--brand-orange)]/10'
                    }
                `} />

                <div className={`
                    relative rounded-2xl border-2 border-dashed p-12 transition-all duration-300 
                    flex flex-col items-center gap-6 text-center
                    bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm
                    ${isDragOver
                        ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/5 dark:bg-[var(--brand-orange)]/10'
                        : 'border-slate-300 dark:border-slate-600 group-hover:border-[var(--brand-orange)]/50'
                    }
                `}>
                    <div className={`
                        w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300
                        ${isDragOver
                            ? 'bg-[var(--brand-orange)] text-white scale-110'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-[var(--brand-orange)]/10 group-hover:text-[var(--brand-orange)]'
                        }
                    `}>
                        <UploadCloud size={36} className="transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            {isDragOver ? 'Déposez l\'image ici' : 'Importer une image'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Glissez-déposez ou cliquez pour parcourir
                        </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full">
                            <ImageIcon size={12} />
                            <span>JPG, PNG</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full">
                            <FileImage size={12} />
                            <span>WebP, SVG</span>
                        </div>
                    </div>

                    {/* OR — Generate with AI */}
                    <div className="flex items-center gap-3 w-full mt-2">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">ou</span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            actions.setActiveTool('generate');
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-pink-500 text-white text-sm font-bold shadow-md hover:brightness-105 transition-all"
                    >
                        <WandSparkles size={16} />
                        Générer une image avec l'IA
                    </button>
                </div>
            </div>
        </div>
    );
};
