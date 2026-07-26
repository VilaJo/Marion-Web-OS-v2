/**
 * ClientsFolderTree — Linear folder sidebar for the Dashboard clients explorer
 */

import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { Project, ProjectStatus } from '../types';

export interface ClientsFolderTreeProps {
    projects: Project[];
    selected: string; // status value or 'Tous'
    onSelect: (status: string) => void;
}

const FOLDER_ORDER: ProjectStatus[] = [
    ProjectStatus.EN_COURS,
    ProjectStatus.MAINTENANCE,
    ProjectStatus.ASSOCIATION,
    ProjectStatus.PROSPECT,
    ProjectStatus.ARCHIVED,
];

const STATUS_DOT: Record<ProjectStatus, string> = {
    [ProjectStatus.EN_COURS]: '#2aada0',
    [ProjectStatus.MAINTENANCE]: '#4a72c4',
    [ProjectStatus.ASSOCIATION]: '#7C9A7E',
    [ProjectStatus.PROSPECT]: '#b05070',
    [ProjectStatus.ARCHIVED]: '#8A8A8E',
};

export const ClientsFolderTree: React.FC<ClientsFolderTreeProps> = ({ projects, selected, onSelect }) => {
    const countFor = (status: ProjectStatus | 'Tous'): number => {
        if (status === 'Tous') return projects.length;
        return projects.filter((p) => p.status === status).length;
    };

    return (
        <>
            {/* Mobile: horizontal chip strip */}
            <nav aria-label="Dossiers clients" className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <FolderChip
                    label="Tous"
                    count={countFor('Tous')}
                    isSelected={selected === 'Tous'}
                    onClick={() => onSelect('Tous')}
                />
                {FOLDER_ORDER.map((status) => (
                    <FolderChip
                        key={status}
                        label={status}
                        count={countFor(status)}
                        isSelected={selected === status}
                        emphasized={status === ProjectStatus.EN_COURS}
                        dot={STATUS_DOT[status]}
                        onClick={() => onSelect(status)}
                    />
                ))}
            </nav>

            {/* Desktop: vertical folder list — Linear */}
            <nav
                aria-label="Dossiers clients"
                className="hidden md:flex md:flex-col w-full rounded-lg border border-slate-200 dark:border-[#262626] bg-white dark:bg-[#151516] overflow-hidden"
            >
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-[#262626] flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8A8A8E]">
                        Dossiers
                    </p>
                    <span className="text-[10px] tabular-nums text-slate-400 dark:text-[#8A8A8E]">
                        {countFor('Tous')}
                    </span>
                </div>

                <div className="p-1.5 space-y-0.5">
                    <FolderNode
                        label="Tous"
                        count={countFor('Tous')}
                        isSelected={selected === 'Tous'}
                        onClick={() => onSelect('Tous')}
                    />

                    <div className="my-1.5 mx-1.5 border-t border-slate-100 dark:border-[#262626]" />

                    {FOLDER_ORDER.map((status) => (
                        <FolderNode
                            key={status}
                            label={status}
                            count={countFor(status)}
                            isSelected={selected === status}
                            emphasized={status === ProjectStatus.EN_COURS}
                            dot={STATUS_DOT[status]}
                            onClick={() => onSelect(status)}
                        />
                    ))}
                </div>
            </nav>
        </>
    );
};

interface FolderChipProps {
    label: string;
    count: number;
    isSelected: boolean;
    emphasized?: boolean;
    dot?: string;
    onClick: () => void;
}

const FolderChip: React.FC<FolderChipProps> = ({ label, count, isSelected, emphasized, dot, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={isSelected ? 'true' : undefined}
        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors border ${
            emphasized ? 'font-semibold' : 'font-medium'
        } ${
            isSelected
                ? 'bg-slate-900 dark:bg-white/[0.08] text-white border-slate-900 dark:border-[#3f3f46]'
                : 'bg-white dark:bg-[#151516] text-slate-500 dark:text-[#8A8A8E] border-slate-200 dark:border-[#262626]'
        }`}
    >
        {dot && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
        )}
        {label}
        <span className={`text-[10px] tabular-nums ${isSelected ? 'opacity-70' : 'text-slate-400 dark:text-[#8A8A8E]'}`}>
            {count}
        </span>
    </button>
);

interface FolderNodeProps {
    label: string;
    count: number;
    isSelected: boolean;
    emphasized?: boolean;
    dot?: string;
    onClick: () => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({ label, count, isSelected, emphasized, dot, onClick }) => {
    const Icon = isSelected ? FolderOpen : Folder;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={isSelected ? 'true' : undefined}
            className={`relative w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                isSelected
                    ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-[#8A8A8E] hover:bg-slate-50 dark:hover:bg-white/[0.03]'
            }`}
        >
            {isSelected && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#4a72c4]" />
            )}
            {dot ? (
                <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-0.5" style={{ backgroundColor: dot }} />
            ) : (
                <Icon
                    size={14}
                    className={isSelected ? 'text-slate-700 dark:text-slate-200 shrink-0' : 'text-slate-400 dark:text-[#8A8A8E] shrink-0'}
                />
            )}
            <span className={`flex-1 truncate text-[13px] ${emphasized || isSelected ? 'font-medium' : 'font-normal'}`}>
                {label}
            </span>
            <span
                className={`text-[11px] tabular-nums min-w-[20px] text-right ${
                    isSelected
                        ? 'text-slate-500 dark:text-[#8A8A8E]'
                        : 'text-slate-400 dark:text-[#8A8A8E]'
                }`}
            >
                {count}
            </span>
        </button>
    );
};

export default ClientsFolderTree;
