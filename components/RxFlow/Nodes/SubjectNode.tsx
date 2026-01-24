import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { RxNodeData } from '../constants';
import { useRxFlowStore } from '../RxFlowStore';
import { Activity, Zap, History, CheckCircle, Play, XCircle, Check } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
    Subject: Zap,
    BehaviorSubject: Activity,
    ReplaySubject: History,
    AsyncSubject: CheckCircle
};

interface SubjectNodeProps extends NodeProps<RxNodeData> { }

const SubjectNode: React.FC<SubjectNodeProps> = ({ data, selected, id }) => {
    const { updateNodeData, triggerResimulation } = useRxFlowStore();
    const Icon = TYPE_ICONS[data.label] || Zap;
    const [showControls, setShowControls] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const params = data.params || {};
    const emissions = data.emissions || [];
    const manualInjections = data.manualInjections || [];

    // Manual injection handlers
    const handleOnNext = () => {
        if (!inputValue.trim()) return;
        const newInjections = [...manualInjections, { type: 'next', value: inputValue, time: Date.now() }];
        updateNodeData(id, { manualInjections: newInjections });
        setInputValue('');

        // Trigger re-simulation to apply the injection
        setTimeout(() => triggerResimulation(), 100);
    };

    const handleOnError = () => {
        const newInjections = [...manualInjections, { type: 'error', value: 'Error', time: Date.now() }];
        updateNodeData(id, { manualInjections: newInjections });
        setTimeout(() => triggerResimulation(), 100);
    };

    const handleOnCompleted = () => {
        const newInjections = [...manualInjections, { type: 'complete', time: Date.now() }];
        updateNodeData(id, { manualInjections: newInjections });
        setTimeout(() => triggerResimulation(), 100);
    };

    // Get current value for BehaviorSubject
    const getCurrentValue = () => {
        if (data.label === 'BehaviorSubject') {
            const lastEmission = emissions[emissions.length - 1];
            return lastEmission !== undefined ? lastEmission : (params.initialValue || 0);
        }
        return null;
    };

    const currentValue = getCurrentValue();

    return (
        <div
            className={`
                relative px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
                transition-all duration-200
                ${selected ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-amber-500'}
                bg-amber-950/50
                hover:shadow-indigo-500/10
            `}
            onDoubleClick={() => setShowControls(!showControls)}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-slate-300 !w-3 !h-3 !border-slate-800"
            />

            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-amber-400'}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <div className="text-sm font-bold text-slate-200">{data.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">SUBJECT</div>
                </div>
            </div>

            {/* Type-specific displays */}
            {data.label === 'BehaviorSubject' && currentValue !== null && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Current Value:</div>
                    <div className="text-xs font-mono text-green-400 bg-slate-950/50 rounded px-2 py-1">
                        {typeof currentValue === 'object' ? JSON.stringify(currentValue) : currentValue}
                    </div>
                </div>
            )}

            {data.label === 'ReplaySubject' && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">
                        Buffer: {params.bufferSize || 1}
                    </div>
                    {emissions.length > 0 && (
                        <div className="max-h-16 overflow-y-auto bg-slate-950/50 rounded p-1 space-y-0.5">
                            {emissions.slice(-(params.bufferSize || 1)).map((em: any, idx: number) => (
                                <div key={idx} className="text-[9px] font-mono text-blue-400">
                                    {typeof em === 'object' ? JSON.stringify(em) : em}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {data.label === 'AsyncSubject' && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">State:</div>
                    <div className={`text-xs font-mono px-2 py-1 rounded ${manualInjections.some((inj: any) => inj.type === 'complete')
                        ? 'text-yellow-400 bg-yellow-900/20'
                        : 'text-slate-400 bg-slate-900/50'
                        }`}>
                        {manualInjections.some((inj: any) => inj.type === 'complete') ? '✓ Completed' : 'Pending'}
                    </div>
                </div>
            )}

            {/* Manual Injection Controls */}
            {showControls && (
                <div className="mt-2 pt-2 border-t border-amber-700/50 space-y-2">
                    <div className="text-[10px] text-amber-400 uppercase mb-1">Manual Injection:</div>
                    <div className="flex gap-1">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleOnNext()}
                            placeholder="Value..."
                            className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOnNext(); }}
                            className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] flex items-center justify-center gap-1"
                            title="OnNext"
                        >
                            <Play size={10} />
                            Next
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOnError(); }}
                            className="flex-1 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] flex items-center justify-center gap-1"
                            title="OnError"
                        >
                            <XCircle size={10} />
                            Error
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOnCompleted(); }}
                            className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] flex items-center justify-center gap-1"
                            title="OnCompleted"
                        >
                            <Check size={10} />
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-indigo-500 !w-3 !h-3 !border-slate-800"
            />
        </div>
    );
};

export default memo(SubjectNode);
