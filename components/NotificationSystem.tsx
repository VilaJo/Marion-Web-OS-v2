import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertCircle, Info, X, Bot, DollarSign, Calendar, ArrowRight, Trash2, Check } from 'lucide-react';
import { Notification, NotificationType } from '../types';
// @ts-ignore
import franckAvatar from '../assets/franck-avatar.png';

// --- Config Visuelle ---
const TYPE_STYLES: Record<NotificationType, { icon: any, bg: string, border: string, text: string, iconColor: string }> = {
    success: { 
        icon: CheckCircle, 
        bg: 'bg-green-50 dark:bg-green-900/20', 
        border: 'border-green-200 dark:border-green-800', 
        text: 'text-green-800 dark:text-green-200',
        iconColor: 'text-green-500'
    },
    error: { 
        icon: AlertCircle, 
        bg: 'bg-red-50 dark:bg-red-900/20', 
        border: 'border-red-200 dark:border-red-800', 
        text: 'text-red-800 dark:text-red-200',
        iconColor: 'text-red-500'
    },
    warning: { 
        icon: AlertCircle, 
        bg: 'bg-amber-50 dark:bg-amber-900/20', 
        border: 'border-amber-200 dark:border-amber-800', 
        text: 'text-amber-800 dark:text-amber-200',
        iconColor: 'text-amber-500'
    },
    info: { 
        icon: Info, 
        bg: 'bg-blue-50 dark:bg-blue-900/20', 
        border: 'border-blue-200 dark:border-blue-800', 
        text: 'text-blue-800 dark:text-blue-200',
        iconColor: 'text-blue-500'
    },
    ai: { 
        icon: franckAvatar,
        bg: 'bg-purple-50 dark:bg-purple-900/20', 
        border: 'border-purple-200 dark:border-purple-800', 
        text: 'text-purple-800 dark:text-purple-200',
        iconColor: 'text-purple-500'
    },
    finance: { 
        icon: DollarSign, 
        bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
        border: 'border-emerald-200 dark:border-emerald-800', 
        text: 'text-emerald-800 dark:text-emerald-200',
        iconColor: 'text-emerald-600'
    },
    deadline: { 
        icon: Calendar, 
        bg: 'bg-orange-50 dark:bg-orange-900/20', 
        border: 'border-orange-200 dark:border-orange-800', 
        text: 'text-orange-800 dark:text-orange-200',
        iconColor: 'text-brand-orange'
    }
};

// --- Components ---

export const ToastItem: React.FC<{ notification: Notification, onClose: (id: string) => void, onNavigate?: (link: string) => void }> = ({ notification, onClose, onNavigate }) => {
    const style = TYPE_STYLES[notification.type];
    const IconComponent = style.icon; 
    const isClickable = !!notification.link;

    const handleClick = () => {
        if (!notification.link) return;
        // External URL → open in a new tab (e.g. GitHub release pages)
        if (/^https?:\/\//i.test(notification.link)) {
            window.open(notification.link, '_blank', 'noopener,noreferrer');
            onClose(notification.id);
            return;
        }
        // Internal route
        if (onNavigate) {
            onNavigate(notification.link);
            onClose(notification.id);
        }
    };

    return (
        <div 
            onClick={isClickable ? handleClick : undefined}
            className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-xl bg-white/90 dark:bg-slate-800/90 animate-in slide-in-from-right-full duration-500 border-l-4 ${style.border.replace('border', 'border-l')} ${isClickable ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
        >
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        {notification.type === 'ai' ? (
                            <img src={IconComponent} alt="Franck" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                            <IconComponent className={`h-6 w-6 ${style.iconColor}`} aria-hidden="true" />
                        )}
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-serif">{notification.title}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{notification.message}</p>
                        {notification.action && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); notification.action?.onClick(); onClose(notification.id); }}
                                    className={`inline-flex items-center rounded-md bg-white dark:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold ${style.iconColor} shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600`}
                                >
                                    {notification.action.label} <ArrowRight size={12} className="ml-1"/>
                                </button>
                            </div>
                        )}
                        {isClickable && !notification.action && (
                            <div className="mt-1.5 text-[11px] font-medium text-brand-orange flex items-center gap-1">
                                Voir <ArrowRight size={10} />
                            </div>
                        )}
                    </div>
                    <div className="ml-4 flex flex-shrink-0">
                        <button
                            type="button"
                            className="inline-flex rounded-md bg-transparent text-slate-400 hover:text-slate-500 focus:outline-none"
                            onClick={(e) => { e.stopPropagation(); onClose(notification.id); }}
                        >
                            <span className="sr-only">Close</span>
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const NotificationCenterPanel: React.FC<{ 
    notifications: Notification[], 
    onMarkRead: (id: string) => void, 
    onDelete: (id: string) => void,
    onClearAll: () => void,
    onNavigate?: (link: string) => void
}> = ({ notifications, onMarkRead, onDelete, onClearAll, onNavigate }) => {
    
    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);

    const handleItemClick = (n: Notification) => {
        if (!n.read) onMarkRead(n.id);
        if (!n.link) return;
        if (/^https?:\/\//i.test(n.link)) {
            window.open(n.link, '_blank', 'noopener,noreferrer');
            return;
        }
        if (onNavigate) onNavigate(n.link);
    };

    const renderList = (list: Notification[]) => (
        <div className="space-y-2">
            {list.map(n => {
                const style = TYPE_STYLES[n.type];
                const IconComponent = style.icon;
                const isClickable = !!n.link;

                return (
                    <div 
                        key={n.id} 
                        onClick={() => handleItemClick(n)}
                        className={`relative group p-4 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 ${!n.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} ${isClickable ? 'cursor-pointer' : ''}`}
                    >
                        <div className="flex gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg} ${n.type !== 'ai' ? style.iconColor : ''}`}>
                                {n.type === 'ai' ? (
                                    <img src={IconComponent} alt="Franck" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                    <IconComponent size={18} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className={`text-sm font-bold ${n.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                                        {n.title}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                        {n.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                                    {n.message}
                                </p>
                                {n.action && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); n.action?.onClick(); onMarkRead(n.id); }}
                                        className="mt-2 text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
                                    >
                                        {n.action.label} <ArrowRight size={10} />
                                    </button>
                                )}
                                {isClickable && !n.action && (
                                    <div className="mt-1.5 text-[11px] font-medium text-brand-orange flex items-center gap-1">
                                        Voir <ArrowRight size={10} />
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Hover Actions */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1">
                            {!n.read && (
                                <button onClick={(e) => {e.stopPropagation(); onMarkRead(n.id);}} className="p-1 text-slate-400 hover:text-blue-500 rounded" title="Marquer comme lu">
                                    <Check size={14} />
                                </button>
                            )}
                            <button onClick={(e) => {e.stopPropagation(); onDelete(n.id);}} className="p-1 text-slate-400 hover:text-red-500 rounded" title="Supprimer">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="absolute top-full right-0 mt-4 w-96 max-h-[600px] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 origin-top-right animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <span className="font-serif text-lg font-bold text-slate-800 dark:text-white">Notifications</span>
                    {unread.length > 0 && (
                        <span className="bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-orange-200">
                            {unread.length} new
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {unread.length > 0 && (
                        <button onClick={() => notifications.forEach(n => !n.read && onMarkRead(n.id))} className="p-1.5 text-slate-400 hover:text-brand-orange transition-colors rounded-full hover:bg-orange-50 dark:hover:bg-slate-700" title="Tout marquer comme lu">
                            <Check size={16} />
                        </button>
                    )}
                    <button onClick={onClearAll} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-slate-700" title="Tout effacer">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50 scrollbar-hide">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Bell size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">Tout est calme par ici...</p>
                    </div>
                ) : (
                    <>
                        {unread.length > 0 && (
                            <div className="mb-6">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Nouveau</h5>
                                {renderList(unread)}
                            </div>
                        )}
                        {read.length > 0 && (
                            <div className="opacity-80 grayscale-[0.3]">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Historique</h5>
                                {renderList(read)}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
