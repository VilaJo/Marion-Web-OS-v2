/**
 * API Service - Centralized fetch wrapper with authentication
 *
 * Features:
 * - Automatic auth token injection
 * - 401 detection → session clear + reload
 * - Offline mutation queueing (POST/PUT/DELETE)
 * - Auto-sync when connectivity returns
 */

// Get auth token from sessionStorage
const getAuthToken = (): string | null => {
    return sessionStorage.getItem('marion_token');
};

/** Mutation methods that should be queued when offline */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Authenticated fetch wrapper
 * Automatically adds X-Marion-Token header if available.
 * When offline and the request is a mutation, queues it for later replay.
 */
export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    
    // Add auth token if available
    const token = getAuthToken();
    if (token) {
        headers.set('X-Marion-Token', token);
    }
    
    // Ensure Content-Type for JSON requests
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const method = (options.method || 'GET').toUpperCase();
    const isMutation = MUTATION_METHODS.has(method);

    // If offline and this is a mutation, queue it
    if (isMutation && typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
            const { useOfflineStore } = await import('../stores/useOfflineStore');
            useOfflineStore.getState().enqueue({
                url,
                method,
                body: typeof options.body === 'string' ? options.body : '',
                description: `${method} ${url.split('/').pop() || url}`,
            });
        } catch { /* store import failed — fall through to try fetch anyway */ }

        // Return a synthetic "queued" response
        return new Response(JSON.stringify({ queued: true, success: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        // Handle 401 - redirect to login
        if (response.status === 401) {
            const data = await response.clone().json().catch(() => ({}));
            if (data.code === 'EXPIRED' || data.code === 'INVALID_TOKEN') {
                sessionStorage.removeItem('marion_token');
                window.location.reload();
            }
        }
        
        return response;
    } catch (err) {
        // Network error on a mutation → queue it
        if (isMutation && err instanceof TypeError) {
            try {
                const { useOfflineStore } = await import('../stores/useOfflineStore');
                useOfflineStore.getState().enqueue({
                    url,
                    method,
                    body: typeof options.body === 'string' ? options.body : '',
                    description: `${method} ${url.split('/').pop() || url}`,
                });
                useOfflineStore.getState().setOnline(false);
            } catch { /* ignore */ }

            return new Response(JSON.stringify({ queued: true, success: true }), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        throw err;
    }
};

/**
 * GET request helper
 */
export const apiGet = async <T = any>(url: string): Promise<T> => {
    const response = await apiFetch(url);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
};

/**
 * POST request helper
 */
export const apiPost = async <T = any>(url: string, body?: any): Promise<T> => {
    const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
};

/**
 * PUT request helper
 */
export const apiPut = async <T = any>(url: string, body?: any): Promise<T> => {
    const response = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
};

/**
 * DELETE request helper
 */
export const apiDelete = async <T = any>(url: string): Promise<T> => {
    const response = await apiFetch(url, { method: 'DELETE' });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
};

/**
 * Logout - clear token and reload
 */
export const logout = () => {
    apiFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('marion_token');
    window.location.reload();
};

// ---------------------------------------------------------------------------
// Online/offline detection + auto-sync
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        try {
            const { useOfflineStore } = await import('../stores/useOfflineStore');
            useOfflineStore.getState().setOnline(true);
            // Auto-replay queued mutations
            await useOfflineStore.getState().processQueue();
        } catch { /* ignore */ }
    });

    window.addEventListener('offline', async () => {
        try {
            const { useOfflineStore } = await import('../stores/useOfflineStore');
            useOfflineStore.getState().setOnline(false);
        } catch { /* ignore */ }
    });
}

export default apiFetch;
