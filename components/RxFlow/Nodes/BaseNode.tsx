import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { RxNodeData } from '../constants';

// Icons for different types can be passed or determined here
import { Activity, Clock, Play, Filter, GitMerge, ArrowRightToLine } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
    source: Play,
    pipe: Filter,
    join: GitMerge,
    sink: ArrowRightToLine
};

interface BaseNodeProps extends NodeProps<RxNodeData> {
    category: 'source' | 'pipe' | 'join' | 'sink';
    icon?: React.ElementType;
}

const BaseNode: React.FC<BaseNodeProps> = ({ data, selected, category, icon: PropIcon }) => {
    const Icon = PropIcon || TYPE_ICONS[category] || Activity;

    // Determine Handle Configurations
    const showInput = category !== 'source';
    const showOutput = category !== 'sink';

    // Tailwind classes for categories
    const borderColors = {
        source: 'border-emerald-500',
        pipe: 'border-blue-500',
        join: 'border-purple-500',
        sink: 'border-rose-500'
    };

    const bgColors = {
        source: 'bg-emerald-950/50',
        pipe: 'bg-blue-950/50',
        join: 'bg-purple-950/50',
        sink: 'bg-rose-950/50'
    };

    const borderColor = borderColors[category] || 'border-slate-500';
    const bgColor = bgColors[category] || 'bg-slate-900';

    return (
        <div className={`
            relative px-4 py-3 rounded-xl shadow-lg border-2 min-w-[150px]
            transition-all duration-200
            ${selected ? 'border-indigo-400 ring-2 ring-indigo-500/30' : borderColor}
            ${bgColor}
            hover:shadow-indigo-500/10
        `}>
            {/* Input Handle */}
            {showInput && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!bg-slate-300 !w-3 !h-3 !border-slate-800"
                />
            )}

            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <div className="text-sm font-bold text-slate-200">{data.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{category.toUpperCase()}</div>
                </div>
            </div>

            {/* Parameter Preview */}
            {(() => {
                const params = data.params || {};
                const label = data.label;
                let paramText = '';

                // Format based on node type
                if (label === 'Interval' || label === 'Timer') {
                    paramText = `${params.duration || 1000}ms`;
                } else if (label === 'Select' || label === 'SelectMany') {
                    paramText = params.expression || 'x';
                } else if (label === 'Where') {
                    paramText = `where: ${params.expression || 'true'}`;
                } else if (label === 'Scan') {
                    paramText = `seed: ${params.seed || 0}`;
                } else if (label === 'Debounce' || label === 'Delay') {
                    paramText = `${params.duration || 500}ms`;
                } else if (Object.keys(params).length > 0) {
                    paramText = Object.values(params).join(', ');
                }

                if (!paramText) return null;

                return (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <div className="text-[11px] text-slate-400 font-mono">
                            {paramText}
                        </div>
                    </div>
                );
            })()}

            {/* Output Handle */}
            {showOutput && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-indigo-500 !w-3 !h-3 !border-slate-800"
                />
            )}

            {/* Sink Data Log - Show accumulated emissions */}
            {category === 'sink' && data.emissions && data.emissions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Received Data:</div>
                    <div className="max-h-24 overflow-y-auto bg-slate-950/50 rounded p-2 space-y-1">
                        {data.emissions.slice(-10).map((emission: any, idx: number) => (
                            <div key={idx} className="text-[10px] font-mono text-green-400">
                                {typeof emission === 'object' ? JSON.stringify(emission) : emission}
                            </div>
                        ))}
                        {data.emissions.length > 10 && (
                            <div className="text-[9px] text-slate-600">
                                ... and {data.emissions.length - 10} more
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(BaseNode);
