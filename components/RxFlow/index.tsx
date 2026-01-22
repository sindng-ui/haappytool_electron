import React, { useRef, useMemo } from 'react';
import { ReactFlow, Background, Controls, useReactFlow, ReactFlowProvider, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRxFlowStore } from './RxFlowStore';
import { Play, RotateCcw, Save, Download, Upload, Trash2, Code } from 'lucide-react';
import { SourceNode, OperatorNode, JoinNode, SubjectNode, SinkNode } from './Nodes/CustomNodes';
import { CATEGORIES, RxNodeData } from './constants';
import PropertyPanel from './Sidebar/PropertyPanel';

import CustomEdge from './Canvas/CustomEdge';
import Timeline from './Simulation/Timeline';


import { generateCSharp } from './CodeGen/CSharpGenerator';
import { validateCode, ValidationResult } from './CodeGen/RoslynBridge';
import LibraryModal from './Library/LibraryModal';
import ImportCodeModal from './Library/ImportCodeModal';
import { saveGraph, updateGraph, SavedGraph, listGraphs, deleteGraph } from './Storage/GraphStorage';

const RxFlowVisualizer: React.FC = () => {
    const {
        nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode,
        setGraph, clearGraph, currentGraphId, currentGraphName, setCurrentGraph
    } = useRxFlowStore();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const reactFlowInstance = useReactFlow();
    const [code, setCode] = React.useState('');
    const [diagnostics, setDiagnostics] = React.useState<ValidationResult[]>([]);
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
    const [showSaveDialog, setShowSaveDialog] = React.useState(false);
    const [saveName, setSaveName] = React.useState('');
    const [isImportOpen, setIsImportOpen] = React.useState(false);

    // Save As - prompt for name and save to library
    const handleSaveAs = () => {
        setShowSaveDialog(true);
    };

    const confirmSave = () => {
        if (!saveName.trim()) return;
        const saved = saveGraph(saveName, nodes, edges);
        setCurrentGraph(saved.id, saved.name);
        setShowSaveDialog(false);
        setSaveName('');
    };

    // Quick save - update existing graph
    const handleQuickSave = () => {
        if (currentGraphId) {
            updateGraph(currentGraphId, nodes, edges);
        } else {
            handleSaveAs();
        }
    };

    // Load from library
    const handleLoadGraph = (graph: SavedGraph) => {
        setGraph(graph.nodes, graph.edges);
        setCurrentGraph(graph.id, graph.name);
    };

    // Import from C# code
    const handleImportCode = (nodes: Node<RxNodeData>[], edges: Edge[]) => {
        // Merge with existing or replace? Let's replace for simplicity
        // You could add a checkbox in modal for "merge" vs "replace"
        setGraph(nodes, edges);
        setCurrentGraph(null, null); // Reset current graph since this is new content
    };

    // File input for legacy file-based load
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                if (json.nodes && json.edges) {
                    setGraph(json.nodes, json.edges);
                    setCurrentGraph(null, null);
                }
            } catch (err) {
                console.error('Failed to load graph', err);
            }
        };
        reader.readAsText(file);
    };

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Delete key - remove selected nodes/edges
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const selectedNodes = nodes.filter(n => n.selected);
                const selectedEdges = edges.filter(e => e.selected);

                if (selectedNodes.length > 0 || selectedEdges.length > 0) {
                    const remainingNodes = nodes.filter(n => !n.selected);
                    const remainingEdges = edges.filter(e => !e.selected);
                    setGraph(remainingNodes, remainingEdges);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, edges, setGraph]);

    // Update code preview on graph change & Validate
    React.useEffect(() => {
        const generated = generateCSharp(nodes, edges);
        setCode(generated);

        // Debounce validation slightly? Or run immediately.
        const timer = setTimeout(async () => {
            const results = await validateCode(generated);
            setDiagnostics(results);
        }, 500);

        return () => clearTimeout(timer);
    }, [nodes, edges]);

    const nodeTypes = useMemo(() => ({

        source: SourceNode,
        pipe: OperatorNode,
        join: JoinNode,
        subject: SubjectNode,
        sink: SinkNode
    }), []);

    // Register edge types
    const edgeTypes = useMemo(() => ({
        default: CustomEdge,
    }), []);

    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();

        const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
        const type = event.dataTransfer.getData('application/reactflow');
        const label = event.dataTransfer.getData('application/reactflow-label');

        if (typeof type === 'undefined' || !type || !reactFlowBounds) {
            return;
        }

        // Use ReactFlow's built-in coordinate conversion
        // This accounts for zoom and pan transformations
        const position = reactFlowInstance?.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        }) || {
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
        };

        // Determine node type category
        let nodeCategory: 'source' | 'pipe' | 'join' | 'subject' | 'sink' = 'pipe';
        if (CATEGORIES.SOURCE.includes(label)) nodeCategory = 'source';
        else if (CATEGORIES.PIPE.includes(label)) nodeCategory = 'pipe';
        else if (CATEGORIES.JOIN.includes(label)) nodeCategory = 'join';
        else if (CATEGORIES.SUBJECT.includes(label)) nodeCategory = 'subject';
        else if (CATEGORIES.SINK.includes(label)) nodeCategory = 'sink';

        const newNode = {
            id: `node_${Date.now()}`,
            type, // Use the specific type (source, pipe, etc.)
            position,
            data: {
                label: label || `${type} node`,
                type: nodeCategory  // Add type field for CSharpGenerator
            },
        };

        addNode(newNode);
    };

    return (
        <div className="flex h-full w-full bg-slate-900 text-slate-200 flex-col">
            {/* Title Bar - Draggable */}
            <div className="h-8 bg-slate-950 border-b border-slate-800 flex items-center px-4" style={{ WebkitAppRegion: 'drag' } as any}>
                <h1 className="text-sm font-semibold text-indigo-400">RxFlow Visualizer</h1>
                {currentGraphName && (
                    <span className="ml-3 text-xs text-slate-500">- {currentGraphName}</span>
                )}
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Node Palette with Library Dropdown */}
                <div className="w-64 border-r border-slate-800 flex flex-col">
                    {/* Library Dropdown */}
                    <div className="p-3 border-b border-slate-800" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <div className="relative">
                            <button
                                onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                                className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center justify-between"
                            >
                                <span>📚 Library</span>
                                <span className="text-xs">{isLibraryOpen ? '▲' : '▼'}</span>
                            </button>

                            {isLibraryOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                    <div className="p-2">
                                        <button
                                            onClick={() => { handleSaveAs(); setIsLibraryOpen(false); }}
                                            className="w-full px-3 py-2 text-left hover:bg-slate-700 rounded text-sm flex items-center gap-2"
                                        >
                                            <Save size={14} />
                                            Save As...
                                        </button>
                                        {currentGraphId && (
                                            <button
                                                onClick={() => { handleQuickSave(); setIsLibraryOpen(false); }}
                                                className="w-full px-3 py-2 text-left hover:bg-slate-700 rounded text-sm flex items-center gap-2 text-green-400"
                                            >
                                                <Download size={14} />
                                                Quick Save
                                            </button>
                                        )}
                                        <div className="border-t border-slate-600 my-2"></div>
                                        {listGraphs().length === 0 ? (
                                            <div className="px-3 py-2 text-xs text-slate-500">No saved graphs</div>
                                        ) : (
                                            listGraphs().map(graph => (
                                                <div key={graph.id} className="flex items-center gap-1 hover:bg-slate-700 rounded px-2 py-1">
                                                    <button
                                                        onClick={() => { handleLoadGraph(graph); setIsLibraryOpen(false); }}
                                                        className="flex-1 text-left text-sm truncate"
                                                    >
                                                        {graph.name}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Delete "${graph.name}"?`)) {
                                                                deleteGraph(graph.id);
                                                                setIsLibraryOpen(false);
                                                                setTimeout(() => setIsLibraryOpen(true), 10);
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-rose-600 rounded"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Node Palette */}
                    <div className="flex-1 p-4 overflow-y-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <h2 className="text-xl font-bold text-indigo-400">RxFlow Nodes</h2>

                        <div className="space-y-6">
                            {/* Source Nodes */}
                            <div>
                                <div className="text-xs font-bold text-emerald-500 uppercase mb-2">Sources</div>
                                <div className="grid gap-2">
                                    {CATEGORIES.SOURCE.map((label) => (
                                        <div
                                            key={label}
                                            className="bg-emerald-950/30 border border-emerald-900/50 p-2 rounded cursor-grab hover:bg-emerald-900/50 hover:border-emerald-500/50 transition text-sm"
                                            draggable
                                            onDragStart={(e) => onDragStart(e, 'source', label)}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pipe Nodes */}
                            <div>
                                <div className="text-xs font-bold text-blue-500 uppercase mb-2">Operators (Pipe)</div>
                                <div className="grid gap-2">
                                    {CATEGORIES.PIPE.map((label) => (
                                        <div
                                            key={label}
                                            className="bg-blue-950/30 border border-blue-900/50 p-2 rounded cursor-grab hover:bg-blue-900/50 hover:border-blue-500/50 transition text-sm"
                                            draggable
                                            onDragStart={(e) => onDragStart(e, 'pipe', label)}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Join Nodes */}
                            <div>
                                <div className="text-xs font-bold text-purple-500 uppercase mb-2">Join</div>
                                <div className="grid gap-2">
                                    {CATEGORIES.JOIN.map((label) => (
                                        <div
                                            key={label}
                                            className="bg-purple-950/30 border border-purple-900/50 p-2 rounded cursor-grab hover:bg-purple-900/50 hover:border-purple-500/50 transition text-sm"
                                            draggable
                                            onDragStart={(e) => onDragStart(e, 'join', label)}
                                        >
                                            {label}
                                        </div>
                                    ))
                                    }
                                </div>
                            </div>

                            {/* Subject Nodes */}
                            <div>
                                <div className="text-xs font-bold text-amber-500 uppercase mb-2">Subjects</div>
                                <div className="grid gap-2">
                                    {CATEGORIES.SUBJECT.map((label) => (
                                        <div
                                            key={label}
                                            className="bg-amber-950/30 border border-amber-900/50 p-2 rounded cursor-grab hover:bg-amber-900/50 hover:border-amber-500/50 transition text-sm"
                                            draggable
                                            onDragStart={(e) => onDragStart(e, 'subject', label)}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sink Nodes */}
                            <div>
                                <div className="text-xs font-bold text-rose-500 uppercase mb-2">Sinks (Output)</div>
                                <div className="grid gap-2">
                                    {CATEGORIES.SINK.map((label) => (
                                        <div
                                            key={label}
                                            className="bg-rose-950/30 border border-rose-900/50 p-2 rounded cursor-grab hover:bg-rose-900/50 hover:border-rose-500/50 transition text-sm"
                                            draggable
                                            onDragStart={(e) => onDragStart(e, 'sink', label)}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Canvas */}
                <div className="flex-1 relative" ref={reactFlowWrapper} style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes} // Register Custom Nodes
                        edgeTypes={edgeTypes}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        fitView
                        className="bg-slate-900"
                    >
                        <Background color="#334155" gap={16} />
                        <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />

                        {/* Top Toolbar */}
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                accept=".json"
                                onChange={handleFileChange}
                            />
                            <button onClick={() => setIsLibraryOpen(true)} className="p-2 bg-indigo-600 border border-indigo-500 rounded-lg hover:bg-indigo-700 text-white" title="Open Library">
                                <Upload size={18} />
                            </button>
                            <button onClick={() => setIsImportOpen(true)} className="px-3 py-2 bg-purple-600 border border-purple-500 rounded-lg hover:bg-purple-700 text-white font-semibold" title="Import C# Code">
                                C# Import
                            </button>
                            <button onClick={handleSaveAs} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-300" title="Save As">
                                <Save size={18} />
                            </button>
                            {currentGraphId && (
                                <button onClick={handleQuickSave} className="p-2 bg-green-600 border border-green-500 rounded-lg hover:bg-green-700 text-white" title={`Quick Save: ${currentGraphName}`}>
                                    <Download size={18} />
                                </button>
                            )}
                            <div className="w-px bg-slate-700 mx-1"></div>
                            <button onClick={clearGraph} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-rose-900/50 text-rose-400 border-rose-900/50" title="Clear Canvas">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </ReactFlow>

                    {/* Bottom: Timeline Controller (Floating) */}
                    <Timeline />
                </div>

                {/* Right Sidebar: Properties & Code */}
                <div className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col">
                    {/* Property Panel takes full height of upper section */}
                    <div className="flex-1 overflow-hidden p-4">
                        <PropertyPanel />
                    </div>

                    <div className="h-1/3 border-t border-slate-800 flex flex-col">
                        <div className="p-2 bg-slate-950 border-b border-slate-800 text-xs font-mono text-slate-400 flex justify-between">
                            <span>C# Preview</span>
                            <Save
                                size={14}
                                className="cursor-pointer hover:text-white"
                                onClick={() => {
                                    navigator.clipboard.writeText(code);
                                    // Optional: show toast notification
                                }}
                                title="Copy to Clipboard"
                            />
                        </div>
                        <pre className="flex-1 p-2 overflow-auto text-xs font-mono text-green-400 bg-slate-950 whitespace-pre-wrap relative">
                            {code}
                        </pre>

                        {/* Diagnostics Panel */}
                        {diagnostics.length > 0 && (
                            <div className="h-24 bg-slate-900 border-t border-slate-700 overflow-y-auto p-2">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Diagnostics</div>
                                {diagnostics.map((d, i) => (
                                    <div key={i} className={`text-xs font-mono mb-1 ${d.Severity === 'Error' ? 'text-rose-400' : 'text-amber-400'}`}>
                                        [{d.Id}] Line {d.Line}: {d.Message}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Dialog */}
                {showSaveDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-96">
                            <h3 className="text-lg font-bold text-indigo-400 mb-4">Save Graph</h3>
                            <input
                                type="text"
                                placeholder="Enter graph name..."
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 mb-4 focus:outline-none focus:border-indigo-500"
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => { setShowSaveDialog(false); setSaveName(''); }}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSave}
                                    disabled={!saveName.trim()}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Library Modal */}
                <LibraryModal
                    isOpen={isLibraryOpen}
                    onClose={() => setIsLibraryOpen(false)}
                    onLoad={handleLoadGraph}
                />

                {/* Import Code Modal */}
                <ImportCodeModal
                    isOpen={isImportOpen}
                    onClose={() => setIsImportOpen(false)}
                    onImport={handleImportCode}
                />
            </div>
        </div>
    );
};

// Wrap with ReactFlowProvider to enable useReactFlow hook
const RxFlowVisualizerWithProvider: React.FC = () => (
    <ReactFlowProvider>
        <RxFlowVisualizer />
    </ReactFlowProvider>
);

export default RxFlowVisualizerWithProvider;

