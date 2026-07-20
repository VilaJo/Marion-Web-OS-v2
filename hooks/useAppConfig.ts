/**
 * useAppConfig — Fetches non-sensitive public configuration once per session.
 *
 * Currently exposes `publicBaseUrl` (the Cloudflare Tunnel HTTPS URL, if
 * configured) so components like ClientPortal can build a shareable link
 * that works outside 127.0.0.1. Falls back to an empty string when the
 * tunnel isn't active — callers should fall back to `window.location.origin`.
 *
 * `useTunnelStatus` complements this with the *live* tunnel process state
 * (polled every 20s), so the ClientPortal banner can tell Marion whether the
 * public link is actually reachable right now, not just configured.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

interface AppConfig {
    publicBaseUrl: string;
}

interface TunnelStatus {
    running: boolean;
    pid: number | null;
    publicBaseUrl: string | null;
}

const EMPTY_CONFIG: AppConfig = { publicBaseUrl: '' };
const EMPTY_TUNNEL_STATUS: TunnelStatus = { running: false, pid: null, publicBaseUrl: null };
const TUNNEL_STATUS_POLL_MS = 20_000;

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

async function fetchTunnelStatus(): Promise<TunnelStatus> {
    try {
        const res = await apiFetch('/api/v1/portal/tunnel-status');
        if (res.ok) {
            const data = await res.json();
            return {
                running: !!data.running,
                pid: data.pid ?? null,
                publicBaseUrl: data.publicBaseUrl ?? null,
            };
        }
    } catch { /* silent — caller treats as tunnel down */ }
    return EMPTY_TUNNEL_STATUS;
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

/** Polls `/api/v1/portal/tunnel-status` every 20s for a live "is the public link up?" signal. */
export function useTunnelStatus(): TunnelStatus {
    const [status, setStatus] = useState<TunnelStatus>(EMPTY_TUNNEL_STATUS);

    useEffect(() => {
        let cancelled = false;
        const poll = () => {
            fetchTunnelStatus().then(result => {
                if (!cancelled) setStatus(result);
            });
        };
        poll();
        const interval = setInterval(poll, TUNNEL_STATUS_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return status;
}
