import React, { useEffect, useRef, useMemo } from 'react';
import { Pipeline, PipelineItem, CommandBlock, ExecutionStats } from '../types';
import * as Lucide from 'lucide-react';

interface PipelineRunnerProps {
    pipeline: Pipeline;
    blocks: CommandBlock[];
    logs: string[];
    activeItemId: string | null;
    stats: ExecutionStats;
    completedCount?: number;
    isRunning: boolean;
    onStop: () => void;
    onClose: () => void;
}

const PipelineRunner: React.FC<PipelineRunnerProps> = ({ pipeline, blocks, logs, activeItemId, stats, completedCount, isRunning, onStop, onClose }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Calculate Progress
    const totalItems = useMemo(() => {
        const countItems = (items: PipelineItem[]): number => {
            let count = 0;
            for (const item of items) {
                if (item.type === 'loop') {
                    const loopCount = item.loopCount || 1;
                    const childrenCount = countItems(item.children || []);
                    count += childrenCount * loopCount;
                } else if (item.type === 'block') { // Only count blocks as steps, loops are containers
                    count += 1;
                }
            }
            return count;
        };
        return countItems(pipeline.items);
    }, [pipeline]);

    const currentStep = completedCount !== undefined ? completedCount : 0;
    const progress = Math.min(100, (currentStep / (totalItems || 1)) * 100);

    const startTime = stats[pipeline.items[0]?.id]?.startTime;
    const runningDuration = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : '0.0';

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                        <Lucide.ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{pipeline.name}</h2>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                            {isRunning ? (
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    Running...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                                    Finished
                                </div>
                            )}
                            <div className="w-32 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${isRunning ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <span>{currentStep}/{totalItems} steps</span>
                        </div>
                    </div>
                </div>
                {isRunning && (
                    <button
                        onClick={onStop}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95"
                    >
                        <Lucide.Square size={16} fill="currentColor" />
                        STOP
                    </button>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Visual Flow - Vertical */}
                <div className="w-1/2 p-6 overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div className="max-w-2xl mx-auto border-l-2 border-indigo-100 dark:border-indigo-900/30 pl-6 py-4 space-y-4">
                        <RunnerItemList
                            items={pipeline.items}
                            blocks={blocks}
                            activeItemId={activeItemId}
                            stats={stats}
                        />
                    </div>
                </div>

                {/* Logs */}
                <div className="w-1/2 flex flex-col bg-black text-green-400 font-mono text-xs">
                    <div className="p-2 bg-slate-900 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                        Execution Logs
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
                        {logs.map((log, idx) => (
                            <div key={idx} className="break-all whitespace-pre-wrap">
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const RunnerItemList: React.FC<{
    items: PipelineItem[],
    blocks: CommandBlock[],
    activeItemId: string | null,
    stats: ExecutionStats
}> = ({ items, blocks, activeItemId, stats }) => {
    return (
        <div className="space-y-3">
            {items.map(item => {
                const isActive = item.id === activeItemId;
                const itemStats = stats[item.id];
                const isCompleted = !!itemStats?.endTime;

                // Duration Formatting
                let durationDisplay = null;
                if (itemStats?.duration !== undefined) {
                    const dur = itemStats.duration;
                    if (dur === 0) durationDisplay = '0s';
                    else durationDisplay = (dur / 1000).toFixed(2) + 's';
                }

                if (item.type === 'loop') {
                    return (
                        <div key={item.id} className={`rounded-lg border-2 overflow-hidden transition-all duration-300 transform 
                            ${isActive
                                ? 'border-orange-500 shadow-orange-500/20 shadow-lg scale-[1.02]'
                                : 'border-orange-200 dark:border-orange-900/40'
                            } ${isCompleted ? 'opacity-70 grayscale-[0.8]' : ''}
                            `}
                        >
                            <div className="bg-orange-100 dark:bg-orange-900/60 p-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Lucide.Repeat size={14} className="text-orange-600 dark:text-orange-400" />
                                    <span className="text-xs font-bold text-orange-800 dark:text-orange-200">Loop {item.loopCount}x</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {itemStats?.status === 'error' && <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Error</span>}
                                    {isCompleted && durationDisplay && (
                                        <span className="text-xs font-mono text-orange-700 dark:text-orange-300 bg-white/50 px-1.5 py-0.5 rounded">
                                            {durationDisplay}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 pl-4 bg-orange-50 dark:bg-slate-900/50">
                                <RunnerItemList items={item.children || []} blocks={blocks} activeItemId={activeItemId} stats={stats} />
                            </div>
                        </div>
                    )
                }

                // Block
                const block = blocks.find(b => b.id === item.blockId);
                return (
                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 relative overflow-hidden
                        ${isActive
                            ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-lg translate-x-1'
                            : isCompleted
                                ? 'bg-slate-50 dark:bg-slate-900 border-green-200 dark:border-green-900/30'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                    >
                        {isCompleted && itemStats?.status === 'success' && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                        )}
                        {isCompleted && itemStats?.status === 'error' && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                        )}

                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                {isCompleted ? (
                                    itemStats?.status === 'error' ? <Lucide.XCircle size={16} className="text-red-500" /> : <Lucide.Check size={16} className="text-green-600" />
                                ) : (
                                    <Lucide.Box size={16} />
                                )}
                            </div>
                            <div>
                                <span className="font-bold text-xs sm:text-sm block text-slate-800 dark:text-slate-200">{block?.name || 'Unknown'}</span>
                                {isActive && !isCompleted && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">Running...</span>}
                            </div>
                        </div>

                        {/* Result Display */}
                        <div className="flex items-center gap-2">
                            {itemStats?.status === 'error' ? (
                                <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded">Error</span>
                            ) : (
                                isCompleted && durationDisplay && (
                                    <div className="flex items-center gap-1 text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                        <Lucide.Clock size={12} />
                                        <span>{durationDisplay}</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    )
};

export default PipelineRunner;
