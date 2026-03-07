import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, RefreshCw, List, LayoutDashboard, TrendingUp, TrendingDown, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { SplitAnalysisResult, PointAnalysisResult } from '../../hooks/useSplitAnalysis';

interface SplitAnalyzerPanelProps {
    results: { results: SplitAnalysisResult[], pointResults: PointAnalysisResult[] } | null;
    isLoading?: boolean;
    progress?: number;
    onClose: () => void;
    onJumpToRange?: (side: 'left' | 'right', startLine: number, endLine: number) => void;
    onViewRawSplit?: (res: SplitAnalysisResult) => void;
}

type AnalysisTab = 'summary' | 'timeline';

export const SplitAnalyzerPanel: React.FC<SplitAnalyzerPanelProps> = ({ results, isLoading, progress = 0, onClose, onJumpToRange, onViewRawSplit }) => {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('summary');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [pointNavigation, setPointNavigation] = useState<Record<string, number>>({});

    const handlePointJump = (sig: string, indices: number[], direction: 'next' | 'prev' | 'first') => {
        const currentIdx = pointNavigation[sig] || 0;
        let nextIdx = 0;
        if (direction === 'next') nextIdx = (currentIdx + 1) % indices.length;
        else if (direction === 'prev') nextIdx = (currentIdx - 1 + indices.length) % indices.length;
        else nextIdx = 0;

        setPointNavigation(prev => ({ ...prev, [sig]: nextIdx }));
        const visualIdx = indices[nextIdx];
        onJumpToRange?.('right', visualIdx, visualIdx);
    };

    const sortedResults = useMemo(() => {
        if (!results || !results.results) return [];
        return [...results.results]
            .filter(r => r.leftAvgDelta > 0 && r.rightAvgDelta > 0)
            .sort((a, b) => (a.leftPrevLineNum || 0) - (b.leftPrevLineNum || 0));
    }, [results]);

    const summaryData = useMemo(() => {
        if (!results) return null;
        const intervalResults = (results.results || []).filter(r => r.leftAvgDelta > 0 && r.rightAvgDelta > 0);
        const pointResults = results.pointResults || [];

        const newErrors = intervalResults.filter(r => r.isNewError).length;
        const totalNodes = intervalResults.length;
        const regressions = intervalResults.filter(r => r.deltaDiff > 10).length;
        const improvements = intervalResults.filter(r => r.deltaDiff < -10).length;
        const spams = pointResults.length;

        const topChanges = [...intervalResults]
            .filter(r => Math.abs(r.deltaDiff) > 1 && Math.abs(r.countDiff) < 100)
            .sort((a, b) => Math.abs(b.deltaDiff) - Math.abs(a.deltaDiff))
            .slice(0, 100);

        const topSpams = pointResults.slice(0, 100);

        return { newErrors, totalNodes, regressions, improvements, spams, topChanges, topSpams };
    }, [results]);

    const formatDelta = (ms: number) => {
        if (ms === 0) return '0.0ms';
        if (Math.abs(ms) < 1) return `${ms.toFixed(3)}ms`;
        return `${ms.toFixed(1)}ms`;
    };


    const handleItemClick = (res: SplitAnalysisResult, isSinglePoint: boolean = false) => {
        setSelectedKey(res.key);

        // Timeline 리스트 내 자동 스크롤 (Focus)
        setTimeout(() => {
            const element = document.getElementById(`segment-${res.key}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 10);

        if (!onJumpToRange) return;

        // 🐧🎯 단일 지점 점프 여부 결정
        // 1. 명시적으로 isSinglePoint가 true이거나
        // 2. 신규 에러인 경우
        const forceSingle = isSinglePoint || res.isNewError;

        // 좌측 구간 점프
        if (res.leftLineNum > 0) {
            const start = forceSingle ? res.leftLineNum : Math.min(res.leftLineNum, res.leftPrevLineNum);
            const end = res.leftLineNum;
            onJumpToRange('left', start, end);
        }

        // 우측 구간 점프
        if (res.rightLineNum > 0) {
            // 점프 지점 결정:
            // 1. 스팸/단일지점: 실제 그 로그가 위치한 '단일 지점'으로 점프 (범위 선택 방지)
            // 2. 성능 변화: 원인(Prev)부터 결과(Current)까지의 범위를 선택
            const start = forceSingle ? res.rightLineNum : Math.min(res.rightLineNum, res.rightPrevLineNum);
            const end = forceSingle ? start : res.rightLineNum;
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
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-4">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-bold text-slate-100">Analysis Engine</h3>
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
                            onClick={() => setActiveTab('timeline')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black transition-all ${activeTab === 'timeline' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Activity size={12} /> TIMELINE
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
                            className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3"
                        >
                            {/* Summary Cards */}
                            <div className="grid grid-cols-5 gap-2 mb-3">
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2 shadow-sm hover:border-blue-500/30 transition-all text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Total Mapped Nodes</p>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className="text-xl font-black text-white leading-none">{summaryData.totalNodes}</span>
                                        <span className="text-[8px] text-slate-500 font-bold mb-0.5 uppercase">Nodes</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-2 rounded-xl shadow-sm transition-all text-center ${summaryData.regressions > 0 ? 'border-orange-500/50 hover:bg-orange-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Regressions</p>
                                        <TrendingUp className={`w-3 h-3 ${summaryData.regressions > 0 ? 'text-orange-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className={`text-xl font-black leading-none ${summaryData.regressions > 0 ? 'text-orange-400' : 'text-slate-400'}`}>{summaryData.regressions}</span>
                                        <span className="text-[8px] text-slate-500 font-bold mb-1 uppercase">Slower</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-2 rounded-xl shadow-sm transition-all text-center ${summaryData.improvements > 0 ? 'border-emerald-500/50 hover:bg-emerald-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Improvements</p>
                                        <TrendingDown className={`w-3 h-3 ${summaryData.improvements > 0 ? 'text-emerald-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className={`text-xl font-black leading-none ${summaryData.improvements > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{summaryData.improvements}</span>
                                        <span className="text-[8px] text-slate-500 font-bold mb-1 uppercase">Faster</span>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-xl shadow-sm hover:border-blue-500/30 transition-all text-center">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Spams</p>
                                        <Activity className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className="text-xl font-black text-blue-400 leading-none">{summaryData.spams}</span>
                                        <span className="text-[8px] text-slate-500 font-bold mb-1 uppercase">Spiking</span>
                                    </div>
                                </div>
                                <div className={`bg-slate-900/50 border p-2 rounded-xl shadow-sm transition-all text-center ${summaryData.newErrors > 0 ? 'border-rose-500/50 hover:bg-rose-500/5' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">New Errors</p>
                                        <AlertTriangle className={`w-3 h-3 ${summaryData.newErrors > 0 ? 'text-rose-500' : 'text-slate-700'}`} />
                                    </div>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className={`text-xl font-black leading-none ${summaryData.newErrors > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{summaryData.newErrors}</span>
                                        <span className="text-[8px] text-slate-500 font-bold mb-0.5 uppercase">Issues</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Insights */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Top Changes */}
                                <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
                                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                                        <Zap size={14} className="text-blue-400" />
                                        <div className="flex items-center justify-between flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Top Performance Changes</h4>
                                                <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-1.5 rounded-full border border-blue-500/20">{summaryData.topChanges.length}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-500 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">CLICK TO JUMP</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-1 flex flex-col gap-1">
                                        {summaryData.topChanges.length > 0 ? summaryData.topChanges.map((res, i) => {
                                            const isImprovement = res.deltaDiff < 0;
                                            const themeColor = isImprovement ? 'emerald' : 'orange';
                                            const Icon = isImprovement ? TrendingDown : TrendingUp;

                                            const isSelected = selectedKey === res.key;

                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => handleItemClick(res)}
                                                    onDoubleClick={() => onViewRawSplit?.(res)}
                                                    className={`group relative flex bg-slate-900/40 rounded-xl border transition-all cursor-pointer overflow-hidden ${isSelected
                                                        ? `border-${themeColor}-500/50 bg-${themeColor}-500/5 ring-1 ring-${themeColor}-500/20`
                                                        : 'border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/60'
                                                        }`}
                                                >
                                                    {isSelected && <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${themeColor}-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]`} />}

                                                    <div className="flex-1 p-1 flex items-center gap-2">
                                                        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-500/5 border border-blue-500/10 opacity-70">
                                                                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[200px]">
                                                                    {res.prevFileName ? res.prevFileName : 'START'}
                                                                    <span className="text-[9px] text-blue-400/60 ml-1 font-mono">
                                                                        ({(res.rightPrevCodeLineNum || res.rightPrevOrigLineNum || res.rightPrevLineNum) || (res.leftPrevCodeLineNum || res.leftPrevOrigLineNum || res.leftPrevLineNum)})
                                                                    </span>
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center px-4 my-[-2px]">
                                                                <div className="flex flex-col items-center ml-[3px]">
                                                                    <div className={`w-px h-1.5 bg-gradient-to-b from-blue-700 to-${themeColor}-500/50`}></div>
                                                                    <ArrowDown size={10} className={`text-${themeColor}-500/70 my-[-2px]`} />
                                                                </div>
                                                            </div>

                                                            <div className={`flex items-center gap-2 px-2 py-1 rounded-md bg-${themeColor}-500/10 border border-${themeColor}-500/30 transition-colors`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full bg-${themeColor}-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] shrink-0 animate-pulse`} />
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
                                                                                    ({(res.rightCodeLineNum || res.rightOrigLineNum || res.rightLineNum) || (res.leftCodeLineNum || res.leftOrigLineNum || res.leftLineNum)})
                                                                                </span>
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="w-px bg-slate-800/80 my-1"></div>

                                                        <div className="w-[200px] bg-slate-900/40 p-2 flex flex-col justify-center gap-1.5 shrink-0 border-l border-slate-800/30">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">LEFT</span>
                                                                    <span className="text-[10px] font-mono text-slate-400">{formatDelta(res.leftAvgDelta)}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">RIGHT</span>
                                                                    <span className="text-[11px] font-mono text-white font-black">{formatDelta(res.rightAvgDelta)}</span>
                                                                </div>
                                                            </div>

                                                            <div className={`mt-0.5 px-2 py-1 rounded-lg flex items-center justify-between bg-${themeColor}-400/10 border border-${themeColor}-500/20`}>
                                                                <span className={`text-[9px] font-black text-${themeColor}-400 uppercase tracking-tighter`}>
                                                                    {isImprovement ? 'IMPROVEMENT' : 'REGRESSION'}
                                                                </span>
                                                                <div className={`text-[11px] font-black text-${themeColor}-400 flex items-center gap-1`}>
                                                                    <Icon size={10} />
                                                                    {`${isImprovement ? '' : '+'}${formatDelta(res.deltaDiff)}`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                            : (
                                                <div className="flex items-center justify-center p-8 text-xs text-slate-600 italic">No significant changes found.</div>
                                            )}
                                    </div>
                                </div>

                                {/* Top Spams */}
                                <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
                                    <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
                                        <Activity size={14} className="text-blue-400" />
                                        <div className="flex items-center justify-between flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">NEW SIGNIFICANT LOGS (ONLY RIGHT)</span>
                                                <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-1.5 rounded-full border border-blue-500/20">{summaryData.topSpams.length}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-500 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">CLICK TO JUMP</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-1 flex flex-col gap-1">
                                        {summaryData.topSpams.length > 0 ? summaryData.topSpams.map((res: PointAnalysisResult, i) => {
                                            const sig = res.sig;
                                            const currentNavIdx = pointNavigation[sig] || 0;
                                            const totalOccurrences = res.visualIndices.length;

                                            return (
                                                <div
                                                    key={i}
                                                    className="flex flex-col bg-slate-950/50 rounded-lg border border-slate-800/50 hover:border-blue-500/30 transition-all group overflow-hidden"
                                                >
                                                    <div className="flex items-center p-2 gap-2 border-b border-slate-800/30 bg-slate-900/40">
                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                <span className="text-[10px] font-black text-blue-400 shrink-0 uppercase tracking-tighter">NEW LOG</span>
                                                                <span className="text-[9px] font-mono text-slate-500 truncate">{res.fileName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-black text-slate-200 truncate">{res.functionName || 'UNKNOWN'}</span>
                                                                {res.codeLineNum && <span className="text-[10px] text-slate-500 font-mono">({res.codeLineNum})</span>}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-[12px] font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-500/20">{res.count} COUNT</span>
                                                        </div>
                                                    </div>

                                                    <div className="px-3 py-2 flex items-center justify-between gap-3 bg-slate-950/80">
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] text-slate-400 font-mono italic truncate block">
                                                                "{res.preview.substring(0, 100)}"
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePointJump(sig, res.visualIndices, 'prev'); }}
                                                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                                            >
                                                                <ChevronLeft size={14} />
                                                            </button>
                                                            <span className="text-[10px] font-mono font-bold text-slate-300 min-w-[40px] text-center">
                                                                {currentNavIdx + 1} / {totalOccurrences}
                                                            </span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePointJump(sig, res.visualIndices, 'next'); }}
                                                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                                            >
                                                                <ChevronRight size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="flex items-center justify-center p-8 text-xs text-slate-600 italic">No new significant logs detected.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="timeline"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="flex-1 flex flex-col min-h-0"
                        >
                            {/* Navigation Controls */}
                            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-md">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Navigation</span>
                                    <div className="h-3 w-px bg-slate-800 mx-1" />
                                    <span className="text-[10px] font-mono text-blue-400 font-bold">
                                        {selectedKey ? `${sortedResults.findIndex(r => r.key === selectedKey) + 1} / ${sortedResults.length}` : `Total ${sortedResults.length}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            const idx = sortedResults.findIndex(r => r.key === selectedKey);
                                            if (idx > 0) handleItemClick(sortedResults[idx - 1]);
                                            else if (idx === -1 && sortedResults.length > 0) handleItemClick(sortedResults[sortedResults.length - 1]);
                                        }}
                                        disabled={sortedResults.length === 0 || sortedResults.findIndex(r => r.key === selectedKey) === 0}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-400 hover:text-white hover:border-blue-500/50 disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    >
                                        <ArrowUp size={12} strokeWidth={3} /> PREV
                                    </button>
                                    <button
                                        onClick={() => {
                                            const idx = sortedResults.findIndex(r => r.key === selectedKey);
                                            if (idx < sortedResults.length - 1) handleItemClick(sortedResults[idx + 1]);
                                            else if (idx === -1 && sortedResults.length > 0) handleItemClick(sortedResults[0]);
                                        }}
                                        disabled={sortedResults.length === 0 || (selectedKey && sortedResults.findIndex(r => r.key === selectedKey) >= sortedResults.length - 1)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-400 hover:text-white hover:border-blue-500/50 disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    >
                                        NEXT <ArrowDown size={12} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            {/* Timeline List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-950/20 p-2.5">
                                {sortedResults.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                                        <Zap className="w-12 h-12 text-slate-800 mb-4" />
                                        <p className="text-slate-400 font-bold text-sm">No analysis results found.</p>
                                        <p className="text-xs text-slate-600 mt-2 italic px-8">Analysis requires corresponding patterns in both log streams.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {sortedResults.map((res, i) => {
                                            const isSlower = res.deltaDiff > 0;
                                            const isFaster = res.deltaDiff < 0;
                                            const isMore = res.countDiff > 0;
                                            const isLess = res.countDiff < 0;
                                            const isSelected = selectedKey === res.key;

                                            // Theme Colors
                                            const themeColor = res.isNewError ? 'rose' : (isSlower ? 'orange' : (isFaster ? 'emerald' : 'blue'));
                                            const Icon = res.isNewError ? AlertTriangle : (isSlower ? TrendingUp : (isFaster ? TrendingDown : Activity));

                                            return (
                                                <div
                                                    key={i}
                                                    id={`segment-${res.key}`}
                                                    onClick={() => handleItemClick(res)}
                                                    onDoubleClick={() => onViewRawSplit?.(res)}
                                                    className={`group relative flex bg-slate-900/40 rounded-xl border transition-all cursor-pointer overflow-hidden ${isSelected
                                                        ? `border-${themeColor}-500/50 bg-${themeColor}-500/5 ring-1 ring-${themeColor}-500/20`
                                                        : 'border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/60'
                                                        }`}
                                                >
                                                    {/* Selection Indicator */}
                                                    {isSelected && <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${themeColor}-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]`} />}

                                                    <div className="flex-1 p-2 flex items-center gap-4">
                                                        {/* Log Flow Visualizer */}
                                                        <div className="flex-1 flex flex-col gap-1.5 relative">
                                                            {/* FROM Box */}
                                                            <div className="bg-slate-950/50 border border-slate-800/50 rounded-lg py-1 px-3 flex items-center gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 shadow-[0_0_5px_rgba(71,85,105,0.5)]" />
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                                                                            {res.prevFileName ? res.prevFileName : 'START'}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-300 truncate">
                                                                        {res.prevFunctionName || 'Initial Sequence'}
                                                                        <span className="ml-1.5 text-[10px] text-slate-600 font-mono">({res.leftPrevCodeLineNum || res.leftPrevOrigLineNum || res.leftPrevLineNum})</span>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Connector Area - Refined Visual Flow */}
                                                            <div className="absolute left-[18px] top-[26px] bottom-[26px] flex flex-col items-center z-0">
                                                                <div className={`w-[2px] h-full bg-gradient-to-b from-slate-700 via-${themeColor}-500/40 to-${themeColor}-500/60 rounded-full`} />
                                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                                                    <div className={`bg-slate-950 p-0.5 rounded-full border border-${themeColor}-500/30`}>
                                                                        <ArrowDown size={10} className={`text-${themeColor}-500/80`} />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* TO Box */}
                                                            <div className={`bg-${themeColor}-500/5 border border-${themeColor}-500/20 rounded-lg py-1 px-3 flex items-center gap-3 relative z-20`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full bg-${themeColor}-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]`} />
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                                                                            {res.fileName || '[Unknown]'}
                                                                        </span>
                                                                    </div>
                                                                    <span className={`text-xs font-black text-${themeColor}-300 truncate`}>
                                                                        {res.functionName || res.preview.substring(0, 40)}
                                                                        <span className="ml-1.5 text-[10px] text-slate-600 font-mono">({res.leftCodeLineNum || res.leftOrigLineNum || res.leftLineNum})</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Metrics Divider */}
                                                        <div className="w-px h-16 bg-slate-800/50" />

                                                        {/* Right Side: Performance Info */}
                                                        <div className="w-48 shrink-0 flex flex-col justify-center gap-2">
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between items-center px-1">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">LEFT</span>
                                                                    <span className="text-xs font-mono text-slate-300">{formatDelta(res.leftAvgDelta)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center px-1">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">RIGHT</span>
                                                                    <span className="text-sm font-black text-white">{formatDelta(res.rightAvgDelta)}</span>
                                                                </div>
                                                            </div>

                                                            <div className={`flex items-center justify-between p-2 rounded-lg bg-${themeColor}-500/10 border border-${themeColor}-500/20`}>
                                                                <span className={`text-[9px] font-black text-${themeColor}-500 uppercase tracking-[0.15em]`}>
                                                                    {res.isNewError ? 'NEW ERROR' : (isSlower ? 'REGRESSION' : (isFaster ? 'IMPROVEMENT' : 'STABLE'))}
                                                                </span>
                                                                <div className={`flex items-center gap-1.5 text-xs font-black text-${themeColor}-400`}>
                                                                    <Icon size={12} strokeWidth={3} />
                                                                    <span>{`${res.deltaDiff > 0 ? '+' : ''}${formatDelta(res.deltaDiff)}`}</span>
                                                                </div>
                                                            </div>
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
