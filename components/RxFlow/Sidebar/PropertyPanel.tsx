import React, { useEffect, useState } from 'react';
import { useRxFlowStore } from '../RxFlowStore';
import { Save, Trash2, HelpCircle } from 'lucide-react';

const PropertyPanel: React.FC = () => {
    const { nodes, updateNodeData, nodes: allNodes, onNodesChange } = useRxFlowStore();

    // Find selected node (React Flow handles selection state in the node object)
    const selectedNode = allNodes.find(n => n.selected);

    const [localParams, setLocalParams] = useState<Record<string, any>>({});

    useEffect(() => {
        if (selectedNode) {
            setLocalParams(selectedNode.data.params || {});
        }
    }, [selectedNode?.id]);

    const handleParamChange = (key: string, value: any) => {
        const newParams = { ...localParams, [key]: value };
        setLocalParams(newParams);
        if (selectedNode) {
            updateNodeData(selectedNode.id, { params: newParams });
        }
    };

    const handleDelete = () => {
        if (selectedNode) {
            onNodesChange([{ type: 'remove', id: selectedNode.id }]);
        }
    };

    if (!selectedNode) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 p-8 text-center">
                <HelpCircle size={48} className="text-slate-700" />
                <p>Select a node to configure its properties</p>
            </div>
        );
    }

    const { label } = selectedNode.data;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-6">

                {/* Header */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Current Node</div>
                    <div className="text-xl font-bold text-indigo-400">{label}</div>
                    <div className="text-xs text-slate-400 font-mono mt-1">ID: {selectedNode.id}</div>
                </div>

                {/* Dynamic Form based on Label/Type */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-200 border-b border-slate-700 pb-2">Configuration</h3>

                    {/* Common: Interval / Time based */}
                    {(label === 'Interval' || label === 'Timer' || label === 'Debounce') && (
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Duration (ms)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-950 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 outline-none"
                                value={localParams.duration || 1000}
                                onChange={(e) => handleParamChange('duration', parseInt(e.target.value))}
                            />
                        </div>
                    )}

                    {/* Common: Expression / Predicate */}
                    {(label === 'Select' || label === 'Where' || label === 'Scan') && (
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                                {label === 'Select' ? 'Projection (x => ...)' : 'Predicate (x => ...)'}
                            </label>
                            <textarea
                                className="w-full bg-slate-950 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 outline-none font-mono text-sm h-24"
                                placeholder={label === 'Select' ? 'x * 10' : 'x % 2 == 0'}
                                value={localParams.expression || ''}
                                onChange={(e) => handleParamChange('expression', e.target.value)}
                            />
                            <div className="text-[10px] text-slate-500 mt-1">
                                Enter valid C# lambda body. Example: <code>x * 10</code>
                            </div>
                        </div>
                    )}

                    {/* Custom: Scan Seed */}
                    {label === 'Scan' && (
                        <div className="mt-4">
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Seed Value</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 outline-none"
                                value={localParams.seed || '0'}
                                onChange={(e) => handleParamChange('seed', e.target.value)}
                            />
                        </div>
                    )}

                    {/* Generic Fallback */}
                    {!['Interval', 'Timer', 'Debounce', 'Select', 'Where', 'Scan'].includes(label as string) && (
                        <div className="text-sm text-slate-500 italic">
                            No specific properties for this node type yet.
                        </div>
                    )}

                </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
                <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 bg-rose-950 text-rose-400 rounded hover:bg-rose-900 border border-rose-900 transition text-sm"
                >
                    <Trash2 size={16} /> Delete Node
                </button>
            </div>
        </div>
    );
};

export default PropertyPanel;
