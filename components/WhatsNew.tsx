import React, { useState, useEffect } from 'react';
import { Gift, Palette } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.23";

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
                        <div className="w-16 h-16 bg-[#F8F7F4] border border-[#E0DFDB] rounded-xl flex items-center justify-center text-[#B05070] mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-medium tracking-tight text-[#03031C] dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#67676C] dark:text-slate-400">
                            Thème clair Modulate — plus vivant
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-xl bg-[#F8F7F4] dark:bg-slate-800 border border-[#E0DFDB] dark:border-slate-700">
                            <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-900 border border-[#E0DFDB] dark:border-slate-600 text-[#B05070] flex items-center justify-center flex-shrink-0">
                                <Palette size={24} />
                            </div>
                            <div>
                                <h3 className="font-medium text-[#03031C] dark:text-white mb-1">Charte Modulate</h3>
                                <p className="text-sm text-[#67676C] dark:text-slate-400 leading-relaxed">
                                    Papier crème, Inter + Roboto, gradient rose→bleu→teal en détail. Le thème clair est plus chaleureux — Nuit inchangé.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-eonora-gradient text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                        >
                            Découvrir
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
