/**
 * ClientsFolderTree — arborescence de dossiers clients (vue "explorateur")
 *
 * Colonne de gauche de la page Clients : "Tous" + un noeud par statut,
 * avec badge de comptage. Remplace les anciennes pastilles de filtre.
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
            <nav aria-label="Dossiers clients" className="flex md:hidden items-center gap-2 overflow-x-auto no-scrollbar pb-1">
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
                className="hidden md:block w-full bg-[#FAF7F2] dark:bg-[#23262B] rounded-2xl border border-[#e7e0d4] dark:border-slate-700/50 p-2 md:p-3"
            >
                <FolderNode
                    label="Tous"
                    count={countFor('Tous')}
                    isSelected={selected === 'Tous'}
                    onClick={() => onSelect('Tous')}
                />

                <div className="my-2 border-t border-[#e7e0d4] dark:border-slate-700/50" />

                <ul className="space-y-1">
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
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
            emphasized ? 'font-bold' : 'font-medium'
        } ${
            isSelected
                ? 'bg-[#7C9A7E] text-white shadow-sm'
                : 'bg-[#FAF7F2] dark:bg-slate-800/60 text-slate-500 dark:text-slate-300 border border-[#e7e0d4] dark:border-slate-700/50'
        }`}
    >
        {label}
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/25' : 'bg-slate-200/70 dark:bg-slate-700/70'}`}>
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
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors border-l-[3px] ${
                isSelected
                    ? 'bg-[#7C9A7E]/12 dark:bg-[#7C9A7E]/20 border-l-[#7C9A7E] text-[#23262B] dark:text-white'
                    : 'border-l-transparent text-slate-600 dark:text-slate-300 hover:bg-[#7C9A7E]/8 dark:hover:bg-slate-800/60'
            }`}
        >
            <Icon
                size={16}
                className={isSelected ? 'text-[#7C9A7E] dark:text-[#A7C1A3] flex-shrink-0' : 'text-slate-400 flex-shrink-0'}
            />
            <span className={`flex-1 truncate text-sm ${emphasized ? 'font-bold' : 'font-medium'}`}>
                {label}
            </span>
            <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[24px] text-center ${
                    isSelected
                        ? 'bg-[#7C9A7E] text-white'
                        : 'bg-slate-100 dark:bg-slate-700/70 text-slate-500 dark:text-slate-300'
                }`}
            >
                {count}
            </span>
        </button>
    );
};

export default ClientsFolderTree;
