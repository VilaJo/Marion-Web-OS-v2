import React, { useState, useEffect } from 'react';
import { Gift, Palette } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.26";

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
                        <div className="w-16 h-16 bg-[#FFE0EF] border-[3px] border-[#2A1840] rounded-3xl flex items-center justify-center text-[#FF6B9D] mb-6 shadow-[5px_5px_0_#5EEAD4]">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2A1840] dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#C45B86] dark:text-slate-400">
                            Clair moins corporate — stickers, couleurs, Fredoka
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-[#FFE0EF] dark:bg-slate-800 border-[3px] border-[#2A1840] dark:border-slate-700 shadow-[4px_4px_0_#FFB347] dark:shadow-none">
                            <div className="w-12 h-12 rounded-2xl bg-[#FFF8F2] dark:bg-slate-900 border-[3px] border-[#2A1840] dark:border-slate-600 text-[#FF6B9D] flex items-center justify-center flex-shrink-0">
                                <Palette size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-[#2A1840] dark:text-white mb-1">Plus pop, moins bureau</h3>
                                <p className="text-sm text-[#C45B86] dark:text-slate-400 leading-relaxed">
                                    Typo Fredoka, cartes sticker rose / mint / bleu / soleil, plus de titres en CAPITALES grises. Nuit inchangé.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-[#FF6B9D] text-white rounded-full font-bold border-[3px] border-[#2A1840] shadow-[4px_4px_0_#2A1840] hover:-translate-y-0.5 transition-transform"
                        >
                            Youhou
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
