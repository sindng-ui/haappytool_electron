import { Node, Edge } from '@xyflow/react';
import { RxNodeData } from '../constants';

export interface SavedGraph {
    id: string;
    name: string;
    timestamp: number;
    nodes: Node<RxNodeData>[];
    edges: Edge[];
    nodeCount: number;
    edgeCount: number;
}

const STORAGE_KEY = 'rxflow_saved_graphs';

export const saveGraph = (name: string, nodes: Node<RxNodeData>[], edges: Edge[]): SavedGraph => {
    const graphs = listGraphs();

    const newGraph: SavedGraph = {
        id: `graph_${Date.now()}`,
        name,
        timestamp: Date.now(),
        nodes,
        edges,
        nodeCount: nodes.length,
        edgeCount: edges.length,
    };

    graphs.push(newGraph);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));

    return newGraph;
};

export const loadGraph = (id: string): SavedGraph | null => {
    const graphs = listGraphs();
    return graphs.find(g => g.id === id) || null;
};

export const listGraphs = (): SavedGraph[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse saved graphs', e);
        return [];
    }
};

export const deleteGraph = (id: string): void => {
    const graphs = listGraphs().filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
};

export const updateGraph = (id: string, nodes: Node<RxNodeData>[], edges: Edge[]): void => {
    const graphs = listGraphs();
    const index = graphs.findIndex(g => g.id === id);

    if (index !== -1) {
        graphs[index] = {
            ...graphs[index],
            nodes,
            edges,
            nodeCount: nodes.length,
            edgeCount: edges.length,
            timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
    }
};
