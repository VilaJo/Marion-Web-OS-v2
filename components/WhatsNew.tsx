import React, { useState, useEffect } from 'react';
import { Gift, Palette } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.25";

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
                        <div className="w-16 h-16 bg-[#FFD0E6] border border-[#F0D8CC] rounded-3xl flex items-center justify-center text-[#B05070] mb-6 shadow-[0_10px_24px_rgba(176,80,112,0.18)]">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-extrabold tracking-tight text-[#2A1840] dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#8A6E7A] dark:text-slate-400">
                            Thème clair tout en couleurs — plus de fond blanc
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-[#FFD0E6]/60 dark:bg-slate-800 border border-[#F0D8CC] dark:border-slate-700">
                            <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-slate-900 border border-[#F0D8CC] dark:border-slate-600 text-[#B05070] flex items-center justify-center flex-shrink-0 shadow-sm">
                                <Palette size={24} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-[#2A1840] dark:text-white mb-1">Clair joyeux</h3>
                                <p className="text-sm text-[#8A6E7A] dark:text-slate-400 leading-relaxed">
                                    Dégradé rose / pêche / mint / bleu sur toute l’app. Les cartes sont translucides, le tableau est teinté, le header aussi. Nuit inchangé.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-eonora-gradient text-white rounded-full font-bold hover:opacity-90 transition-opacity shadow-[0_10px_22px_rgba(176,80,112,0.28)]"
                        >
                            C’est parti
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
