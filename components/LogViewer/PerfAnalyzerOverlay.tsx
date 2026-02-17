import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';

const {
    Flame, TrendingUp, X, ChevronUp, ChevronDown, Maximize2, Minimize2, Activity, Clock, Target, ArrowRight
} = Lucide;

interface PerfAnalyzerOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    result: AnalysisResult | null;
    isAnalyzing: boolean;
    onJumpToLine?: (lineNum: number) => void;
    targetTime: number;
}

export const PerfAnalyzerOverlay: React.FC<PerfAnalyzerOverlayProps> = ({
    isOpen, onClose, result, isAnalyzing, onJumpToLine, targetTime
}) => {
    const [flameZoom, setFlameZoom] = useState<{ startTime: number; endTime: number } | null>(null);
    const [flameExpanded, setFlameExpanded] = useState(false);
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

    // Constants for coloring
    const palette = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

    const flameSegments = useMemo(() => {
        if (!result) return [];

        // StartTime ASC, Duration DESC
        const sorted = [...result.segments].sort((a, b) => (a.startTime - b.startTime) || (b.duration - a.duration));
        const lanes: number[] = [];
        const totalDuration = result.endTime - result.startTime;
        const minVisualDuration = totalDuration * 0.01;

        return sorted.map(s => {
            let lane = 0;
            const effectiveEndTime = Math.max(s.endTime, s.startTime + minVisualDuration);

            while (lanes[lane] !== undefined && lanes[lane] > s.startTime) {
                lane++;
            }
            lanes[lane] = effectiveEndTime;

            return {
                ...s,
                lane,
                relStart: (s.startTime - result.startTime) / 1000,
                relEnd: (s.endTime - result.startTime) / 1000,
                width: Math.max(0, (s.duration / Math.max(1, totalDuration))) * 100
            };
        });
    }, [result]);

    const maxLane = useMemo(() => {
        if (!flameSegments.length) return 4;
        return Math.max(4, ...flameSegments.map(s => s.lane));
    }, [flameSegments]);

    const topBottlenecks = useMemo(() => {
        if (!result) return [];
        return [...result.segments].sort((a, b) => b.duration - a.duration).slice(0, 10);
    }, [result]);

    const selectedSegment = useMemo(() =>
        result?.segments.find(s => s.id === selectedSegmentId),
        [result, selectedSegmentId]);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col border border-white/10 m-4 rounded-[40px] shadow-2xl overflow-hidden pointer-events-auto"
        >
            {/* Header */}
            <div className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-white/2">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-500/20 rounded-2xl text-indigo-400">
                        <Flame size={20} className="icon-glow" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black tracking-widest uppercase text-slate-100 flex items-center gap-2">
                            Performance Insights
                            {isAnalyzing && (
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-bold text-indigo-400 animate-pulse">
                                    <Activity size={10} /> ANALYZING...
                                </span>
                            )}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                            {result ? `${result.fileName} • ${result.segments.length} segments identified` : 'Waiting for analysis...'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all shadow-lg border border-transparent hover:border-white/10"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {result ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Top Stats Bar */}
                        <div className="p-6 pb-0 flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
                            <div className="bg-white/5 border border-white/5 rounded-[24px] px-6 py-4 flex items-center gap-4 shadow-xl">
                                <Clock size={20} className="text-amber-400" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Window</p>
                                    <p className="text-lg font-black text-slate-100">{(result.totalDuration / 1000).toFixed(3)}s</p>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-[24px] px-6 py-4 flex items-center gap-4 shadow-xl">
                                <Target size={20} className="text-emerald-400" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Health Index</p>
                                    <p className="text-lg font-black text-emerald-400">{Math.round((result.passCount / Math.max(1, result.segments.length)) * 100)}%</p>
                                </div>
                            </div>

                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[24px] px-6 py-4 flex items-center gap-4 shadow-xl">
                                <TrendingUp size={20} className="text-indigo-400" />
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest">Bottlenecks</p>
                                    <p className="text-lg font-black text-slate-100">{result.failCount}</p>
                                </div>
                            </div>
                        </div>

                        {/* Flame Map Section */}
                        <div className={`p-6 pb-2 transition-all duration-500 ${flameExpanded ? 'flex-none h-2/3' : 'h-80'}`}>
                            <div className="h-full bg-black/40 rounded-[32px] border border-white/5 p-6 flex flex-col relative overflow-hidden shadow-inner group/flame">
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Flame size={12} className="text-rose-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interactive Flame Map</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {flameZoom && (
                                            <button onClick={() => setFlameZoom(null)} className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-[9px] font-bold rounded-lg border border-indigo-500/20 hover:bg-indigo-500/30 transition-all">
                                                Reset Zoom
                                            </button>
                                        )}
                                        <button onClick={() => setFlameExpanded(!flameExpanded)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-all">
                                            {flameExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-black/20 rounded-2xl p-4">
                                    <div
                                        className="relative min-w-full"
                                        style={{
                                            height: `${(maxLane + 1) * 32}px`,
                                            width: '100%'
                                        }}
                                    >
                                        {flameSegments.map(s => {
                                            const isSelected = s.id === selectedSegmentId;
                                            const isBottleneck = s.duration > targetTime;

                                            const viewStart = flameZoom?.startTime ?? result.startTime;
                                            const viewEnd = flameZoom?.endTime ?? result.endTime;
                                            const viewDuration = Math.max(1, viewEnd - viewStart);

                                            if (s.endTime < viewStart || s.startTime > viewEnd) return null;

                                            const left = ((s.startTime - viewStart) / viewDuration) * 100;
                                            const width = (s.duration / viewDuration) * 100;

                                            return (
                                                <motion.div
                                                    key={s.id}
                                                    layoutId={`flame-${s.id}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSegmentId(s.id);
                                                    }}
                                                    onDoubleClick={() => {
                                                        const padding = Math.max(s.duration * 0.5, 100);
                                                        setFlameZoom({
                                                            startTime: Math.max(result.startTime, s.startTime - padding),
                                                            endTime: Math.min(result.endTime, s.endTime + padding)
                                                        });
                                                    }}
                                                    className={`absolute h-5 rounded-md flex items-center px-1.5 cursor-pointer transition-all border group/item ${isSelected ? 'z-30 border-white shadow-lg' : 'z-10 border-transparent hover:border-white/20'
                                                        }`}
                                                    style={{
                                                        left: `${left}%`,
                                                        width: `${Math.max(0.5, width)}%`,
                                                        top: `${s.lane * 32}px`,
                                                        backgroundColor: isSelected ? '#818cf8' : (isBottleneck ? '#f43f5e' : palette[s.lane % palette.length]),
                                                        opacity: isSelected ? 1 : 0.8
                                                    }}
                                                >
                                                    <span className="text-[7px] font-black text-white truncate leading-none uppercase drop-shadow">
                                                        {width > 2 && s.name}
                                                    </span>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Grid: Bottlenecks & Details */}
                        <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden pt-2">
                            {/* Left: Top Bottlenecks */}
                            <div className="col-span-4 flex flex-col bg-slate-900/40 border border-white/5 rounded-[32px] overflow-hidden">
                                <div className="px-6 py-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp size={14} /> Critical Bottlenecks
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                                    {topBottlenecks.map((s, idx) => (
                                        <div
                                            key={s.id}
                                            onClick={() => setSelectedSegmentId(s.id)}
                                            className={`group px-4 py-3 rounded-2xl flex items-center justify-between hover:bg-white/5 cursor-pointer transition-all border border-transparent ${selectedSegmentId === s.id ? 'bg-indigo-500/10 border-indigo-500/20' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${s.duration > targetTime ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <p className="text-[11px] font-black text-slate-200 uppercase truncate w-32">{s.name}</p>
                                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                                        L{s.startLine} → L{s.endLine}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xs font-black ${s.duration > targetTime ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {s.duration}ms
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Selected Detail */}
                            <div className="col-span-8 flex flex-col bg-slate-900/40 border border-white/5 rounded-[32px] overflow-hidden relative">
                                <AnimatePresence mode="wait">
                                    {selectedSegment ? (
                                        <motion.div
                                            key={selectedSegment.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute inset-0 flex flex-col p-8"
                                        >
                                            <div className="flex items-center justify-between mb-6 shrink-0">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                                        {selectedSegment.type === 'combo' ? <Activity size={24} /> : <Target size={24} />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight">{selectedSegment.name}</h3>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                                            {selectedSegment.type === 'combo' ? 'Combo Range' : 'Step Transition'} • ID: {selectedSegment.id}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-2xl font-black ${selectedSegment.duration > targetTime ? 'text-rose-500' : 'text-emerald-400'}`}>
                                                        {selectedSegment.duration}ms
                                                    </p>
                                                    <div className="flex items-center gap-2 justify-end mt-1">
                                                        <div className={`w-2 h-2 rounded-full ${selectedSegment.status === 'pass' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                                                        <span className={`text-[9px] font-black uppercase ${selectedSegment.status === 'pass' ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                                            {selectedSegment.status === 'pass' ? 'PASS' : 'TARGET EXCEEDED'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                                                <div className="col-span-8 space-y-4 overflow-hidden flex flex-col">
                                                    <div className="flex-1 bg-black/40 rounded-3xl p-6 border border-white/5 font-mono text-[10px] overflow-y-auto custom-scrollbar">
                                                        <div className="text-slate-500 mb-4 border-b border-white/5 pb-2 uppercase font-bold tracking-widest">Captured Logic Flow</div>
                                                        {selectedSegment.logs.map((log, i) => (
                                                            <div key={i} className="flex gap-4 mb-3 last:mb-0 group/line">
                                                                <span className="text-indigo-500/70 font-bold shrink-0">{i === 0 ? 'START' : 'END'}</span>
                                                                <span className="text-slate-300 break-all leading-relaxed">{log}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => onJumpToLine?.(selectedSegment.startLine)}
                                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3"
                                                    >
                                                        Jump to Root Cause <ArrowRight size={16} />
                                                    </button>
                                                </div>

                                                <div className="col-span-4 bg-white/2 rounded-3xl p-6 border border-white/5 flex flex-col justify-center gap-6">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Start Timestamp</span>
                                                        <span className="text-md font-mono text-slate-200">{new Date(selectedSegment.startTime).toLocaleTimeString()}.{String(selectedSegment.startTime % 1000).padStart(3, '0')}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Start Line index</span>
                                                        <span className="text-md font-mono text-slate-200"># {selectedSegment.startLine.toLocaleString()}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">End Line index</span>
                                                        <span className="text-md font-mono text-slate-200"># {selectedSegment.endLine.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 px-20 text-center select-none">
                                            <div className="p-6 bg-white/2 rounded-[40px] border border-white/5 mb-6 text-slate-500/30">
                                                <Activity size={64} strokeWidth={1} />
                                            </div>
                                            <h4 className="text-slate-300 font-black uppercase tracking-widest text-sm mb-2">Segment Diagnostics</h4>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-wider">
                                                Select any segment from the Flame Map or Bottleneck list to view deep diagnostics and original log content.
                                            </p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <Lucide.Loader2 size={32} className="animate-spin text-indigo-500/50 mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Processing performance data...</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
