import React from 'react';
import * as Lucide from 'lucide-react';
import { AnalysisResult, AnalysisSegment } from '../../../utils/perfAnalysis';
import { formatDuration } from '../../../utils/logTime';

export interface PerfTopBarProps {
    result: AnalysisResult;
    viewMode: 'chart' | 'list';
    setViewMode: (mode: 'chart' | 'list') => void;
    showOnlyFail: boolean;
    setShowOnlyFail: (show: boolean) => void;
    multiSelectedIds: string[];
    setMultiSelectedIds: (ids: string[]) => void;
    setSelectedSegmentId: (id: string | null) => void;
    navSegments: AnalysisSegment[];
    currentNavIndex: number;
    jumpToNavSegment: (direction: -1 | 1) => void;
    searchInput: string;
    setSearchInput: (val: string) => void;
    searchRef: React.RefObject<HTMLInputElement>;
    onClose: () => void;
    minimized: boolean;
    setMinimized: (min: boolean) => void;
}

const Scorecard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string; subValue?: string }> = ({ label, value, icon, color, subValue }) => (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl px-3.5 py-1.5 flex flex-col justify-center shadow-xl relative overflow-hidden group min-w-[120px]">
        <div className={`absolute top-0 right-0 w-12 h-12 -mr-4 -mt-4 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity`} style={{ backgroundColor: color }} />
        <div className="flex items-center justify-between gap-3">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] truncate">{label}</span>
            <div style={{ color }} className="opacity-70 group-hover:opacity-100 transition-all shrink-0 scale-75 origin-right">{icon}</div>
        </div>
        <div className="flex items-end gap-1.5 overflow-hidden mt-0.5">
            <span className="text-xl font-black text-white tracking-tighter whitespace-nowrap leading-none">{value}</span>
            {subValue && <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap truncate leading-none mb-0.5">{subValue}</span>}
        </div>
    </div>
);

export const PerfTopBar: React.FC<PerfTopBarProps> = ({
    result,
    viewMode,
    setViewMode,
    showOnlyFail,
    setShowOnlyFail,
    multiSelectedIds,
    setMultiSelectedIds,
    setSelectedSegmentId,
    navSegments,
    currentNavIndex,
    jumpToNavSegment,
    searchInput,
    setSearchInput,
    searchRef,
    onClose,
    minimized,
    setMinimized
}) => {
    return (
        <div className="h-20 shrink-0 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl px-4 flex items-center justify-between z-50">
            <div className="flex items-center gap-3">
                <Scorecard
                    label="Segments"
                    value={result.segments.length}
                    icon={<Lucide.Activity size={14} />}
                    color="#6366f1"
                />
                <Scorecard
                    label="Pass Rate"
                    value={(() => {
                        const individualCount = result.segments.filter(s => s.tid !== 'Global').length;
                        const total = Math.max(1, individualCount);
                        const rate = ((total - result.failCount) / total) * 100;
                        const displayRate = (result.failCount > 0 && rate > 99.9) ? "99.9" : rate.toFixed(1);
                        return `${displayRate}%`;
                    })()}
                    icon={<Lucide.CheckCircle2 size={14} />}
                    color="#10b981"
                    subValue={`${result.failCount} slow ops`}
                />
                <Scorecard
                    label="Total Time"
                    value={formatDuration(result.totalDuration)}
                    icon={<Lucide.Timer size={14} />}
                    color="#ec4899"
                />
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    {/* All Fails & Fail Only */}
                    <div className="flex items-center gap-1 mr-1">
                        <button
                            onClick={() => {
                                if (multiSelectedIds.length > 0) {
                                    setMultiSelectedIds([]);
                                } else {
                                    setSelectedSegmentId(null);
                                    const failIds = result.segments
                                        .filter(s => s.duration >= (result.perfThreshold || 1000))
                                        .map(s => s.id);
                                    setMultiSelectedIds(failIds);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 border ${multiSelectedIds.length > 0
                                ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'}`}
                            title="All Fails"
                        >
                            <Lucide.AlertCircle size={14} className={multiSelectedIds.length > 0 ? 'animate-pulse' : ''} />
                            All Fails
                        </button>
                        <button
                            onClick={() => setShowOnlyFail(!showOnlyFail)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 border ${showOnlyFail
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'}`}
                            title="Fail Only"
                        >
                            <Lucide.Filter size={14} />
                            Fail Only
                        </button>
                    </div>

                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <div className="flex items-center gap-2 bg-black/20 rounded-xl px-2 py-1">
                        <button
                            onClick={() => jumpToNavSegment(-1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${navSegments.length > 0 ? 'bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400' : 'text-slate-800 cursor-not-allowed'}`}
                            disabled={navSegments.length === 0}
                        >
                            <Lucide.ChevronLeft size={16} />
                        </button>
                        <div className="flex flex-col items-center min-w-[45px]">
                            <span className={`text-[10px] font-mono font-black leading-none ${navSegments.length > 0 ? 'text-white' : 'text-slate-600'}`}>
                                {navSegments.length > 0 ? (currentNavIndex >= 0 ? currentNavIndex + 1 : '-') : '0'}
                            </span>
                            <span className="text-[7px] text-slate-500 font-black uppercase mt-0.5 tracking-tighter">
                                of {navSegments.length}
                            </span>
                        </div>
                        <button
                            onClick={() => jumpToNavSegment(1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${navSegments.length > 0 ? 'bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400' : 'text-slate-800 cursor-not-allowed'}`}
                            disabled={navSegments.length === 0}
                        >
                            <Lucide.ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Search Input */}
                <div className="flex items-center bg-slate-950/60 rounded-2xl border border-white/10 px-4 py-2 w-64 focus-within:border-indigo-500/50 transition-all shadow-inner">
                    <Lucide.Search size={14} className="text-slate-500 mr-2" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search segments..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="bg-transparent text-xs text-white w-full focus:outline-none placeholder:text-slate-600 font-mono"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="p-1 bg-slate-950 rounded-xl border border-white/5 flex gap-1 shadow-lg">
                        <button
                            onClick={() => setViewMode('chart')}
                            className={`px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'chart' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Lucide.Activity size={14} />
                            Chart
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Lucide.AlignLeft size={14} />
                            List
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="ml-4 p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all shadow-lg active:scale-90"
                    title="Close Dashboard"
                >
                    <Lucide.X size={18} />
                </button>
            </div>
        </div>
    );
};
