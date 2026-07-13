import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Wifi, Bell, Share } from 'lucide-react';

interface PWAInstallPromptProps {
    onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onDismiss }) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // Check if already installed
        const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
        setIsStandalone(standalone);

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(iOS);

        // Check if permanently dismissed
        const permanentlyDismissed = localStorage.getItem('marion_pwa_never_show') === 'true';
        
        // Check if temporarily dismissed
        const dismissed = localStorage.getItem('marion_pwa_dismissed');
        const dismissedDate = dismissed ? new Date(dismissed) : null;
        const daysSinceDismiss = dismissedDate 
            ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24) 
            : Infinity;

        // Show prompt if not installed, not dismissed permanently, not dismissed recently (7 days), and on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isDesktop = !isMobile && !/Mobi|Android/i.test(navigator.userAgent);
        
        // Only show on actual mobile devices, not desktop
        if (!standalone && !permanentlyDismissed && daysSinceDismiss > 7 && isMobile && !isDesktop) {
            // Delay showing prompt
            setTimeout(() => setShowPrompt(true), 3000);
        }

        // Listen for beforeinstallprompt event (Android/Chrome)
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Expose globally for use elsewhere
            (window as any).deferredPrompt = e;
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Make showInstallButton available globally
        (window as any).showInstallButton = () => setShowPrompt(true);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            // Chrome/Android install
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                // PWA installed successfully
            }
            
            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('marion_pwa_dismissed', new Date().toISOString());
        setShowPrompt(false);
        onDismiss?.();
    };

    const handleNeverShow = () => {
        localStorage.setItem('marion_pwa_never_show', 'true');
        setShowPrompt(false);
        onDismiss?.();
    };

    if (isStandalone || !showPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-orange to-pink-500 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-semibold text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            Installer l'application
                        </span>
                    </div>
                    <button 
                        onClick={handleDismiss}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4" style={{ fontFamily: 'Raleway, sans-serif' }}>
                        Installez Eonora Tech OS sur votre appareil pour un accès rapide et une meilleure expérience.
                    </p>

                    {/* Benefits */}
                    <div className="space-y-2 mb-4">
                        {[
                            { icon: Wifi, text: 'Accès hors-ligne' },
                            { icon: Bell, text: 'Notifications push' },
                            { icon: Download, text: 'Lancement rapide' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <item.icon className="w-4 h-4 text-brand-orange" />
                                <span style={{ fontFamily: 'Raleway, sans-serif' }}>{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {isIOS ? (
                        // iOS instructions
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mb-4">
                            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                <strong>Sur iPhone/iPad :</strong>
                            </p>
                            <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-decimal list-inside" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                <li>Appuyez sur <Share className="w-3 h-3 inline text-blue-500" /> en bas de Safari</li>
                                <li>Faites défiler et appuyez sur "Sur l'écran d'accueil"</li>
                                <li>Appuyez sur "Ajouter"</li>
                            </ol>
                        </div>
                    ) : deferredPrompt ? (
                        // Android/Chrome install button
                        <button
                            onClick={handleInstall}
                            className="w-full py-3 bg-gradient-to-r from-brand-orange to-pink-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            <Download className="w-4 h-4" />
                            Installer maintenant
                        </button>
                    ) : (
                        // Generic instructions
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                                Utilisez le menu de votre navigateur pour ajouter l'app à l'écran d'accueil.
                            </p>
                        </div>
                    )}

                    {/* Dismiss options */}
                    <div className="flex items-center justify-center gap-4 mt-3">
                        <button
                            onClick={handleDismiss}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            Plus tard
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <button
                            onClick={handleNeverShow}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            Ne plus afficher
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
