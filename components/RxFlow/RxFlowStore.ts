import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';
import { RxNodeData } from './constants';

interface RxFlowState {
    nodes: Node<RxNodeData>[];
    edges: Edge[];
    onNodesChange: OnNodesChange<Node<RxNodeData>>;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    addNode: (node: Node<RxNodeData>) => void;
    updateNodeData: (id: string, data: Partial<RxNodeData>) => void;
    setGraph: (nodes: Node<RxNodeData>[], edges: Edge[]) => void;
    clearGraph: () => void;

    // Simulation
    isPlaying: boolean;
    setIsPlaying: (isPlaying: boolean) => void;
    simulationTime: number;
    setSimulationTime: (time: number) => void;

    // Results: EdgeId -> List of { time, value, type }
    edgeEmissions: Record<string, any[]>;
    setEdgeEmissions: (map: Record<string, any[]>) => void;

    simulationDuration: number;
    setSimulationDuration: (duration: number) => void;

    // Current graph tracking for save/load
    currentGraphId: string | null;
    currentGraphName: string | null;
    setCurrentGraph: (id: string | null, name: string | null) => void;

    // Trigger re-simulation (for manual injection)
    triggerResimulation: () => void;
}

export const useRxFlowStore = create<RxFlowState>((set, get) => ({
    nodes: [],
    edges: [],

    onNodesChange: (changes: NodeChange<Node<RxNodeData>>[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection: Connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
    },

    addNode: (node: Node<RxNodeData>) => {
        set((state) => ({ nodes: [...state.nodes, node] }));
    },

    updateNodeData: (id: string, data: Partial<RxNodeData>) => {
        set((state) => ({
            nodes: state.nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, ...data } };
                }
                return node;
            }),
        }));
    },

    setGraph: (nodes, edges) => set({ nodes, edges }),

    clearGraph: () => set({ nodes: [], edges: [], edgeEmissions: {}, isPlaying: false, simulationTime: 0 }),


    isPlaying: false,
    setIsPlaying: (isPlaying: boolean) => set({ isPlaying }),
    simulationTime: 0,
    setSimulationTime: (time: number) => set({ simulationTime: time }),

    edgeEmissions: {},
    setEdgeEmissions: (edgeEmissions) => set({ edgeEmissions }),

    simulationDuration: 10000,
    setSimulationDuration: (simulationDuration) => set({ simulationDuration }),

    currentGraphId: null,
    currentGraphName: null,
    setCurrentGraph: (id, name) => set({ currentGraphId: id, currentGraphName: name }),

    triggerResimulation: () => {
        const { nodes, edges } = get();

        // Dynamically import runSimulation to avoid circular dependency
        import('./Simulation/Engine').then(({ runSimulation }) => {
            const { edgeEmissions, maxTime, sinkEmissions } = runSimulation(nodes, edges);

            set({
                edgeEmissions,
                simulationDuration: maxTime || 10000,
                simulationTime: 0,
                isPlaying: true
            });

            // Update sink nodes with emissions
            Object.entries(sinkEmissions).forEach(([nodeId, emissions]) => {
                get().updateNodeData(nodeId, { emissions });
            });
        });
    },
}));
