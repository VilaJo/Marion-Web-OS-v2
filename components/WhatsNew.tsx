import React, { useState, useEffect } from 'react';
import { Bot, ArrowRight, Gift, ShieldCheck, Award, CalendarClock, EyeOff } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.9.1";

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
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="p-8 pt-2">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-fuchsia-200 dark:shadow-none mb-6 rotate-3">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-bold text-slate-800 dark:text-white mb-2">
                            Eonora Tech OS — v{CURRENT_VERSION}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Fiabilité : Agenda plus clair, fonctions démo retirées
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-orange-50 dark:from-violet-900/10 dark:to-orange-900/10 border border-violet-200/50 dark:border-violet-800/30">
                            <div className="w-12 h-12 rounded-full bg-violet-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <CalendarClock size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Agenda : reconnexion plus claire</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Le bandeau de déconnexion Google Calendar est plus explicite et le bouton « Reconnecter » relance directement la connexion. Si Infomaniak est déjà configuré, tes événements y restent visibles.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/10 dark:to-pink-900/10 border border-fuchsia-200/50 dark:border-fuchsia-800/30">
                            <div className="w-12 h-12 rounded-full bg-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <EyeOff size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Messagerie & Dropbox retirés</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Ces deux fonctions n'étaient pas réellement connectées (démo locale) — elles sont retirées pour éviter toute confusion. Google Drive reste disponible pour la sauvegarde cloud.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 border border-blue-200/50 dark:border-blue-800/30">
                            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Portail client partageable</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Double-clic sur <strong>LANCER_PORTAIL_PUBLIC.command</strong> pour activer un vrai lien HTTPS à envoyer à ton client — plus besoin d’être sur le même réseau que lui.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
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
