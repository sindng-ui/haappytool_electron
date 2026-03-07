import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Zap, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { SplitAnalysisResult } from '../../hooks/useSplitAnalysis';

interface SplitAnalyzerPanelProps {
    results: SplitAnalysisResult[] | null;
    isLoading?: boolean;
    progress?: number;
    onClose: () => void;
    onJumpToLine?: (pane: 'left' | 'right', line: number) => void;
}

export const SplitAnalyzerPanel: React.FC<SplitAnalyzerPanelProps> = ({ results, isLoading, progress = 0, onClose, onJumpToLine }) => {
    const [sortKey, setSortKey] = useState<'deltaDiff' | 'countDiff' | 'newError'>('newError');
    const [sortDesc, setSortDesc] = useState(true);

    const sortedResults = useMemo(() => {
        if (!results) return [];
        return [...results].sort((a, b) => {
            let valA, valB;
            if (sortKey === 'newError') {
                valA = a.isNewError ? 1 : 0;
                valB = b.isNewError ? 1 : 0;
            } else if (sortKey === 'deltaDiff') {
                valA = a.deltaDiff;
                valB = b.deltaDiff;
            } else {
                valA = a.countDiff;
                valB = b.countDiff;
            }

            if (valA === valB) {
                // Secondary sort by count if same
                return Math.abs(b.countDiff) - Math.abs(a.countDiff);
            }

            return sortDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
        });
    }, [results, sortKey, sortDesc]);

    const formatDelta = (ms: number) => {
        if (ms === 0) return '0.0ms';
        if (Math.abs(ms) < 1) return `${ms.toFixed(3)}ms`;
        return `${ms.toFixed(1)}ms`;
    };

    const handleSort = (key: 'deltaDiff' | 'countDiff' | 'newError') => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
            setSortDesc(true);
        }
    };

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '35vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full bg-slate-950 border-b border-blue-500/30 flex flex-col overflow-hidden shadow-xl font-sans text-gray-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-slate-200">Split Analysis Report 📊</h3>
                    {isLoading || (progress > 0 && progress < 100) ? (
                        <div className="flex items-center gap-3 ml-4 bg-blue-500/5 px-3 py-1 rounded border border-blue-500/10">
                            <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                            <span className="text-[10px] text-blue-400 font-black animate-pulse uppercase tracking-[0.2em]">
                                ANALYZING LOGS{'.'.repeat((Math.floor(Date.now() / 500) % 3) + 1)} {progress}%
                            </span>
                        </div>
                    ) : (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full ml-2 font-bold uppercase tracking-wider">
                            {results?.length || 0} Nodes
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-950 border-b border-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="col-span-1 border-r border-slate-800/50 text-center">Status</div>
                <div className="col-span-5 border-r border-slate-800/50">Log Signature</div>
                <div
                    className="col-span-3 cursor-pointer hover:text-slate-200 border-r border-slate-800/50 text-center flex justify-center items-center gap-1 transition-colors"
                    onClick={() => handleSort('countDiff')}
                >
                    Frequency ± {sortKey === 'countDiff' && (sortDesc ? '↓' : '↑')}
                </div>
                <div
                    className="col-span-3 cursor-pointer hover:text-slate-200 text-center flex justify-center items-center gap-1 transition-colors"
                    onClick={() => handleSort('deltaDiff')}
                >
                    Gap Time ± (Speed) {sortKey === 'deltaDiff' && (sortDesc ? '↓' : '↑')}
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0 bg-slate-950/20">
                {isLoading && !results ? (
                    <div className="flex flex-col items-center justify-center p-8 h-full text-center bg-slate-950/40">
                        <div className="relative mb-6">
                            <RefreshCw className="w-16 h-16 text-blue-500/10 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-blue-100 font-bold text-lg tracking-tight mb-1">Comparing log streams...</p>
                        <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-[0.3em] animate-pulse">
                            CALCULATING DELTAS & FREQUENCY ({progress}%)
                        </p>
                        <div className="mt-6 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ ease: "easeOut" }}
                            />
                        </div>
                    </div>
                ) :
                    sortedResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-900/50 flex items-center justify-center mb-3 border border-slate-800">
                                <Zap className="w-8 h-8 text-slate-700" />
                            </div>
                            <p className="text-slate-400 font-medium text-sm">No identical matching signatures found.</p>
                            <p className="text-xs text-slate-500 mt-1 italic">Please ensure both sides have similar logs mapped.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {sortedResults.map((res, i) => {
                                const isSlower = res.deltaDiff > 10; // more than 10ms slower
                                const isFaster = res.deltaDiff < -10;
                                const isMore = res.countDiff > 0;
                                const isLess = res.countDiff < 0;

                                return (
                                    <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#252526] transition-colors items-center text-sm group">

                                        {/* Icon / Status */}
                                        <div className="col-span-1 flex justify-center">
                                            {res.isNewError ? (
                                                <div title="New Error!" className="w-6 h-6 rounded-md bg-red-500/20 text-red-500 flex items-center justify-center">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                            ) : res.isError ? (
                                                <div title="Existing Error" className="w-6 h-6 rounded-md bg-orange-500/20 text-orange-400 flex items-center justify-center">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                            ) : isSlower ? (
                                                <div title="Slower" className="w-6 h-6 rounded-md bg-yellow-500/20 text-yellow-500 flex items-center justify-center">
                                                    ⚠️
                                                </div>
                                            ) : isFaster ? (
                                                <div title="Faster" className="w-6 h-6 rounded-md bg-green-500/20 text-green-400 flex items-center justify-center">
                                                    ⚡
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-md bg-[#333] text-gray-400 flex items-center justify-center">
                                                    -
                                                </div>
                                            )}
                                        </div>

                                        {/* Signature */}
                                        <div className="col-span-5 flex items-center min-w-0 pr-2 gap-3 group/sig">
                                            {/* From (Previous) */}
                                            <div className="flex flex-col min-w-0 flex-1 py-1 items-start">
                                                {res.prevFileName && res.prevFunctionName ? (
                                                    <>
                                                        <span
                                                            className="text-blue-300 truncate font-mono text-[10px] uppercase tracking-tighter w-full text-left"
                                                            title={res.prevFileName}
                                                        >
                                                            {res.prevFileName}
                                                        </span>
                                                        <span
                                                            className="text-purple-300 truncate font-mono text-[9px] w-full text-left"
                                                            title={res.prevFunctionName}
                                                        >
                                                            {res.prevFunctionName}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span
                                                        className="text-gray-400 truncate font-mono text-[10px] w-full text-left"
                                                        title={res.prevPreview || 'START'}
                                                    >
                                                        {res.prevPreview || 'START'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-center justify-center flex-shrink-0">
                                                <ArrowRight className="w-4 h-4 text-blue-400 drop-shadow-[0_0_3px_rgba(96,165,250,0.5)]" />
                                            </div>

                                            {/* To (Current) */}
                                            <div className="flex flex-col min-w-0 flex-1 py-1 items-start">
                                                {res.fileName && res.functionName ? (
                                                    <>
                                                        <span
                                                            className="font-semibold text-blue-300 truncate font-mono text-xs w-full text-left"
                                                            title={res.fileName}
                                                        >
                                                            {res.fileName}
                                                        </span>
                                                        <span
                                                            className="text-purple-300 truncate font-mono text-[11px] mt-0.5 w-full text-left"
                                                            title={res.functionName}
                                                        >
                                                            {res.functionName}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span
                                                        className="text-gray-300 truncate font-mono text-[11px] leading-tight w-full text-left"
                                                        title={res.preview || 'Unknown Signature'}
                                                    >
                                                        {res.preview || 'Unknown Signature'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Count Diff */}
                                        <div className="col-span-3 flex flex-col items-center justify-center border-l border-[#333]/50">
                                            <div className="flex items-center gap-1.5 font-mono text-xs">
                                                <span className="text-gray-500">{res.leftCount}</span>
                                                <ArrowRight className="w-3 h-3 text-gray-600" />
                                                <span className="text-gray-300">{res.rightCount}</span>
                                            </div>
                                            <div className={`text-[11px] font-bold mt-1 px-1.5 py-[1px] rounded flex items-center gap-0.5 ${isMore ? 'text-red-400 bg-red-400/10' :
                                                isLess ? 'text-green-400 bg-green-400/10' :
                                                    'text-gray-500'
                                                }`}>
                                                {isMore && <ArrowUp className="w-3 h-3" />}
                                                {isLess && <ArrowDown className="w-3 h-3" />}
                                                {res.countDiff > 0 ? `+${res.countDiff}` : res.countDiff}
                                            </div>
                                        </div>

                                        {/* Delta Diff */}
                                        <div className="col-span-3 flex flex-col items-center justify-center border-l border-[#333]/50">
                                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                                <span className="text-gray-500">{formatDelta(res.leftAvgDelta)}</span>
                                                <ArrowRight className="w-3 h-3 text-gray-600" />
                                                <span className="text-gray-300">{formatDelta(res.rightAvgDelta)}</span>
                                            </div>
                                            <div className={`text-[11px] font-bold mt-1 px-1.5 py-[1px] rounded flex items-center gap-0.5 ${isSlower ? 'text-orange-400 bg-orange-400/10' :
                                                isFaster ? 'text-emerald-400 bg-emerald-400/10' :
                                                    'text-gray-500'
                                                }`}>
                                                {isSlower && <ArrowUp className="w-3 h-3" />}
                                                {isFaster && <ArrowDown className="w-3 h-3" />}
                                                {res.deltaDiff > 0 ? '+' : ''}{formatDelta(res.deltaDiff)}
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>
        </motion.div>
    );
};
