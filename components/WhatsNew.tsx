import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, Smartphone, Layout, ArrowRight, Gift, CheckCircle } from 'lucide-react';
import { Modal } from './Shared';

// UPDATE THIS VERSION TO TRIGGER THE MODAL FOR USERS
const CURRENT_VERSION = "2.4.7";

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
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-brand-orange/20 to-purple-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="p-8 pt-2">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-brand-orange to-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200 dark:shadow-none mb-6 rotate-3">
                            <Gift size={32} />
                        </div>
                        <h2 className="font-serif text-3xl font-bold text-slate-800 dark:text-white mb-2">
                            Quoi de neuf, Marion ?
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Mise à jour v{CURRENT_VERSION} • Février 2026
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Feature 1 - Franck amélioré */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Franck voit tout 👀</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Franck a maintenant accès à <strong>toutes vos tâches et événements</strong>. Demandez-lui "Quelles sont mes tâches prioritaires ?" ou "Comment se présente ma journée ?" - il sait tout !
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 - Statut Franck cliquable */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center flex-shrink-0">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Statut Franck interactif</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Le badge "Franck en ligne" dans l'en-tête est maintenant <strong>cliquable</strong>. Cliquez dessus pour parler à Franck ou le reconnecter s'il est hors ligne.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3 - Interface améliorée */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center flex-shrink-0">
                                <Layout size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Interface plus compacte</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    La barre de recherche et les filtres sont maintenant <strong>sur une seule ligne</strong> pour une meilleure utilisation de l'espace.
                                </p>
                            </div>
                        </div>

                        {/* Feature 4 - PWA amélioré */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-500 flex items-center justify-center flex-shrink-0">
                                <Smartphone size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">App mobile améliorée</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Le popup d'installation peut maintenant être <strong>masqué définitivement</strong> si vous ne souhaitez pas installer l'application sur votre téléphone.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button 
                            onClick={handleClose}
                            className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-xl"
                        >
                            C'est parti ! <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
