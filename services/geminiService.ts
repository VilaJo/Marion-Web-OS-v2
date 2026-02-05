// Service now proxies to the Python Backend to secure the API Key
const BACKEND_URL = 'http://127.0.0.1:5003';

export const createChatSession = (getAppContext?: () => any) => {
  // Returns an object compatible with the UI's expectation of the Gemini SDK Chat object
  return {
    sendMessageStream: async function* ({ history }: { history: any[] }) {
        try {
            // Get app context if available
            const context = getAppContext ? getAppContext() : {};
            
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`${BACKEND_URL}/api/franck/data`);
        return await response.json();
    } catch (e) {
        console.error('Failed to fetch Franck data:', e);
        return { todos: [], events: [] };
    }
};

// Clear Franck's data after syncing
export const clearFranckData = async () => {
    try {
        await fetch(`${BACKEND_URL}/api/franck/clear`, { method: 'POST' });
    } catch (e) {
        console.error('Failed to clear Franck data:', e);
    }
};

export const generateBriefing = async (contextData: string): Promise<string> => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/briefing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`${BACKEND_URL}/api/chat/zen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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