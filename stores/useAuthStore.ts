/**
 * Auth Store - Authentication state management
 */

import { create } from 'zustand';
import { apiFetch } from '../services/api';

interface AuthState {
    isAuthenticated: boolean;
    authChecked: boolean;
    isConfigured: boolean | null;
    isBackendDown: boolean;
    isLoading: boolean;
    
    // Actions
    checkAuth: () => Promise<void>;
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    setup: (password: string) => Promise<{ success: boolean; token?: string; error?: string }>;
    logout: () => void;
    setIsConfigured: (v: boolean | null) => void;
    setIsBackendDown: (v: boolean) => void;
    setIsLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: false,
    authChecked: false,
    isConfigured: null,
    isBackendDown: false,
    isLoading: true,

    checkAuth: async () => {
        try {
            const res = await fetch('/api/v1/auth/check', {
                headers: {
                    'X-Marion-Token': sessionStorage.getItem('marion_token') || ''
                }
            });
            const data = await res.json();
            
            set({
                isConfigured: data.configured,
                isAuthenticated: data.authenticated,
                authChecked: true,
                isBackendDown: false,
            });
        } catch (e) {
            set({ isBackendDown: true, authChecked: true });
        }
    },

    login: async (password: string) => {
        try {
            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            
            if (data.success && data.token) {
                sessionStorage.setItem('marion_token', data.token);
                set({ isAuthenticated: true });
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (e) {
            return { success: false, error: 'Connection failed' };
        }
    },

    setup: async (password: string) => {
        try {
            const res = await fetch('/api/v1/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            
            if (data.success && data.token) {
                sessionStorage.setItem('marion_token', data.token);
                set({ isAuthenticated: true, isConfigured: true });
                return { success: true, token: data.token };
            }
            return { success: false, error: data.error };
        } catch (e) {
            return { success: false, error: 'Connection failed' };
        }
    },

    logout: () => {
        apiFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
        sessionStorage.removeItem('marion_token');
        set({ isAuthenticated: false });
        window.location.reload();
    },

    setIsConfigured: (v) => set({ isConfigured: v }),
    setIsBackendDown: (v) => set({ isBackendDown: v }),
    setIsLoading: (v) => set({ isLoading: v }),
}));
