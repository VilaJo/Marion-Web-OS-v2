import React, { useState, useEffect } from 'react';
import { Gift, CalendarDays, ListTodo, Wrench } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.13.22";

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
                        <div className="w-16 h-16 bg-[#F4F5F7] border border-[#E4E6EA] rounded-2xl flex items-center justify-center text-[#4a72c4] mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-medium tracking-tight text-[#0F1014] dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-[#6B6F78] dark:text-slate-400">
                            Maintenance, agenda & to-do du jour
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex gap-3 p-3 rounded-xl bg-[#F4F5F7] dark:bg-slate-800 border border-[#E4E6EA] dark:border-slate-700">
                            <Wrench className="text-[#4a72c4] shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-[#6B6F78] dark:text-slate-400 text-left">
                                <span className="font-medium text-[#0F1014] dark:text-white">Fiche maintenance</span> — actif/inactif, offert jusqu’au <em>ou</em> facturation le, coût. Ça se calque dans le calendrier.
                            </p>
                        </div>
                        <div className="flex gap-3 p-3 rounded-xl bg-[#F4F5F7] dark:bg-slate-800 border border-[#E4E6EA] dark:border-slate-700">
                            <CalendarDays className="text-[#E67C73] shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-[#6B6F78] dark:text-slate-400 text-left">
                                <span className="font-medium text-[#0F1014] dark:text-white">Agenda</span> — bouton <strong>Maintenances</strong> pour voir où tu en es sur toutes les maintenances.
                            </p>
                        </div>
                        <div className="flex gap-3 p-3 rounded-xl bg-[#F4F5F7] dark:bg-slate-800 border border-[#E4E6EA] dark:border-slate-700">
                            <ListTodo className="text-[#039BE5] shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-[#6B6F78] dark:text-slate-400 text-left">
                                <span className="font-medium text-[#0F1014] dark:text-white">To-do</span> — le calendrier du jour arrive déjà rangé : Rendez-vous, Client, Deadlines, Facturation, Perso.
                            </p>
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
