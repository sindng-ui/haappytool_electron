/// <reference lib="webworker" />

self.onmessage = async (e: MessageEvent) => {
    const { type, payload, requestId } = e.data;

    try {
        if (type === 'PARSE_AND_FORMAT') {
            const { text, mode } = payload; // mode: 'format' | 'minify'

            // Large JSONs can block, so this worker offloads that.
            const json = JSON.parse(text);
            let result = '';

            if (mode === 'minify') {
                result = JSON.stringify(json);
                self.postMessage({ type: 'SUCCESS', payload: result, requestId });
            } else {
                // Format mode: Return both object (for tree) and string (for copy)
                // We use structured cloning for the object naturally via postMessage
                const formatted = JSON.stringify(json, null, 2);
                self.postMessage({ type: 'SUCCESS', payload: { data: json, formatted }, requestId });
            }
        }
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', error: error.message, requestId });
    }
};
