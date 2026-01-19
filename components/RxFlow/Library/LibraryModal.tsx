import React, { useState } from 'react';
import { SavedGraph, listGraphs, deleteGraph } from '../Storage/GraphStorage';
import { X, Trash2, FolderOpen, Calendar, GitBranch } from 'lucide-react';

interface LibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (graph: SavedGraph) => void;
}

const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose, onLoad }) => {
    const [graphs, setGraphs] = useState<SavedGraph[]>(listGraphs());
    const [searchQuery, setSearchQuery] = useState('');

    const refreshGraphs = () => {
        setGraphs(listGraphs());
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Delete "${name}"?`)) {
            deleteGraph(id);
            refreshGraphs();
        }
    };

    const handleLoad = (graph: SavedGraph) => {
        onLoad(graph);
        onClose();
    };

    const filteredGraphs = graphs.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-lg w-[600px] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-indigo-400">Graph Library</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-700">
                    <input
                        type="text"
                        placeholder="Search graphs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                {/* Graph List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredGraphs.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                            {searchQuery ? 'No graphs found' : 'No saved graphs yet'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredGraphs.map((graph) => (
                                <div
                                    key={graph.id}
                                    className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-indigo-500 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-semibold text-slate-200">{graph.name}</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleLoad(graph)}
                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm flex items-center gap-1"
                                            >
                                                <FolderOpen size={14} />
                                                Load
                                            </button>
                                            <button
                                                onClick={() => handleDelete(graph.id, graph.name)}
                                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm flex items-center gap-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(graph.timestamp).toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <GitBranch size={12} />
                                            {graph.nodeCount} nodes, {graph.edgeCount} edges
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LibraryModal;
