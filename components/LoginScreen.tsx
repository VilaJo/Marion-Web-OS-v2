import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Sparkles, AlertCircle, Loader2, AlertTriangle, Trash2, Shield } from 'lucide-react';

interface LoginScreenProps {
    onAuthenticated: (token: string) => void;
    onSkip?: () => void;
}

/** Lit le corps HTTP même vide ou non-JSON — évite « Unexpected end of JSON input » côté navigateur. */
async function parseMarionAuthResponse(response: Response): Promise<Record<string, unknown>> {
    const raw = await response.text();
    if (!raw.trim()) {
        if (!response.ok) {
            throw new Error(
                `Le serveur a répondu sans détail (code ${response.status}). Consulte .marion.log dans le dossier Marion ou redémarre l’application.`
            );
        }
        return {};
    }
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        throw new Error(
            'Réponse invalide du serveur Marion. Consulte .marion.log dans le dossier du projet, ou redémarre l’application.'
        );
    }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated, onSkip }) => {
    const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState('');

    // Check if auth is configured on mount
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/v1/auth/check');
            if (!response.ok) {
                throw new Error('Backend not available');
            }
            const data = await parseMarionAuthResponse(response);

            setIsConfigured(data.configured === true);
            if (data.corrupt === true) {
                setError('Ancien mot de passe illisible. Utilise REINITIALISER_MOT_DE_PASSE.command puis rafraîchis (Cmd+R).');
                setIsConfigured(false);
            }
            
            // If already authenticated, skip login
            if (data.configured && data.authenticated) {
                const savedToken = sessionStorage.getItem('marion_token');
                if (savedToken) {
                    onAuthenticated(savedToken);
                }
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setError('Impossible de joindre Marion. Lance LANCER_MARION.command puis rafraîchis la page (Cmd+R).');
            setIsConfigured(null);
        } finally {
            setIsCheckingAuth(false);
        }
    };

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/v1/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await parseMarionAuthResponse(response);

            if (!response.ok) {
                const msg = typeof data.error === 'string' ? data.error : `Erreur ${response.status}`;
                if (/deja configure|déjà configur/i.test(msg)) {
                    setIsConfigured(true);
                    setError('Un mot de passe existe déjà. Connecte-toi ou clique « Mot de passe oublié ».');
                    return;
                }
                throw new Error(msg);
            }

            const token = data.token;
            if (typeof token !== 'string' || !token) {
                throw new Error(
                    'Session non créée. Vérifie que le dossier « Marion Web OS Database » est accessible et redémarre Marion.'
                );
            }

            // Store token in sessionStorage (cleared when browser closes)
            sessionStorage.setItem('marion_token', token);
            onAuthenticated(token);
        } catch (err: any) {
            setError(err.message || 'Erreur de connexion');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await parseMarionAuthResponse(response);

            if (!response.ok) {
                if (data.code === 'CORRUPT_AUTH') {
                    sessionStorage.removeItem('marion_token');
                    setIsConfigured(false);
                    setPassword('');
                    setError(typeof data.error === 'string' ? data.error : 'Mot de passe réinitialisé — rafraîchis la page.');
                    window.location.reload();
                    return;
                }
                throw new Error(typeof data.error === 'string' ? data.error : 'Mot de passe incorrect');
            }

            const token = data.token;
            if (typeof token !== 'string' || !token) {
                throw new Error('Connexion impossible — réponse serveur incomplète.');
            }

            // Store token in sessionStorage
            sessionStorage.setItem('marion_token', token);
            onAuthenticated(token);
        } catch (err: any) {
            setError(err.message || 'Erreur de connexion');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetAuth = async () => {
        if (resetConfirmText !== 'RESET') {
            setError('Tapez RESET pour confirmer');
            return;
        }

        setIsResetting(true);
        setError('');

        try {
            const response = await fetch('/api/v1/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'RESET' })
            });

            const data = await parseMarionAuthResponse(response);

            if (!response.ok) {
                throw new Error(typeof data.error === 'string' ? data.error : 'Erreur de réinitialisation');
            }

            // Clear local storage and reload
            sessionStorage.removeItem('marion_token');
            setShowResetConfirm(false);
            setIsConfigured(false);
            setPassword('');
            setConfirmPassword('');
            setResetConfirmText('');
            setError('');
            window.location.reload();
        } catch (err: any) {
            setError(err.message || 'Erreur de réinitialisation');
        } finally {
            setIsResetting(false);
        }
    };

    // Marion Logo Component - Uses the original logo
    const MarionLogo = ({ size = 80 }: { size?: number }) => (
        <div className="relative">
            <img 
                src="/logo-marion.png" 
                alt="Marion Web OS" 
                className="drop-shadow-xl"
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        </div>
    );

    // Loading state while checking auth
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF8F5] to-[#FFF0F5] dark:from-transparent dark:via-transparent dark:to-transparent flex items-center justify-center relative z-10">
                <div className="flex flex-col items-center gap-6">
                    <MarionLogo size={100} />
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-[#FF7E5F] animate-spin" />
                        <p className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Raleway, sans-serif' }}>
                            Chargement...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (isConfigured === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF8F5] to-[#FFF0F5] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/80 rounded-3xl p-8 text-center shadow-xl">
                    <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-slate-800 mb-2">Marion ne répond pas</h1>
                    <p className="text-slate-600 text-sm mb-6">{error}</p>
                    <button
                        type="button"
                        onClick={() => { setIsCheckingAuth(true); setError(''); checkAuthStatus(); }}
                        className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-semibold py-3 rounded-2xl"
                    >
                        Réessayer
                    </button>
                </div>
            </div>
        );
    }

    // If not configured yet, show setup form
    if (isConfigured === false) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF8F5] to-[#FFF0F5] dark:from-transparent dark:via-transparent dark:to-transparent flex items-center justify-center p-4 relative z-10">
                {/* Background decorations (light mode only) */}
                <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#FEB47B]/20 dark:bg-transparent rounded-full blur-[120px] -z-10" />
                <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/20 dark:bg-transparent rounded-full blur-[100px] -z-10" />
                
                <div className="w-full max-w-md">
                    {/* Logo / Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-6">
                            <MarionLogo size={100} />
                        </div>
                        <h1 
                            className="text-3xl font-semibold text-slate-800 dark:text-white mb-3 drop-shadow-sm dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            Bienvenue sur Marion
                        </h1>
                        <p 
                            className="text-slate-500 dark:text-slate-300"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            Créez un mot de passe pour protéger vos données
                        </p>
                    </div>

                    {/* Setup Form */}
                    <form 
                        onSubmit={handleSetup} 
                        className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-slate-700/50 shadow-xl"
                    >
                        <div className="space-y-5">
                            {/* Password Field */}
                            <div>
                                <label 
                                    className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                >
                                    Mot de passe
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Minimum 6 caractères"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]/50 focus:border-[#FF7E5F] transition-all"
                                        style={{ fontFamily: 'Raleway, sans-serif' }}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password Field */}
                            <div>
                                <label 
                                    className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                >
                                    Confirmer le mot de passe
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Répétez le mot de passe"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]/50 focus:border-[#FF7E5F] transition-all"
                                        style={{ fontFamily: 'Raleway, sans-serif' }}
                                    />
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 rounded-xl p-4">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span style={{ fontFamily: 'Raleway, sans-serif' }}>{error}</span>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !password || !confirmPassword}
                                className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-semibold py-4 rounded-2xl hover:shadow-lg hover:shadow-orange-200/50 dark:hover:shadow-orange-900/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Configuration...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5" />
                                        Activer la protection
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Security Info */}
                        <div className="mt-6 pt-5 border-t border-slate-200/50 dark:border-slate-700/50">
                            <div className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                                <Sparkles className="w-5 h-5 text-[#FF7E5F] flex-shrink-0 mt-0.5" />
                                <p style={{ fontFamily: 'Raleway, sans-serif' }}>
                                    Vos données seront chiffrées localement avec ce mot de passe. 
                                    <span className="text-[#FF7E5F] font-medium"> Conservez-le précieusement !</span>
                                </p>
                            </div>
                        </div>
                    </form>

                    <button
                        type="button"
                        onClick={() => setShowResetConfirm(true)}
                        className="mt-5 w-full text-slate-400 text-sm hover:text-[#FF7E5F] transition-colors"
                        style={{ fontFamily: 'Raleway, sans-serif' }}
                    >
                        Mot de passe oublié ? Réinitialiser
                    </button>

                    {showResetConfirm && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                    Tape <strong>RESET</strong> puis valide. Tes dossiers clients restent intacts.
                                </p>
                                <input
                                    type="text"
                                    value={resetConfirmText}
                                    onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                                    placeholder="RESET"
                                    className="w-full border rounded-2xl py-3 px-4 mb-4 tabular-nums"
                                />
                                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => { setShowResetConfirm(false); setResetConfirmText(''); setError(''); }} className="flex-1 py-3 rounded-2xl bg-slate-100">Annuler</button>
                                    <button type="button" onClick={handleResetAuth} disabled={isResetting || resetConfirmText !== 'RESET'} className="flex-1 py-3 rounded-2xl bg-red-500 text-white disabled:opacity-50">Réinitialiser</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Skip Button (optional, for development) */}
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="mt-4 w-full text-slate-400 text-sm hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                        >
                            Ignorer pour l'instant
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Login form (auth already configured)
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF8F5] to-[#FFF0F5] dark:from-transparent dark:via-transparent dark:to-transparent flex items-center justify-center p-4 relative z-10">
            {/* Background decorations (light mode only) */}
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#FEB47B]/20 dark:bg-transparent rounded-full blur-[120px] -z-10" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/20 dark:bg-transparent rounded-full blur-[100px] -z-10" />
            
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <MarionLogo size={100} />
                    </div>
                    <h1 
                        className="text-3xl font-semibold text-slate-800 dark:text-white mb-3 drop-shadow-sm dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                        Marion Web OS
                    </h1>
                    <p 
                        className="text-slate-500 dark:text-slate-300"
                        style={{ fontFamily: 'Raleway, sans-serif' }}
                    >
                        Entrez votre mot de passe pour continuer
                    </p>
                </div>

                {/* Login Form */}
                <form 
                    onSubmit={handleLogin} 
                    className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-slate-700/50 shadow-xl"
                >
                    <div className="space-y-5">
                        {/* Password Field */}
                        <div>
                            <label 
                                className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Votre mot de passe"
                                    className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-12 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF7E5F]/50 focus:border-[#FF7E5F] transition-all"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 rounded-xl p-4">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span style={{ fontFamily: 'Raleway, sans-serif' }}>{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-semibold py-4 rounded-2xl hover:shadow-lg hover:shadow-orange-200/50 dark:hover:shadow-orange-900/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Connexion...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-5 h-5" />
                                    Se connecter
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Forgot Password Link */}
                <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="mt-5 w-full text-slate-400 text-sm hover:text-[#FF7E5F] transition-colors"
                    style={{ fontFamily: 'Raleway, sans-serif' }}
                >
                    Mot de passe oublié ?
                </button>

                {/* Footer */}
                <p 
                    className="mt-6 text-center text-xs text-slate-400"
                    style={{ fontFamily: 'Raleway, sans-serif' }}
                >
                    Vos données sont chiffrées et sécurisées localement
                </p>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
                                <AlertTriangle className="w-7 h-7 text-red-500" />
                            </div>
                            <div>
                                <h3 
                                    className="text-xl font-semibold text-slate-800 dark:text-white"
                                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                                >
                                    Réinitialiser
                                </h3>
                                <p 
                                    className="text-sm text-slate-500 dark:text-slate-400"
                                    style={{ fontFamily: 'Raleway, sans-serif' }}
                                >
                                    Cette action est irréversible
                                </p>
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-4 mb-5">
                            <p 
                                className="text-sm text-red-600 dark:text-red-300 mb-2 font-medium"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Attention ! La réinitialisation va supprimer :
                            </p>
                            <ul 
                                className="text-sm text-red-500 dark:text-red-300/80 space-y-1 ml-4 list-disc"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                <li>Votre mot de passe actuel</li>
                                <li>Les tokens Google (Calendar/Drive)</li>
                                <li>Les données chiffrées du coffre-fort</li>
                            </ul>
                            <p 
                                className="text-sm text-red-600 dark:text-red-300 mt-3"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Vos fichiers clients seront conservés.
                            </p>
                        </div>

                        <div className="mb-5">
                            <label 
                                className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2"
                                style={{ fontFamily: 'Raleway, sans-serif' }}
                            >
                                Tapez <span className="tabular-nums bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">RESET</span> pour confirmer
                            </label>
                            <input
                                type="text"
                                value={resetConfirmText}
                                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                                placeholder="RESET"
                                className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all tabular-nums"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 rounded-xl p-3 mb-4">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span style={{ fontFamily: 'Raleway, sans-serif' }}>{error}</span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowResetConfirm(false);
                                    setResetConfirmText('');
                                    setError('');
                                }}
                                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-2xl transition-colors font-medium"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleResetAuth}
                                disabled={isResetting || resetConfirmText !== 'RESET'}
                                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300 dark:disabled:bg-red-500/50 text-white rounded-2xl transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                {isResetting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        ...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-5 h-5" />
                                        Réinitialiser
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginScreen;
