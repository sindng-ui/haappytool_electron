import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, RefreshCw, List, LayoutDashboard, TrendingUp, Activity } from 'lucide-react';
import { SplitAnalysisResult } from '../../hooks/useSplitAnalysis';

interface SplitAnalyzerPanelProps {
    results: SplitAnalysisResult[] | null;
    isLoading?: boolean;
    progress?: number;
    onClose: () => void;
    onJumpToLine?: (pane: 'left' | 'right', line: number) => void;
}

type AnalysisTab = 'summary' | 'list';

export const SplitAnalyzerPanel: React.FC<SplitAnalyzerPanelProps> = ({ results, isLoading, progress = 0, onClose, onJumpToLine }) => {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('summary');
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
                return Math.abs(b.countDiff) - Math.abs(a.countDiff);
            }

            return sortDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
        });
    }, [results, sortKey, sortDesc]);

    // 📊 Summary Data Calculation
    const summaryData = useMemo(() => {
        if (!results) return null;
        const newErrors = results.filter(r => r.isNewError).length;
        const totalNodes = results.length;
        const regressions = results.filter(r => r.deltaDiff > 10).length; // Over 10ms slower
        const spams = results.filter(r => r.countDiff > 20).length; // Over 20 more logs

        const topRegressions = [...results]
            .filter(r => r.deltaDiff > 0)
            .sort((a, b) => b.deltaDiff - a.deltaDiff)
            .slice(0, 3);

        const topSpams = [...results]
            .filter(r => r.countDiff > 0)
            .sort((a, b) => b.countDiff - a.countDiff)
            .slice(0, 3);

        return { newErrors, totalNodes, regressions, spams, topRegressions, topSpams };
    }, [results]);

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
            animate={{ height: '40vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full bg-slate-950 border-b border-blue-500/30 flex flex-col overflow-hidden shadow-xl font-sans text-gray-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-4">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-bold text-slate-100">Analysis Engine 펭-하! 🐧</h3>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shadow-inner">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black transition-all ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <LayoutDashboard size={12} /> SUMMARY
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <List size={12} /> DETAILED LIST
                        </button>
                    </div>

                    {isLoading || (progress > 0 && progress < 100) ? (
                        <div className="flex items-center gap-3 ml-4 bg-blue-500/5 px-3 py-1 rounded border border-blue-500/10">
                            <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                            <span className="text-[10px] text-blue-400 font-black animate-pulse uppercase tracking-[0.2em]">
                                ANALYZING LOGS{'.'.repeat((Math.floor(Date.now() / 500) % 3) + 1)} {progress}%
                            </span>
                        </div>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col relative min-h-0 bg-[#0c1117]">

                {isLoading && !results ? (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                        <div className="relative mb-6">
                            <RefreshCw className="w-16 h-16 text-blue-500/20 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-8 h-8 text-blue-500 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-blue-100 font-bold text-xl tracking-tight mb-2">Engaging Analysis Core...</p>
                        <p className="text-xs text-blue-400/60 font-black uppercase tracking-[0.4em] animate-pulse">
                            CALCULATING DELTAS & FREQUENCY ({progress}%)
                        </p>
                        <div className="mt-8 w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ ease: "easeOut" }}
                            />
                        </div>
                    </div>
                ) : null}

                <AnimatePresence mode="wait">
                    {activeTab === 'summary' && summaryData ? (
                        <motion.div
                            key="summary"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            className="flex-1 overflow-y-auto p-4 custom-scrollbar"
                        >
                            {/* Summary Cards */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-blue-500/30 transition-all">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Mapped Nodes</p>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-white leading-none">{summaryData.totalNodes}</span>
                                        <span className="text-xs text-slate-500 font-bold mb-1">Nodes</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-4 rounded-xl shadow-sm transition-all ${summaryData.newErrors > 0 ? 'border-rose-500/50 hover:bg-rose-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New Regressive Errors</p>
                                        <AlertTriangle className={`w-3 h-3 ${summaryData.newErrors > 0 ? 'text-rose-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className={`text-3xl font-black leading-none ${summaryData.newErrors > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{summaryData.newErrors}</span>
                                        <span className="text-xs text-slate-500 font-bold mb-1 uppercase">Issues</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-4 rounded-xl shadow-sm transition-all ${summaryData.regressions > 0 ? 'border-orange-500/50 hover:bg-orange-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Performance Regressions</p>
                                        <TrendingUp className={`w-3 h-3 ${summaryData.regressions > 0 ? 'text-orange-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className={`text-3xl font-black leading-none ${summaryData.regressions > 0 ? 'text-orange-400' : 'text-slate-400'}`}>{summaryData.regressions}</span>
                                        <span className="text-xs text-slate-500 font-bold mb-1 uppercase">Slower</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-4 rounded-xl shadow-sm transition-all ${summaryData.spams > 0 ? 'border-blue-500/50 hover:bg-blue-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Frequency Spikes</p>
                                        <Activity className={`w-3 h-3 ${summaryData.spams > 0 ? 'text-blue-400' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-blue-400 leading-none">{summaryData.spams}</span>
                                        <span className="text-xs text-slate-500 font-bold mb-1 uppercase">Increased</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Insights */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Top Regressions */}
                                <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
                                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                                        <TrendingUp size={14} className="text-orange-500" />
                                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Top Performance Regressions</h4>
                                    </div>
                                    <div className="flex-1 p-2 flex flex-col gap-2">
                                        {summaryData.topRegressions.length > 0 ? summaryData.topRegressions.map((res, i) => (
                                            <div key={i} className="flex flex-col bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 hover:border-orange-500/30 transition-all cursor-default group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-200 truncate pr-4">{res.functionName || res.preview.substring(0, 40)}</span>
                                                    <span className="text-[11px] font-black text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">+{formatDelta(res.deltaDiff)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                                    <span>{formatDelta(res.leftAvgDelta)}</span>
                                                    <ArrowRight size={10} />
                                                    <span className="text-slate-300 font-bold">{formatDelta(res.rightAvgDelta)}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="flex items-center justify-center p-8 text-xs text-slate-600 italic">No significant regressions found. 펭-굿! ✨</div>
                                        )}
                                    </div>
                                </div>

                                {/* Top Spams */}
                                <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
                                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                                        <Activity size={14} className="text-blue-400" />
                                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Top Frequency Increases (Spam)</h4>
                                    </div>
                                    <div className="flex-1 p-2 flex flex-col gap-2">
                                        {summaryData.topSpams.length > 0 ? summaryData.topSpams.map((res, i) => (
                                            <div key={i} className="flex flex-col bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 hover:border-blue-500/30 transition-all cursor-default">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-200 truncate pr-4">{res.functionName || res.preview.substring(0, 40)}</span>
                                                    <span className="text-[11px] font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">+{res.countDiff} calls</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                                    <span>{res.leftCount} logs</span>
                                                    <ArrowRight size={10} />
                                                    <span className="text-blue-300 font-bold">{res.rightCount} logs</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="flex items-center justify-center p-8 text-xs text-slate-600 italic">Frequency is stable. 펭-굿! ❄️</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="flex-1 flex flex-col"
                        >
                            {/* List Header */}
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] shrink-0">
                                <div className="col-span-1 text-center">STATUS</div>
                                <div className="col-span-5">LOG SIGNATURE</div>
                                <div
                                    className="col-span-3 cursor-pointer hover:text-blue-400 border-l border-slate-800/50 text-center flex justify-center items-center gap-1.5 transition-colors"
                                    onClick={() => handleSort('countDiff')}
                                >
                                    FREQUENCY ± {sortKey === 'countDiff' && (sortDesc ? '↓' : '↑')}
                                </div>
                                <div
                                    className="col-span-3 cursor-pointer hover:text-blue-400 border-l border-slate-800/50 text-center flex justify-center items-center gap-1.5 transition-colors"
                                    onClick={() => handleSort('deltaDiff')}
                                >
                                    GAP TIME ± {sortKey === 'deltaDiff' && (sortDesc ? '↓' : '↑')}
                                </div>
                            </div>

                            {/* Detailed List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0 bg-slate-950/20">
                                {sortedResults.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                                        <Zap className="w-12 h-12 text-slate-800 mb-4" />
                                        <p className="text-slate-400 font-bold text-sm">No signature matches discovered.</p>
                                        <p className="text-xs text-slate-600 mt-2 italic px-8">Analysis requires corresponding patterns in both log streams.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-800/30">
                                        {sortedResults.map((res, i) => {
                                            const isSlower = res.deltaDiff > 10;
                                            const isFaster = res.deltaDiff < -10;
                                            const isMore = res.countDiff > 0;
                                            const isLess = res.countDiff < 0;

                                            return (
                                                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-900/60 transition-all items-center text-sm group">
                                                    <div className="col-span-1 flex justify-center">
                                                        {res.isNewError ? (
                                                            <div title="New Error!" className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-500 flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.3)] border border-rose-500/30">
                                                                <AlertTriangle className="w-4 h-4" />
                                                            </div>
                                                        ) : res.isError ? (
                                                            <div title="Existing Error" className="w-6 h-6 rounded-md bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                                                                <AlertTriangle className="w-4 h-4" />
                                                            </div>
                                                        ) : isSlower ? (
                                                            <div title="Slower" className="w-6 h-6 rounded-md bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 font-bold">!</div>
                                                        ) : isFaster ? (
                                                            <div title="Faster" className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">⚡</div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-md bg-slate-800/30 text-slate-600 flex items-center justify-center">-</div>
                                                        )}
                                                    </div>

                                                    <div className="col-span-5 flex items-center min-w-0 pr-4 gap-3">
                                                        <div className="flex flex-col min-w-0 flex-1 py-1">
                                                            {res.prevFileName ? (
                                                                <>
                                                                    <span className="text-slate-500 truncate font-mono text-[9px] uppercase tracking-tighter w-full text-left">{res.prevFileName}</span>
                                                                    <span className="text-slate-400 truncate font-mono text-[10px] w-full text-left">{res.prevFunctionName || res.prevPreview.substring(0, 30)}</span>
                                                                </>
                                                            ) : <span className="text-slate-600 text-[10px] font-black tracking-widest uppercase">START</span>}
                                                        </div>

                                                        <ArrowRight className="w-3 h-3 text-blue-500/40 shrink-0" />

                                                        <div className="flex flex-col min-w-0 flex-1 py-1">
                                                            {res.fileName ? (
                                                                <>
                                                                    <span className="font-black text-blue-400 truncate font-mono text-[10px] uppercase w-full text-left">{res.fileName}</span>
                                                                    <span className="text-slate-200 truncate font-mono text-[11px] mt-0.5 w-full text-left font-semibold">{res.functionName || res.preview.substring(0, 30)}</span>
                                                                </>
                                                            ) : <span className="text-slate-300 font-mono text-xs truncate w-full text-left">{res.preview.substring(0, 50)}</span>}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-3 flex flex-col items-center justify-center border-l border-slate-800/50">
                                                        <div className="flex items-center gap-2 font-mono text-[11px]">
                                                            <span className="text-slate-500">{res.leftCount}</span>
                                                            <ArrowRight className="w-2 h-2 text-slate-700" />
                                                            <span className="text-slate-300">{res.rightCount}</span>
                                                        </div>
                                                        <div className={`text-[10px] font-black mt-1.5 px-2 py-0.5 rounded flex items-center gap-1 ${isMore ? 'text-rose-400 bg-rose-400/10' : isLess ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 bg-slate-800/30'}`}>
                                                            {isMore && <ArrowUp className="w-2 h-2" />}
                                                            {isLess && <ArrowDown className="w-2 h-2" />}
                                                            {res.countDiff > 0 ? `+${res.countDiff}` : res.countDiff}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-3 flex flex-col items-center justify-center border-l border-slate-800/50">
                                                        <div className="flex items-center gap-2 font-mono text-[11px]">
                                                            <span className="text-slate-500">{formatDelta(res.leftAvgDelta)}</span>
                                                            <ArrowRight className="w-2 h-2 text-slate-700" />
                                                            <span className="text-slate-300">{formatDelta(res.rightAvgDelta)}</span>
                                                        </div>
                                                        <div className={`text-[10px] font-black mt-1.5 px-2 py-0.5 rounded flex items-center gap-1 ${isSlower ? 'text-orange-400 bg-orange-400/10' : isFaster ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 bg-slate-800/30'}`}>
                                                            {isSlower && <ArrowUp className="w-2 h-2" />}
                                                            {isFaster && <ArrowDown className="w-2 h-2" />}
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
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
