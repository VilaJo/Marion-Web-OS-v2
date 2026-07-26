import React, { useState, useEffect } from 'react';
import { Gift, LayoutGrid, Eye, FolderOpen } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.16";

export const WhatsNew: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem('marion_crm_version');
        if (lastSeenVersion !== CURRENT_VERSION) {
            setTimeout(() => setIsOpen(true), 1500);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('marion_crm_version', CURRENT_VERSION);
        setIsOpen(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="" width="max-w-2xl">
            <div className="relative overflow-hidden">
                <div className="p-8 pt-2">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-16 h-16 bg-[#2c2c2c] border border-[#3a3a3a] rounded-2xl flex items-center justify-center text-[#4a72c4] mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-medium tracking-tight text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#c4c4c4]">
                            Kanban plus clair et lisible
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-[#2c2c2c] border border-[#3a3a3a]">
                            <div className="w-12 h-12 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-[#e5e7e6] flex items-center justify-center flex-shrink-0">
                                <Eye size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Contraste corrigé</h3>
                                <p className="text-sm text-[#c4c4c4] leading-relaxed">
                                    Titres blancs, dates et méta en gris clair — plus de « Pas de date » illisible.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-[#2c2c2c] border border-[#3a3a3a]">
                            <div className="w-12 h-12 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-[#4a72c4] flex items-center justify-center flex-shrink-0">
                                <LayoutGrid size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Accent par colonne</h3>
                                <p className="text-sm text-[#c4c4c4] leading-relaxed">
                                    Chaque carte porte la couleur de sa colonne (gris / bleu / teal). Priorités en français, plus sobres.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-[#2c2c2c] border border-[#3a3a3a] opacity-80">
                            <div className="w-12 h-12 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-[#2aada0] flex items-center justify-center flex-shrink-0">
                                <FolderOpen size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Dashboard dossiers</h3>
                                <p className="text-sm text-[#c4c4c4] leading-relaxed">
                                    Les fiches clients restent colorées selon En cours / Maintenance / etc.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-[#4a72c4] text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
