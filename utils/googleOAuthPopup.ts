/**
 * Robust Google OAuth popup helper.
 * Survives blocked popups, missing window.opener (COOP), and postMessage races
 * by also polling sync-status + a localStorage handshake written by the callback page.
 */

import { apiFetch } from '../services/api';

export type GoogleOAuthResult =
    | { ok: true; email?: string; name?: string }
    | { ok: false; error: string };

const OAUTH_RESULT_KEY = 'marion_oauth_result';

function readStoredOAuthResult(): GoogleOAuthResult | null {
    try {
        const raw = localStorage.getItem(OAUTH_RESULT_KEY);
        if (!raw) return null;
        localStorage.removeItem(OAUTH_RESULT_KEY);
        const data = JSON.parse(raw);
        if (data?.type === 'GOOGLE_AUTH_SUCCESS') {
            return { ok: true, email: data.email, name: data.name };
        }
        if (data?.type === 'GOOGLE_AUTH_ERROR') {
            return { ok: false, error: String(data.error || 'Connexion Google refusée') };
        }
    } catch {
        /* ignore */
    }
    return null;
}

async function fetchLoginUrl(): Promise<string> {
    const res = await apiFetch('/api/v1/oauth/google/login');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(
            data.error
            || 'Google OAuth non configuré. Vérifie GOOGLE_CLIENT_ID / SECRET puis relance Eonora.'
        );
    }
    if (!data.auth_url) {
        throw new Error('URL OAuth Google manquante — vérifie la config serveur.');
    }
    return data.auth_url as string;
}

/** Clear stale tokens so the next consent always issues a fresh refresh_token. */
async function clearStaleGoogleTokens(): Promise<void> {
    try {
        await apiFetch('/api/v1/oauth/google/disconnect', { method: 'POST' });
    } catch {
        /* best effort */
    }
    try {
        localStorage.removeItem('marion_gcal_connected');
    } catch {
        /* ignore */
    }
}

/**
 * Open Google OAuth, wait for success/error, return a typed result.
 * When `forceClean` is true (reconnect after expiry), disconnect first.
 */
export async function connectGoogleViaPopup(options?: {
    forceClean?: boolean;
}): Promise<GoogleOAuthResult> {
    if (options?.forceClean) {
        await clearStaleGoogleTokens();
    }

    const authUrl = await fetchLoginUrl();

    // Clear any leftover handshake from a previous attempt
    try { localStorage.removeItem(OAUTH_RESULT_KEY); } catch { /* ignore */ }

    // Do NOT pass `noopener` — we need window.opener for the callback postMessage.
    const popup = window.open(
        authUrl,
        'eonora_google_oauth',
        'width=520,height=680,left=200,top=80',
    );

    if (!popup) {
        return {
            ok: false,
            error: 'Popup bloquée. Autorise les popups pour 127.0.0.1 puis réessaie.',
        };
    }

    return new Promise<GoogleOAuthResult>((resolve) => {
        let settled = false;

        const finish = (result: GoogleOAuthResult) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', onMessage);
            clearInterval(timer);
            try { if (!popup.closed) popup.close(); } catch { /* ignore */ }
            resolve(result);
        };

        const onMessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'GOOGLE_AUTH_SUCCESS') {
                finish({ ok: true, email: data.email, name: data.name });
            } else if (data.type === 'GOOGLE_AUTH_ERROR') {
                finish({ ok: false, error: String(data.error || 'Connexion Google refusée') });
            }
        };

        window.addEventListener('message', onMessage);

        const timer = setInterval(() => {
            // localStorage handshake (works even when window.opener is null)
            const stored = readStoredOAuthResult();
            if (stored) {
                finish(stored);
                return;
            }

            if (popup.closed) {
                // Give the message / storage a brief chance to land, then verify via API
                setTimeout(async () => {
                    const late = readStoredOAuthResult();
                    if (late) {
                        finish(late);
                        return;
                    }
                    try {
                        const statusRes = await apiFetch('/api/v1/gcal/sync-status');
                        const status = await statusRes.json().catch(() => ({}));
                        if (status?.connected) {
                            finish({ ok: true, email: status.email });
                            return;
                        }
                    } catch {
                        /* fall through */
                    }
                    finish({
                        ok: false,
                        error: 'Fenêtre fermée avant la fin — réessaie « Reconnecter ».',
                    });
                }, 400);
                clearInterval(timer);
            }
        }, 400);
    });
}
