import React, { useState, useCallback } from 'react';
import { Pencil, Check } from 'lucide-react';

interface TranscriptTimelineProps {
    segments: string[];
    editable?: boolean;
    onSegmentsChange?: (segments: string[]) => void;
}

export const TranscriptTimeline: React.FC<TranscriptTimelineProps> = ({
    segments,
    editable = false,
    onSegmentsChange,
}) => {
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const startEdit = useCallback((absoluteIdx: number, value: string) => {
        setEditingIdx(absoluteIdx);
        setEditValue(value);
    }, []);

    const commitEdit = useCallback(
        (absoluteIdx: number) => {
            if (!onSegmentsChange) return;
            const updated = [...segments];
            updated[absoluteIdx] = editValue.trim() || segments[absoluteIdx];
            onSegmentsChange(updated);
            setEditingIdx(null);
        },
        [editValue, segments, onSegmentsChange]
    );

    if (!segments.length) {
        return (
            <div className="rounded-2xl border border-white/60 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 backdrop-blur-sm p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Transcript timeline</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Les segments de transcription apparaitront ici.</p>
            </div>
        );
    }

    const displayed = segments.slice(-10);
    const offset = Math.max(0, segments.length - 10);

    return (
        <div className="rounded-2xl border border-white/60 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 backdrop-blur-sm p-4 max-h-72 overflow-y-auto">
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                Transcript timeline
                {editable && <span className="ml-2 normal-case font-normal text-slate-400 dark:text-slate-500">(cliquer pour corriger)</span>}
            </p>
            <div className="space-y-2">
                {displayed.map((segment, idx) => {
                    const absoluteIdx = offset + idx;
                    const isEditing = editingIdx === absoluteIdx;
                    return (
                        <div
                            key={absoluteIdx}
                            className="rounded-lg border border-slate-200 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/50 p-2 group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                                    Segment {absoluteIdx + 1}
                                </p>
                                {editable && !isEditing && (
                                    <button
                                        onClick={() => startEdit(absoluteIdx, segment)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-orange"
                                        aria-label="Modifier"
                                    >
                                        <Pencil size={11} />
                                    </button>
                                )}
                                {isEditing && (
                                    <button
                                        onClick={() => commitEdit(absoluteIdx)}
                                        className="text-emerald-500 hover:text-emerald-600"
                                        aria-label="Valider"
                                    >
                                        <Check size={13} />
                                    </button>
                                )}
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(absoluteIdx); }
                                        if (e.key === 'Escape') setEditingIdx(null);
                                    }}
                                    rows={2}
                                    autoFocus
                                    className="w-full text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-brand-orange/40 rounded-md px-2 py-1 resize-none outline-none"
                                />
                            ) : (
                                <p
                                    className={`text-sm text-slate-700 dark:text-slate-200 ${editable ? 'cursor-pointer' : ''}`}
                                    onClick={() => editable && startEdit(absoluteIdx, segment)}
                                >
                                    {segment}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
