/**
 * Tests for services/api.ts (apiFetch wrapper)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock sessionStorage and fetch
const sessionStore: Record<string, string> = {};
globalThis.sessionStorage = {
    getItem: (key: string) => sessionStore[key] || null,
    setItem: (key: string, val: string) => { sessionStore[key] = val; },
    removeItem: (key: string) => { delete sessionStore[key]; },
    clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); },
    length: 0,
    key: () => null,
} as any;

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as any;

// Mock window for api.ts event listeners
const mockReload = vi.fn();
(globalThis as any).window = {
    location: { reload: mockReload },
    addEventListener: vi.fn(),
};

describe('apiFetch', () => {
    let apiFetch: typeof import('../../services/api').apiFetch;

    beforeEach(async () => {
        vi.resetModules();
        sessionStorage.clear();
        mockFetch.mockReset();
        const mod = await import('../../services/api');
        apiFetch = mod.apiFetch;
    });

    it('adds X-Marion-Token header when token exists', async () => {
        sessionStorage.setItem('marion_token', 'my_token_123');
        mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

        await apiFetch('/api/v1/test');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('/api/v1/test');
        const headers = opts.headers;
        // Headers may be a Headers object
        if (headers instanceof Headers) {
            expect(headers.get('X-Marion-Token')).toBe('my_token_123');
        }
    });

    it('does not add token header when no token', async () => {
        mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

        await apiFetch('/api/v1/test');

        const [, opts] = mockFetch.mock.calls[0];
        const headers = opts.headers;
        if (headers instanceof Headers) {
            expect(headers.has('X-Marion-Token')).toBe(false);
        }
    });

    it('passes through custom headers and options', async () => {
        mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

        await apiFetch('/api/v1/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'value' }),
        });

        const [, opts] = mockFetch.mock.calls[0];
        expect(opts.method).toBe('POST');
        expect(opts.body).toBe('{"key":"value"}');
    });
});
