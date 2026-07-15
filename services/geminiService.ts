// Service now proxies to the Python Backend to secure the API Key
// Using empty string for relative URLs - works from any device
import { apiFetch } from './api';

const BACKEND_URL = '';

const getAiRoutingPayload = () => {
    const aiMode = (localStorage.getItem('marion_ai_mode') || 'cloud') as 'local' | 'hybrid' | 'cloud';
    const localModel = localStorage.getItem('marion_ai_local_model') || 'qwen2.5:7b-instruct';
    const fallbackEnabled = localStorage.getItem('marion_ai_fallback_enabled') !== 'false';
    return {
        ai_mode: aiMode,
        local_model: localModel,
        fallback_enabled: fallbackEnabled,
    };
};

/** After saving a Gemini key, prefer cloud mode so Franck works without Ollama. */
export const activateCloudAiMode = () => {
    try {
        localStorage.setItem('marion_ai_mode', 'cloud');
        localStorage.setItem('marion_ai_fallback_enabled', 'true');
    } catch {
        // ignore quota / private mode
    }
};

async function readChatError(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (data?.error) return String(data.error);
    } catch {
        // not JSON
    }
    if (response.status === 503) {
        return "Gemini n'est pas configuré — ajoute ta clé API dans Paramètres → IA.";
    }
    if (response.status === 401) {
        return 'Session expirée — reconnecte-toi à Marion.';
    }
    return `Erreur serveur (${response.status})`;
}

export const createChatSession = (getAppContext?: () => any) => {
  // Returns an object compatible with the UI's expectation of the Gemini SDK Chat object
  return {
    sendMessageStream: async function* ({ history }: { history: any[] }) {
        try {
            const context = getAppContext ? getAppContext() : {};

            const response = await apiFetch(`${BACKEND_URL}/api/v1/chat`, {
                method: 'POST',
                body: JSON.stringify({ history, context, ...getAiRoutingPayload() }),
            });

            if (!response.ok) {
                const message = await readChatError(response);
                yield { text: message };
                return;
            }

            if (!response.body) {
                yield { text: 'Impossible de joindre Franck — réessaie dans un instant.' };
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                yield { text: chunk };
            }
        } catch (e) {
            console.error(e);
            yield { text: "Aïe, mes vieux circuits ont du mal... Réessaie dans un instant, ma belle. 🔧" };
        }
    }
  };
};

// Fetch any todos/events Franck created + action signals for React Query invalidation
export const fetchFranckData = async (): Promise<{
    todos: any[];
    events: any[];
    invoices: any[];
    emails: any[];
    actions_performed: string[];
}> => {
    try {
        const response = await apiFetch(`${BACKEND_URL}/api/v1/franck/data`);
        return await response.json();
    } catch (e) {
        console.error('Failed to fetch Franck data:', e);
        return { todos: [], events: [], invoices: [], emails: [], actions_performed: [] };
    }
};

// Fetch proactive suggestions from Franck
export const fetchFranckSuggestions = async (): Promise<{
    suggestions: Array<{
        text: string;
        prompt: string;
        priority: string;
        category: string;
        icon: string;
    }>;
}> => {
    try {
        const response = await apiFetch(`${BACKEND_URL}/api/v1/franck/suggestions`);
        return await response.json();
    } catch (e) {
        console.error('Failed to fetch Franck suggestions:', e);
        return { suggestions: [] };
    }
};

// Clear Franck's data after syncing
export const clearFranckData = async () => {
    try {
        await apiFetch(`${BACKEND_URL}/api/v1/franck/clear`, { method: 'POST' });
    } catch (e) {
        console.error('Failed to clear Franck data:', e);
    }
};

export const generateBriefing = async (contextData: string): Promise<string> => {
    try {
        const response = await apiFetch(`${BACKEND_URL}/api/v1/briefing`, {
            method: 'POST',
            body: JSON.stringify({ context: contextData, ...getAiRoutingPayload() }),
        });

        if (!response.ok) {
            throw new Error(await readChatError(response));
        }
        const data = await response.json();
        return data.briefing || data.text || '';
    } catch (e) {
        console.error('Briefing generation failed:', e);
        return "Impossible de générer le briefing pour le moment.";
    }
};

export const generateZenResponse = async (
    message: string,
    history: any[] = [],
    focusContext?: Record<string, unknown>
): Promise<string> => {
    try {
        const response = await apiFetch(`${BACKEND_URL}/api/v1/chat/zen`, {
            method: 'POST',
            body: JSON.stringify({
                message,
                history,
                focus_context: focusContext,
                ...getAiRoutingPayload(),
            }),
        });

        if (!response.ok) {
            throw new Error(await readChatError(response));
        }
        return await response.text();
    } catch (e) {
        console.error('Zen chat failed:', e);
        return "Oups, petit bug technique. Respire et réessaie.";
    }
};

/** Transcribe a short Franck voice note via Gemini (MediaRecorder blob). */
export const transcribeAudioBlob = async (blob: Blob, mimeType?: string): Promise<string> => {
    const form = new FormData();
    const type = mimeType || blob.type || 'audio/webm';
    const ext = type.includes('mp4') || type.includes('m4a') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', blob, `franck-voice.${ext}`);
    form.append('mime_type', type.split(';')[0]);
    const routing = getAiRoutingPayload();
    form.append('ai_mode', routing.ai_mode);
    form.append('local_model', routing.local_model);
    form.append('fallback_enabled', String(routing.fallback_enabled));

    const response = await apiFetch(`${BACKEND_URL}/api/v1/ai/transcribe`, {
        method: 'POST',
        body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Transcription impossible (${response.status})`);
    }
    const text = String(data?.text || '').trim();
    if (!text) {
        throw new Error('Rien entendu clairement — réessaie.');
    }
    return text;
};
