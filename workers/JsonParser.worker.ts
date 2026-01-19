/// <reference lib="webworker" />

interface FlattenedNode {
    id: string;
    key: string;
    value: any;
    level: number;
    isExpanded: boolean;
    hasChildren: boolean;
    parentKeyPath: string;
    path: string[];
}

let currentData: any = null;

const createFlattenedData = (data: any, expandedPaths: Set<string>): FlattenedNode[] => {
    const results: FlattenedNode[] = [];

    const traverse = (node: any, level: number, path: string[]) => {
        const pathStr = path.join('.');

        if (level === 0) {
            if (node !== null && typeof node === 'object') {
                Object.keys(node).forEach((key) => {
                    const val = node[key];
                    const isObj = val !== null && typeof val === 'object';
                    const hasChildren = isObj && Object.keys(val).length > 0;
                    const currentPath = [...path, key];
                    const currentPathStr = currentPath.join('.');
                    const isExpanded = expandedPaths.has(currentPathStr);

                    results.push({
                        id: currentPathStr,
                        key: key,
                        value: val,
                        level,
                        isExpanded,
                        hasChildren,
                        parentKeyPath: pathStr,
                        path: currentPath
                    });

                    if (isExpanded && hasChildren) {
                        traverse(val, level + 1, currentPath);
                    }
                });
            }
        } else {
            if (node !== null && typeof node === 'object') {
                Object.keys(node).forEach((key) => {
                    const val = node[key];
                    const isObj = val !== null && typeof val === 'object';
                    const hasChildren = isObj && Object.keys(val).length > 0;
                    const currentPath = [...path, key];
                    const currentPathStr = currentPath.join('.');
                    const isExpanded = expandedPaths.has(currentPathStr);

                    results.push({
                        id: currentPathStr,
                        key: key,
                        value: val,
                        level,
                        isExpanded,
                        hasChildren,
                        parentKeyPath: pathStr,
                        path: currentPath
                    });

                    if (isExpanded && hasChildren) {
                        traverse(val, level + 1, currentPath);
                    }
                });
            }
        }
    };

    if (data !== null && typeof data === 'object') {
        traverse(data, 0, []);
    }

    return results;
};

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
                // Update Cache
                currentData = json;

                // Format mode: Return both object (for tree) and string (for copy)
                // We use structured cloning for the object naturally via postMessage
                const formatted = JSON.stringify(json, null, 2);
                self.postMessage({ type: 'SUCCESS', payload: { data: json, formatted }, requestId });
            }
        } else if (type === 'SET_DATA') {
            currentData = payload;
            self.postMessage({ type: 'SET_DATA_SUCCESS', requestId });
        } else if (type === 'FLATTEN') {
            const { expandedPaths } = payload; // Array of strings
            const expandedSet = new Set(expandedPaths as string[]);
            const flattened = createFlattenedData(currentData, expandedSet);
            self.postMessage({ type: 'FLATTEN_SUCCESS', payload: flattened, requestId });
        }
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', error: error.message, requestId });
    }
};
