import React, { useState, useEffect } from 'react';
import { Bot, ArrowRight, Gift, ShieldCheck, Award, Sparkles } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.10.2";

export const WhatsNew: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem('marion_crm_version');
        
        // If version changed or never set, show modal
        if (lastSeenVersion !== CURRENT_VERSION) {
            // Small delay for effect after app load
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
                {/* Decorative Background — dégradé signature Eonora */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-eonora-gradient opacity-15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="p-8 pt-2">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-16 h-16 bg-eonora-gradient rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200 dark:shadow-none mb-6">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-bold text-slate-800 dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Unification de la palette Eonora — fin des incohérences
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#f6e7ec] via-[#e7edf8] to-[#e2f2f0] dark:from-[#b05070]/10 dark:via-[#4a72c4]/10 dark:to-[#2aada0]/10 border border-slate-200/60 dark:border-slate-700/40">
                            <div className="w-12 h-12 rounded-full bg-eonora-gradient text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Palette Eonora unifiée</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Fini les violets, indigos et orangés parasites : toute l'app (accueil, header, Franck, e-mails, prospection, réglages, portail client…) parle désormais la même langue — crème, sage et le dégradé signature rose → bleu → teal (120°).
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-800/20 border border-slate-200/60 dark:border-slate-700/40">
                            <div className="w-12 h-12 rounded-full bg-[#23262B] text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Mode sombre charcoal</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Le mode sombre passe à un charbon profond avec cartes contrastées et accents sage — plus sobre, plus lisible, plus « techno ».
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#F2F5F0] to-[#E3EBDF] dark:from-emerald-900/10 dark:to-emerald-900/5 border border-slate-200/60 dark:border-slate-700/40">
                            <div className="w-12 h-12 rounded-full bg-sage text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <Award size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Mêmes outils, tout est à sa place</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Aucune fonctionnalité n'a bougé — seuls les couleurs, boutons et cartes changent. Tes clients, factures et agenda restent exactement où tu les connais.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-[#2aada0]/15 dark:bg-[#2aada0]/25 text-eo-teal dark:text-eo-teal flex items-center justify-center flex-shrink-0">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Aide Marion</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Fiche <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">LIRE_EN_PREMIER_MARION.md</code> à la racine du projet.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col items-center gap-2">
                        <button 
                            onClick={handleClose}
                            className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-xl"
                        >
                            <Award size={18} /> C’est noté <ArrowRight size={18} />
                        </button>
                        <p className="text-[11px] text-slate-400">En cas de souci : capture + .marion.log à Johan (jamais le .env).</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
