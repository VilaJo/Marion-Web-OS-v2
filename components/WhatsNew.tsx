import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, Bug, X, ArrowRight, Gift } from 'lucide-react';
import { Modal } from './Shared';

// UPDATE THIS VERSION TO TRIGGER THE MODAL FOR USERS
const CURRENT_VERSION = "1.2.0";

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
                            Mise à jour v{CURRENT_VERSION} • Décembre 2025
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Feature 1 */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                                <Wand2 size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Atelier Média Pro</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Un nouvel outil puissant pour vos images. Créez des <strong>Logos Transparents</strong> (détourage auto), des posts Instagram parfaits, ou optimisez vos images pour le Web en un clic.
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center flex-shrink-0">
                                <Bug size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Signalement de Bugs</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Un petit bouton 🐞 est apparu en bas à gauche. Si quelque chose ne va pas, dites-le moi directement via ce bouton.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center flex-shrink-0">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Plus rapide & plus beau</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    L'interface de l'Atelier Média a été repensée pour être plus claire, et le "Cerveau" (Backend) est maintenant propulsé par Pillow pour une qualité d'image maximale.
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
