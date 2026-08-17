/**
 * Clair / Nuit — bouton toujours visible.
 */

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '../stores';

function applyHtmlTheme(theme: 'light' | 'dark' | 'unicorn') {
    const root = document.documentElement;
    root.classList.remove('dark', 'unicorn');
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'unicorn') root.classList.add('unicorn');
}

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const theme = useUIStore((s) => s.theme);
    const setTheme = useUIStore((s) => s.setTheme);
    const isDark = theme === 'dark';

    const goLight = () => {
        setTheme('light');
        applyHtmlTheme('light');
    };
    const goDark = () => {
        setTheme('dark');
        applyHtmlTheme('dark');
    };

    if (compact) {
        return (
            <button
                type="button"
                onClick={() => (isDark ? goLight() : goDark())}
                className="p-2.5 rounded-full border border-[#F0D8CC] dark:border-[#262626] bg-white dark:bg-[#151516] text-slate-600 dark:text-slate-200 hover:scale-110 transition-transform shadow-[0_6px_14px_rgba(176,80,112,0.18)] dark:shadow-none"
                aria-label={isDark ? 'Passer en thème clair' : 'Passer en thème nuit'}
                title={isDark ? 'Thème clair' : 'Thème nuit'}
            >
                {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-[#4A72C4]" />}
            </button>
        );
    }

    return (
        <div
            className="flex items-center p-0.5 rounded-full border border-[#F0D8CC] dark:border-[#262626] bg-[#FFF3EA] dark:bg-[#0d1329] shadow-[0_6px_16px_rgba(176,80,112,0.12)] dark:shadow-none"
            role="group"
            aria-label="Thème"
        >
            <button
                type="button"
                onClick={goLight}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                    !isDark
                        ? 'bg-white text-[#B05070] shadow-[0_4px_10px_rgba(176,80,112,0.18)]'
                        : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-pressed={!isDark}
            >
                <Sun size={14} className={!isDark ? 'text-amber-400' : ''} />
                Clair
            </button>
            <button
                type="button"
                onClick={goDark}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                    isDark
                        ? 'bg-[#151516] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                }`}
                aria-pressed={isDark}
            >
                <Moon size={14} className={isDark ? 'text-[#A7C1A3]' : ''} />
                Nuit
            </button>
        </div>
    );
};

export { applyHtmlTheme };
