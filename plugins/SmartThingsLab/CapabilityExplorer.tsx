import React from 'react';
import * as Lucide from 'lucide-react';
import { STCapability } from './types';

const { Box, Zap, Database, ChevronRight, ChevronDown } = Lucide;

interface CapabilityExplorerProps {
    capabilities: STCapability[];
    loading?: boolean;
}

export const CapabilityExplorer: React.FC<CapabilityExplorerProps> = ({ capabilities, loading }) => {
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-8 text-slate-400">
                <Lucide.Loader2 size={24} className="animate-spin mr-2" />
                Loading specification...
            </div>
        );
    }

    if (capabilities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Box size={48} className="mb-4 opacity-20" />
                <p>No capabilities to display</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 overflow-y-auto h-full">
            {capabilities.map((cap) => (
                <div key={`${cap.id}_${cap.version}`} className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <button
                        onClick={() => toggleExpand(cap.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="text-amber-500" />
                            <span className="font-bold text-sm">{cap.id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono">v{cap.version}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${cap.status === 'live' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                {cap.status}
                            </span>
                        </div>
                        {expandedIds.has(cap.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {expandedIds.has(cap.id) && (
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 space-y-4">
                            {/* Attributes */}
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Database size={10} /> Attributes
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(cap.attributes).map(([name, attr]) => (
                                        <div key={name} className="p-2 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-xs shadow-sm">
                                            <div className="font-bold text-indigo-500 mb-1">{name}</div>
                                            <div className="text-slate-500 font-mono text-[10px] mb-1">{attr.schema?.type || 'unknown'}</div>
                                            {attr.schema?.enum && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {attr.schema.enum.map(e => (
                                                        <span key={e} className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-medium border border-indigo-100 dark:border-indigo-900/30">{e}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Commands */}
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Zap size={10} /> Commands
                                </h4>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(cap.commands).map(([name, cmd]) => (
                                        <div key={name} className="p-2 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-xs shadow-sm">
                                            <div className="font-bold text-amber-600 mb-1">{name}</div>
                                            {cmd.arguments && cmd.arguments.length > 0 ? (
                                                <div className="mt-1 space-y-1">
                                                    {cmd.arguments.map(arg => (
                                                        <div key={arg.name} className="flex items-center gap-2 text-[10px]">
                                                            <span className="text-slate-400">└─</span>
                                                            <span className="font-semibold">{arg.name}</span>
                                                            <span className="text-slate-400 font-mono">({arg.schema.type}{arg.optional ? '?' : ''})</span>
                                                            {arg.schema.enum && (
                                                                <span className="text-slate-400 text-[9px]">[{arg.schema.enum.join(', ')}]</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-400 italic">No arguments</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
