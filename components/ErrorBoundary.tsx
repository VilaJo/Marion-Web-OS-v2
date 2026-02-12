/**
 * Error Boundary & Route Error Fallback
 * 
 * ErrorBoundary: Class component that catches render errors in its children.
 * RouteErrorFallback: Used as `errorElement` in React Router to catch route-level errors.
 */
import React from 'react';
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// ---------------------------------------------------------------------------
// ErrorBoundary (class component - required for componentDidCatch)
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-slate-800 dark:text-white mb-2">
                        Quelque chose s'est mal passé
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                        Une erreur inattendue est survenue. Essayez de recharger la page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-orange text-white rounded-full font-bold hover:scale-105 transition-transform"
                    >
                        <RefreshCw size={16} /> Recharger
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ---------------------------------------------------------------------------
// RouteErrorFallback (for React Router errorElement)
// ---------------------------------------------------------------------------

export const RouteErrorFallback: React.FC = () => {
    const error = useRouteError();
    const navigate = useNavigate();

    let title = 'Erreur inattendue';
    let message = 'Une erreur est survenue lors du chargement de cette page.';

    if (isRouteErrorResponse(error)) {
        if (error.status === 404) {
            title = 'Page introuvable';
            message = 'Cette page n\'existe pas ou a été déplacée.';
        } else {
            title = `Erreur ${error.status}`;
            message = error.statusText || message;
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-[#0B0F19]">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-8">
                <AlertTriangle className="text-red-500" size={40} />
            </div>
            <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white mb-3">
                {title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-lg">
                {message}
            </p>
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-orange text-white rounded-full font-bold hover:scale-105 transition-transform"
                >
                    <Home size={16} /> Retour au dashboard
                </button>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-6 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <RefreshCw size={16} /> Recharger
                </button>
            </div>
        </div>
    );
};

export default ErrorBoundary;
