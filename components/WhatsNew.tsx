import React, { useState, useEffect } from 'react';
import { Bot, ArrowRight, Gift, Hammer, BookOpen, Palette, Wand2, Target, Shield, Award } from 'lucide-react';
import { Modal } from './Shared';

const CURRENT_VERSION = "2.6.0";

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
                            Marion 2030 — Atelier Edition
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Mise à jour v{CURRENT_VERSION} • De WordPress à Cursor en 12 outils
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* Atelier Refonte WP */}
                        <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/10 dark:to-pink-900/10 border border-fuchsia-200/50 dark:border-fuchsia-800/30">
                            <div className="w-12 h-12 rounded-full bg-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                <Hammer size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Atelier Refonte WP</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Glisse les screenshots des sections de tes anciens sites WordPress, l'IA produit le <strong>plan de refonte complet</strong> : design tokens, prompts Cursor par section, tâches Kanban à importer.
                                </p>
                            </div>
                        </div>

                        {/* Recettes WP */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Recettes WordPress → React</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    12 patterns prêts à coller : ACF, Contact Form 7, WooCommerce, Yoast, Elementor, Custom Post Types… Chaque recette inclut le snippet et le prompt Cursor associé.
                                </p>
                            </div>
                        </div>

                        {/* Catalog */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                                <Palette size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Catalog Marion (composants)</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Sauve tes snippets favoris (Hero, Pricing, Footer…) avec <strong>preview iframe live, dark mode et mobile</strong>. Export/import en JSON pour synchroniser entre devices.
                                </p>
                            </div>
                        </div>

                        {/* Stack Picker + Code Review */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                                <Wand2 size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Stack Picker + Code Review Claude</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    3 questions, l'IA te dit la <strong>meilleure stack</strong> (commande de scaffold incluse). Et dans Franck, demande à <strong>Claude Opus 4.7</strong> de reviewer ton code (a11y, DRY, perf).
                                </p>
                            </div>
                        </div>

                        {/* Skills + Daily Lesson */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Skills radar + Leçon du jour</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Auto-évalue-toi sur 8 axes (Tailwind, Cursor, A11y…), reçois ta <strong>leçon quotidienne de 5 min</strong> avec un challenge Cursor. Streak + badges 3/7/30 jours.
                                </p>
                            </div>
                        </div>

                        {/* Audit Prospect WP */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Audit Prospect + Pre-deploy Checklist</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Colle l'URL d'un prospect WP, l'app sort un rapport <strong>Lighthouse + plugins + coût annuel + argumentaire de vente</strong>. Avant la prod, vérifie ta preview en 1 clic.
                                </p>
                            </div>
                        </div>

                        {/* Glossaire WP + Franck */}
                        <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Franck connaît WordPress</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Tape <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">/wp acf</code> dans Franck, il te donne l'équivalent moderne avec exemple. Glossaire intégré, cache localStorage.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col items-center gap-2">
                        <button 
                            onClick={handleClose}
                            className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-xl"
                        >
                            <Award size={18} /> En route vers 2030 ! <ArrowRight size={18} />
                        </button>
                        <p className="text-[11px] text-slate-400">Ouvre le menu Atelier dans le header pour explorer toutes ces nouveautés.</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
