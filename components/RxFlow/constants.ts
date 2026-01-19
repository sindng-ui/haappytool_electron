export const NODE_TYPES = {
    SOURCE: 'source',
    PIPE: 'pipe',
    JOIN: 'join',
    SINK: 'sink'
} as const;

export interface RxNodeData extends Record<string, unknown> {
    label: string;
    type: 'source' | 'pipe' | 'join' | 'subject' | 'sink'; // Add type field
    description?: string;
    // Operator specific params
    params?: Record<string, any>;
    // Runtime Simulation state
    emissions?: any[];
    manualInjections?: any[]; // For subject nodes
}

export const CATEGORIES = {
    SOURCE: ['Interval', 'Timer', 'FromEvent', 'FromAsync'],
    PIPE: ['Select', 'SelectMany', 'Where', 'Scan', 'Debounce', 'DistinctUntilChanged'],
    JOIN: ['Merge', 'Zip', 'CombineLatest', 'Amb'],
    SUBJECT: ['Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject'],
    SINK: ['Subscribe', 'ObserveOn']
};

export const INITIAL_NODES = [];
export const INITIAL_EDGES = [];
