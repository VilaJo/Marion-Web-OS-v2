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

export const ClientsFolderTree: React.FC<ClientsFolderTreeProps> = ({ projects, selected, onSelect }) => {
    const countFor = (status: ProjectStatus | 'Tous'): number => {
        if (status === 'Tous') return projects.length;
        return projects.filter(p => p.status === status).length;
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
                {FOLDER_ORDER.map(status => (
                    <FolderChip
                        key={status}
                        label={status}
                        count={countFor(status)}
                        isSelected={selected === status}
                        emphasized={status === ProjectStatus.EN_COURS}
                        onClick={() => onSelect(status)}
                    />
                ))}
            </nav>

            {/* Desktop: vertical folder tree */}
            <nav
                aria-label="Dossiers clients"
                className="hidden md:block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-2"
            >
                <p className="px-2.5 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Dossiers
                </p>
                <FolderNode
                    label="Tous"
                    count={countFor('Tous')}
                    isSelected={selected === 'Tous'}
                    onClick={() => onSelect('Tous')}
                />

                <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                <ul className="space-y-0.5">
                    {FOLDER_ORDER.map(status => (
                        <li key={status}>
                            <FolderNode
                                label={status}
                                count={countFor(status)}
                                isSelected={selected === status}
                                emphasized={status === ProjectStatus.EN_COURS}
                                onClick={() => onSelect(status)}
                            />
                        </li>
                    ))}
                </ul>
            </nav>
        </>
    );
};

interface FolderChipProps {
    label: string;
    count: number;
    isSelected: boolean;
    emphasized?: boolean;
    onClick: () => void;
}

const FolderChip: React.FC<FolderChipProps> = ({ label, count, isSelected, emphasized, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={isSelected ? 'true' : undefined}
        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors border ${
            emphasized ? 'font-semibold' : 'font-medium'
        } ${
            isSelected
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        }`}
    >
        {label}
        <span className={`text-[10px] tabular-nums ${isSelected ? 'opacity-70' : 'text-slate-400'}`}>
            {count}
        </span>
    </button>
);

interface FolderNodeProps {
    label: string;
    count: number;
    isSelected: boolean;
    emphasized?: boolean;
    onClick: () => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({ label, count, isSelected, emphasized, onClick }) => {
    const Icon = isSelected ? FolderOpen : Folder;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={isSelected ? 'true' : undefined}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
        >
            <Icon
                size={14}
                className={isSelected ? 'text-slate-700 dark:text-slate-200 flex-shrink-0' : 'text-slate-400 flex-shrink-0'}
            />
            <span className={`flex-1 truncate text-[13px] ${emphasized || isSelected ? 'font-medium' : 'font-normal'}`}>
                {label}
            </span>
            <span
                className={`text-[10px] tabular-nums font-medium min-w-[20px] text-right ${
                    isSelected
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-slate-400'
                }`}
            >
                {count}
            </span>
        </button>
    );
};

export default ClientsFolderTree;
