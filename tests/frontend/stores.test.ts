/**
 * Frontend tests for Zustand stores
 * Tests critical store logic without needing a browser
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
// PROJECT STORE
// ============================================================================

describe('useProjectStore', () => {
    let useProjectStore: typeof import('../../stores/useProjectStore').useProjectStore;

    beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();
        const mod = await import('../../stores/useProjectStore');
        useProjectStore = mod.useProjectStore;
    });

    it('initial state: empty events and activities', () => {
        const state = useProjectStore.getState();
        expect(state.events).toEqual([]);
        expect(state.activities).toEqual([]);
        expect(state.filter).toBe('Tous');
        expect(state.searchQuery).toBe('');
    });

    it('addEvent: adds event and persists to localStorage', () => {
        const event = {
            id: 'ev-1', title: 'Test Meeting', date: '2026-03-15',
            startTime: '10:00', duration: 60, type: 'To do pro' as const,
        };
        useProjectStore.getState().addEvent(event);
        const state = useProjectStore.getState();
        expect(state.events).toHaveLength(1);
        expect(state.events[0].title).toBe('Test Meeting');

        const stored = JSON.parse(localStorage.getItem('marion_calendar_events') || '[]');
        expect(stored).toHaveLength(1);
    });

    it('updateEvent: updates existing event', () => {
        const event = {
            id: 'ev-1', title: 'Original', date: '2026-03-15',
            startTime: '10:00', duration: 60, type: 'To do pro' as const,
        };
        useProjectStore.getState().addEvent(event);
        useProjectStore.getState().updateEvent({ ...event, title: 'Updated' });

        expect(useProjectStore.getState().events[0].title).toBe('Updated');
    });

    it('deleteEvent: removes event', () => {
        const event = {
            id: 'ev-1', title: 'To Delete', date: '2026-03-15',
            startTime: '10:00', duration: 60, type: 'To do pro' as const,
        };
        useProjectStore.getState().addEvent(event);
        expect(useProjectStore.getState().events).toHaveLength(1);

        useProjectStore.getState().deleteEvent('ev-1');
        expect(useProjectStore.getState().events).toHaveLength(0);
    });

    it('addActivity: adds activity and persists', () => {
        useProjectStore.getState().addActivity('project_created', 'New Project', 'p1', 'Client X');
        const state = useProjectStore.getState();
        expect(state.activities).toHaveLength(1);
        expect(state.activities[0].title).toBe('New Project');
        expect(state.activities[0].type).toBe('project_created');

        const stored = JSON.parse(localStorage.getItem('marion_activities') || '[]');
        expect(stored).toHaveLength(1);
    });

    it('addActivity: limits to 100 activities', () => {
        for (let i = 0; i < 110; i++) {
            useProjectStore.getState().addActivity('project_created', `Activity ${i}`);
        }
        expect(useProjectStore.getState().activities.length).toBeLessThanOrEqual(100);
    });

    it('setFilter: updates filter state', () => {
        useProjectStore.getState().setFilter('En cours');
        expect(useProjectStore.getState().filter).toBe('En cours');
    });

    it('setSearchQuery: updates search state', () => {
        useProjectStore.getState().setSearchQuery('test');
        expect(useProjectStore.getState().searchQuery).toBe('test');
    });
});


// ============================================================================
// NOTIFICATION STORE
// ============================================================================

describe('useNotificationStore', () => {
    let useNotificationStore: typeof import('../../stores/useNotificationStore').useNotificationStore;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();
        const mod = await import('../../stores/useNotificationStore');
        useNotificationStore = mod.useNotificationStore;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initial state: empty notifications and toasts', () => {
        const state = useNotificationStore.getState();
        expect(state.notifications).toEqual([]);
        expect(state.toasts).toEqual([]);
    });

    it('addNotification: adds to both notifications and toasts', () => {
        useNotificationStore.getState().addNotification('Test', 'Hello', 'info');
        const state = useNotificationStore.getState();
        expect(state.notifications).toHaveLength(1);
        expect(state.toasts).toHaveLength(1);
        expect(state.notifications[0].title).toBe('Test');
        expect(state.notifications[0].read).toBe(false);
    });

    it('addNotification: auto-removes toast after 5s', () => {
        useNotificationStore.getState().addNotification('Toast Test', 'Auto remove');
        expect(useNotificationStore.getState().toasts).toHaveLength(1);

        vi.advanceTimersByTime(5100);
        expect(useNotificationStore.getState().toasts).toHaveLength(0);
        // Notification should remain
        expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it('addNotification: supports link parameter', () => {
        useNotificationStore.getState().addNotification('With Link', 'Click me', 'success', '/client/123');
        expect(useNotificationStore.getState().notifications[0].link).toBe('/client/123');
    });

    it('markAsRead: marks specific notification', () => {
        useNotificationStore.getState().addNotification('Read Me', 'Test');
        const id = useNotificationStore.getState().notifications[0].id;
        useNotificationStore.getState().markAsRead(id);
        expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    });

    it('markAllAsRead: marks all notifications', () => {
        useNotificationStore.getState().addNotification('One', 'Test');
        useNotificationStore.getState().addNotification('Two', 'Test');
        useNotificationStore.getState().markAllAsRead();
        const allRead = useNotificationStore.getState().notifications.every(n => n.read);
        expect(allRead).toBe(true);
    });

    it('removeNotification: removes from list', () => {
        useNotificationStore.getState().addNotification('Remove Me', 'Test');
        const id = useNotificationStore.getState().notifications[0].id;
        useNotificationStore.getState().removeNotification(id);
        expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it('clearAll: empties notification list', () => {
        useNotificationStore.getState().addNotification('One', 'Test');
        useNotificationStore.getState().addNotification('Two', 'Test');
        useNotificationStore.getState().clearAll();
        expect(useNotificationStore.getState().notifications).toEqual([]);
    });

    it('unreadCount: returns correct count', () => {
        useNotificationStore.getState().addNotification('A', 'Test');
        useNotificationStore.getState().addNotification('B', 'Test');
        expect(useNotificationStore.getState().unreadCount()).toBe(2);

        const id = useNotificationStore.getState().notifications[0].id;
        useNotificationStore.getState().markAsRead(id);
        expect(useNotificationStore.getState().unreadCount()).toBe(1);
    });

    it('notifications: limited to 50', () => {
        for (let i = 0; i < 60; i++) {
            useNotificationStore.getState().addNotification(`Notif ${i}`, 'Test');
        }
        expect(useNotificationStore.getState().notifications.length).toBeLessThanOrEqual(50);
    });
});


// ============================================================================
// OFFLINE STORE
// ============================================================================

describe('useOfflineStore', () => {
    let useOfflineStore: typeof import('../../stores/useOfflineStore').useOfflineStore;

    beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();
        // Mock navigator.onLine
        Object.defineProperty(globalThis, 'navigator', {
            value: { onLine: true },
            writable: true,
            configurable: true,
        });
        const mod = await import('../../stores/useOfflineStore');
        useOfflineStore = mod.useOfflineStore;
    });

    it('initial state: online', () => {
        expect(useOfflineStore.getState().isOnline).toBe(true);
    });

    it('setOnline: toggles online state', () => {
        useOfflineStore.getState().setOnline(false);
        expect(useOfflineStore.getState().isOnline).toBe(false);
        useOfflineStore.getState().setOnline(true);
        expect(useOfflineStore.getState().isOnline).toBe(true);
    });

    it('enqueue: adds mutation to queue', () => {
        useOfflineStore.getState().enqueue({
            url: '/api/v1/projects/save',
            method: 'POST',
            body: '{"test": true}',
            description: 'Save project',
        });
        expect(useOfflineStore.getState().queue).toHaveLength(1);
        expect(useOfflineStore.getState().queue[0].url).toBe('/api/v1/projects/save');
    });

    it('enqueue: persists queue to localStorage', () => {
        useOfflineStore.getState().enqueue({
            url: '/api/v1/notes',
            method: 'POST',
            body: '{}',
            description: 'Save note',
        });
        const stored = JSON.parse(localStorage.getItem('marion_offline_queue') || '[]');
        expect(stored).toHaveLength(1);
    });

    it('clearQueue: empties the queue', () => {
        useOfflineStore.getState().enqueue({
            url: '/api/v1/test',
            method: 'POST',
            body: '{}',
            description: 'Test',
        });
        useOfflineStore.getState().clearQueue();
        expect(useOfflineStore.getState().queue).toHaveLength(0);
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
