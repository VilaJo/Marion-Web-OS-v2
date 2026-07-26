import React, { useState, useEffect } from 'react';
import { Gift, Palette, Type, Moon, LayoutGrid } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.14";

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
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#b05070]/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="p-8 pt-2">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-16 h-16 bg-[#252525] border border-[#2a2a2a] rounded-2xl flex items-center justify-center text-[#b05070] mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-medium tracking-tight text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#b2b2b2]">
                            Thème Professionnel — style Stability
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-[#252525] border border-[#2a2a2a]">
                            <div className="w-12 h-12 rounded-md bg-[#1e1e1e] border border-[#2a2a2a] text-[#b05070] flex items-center justify-center flex-shrink-0">
                                <Palette size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Studio charcoal</h3>
                                <p className="text-sm text-[#b2b2b2] leading-relaxed">
                                    Le thème Professionnel passe en fond `#1e1e1e`, surfaces plates, une seule couleur d’action (rose).
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-[#252525] border border-[#2a2a2a]">
                            <div className="w-12 h-12 rounded-md bg-[#1e1e1e] border border-[#2a2a2a] text-white flex items-center justify-center flex-shrink-0">
                                <Type size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Typo Archivo</h3>
                                <p className="text-sm text-[#b2b2b2] leading-relaxed">
                                    Titres légers façon Stability — moins de gras marketing, plus de calme éditorial.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-[#252525] border border-[#2a2a2a]">
                            <div className="w-12 h-12 rounded-md bg-[#1e1e1e] border border-[#2a2a2a] text-[#8A8A8E] flex items-center justify-center flex-shrink-0">
                                <Moon size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Nuit intacte</h3>
                                <p className="text-sm text-[#b2b2b2] leading-relaxed">
                                    Le thème Nuit (`#0d1329`) n’a pas été modifié. Switch Settings → Nuit pour y revenir.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-[#252525] border border-[#2a2a2a] opacity-80">
                            <div className="w-12 h-12 rounded-md bg-[#1e1e1e] border border-[#2a2a2a] text-white flex items-center justify-center flex-shrink-0">
                                <LayoutGrid size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Kanban coloré</h3>
                                <p className="text-sm text-[#b2b2b2] leading-relaxed">
                                    Les couleurs d’étapes (gris / bleu / teal / rose) restent pour le statut des tâches.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-[#b05070] text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                        >
                            Découvrir
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
