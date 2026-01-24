export type SSECallback = (event: any) => void;

export class SSEService {
    private controller: AbortController | null = null;
    private listeners: Map<string, SSECallback[]> = new Map();

    constructor() { }

    public addListener(type: string, callback: SSECallback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type)?.push(callback);
    }

    public removeListener(type: string, callback: SSECallback) {
        const callbacks = this.listeners.get(type);
        if (callbacks) {
            this.listeners.set(type, callbacks.filter(cb => cb !== callback));
        }
    }

    public async connect(url: string, token: string) {
        this.disconnect();
        this.controller = new AbortController();

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream'
                },
                signal: this.controller.signal
            });

            if (!response.ok) {
                console.error('SSE Connection failed', response.statusText);
                return;
            }

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    this.processEvent(line);
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('SSE Error', error);
            }
        }
    }

    private processEvent(block: string) {
        // Basic SSE parsing
        const lines = block.split('\n');
        let eventType = 'message';
        let data = '';

        lines.forEach(line => {
            if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
                data += line.replace('data:', '').trim();
            }
        });

        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.dispatch(eventType, parsed);
            } catch (e) {
                // If text data
                this.dispatch(eventType, data);
            }
        }
    }

    private dispatch(type: string, data: any) {
        const callbacks = this.listeners.get(type);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
        // Also fire 'all' or similar if needed, or simply log
        // console.log(`SSE Event [${type}]:`, data);
    }

    public disconnect() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
    }
}
