import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';
import { formatDuration } from '../../utils/logTime';

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
    height?: number;
    onHeightChange?: (height: number) => void;
    isFullScreen?: boolean;
}

/**
 * Calculates whether black or white text should be used based on background brightness (YIQ)
 */
const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return 'rgba(255, 255, 255, 0.9)';
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

// --- Sub-components for Premium Cockpit ---

const Scorecard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string; subValue?: string }> = ({ label, value, icon, color, subValue }) => (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl px-3.5 py-1.5 flex flex-col justify-center shadow-xl relative overflow-hidden group min-w-[120px]">
        <div className={`absolute top-0 right-0 w-12 h-12 -mr-4 -mt-4 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity`} style={{ backgroundColor: color }} />
        <div className="flex items-center justify-between gap-3">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] truncate">{label}</span>
            <div style={{ color }} className="opacity-70 group-hover:opacity-100 transition-all shrink-0 scale-75 origin-right">{icon}</div>
        </div>
        <div className="flex items-end gap-1.5 overflow-hidden -mt-1">
            <span className="text-xl font-black text-white tracking-tighter whitespace-nowrap leading-none">{value}</span>
            {subValue && <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap truncate leading-none mb-0.5">{subValue}</span>}
        </div>
    </div>
);

const TransitionCard: React.FC<{
    startFile?: string;
    startFunc?: string;
    endFile?: string;
    endFunc?: string;
}> = ({ startFile, startFunc, endFile, endFunc }) => {
    const isTransition = (startFile !== endFile) || (startFunc !== endFunc);

    return (
        <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3 shadow-inner">
            <div className="flex items-start gap-3">
                <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5 tracking-tighter">Origin Point</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {startFile && <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded-lg border border-indigo-500/20">{startFile}</span>}
                        {startFunc && <span className="text-[11px] font-medium text-slate-300">{startFunc}</span>}
                    </div>
                </div>
            </div>

            {isTransition && (
                <div className="flex flex-col items-center py-1">
                    <div className="w-px h-6 bg-gradient-to-b from-indigo-500/50 to-purple-500/50" />
                    <Lucide.MoveRight size={14} className="text-slate-600 my-1" />
                    <div className="w-px h-6 bg-gradient-to-b from-purple-500/50 to-pink-500/50" />
                </div>
            )}

            {isTransition ? (
                <div className="flex items-start gap-3">
                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5 tracking-tighter">Exit Point</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {endFile && <span className="text-[11px] font-bold text-pink-300 bg-pink-500/10 px-1.5 py-0.5 rounded-lg border border-pink-500/20">{endFile}</span>}
                            {endFunc && <span className="text-[11px] font-medium text-slate-300">{endFunc}</span>}
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-[10px] text-slate-600 font-bold italic pl-4.5">Single point operation (no transition detected)</p>
            )}
        </div>
    );
};

interface FlameSegmentProps {
    s: any;
    flameZoom: any;
    result: any;
    totalDuration: number;
    selectedSegmentId: string | null;
    searchQuery: string;
    onSelect: (id: string, start: number, end: number) => void;
    checkMatch: (s: any, q: string) => boolean;
}

const MemoizedFlameSegment = React.memo<FlameSegmentProps>(({
    s, flameZoom, result, totalDuration, selectedSegmentId, searchQuery, onSelect, checkMatch
}) => {
    const isSelected = selectedSegmentId === s.id;
    const isMatched = checkMatch(s, searchQuery);
    const opacity = isMatched ? 1 : 0.15;

    // Zoom/Pan Transform
    let left = s.relStart * 100;
    let width = s.width;

    if (flameZoom) {
        const zoomStart = (flameZoom.startTime - result.startTime) / 1000;
        const zoomEnd = (flameZoom.endTime - result.startTime) / 1000;
        const zoomDuration = zoomEnd - zoomStart;
        left = ((s.relStart - zoomStart) / zoomDuration) * 100;
        width = (s.width / (zoomDuration / totalDuration * 100)) * 100;
    }

    if (left + width < 0 || left > 100) return null;

    return (
        <motion.div
            layoutId={s.id}
            onClick={() => onSelect(s.id, s.startLine, s.endLine)}
            className={`absolute h-8 rounded-lg cursor-pointer flex flex-col justify-center px-2 shadow-lg transition-all border group/seg ${isSelected ? 'ring-2 ring-white z-40 scale-[1.02] shadow-indigo-500/20' : 'hover:scale-[1.01] hover:z-30'}`}
            style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `${s.lane * 36 + 40}px`,
                backgroundColor: s.dangerColor || '#4f46e5',
                borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.1)',
                opacity
            }}
        >
            <div className="text-[10px] font-bold truncate transition-colors" style={{ color: getContrastColor(s.dangerColor || '#4f46e5') }}>
                {s.name}
            </div>
            <div className="text-[8px] opacity-60 truncate font-mono" style={{ color: getContrastColor(s.dangerColor || '#4f46e5') }}>
                {formatDuration(s.duration)}
            </div>

            {/* Custom Tooltip */}
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-[10px] text-white whitespace-nowrap z-[100] opacity-0 group-hover/seg:opacity-100 transition-opacity pointer-events-none shadow-2xl backdrop-blur-xl`}>
                <p className="font-black text-indigo-400 mb-1">{s.name}</p>
                <div className="flex items-center gap-2 mb-1.5 p-1 px-1.5 bg-white/5 rounded-lg border border-white/5">
                    <Lucide.Clock size={10} className="text-slate-400" />
                    <span className="font-mono">{formatDuration(s.duration)}</span>
                    <div className="w-px h-2.5 bg-white/10" />
                    <span className="text-slate-500">TID: {s.tid}</span>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="text-slate-300 font-bold">{s.fileName || 'Unknown File'}</span>
                        <span className="text-slate-500 ml-auto whitespace-pre">  →  </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                        <span className="text-slate-300 font-bold">{s.endFileName || s.fileName || 'Unknown File'}</span>
                    </div>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[9px] text-slate-500 flex justify-between italic">
                    <span>Lines {s.startLine} - {s.endLine}</span>
                    <span className="text-emerald-400 font-bold ml-4">Click to navigate</span>
                </div>
            </div>
        </motion.div>
    );
});

export const PerfDashboard: React.FC<PerfDashboardProps> = ({
    isOpen, onClose, result, isAnalyzing,
    onJumpToLine, onJumpToRange, onViewRawRange, onCopyRawRange,
    targetTime, height = 400, onHeightChange = () => { }, isFullScreen = false
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
        // Match the list logic: top 50 slowest segments
        return [...result.segments].sort((a, b) => b.duration - a.duration).slice(0, 50);
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

    const checkSegmentMatch = (s: AnalysisSegment, query: string) => {
        if (!query) return true;
        const q = query.toLowerCase().trim();

        if (q.startsWith('tid:')) {
            const val = q.substring(4).trim();
            return s.tid?.toLowerCase().includes(val);
        }
        if (q.startsWith('file:')) {
            const val = q.substring(5).trim();
            return s.fileName?.toLowerCase().includes(val);
        }
        if (q.startsWith('func:')) {
            const val = q.substring(5).trim();
            return s.functionName?.toLowerCase().includes(val);
        }

        return (
            s.name.toLowerCase().includes(q) ||
            s.tid?.toLowerCase().includes(q) ||
            s.fileName?.toLowerCase().includes(q) ||
            s.functionName?.toLowerCase().includes(q)
        );
    };

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
            let lane = s.lane !== undefined ? s.lane : 0;
            const effectiveEndTime = Math.max(s.endTime, s.startTime + minVisualDuration);

            // Only run the greedy packing logic if lane was not explicitly provided.
            // This allows PerfTool to show one lane per TID accurately.
            if (s.lane === undefined) {
                while (lanes[lane] !== undefined && lanes[lane] > s.startTime) {
                    lane++;
                }
            }

            lanes[lane] = Math.max(lanes[lane] || 0, effectiveEndTime);

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
            className={`w-full z-10 flex flex-col transition-all duration-300 ease-in-out relative group/dashboard ${isFullScreen ? 'h-full flex-1' : 'border-b-[6px] border-[#080b14] shadow-[0_8px_16px_rgba(0,0,0,0.6)]'}`}
            style={isFullScreen ? { backgroundColor: '#0f172a' } : {
                height: minimized ? '40px' : `${height}px`,
                backgroundColor: '#0f172a' // Slate-950 distinct bg
            }}
        >
            {/* Resizer Handle (Bottom) - Refined Pill Design */}
            {!minimized && !isFullScreen && (
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
                        <Lucide.LayoutDashboard size={14} />
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
                        <Lucide.Search size={12} className="text-slate-500 mr-2" />
                        <input
                            type="text"
                            placeholder="Filter segments..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="bg-transparent text-[10px] text-white w-32 focus:outline-none placeholder:text-slate-600 font-mono"
                        />
                        {searchInput && (
                            <button onClick={() => setSearchInput('')} className="text-slate-500 hover:text-white ml-1">
                                <Lucide.X size={10} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setMinimized(!minimized)}
                        className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                    >
                        {minimized ? <Lucide.ChevronDown size={14} /> : <Lucide.ChevronUp size={14} />}
                    </button>
                    {!isFullScreen && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-slate-400 transition-colors ml-1"
                        >
                            <Lucide.X size={14} />
                        </button>
                    )}
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
                            <Lucide.Activity size={32} className="text-white relative z-10" />
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
                        {/* Summary & Controls Panel (Left) - Hidden in FullScreen */}
                        {!isFullScreen && (
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
                                            <Lucide.Target size={10} />
                                            Slowest Op Navigator (Top 50)
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
                                        <Lucide.Activity size={12} /> Chart
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1.5 ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <Lucide.AlignLeft size={12} /> Bottlenecks
                                    </button>
                                </div>
                                {/* Sidebar Detail (Removed in favor of Docked Footer) */}

                            </div>
                        )}

                        {/* Main View Area (Right) */}
                        <div className="flex-1 bg-black/20 relative overflow-hidden flex flex-col">
                            {/* FullScreen Top Bar Utility */}
                            {isFullScreen && (
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
                                            value={`${Math.round(result.passCount / Math.max(1, result.segments.length) * 100)}%`}
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
                                        {/* Navigator in Top Bar */}
                                        {bottlenecks.length > 0 && (
                                            <div className="flex items-center gap-3 px-4 py-2 bg-rose-500/5 backdrop-blur-md border border-rose-500/20 rounded-2xl shadow-lg">
                                                <span className="text-[9px] text-rose-400 uppercase font-black flex items-center gap-1.5 shrink-0">
                                                    <Lucide.Target size={12} />
                                                    Navigator
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => jumpToBottleneck(currentBottleneckIndex - 1)}
                                                        className="w-8 h-8 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl transition-all hover:scale-105 active:scale-95"
                                                    >
                                                        <Lucide.ChevronLeft size={16} />
                                                    </button>
                                                    <span className="text-xs text-slate-200 font-mono font-black min-w-[50px] text-center">
                                                        {currentBottleneckIndex >= 0 ? currentBottleneckIndex + 1 : '-'} <span className="text-slate-600">/</span> {bottlenecks.length}
                                                    </span>
                                                    <button
                                                        onClick={() => jumpToBottleneck(currentBottleneckIndex + 1)}
                                                        className="w-8 h-8 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl transition-all hover:scale-105 active:scale-95"
                                                    >
                                                        <Lucide.ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="h-10 w-px bg-white/5 mx-2" />

                                        <div className="flex items-center gap-3">
                                            <div className="p-1 bg-slate-950 rounded-lg border border-white/5 flex gap-1">
                                                <button
                                                    onClick={() => setViewMode('chart')}
                                                    className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${viewMode === 'chart' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    Chart
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('list')}
                                                    className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    List
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {viewMode === 'chart' && flameZoom && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFlameZoom(null);
                                    }}
                                    className="absolute bottom-6 right-8 z-[60] px-3.5 py-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-indigo-400 hover:text-white hover:bg-indigo-600 shadow-2xl transition-all flex items-center gap-1.5 animate-in fade-in zoom-in duration-300"
                                    title="Reset View"
                                >
                                    <Lucide.Maximize2 size={12} />
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
                                                        <Lucide.Clock size={11} />
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
                                            const isMatch = checkSegmentMatch(s, searchQuery);

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
                                                    title={`TID ${s.tid || 'N/A'}\nStart: ${s.fileName || 'N/A'}: ${s.functionName || 'N/A'}${((s.fileName !== s.endFileName) || (s.functionName !== s.endFunctionName)) ? `\nEnd: ${s.endFileName || 'N/A'}: ${s.endFunctionName || 'N/A'}` : ''}\nInterval: ${s.intervalIndex || 'N/A'}\nDuration: ${s.duration}ms`}
                                                >
                                                    {width > 3 && (
                                                        <span
                                                            className={`text-[9px] font-medium truncate leading-none ${isGroup ? 'font-black' : ''}`}
                                                            style={{ color: textColor }}
                                                        >
                                                            {s.fileName && s.functionName ? `${s.fileName}: ${s.functionName}` : s.name}
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
                                            const isMatch = checkSegmentMatch(s, searchQuery);
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
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-300 tracking-wider">Status</th>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-300 tracking-wider">Name</th>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-300 tracking-wider text-right">Duration</th>
                                                <th className="p-2 text-[9px] font-black uppercase text-slate-300 tracking-wider text-right">Start</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...result.segments].sort((a, b) => b.duration - a.duration).slice(0, 50)
                                                .filter(s => checkSegmentMatch(s, searchQuery))
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
                                                            <td className={`p-2 text-[10px] font-medium max-w-[350px] ${isGroup ? 'text-white font-bold' : 'text-slate-200'}`}>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="truncate text-white font-bold">{s.name}</span>
                                                                        {isGroup && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-black">GROUP</span>}
                                                                        {s.tid && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1 rounded font-black border border-indigo-500/20">TID {s.tid}</span>}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-300 font-mono truncate flex items-center gap-1 mt-0.5">
                                                                        <div className="flex items-center gap-1">
                                                                            {s.fileName && <span className="text-indigo-300 font-bold">{s.fileName}</span>}
                                                                            {s.fileName && s.functionName && <span className="text-slate-500">:</span>}
                                                                            {s.functionName && <span className="text-emerald-400 font-bold">{s.functionName}</span>}
                                                                        </div>
                                                                        {((s.fileName !== s.endFileName) || (s.functionName !== s.endFunctionName)) && (
                                                                            <>
                                                                                <Lucide.MoveRight size={10} className="text-slate-500" />
                                                                                <div className="flex items-center gap-1">
                                                                                    {s.endFileName && <span className="text-purple-300 font-bold">{s.endFileName}</span>}
                                                                                    {s.endFileName && s.endFunctionName && <span className="text-slate-500">:</span>}
                                                                                    {s.endFunctionName && <span className="text-pink-400 font-bold">{s.endFunctionName}</span>}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className={`p-2 text-[10px] font-mono font-bold text-right ${isBottleneck ? 'text-rose-400' : 'text-slate-300'}`}
                                                                style={{ color: s.dangerColor || undefined }}>
                                                                {s.duration}ms
                                                            </td>
                                                            <td className="p-2 text-[10px] font-mono text-slate-300 text-right font-black">
                                                                L{(s.originalStartLine || s.startLine) === (s.originalEndLine || s.endLine) ? (s.originalStartLine || s.startLine) : `${(s.originalStartLine || s.startLine)}-${(s.originalEndLine || s.endLine)}`}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Docked Detail Panel (Definitive Map visibility solution) */}
                            <AnimatePresence>
                                {selectedSegmentId && result && (() => {
                                    const s = result.segments.find(sg => sg.id === selectedSegmentId);
                                    if (!s) return null;
                                    const isBottleneck = s.duration >= (result.perfThreshold || 1000);

                                    return (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="shrink-0 bg-slate-950/80 backdrop-blur-2xl border-t border-white/10 overflow-hidden relative"
                                        >
                                            <div className="p-3 md:p-4 flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
                                                <div className="flex-1 min-w-0 flex items-center gap-4">
                                                    {/* 1. Executor Info */}
                                                    <div className="flex items-center gap-3 pr-4 border-r border-white/5 shrink-0 h-10">
                                                        <div className={`p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-lg`}>
                                                            <Lucide.Activity size={18} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-black text-white tracking-tighter leading-none">{s.tid || '9999'}</span>
                                                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Executor ID</span>
                                                        </div>
                                                    </div>

                                                    {/* 2. Execution Path */}
                                                    <div className="flex-1 flex flex-col gap-1 min-w-0 mx-2 md:mx-4">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Execution Context</span>
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <AnimatePresence mode="wait">
                                                                <motion.div
                                                                    key={s.id}
                                                                    initial={{ x: -10, opacity: 0 }}
                                                                    animate={{ x: 0, opacity: 1 }}
                                                                    exit={{ x: 10, opacity: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    className="flex-1 min-w-0 flex items-center gap-3"
                                                                >
                                                                    <div className="flex-1 min-w-0 flex flex-col">
                                                                        <span className="text-[13px] font-black text-indigo-300 truncate tracking-tight">{s.fileName || 'App.cs'}</span>
                                                                        <span className="text-[10px] font-bold text-slate-400 truncate opacity-80">{s.functionName || 'OnEvent'}</span>
                                                                    </div>

                                                                    {((s.fileName !== s.endFileName) || (s.functionName !== s.endFunctionName)) && (
                                                                        <>
                                                                            <div className="p-1.5 bg-white/5 rounded-full shrink-0">
                                                                                <Lucide.MoveRight size={12} className="text-slate-500" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0 flex flex-col">
                                                                                <span className="text-[13px] font-black text-pink-300 truncate tracking-tight">{s.endFileName || 'App.cs'}</span>
                                                                                <span className="text-[10px] font-bold text-slate-400 truncate opacity-80">{s.endFunctionName || 'OnEvent'}</span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </motion.div>
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 3. Metrics & Actions */}
                                                <div className="flex items-center gap-6 md:gap-10 shrink-0 border-l border-white/5 pl-6 h-12">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-[18px] font-black tracking-tighter leading-none ${isBottleneck ? 'text-rose-400' : 'text-emerald-400'}`}>{s.duration}ms</span>
                                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Duration</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[18px] font-black text-slate-200 tracking-tighter leading-none">#{s.intervalIndex || '0'}</span>
                                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Interval</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => onViewRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1)}
                                                            className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all hover:scale-105"
                                                            title="View Raw Logs"
                                                        >
                                                            <Lucide.AlignLeft size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedSegmentId(null)}
                                                            className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all"
                                                            title="Close Detail"
                                                        >
                                                            <Lucide.X size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })()}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {!result && !minimized && !isScanningStatus && (
                <div className="flex-1 flex items-center justify-center text-slate-600 gap-2">
                    <Lucide.Activity size={20} className="opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-50">
                        Ready to Analyze
                    </span>
                </div>
            )}
        </div>
    );
};
