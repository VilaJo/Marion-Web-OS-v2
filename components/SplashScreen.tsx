import React from 'react';

export interface SplashScreenProps {
    visible: boolean;
    loadingText: string; // Receive text as prop instead of managing it internally
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ visible, loadingText }) => {
    // No internal state or effects anymore
    
    return (
        <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FDFCF8] dark:bg-[#0B0F19] transition-opacity duration-700 ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            
            <div className="relative flex flex-col items-center justify-center p-10">
                {/* Central Animation Container */}
                <div className="relative w-48 h-48 flex items-center justify-center mb-10">
                    
                    {/* 1. Ring Track */}
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>

                    {/* 2. Spinner (CSS based) */}
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-orange border-r-purple-500 animate-spin"></div>
                    
                    {/* 3. Reverse Inner Spinner */}
                    <div className="absolute inset-4 rounded-full border-4 border-transparent border-b-brand-orange border-l-pink-400 animate-[spin_3s_linear_infinite_reverse]"></div>

                    {/* 4. Logo */}
                    <div className="w-24 h-24 relative z-10 animate-pulse">
                        <img 
                            src="/logo-eonora.png" 
                            alt="Loading..." 
                            className="w-full h-full object-contain drop-shadow-xl" 
                        />
                    </div>
                </div>

                {/* Typography */}
                <h1 className="font-sans font-semibold text-3xl text-slate-800 dark:text-white mb-4 tracking-tight">
                    Eonora Tech OS
                </h1>

                {/* Message */}
                <div className="h-6">
                    <p key={loadingText} className="font-medium text-sm text-slate-500 dark:text-slate-400 animate-in slide-in-from-bottom-2 fade-in duration-300">
                        {loadingText}
                    </p>
                </div>
            </div>
        </div>
    );
};