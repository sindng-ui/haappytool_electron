import { Node, Edge } from '@xyflow/react';
import { RxNodeData } from '../constants';

// Type definitions matching backend C# output
export interface ParsedGraph {
    nodes: ParsedNode[];
    edges: ParsedEdge[];
    errors?: string[];
}

export interface ParsedNode {
    id: string;
    type: 'source' | 'pipe' | 'join' | 'subject' | 'sink';
    label: string;
    parameters?: Record<string, any>;
}

export interface ParsedEdge {
    source: string;
    target: string;
}

/**
 * Parse C# Rx code and convert to graph structure
 */
export const parseRxCode = async (code: string): Promise<ParsedGraph> => {
    if (!code.trim()) {
        return { nodes: [], edges: [], errors: [] };
    }

    try {
        // Check if running in Electron
        // @ts-ignore
        if (typeof window.electronAPI === 'undefined') {
            return {
                nodes: [],
                edges: [],
                errors: ['Parser requires Electron environment']
            };
        }

        // @ts-ignore
        const result = await window.electronAPI.parseRxCode(code);
        return result;
    } catch (e: any) {
        console.error('Parse failed', e);
        return {
            nodes: [],
            edges: [],
            errors: [e.message || 'Unknown parse error']
        };
    }
};

/**
 * Convert parsed graph to ReactFlow nodes with auto-layout
 */
export const convertToReactFlowNodes = (
    parsed: ParsedGraph
): { nodes: Node<RxNodeData>[], edges: Edge[] } => {
    if (!parsed || parsed.nodes.length === 0) {
        return { nodes: [], edges: [] };
    }

    // Build adjacency map for topological sort
    const adjMap = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    parsed.nodes.forEach(node => {
        adjMap.set(node.id, []);
        inDegree.set(node.id, 0);
    });

    parsed.edges.forEach(edge => {
        adjMap.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Topological sort to determine layers (depth)
    const layers = new Map<string, number>();
    const queue: string[] = [];

    // Start with nodes that have no incoming edges
    parsed.nodes.forEach(node => {
        if (inDegree.get(node.id) === 0) {
            queue.push(node.id);
            layers.set(node.id, 0);
        }
    });

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLayer = layers.get(current) || 0;

        adjMap.get(current)?.forEach(next => {
            const newDegree = (inDegree.get(next) || 0) - 1;
            inDegree.set(next, newDegree);

            if (newDegree === 0) {
                queue.push(next);
                layers.set(next, currentLayer + 1);
            }
        });
    }

    // Calculate positions: 200px horizontal, 150px vertical spacing
    const HORIZONTAL_SPACING = 200;
    const VERTICAL_SPACING = 150;

    // Group nodes by layer
    const layerGroups = new Map<number, string[]>();
    layers.forEach((layer, nodeId) => {
        if (!layerGroups.has(layer)) {
            layerGroups.set(layer, []);
        }
        layerGroups.get(layer)!.push(nodeId);
    });

    // Calculate positions
    const positions = new Map<string, { x: number; y: number }>();

    layerGroups.forEach((nodeIds, layer) => {
        const count = nodeIds.length;
        nodeIds.forEach((nodeId, index) => {
            positions.set(nodeId, {
                x: layer * HORIZONTAL_SPACING,
                y: index * VERTICAL_SPACING - ((count - 1) * VERTICAL_SPACING / 2) // Center vertically
            });
        });
    });

    // Convert to ReactFlow format
    const reactFlowNodes: Node<RxNodeData>[] = parsed.nodes.map(node => {
        const position = positions.get(node.id) || { x: 0, y: 0 };

        return {
            id: node.id,
            type: node.type,
            position,
            data: {
                label: node.label,
                type: node.type,
                params: node.parameters || {}
            }
        };
    });

    const reactFlowEdges: Edge[] = parsed.edges.map((edge, index) => ({
        id: `e${index}`,
        source: edge.source,
        target: edge.target,
        type: 'default'
    }));

    return {
        nodes: reactFlowNodes,
        edges: reactFlowEdges
    };
};
