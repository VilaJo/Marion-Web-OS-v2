import React, { useState, useEffect } from 'react';
import { Bot, ArrowRight, Gift, Code2, Newspaper, Telescope, Image as ImageIcon, Search, FileText } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.5.0";

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
                            Mise à jour v{CURRENT_VERSION} • Marion 2030 Edition
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Marion 2030 — Cursor / Claude */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                                <Code2 size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Bibliothèque de Prompts Cursor</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Stocke, organise et améliore tes meilleurs prompts <strong>Cursor / Claude</strong>. Catégories par mission (SaaS, e-commerce, portfolio…). Franck peut même les améliorer pour toi.
                                </p>
                            </div>
                        </div>

                        {/* Veille marché */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                                <Newspaper size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Veille marché hebdomadaire</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Chaque semaine, Gemini te génère un brief des <strong>tendances UI/UX, technos et IA</strong> — pour rester toujours en avance sur ta concurrence.
                                </p>
                            </div>
                        </div>

                        {/* Concurrents + Pricing */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                                <Search size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Analyse concurrentielle + Pricing IA</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Compare les sites de tes concurrents pour identifier comment les battre, et obtiens une <strong>fourchette de prix IA</strong> alignée sur le marché — directement dans la fiche client.
                                </p>
                            </div>
                        </div>

                        {/* Rapport + Case Study */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Rapports IA + Case Study auto</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Génère un <strong>rapport hebdomadaire</strong> pour suivre l'avancement projet, et en fin de mission un <strong>case study + post LinkedIn</strong> pour ton portfolio en un clic.
                                </p>
                            </div>
                        </div>

                        {/* Image generation */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center flex-shrink-0">
                                <ImageIcon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Génération d'images dans MediaStudio</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Crée des <strong>visuels, mockups et moodboards</strong> directement dans Marion Web OS via Imagen — fini Midjourney en parallèle !
                                </p>
                            </div>
                        </div>

                        {/* Prospection */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
                                <Telescope size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Prospection Apollo + Gemini</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Trouve des clients à l'international avec <strong>Apollo.io</strong> (puis bascule sur Gemini si crédits épuisés). Templates d'outreach, import vers Kanban, et bien plus.
                                </p>
                            </div>
                        </div>

                        {/* Franck Code Mode */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Franck → Lead dev virtuel + Claude</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Active le <strong>Code Mode</strong> dans Franck pour faire des reviews, générer du Tailwind/React et déboguer. Plus l'arrivée de <strong>Claude</strong> comme 3ème provider IA dans Settings.
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
