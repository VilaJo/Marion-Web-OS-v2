import React, { useState } from 'react';
import { ArrowRight, Check, Key, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { activateCloudAiMode } from '../services/geminiService';

declare const confetti: any;

interface OnboardingProps {
    onSetupComplete: () => void;
}

// Marion Logo Component - Uses the original logo
const MarionLogo = ({ size = 80, spinning = false, success = false }: { size?: number; spinning?: boolean; success?: boolean }) => (
    <div className={`relative ${spinning ? 'animate-spin-slow' : ''}`}>
        {success ? (
            <div 
                className="rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-2xl flex items-center justify-center"
                style={{ width: size, height: size }}
            >
                <Check className="text-white drop-shadow-lg" style={{ width: size * 0.5, height: size * 0.5 }} />
            </div>
        ) : (
            <img 
                src="/logo-eonora.png" 
                alt="Eonora Tech OS" 
                className="drop-shadow-xl"
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        )}
    </div>
);

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
            // Get auth token if available
            const token = sessionStorage.getItem('marion_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/v1/ai/setup', {
                method: 'POST',
                headers,
                body: JSON.stringify({ api_key: apiKey })
            });

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { error: `Réponse inattendue: ${text.substring(0, 100)}` };
            }

            if (response.ok && data.success) {
                activateCloudAiMode();
                setTimeout(() => {
                    setStep('success');
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                    setTimeout(onSetupComplete, 2000);
                }, 2500);
            } else {
                setStep('input');
                // Better error messages
                let errorMsg = data.error || "Oups, cette clé ne semble pas fonctionner.";
                if (response.status === 401) {
                    errorMsg = "Session expirée. Veuillez rafraîchir la page.";
                } else if (response.status === 400 && errorMsg.includes('API')) {
                    errorMsg = "Clé API invalide. Vérifiez que vous avez copié la clé complète.";
                }
                setError(errorMsg);
            }
        } catch (e: any) {
            setStep('input');
            console.error('Setup error:', e);
            setError(`Erreur de connexion: ${e.message || 'Vérifiez votre connexion réseau.'}`);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-gradient-to-br from-[#FAF7F2] via-[#FAF7F2] to-[#FAF7F2] dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
            {/* Background decorations */}
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#A7C1A3]/25 dark:bg-orange-900/10 rounded-full blur-[120px] -z-10" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/20 dark:bg-purple-900/10 rounded-full blur-[100px] -z-10" />

            <div className="max-w-lg w-full relative z-10">
                
                {/* Logo Animation */}
                <div className="flex justify-center mb-8">
                    <MarionLogo 
                        size={100} 
                        spinning={step === 'installing'} 
                        success={step === 'success'} 
                    />
                </div>

                {/* Content Flow */}
                <div className="text-center transition-all duration-500">
                    
                    {/* INTRO STEP */}
                    {step === 'intro' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <h1 
                                className="text-4xl font-semibold text-slate-800 dark:text-white mb-4"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                Bonjour, Marion.
                            </h1>
                            <p 
                                className="text-lg text-slate-500 dark:text-slate-400 mb-10 leading-relaxed"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Je suis Franck, votre assistant intelligent. <br/>
                                Je vais organiser votre espace de travail et vous accompagner au quotidien.
                            </p>
                            <button 
                                onClick={() => setStep('input')}
                                className="bg-gradient-to-r from-[#7C9A7E] to-[#647D66] text-white px-10 py-4 rounded-2xl font-semibold text-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-[#7C9A7E]/30 dark:hover:shadow-orange-900/30 transition-all flex items-center gap-3 mx-auto"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                Commencer <ArrowRight size={20} />
                            </button>
                        </div>
                    )}

                    {/* INPUT STEP */}
                    {step === 'input' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <h2 
                                className="text-3xl font-semibold text-slate-800 dark:text-white mb-3"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                Clé d'activation
                            </h2>
                            <p 
                                className="text-slate-500 dark:text-slate-400 mb-8"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Pour fonctionner, j'ai besoin d'une clé API Gemini Pro.
                            </p>
                            
                            {/* Form Card */}
                            <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-slate-700/50 shadow-xl">
                                <div className="relative mb-5">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input 
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Collez votre clé ici (AIza...)"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C9A7E]/40 focus:border-[#7C9A7E] transition-all"
                                        style={{ fontFamily: 'Raleway, sans-serif' }}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
                                    />
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 rounded-xl p-4 mb-5">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <span style={{ fontFamily: 'Raleway, sans-serif' }}>{error}</span>
                                    </div>
                                )}

                                <button 
                                    onClick={handleSetup}
                                    disabled={!apiKey.trim()}
                                    className="w-full bg-gradient-to-r from-[#7C9A7E] to-[#647D66] text-white py-4 rounded-2xl font-semibold text-lg hover:shadow-lg hover:shadow-[#7C9A7E]/30 dark:hover:shadow-orange-900/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Initialiser mon espace
                                </button>

                                <p 
                                    className="mt-6 text-xs text-slate-400 dark:text-slate-500"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                >
                                    Votre clé est stockée localement et ne quitte jamais votre ordinateur.
                                </p>
                            </div>

                            {/* Help link */}
                            <a 
                                href="https://makersuite.google.com/app/apikey" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block mt-6 text-sm text-[#7C9A7E] hover:underline"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Comment obtenir une clé API Gemini ?
                            </a>
                        </div>
                    )}

                    {/* INSTALLING STEP */}
                    {step === 'installing' && (
                        <div className="animate-in fade-in zoom-in duration-500">
                            <h2 
                                className="text-3xl font-semibold text-slate-800 dark:text-white mb-8"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                Installation en cours...
                            </h2>
                            
                            <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-slate-700/50 shadow-xl max-w-sm mx-auto">
                                <div className="space-y-5 text-left">
                                    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                                        <Loader2 className="w-5 h-5 text-[#7C9A7E] animate-spin flex-shrink-0" />
                                        <span style={{ fontFamily: 'Raleway, sans-serif' }}>Connexion à Gemini...</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-left-2 delay-300 fill-mode-both">
                                        <Loader2 className="w-5 h-5 text-[#7C9A7E] animate-spin flex-shrink-0" />
                                        <span style={{ fontFamily: 'Raleway, sans-serif' }}>Création de "00_INBOX"...</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-left-2 delay-700 fill-mode-both">
                                        <Loader2 className="w-5 h-5 text-[#7C9A7E] animate-spin flex-shrink-0" />
                                        <span style={{ fontFamily: 'Raleway, sans-serif' }}>Configuration du Dashboard...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUCCESS STEP */}
                    {step === 'success' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <h2 
                                className="text-4xl font-semibold text-slate-800 dark:text-white mb-3"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                Tout est prêt !
                            </h2>
                            <p 
                                className="text-lg text-slate-500 dark:text-slate-400"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Votre espace de travail est configuré.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
