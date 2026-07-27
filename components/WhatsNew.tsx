import React, { useState, useEffect } from 'react';
import { Gift, Moon, LayoutGrid } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.17";

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
                        <div className="w-16 h-16 bg-[#161616] border border-[#242424] rounded-2xl flex items-center justify-center text-[#e8e8e8] mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-medium tracking-tight text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#a8a8ae]">
                            Thème Professionnel vraiment sombre
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-[#161616] border border-[#242424]">
                            <div className="w-12 h-12 rounded-md bg-[#0f0f10] border border-[#242424] text-white flex items-center justify-center flex-shrink-0">
                                <Moon size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Noir profond</h3>
                                <p className="text-sm text-[#a8a8ae] leading-relaxed">
                                    Fond `#0f0f10`, panneaux `#161616`, kanban encore plus sombre — fini le gris moyen.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-[#161616] border border-[#242424]">
                            <div className="w-12 h-12 rounded-md bg-[#0f0f10] border border-[#242424] text-[#4a72c4] flex items-center justify-center flex-shrink-0">
                                <LayoutGrid size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-white mb-1">Kanban net</h3>
                                <p className="text-sm text-[#a8a8ae] leading-relaxed">
                                    Colonnes quasi noires, cartes `#1a1a1a`, texte clair — plus confortable à lire.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-[#b05070] text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
