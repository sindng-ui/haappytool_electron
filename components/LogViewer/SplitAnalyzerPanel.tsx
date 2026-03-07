import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, RefreshCw, List, LayoutDashboard, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { SplitAnalysisResult } from '../../hooks/useSplitAnalysis';

interface SplitAnalyzerPanelProps {
    results: SplitAnalysisResult[] | null;
    isLoading?: boolean;
    progress?: number;
    onClose: () => void;
    onJumpToRange?: (side: 'left' | 'right', startLine: number, endLine: number) => void;
}

type AnalysisTab = 'summary' | 'list';

export const SplitAnalyzerPanel: React.FC<SplitAnalyzerPanelProps> = ({ results, isLoading, progress = 0, onClose, onJumpToRange }) => {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('summary');
    const [sortKey, setSortKey] = useState<'deltaDiff' | 'countDiff' | 'newError'>('newError');
    const [sortDesc, setSortDesc] = useState(true);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
        const improvements = results.filter(r => r.deltaDiff < -10).length; // Over 10ms faster
        const spams = results.filter(r => r.countDiff > 20).length; // Over 20 more logs

        const topChanges = [...results]
            .filter(r => Math.abs(r.deltaDiff) > 1) // Significant changes only
            .sort((a, b) => Math.abs(b.deltaDiff) - Math.abs(a.deltaDiff))
            .slice(0, 100);

        const topSpams = [...results]
            .filter(r => r.countDiff > 0)
            .sort((a, b) => b.countDiff - a.countDiff)
            .slice(0, 100);

        return { newErrors, totalNodes, regressions, improvements, spams, topChanges, topSpams };
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

    const handleItemClick = (res: SplitAnalysisResult) => {
        setSelectedKey(res.key);
        if (!onJumpToRange) return;

        // 🐧⚡ 좌측 구간 점프
        if (res.leftLineNum > 0) {
            const start = Math.min(res.leftLineNum, res.leftPrevLineNum);
            const end = Math.max(res.leftLineNum, res.leftPrevLineNum);
            onJumpToRange('left', start, end);
        }

        // 🐧⚡ 우측 구간 점프
        if (res.rightLineNum > 0) {
            const start = Math.min(res.rightLineNum, res.rightPrevLineNum);
            const end = Math.max(res.rightLineNum, res.rightPrevLineNum);
            onJumpToRange('right', start, end);
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
                            <div className="grid grid-cols-5 gap-3 mb-6">
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 shadow-sm hover:border-blue-500/30 transition-all">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Mapped Nodes</p>
                                    <div className="flex items-end gap-1.5">
                                        <span className="text-2xl font-black text-white leading-none">{summaryData.totalNodes}</span>
                                        <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Nodes</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-3 rounded-xl shadow-sm transition-all ${summaryData.newErrors > 0 ? 'border-rose-500/50 hover:bg-rose-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">New Errors</p>
                                        <AlertTriangle className={`w-3 h-3 ${summaryData.newErrors > 0 ? 'text-rose-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end gap-1.5">
                                        <span className={`text-2xl font-black leading-none ${summaryData.newErrors > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{summaryData.newErrors}</span>
                                        <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Issues</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-3 rounded-xl shadow-sm transition-all ${summaryData.regressions > 0 ? 'border-orange-500/50 hover:bg-orange-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Regressions</p>
                                        <TrendingUp className={`w-3 h-3 ${summaryData.regressions > 0 ? 'text-orange-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end gap-1.5">
                                        <span className={`text-2xl font-black leading-none ${summaryData.regressions > 0 ? 'text-orange-400' : 'text-slate-400'}`}>{summaryData.regressions}</span>
                                        <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Slower</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-3 rounded-xl shadow-sm transition-all ${summaryData.improvements > 0 ? 'border-emerald-500/50 hover:bg-emerald-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Improvements</p>
                                        <TrendingDown className={`w-3 h-3 ${summaryData.improvements > 0 ? 'text-emerald-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end gap-1.5">
                                        <span className={`text-2xl font-black leading-none ${summaryData.improvements > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{summaryData.improvements}</span>
                                        <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Faster</span>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl shadow-sm hover:border-blue-500/30 transition-all">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Spams</p>
                                        <Activity className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <div className="flex items-end gap-1.5">
                                        <span className="text-2xl font-black text-blue-400 leading-none">{summaryData.spams}</span>
                                        <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Spiking</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Insights */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Top Changes */}
                                <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
                                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                                        <Zap size={14} className="text-blue-400" />
                                        <div className="flex items-center justify-between flex-1">
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Top Performance Changes</h4>
                                            <span className="text-[9px] text-slate-500 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">CLICK TO JUMP</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-2 flex flex-col gap-2">
                                        {summaryData.topChanges.length > 0 ? summaryData.topChanges.map((res, i) => {
                                            const isImprovement = res.deltaDiff < 0;
                                            const themeColor = isImprovement ? 'emerald' : 'orange';
                                            const Icon = isImprovement ? TrendingDown : TrendingUp;

                                            const isSelected = selectedKey === res.key;

                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => handleItemClick(res)}
                                                    className={`flex bg-slate-950/50 rounded-lg border transition-all cursor-pointer group overflow-hidden ${isSelected
                                                        ? `border-${themeColor}-500/50 bg-${themeColor}-500/5`
                                                        : `border-slate-800/50 hover:border-${themeColor}-500/50 hover:bg-${themeColor}-500/5`
                                                        }`}
                                                >
                                                    {/* 🐧⚡ 왼쪽 영역: 타임라인 흐름 (Flow Timeline) */}
                                                    <div className="flex-1 flex flex-col gap-1 p-2.5 relative">
                                                        {/* 시작점 (Start Node) - 블루/슬레이트 테마로 고정 */}
                                                        <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 transition-colors">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 shrink-0"></div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <div className="flex items-center justify-between min-w-0">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="text-[9px] font-mono text-blue-400/80 truncate max-w-[200px]">
                                                                            {res.prevFileName ? res.prevFileName : 'START'}
                                                                        </span>
                                                                        <span className="text-[10px] font-black text-blue-500/50">:</span>
                                                                        <span className="text-[10px] font-black text-white truncate">
                                                                            {res.prevFunctionName || '...'}
                                                                            <span className="text-[9px] text-blue-400/60 ml-1 font-mono">
                                                                                ({res.leftPrevCodeLineNum || res.leftPrevOrigLineNum || res.leftPrevLineNum})
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 수직 화살표 (Vertical Arrow) - 결과에 따른 색상 변화 */}
                                                        <div className="flex items-center px-4 my-[-3px]">
                                                            <div className="flex flex-col items-center ml-[3px]">
                                                                <div className={`w-px h-1.5 bg-gradient-to-b from-blue-700 to-${themeColor}-500/50`}></div>
                                                                <ArrowDown size={10} className={`text-${themeColor}-500/70 my-[-2px]`} />
                                                            </div>
                                                        </div>

                                                        {/* 끝점 (End Node) - 결과 테마 적용 */}
                                                        <div className={`flex items-center gap-2 px-2 py-1 rounded-md bg-${themeColor}-500/10 border border-${themeColor}-500/30 transition-colors`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full bg-${themeColor}-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] shrink-0 animate-pulse`}></div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <div className="flex items-center justify-between min-w-0">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className={`text-[9px] font-mono text-${themeColor}-400/80 truncate max-w-[200px]`}>
                                                                            {res.fileName || 'Unknown'}
                                                                        </span>
                                                                        <span className={`text-[10px] font-black text-${themeColor}-500/50`}>:</span>
                                                                        <span className="text-[10px] font-black text-white truncate">
                                                                            {res.functionName || res.preview.substring(0, 30)}
                                                                            <span className={`text-[9px] text-${themeColor}-400/60 ml-1 font-mono`}>
                                                                                ({res.leftCodeLineNum || res.leftOrigLineNum || res.leftLineNum})
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 🐧⚡ 중앙 구분선 (Vertical Divider) */}
                                                    <div className="w-px bg-slate-800/80 my-2"></div>

                                                    {/* 🐧⚡ 오른쪽 영역: 시간 분석 (Metrics Analysis) */}
                                                    <div className="w-[170px] bg-slate-900/40 p-2.5 flex flex-col justify-center gap-2 shrink-0 border-l border-slate-800/30">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">LEFT</span>
                                                                <span className="text-[10px] font-mono text-slate-400">{formatDelta(res.leftAvgDelta)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">RIGHT</span>
                                                                <span className="text-[11px] font-mono text-white font-black">{formatDelta(res.rightAvgDelta)}</span>
                                                            </div>
                                                        </div>

                                                        <div className={`h-px bg-${themeColor}-800/30`}></div>

                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-[8px] font-black text-${themeColor}-500/70 uppercase tracking-tighter`}>
                                                                {isImprovement ? 'IMPROVEMENT' : 'REGRESSION'}
                                                            </span>
                                                            <div className={`text-[13px] font-black text-${themeColor}-400 flex items-center justify-center gap-1.5 bg-${themeColor}-400/10 px-2 py-1 rounded-lg border border-${themeColor}-500/20 shadow-md group-hover:bg-${themeColor}-400/15 transition-all`}>
                                                                <Icon size={11} className="mb-0.5" />
                                                                {isImprovement ? '' : '+'}{formatDelta(res.deltaDiff)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="flex items-center justify-center p-8 text-xs text-slate-600 italic">No significant changes found. 펭-굿! ✨</div>
                                        )}
                                    </div>
                                </div>

                                {/* Top Spams */}
                                <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
                                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                                        <Activity size={14} className="text-blue-400" />
                                        <div className="flex items-center justify-between flex-1">
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Top Frequency Increases (Spam)</h4>
                                            <span className="text-[9px] text-slate-500 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">CLICK TO JUMP</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-2 flex flex-col gap-2">
                                        {summaryData.topSpams.length > 0 ? summaryData.topSpams.map((res, i) => {
                                            const isSelected = selectedKey === res.key;
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => handleItemClick(res)}
                                                    className={`flex bg-slate-950/50 rounded-lg border transition-all cursor-pointer group overflow-hidden ${isSelected
                                                        ? 'border-blue-500/50 bg-blue-500/5'
                                                        : 'border-slate-800/50 hover:border-blue-500/50 hover:bg-blue-500/5'
                                                        }`}
                                                >
                                                    {/* 🐧⚡ 왼쪽 영역: 타임라인 흐름 */}
                                                    <div className="flex-1 flex flex-col gap-1 p-2.5 relative">
                                                        <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-blue-500/5 border border-blue-500/10 opacity-70">
                                                            <span className="text-[8px] font-black text-slate-500 uppercase">FROM:</span>
                                                            <span className="text-[9px] font-mono text-slate-500 truncate">
                                                                {res.prevFileName ? `${res.prevFileName}:${res.leftPrevCodeLineNum || res.leftPrevOrigLineNum || res.leftPrevLineNum}` : 'START'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30">
                                                            <span className="text-[8px] font-black text-blue-500 uppercase">TO:</span>
                                                            <span className="text-[10px] font-black text-blue-300 truncate">
                                                                {res.functionName || res.preview.substring(0, 40)}
                                                            </span>
                                                            <span className="text-[9px] text-blue-500/60 font-mono">
                                                                ({res.leftCodeLineNum || res.leftOrigLineNum || res.leftLineNum})
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* 🐧⚡ 오른쪽 영역: 빈도 분석 */}
                                                    <div className="w-[120px] bg-slate-900/40 p-2.5 flex flex-col justify-center gap-1 shrink-0 border-l border-slate-800/30">
                                                        <div className="flex items-center justify-between text-[9px] font-mono">
                                                            <span className="text-slate-600">PREV</span>
                                                            <span className="text-slate-500">{res.leftCount}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[10px] font-mono font-black">
                                                            <span className="text-slate-400">CURR</span>
                                                            <span className="text-white">{res.rightCount}</span>
                                                        </div>
                                                        <div className="mt-1 text-[11px] font-black text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-500/20 text-center">
                                                            +{res.countDiff} calls
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
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

                                            const isSelected = selectedKey === res.key;

                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => handleItemClick(res)}
                                                    className={`grid grid-cols-12 gap-2 px-4 py-2.5 transition-all items-center text-sm group cursor-pointer border-b border-slate-800/20 ${isSelected ? 'bg-slate-950 shadow-[inset_0_0_15px_rgba(59,130,246,0.05)] border-l-2 border-l-blue-500' : 'hover:bg-slate-900 border-l-2 border-l-transparent'
                                                        }`}
                                                >
                                                    <div className="col-span-1 flex justify-center">
                                                        {res.isNewError ? (
                                                            <div title="New Error!" className="w-5 h-5 rounded bg-rose-500/20 text-rose-500 flex items-center justify-center border border-rose-500/30">
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : res.isError ? (
                                                            <div title="Existing Error" className="w-5 h-5 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : isSlower ? (
                                                            <div title="Slower" className="w-5 h-5 rounded bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20">
                                                                <TrendingUp className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : isFaster ? (
                                                            <div title="Faster" className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                                                <TrendingDown className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded bg-slate-800/30 text-slate-600 flex items-center justify-center text-[10px]">-</div>
                                                        )}
                                                    </div>

                                                    <div className="col-span-5 flex flex-col gap-0.5 min-w-0 pr-2">
                                                        <div className="flex items-center gap-1.5 opacity-60">
                                                            <span className="text-[8px] font-black text-blue-500/80 uppercase">FROM:</span>
                                                            <span className="text-[9px] font-mono text-slate-400 truncate">
                                                                {res.prevFileName ? `${res.prevFileName}:${res.leftPrevCodeLineNum || res.leftPrevOrigLineNum || res.leftPrevLineNum}` : 'START'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[8px] font-black text-blue-400 uppercase">TO:</span>
                                                            <span className="text-[10px] font-black text-blue-300 truncate">
                                                                {res.functionName || res.preview.substring(0, 40)}
                                                            </span>
                                                            <span className="text-[9px] text-slate-500 font-mono">
                                                                ({res.leftCodeLineNum || res.leftOrigLineNum || res.leftLineNum})
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="col-span-3 flex flex-col items-center justify-center border-l border-slate-800/50 py-1">
                                                        <div className="flex items-center gap-2 font-mono text-[10px]">
                                                            <span className="text-slate-500">{res.leftCount}</span>
                                                            <span className="text-slate-700 text-[8px]">→</span>
                                                            <span className="text-slate-200">{res.rightCount}</span>
                                                        </div>
                                                        <div className={`text-[9px] font-black mt-1 px-1.5 py-0.5 rounded flex items-center gap-1 ${isMore ? 'text-rose-400 bg-rose-400/10' : isLess ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 bg-slate-800/20'}`}>
                                                            {isMore && <ArrowUp className="w-2 h-2" />}
                                                            {isLess && <ArrowDown className="w-2 h-2" />}
                                                            {res.countDiff > 0 ? `+${res.countDiff}` : res.countDiff}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-3 flex flex-col items-center justify-center border-l border-slate-800/50 py-1">
                                                        <div className="flex items-center gap-2 font-mono text-[10px]">
                                                            <span className="text-slate-500">{formatDelta(res.leftAvgDelta)}</span>
                                                            <span className="text-slate-700 text-[8px]">→</span>
                                                            <span className="text-slate-200">{formatDelta(res.rightAvgDelta)}</span>
                                                        </div>
                                                        <div className={`text-[9px] font-black mt-1 px-1.5 py-0.5 rounded flex items-center gap-1 ${isSlower ? 'text-orange-400 bg-orange-400/10' : isFaster ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 bg-slate-800/20'}`}>
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
