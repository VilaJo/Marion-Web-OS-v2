// Service now proxies to the Python Backend to secure the API Key
// Using empty string for relative URLs - works from any device
const BACKEND_URL = '';

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = sessionStorage.getItem('marion_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Marion-Token': token } : {})
    };
};

export const createChatSession = (getAppContext?: () => any) => {
  // Returns an object compatible with the UI's expectation of the Gemini SDK Chat object
  return {
    sendMessageStream: async function* ({ history }: { history: any[] }) {
        try {
            // Get app context if available
            const context = getAppContext ? getAppContext() : {};
            
            const response = await fetch(`${BACKEND_URL}/api/v1/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ history, context }) // Send full history + context
            });

            if (!response.ok || !response.body) {
                throw new Error('Failed to connect to Franck');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                // Yielding an object with .text to match SDK structure
                yield { text: chunk };
            }
        } catch (e) {
            console.error(e);
            yield { text: "Aïe, mes vieux circuits ont du mal... Réessaie dans un instant, ma belle. 🔧" };
        }
    }
  };
};

// Fetch any todos/events Franck created
export const fetchFranckData = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/v1/franck/data`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (e) {
        console.error('Failed to fetch Franck data:', e);
        return { todos: [], events: [] };
    }
};

// Clear Franck's data after syncing
export const clearFranckData = async () => {
    try {
        await fetch(`${BACKEND_URL}/api/v1/franck/clear`, { 
            method: 'POST',
            headers: getAuthHeaders()
        });
    } catch (e) {
        console.error('Failed to clear Franck data:', e);
    }
};

export const generateBriefing = async (contextData: string): Promise<string> => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/v1/briefing`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ context: contextData })
        });
        
        const data = await response.json();
        return data.html || "<h3>Oups !</h3><p>Erreur de réponse.</p>";
    } catch (e) {
        console.error(e);
        return "<h3>Erreur</h3><p>Franck n'a pas pu générer le briefing (Backend Error).</p>";
    }
}

export const sendZenMessageStream = async function* (history: any[], newMessage: string) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/v1/chat/zen`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ history, message: newMessage })
        });

        if (!response.ok || !response.body) throw new Error('Zen connection failed');

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
        yield { text: "..." };
    }
};