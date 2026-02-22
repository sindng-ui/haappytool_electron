import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    showTidColumn?: boolean;
    useCompactDetail?: boolean;
    isActive: boolean;
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
        <div className="flex items-end gap-1.5 overflow-hidden mt-0.5">
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



export const PerfDashboard: React.FC<PerfDashboardProps> = ({
    isOpen, onClose, result, isAnalyzing, isActive = true,
    onJumpToLine, onJumpToRange, onViewRawRange, onCopyRawRange,
    targetTime, height = 400, onHeightChange = () => { }, isFullScreen = false,
    showTidColumn = true, useCompactDetail = false
}) => {
    const [flameZoom, setFlameZoom] = useState<{ startTime: number; endTime: number } | null>(null);
    const zoomRef = useRef<{ startTime: number; endTime: number } | null>(null);
    useEffect(() => { zoomRef.current = flameZoom; }, [flameZoom]);

    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
    const [minimized, setMinimized] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
    const flameChartContainerRef = useRef<HTMLDivElement>(null);

    const [isInitialDrawComplete, setIsInitialDrawComplete] = useState(false);

    // Hit Testing
    const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

    // Time Ruler Tool Logic
    const [measureRange, setMeasureRange] = useState<{ startTime: number, endTime: number } | null>(null);
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const [showOnlyFail, setShowOnlyFail] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftPressed(true);
            if (e.key === 'Escape') {
                setSelectedSegmentId(null);
                setMultiSelectedIds([]);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                if (isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (minimized) setMinimized(false);
                    // Give a small delay to allow the DOM to render if it was minimized
                    setTimeout(() => {
                        searchRef.current?.focus();
                    }, 50);
                }
            }
        };
        const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };

        if (isActive) {
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
        }

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [isOpen, isActive]);

    // Bottleneck Navigator Logic
    const [currentBottleneckIndex, setCurrentBottleneckIndex] = useState(-1);
    const bottlenecks = useMemo(() => {
        if (!result) return [];
        let filtered = [...result.segments];
        if (showOnlyFail) {
            filtered = filtered.filter(s => s.duration >= (result.perfThreshold || 1000));
        }
        // Match the list logic: top 50 slowest segments
        return filtered.sort((a, b) => b.duration - a.duration).slice(0, 50);
    }, [result, showOnlyFail]);

    // 💡 Stabilize Zoom & Pan using manual event listener for passive: false support
    useEffect(() => {
        const container = flameChartContainerRef.current;
        if (!container || !result) return;

        const handleWheel = (e: WheelEvent) => {
            const currentZoom = zoomRef.current;
            const currentStart = currentZoom?.startTime ?? result.startTime;
            const currentEnd = currentZoom?.endTime ?? result.endTime;
            const duration = currentEnd - currentStart;

            // Zoom (Ctrl+Wheel)
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                const newDuration = duration * zoomFactor;

                const rect = container.getBoundingClientRect();
                const pointerX = e.clientX - rect.left;
                const fractionalPos = Math.max(0, Math.min(1, pointerX / rect.width));
                const timeAtPointer = currentStart + duration * fractionalPos;

                let newStart = timeAtPointer - newDuration * fractionalPos;
                let newEnd = newStart + newDuration;

                if (newStart < result.startTime) {
                    newEnd += (result.startTime - newStart);
                    newStart = result.startTime;
                }
                if (newEnd > result.endTime) {
                    newStart -= (newEnd - result.endTime);
                    newEnd = result.endTime;
                }
                if (newStart < result.startTime) newStart = result.startTime;
                if (newEnd > result.endTime) newEnd = result.endTime;

                setFlameZoom({ startTime: newStart, endTime: newEnd });
            }
            // Pan (Horizontal Scroll or Shift+Wheel)
            else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
                e.preventDefault();
                const delta = e.deltaX || e.deltaY;
                const panAmount = (delta / container.clientWidth) * duration;

                let newStart = currentStart + panAmount;
                let newEnd = currentEnd + panAmount;

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
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [result]); // Only re-bind if result changes

    const jumpToBottleneck = (index: number) => {
        if (!result || bottlenecks.length === 0) return;

        let targetIndex = index;
        if (targetIndex < 0) targetIndex = bottlenecks.length - 1;
        if (targetIndex >= bottlenecks.length) targetIndex = 0;

        const target = bottlenecks[targetIndex];
        setCurrentBottleneckIndex(targetIndex);
        setSelectedSegmentId(target.id);
        setMultiSelectedIds([]); // Clear multi-select when navigating individually

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
            setIsInitialDrawComplete(false); // Reset for new analysis
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
        if (result) {
            setIsInitialDrawComplete(false);
        }
    }, [result]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const trimmedInput = searchInput.trim();
            setSearchQuery(trimmedInput);

            // If search is non-empty and has matches, clear the manual selection
            // This ensures search results are not dimmed by an existing cross-thread selection
            if (trimmedInput !== '' && result) {
                const hasMatch = result.segments.some(s => checkSegmentMatch(s, trimmedInput));
                if (hasMatch) {
                    setSelectedSegmentId(null);
                    setMultiSelectedIds([]);
                }
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchInput, result]);

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
        let baseSegments = [...result.segments];
        if (showOnlyFail) {
            baseSegments = baseSegments.filter(s => s.duration >= (result.perfThreshold || 1000));
        }

        const sorted = baseSegments.sort((a, b) => (a.startTime - b.startTime) || (b.duration - a.duration));
        const lanes: number[] = [];
        const totalDuration = result.endTime - result.startTime;

        return sorted.map(s => {
            let lane = s.lane !== undefined ? s.lane : 0;

            if (s.lane === undefined) {
                while (lanes[lane] !== undefined && lanes[lane] > s.startTime) {
                    lane++;
                }
            }

            lanes[lane] = Math.max(lanes[lane] || 0, s.endTime);

            return {
                ...s,
                lane,
                relStart: (s.startTime - result.startTime) / 1000,
                relEnd: (s.endTime - result.startTime) / 1000,
            };
        });
    }, [result, showOnlyFail]);

    const maxLane = useMemo(() => {
        if (!flameSegments.length) return 4;
        const actualMax = flameSegments.reduce((max, s) => Math.max(max, s.lane || 0), 0);
        return Math.max(4, actualMax);
    }, [flameSegments]);

    const laneTidMap = useMemo(() => {
        const map = new Map<number, string>();
        flameSegments.forEach(s => {
            if (s.lane !== undefined && !map.has(s.lane)) {
                map.set(s.lane, s.tid || 'Main');
            }
        });
        return map;
    }, [flameSegments]);

    const selectedTid = useMemo(() => {
        if (!selectedSegmentId) return null;
        return result?.segments.find(s => s.id === selectedSegmentId)?.tid || null;
    }, [result, selectedSegmentId]);

    // Canvas Drawing Logic
    const drawFlameChart = () => {
        const canvas = canvasRef.current;
        if (!canvas || !result) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const viewStart = flameZoom?.startTime ?? result.startTime;
        const viewEnd = flameZoom?.endTime ?? result.endTime;
        const viewDuration = Math.max(1, viewEnd - viewStart);
        const width = rect.width;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Optimizing: 1. Cull segments outside view
        // 2. Merge tiny segments that fall into the same pixel to reduce draw calls
        const visibleSegments = flameSegments.filter(s => s.endTime >= viewStart && s.startTime <= viewEnd);

        // Pixel-based merging: to avoid drawing thousands of <1px wide rects
        const pixelGrid = new Map<string, { x: number, y: number, w: number, color: string }>();

        visibleSegments.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(0.1, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;
            const h = 20;

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isHovered = s.id === hoveredSegmentId;
            const isMatch = checkSegmentMatch(s, searchQuery);

            // If it's a special state, draw it immediately and don't merge
            if (isSelected || isHovered || isMatch || w > 3) {
                const isBottleneck = s.duration >= (result.perfThreshold || 1000);
                const isSearchHit = !!searchQuery && isMatch;
                const isTidFocused = selectedTid !== null && s.tid === selectedTid;

                let baseOpacity = (isSelected || isSearchHit || isHovered) ? 1 : 0.9;
                if (selectedTid !== null && !isTidFocused) baseOpacity *= 0.3;
                const finalOpacity = isMatch ? baseOpacity : 0.15;

                const baseColor = (isSelected || isSearchHit) ? '#6366f1' : (s.dangerColor || (isBottleneck ? '#be123c' : palette[s.lane % palette.length]));

                ctx.globalAlpha = finalOpacity;
                ctx.fillStyle = baseColor;

                if (w > 1.5) {
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 4);
                    ctx.fill();
                } else {
                    ctx.fillRect(x, y, w, h);
                }

                if (isSelected || isHovered) {
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = isSelected ? 2 : 1;
                    ctx.stroke();
                }

                if (w > 30) {
                    ctx.fillStyle = getContrastColor(baseColor);
                    ctx.font = 'bold 9px sans-serif';
                    const label = s.fileName && s.functionName ? `${s.fileName}: ${s.functionName}` : s.name;
                    ctx.fillText(label, x + 6, y + 13, w - 12);
                }
            } else {
                // Merge micro-segments: group by lane and pixel X (integer)
                const pixX = Math.floor(x);
                const key = `${s.lane}-${pixX}`;
                const existing = pixelGrid.get(key);

                if (!existing) {
                    const isBottleneck = s.duration >= (result.perfThreshold || 1000);
                    const color = s.dangerColor || (isBottleneck ? '#be123c' : palette[s.lane % palette.length]);
                    pixelGrid.set(key, { x, y, w, color });
                } else {
                    // Update width to cover the range
                    existing.w = Math.max(existing.w, (x + w) - existing.x);
                }
            }
        });

        // Draw merged micro-segments
        ctx.globalAlpha = 0.6;
        pixelGrid.forEach(m => {
            ctx.fillStyle = m.color;
            ctx.fillRect(m.x, m.y, Math.max(1, m.w), 20);
        });

        ctx.globalAlpha = 1;
    };

    const drawMinimap = () => {
        const canvas = minimapCanvasRef.current;
        if (!canvas || !result) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, rect.width, rect.height);

        const totalDuration = Math.max(1, result.endTime - result.startTime);
        const width = rect.width;
        const height = rect.height;

        const miniPixelGrid = new Map<string, { x: number, yOffset: number, w: number, laneH: number, color: string, alpha: number }>();

        flameSegments.forEach(s => {
            if (s.duration === 0) return;
            const x = ((s.startTime - result.startTime) / totalDuration) * width;
            const w = (s.duration / totalDuration) * width;
            if (w < 0.05) return; // Ignore microscopic segments in minimap

            const yOffset = maxLane > 0 ? (s.lane / (maxLane + 1)) * (height - 4) : 0;
            const laneH = Math.max(2, height / (maxLane + 1));

            const isMatch = checkSegmentMatch(s, searchQuery);
            const finalOpacity = isMatch ? 0.8 : 0.1;

            if (w > 1.5 || isMatch) {
                // Draw normally for visible or matched segments
                ctx.globalAlpha = finalOpacity;
                ctx.fillStyle = s.dangerColor || (s.duration >= (result.perfThreshold || 1000) ? '#be123c' : palette[s.lane % palette.length]);
                ctx.fillRect(x, height - yOffset - laneH, Math.max(0.5, w), laneH);
            } else {
                // Merge micro-segments in minimap
                const pixX = Math.floor(x * 2) / 2; // 0.5px precision
                const key = `${s.lane}-${pixX}`;
                const existing = miniPixelGrid.get(key);
                if (!existing) {
                    miniPixelGrid.set(key, {
                        x, yOffset, w, laneH,
                        color: s.dangerColor || (s.duration >= (result.perfThreshold || 1000) ? '#be123c' : palette[s.lane % palette.length]),
                        alpha: finalOpacity
                    });
                } else {
                    existing.w = Math.max(existing.w, (x + w) - existing.x);
                }
            }
        });

        // Draw merged minimap segments
        miniPixelGrid.forEach(m => {
            ctx.globalAlpha = m.alpha;
            ctx.fillStyle = m.color;
            ctx.fillRect(m.x, height - m.yOffset - m.laneH, Math.max(0.5, m.w), m.laneH);
        });

        ctx.globalAlpha = 1;
    };

    useEffect(() => {
        let frameId: number;
        const render = () => {
            if (isActive && result && viewMode === 'chart') {
                drawFlameChart();
                drawMinimap();
                if (!isInitialDrawComplete) {
                    setIsInitialDrawComplete(true);
                }
            }
            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(frameId);
    }, [result, flameZoom, selectedSegmentId, multiSelectedIds, hoveredSegmentId, searchQuery, viewMode, isActive, showOnlyFail, maxLane, isInitialDrawComplete]);

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isShiftPressed || !result) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const viewStart = flameZoom?.startTime ?? result.startTime;
        const viewEnd = flameZoom?.endTime ?? result.endTime;
        const viewDuration = Math.max(1, viewEnd - viewStart);
        const width = rect.width;

        // Find hovered segment (reverse order to get top-most)
        let found = null;
        for (let i = flameSegments.length - 1; i >= 0; i--) {
            const s = flameSegments[i];
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(0.5, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;
            const h = 20;

            if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
                found = s;
                break;
            }
        }

        if (found?.id !== hoveredSegmentId) {
            setHoveredSegmentId(found?.id || null);
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isShiftPressed || !result) return;
        if (hoveredSegmentId) {
            setSelectedSegmentId(hoveredSegmentId);
            setMultiSelectedIds([]);
            const s = result.segments.find(seg => seg.id === hoveredSegmentId);
            if (s) onJumpToRange?.(s.startLine, s.endLine);
        } else {
            setSelectedSegmentId(null);
            setMultiSelectedIds([]);
        }
    };

    const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isShiftPressed || !result || !hoveredSegmentId) return;
        const s = result.segments.find(seg => seg.id === hoveredSegmentId);
        if (s) {
            onViewRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1);
        }
    };



    if (!isOpen) return null;

    return (
        <div
            className={`w-full z-10 flex flex-col transition-all duration-300 ease-in-out relative group/dashboard ${isFullScreen ? 'h-full flex-1' : 'border-b-[6px] border-[#080b14] shadow-[0_8px_16px_rgba(0,0,0,0.6)]'}`}
            style={isFullScreen ? { backgroundColor: '#0f172a' } : {
                height: minimized ? '40px' : `${height}px`,
                backgroundColor: '#0f172a' // Slate-950 distinct bg
            }}
        >
            {/* Loading Overlay (Persist until canvas is ready) */}
            <AnimatePresence>
                {(isScanningStatus || (result && !isInitialDrawComplete)) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto"
                    >
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                            <Lucide.Loader2 size={42} className="text-indigo-500 animate-spin relative z-10" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">
                                {isAnalyzing ? 'Analyzing Data...' : 'Initializing View...'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                                {result ? `Preparing ${result.segments.length.toLocaleString()} intervals` : 'Processing log stream'}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                    {/* Premium Compact Navigator (Small Mode) */}
                    {result && !isFullScreen && (
                        <div className="flex items-center gap-1.5 bg-slate-950/40 backdrop-blur-2xl rounded-xl p-1 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                            {/* All Fails & Fail Only */}
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={() => {
                                        if (!result) return;
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
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all duration-300 border ${multiSelectedIds.length > 0
                                        ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                                        : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300'}`}
                                    title="All Fails"
                                >
                                    <Lucide.AlertCircle size={10} className={multiSelectedIds.length > 0 ? 'animate-pulse' : ''} />
                                    <span className="hidden leading-none">ALL</span>
                                </button>
                                <button
                                    onClick={() => setShowOnlyFail(!showOnlyFail)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all duration-300 border ${showOnlyFail
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300'}`}
                                    title="Fail Only"
                                >
                                    <Lucide.Filter size={10} />
                                </button>
                            </div>

                            {bottlenecks.length > 0 && (
                                <>
                                    <div className="w-px h-4 bg-white/10 mx-0.5" />
                                    <div className="flex items-center gap-0.5 bg-black/30 rounded-lg px-1.5 py-0.5 border border-white/5">
                                        <button
                                            onClick={() => jumpToBottleneck(currentBottleneckIndex - 1)}
                                            className="p-0.5 hover:text-indigo-400 text-slate-500 transition-all hover:scale-110 active:scale-90"
                                        >
                                            <Lucide.ChevronLeft size={12} />
                                        </button>
                                        <span className="text-[9px] text-white font-mono font-black min-w-[24px] text-center">
                                            {currentBottleneckIndex >= 0 ? currentBottleneckIndex + 1 : '-'}
                                        </span>
                                        <button
                                            onClick={() => jumpToBottleneck(currentBottleneckIndex + 1)}
                                            className="p-0.5 hover:text-indigo-400 text-slate-500 transition-all hover:scale-110 active:scale-90"
                                        >
                                            <Lucide.ChevronRight size={12} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Search Input - NOW BETWEEN NAVIGATOR AND TOGGLES */}
                    {result && !isFullScreen && (
                        <div className="flex items-center bg-black/20 rounded-lg border border-white/10 px-2 py-1 mx-1 focus-within:border-indigo-500/50 focus-within:bg-black/40 transition-colors">
                            <Lucide.Search size={10} className="text-slate-500 mr-1.5" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="bg-transparent text-[9px] text-white w-20 focus:outline-none placeholder:text-slate-600 font-mono"
                            />
                        </div>
                    )}

                    {/* View Toggles (Moved from Sidebar) */}
                    {result && !isFullScreen && (
                        <div className="flex p-0.5 bg-slate-950 rounded-lg border border-white/5 gap-0.5 mr-2">
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-400'}`}
                                title="Chart View"
                            >
                                <Lucide.Activity size={12} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-400'}`}
                                title="Bottlenecks List"
                            >
                                <Lucide.AlignLeft size={12} />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setMinimized(!minimized)}
                        className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                    >
                        {minimized ? <Lucide.ChevronDown size={14} /> : <Lucide.ChevronUp size={14} />}
                    </button>
                    {!isFullScreen && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-slate-400 transition-colors"
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
                                        <span className={`text-lg font-black ${result.failCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {Math.round(((result.segments.length - result.failCount) / Math.max(1, result.segments.length)) * 100)}%
                                        </span>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Slow Ops</span>
                                        <span className={`text-lg font-black ${result.failCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                            {result.failCount}
                                        </span>
                                    </div>
                                </div>



                                {/* Sidebar Detail Section (Compact Mode Detail - Integrated in Dashboard) */}
                                <AnimatePresence>
                                    {useCompactDetail && selectedSegmentId && result && (() => {
                                        const s = result.segments.find(sg => sg.id === selectedSegmentId);
                                        if (!s) return null;
                                        const isBottleneck = s.duration >= (result.perfThreshold || 1000);
                                        return (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="mt-2 pt-4 border-t border-white/10 flex flex-col gap-3 overflow-hidden"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Selected Segment</span>
                                                    <button onClick={() => setSelectedSegmentId(null)} className="text-slate-500 hover:text-white transition-colors">
                                                        <Lucide.X size={12} />
                                                    </button>
                                                </div>

                                                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isBottleneck ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-emerald-500'}`} />
                                                        <span className="text-[12px] font-black text-white truncate leading-tight" title={s.name}>{s.name}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className={`text-[15px] font-black tracking-tighter leading-none ${isBottleneck ? 'text-rose-400' : 'text-emerald-400'}`}>{formatDuration(s.duration)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onViewRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1)}
                                                        className="flex-1 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-indigo-500/20"
                                                    >
                                                        Raw
                                                    </button>
                                                    <button
                                                        onClick={() => onCopyRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine)}
                                                        className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-emerald-500/20"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            </motion.div>
                                        );
                                    })()}
                                </AnimatePresence>

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
                                            value={`${Math.round(((result.segments.length - result.failCount) / Math.max(1, result.segments.length)) * 100)}%`}
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
                                                        if (!result) return;
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

                                            {bottlenecks.length > 0 && (
                                                <>
                                                    <div className="w-px h-6 bg-white/10 mx-1" />
                                                    <div className="flex items-center gap-2 bg-black/20 rounded-xl px-2 py-1">
                                                        <button
                                                            onClick={() => jumpToBottleneck(currentBottleneckIndex - 1)}
                                                            className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-all"
                                                        >
                                                            <Lucide.ChevronLeft size={16} />
                                                        </button>
                                                        <div className="flex flex-col items-center min-w-[45px]">
                                                            <span className="text-[10px] text-white font-mono font-black leading-none">
                                                                {currentBottleneckIndex >= 0 ? currentBottleneckIndex + 1 : '-'}
                                                            </span>
                                                            <span className="text-[7px] text-slate-500 font-black uppercase mt-0.5 tracking-tighter">
                                                                of {bottlenecks.length}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => jumpToBottleneck(currentBottleneckIndex + 1)}
                                                            className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-all"
                                                        >
                                                            <Lucide.ChevronRight size={16} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Search Input - NOW BETWEEN NAVIGATOR AND TOGGLES */}
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
                            )}
                            {viewMode === 'chart' && flameZoom && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFlameZoom(null);
                                    }}
                                    className="absolute bottom-16 right-8 z-[60] px-3.5 py-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-indigo-400 hover:text-white hover:bg-indigo-600 shadow-2xl transition-all flex items-center gap-1.5 animate-in fade-in zoom-in duration-300"
                                    title="Reset View"
                                >
                                    <Lucide.Maximize2 size={12} />
                                    <span>RESET VIEW</span>
                                </button>
                            )}

                            {viewMode === 'chart' && (
                                <div
                                    ref={flameChartContainerRef}
                                    tabIndex={0}
                                    className={`flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-4 relative select-none group/chart outline-none ${isShiftPressed ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                                    onMouseDown={(e) => {
                                        e.currentTarget.focus(); // Ensure it captures wheel events
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
                                        className="flex min-w-full"
                                        style={{
                                            height: `${(maxLane + 1) * 28 + 24}px`
                                        }}
                                    >
                                        {/* TID Sidebar (Sticky Left) */}
                                        {showTidColumn && (
                                            <div className="sticky left-0 w-[52px] shrink-0 z-[100] pointer-events-none">
                                                <div className="absolute top-0 bottom-0 right-0 w-px bg-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.5)]" />
                                                <div className="absolute top-0 left-0 right-0 h-5 border-b border-white/5 flex items-center justify-center bg-slate-950/20 backdrop-blur-md">
                                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.3em]">TID</span>
                                                </div>
                                                {Array.from({ length: maxLane + 1 }).map((_, i) => {
                                                    const tid = laneTidMap.get(i);
                                                    if (!tid) return null;
                                                    const isFirstInTid = i === 0 || laneTidMap.get(i - 1) !== tid;
                                                    const tidColor = palette[i % palette.length];
                                                    const isTidSelected = tid === selectedTid;
                                                    return (
                                                        <div
                                                            key={`tid-label-${i}`}
                                                            className={`absolute left-0 right-0 h-[24px] flex items-center pr-1 transition-all ${isTidSelected ? 'z-[110]' : ''}`}
                                                            style={{ top: `${i * 28 + 24}px` }}
                                                        >
                                                            {isFirstInTid ? (
                                                                <div className={`relative w-full h-[18px] flex items-center justify-center rounded-r-md border-y border-r pointer-events-auto transition-all ${isTidSelected
                                                                    ? 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                                    : 'bg-slate-900/40 border-white/5 hover:bg-slate-900/80 hover:border-white/10'
                                                                    }`}>
                                                                    <div className={`absolute left-0 top-0 bottom-0 rounded-full transition-all ${isTidSelected ? 'w-1' : 'w-[2px]'}`} style={{ backgroundColor: tidColor }} />
                                                                    <span className={`text-[9px] font-mono tracking-tighter transition-all ${isTidSelected ? 'font-black scale-105' : 'font-bold'}`} style={{ color: tidColor }}>
                                                                        {tid.length > 5 ? tid.substring(0, 5) : tid}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className={`ml-auto mr-1.5 rounded-full transition-all ${isTidSelected ? 'w-1.5 h-1.5 opacity-30 shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'w-1 h-1 opacity-10'}`} style={{ backgroundColor: tidColor }} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Scrollable Map Area */}
                                        <div className="flex-1 relative bg-slate-950/20">
                                            {/* Selected TID Lane Highlight */}
                                            {selectedTid && Array.from({ length: maxLane + 1 }).map((_, i) => {
                                                if (laneTidMap.get(i) !== selectedTid) return null;
                                                return (
                                                    <div
                                                        key={`tid-bg-${i}`}
                                                        className="absolute left-0 right-0 h-[24px] bg-indigo-500/[0.04] pointer-events-none z-0"
                                                        style={{ top: `${i * 28 + 24}px` }}
                                                    />
                                                );
                                            })}
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

                                            {/* 💡 Canvas-based Flame Chart Rendering */}
                                            <canvas
                                                ref={canvasRef}
                                                className="absolute inset-0 w-full h-full"
                                                onMouseMove={handleCanvasMouseMove}
                                                onClick={handleCanvasClick}
                                                onDoubleClick={handleCanvasDoubleClick}
                                                style={{ pointerEvents: isShiftPressed ? 'none' : 'auto' }}
                                            />
                                        </div>
                                    </div>

                                    {flameSegments.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                            <span className="text-xs uppercase tracking-widest font-bold">No segments found</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {viewMode === 'chart' && flameSegments.length > 0 && (
                                <div className="h-[40px] shrink-0 bg-slate-900 border-t border-white/10 relative select-none overflow-hidden">
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
                                        {/* 💡 Canvas-based Minimap Rendering */}
                                        <canvas
                                            ref={minimapCanvasRef}
                                            className="absolute inset-0 w-full h-full"
                                        />

                                        {/* Viewport Overlay */}
                                        <div
                                            className="absolute top-0 bottom-0 bg-white/10 border-x-2 border-indigo-400 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors z-10"
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
                                            {[...result.segments].filter(s => !showOnlyFail || s.duration >= (result.perfThreshold || 1000)).sort((a, b) => b.duration - a.duration).slice(0, 50)
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
                                                                setMultiSelectedIds([]);
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
                                                                        <span className="truncate text-white font-bold" title={s.name}>{s.name}</span>
                                                                        {isGroup && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-black">GROUP</span>}
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
                                {!useCompactDetail && selectedSegmentId && result && (() => {
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
                                                    <div className="flex items-center gap-3 pr-4 border-r border-white/5 shrink-0 h-10">
                                                        <div className={`p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-lg`}>
                                                            <Lucide.Activity size={18} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-black text-white tracking-tighter leading-none">{s.name}</span>
                                                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Segment Name</span>
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
                                                                    <div className="flex-1 min-w-0 flex flex-col items-center">
                                                                        <span className="text-[13px] font-black text-indigo-300 truncate tracking-tight text-center w-full" title={s.fileName}>{s.fileName || 'App.cs'}</span>
                                                                        <span className="text-[10px] font-bold text-slate-400 truncate opacity-80 text-center w-full" title={s.functionName}>{s.functionName || 'OnEvent'}</span>
                                                                    </div>

                                                                    {((s.fileName !== s.endFileName) || (s.functionName !== s.endFunctionName)) && (
                                                                        <>
                                                                            <div className="p-1.5 bg-white/5 rounded-full shrink-0">
                                                                                <Lucide.MoveRight size={12} className="text-slate-500" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0 flex flex-col items-center">
                                                                                <span className="text-[13px] font-black text-pink-300 truncate tracking-tight text-center w-full" title={s.endFileName}>{s.endFileName || 'App.cs'}</span>
                                                                                <span className="text-[10px] font-bold text-slate-400 truncate opacity-80 text-center w-full" title={s.endFunctionName}>{s.endFunctionName || 'OnEvent'}</span>
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

            {
                !result && !minimized && !isScanningStatus && (
                    <div className="flex-1 flex items-center justify-center text-slate-600 gap-2">
                        <Lucide.Activity size={20} className="opacity-20" />
                        <span className="text-xs font-bold uppercase tracking-widest opacity-50">
                            Ready to Analyze
                        </span>
                    </div>
                )
            }
        </div >
    );
};
