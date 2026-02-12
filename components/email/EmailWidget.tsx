/**
 * EmailWidget - Main email client container.
 * Renders login if not connected, otherwise a 3-column layout:
 *   Sidebar | List | Reader/Compose
 *
 * Supports fullscreen mode via the `fullscreen` prop (used on /emails page).
 */

import React, { useState } from 'react';
import { Mail, Lock, AtSign, RefreshCw, AlertCircle } from 'lucide-react';
import { useEmailWidget, type EmailWidgetProps } from './useEmailWidget';
import { EmailSidebar } from './EmailSidebar';
import { EmailList } from './EmailList';
import { EmailReader } from './EmailReader';
import { EmailCompose } from './EmailCompose';

export const EmailWidget: React.FC<EmailWidgetProps> = (props) => {
    const state = useEmailWidget(props);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // ---- Login screen ----
    if (!state.isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl">
                <div className="w-full max-w-sm">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none text-blue-600 animate-in zoom-in duration-500">
                            <Mail size={40} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-center mb-2 dark:text-white text-slate-800">Email Client</h3>
                    <p className="text-center text-slate-500 text-sm mb-8 leading-relaxed">
                        Connectez votre compte Infomaniak pour accéder à vos emails.
                    </p>

                    <form onSubmit={state.handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <div className="relative">
                                <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    value={state.emailInput}
                                    onChange={(e) => state.setEmailInput(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                    placeholder="marion@agence.ch"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="password"
                                    value={state.passwordInput}
                                    onChange={(e) => state.setPasswordInput(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {state.loginError && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={16} /> {state.loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={state.connectMutation.isPending}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-70 transform active:scale-95"
                        >
                            {state.connectMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : "Connexion Infomaniak"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ---- Main 3-column layout ----
    return (
        <div className={`h-full flex bg-slate-50 dark:bg-slate-900/30 overflow-hidden ${state.fullscreen ? 'rounded-none' : 'rounded-3xl'}`}>
            {/* Sidebar */}
            <EmailSidebar
                state={state}
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Email list */}
            <div className={`${state.view === 'list' ? 'flex' : 'hidden lg:flex'} flex-col border-r border-slate-200 dark:border-slate-700/50 ${sidebarCollapsed ? 'w-full lg:w-[340px]' : 'w-full lg:w-[320px]'} shrink-0 bg-white dark:bg-slate-800/50`}>
                <EmailList state={state} />
            </div>

            {/* Reader / Compose pane */}
            <div className={`${state.view !== 'list' ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0 bg-white dark:bg-slate-800`}>
                {state.view === 'compose' ? (
                    <EmailCompose state={state} />
                ) : state.view === 'read' && state.selectedEmail ? (
                    <EmailReader state={state} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-600">
                        <div className="text-center">
                            <Mail size={48} className="mx-auto mb-4 opacity-40" />
                            <p className="text-sm font-medium">Sélectionnez un email</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailWidget;
