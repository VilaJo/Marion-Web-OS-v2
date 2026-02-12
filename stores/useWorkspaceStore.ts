/**
 * Workspace Store - Multi-workspace & branding state management
 *
 * Manages:
 * - Current workspace selection
 * - List of available workspaces
 * - Branding / white-label configuration
 * - Workspace settings
 */

import { create } from 'zustand';
import { apiFetch, apiGet, apiPost, apiPut } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceBranding {
    appName: string;
    primaryColor: string;
    logoUrl: string;
    faviconUrl: string;
    companyName: string;
    tagline: string;
    footerText: string;
    enabledModules: string[];
    language: string;
}

export interface WorkspaceMember {
    id: number;
    email: string;
    display_name: string | null;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    created_at: string;
}

export interface Workspace {
    id: number;
    name: string;
    owner_id: number;
    settings: Record<string, any>;
    branding: WorkspaceBranding;
    user_role?: string;
    created_at: string;
    updated_at: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_BRANDING: WorkspaceBranding = {
    appName: 'Marion Web OS',
    primaryColor: '#f97316',
    logoUrl: '',
    faviconUrl: '',
    companyName: '',
    tagline: '',
    footerText: '',
    enabledModules: ['projects', 'invoices', 'calendar', 'notes', 'expenses', 'ai', 'email', 'time_tracking'],
    language: 'fr',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WorkspaceState {
    // Data
    currentWorkspace: Workspace | null;
    workspaces: Workspace[];
    members: WorkspaceMember[];
    branding: WorkspaceBranding;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadWorkspace: () => Promise<void>;
    loadWorkspaces: () => Promise<void>;
    switchWorkspace: (workspaceId: number) => Promise<void>;
    createWorkspace: (name: string) => Promise<Workspace | null>;
    updateBranding: (branding: Partial<WorkspaceBranding>) => Promise<void>;
    updateSettings: (settings: Record<string, any>) => Promise<void>;
    loadMembers: () => Promise<void>;
    addMember: (email: string, role?: string) => Promise<{ success: boolean; error?: string }>;
    removeMember: (memberId: number) => Promise<void>;
    updateMemberRole: (memberId: number, role: string) => Promise<void>;
    isModuleEnabled: (module: string) => boolean;
    reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    currentWorkspace: null,
    workspaces: [],
    members: [],
    branding: { ...DEFAULT_BRANDING },
    isLoading: false,
    error: null,

    loadWorkspace: async () => {
        try {
            set({ isLoading: true, error: null });
            const res = await apiFetch('/api/v1/workspace');
            if (!res.ok) {
                set({ isLoading: false });
                return;
            }
            const data = await res.json();
            const branding = { ...DEFAULT_BRANDING, ...(data.branding || {}) };
            set({
                currentWorkspace: data,
                branding,
                isLoading: false,
            });
            // Apply branding to document
            _applyBranding(branding);
        } catch {
            set({ isLoading: false, error: 'Failed to load workspace' });
        }
    },

    loadWorkspaces: async () => {
        try {
            const res = await apiFetch('/api/v1/workspaces');
            if (!res.ok) return;
            const data = await res.json();
            set({ workspaces: data.workspaces || [] });
        } catch {
            // Silently fail - user may only have one workspace
        }
    },

    switchWorkspace: async (workspaceId: number) => {
        // Store the selected workspace ID for session persistence
        sessionStorage.setItem('marion_workspace_id', String(workspaceId));
        // Reload to apply the new workspace context
        window.location.reload();
    },

    createWorkspace: async (name: string) => {
        try {
            const data = await apiPost<{ success: boolean; workspace: Workspace }>('/api/v1/workspace', { name });
            if (data.success && data.workspace) {
                set((state) => ({ workspaces: [...state.workspaces, data.workspace] }));
                return data.workspace;
            }
            return null;
        } catch {
            return null;
        }
    },

    updateBranding: async (brandingUpdate: Partial<WorkspaceBranding>) => {
        try {
            const res = await apiFetch('/api/v1/workspace/branding', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(brandingUpdate),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                const branding = { ...DEFAULT_BRANDING, ...data.branding };
                set({ branding });
                _applyBranding(branding);
            }
        } catch {
            // Silently fail
        }
    },

    updateSettings: async (settings: Record<string, any>) => {
        try {
            const data = await apiPut<{ success: boolean; settings: Record<string, any> }>(
                '/api/v1/workspace/settings',
                settings
            );
            if (data.success) {
                set((state) => ({
                    currentWorkspace: state.currentWorkspace
                        ? { ...state.currentWorkspace, settings: data.settings }
                        : null,
                }));
            }
        } catch {
            // Silently fail
        }
    },

    loadMembers: async () => {
        try {
            const res = await apiFetch('/api/v1/workspace/members');
            if (!res.ok) return;
            const data = await res.json();
            set({ members: data.members || [] });
        } catch {
            // Silently fail
        }
    },

    addMember: async (email: string, role: string = 'member') => {
        try {
            const res = await apiFetch('/api/v1/workspace/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // Reload members list
                get().loadMembers();
                return { success: true };
            }
            return { success: false, error: data.error || 'Erreur inconnue' };
        } catch {
            return { success: false, error: 'Erreur de connexion' };
        }
    },

    removeMember: async (memberId: number) => {
        try {
            const res = await apiFetch(`/api/v1/workspace/members/${memberId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                set((state) => ({ members: state.members.filter((m) => m.id !== memberId) }));
            }
        } catch {
            // Silently fail
        }
    },

    updateMemberRole: async (memberId: number, role: string) => {
        try {
            await apiFetch(`/api/v1/workspace/members/${memberId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            // Reload members
            get().loadMembers();
        } catch {
            // Silently fail
        }
    },

    isModuleEnabled: (module: string) => {
        const { branding } = get();
        return branding.enabledModules.includes(module);
    },

    reset: () => {
        set({
            currentWorkspace: null,
            workspaces: [],
            members: [],
            branding: { ...DEFAULT_BRANDING },
            isLoading: false,
            error: null,
        });
    },
}));


// ---------------------------------------------------------------------------
// Helpers - Apply branding to the DOM
// ---------------------------------------------------------------------------

function _applyBranding(branding: WorkspaceBranding) {
    // Apply primary colour as CSS custom property
    if (branding.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    }

    // Update document title
    if (branding.appName) {
        document.title = branding.appName;
    }

    // Update favicon if provided
    if (branding.faviconUrl) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = branding.faviconUrl;
    }
}
