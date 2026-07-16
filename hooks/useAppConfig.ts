/**
 * useAppConfig — Fetches non-sensitive public configuration once per session.
 *
 * Currently exposes `publicBaseUrl` (the Cloudflare Tunnel HTTPS URL, if
 * configured) so components like ClientPortal can build a shareable link
 * that works outside 127.0.0.1. Falls back to an empty string when the
 * tunnel isn't active — callers should fall back to `window.location.origin`.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

interface AppConfig {
    publicBaseUrl: string;
}

const EMPTY_CONFIG: AppConfig = { publicBaseUrl: '' };

let cachedConfig: AppConfig | null = null;
let inFlightRequest: Promise<AppConfig> | null = null;

async function fetchAppConfig(): Promise<AppConfig> {
    try {
        const res = await apiFetch('/api/v1/config/public');
        if (res.ok) {
            const data = await res.json();
            return { publicBaseUrl: data.publicBaseUrl || '' };
        }
    } catch { /* silent — caller falls back to window.location.origin */ }
    return EMPTY_CONFIG;
}

export function useAppConfig(): AppConfig {
    const [config, setConfig] = useState<AppConfig>(cachedConfig || EMPTY_CONFIG);

    useEffect(() => {
        if (cachedConfig) {
            setConfig(cachedConfig);
            return;
        }
        if (!inFlightRequest) {
            inFlightRequest = fetchAppConfig();
        }
        let cancelled = false;
        inFlightRequest.then(result => {
            cachedConfig = result;
            if (!cancelled) setConfig(result);
        });
        return () => { cancelled = true; };
    }, []);

    return config;
}
