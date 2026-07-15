/**
 * GlobalOverlays - All application-level modal overlays
 *
 * Extracted from App.tsx for maintainability.
 * Contains: FranckChat, FileDispatcher, Notes, MediaStudio, Guide, drag overlay,
 *           floating chat button, scroll-to-top, PWA prompt, BugReporter, WhatsNew.
 */

import React, { Suspense, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore, useProjectStore, useNotificationStore } from '../stores';
import { Modal } from './Shared';
import { QuickNotes } from './QuickNotes';
import { Project, CalendarEvent } from '../types';
import { useGoogleCalendarEvents } from '../services/queries';

import {
    Bot, Sparkles, Heart,
    MessageCircle, Wand2,
    ArrowUp, UploadCloud,
    Layers, Calendar, CheckSquare, FolderOpen,
    LifeBuoy, Mail, RefreshCw, Power,
} from 'lucide-react';

declare const confetti: any;

// Lazy loaded overlays
const FranckChat = React.lazy(() => import('./FranckChat').then(m => ({ default: m.FranckChat })));
const FileDispatcher = React.lazy(() => import('./FileDispatcher').then(m => ({ default: m.FileDispatcher })));
const MediaStudio = React.lazy(() => import('./media/MediaStudio').then(m => ({ default: m.MediaStudio })));
const PWAInstallPrompt = React.lazy(() => import('./PWAInstallPrompt').then(m => ({ default: m.PWAInstallPrompt })));
const BugReporter = React.lazy(() => import('./BugReporter').then(m => ({ default: m.BugReporter })));
const WhatsNew = React.lazy(() => import('./WhatsNew').then(m => ({ default: m.WhatsNew })));

interface GlobalOverlaysProps {
    projects: Project[];
    events: CalendarEvent[];
}

export const GlobalOverlays: React.FC<GlobalOverlaysProps> = ({ projects, events }) => {
    const {
        showChat, setShowChat,
        showNotes, setShowNotes,
        showFileDispatcher, setShowFileDispatcher,
        showMediaWorkshop, setShowMediaWorkshop,
        showGuide, setShowGuide,
        showScrollTop,
        isDraggingOver, setIsDraggingOver,
        droppedFiles, setDroppedFiles,
    } = useUIStore();

    const { addNotification } = useNotificationStore();
    const queryClient = useQueryClient();

    const { data: gcalEvents = [] } = useGoogleCalendarEvents();

    const mergedEvents = useMemo(() => {
        const localIds = new Set(events.filter(e => e.googleEventId).map(e => e.googleEventId));
        const uniqueGcal = gcalEvents.filter(e => !localIds.has(e.id) && !localIds.has(e.googleEventId));
        return [...events, ...uniqueGcal];
    }, [events, gcalEvents]);

    return (
        <>
            {/* Franck Chat */}
            <Suspense fallback={null}>
                <FranckChat
                    isOpen={showChat}
                    onClose={() => setShowChat(false)}
                    projects={projects}
                    events={mergedEvents}
                    queryClient={queryClient}
                    onAddEvent={(event) => {
                        useProjectStore.getState().addEvent(event);
                        addNotification('Événement ajouté', `Franck a ajouté "${event.title}" à ton agenda`, 'success');
                    }}
                />
            </Suspense>

            {/* File Dispatcher */}
            {showFileDispatcher && droppedFiles.length > 0 && (
                <Suspense fallback={null}>
                    <FileDispatcher
                        files={droppedFiles}
                        onClose={() => { setShowFileDispatcher(false); setDroppedFiles([]); }}
                        onSuccess={() => {
                            setShowFileDispatcher(false); setDroppedFiles([]);
                            addNotification('Classement Terminé', "Franck a rangé les fichiers avec succès !", 'ai');
                            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
                        }}
                        existingClients={projects.map(p => p.clientName)}
                    />
                </Suspense>
            )}

            {/* Notes Modal */}
            {showNotes && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNotes(false)}>
                    <div className="bg-white dark:bg-slate-900/95 dark:border dark:border-slate-700/50 rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="font-serif text-2xl text-slate-800 dark:text-white">Notes Rapides</h2>
                            <button onClick={() => setShowNotes(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <span className="text-2xl text-slate-400">×</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6"><QuickNotes /></div>
                    </div>
                </div>
            )}

            {/* Drag & Drop Visual — click to dismiss if stuck */}
            {isDraggingOver && (
                <div
                    className="fixed inset-0 z-[100] cursor-pointer"
                    onClick={() => { setIsDraggingOver(false); }}
                    onDoubleClick={() => { setIsDraggingOver(false); }}
                >
                    <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-sm animate-pulse pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-12 shadow-2xl border-4 border-emerald-500 border-dashed">
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center animate-bounce">
                                    <UploadCloud size={48} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="text-center">
                                    <p className="font-serif text-3xl text-emerald-600 dark:text-emerald-400 mb-2">Déposez vos fichiers</p>
                                    <p className="text-slate-600 dark:text-slate-400">Franck va les organiser intelligemment</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Chat Button */}
            {!showChat && (
                <button
                    id="chat-btn"
                    onClick={() => setShowChat(true)}
                    className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-full shadow-[0_4px_20px_rgba(255,126,95,0.4)] flex items-center justify-center hover:scale-110 hover:rotate-3 transition-all duration-300 group border-2 border-white dark:border-slate-800"
                    title="Parler à Franck"
                >
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-0 group-hover:opacity-50"></div>
                    <MessageCircle size={28} className="fill-white/20" />
                </button>
            )}

            {/* Scroll to top */}
            {showScrollTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-8 right-28 z-40 w-11 h-11 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600/50 shadow-lg flex items-center justify-center text-slate-500 hover:text-brand-orange transition-all"
                >
                    <ArrowUp size={18} />
                </button>
            )}

            {/* Media Studio */}
            {showMediaWorkshop && (
                <Suspense fallback={null}>
                    <MediaStudio onClose={() => setShowMediaWorkshop(false)} />
                </Suspense>
            )}

            {/* Guide Modal */}
            <Modal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Guide Eonora Tech OS" width="max-w-6xl">
                <div className="p-4">
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-2xl font-sans">
                        Découvrez comment cet outil a été conçu pour libérer votre créativité en automatisant le chaos.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {[
                            { icon: Layers, title: "Tableau de Bord & Yacht Bar", desc: "Suivez votre activité et votre CA avec la Yacht Bar." },
                            { icon: Calendar, title: "Agenda Intelligent", desc: "Un planning repensé avec événements côte à côte." },
                            { icon: CheckSquare, title: "Projets & Kanban Avancé", desc: "Drag & Drop, statuts et priorités fluides." },
                            { icon: Bot, title: "Franck & Réunion IA", desc: "Franck est votre second cerveau pour vos projets." },
                            { icon: Wand2, title: "Atelier Média V2", desc: "Détourez, optimisez et exportez en SVG." },
                            { icon: FolderOpen, title: "Système de Fichiers", desc: "Accès direct et organisation intelligente de vos dossiers." }
                        ].map((f, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[32px] hover:shadow-lg transition-all hover:scale-[1.02] border border-slate-100 dark:border-slate-700/50">
                                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-slate-700 text-brand-orange flex items-center justify-center mb-6"><f.icon size={24} /></div>
                                <h3 className="font-serif text-xl font-bold mb-3 text-slate-800 dark:text-white">{f.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mb-12 rounded-[32px] border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-slate-800 text-amber-600 flex items-center justify-center"><LifeBuoy size={24} /></div>
                            <h3 className="font-serif text-2xl font-bold text-slate-800 dark:text-white">En cas de souci</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-amber-100 dark:border-amber-900/30">
                                <Bot size={20} className="text-brand-orange shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">Franck ne répond pas / bulle rouge</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Vérifie ta clé Gemini dans Paramètres → IA. Si l'app entière est bloquée, c'est le serveur qui est éteint (voir « Marion ne se connecte pas » ci-dessous).
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-amber-100 dark:border-amber-900/30">
                                <Mail size={20} className="text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">Emails : icône grise / erreur</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Le point gris sur l'icône ✉️ veut dire que la boîte mail n'est pas connectée. Va sur la page Emails et reconnecte-toi avec ton adresse Infomaniak.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-amber-100 dark:border-amber-900/30">
                                <Power size={20} className="text-slate-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">Marion ne se connecte pas</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Lance <strong>LANCER_MARION.command</strong> (ou double-clique « Eonora Tech OS »). Pour tout arrêter proprement : <strong>STOPPER_MARION.command</strong>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-amber-100 dark:border-amber-900/30">
                                <RefreshCw size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">Écran blanc après une mise à jour</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Fais <strong>Cmd + Shift + R</strong> dans le navigateur. Toujours blanc ? Lance <strong>REPARER_INTERFACE.command</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 text-center">
                            Rien n'y fait ? Envoie à Johan une capture d'écran + le fichier <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">.marion.log</code> (jamais le <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">.env</code>).
                        </p>
                    </div>

                    <div className="bg-pink-50/50 dark:bg-slate-800/30 rounded-[40px] p-10 text-center border border-pink-100 dark:border-slate-700">
                        <div className="w-12 h-12 bg-pink-400 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                            <Heart fill="currentColor" size={20} />
                        </div>
                        <h3 className="font-serif text-3xl font-bold mb-4 text-slate-800 dark:text-white">Le Mot du Créateur</h3>
                        <p className="font-serif italic text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
                            "Ce programme a été imaginé et codé par Johan. L'objectif ? Transformer le chaos administratif en un espace zen et parfaitement rangé."
                        </p>
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800/60 rounded-full shadow-sm border border-slate-200 dark:border-slate-700/50 text-xs font-bold tracking-widest uppercase text-slate-500">
                            <Sparkles size={14} className="text-brand-orange" />
                            Signature de design par Johan Vila Automation
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Global utilities */}
            <Suspense fallback={null}>
                <PWAInstallPrompt />
                <BugReporter />
                <WhatsNew />
            </Suspense>
        </>
    );
};

export default GlobalOverlays;
