import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield, Sparkles, AlertCircle, Loader2, AlertTriangle, Trash2 } from 'lucide-react';

interface LoginScreenProps {
    onAuthenticated: (token: string) => void;
    onSkip?: () => void;
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
            const response = await fetch('/api/auth/check');
            if (!response.ok) {
                throw new Error('Backend not available');
            }
            const data = await response.json();
            
            setIsConfigured(data.configured);
            
            // If already authenticated, skip login
            if (data.configured && data.authenticated) {
                const savedToken = sessionStorage.getItem('marion_token');
                if (savedToken) {
                    onAuthenticated(savedToken);
                }
            }
        } catch (err) {
            // Backend might not be ready yet - default to setup mode
            console.error('Auth check failed:', err);
            setIsConfigured(false);
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
            const response = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur de configuration');
            }

            // Store token in sessionStorage (cleared when browser closes)
            sessionStorage.setItem('marion_token', data.token);
            onAuthenticated(data.token);
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
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Mot de passe incorrect');
            }

            // Store token in sessionStorage
            sessionStorage.setItem('marion_token', data.token);
            onAuthenticated(data.token);
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
            const response = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'RESET' })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur de réinitialisation');
            }

            // Clear local storage and reload
            sessionStorage.removeItem('marion_token');
            setShowResetConfirm(false);
            setIsConfigured(false);
            setPassword('');
            setResetConfirmText('');
        } catch (err: any) {
            setError(err.message || 'Erreur de réinitialisation');
        } finally {
            setIsResetting(false);
        }
    };

    // Loading state while checking auth
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
                    <p className="text-slate-400 text-sm">Chargement...</p>
                </div>
            </div>
        );
    }

    // If not configured yet, show setup form
    if (isConfigured === false) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Logo / Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-orange to-pink-500 mb-4 shadow-lg shadow-brand-orange/20">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Sécuriser Marion</h1>
                        <p className="text-slate-400 text-sm">
                            Créez un mot de passe pour protéger vos données
                        </p>
                    </div>

                    {/* Setup Form */}
                    <form onSubmit={handleSetup} className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                        <div className="space-y-4">
                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Mot de passe
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Minimum 6 caractères"
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-11 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password Field */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Confirmer le mot de passe
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Répétez le mot de passe"
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all"
                                    />
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !password || !confirmPassword}
                                className="w-full bg-gradient-to-r from-brand-orange to-pink-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Configuration...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Activer la protection
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Security Info */}
                        <div className="mt-6 pt-4 border-t border-slate-700/50">
                            <p className="text-xs text-slate-500 text-center">
                                Vos données seront chiffrées avec ce mot de passe.
                                <br />
                                <span className="text-brand-orange">Conservez-le précieusement !</span>
                            </p>
                        </div>
                    </form>

                    {/* Skip Button (optional, for development) */}
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="mt-4 w-full text-slate-500 text-sm hover:text-slate-300 transition-colors"
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-orange to-pink-500 mb-4 shadow-lg shadow-brand-orange/20">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Marion Web OS</h1>
                    <p className="text-slate-400 text-sm">
                        Entrez votre mot de passe pour continuer
                    </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                    <div className="space-y-4">
                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Votre mot de passe"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-11 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="w-full bg-gradient-to-r from-brand-orange to-pink-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20"
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
                    className="mt-4 w-full text-slate-500 text-sm hover:text-slate-300 transition-colors"
                >
                    Mot de passe oublié ?
                </button>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-600">
                    Vos données sont chiffrées et sécurisées localement
                </p>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Réinitialiser l'authentification</h3>
                                <p className="text-sm text-slate-400">Cette action est irréversible</p>
                            </div>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                            <p className="text-sm text-red-300 mb-2">
                                <strong>Attention !</strong> La réinitialisation va supprimer :
                            </p>
                            <ul className="text-sm text-red-300/80 space-y-1 ml-4 list-disc">
                                <li>Votre mot de passe actuel</li>
                                <li>Les tokens Google (connexion Calendar/Drive)</li>
                                <li>Les données chiffrées du coffre-fort</li>
                            </ul>
                            <p className="text-sm text-red-300 mt-2">
                                Vos fichiers clients et dossiers seront conservés.
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Tapez <span className="font-mono bg-slate-700 px-2 py-0.5 rounded">RESET</span> pour confirmer
                            </label>
                            <input
                                type="text"
                                value={resetConfirmText}
                                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                                placeholder="RESET"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
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
                                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleResetAuth}
                                disabled={isResetting || resetConfirmText !== 'RESET'}
                                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                            >
                                {isResetting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Réinitialisation...
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
