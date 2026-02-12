import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Sparkles } from 'lucide-react';
import { Notification, NotificationType } from '../types';

interface BadgeProps {
    children?: React.ReactNode;
    color: string;
    onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({ children, color, onClick }) => {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50',
        blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50',
        purple: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50',
        yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/50',
        gray: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700/50',
        red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50',
        pink: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800/50',
        brand: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50',
    };

    return (
        <span 
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClasses[color] || colorClasses.gray} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
        >
            {children}
        </span>
    );
};

interface CardProps {
    children?: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
    <div 
        onClick={onClick}
        className={`glass rounded-4xl p-6 shadow-sm dark:shadow-md border border-white/50 dark:border-slate-700/50 dark:bg-slate-800/40 ${className}`}
    >
        {children}
    </div>
);

interface TooltipProps {
    children: React.ReactNode;
    content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
    const [isVisible, setIsVisible] = React.useState(false);

    return (
        <div 
            className="relative flex items-center justify-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="absolute top-full mt-2 px-3 py-1.5 bg-slate-800/90 text-white text-xs font-medium rounded-lg whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-200 shadow-lg backdrop-blur-sm">
                    {content}
                    {/* Tiny triangle pointer */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800/90 rotate-45"></div>
                </div>
            )}
        </div>
    );
};

interface EmptyStateProps {
    title: string;
    message: string;
    icon?: React.ElementType;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, icon: Icon, actionLabel, onAction }) => (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px] animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
            {Icon ? <Icon size={32} className="text-slate-400 dark:text-slate-500" /> : <Info size={32} className="text-slate-400" />}
        </div>
        <h3 className="font-serif text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">{message}</p>
        {actionLabel && onAction && (
            <button 
                onClick={onAction}
                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-lg"
            >
                {actionLabel}
            </button>
        )}
    </div>
);

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children?: React.ReactNode;
    width?: string;
    noContentPadding?: boolean;
    showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = 'max-w-2xl', noContentPadding = false, showCloseButton = true }) => {
    const modalRef = React.useRef<HTMLDivElement>(null);
    const previousFocusRef = React.useRef<HTMLElement | null>(null);
    const onCloseRef = React.useRef(onClose);

    // Keep onCloseRef up to date
    React.useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Lock body scroll and handle ESC key & Focus Trap
    React.useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            document.body.classList.add('overflow-hidden');
            
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.stopPropagation(); // Prevent closing parent views
                    onCloseRef.current(); // Use ref to avoid dependency
                }

                // Focus Trap
                if (e.key === 'Tab' && modalRef.current) {
                    const focusableElements = modalRef.current.querySelectorAll(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    if (focusableElements.length === 0) return;

                    const firstElement = focusableElements[0] as HTMLElement;
                    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            
            // Focus the modal content or the first input ONLY ONCE when opened
            setTimeout(() => {
                if (modalRef.current) {
                    // Try to find an autoFocus element first
                    const autoFocusElement = modalRef.current.querySelector('[autofocus]') as HTMLElement;
                    if (autoFocusElement) {
                        autoFocusElement.focus();
                    } else {
                        const firstInput = modalRef.current.querySelector('input, button') as HTMLElement;
                        if (firstInput) firstInput.focus();
                        else modalRef.current.focus();
                    }
                }
            }, 50);

            return () => {
                document.body.classList.remove('overflow-hidden');
                window.removeEventListener('keydown', handleKeyDown);
                // Restore focus
                if (previousFocusRef.current) {
                    previousFocusRef.current.focus();
                }
            };
        } else {
            document.body.classList.remove('overflow-hidden');
        }
    }, [isOpen]); // Removed onClose from dependencies to prevent re-running on state updates within modal

    if (!isOpen) return null;
    return createPortal(
        <div 
            className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/30 backdrop-blur-sm md:p-4 animate-in fade-in duration-500"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
                        <div 
                            ref={modalRef}
                            className={`bg-white dark:bg-slate-900/95 dark:border dark:border-slate-700/50 rounded-t-3xl md:rounded-4xl shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] w-full ${width} flex flex-col animate-in slide-in-from-bottom md:animate-in md:zoom-in-95 duration-500 max-h-[90vh] md:max-h-[95vh] relative outline-none`}
                            onClick={(e) => e.stopPropagation()}
                            tabIndex={-1}
                        >
                            {/* Mobile drag handle */}
                            <div className="md:hidden flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            </div>
                            {title ? (
                                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900/95 z-10 rounded-t-4xl shrink-0">
                                    <h2 id="modal-title" className="text-2xl font-serif text-slate-800 dark:text-white">{title}</h2>
                                    {showCloseButton && (
                                        <button onClick={onClose} aria-label="Fermer" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors group">
                                            <X className="w-6 h-6 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                showCloseButton && (
                                    <button onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors group z-50 shadow-sm border border-slate-100 dark:border-slate-700">
                                        <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
                                    </button>
                                )
                            )}
                            <div className={`${noContentPadding ? "p-0" : "p-6"} flex-1 overflow-y-auto min-h-0`}>
                                {children}
                            </div>
                        </div>        </div>,
        document.body
    );
};

interface ToastProps {
    type: NotificationType;
    message: string;
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
    const isError = type === 'error';
    
    return (
        <div className={`
            relative overflow-hidden group
            flex items-center gap-4 p-4 rounded-2xl shadow-xl hover:shadow-2xl
            backdrop-blur-xl border border-white/60 dark:border-white/10
            animate-in slide-in-from-right-full duration-500 ease-out
            min-w-[340px] max-w-sm cursor-pointer transition-all hover:scale-[1.02]
            ${isError 
                ? 'bg-red-50/90 dark:bg-red-900/30' 
                : 'bg-white/80 dark:bg-slate-800/80'
            }
        `}>
            {/* Gradient Background Glow */}
            <div className={`absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none bg-gradient-to-r ${
                isError ? 'from-red-400 to-orange-400' : 'from-brand-orange to-brand-pink'
            }`} />
            
            {/* Left Accent Bar */}
            <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                 isError 
                 ? 'bg-red-500 shadow-lg shadow-red-500/30' 
                 : 'bg-gradient-to-b from-brand-orange to-brand-pink shadow-lg shadow-orange-500/30'
            }`} />

            <div className="flex-1 z-10">
                <div className="flex items-center gap-2 mb-0.5">
                    {type === 'success' && <Sparkles size={14} className="text-brand-orange" />}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isError ? 'text-red-500' : 'text-slate-400 dark:text-slate-400'}`}>
                        {type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : 'Info'}
                    </span>
                </div>
                <p className="font-serif text-slate-800 dark:text-slate-100 font-medium leading-snug">{message}</p>
            </div>
            
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10">
                <X size={16} className="text-slate-400 dark:text-slate-300" />
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: Notification[];
    removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-24 right-4 z-[110] flex flex-col gap-3 pointer-events-none p-4">
            <div className="pointer-events-auto flex flex-col gap-3">
                {toasts.map(toast => (
                    <Toast key={toast.id} type={toast.type} message={toast.message} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </div>
    );
};
