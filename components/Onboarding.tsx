
import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, Key, LayoutGrid } from 'lucide-react';

declare const confetti: any;

interface OnboardingProps {
    onSetupComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onSetupComplete }) => {
    const [apiKey, setApiKey] = useState('');
    const [step, setStep] = useState<'intro' | 'input' | 'installing' | 'success'>('intro');
    const [error, setError] = useState('');

    const handleSetup = async () => {
        if (!apiKey.trim()) {
            setError("J'ai besoin de la clé pour réveiller mes neurones.");
            return;
        }
        
        setStep('installing');
        setError('');

        try {
            const response = await fetch('http://127.0.0.1:5003/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey })
            });

            const data = await response.json();

            if (response.ok) {
                setTimeout(() => {
                    setStep('success');
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                    setTimeout(onSetupComplete, 2000);
                }, 2500); // Fake delay for dramatic effect
            } else {
                setStep('input');
                setError(data.error || "Oups, cette clé ne semble pas fonctionner.");
            }
        } catch (e) {
            setStep('input');
            setError("Impossible de contacter le cerveau (Serveur Python déconnecté ?).");
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-[#FDFCF8] dark:bg-[#0B0F19] flex items-center justify-center font-sans">
            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-200/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/20 rounded-full blur-[100px]"></div>

            <div className="max-w-lg w-full p-8 relative z-10">
                
                {/* Logo Animation */}
                <div className="flex justify-center mb-8">
                    <div className={`w-24 h-24 rounded-full bg-marion-gradient shadow-2xl flex items-center justify-center relative transition-all duration-700 ${step === 'installing' ? 'animate-spin-slow' : ''}`}>
                         <span className="font-serif text-5xl text-white italic pr-1">M</span>
                         {step === 'success' && (
                             <div className="absolute inset-0 bg-green-500 rounded-full flex items-center justify-center animate-in zoom-in">
                                 <Check className="text-white w-12 h-12" />
                             </div>
                         )}
                    </div>
                </div>

                {/* Content Flow */}
                <div className="text-center space-y-6 transition-all duration-500">
                    
                    {step === 'intro' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <h1 className="text-4xl font-serif text-slate-800 dark:text-white mb-4">Bonjour, Marion.</h1>
                            <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                                Je suis Franck, votre nouvel assistant. <br/>
                                Je vais organiser votre bureau, trier vos dossiers et préparer votre café (virtuel).
                            </p>
                            <button 
                                onClick={() => setStep('input')}
                                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform flex items-center gap-3 mx-auto shadow-xl shadow-slate-200 dark:shadow-none"
                            >
                                Commencer l'installation <ArrowRight size={20} />
                            </button>
                        </div>
                    )}

                    {step === 'input' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-serif text-slate-800 dark:text-white mb-2">Clé d'activation</h2>
                            <p className="text-slate-500 text-sm mb-6">Pour fonctionner, j'ai besoin d'une clé API Gemini Pro.</p>
                            
                            <div className="relative mb-4">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input 
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Collez votre clé ici (AIza...)"
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-center text-lg outline-none focus:border-brand-orange transition-colors shadow-sm"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm font-bold mb-4 bg-red-50 py-2 rounded-lg animate-pulse">
                                    {error}
                                </div>
                            )}

                            <button 
                                onClick={handleSetup}
                                className="w-full bg-brand-orange text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200/50"
                            >
                                Initialiser mon Espace
                            </button>
                            <p className="mt-6 text-xs text-slate-400">
                                Cela va créer un dossier "Mon bordel" sur votre bureau.
                            </p>
                        </div>
                    )}

                    {step === 'installing' && (
                        <div className="animate-in fade-in zoom-in duration-500">
                            <h2 className="text-2xl font-serif text-slate-800 dark:text-white mb-6">Installation en cours...</h2>
                            
                            <div className="max-w-xs mx-auto space-y-4 text-left">
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                    <div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                                    <span>Connexion à Gemini...</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-left-2 delay-300 fill-mode-both">
                                    <div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                                    <span>Création de "00_INBOX"...</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-left-2 delay-700 fill-mode-both">
                                    <div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                                    <span>Configuration du Dashboard...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <h2 className="text-3xl font-serif text-slate-800 dark:text-white mb-2">Tout est prêt !</h2>
                            <p className="text-slate-500">Votre cockpit est configuré.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
