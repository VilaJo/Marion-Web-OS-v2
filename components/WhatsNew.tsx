import React, { useState, useEffect } from 'react';
import { Gift, Image } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.20";

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
                        <div className="w-16 h-16 bg-[#F4F5F7] border border-[#E4E6EA] rounded-2xl flex items-center justify-center text-[#b05070] mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-medium tracking-tight text-[#0F1014] dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#6B6F78] dark:text-slate-400">
                            Logo sans coins (cache vidé)
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-[#F4F5F7] dark:bg-slate-800 border border-[#E4E6EA] dark:border-slate-700">
                            <div className="w-12 h-12 rounded-md bg-white dark:bg-slate-900 border border-[#E4E6EA] dark:border-slate-600 text-[#b05070] flex items-center justify-center flex-shrink-0">
                                <Image size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-[#0F1014] dark:text-white mb-1">Marque circulaire</h3>
                                <p className="text-sm text-[#6B6F78] dark:text-slate-400 leading-relaxed">
                                    Nouveau fichier logo (fond vraiment transparent) + service worker rafraîchi pour ne plus garder l’ancien carré aux coins noirs.
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
