/**
 * API Service - Centralized fetch wrapper with authentication
 */

// Get auth token from sessionStorage
const getAuthToken = (): string | null => {
    return sessionStorage.getItem('marion_token');
};

/**
 * Authenticated fetch wrapper
 * Automatically adds X-Marion-Token header if available
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
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('marion_token');
    window.location.reload();
};

export default apiFetch;
