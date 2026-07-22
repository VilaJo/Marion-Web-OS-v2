import React, { useState } from 'react';
import { Theme, Notification } from '../types';
import { Tooltip } from './Shared';
import { NotificationCenterPanel } from './NotificationSystem';
import {
    LayoutGrid,
    Bell,
    Settings,
    Sun,
    Moon,
    Sparkles,
    HelpCircle,
    Wand2,
    Tent
} from 'lucide-react';

interface HeaderProps {
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    notifications: Notification[];
    onMarkRead: (id: string) => void;
    onDelete: (id: string) => void;
    onClearAll: () => void;
    onOpenBriefing: () => void;
    onOpenMediaWorkshop: () => void;
    onOpenFocusMode: () => void;
    onOpenSettings: () => void;
    onOpenGuide: () => void;
    onUnicornClick: () => void;
    onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    theme,
    onThemeChange,
    notifications,
    onMarkRead,
    onDelete,
    onClearAll,
    onOpenBriefing,
    onOpenMediaWorkshop,
    onOpenFocusMode,
    onOpenSettings,
    onOpenGuide,
    onUnicornClick,
    onNavigateHome
}) => {
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [showNotifCenter, setShowNotifCenter] = useState(false);

    return (
        <>
            {/* Backdrop for dropdowns */}
            {(showThemeMenu || showNotifCenter) && (
                <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => { setShowThemeMenu(false); setShowNotifCenter(false); }}
                ></div>
            )}

            <header className={`flex flex-col md:flex-row justify-between items-center mb-10 max-w-[1400px] mx-auto gap-4 relative ${showThemeMenu || showNotifCenter ? 'z-50' : 'z-20'}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div 
                        onClick={onNavigateHome}
                        className="relative group cursor-pointer hover:scale-105 transition-transform duration-500"
                    >
                        <div className="w-16 h-16 rounded-full bg-marion-gradient shadow-[0_10px_30px_-5px_rgba(74,114,196,0.45)] flex items-center justify-center relative overflow-hidden">
                            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-white/20 rounded-full blur-sm"></div>
                            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-600/10 rounded-full blur-sm"></div>
                            <span className="font-serif text-3xl text-white italic pr-0.5 drop-shadow-md">M</span>
                        </div>
                    </div>
                    <div className="flex items-center" id="header-title">
                        <div>
                            <h1 className="font-serif text-4xl text-slate-800 dark:text-white tracking-tight">Eonora Tech OS</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Bon retour, Marion.</p>
                        </div>
                    </div>
                </div>

                <div id="header-tools" className="flex items-center gap-3 bg-white/60 dark:bg-slate-800/60 p-2 rounded-full border border-white/50 dark:border-white/10 shadow-sm backdrop-blur-md relative">
                    
                    {/* Unicorn */}
                    {theme === 'unicorn' && (
                        <div className="relative w-14 h-14 flex items-center justify-center -mr-2 z-10">
                            <img 
                                src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Unicorn.png" 
                                alt="Unicorn AI" 
                                className="w-12 h-12 cursor-pointer filter drop-shadow-lg transition-transform hover:scale-110"
                                onClick={onUnicornClick}
                            />
                        </div>
                    )}

                    <Tooltip content="Briefing Matinal">
                        <button onClick={onOpenBriefing} className="flex px-4 py-2.5 bg-eonora-gradient text-white rounded-full text-xs font-bold uppercase tracking-wider hover:scale-105 transition-all duration-300 items-center gap-2 shadow-lg shadow-orange-200/50 dark:shadow-none">
                            <LayoutGrid size={14} />
                            <span>Briefing</span>
                        </button>
                    </Tooltip>

                    <Tooltip content="AI Tool">
                        <button 
                            id="media-btn"
                            onClick={onOpenMediaWorkshop}
                            className="flex p-3 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        >
                            <Wand2 size={20} className="text-purple-500" />
                        </button>
                    </Tooltip>

                    <Tooltip content="Mode Focus">
                        <button 
                            onClick={onOpenFocusMode}
                            className="flex p-3 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        >
                            <Tent size={20} className="text-blue-500" />
                        </button>
                    </Tooltip>
                    
                    <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block"></div>

                    <div className="relative">
                        <Tooltip content="Changer de thème">
                            <button 
                                onClick={() => { setShowThemeMenu(!showThemeMenu); setShowNotifCenter(false); }}
                                className="p-3 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            >
                                {theme === 'light' ? <Sun size={20} className="text-amber-400" /> : 
                                theme === 'dark' ? <Moon size={20} className="text-brand-orange" /> :
                                <Sparkles size={20} className="text-pink-400" />}
                            </button>
                        </Tooltip>
                        {showThemeMenu && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={() => { onThemeChange('light'); setShowThemeMenu(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mb-1">
                                    <Sun size={18} className="text-brand-orange" /> <span className="text-sm font-bold dark:text-white">Pro</span>
                                </button>
                                <button onClick={() => { onThemeChange('dark'); setShowThemeMenu(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mb-1">
                                    <Moon size={18} className="text-slate-400" /> <span className="text-sm font-bold dark:text-white">Espace</span>
                                </button>
                                <button onClick={() => { onThemeChange('unicorn'); setShowThemeMenu(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    <Sparkles size={18} className="text-pink-500" /> <span className="text-sm font-bold dark:text-white">Licorne</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <Tooltip content="Paramètres">
                        <button 
                            onClick={onOpenSettings}
                            className="p-3 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        >
                            <Settings size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    </Tooltip>
                    
                    <Tooltip content="Aide & Support">
                        <button onClick={onOpenGuide} className="p-3 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors">
                            <HelpCircle size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    </Tooltip>

                    <div className="relative">
                        <Tooltip content="Notifications">
                            <button 
                                onClick={() => { setShowNotifCenter(!showNotifCenter); setShowThemeMenu(false); }}
                                className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg relative"
                            >
                                <Bell size={20} />
                                {notifications.some(n => !n.read) && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                                )}
                            </button>
                        </Tooltip>
                        {showNotifCenter && (
                            <NotificationCenterPanel 
                                notifications={notifications} 
                                onMarkRead={onMarkRead} 
                                onDelete={onDelete}
                                onClearAll={onClearAll}
                            />
                        )}
                    </div>
                    
                    <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                </div>
            </header>
        </>
    );
};
