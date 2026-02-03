import React, { useEffect, useRef, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Pipeline, PipelineItem, CommandBlock, ExecutionStats } from '../types';
import * as Lucide from 'lucide-react';
import { THEME } from '../theme';

import PipelineGraphRenderer from './PipelineGraphRenderer';

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
    embedded?: boolean;
    reportUrl?: string | null;
}

const PipelineRunner: React.FC<PipelineRunnerProps> = ({ pipeline, blocks, logs, activeItemId, stats, completedCount, isRunning, onStop, onClose, embedded, reportUrl }) => {
    const listContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active item in List View
    useEffect(() => {
        if (activeItemId && listContainerRef.current) {
            const activeEl = listContainerRef.current.querySelector(`[data-step-id="${activeItemId}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeItemId]);

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

    const [viewMode, setViewModeState] = React.useState<'list' | 'graph'>(() => {
        return (localStorage.getItem('blockTestViewMode') as 'list' | 'graph') || 'list';
    });

    const setViewMode = (mode: 'list' | 'graph') => {
        setViewModeState(mode);
        localStorage.setItem('blockTestViewMode', mode);
    };

    const handleSaveLogs = () => {
        const content = logs.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `execution_logs_${pipeline.name}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`flex flex-col h-full ${THEME.runner.container}`}>
            {/* Header */}
            <div className={`p-4 pr-36 flex justify-between items-center shadow-sm z-10 ${THEME.runner.header}`}>
                <div className="flex items-center gap-4">
                    {!embedded && (
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                            <Lucide.ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        {!embedded && <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{pipeline.name}</h2>}
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

                <div className="flex items-center gap-2">
                    {/* Report Button */}
                    {!isRunning && reportUrl && (
                        <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors nav-no-drag"
                        >
                            <Lucide.FileText size={16} />
                            <span className="hidden sm:inline">Report</span>
                        </a>
                    )}

                    {/* View Toggle */}
                    <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-lg flex items-center mr-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow text-indigo-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="List View"
                        >
                            <Lucide.List size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'graph' ? 'bg-white dark:bg-slate-600 shadow text-indigo-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="Graph View"
                        >
                            <Lucide.Network size={16} />
                        </button>
                    </div>

                    <button
                        onClick={handleSaveLogs}
                        className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
                        title="Save Logs to File"
                    >
                        <Lucide.Download size={16} />
                        <span className="hidden sm:inline">Save Logs</span>
                    </button>

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
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Visual Flow - Toggle between Graph and List */}
                <div className={`w-1/2 overflow-hidden relative ${THEME.runner.visual} flex flex-col`}>

                    {viewMode === 'list' ? (
                        <div ref={listContainerRef} className="absolute inset-0 overflow-y-auto p-6 scroll-smooth">
                            <div className="max-w-2xl mx-auto border-l-2 border-indigo-100 dark:border-indigo-900/30 pl-6 py-4 space-y-4">
                                <RunnerItemList
                                    items={pipeline.items}
                                    blocks={blocks}
                                    activeItemId={activeItemId}
                                    stats={stats}
                                />
                            </div>
                        </div>
                    ) : (
                        <PipelineGraphRenderer
                            items={pipeline.items}
                            blocks={blocks}
                            activeItemId={activeItemId}
                            stats={stats}
                            isRunning={isRunning}
                        />
                    )}
                </div>

                {/* Logs */}
                <div className={`w-1/2 flex flex-col font-mono text-xs ${THEME.runner.logs}`}>
                    <div className="p-2 bg-slate-900 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                        Execution Logs
                    </div>
                    <div className="flex-1 p-2">
                        <Virtuoso
                            style={{ height: '100%' }}
                            data={logs}
                            followOutput={'auto'}
                            itemContent={(index, log) => {
                                const isError = /error|fail|exception/i.test(log);
                                return (
                                    <div className={`break-all whitespace-pre-wrap py-0.5 ${isError ? 'text-red-500 font-bold' : 'text-slate-300'}`}>
                                        {log}
                                    </div>
                                );
                            }}
                        />
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
                        <div key={item.id} data-step-id={item.id} className={`rounded-lg border-2 overflow-hidden transition-all duration-300 transform 
                            ${isActive
                                ? 'border-orange-500 shadow-orange-500/20 shadow-lg scale-[1.02]'
                                : 'border-orange-200 dark:border-orange-900/40'
                            } ${isCompleted ? 'opacity-70 grayscale-[0.8]' : ''}
                            `}
                        >
                            <div className="bg-orange-100 dark:bg-orange-900/60 p-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Lucide.Repeat size={14} className="text-orange-600 dark:text-orange-400" />
                                    <span className="text-sm font-bold text-orange-800 dark:text-orange-200 bg-orange-200 dark:bg-orange-800 px-2 py-0.5 rounded">
                                        {itemStats?.status === 'running'
                                            ? `Running ${itemStats?.currentIteration || 1}/${itemStats?.totalIterations || item.loopCount}`
                                            : `Loop ${item.loopCount}x`}
                                    </span>
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

                if (item.type === 'conditional') {
                    const result = itemStats?.result; // We added this to stats
                    return (
                        <div key={item.id} data-step-id={item.id} className={`rounded-lg border-2 overflow-hidden transition-all duration-300 transform 
                            ${isActive
                                ? 'border-violet-500 shadow-violet-500/20 shadow-lg scale-[1.02]'
                                : 'border-violet-200 dark:border-violet-900/40'
                            } ${isCompleted ? 'opacity-90' : ''}
                            `}
                        >
                            <div className="bg-violet-100 dark:bg-violet-900/60 p-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="rotate-45 p-1 bg-violet-200 dark:bg-violet-800 rounded-sm">
                                        <Lucide.GitFork size={14} className="-rotate-45 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <span className="text-sm font-bold text-violet-800 dark:text-violet-200">
                                        Condition: {item.condition?.type === 'last_step_success' ? 'Last Step Success?' : 'Custom'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isCompleted && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${result ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'}`}>
                                            {result ? 'TRUE' : 'FALSE'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Children Container - Only show relevant path or both if not run? For list, maybe stack them? */}
                            <div className="flex flex-col border-t border-violet-200 dark:border-violet-800">
                                <div className={`p-3 pl-4 border-l-4 border-green-400 bg-green-50/50 dark:bg-green-900/10 ${!result && isCompleted ? 'opacity-40 grayscale' : ''}`}>
                                    <div className="text-[10px] font-bold text-green-600 mb-2 uppercase">True Path</div>
                                    <RunnerItemList items={item.children || []} blocks={blocks} activeItemId={activeItemId} stats={stats} />
                                </div>
                                <div className={`p-3 pl-4 border-l-4 border-orange-400 bg-orange-50/50 dark:bg-orange-900/10 ${result && isCompleted ? 'opacity-40 grayscale' : ''}`}>
                                    <div className="text-[10px] font-bold text-orange-600 mb-2 uppercase">False Path</div>
                                    <RunnerItemList items={item.elseChildren || []} blocks={blocks} activeItemId={activeItemId} stats={stats} />
                                </div>
                            </div>
                        </div>
                    );
                }

                // Block
                const block = blocks.find(b => b.id === item.blockId);
                return (
                    <div key={item.id} data-step-id={item.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 relative overflow-hidden
                        ${isActive
                            ? THEME.runner.item.active
                            : isCompleted
                                ? THEME.runner.item.completed
                                : THEME.runner.item.pending
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
                                <span className="font-bold text-xs sm:text-sm block text-slate-800 dark:text-slate-200">
                                    {block?.name || 'Unknown'}
                                    {item.blockId === 'special_sleep' && <span className="ml-2 text-violet-600 dark:text-violet-400">({item.sleepDuration || 1000}ms)</span>}
                                    {item.blockId === 'special_log_start' && <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-mono text-xs">({itemStats?.resolvedLabel || item.logFileName})</span>}
                                    {item.blockId === 'special_log_stop' && item.stopCommand && <span className="ml-2 text-red-600 dark:text-red-400 font-mono text-xs">({item.stopCommand})</span>}
                                </span>
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
