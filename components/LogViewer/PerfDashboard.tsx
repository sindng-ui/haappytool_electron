import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';

interface PerfDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    result: AnalysisResult | null;
    isAnalyzing: boolean;
    onJumpToLine?: (lineNum: number) => void;
    onJumpToRange?: (start: number, end: number) => void;
    onViewRawRange?: (originalStart: number, originalEnd: number, filteredIndex?: number) => void;
    onCopyRawRange?: (start: number, end: number) => void;
    targetTime: number;
    height: number;
    onHeightChange: (height: number) => void;
}

const {
    Flame, TrendingUp, X, ChevronUp, ChevronDown, Maximize2, Minimize2, Activity, Clock, Target, ArrowRight,
    LayoutDashboard, AlignLeft, Copy, GripHorizontal
} = Lucide;

/**
 * Calculates whether black or white text should be used based on background brightness (YIQ)
 */
const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return 'rgba(255, 255, 255, 0.9)';

    // Support for CSS variables or rgba/rgb - for now we focus on hex as provided by settings
    if (!hexcolor.startsWith('#')) return 'rgba(255, 255, 255, 0.9)';

    const hex = hexcolor.slice(1);
    let r, g, b;

    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    }

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';
};

export const PerfDashboard: React.FC<PerfDashboardProps> = ({
    isOpen, onClose, result, isAnalyzing,
    onJumpToLine, onJumpToRange, onViewRawRange, onCopyRawRange,
    targetTime, height, onHeightChange
}) => {
    const [flameZoom, setFlameZoom] = useState<{ startTime: number; endTime: number } | null>(null);
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
    const [minimized, setMinimized] = useState(false);

    // Constants for coloring
    const palette = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

    // Helper for Axis Ticks
    const generateTicks = (start: number, end: number, minTicks: number = 5) => {
        const duration = Math.max(1, end - start);
        const rawInterval = duration / minTicks;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        let interval = magnitude;
        if (rawInterval / magnitude >= 5) interval = magnitude * 5;
        else if (rawInterval / magnitude >= 2) interval = magnitude * 2;
        if (interval < 1) interval = 1;

        const firstTick = Math.ceil(start / interval) * interval;
        const ticks = [];
        for (let t = firstTick; t <= end; t += interval) {
            ticks.push(t);
        }
        return ticks;
    };

    const flameSegments = useMemo(() => {
        if (!result) return [];

        // StartTime ASC, Duration DESC
        const sorted = [...result.segments].sort((a, b) => (a.startTime - b.startTime) || (b.duration - a.duration));
        const lanes: number[] = [];
        const totalDuration = result.endTime - result.startTime;
        const minVisualDuration = totalDuration * 0.005; // 0.5% width minimum

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



    if (!isOpen) return null;

    return (
        <div
            className="w-full border-b border-white/10 flex flex-col transition-all duration-300 ease-in-out relative group/dashboard"
            style={{
                height: minimized ? '40px' : `${height}px`,
                backgroundColor: '#0f172a' // Slate-950 distinct bg
            }}
        >
            {/* Resizer Handle (Bottom) - Refined Pill Design */}
            {!minimized && (
                <div
                    className="absolute -bottom-2 left-0 right-0 h-4 cursor-ns-resize z-[100] flex justify-end px-12 group/resizer"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startY = e.clientY;
                        const startH = height;
                        const onMove = (mv: MouseEvent) => {
                            onHeightChange(Math.max(200, Math.min(800, startH + (mv.clientY - startY))));
                        };
                        const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                        };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                    }}
                >
                    {/* Visual Pill Tab */}
                    <div className="w-10 h-3 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-b-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-x border-b border-white/20 group-hover/resizer:h-4 group-hover/resizer:from-indigo-400 group-hover/resizer:to-indigo-600 transition-all duration-200 origin-top">
                        <div className="flex gap-0.5">
                            <div className="w-0.5 h-0.5 bg-white/80 rounded-full shadow-sm" />
                            <div className="w-0.5 h-0.5 bg-white/80 rounded-full shadow-sm" />
                            <div className="w-0.5 h-0.5 bg-white/80 rounded-full shadow-sm" />
                        </div>
                    </div>
                </div>
            )}

            {/* Header Bar */}
            <div className="h-10 shrink-0 flex items-center justify-between px-4 bg-slate-900 border-b border-white/5 select-none">
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 ${isAnalyzing ? 'animate-pulse text-indigo-400' : 'text-slate-400'}`}>
                        <LayoutDashboard size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">Performance Dashboard</span>
                    </div>
                    {result && (
                        <>
                            <div className="h-3 w-px bg-slate-700 mx-1" />
                            <span className="text-[10px] text-slate-500 font-mono">
                                {result.totalDuration.toLocaleString()}ms • {result.segments.length} segments • Limit: {result.perfThreshold}ms
                            </span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMinimized(!minimized)}
                        className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                    >
                        {minimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-slate-400 transition-colors ml-1"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <AnimatePresence>
                {!minimized && result && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex overflow-hidden"
                    >
                        {/* Summary & Controls Panel (Left) */}
                        <div className="w-64 shrink-0 border-r border-white/5 bg-slate-900/50 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                    <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Pass Rate</span>
                                    <span className={`text-lg font-black ${result.passCount === result.segments.length ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {Math.round((result.passCount / Math.max(1, result.segments.length)) * 100)}%
                                    </span>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                    <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Slow Ops</span>
                                    <span className={`text-lg font-black ${result.failCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {result.failCount}
                                    </span>
                                </div>
                            </div>

                            {/* View Toggles */}
                            <div className="flex p-1 bg-slate-950 rounded-lg border border-white/5 gap-0.5">
                                <button
                                    onClick={() => setViewMode('chart')}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1.5 ${viewMode === 'chart' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Activity size={12} /> Chart
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1.5 ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <AlignLeft size={12} /> Bottlenecks
                                </button>
                            </div>
                            {selectedSegmentId && (
                                <div className="mt-auto bg-slate-800/80 rounded-xl p-3 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                                    {(() => {
                                        const s = result.segments.find(sg => sg.id === selectedSegmentId);
                                        if (!s) return null;
                                        return (
                                            <>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold text-slate-300 line-clamp-2 leading-tight">{s.name}</span>
                                                    <span className={`text-[10px] font-black ${s.duration > targetTime ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {s.duration}ms
                                                    </span>
                                                </div>
                                                <div className="flex gap-1.5 mt-2">
                                                    <button
                                                        onClick={() => onViewRawRange?.(s.originalStartLine, s.originalEndLine, s.startLine + 1)}
                                                        className="flex-1 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[9px] font-bold uppercase rounded-lg border border-indigo-500/20 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <AlignLeft size={10} /> Raw
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (s.originalStartLine && s.originalEndLine) {
                                                                onCopyRawRange?.(s.originalStartLine, s.originalEndLine);
                                                            }
                                                        }}
                                                        className="flex-1 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-[9px] font-bold uppercase rounded-lg border border-white/5 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Copy size={10} /> Copy Logs
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Main View Area (Right) */}
                        <div className="flex-1 bg-black/20 relative overflow-hidden flex flex-col">
                            {viewMode === 'chart' && flameZoom && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFlameZoom(null);
                                    }}
                                    className="absolute bottom-6 right-8 z-[60] px-3.5 py-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-indigo-400 hover:text-white hover:bg-indigo-600 shadow-2xl transition-all flex items-center gap-1.5 animate-in fade-in zoom-in duration-300"
                                    title="Reset View"
                                >
                                    <Maximize2 size={12} />
                                    <span>RESET VIEW</span>
                                </button>
                            )}

                            {viewMode === 'chart' && (
                                <div
                                    className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-4 relative select-none cursor-grab active:cursor-grabbing group/chart"
                                    onWheel={(e) => {
                                        if (!result) return;
                                        e.preventDefault();

                                        const currentStart = flameZoom?.startTime ?? result.startTime;
                                        const currentEnd = flameZoom?.endTime ?? result.endTime;
                                        const duration = currentEnd - currentStart;

                                        // Pan (Horizontal Scroll or Shift+Wheel)
                                        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
                                            const delta = e.deltaX || e.deltaY;
                                            const panAmount = (delta / e.currentTarget.clientWidth) * duration;

                                            let newStart = currentStart + panAmount;
                                            let newEnd = currentEnd + panAmount;

                                            // Clamp
                                            if (newStart < result.startTime) {
                                                newStart = result.startTime;
                                                newEnd = newStart + duration;
                                            }
                                            if (newEnd > result.endTime) {
                                                newEnd = result.endTime;
                                                newStart = newEnd - duration;
                                            }

                                            setFlameZoom({ startTime: newStart, endTime: newEnd });
                                        }
                                        // Zoom (Ctrl+Wheel or pinch usually, but let's use vertical wheel for Zoom)
                                        else {
                                            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                                            const newDuration = duration * zoomFactor;

                                            // Focus on mouse position
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pointerX = e.clientX - rect.left;
                                            const fractionalPos = Math.max(0, Math.min(1, pointerX / rect.width));
                                            const timeAtPointer = currentStart + duration * fractionalPos;

                                            let newStart = timeAtPointer - newDuration * fractionalPos;
                                            let newEnd = newStart + newDuration;

                                            // Clamp if zooming out past limits
                                            if (newStart < result.startTime) {
                                                newEnd += (result.startTime - newStart);
                                                newStart = result.startTime;
                                            }
                                            if (newEnd > result.endTime) {
                                                newStart -= (newEnd - result.endTime);
                                                newEnd = result.endTime;
                                            }

                                            // Final clamp ensures we do not exceed original bounds
                                            if (newStart < result.startTime) newStart = result.startTime;
                                            if (newEnd > result.endTime) newEnd = result.endTime;

                                            setFlameZoom({ startTime: newStart, endTime: newEnd });
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        // Simple Drag Pan Implementation
                                        const startX = e.clientX;
                                        const currentStart = flameZoom?.startTime ?? result.startTime;
                                        const currentEnd = flameZoom?.endTime ?? result.endTime;
                                        const duration = currentEnd - currentStart;
                                        const containerWidth = e.currentTarget.clientWidth;

                                        const onMove = (mv: MouseEvent) => {
                                            const deltaX = startX - mv.clientX;
                                            const panAmount = (deltaX / containerWidth) * duration;

                                            let newStart = currentStart + panAmount;
                                            let newEnd = currentEnd + panAmount;

                                            // Clamp
                                            if (newStart < result.startTime) {
                                                newStart = result.startTime;
                                                newEnd = newStart + duration;
                                            }
                                            if (newEnd > result.endTime) {
                                                newEnd = result.endTime;
                                                newStart = newEnd - duration;
                                            }

                                            setFlameZoom({ startTime: newStart, endTime: newEnd });
                                        };

                                        const onUp = () => {
                                            window.removeEventListener('mousemove', onMove);
                                            window.removeEventListener('mouseup', onUp);
                                        };

                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                    }}
                                >
                                    <div
                                        className="relative min-w-full"
                                        style={{
                                            height: `${(maxLane + 1) * 28 + 24}px`,
                                            width: '100%'
                                        }}
                                    >
                                        {/* Time Axis */}
                                        <div className="absolute top-0 left-0 right-0 h-5 border-b border-white/5 text-slate-400 font-mono text-[9px] flex items-end pb-0.5 select-none pointer-events-none z-[45]">
                                            {generateTicks(flameZoom?.startTime ?? result.startTime, flameZoom?.endTime ?? result.endTime, 8).map(t => {
                                                const viewStart = flameZoom?.startTime ?? result.startTime;
                                                const viewDuration = Math.max(1, (flameZoom?.endTime ?? result.endTime) - viewStart);
                                                const left = ((t - viewStart) / viewDuration) * 100;
                                                // hide ticks that are off-screen
                                                if (left < 0 || left > 100) return null;
                                                return (
                                                    <div key={t} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${left}%` }}>
                                                        <span className="mb-0 opacity-70">{(t - result.startTime).toFixed(0)}</span>
                                                        <div className="w-px h-1 bg-white/20" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {flameSegments.map(s => {
                                            const isSelected = s.id === selectedSegmentId;
                                            const isBottleneck = s.duration > targetTime;
                                            const isGroup = s.id.startsWith('group-') && s.duration > 0;
                                            const isInterval = s.id.startsWith('interval-');

                                            const viewStart = flameZoom?.startTime ?? result.startTime;
                                            const viewEnd = flameZoom?.endTime ?? result.endTime;
                                            const viewDuration = Math.max(1, viewEnd - viewStart);

                                            if (s.endTime < viewStart || s.startTime > viewEnd) return null;

                                            const left = ((s.startTime - viewStart) / viewDuration) * 100;
                                            const width = (s.duration / viewDuration) * 100;
                                            const bgColor = isSelected ? '#6366f1' : (s.dangerColor || (isBottleneck ? '#be123c' : palette[s.lane % palette.length]));
                                            const textColor = getContrastColor(bgColor);

                                            return (
                                                <div
                                                    key={s.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSegmentId(s.id);
                                                        onJumpToRange?.(s.startLine, s.endLine);
                                                    }}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1);
                                                    }}
                                                    className={`absolute h-5 rounded flex items-center px-1.5 cursor-pointer transition-all border group/item ${isSelected ? 'z-30 border-white shadow-lg brightness-110' : 'z-10 border-transparent hover:border-white/20 hover:brightness-105'
                                                        } ${isGroup ? 'border-2 border-white/30 shadow-sm' : ''} ${isInterval ? 'opacity-70' : ''}`}
                                                    style={{
                                                        left: `${left}%`,
                                                        width: `${Math.max(0.2, width)}%`,
                                                        top: `${s.lane * 28 + 24}px`,
                                                        backgroundColor: bgColor,
                                                        opacity: isSelected ? 1 : (isInterval ? 0.6 : 0.9)
                                                    }}
                                                    title={`${s.name} (${s.duration}ms)`}
                                                >
                                                    {width > 3 && (
                                                        <span
                                                            className={`text-[9px] font-medium truncate leading-none ${isGroup ? 'font-black' : ''}`}
                                                            style={{ color: textColor }}
                                                        >
                                                            {s.name}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {flameSegments.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                            <span className="text-xs uppercase tracking-widest font-bold">No segments found</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {viewMode === 'list' && (
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-900 shadow-sm z-10">
                                            <tr>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-500 tracking-wider">Status</th>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-500 tracking-wider">Name</th>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-500 tracking-wider text-right">Duration</th>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-500 tracking-wider text-right">Start</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(result.bottlenecks || [...result.segments].sort((a, b) => b.duration - a.duration).slice(0, 50)).map(s => {
                                                const isGroup = s.id.startsWith('group-');
                                                const isInterval = s.id.startsWith('interval-');
                                                const isBottleneck = s.duration >= (result.perfThreshold || 1000);

                                                return (
                                                    <tr
                                                        key={s.id}
                                                        onClick={() => {
                                                            setSelectedSegmentId(s.id);
                                                            onJumpToRange?.(s.startLine, s.endLine);
                                                        }}
                                                        onDoubleClick={() => {
                                                            onViewRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1);
                                                        }}
                                                        className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${selectedSegmentId === s.id ? 'bg-indigo-500/10' : ''} ${isInterval ? 'opacity-60' : ''}`}
                                                    >
                                                        <td className="p-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isBottleneck ? 'bg-rose-500' : 'bg-emerald-500'} ${isGroup ? 'ring-2 ring-emerald-500/50' : ''}`}
                                                                style={{ backgroundColor: s.dangerColor || undefined }} />
                                                        </td>
                                                        <td className={`p-2 text-[10px] font-medium truncate max-w-[200px] ${isGroup ? 'text-white font-bold' : 'text-slate-300'}`}>
                                                            {s.name}
                                                            {isGroup && <span className="ml-2 text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded">GROUP</span>}
                                                        </td>
                                                        <td className={`p-2 text-[10px] font-mono font-bold text-right ${isBottleneck ? 'text-rose-400' : 'text-slate-400'}`}
                                                            style={{ color: s.dangerColor || undefined }}>
                                                            {s.duration}ms
                                                        </td>
                                                        <td className="p-2 text-[10px] font-mono text-slate-500 text-right">
                                                            L{(s.originalStartLine || s.startLine) === (s.originalEndLine || s.endLine) ? (s.originalStartLine || s.startLine) : `${(s.originalStartLine || s.startLine)}-${(s.originalEndLine || s.endLine)}`}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}


                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {
                !result && !minimized && (
                    <div className="flex-1 flex items-center justify-center text-slate-600 gap-2">
                        <Activity size={20} className="animate-bounce opacity-20" />
                        <span className="text-xs font-bold uppercase tracking-widest opacity-50">
                            {isAnalyzing ? 'Analyzing Performance...' : 'Ready to Analyze'}
                        </span>
                    </div>
                )
            }
        </div >
    );
};
