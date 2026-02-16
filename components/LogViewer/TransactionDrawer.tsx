
import React, { useMemo, useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { formatTransactionFlow } from '../../utils/transactionAnalysis';
import { extractTimestamp, formatDuration } from '../../utils/logTime';

interface TransactionLogItem {
    lineNum: number;
    content: string;
    visualIndex: number;
    delta?: string | null;
}

interface TransactionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    identity: { type: string, value: string } | null;
    logs: { lineNum: number, content: string, visualIndex: number }[];
    isLoading: boolean;
    onJumpToLine: (lineNum: number, visualIndex: number) => void;
}

const TransactionDrawer: React.FC<TransactionDrawerProps> = ({
    isOpen,
    onClose,
    identity,
    logs,
    isLoading,
    onJumpToLine
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    // Reset selected index when identity changes or drawer closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedIndex(-1);
        }
    }, [isOpen, identity]);

    // 💡 Performance: Only calculate formatted flow when logs change
    const analyzedLogs = useMemo(() => {
        if (!logs || logs.length === 0) return [];
        return formatTransactionFlow(logs) as TransactionLogItem[];
    }, [logs]);

    // 💡 Performance: Calculate total duration (O(1) access to first/last)
    const totalDuration = useMemo(() => {
        if (logs.length < 2) return null;

        try {
            const first = logs[0].content;
            const last = logs[logs.length - 1].content;

            const start = extractTimestamp(first);
            const end = extractTimestamp(last);

            if (start !== null && end !== null) {
                const diffMs = Math.abs(end - start);
                return formatDuration(diffMs);
            }
        } catch (e) {
            console.warn('Failed to calculate duration', e);
        }
        return null;
    }, [logs]);

    return (
        <div
            className={`fixed top-[48px] bottom-0 right-0 w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-[150] border-l border-slate-200 dark:border-slate-800 flex flex-col transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                }`}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                        <Lucide.Activity size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">Transaction Analyzer</h3>
                            {!isLoading && logs.length > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-full shadow-sm min-w-[24px] text-center">
                                        {selectedIndex !== -1 ? `${selectedIndex + 1} / ${logs.length}` : logs.length}
                                    </span>
                                    {totalDuration && (
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/30 whitespace-nowrap">
                                            {totalDuration}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize truncate">
                            {identity?.type}: <span className="font-mono text-indigo-500">{identity?.value}</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors shrink-0 ml-2"
                >
                    <Lucide.X size={20} />
                </button>
            </div>

            {/* Content - Virtualized with Virtuoso */}
            <div className="flex-1 overflow-hidden relative">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                        <div className="relative">
                            <Lucide.Loader2 size={40} className="animate-premium-spin text-indigo-500" />
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
                        </div>
                        <span className="text-sm animate-pulse font-medium tracking-tight">Analyzing Transaction Flow...</span>
                    </div>
                ) : analyzedLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Lucide.SearchX size={48} className="opacity-20" />
                        <span className="text-sm">No matching transactions found.</span>
                    </div>
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={analyzedLogs}
                        totalCount={analyzedLogs.length}
                        className="custom-scrollbar"
                        itemContent={(index, log) => (
                            <div className="px-4 py-1 group relative">
                                {/* Delta Time */}
                                {log.delta && (
                                    <div className="ml-4 pl-6 border-l-2 border-slate-200 dark:border-slate-800 py-1 mb-1">
                                        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded shadow-sm">
                                            {log.delta}
                                        </span>
                                    </div>
                                )}

                                {/* Log Line Card */}
                                <div
                                    onClick={() => {
                                        setSelectedIndex(index);
                                        onJumpToLine(log.lineNum, log.visualIndex);
                                    }}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md group active:scale-[0.98] ${selectedIndex === index
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-400/50'
                                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-mono ${selectedIndex === index ? 'text-indigo-500' : 'text-slate-400'}`}>
                                            Line {log.lineNum}
                                        </span>
                                        <Lucide.ExternalLink size={12} className={`${selectedIndex === index ? 'text-indigo-500 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
                                    </div>
                                    <div className={`text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed ${selectedIndex === index ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'
                                        }`}>
                                        {log.content}
                                    </div>
                                </div>
                            </div>
                        )}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-400 flex justify-center items-center px-4">
                <span className="flex items-center gap-1 opacity-70">
                    <Lucide.Info size={12} />
                    Click an item to jump to the log line
                </span>
            </div>
        </div>
    );
};

export default React.memo(TransactionDrawer);
