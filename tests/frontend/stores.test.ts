/**
 * Frontend tests for Zustand stores
 * Tests critical store logic without needing a browser
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch, sessionStorage, localStorage, and window before importing stores
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as any;

// Mock sessionStorage
const sessionStore: Record<string, string> = {};
globalThis.sessionStorage = {
    getItem: (key: string) => sessionStore[key] || null,
    setItem: (key: string, val: string) => { sessionStore[key] = val; },
    removeItem: (key: string) => { delete sessionStore[key]; },
    clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); },
    length: 0,
    key: () => null,
} as any;

// Mock localStorage
const localStore: Record<string, string> = {};
globalThis.localStorage = {
    getItem: (key: string) => localStore[key] || null,
    setItem: (key: string, val: string) => { localStore[key] = val; },
    removeItem: (key: string) => { delete localStore[key]; },
    clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); },
    length: 0,
    key: () => null,
} as any;

// Mock window and window.location
const mockReload = vi.fn();
(globalThis as any).window = {
    location: { reload: mockReload },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};
Object.defineProperty(globalThis, 'location', {
    value: { reload: mockReload },
    writable: true,
});

// Mock document for branding tests
globalThis.document = {
    ...globalThis.document,
    title: '',
    documentElement: { style: { setProperty: vi.fn() } },
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => ({ rel: '', href: '' })),
    head: { appendChild: vi.fn() },
} as any;


// ============================================================================
// AUTH STORE
// ============================================================================

describe('useAuthStore', () => {
    let useAuthStore: typeof import('../../stores/useAuthStore').useAuthStore;

    beforeEach(async () => {
        vi.resetModules();
        sessionStorage.clear();
        mockFetch.mockReset();
        const mod = await import('../../stores/useAuthStore');
        useAuthStore = mod.useAuthStore;
    });

    it('initial state: not authenticated', () => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.authChecked).toBe(false);
        expect(state.isConfigured).toBeNull();
    });

    it('checkAuth: sets state from server response', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ configured: true, authenticated: true }),
        });

        await useAuthStore.getState().checkAuth();
        const state = useAuthStore.getState();
        expect(state.isConfigured).toBe(true);
        expect(state.isAuthenticated).toBe(true);
        expect(state.authChecked).toBe(true);
        expect(state.isBackendDown).toBe(false);
    });

    it('checkAuth: marks backend down on fetch failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await useAuthStore.getState().checkAuth();
        const state = useAuthStore.getState();
        expect(state.isBackendDown).toBe(true);
        expect(state.authChecked).toBe(true);
    });

    it('login: stores token on success', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ success: true, token: 'test_token_123' }),
        });

        const result = await useAuthStore.getState().login('password');
        expect(result.success).toBe(true);
        expect(sessionStorage.getItem('marion_token')).toBe('test_token_123');
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('login: returns error on failure', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ success: false, error: 'Wrong password' }),
        });

        const result = await useAuthStore.getState().login('wrong');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Wrong password');
    });

    it('setup: stores token on success', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ success: true, token: 'setup_token_456' }),
        });

        const result = await useAuthStore.getState().setup('newpassword');
        expect(result.success).toBe(true);
        expect(result.token).toBe('setup_token_456');
        expect(useAuthStore.getState().isConfigured).toBe(true);
    });

    it('logout: clears token', () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        sessionStorage.setItem('marion_token', 'existing_token');

        useAuthStore.getState().logout();
        expect(sessionStorage.getItem('marion_token')).toBeNull();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
});


// ============================================================================
// UI STORE
// ============================================================================

describe('useUIStore', () => {
    let useUIStore: typeof import('../../stores/useUIStore').useUIStore;

    beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();
        const mod = await import('../../stores/useUIStore');
        useUIStore = mod.useUIStore;
    });

    it('initial theme: defaults to light', () => {
        expect(useUIStore.getState().theme).toBe('light');
    });

    it('setTheme: updates theme and persists to localStorage', () => {
        useUIStore.getState().setTheme('dark');
        expect(useUIStore.getState().theme).toBe('dark');
        expect(localStorage.getItem('marion_theme')).toBe('dark');
    });

    it('cycleTheme: light -> dark -> unicorn -> light', () => {
        useUIStore.getState().setTheme('light');
        useUIStore.getState().cycleTheme();
        expect(useUIStore.getState().theme).toBe('dark');

        useUIStore.getState().cycleTheme();
        expect(useUIStore.getState().theme).toBe('unicorn');

        useUIStore.getState().cycleTheme();
        expect(useUIStore.getState().theme).toBe('light');
    });

    it('setAccentColor: persists to localStorage', () => {
        useUIStore.getState().setAccentColor('blue');
        expect(useUIStore.getState().accentColor).toBe('blue');
        expect(localStorage.getItem('marion_accent')).toBe('blue');
    });

    it('setCurrency: persists to localStorage', () => {
        useUIStore.getState().setCurrency('EUR');
        expect(useUIStore.getState().currency).toBe('EUR');
        expect(localStorage.getItem('marion_currency')).toBe('EUR');
    });

    it('modal toggles work correctly', () => {
        expect(useUIStore.getState().showChat).toBe(false);
        useUIStore.getState().setShowChat(true);
        expect(useUIStore.getState().showChat).toBe(true);
        useUIStore.getState().setShowChat(false);
        expect(useUIStore.getState().showChat).toBe(false);
    });

    it('toggleModal: toggles by name', () => {
        expect(useUIStore.getState().showNotes).toBe(false);
        useUIStore.getState().toggleModal('Notes');
        expect(useUIStore.getState().showNotes).toBe(true);
        useUIStore.getState().toggleModal('Notes');
        expect(useUIStore.getState().showNotes).toBe(false);
    });

    it('setSignatureSettings: persists to localStorage', () => {
        const sig = { mode: 'custom', name: 'Test', role: 'Dev', imageUrl: '', html: '<b>Hi</b>' };
        useUIStore.getState().setSignatureSettings(sig);
        expect(useUIStore.getState().signatureSettings).toEqual(sig);
        const stored = JSON.parse(localStorage.getItem('marion_signature') || '{}');
        expect(stored.name).toBe('Test');
    });
});


// ============================================================================
// WORKSPACE STORE
// ============================================================================

describe('useWorkspaceStore', () => {
    let useWorkspaceStore: typeof import('../../stores/useWorkspaceStore').useWorkspaceStore;
    let DEFAULT_BRANDING: typeof import('../../stores/useWorkspaceStore').DEFAULT_BRANDING;

    beforeEach(async () => {
        vi.resetModules();
        mockFetch.mockReset();
        const mod = await import('../../stores/useWorkspaceStore');
        useWorkspaceStore = mod.useWorkspaceStore;
        DEFAULT_BRANDING = mod.DEFAULT_BRANDING;
    });

    it('initial state: no workspace loaded', () => {
        const state = useWorkspaceStore.getState();
        expect(state.currentWorkspace).toBeNull();
        expect(state.workspaces).toEqual([]);
        expect(state.branding.appName).toBe('Marion Web OS');
    });

    it('loadWorkspace: loads and applies branding', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                id: 1,
                name: 'My Space',
                branding: { appName: 'Studio Pro', primaryColor: '#3b82f6' },
                settings: { currency: 'EUR' },
            }),
        });

        await useWorkspaceStore.getState().loadWorkspace();
        const state = useWorkspaceStore.getState();
        expect(state.currentWorkspace?.name).toBe('My Space');
        expect(state.branding.appName).toBe('Studio Pro');
        expect(state.branding.primaryColor).toBe('#3b82f6');
        // Defaults should be preserved for unset keys
        expect(state.branding.enabledModules).toEqual(DEFAULT_BRANDING.enabledModules);
    });

    it('isModuleEnabled: checks enabled modules', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                id: 1,
                name: 'Test',
                branding: { enabledModules: ['projects', 'invoices'] },
                settings: {},
            }),
        });

        await useWorkspaceStore.getState().loadWorkspace();
        expect(useWorkspaceStore.getState().isModuleEnabled('projects')).toBe(true);
        expect(useWorkspaceStore.getState().isModuleEnabled('calendar')).toBe(false);
    });

    it('reset: clears all state', () => {
        useWorkspaceStore.setState({
            currentWorkspace: { id: 1, name: 'test' } as any,
            workspaces: [{ id: 1 } as any],
        });

        useWorkspaceStore.getState().reset();
        const state = useWorkspaceStore.getState();
        expect(state.currentWorkspace).toBeNull();
        expect(state.workspaces).toEqual([]);
    });
});
