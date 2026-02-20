import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutDashboard, Target, Activity, ChevronUp, ChevronDown, RefreshCw, ZoomIn, Search, Maximize, Clock, AlignLeft, Copy, Maximize2 } from 'lucide-react';
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
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Time Ruler Tool Logic
    const [measureRange, setMeasureRange] = useState<{ startTime: number, endTime: number } | null>(null);
    const [isShiftPressed, setIsShiftPressed] = useState(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(true); };
        const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // Bottleneck Navigator Logic
    const [currentBottleneckIndex, setCurrentBottleneckIndex] = useState(-1);
    const bottlenecks = useMemo(() => {
        if (!result) return [];
        return result.bottlenecks || result.segments.filter(s => s.duration >= (result.perfThreshold || 1000));
    }, [result]);

    const jumpToBottleneck = (index: number) => {
        if (!result || bottlenecks.length === 0) return;

        let targetIndex = index;
        if (targetIndex < 0) targetIndex = bottlenecks.length - 1;
        if (targetIndex >= bottlenecks.length) targetIndex = 0;

        const target = bottlenecks[targetIndex];
        setCurrentBottleneckIndex(targetIndex);
        setSelectedSegmentId(target.id);

        // User requested: Do not zoom in on the bottleneck segment. Keep the map fully zoomed out.
        setFlameZoom(null);

        // Sync with log viewer
        if (onJumpToRange) {
            onJumpToRange(target.startLine, target.endLine);
        }
    };

    const [isScanningStatus, setIsScanningStatus] = useState(isAnalyzing);
    const minScanTimeMs = 1000;
    const scanStartTimeRef = React.useRef<number>(0);
    const scanTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const dragCleanupRef = React.useRef<(() => void) | null>(null);

    useEffect(() => {
        if (isAnalyzing) {
            setIsScanningStatus(true);
            scanStartTimeRef.current = Date.now();
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        } else {
            const elapsed = Date.now() - scanStartTimeRef.current;
            if (elapsed < minScanTimeMs) {
                scanTimeoutRef.current = setTimeout(() => {
                    setIsScanningStatus(false);
                }, minScanTimeMs - elapsed);
            } else {
                setIsScanningStatus(false);
            }
        }

        return () => {
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        };
    }, [isAnalyzing]);

    useEffect(() => {
        return () => {
            if (dragCleanupRef.current) dragCleanupRef.current();
        };
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchQuery(searchInput);
        }, 250);
        return () => clearTimeout(timeout);
    }, [searchInput]);

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
            className="w-full border-b-[6px] border-[#080b14] shadow-[0_8px_16px_rgba(0,0,0,0.6)] z-10 flex flex-col transition-all duration-300 ease-in-out relative group/dashboard"
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
                            dragCleanupRef.current = null;
                        };
                        dragCleanupRef.current = onUp;
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
                    <div className={`flex items-center gap-2 ${isScanningStatus ? 'animate-pulse text-indigo-400' : 'text-slate-400'}`}>
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
                    {/* Search Input */}
                    <div className="flex items-center bg-black/20 rounded border border-white/10 px-2 py-1 mr-2 focus-within:border-indigo-500/50 focus-within:bg-black/40 transition-colors">
                        <Search size={12} className="text-slate-500 mr-2" />
                        <input
                            type="text"
                            placeholder="Filter segments..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="bg-transparent text-[10px] text-white w-32 focus:outline-none placeholder:text-slate-600 font-mono"
                        />
                        {searchInput && (
                            <button onClick={() => setSearchInput('')} className="text-slate-500 hover:text-white ml-1">
                                <X size={10} />
                            </button>
                        )}
                    </div>

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
            <AnimatePresence mode="wait">
                {isScanningStatus ? (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm z-50 relative overflow-hidden"
                    >
                        {/* Colorful Loading / Scanning Animation */}
                        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                            {/* Outer spinning gradient ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                className="absolute inset-0 rounded-full border-t-4 border-indigo-500 border-r-4 border-pink-500 border-b-4 border-emerald-500 border-l-4 border-transparent opacity-80 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                            />
                            {/* Inner pulsing orb */}
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                className="absolute inset-4 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 blur-md"
                            />
                            {/* Center Icon */}
                            <Activity size={32} className="text-white relative z-10" />
                        </div>
                        <h3 className="text-white font-bold text-lg tracking-wider mb-3 drop-shadow-md">Analyzing Performance</h3>
                        <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-mono">
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                            />
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                className="w-1.5 h-1.5 rounded-full bg-pink-400"
                            />
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                            />
                            <span className="ml-2 uppercase tracking-widest text-slate-400">Extracting transactions...</span>
                        </div>
                    </motion.div>
                ) : !minimized && result ? (
                    <motion.div
                        key="content"
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

                            {/* Bottleneck Navigator */}
                            {bottlenecks.length > 0 && (
                                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex flex-col gap-2">
                                    <span className="text-[9px] text-rose-400 uppercase font-black flex items-center gap-1">
                                        <Target size={10} />
                                        Bottleneck Navigator
                                    </span>
                                    <div className="flex items-center justify-between gap-1">
                                        <button
                                            onClick={() => jumpToBottleneck(currentBottleneckIndex - 1)}
                                            className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold transition-colors flex-1 text-center"
                                        >
                                            ◀ Prev
                                        </button>
                                        <span className="text-[10px] text-slate-400 font-mono px-2">
                                            {currentBottleneckIndex >= 0 ? currentBottleneckIndex + 1 : '-'} / {bottlenecks.length}
                                        </span>
                                        <button
                                            onClick={() => jumpToBottleneck(currentBottleneckIndex + 1)}
                                            className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold transition-colors flex-1 text-center"
                                        >
                                            Next ▶
                                        </button>
                                    </div>
                                </div>
                            )}

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
                                    className={`flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-4 relative select-none group/chart ${isShiftPressed ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
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
                                        const containerWidth = e.currentTarget.clientWidth;
                                        const rect = e.currentTarget.getBoundingClientRect();

                                        const viewStart = flameZoom?.startTime ?? result.startTime;
                                        const viewEnd = flameZoom?.endTime ?? result.endTime;
                                        const viewDuration = Math.max(1, viewEnd - viewStart);

                                        // Helper for Magnetic Snap
                                        const getSnappedTime = (rawTime: number) => {
                                            const pixelToTimeRatio = viewDuration / containerWidth;
                                            const snapThresholdTime = 10 * pixelToTimeRatio; // ~10px snap radius

                                            let bestSnap = rawTime;
                                            let minDiff = snapThresholdTime;

                                            flameSegments.forEach(s => {
                                                // Check start
                                                const diffStart = Math.abs(s.startTime - rawTime);
                                                if (diffStart < minDiff) { minDiff = diffStart; bestSnap = s.startTime; }
                                                // Check end
                                                const diffEnd = Math.abs(s.endTime - rawTime);
                                                if (diffEnd < minDiff) { minDiff = diffEnd; bestSnap = s.endTime; }
                                            });
                                            return bestSnap;
                                        };

                                        if (e.shiftKey) {
                                            // == MEASURE (RULER) MODE ==
                                            e.preventDefault();

                                            // Init point
                                            const startFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / containerWidth));
                                            const rawStartTime = viewStart + (viewDuration * startFraction);
                                            const snappedStartTime = getSnappedTime(rawStartTime);

                                            setMeasureRange({
                                                startTime: snappedStartTime,
                                                endTime: snappedStartTime
                                            });

                                            const onMove = (mv: MouseEvent) => {
                                                const moveFraction = Math.max(0, Math.min(1, (mv.clientX - rect.left) / containerWidth));
                                                const rawEndTime = viewStart + (viewDuration * moveFraction);
                                                const snappedEndTime = getSnappedTime(rawEndTime);

                                                setMeasureRange(prev => prev ? {
                                                    ...prev,
                                                    endTime: snappedEndTime
                                                } : null);
                                            };

                                            const onUp = () => {
                                                window.removeEventListener('mousemove', onMove);
                                                window.removeEventListener('mouseup', onUp);
                                                dragCleanupRef.current = null;
                                            };
                                            dragCleanupRef.current = onUp;
                                            window.addEventListener('mousemove', onMove);
                                            window.addEventListener('mouseup', onUp);

                                        } else {
                                            // == SIMPLE PAN MODE ==
                                            // If clicking without shift, clear ruler
                                            setMeasureRange(null);

                                            const startX = e.clientX;
                                            const currentStart = viewStart;
                                            const currentEnd = viewEnd;
                                            const duration = currentEnd - currentStart;

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
                                                dragCleanupRef.current = null;
                                            };

                                            dragCleanupRef.current = onUp;
                                            window.addEventListener('mousemove', onMove);
                                            window.addEventListener('mouseup', onUp);
                                        }
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

                                        {/* Time Ruler UI */}
                                        {measureRange && (() => {
                                            const viewStart = flameZoom?.startTime ?? result.startTime;
                                            const viewDuration = Math.max(1, (flameZoom?.endTime ?? result.endTime) - viewStart);
                                            const rulerStart = Math.min(measureRange.startTime, measureRange.endTime);
                                            const rulerEnd = Math.max(measureRange.startTime, measureRange.endTime);
                                            const leftPercent = ((rulerStart - viewStart) / viewDuration) * 100;
                                            const widthPercent = ((rulerEnd - rulerStart) / viewDuration) * 100;

                                            return (
                                                <div
                                                    className="absolute top-0 bottom-0 bg-amber-500/20 border-x-2 border-amber-500/80 z-[80] pointer-events-none shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                    style={{
                                                        left: `${Math.max(0, leftPercent)}%`,
                                                        width: `${Math.max(0.1, widthPercent)}%`
                                                    }}
                                                >
                                                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 font-bold text-[11px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap flex items-center gap-1.5 backdrop-blur-sm border border-amber-400">
                                                        <Clock size={11} />
                                                        {(rulerEnd - rulerStart).toLocaleString(undefined, { maximumFractionDigits: 2 })}ms
                                                    </div>
                                                </div>
                                            );
                                        })()}

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

                                            const isMatch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());

                                            // Determine base opacity:
                                            // Selected: 1, Normal Match: 0.9, Normal Interval Match: 0.6
                                            // Non-Match: Dim to 0.15
                                            const baseOpacity = isSelected ? 1 : (isInterval ? 0.6 : 0.9);
                                            const finalOpacity = isMatch ? baseOpacity : 0.15;

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
                                                    className={`absolute h-5 rounded flex items-center px-1.5 cursor-pointer transition-all group/item ${isSelected
                                                        ? 'z-[60] border-2 border-white/90 shadow-[0_0_8px_1px_rgba(255,255,255,0.7)] brightness-110 saturate-110'
                                                        : 'z-10 border border-transparent hover:border-white/20 hover:brightness-105'
                                                        } ${isGroup && !isSelected ? 'border-2 border-white/30 shadow-sm' : ''} ${isInterval ? 'opacity-70' : ''}`}
                                                    style={{
                                                        left: `${left}%`,
                                                        width: `${Math.max(0.2, width)}%`,
                                                        top: `${s.lane * 28 + 24}px`,
                                                        backgroundColor: bgColor,
                                                        opacity: finalOpacity
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

                            {viewMode === 'chart' && flameSegments.length > 0 && (
                                <div className="h-10 shrink-0 bg-slate-900 border-t border-white/10 relative select-none">
                                    <div
                                        className="absolute inset-0 cursor-pointer"
                                        onMouseDown={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const clickFraction = Math.max(0, Math.min(1, x / rect.width));

                                            const totalDuration = result.endTime - result.startTime;
                                            const currentDuration = (flameZoom?.endTime ?? result.endTime) - (flameZoom?.startTime ?? result.startTime);

                                            let newStart = result.startTime + (clickFraction * totalDuration) - (currentDuration / 2);
                                            let newEnd = newStart + currentDuration;

                                            // Clamp
                                            if (newStart < result.startTime) {
                                                newStart = result.startTime;
                                                newEnd = newStart + currentDuration;
                                            }
                                            if (newEnd > result.endTime) {
                                                newEnd = result.endTime;
                                                newStart = newEnd - currentDuration;
                                            }

                                            setFlameZoom({ startTime: newStart, endTime: newEnd });
                                        }}
                                    >
                                        {/* Minimap Segments */}
                                        {flameSegments.map(s => {
                                            if (s.duration === 0) return null;
                                            const totalDuration = Math.max(1, result.endTime - result.startTime);
                                            const left = ((s.startTime - result.startTime) / totalDuration) * 100;
                                            const width = (s.duration / totalDuration) * 100;
                                            const isBottleneck = s.duration > targetTime;
                                            // Fallback palette color if no dangerColor
                                            const bgColor = s.dangerColor || (isBottleneck ? '#be123c' : palette[s.lane % palette.length]);

                                            const isMatch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
                                            const finalOpacity = isMatch ? 0.85 : 0.15;

                                            return (
                                                <div
                                                    key={`mini-${s.id}`}
                                                    className="absolute"
                                                    style={{
                                                        left: `${left}%`,
                                                        width: `${Math.max(0.1, width)}%`,
                                                        bottom: 0,
                                                        height: `${Math.max(6, (s.lane + 1) * 3)}px`,
                                                        backgroundColor: bgColor,
                                                        opacity: finalOpacity
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Viewport Overlay */}
                                        <div
                                            className="absolute top-0 bottom-0 bg-white/10 border-x-2 border-indigo-400 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors"
                                            style={{
                                                left: `${((flameZoom?.startTime ?? result.startTime) - result.startTime) / Math.max(1, result.endTime - result.startTime) * 100}%`,
                                                width: `${((flameZoom?.endTime ?? result.endTime) - (flameZoom?.startTime ?? result.startTime)) / Math.max(1, result.endTime - result.startTime) * 100}%`
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation(); // Prevent jumping
                                                const startX = e.clientX;
                                                const initialStart = flameZoom?.startTime ?? result.startTime;
                                                const initialEnd = flameZoom?.endTime ?? result.endTime;
                                                const currentDuration = initialEnd - initialStart;
                                                const totalDuration = result.endTime - result.startTime;

                                                // We need the parent width to calculate fraction, but we can't reliably get `e.currentTarget.parentElement` because of React typing. 
                                                // We'll approximate using the nearest relative ancestor's width.
                                                const containerWidth = e.currentTarget.parentElement?.clientWidth || window.innerWidth / 2;

                                                const onMove = (mv: MouseEvent) => {
                                                    const deltaX = mv.clientX - startX;
                                                    const fractionMoved = deltaX / containerWidth;
                                                    const timeMoved = fractionMoved * totalDuration;

                                                    let newStart = initialStart + timeMoved;
                                                    let newEnd = initialEnd + timeMoved;

                                                    // Clamp
                                                    if (newStart < result.startTime) {
                                                        newStart = result.startTime;
                                                        newEnd = newStart + currentDuration;
                                                    }
                                                    if (newEnd > result.endTime) {
                                                        newEnd = result.endTime;
                                                        newStart = newEnd - currentDuration;
                                                    }

                                                    setFlameZoom({ startTime: newStart, endTime: newEnd });
                                                };

                                                const onUp = () => {
                                                    window.removeEventListener('mousemove', onMove);
                                                    window.removeEventListener('mouseup', onUp);
                                                    dragCleanupRef.current = null;
                                                };

                                                dragCleanupRef.current = onUp;
                                                window.addEventListener('mousemove', onMove);
                                                window.addEventListener('mouseup', onUp);
                                            }}
                                        />
                                    </div>
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
                                            {(result.bottlenecks || [...result.segments].sort((a, b) => b.duration - a.duration).slice(0, 50))
                                                .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .map(s => {
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
                ) : null}
            </AnimatePresence>

            {
                !result && !minimized && !isScanningStatus && (
                    <div className="flex-1 flex items-center justify-center text-slate-600 gap-2">
                        <Activity size={20} className="opacity-20" />
                        <span className="text-xs font-bold uppercase tracking-widest opacity-50">
                            Ready to Analyze
                        </span>
                    </div>
                )
            }
        </div >
    );
};
