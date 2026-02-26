import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';
import { formatDuration } from '../../utils/logTime';
import { useToast } from '../../contexts/ToastContext';
import { usePerfZoomLogic } from './PerfDashboard/hooks/usePerfZoomLogic';
import { PerfMinimap } from './PerfDashboard/PerfMinimap';
import { PerfFlameGraph } from './PerfDashboard/PerfFlameGraph';
import { PerfTopBar } from './PerfDashboard/PerfTopBar';
import { PerfBottleneckList } from './PerfDashboard/PerfBottleneckList';
import { PerfSegmentDetail } from './PerfDashboard/PerfSegmentDetail';
import { PerfChartLayout } from './PerfDashboard/PerfChartLayout';
import { usePerfDashboardState } from './usePerfDashboardState';
import { PerfDashboardOverlay } from './PerfDashboard/PerfDashboardOverlay';
import { PerfDashboardScanner } from './PerfDashboard/PerfDashboardScanner';
import { PerfDashboardSummary } from './PerfDashboard/PerfDashboardSummary';
import { PerfDashboardHeaderBar } from './PerfDashboard/PerfDashboardHeaderBar';
import { usePerfFlameData } from './usePerfFlameData';

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
    activeTags?: string[];
    paneId?: 'left' | 'right' | 'single';
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


const EMPTY_TAGS: string[] = [];

const PerfDashboardBase: React.FC<PerfDashboardProps> = ({
    isOpen, onClose, result, isAnalyzing,
    onJumpToLine, onJumpToRange, onViewRawRange, onCopyRawRange,
    targetTime, height = 400, onHeightChange = () => { }, isFullScreen = false,
    showTidColumn = true,
    useCompactDetail = false,
    isActive = true,
    activeTags = EMPTY_TAGS,
    paneId
}) => {
    const {
        selectedSegmentId, setSelectedSegmentId,
        viewMode, setViewMode,
        minimized, setMinimized,
        searchInput, setSearchInput,
        searchQuery,
        searchRef, canvasRef, flameChartContainerRef, dragCleanupRef,
        isInitialDrawComplete, setIsInitialDrawComplete,
        trimRange, setTrimRange,
        flameZoom, applyZoom,
        measureRange, setMeasureRange,
        isShiftPressed, showOnlyFail, setShowOnlyFail,
        multiSelectedIds, setMultiSelectedIds,
        lockedTid, setLockedTid,
        navSegments, currentNavIndex, jumpToNavSegment,
        checkSegmentMatch,
        isScanningStatus
    } = usePerfDashboardState({
        result,
        isAnalyzing,
        isActive,
        isOpen,
        paneId,
        activeTags,
        onJumpToRange
    });

    const { addToast } = useToast();
    const [isFlashing, setIsFlashing] = useState(false);

    const handleExportImage = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            // Visual feedback
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);

            // Create a temporary link
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `happytool_perf_${timestamp}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            addToast('Screenshot saved successfully!', 'success');
        } catch (err) {
            console.error('Failed to export image:', err);
            addToast('Failed to save screenshot.', 'error');
        }
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

    const { flameSegments, maxLane, laneTidMap } = usePerfFlameData({
        result,
        showOnlyFail,
        activeTags,
        trimRange
    });

    const selectedTid = useMemo(() => {
        if (!selectedSegmentId) return null;
        return result?.segments.find(s => s.id === selectedSegmentId)?.tid || null;
    }, [result, selectedSegmentId]);

    return (
        <div
            className={`w-full z-10 flex flex-col transition-all duration-300 ease-in-out relative group/dashboard perf-dashboard-container ${isFullScreen ? 'h-full flex-1' : 'border-b-[6px] border-[#080b14] shadow-[0_8px_16px_rgba(0,0,0,0.6)]'}`}
            style={isFullScreen ? { backgroundColor: '#0f172a' } : {
                height: minimized ? '40px' : `${height}px`,
                backgroundColor: '#0f172a' // Slate-950 distinct bg
            }}
            data-pane-id={paneId}
        >
            {/* Flash Effect Overlay */}
            <AnimatePresence>
                {isFlashing && (
                    <motion.div
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 z-[1000] bg-white pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Loading Overlay (Persist until canvas is ready) */}
            <AnimatePresence>
                {(isScanningStatus || (result && !isInitialDrawComplete)) && (
                    <PerfDashboardOverlay
                        isAnalyzing={isAnalyzing}
                        isScanningStatus={isScanningStatus}
                        isInitialDrawComplete={isInitialDrawComplete}
                        result={result}
                    />
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
            <PerfDashboardHeaderBar
                result={result}
                isScanningStatus={isScanningStatus}
                trimRange={trimRange}
                setTrimRange={setTrimRange}
                applyZoom={applyZoom}
                activeTags={activeTags}
                isFullScreen={isFullScreen}
                multiSelectedIds={multiSelectedIds}
                setMultiSelectedIds={setMultiSelectedIds}
                setSelectedSegmentId={setSelectedSegmentId}
                showOnlyFail={showOnlyFail}
                setShowOnlyFail={setShowOnlyFail}
                navSegments={navSegments}
                currentNavIndex={currentNavIndex}
                jumpToNavSegment={jumpToNavSegment}
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                searchRef={searchRef}
                viewMode={viewMode}
                setViewMode={setViewMode}
                handleExportImage={handleExportImage}
                minimized={minimized}
                setMinimized={setMinimized}
                onClose={onClose}
            />

            {/* Content Body */}
            <AnimatePresence mode="wait">
                {isScanningStatus ? (
                    <PerfDashboardScanner
                        minimized={minimized}
                        isAnalyzing={isAnalyzing}
                        result={result}
                    />
                ) : !minimized && result ? (
                    <motion.div
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex overflow-hidden"
                    >
                        {/* Summary & Controls Panel (Left) - Hidden in FullScreen */}
                        <PerfDashboardSummary
                            result={result}
                            flameSegments={flameSegments}
                            isFullScreen={isFullScreen}
                            useCompactDetail={useCompactDetail}
                            selectedSegmentId={selectedSegmentId}
                            setSelectedSegmentId={setSelectedSegmentId}
                            onViewRawRange={onViewRawRange}
                            onCopyRawRange={onCopyRawRange}
                        />

                        {/* Main View Area (Right) */}
                        <div className="flex-1 bg-black/20 relative overflow-hidden flex flex-col">
                            {/* FullScreen Top Bar Utility */}
                            {isFullScreen && (
                                <PerfTopBar
                                    result={result}
                                    viewMode={viewMode}
                                    setViewMode={setViewMode}
                                    showOnlyFail={showOnlyFail}
                                    setShowOnlyFail={setShowOnlyFail}
                                    multiSelectedIds={multiSelectedIds}
                                    setMultiSelectedIds={setMultiSelectedIds}
                                    setSelectedSegmentId={setSelectedSegmentId}
                                    navSegments={navSegments}
                                    currentNavIndex={currentNavIndex}
                                    jumpToNavSegment={jumpToNavSegment}
                                    searchInput={searchInput}
                                    setSearchInput={setSearchInput}
                                    searchRef={searchRef}
                                    onClose={onClose}
                                    minimized={minimized}
                                    setMinimized={setMinimized}
                                />
                            )}
                            {viewMode === 'chart' && flameZoom && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        applyZoom(null);
                                    }}
                                    className="absolute bottom-16 right-8 z-[60] px-3.5 py-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-indigo-400 hover:text-white hover:bg-indigo-600 shadow-2xl transition-all flex items-center gap-1.5 animate-in fade-in zoom-in duration-300"
                                    title="Reset View"
                                >
                                    <Lucide.Maximize2 size={12} />
                                    <span>RESET VIEW</span>
                                </button>
                            )}

                            {/* Trim Controls - appears when measureRange is set */}
                            {viewMode === 'chart' && measureRange && !trimRange && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const start = Math.min(measureRange.startTime, measureRange.endTime);
                                        const end = Math.max(measureRange.startTime, measureRange.endTime);
                                        if (end > start) {
                                            setTrimRange({ startTime: start, endTime: end });
                                            applyZoom({ startTime: start, endTime: end });
                                            setMeasureRange(null);
                                        }
                                    }}
                                    className="absolute bottom-28 right-8 z-[60] px-3.5 py-1.5 bg-indigo-600/90 backdrop-blur-md border border-indigo-400/30 rounded-full text-[10px] font-bold text-white shadow-2xl hover:bg-indigo-500 transition-all flex items-center gap-1.5 animate-in fade-in zoom-in duration-300"
                                    title="Trim to Selected Range"
                                >
                                    <Lucide.Scissors size={12} />
                                    <span>TRIM TO SELECTION</span>
                                </button>
                            )}
                            {viewMode === 'chart' && trimRange && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTrimRange(null);
                                        applyZoom(null);
                                    }}
                                    className="absolute bottom-28 right-8 z-[60] px-3.5 py-1.5 bg-amber-500/90 backdrop-blur-md border border-amber-400/30 rounded-full text-[10px] font-bold text-white shadow-2xl hover:bg-amber-400 transition-all flex items-center gap-1.5 animate-in fade-in zoom-in duration-300"
                                    title="Reset Trim"
                                >
                                    <Lucide.RotateCcw size={12} />
                                    <span>RESET TRIM</span>
                                </button>
                            )}

                            {/* Flame Chart Canvas Area (Replaced by PerfChartLayout) */}
                            {viewMode === 'chart' && result && (
                                <PerfChartLayout
                                    result={result}
                                    flameSegments={flameSegments}
                                    maxLane={maxLane}
                                    laneTidMap={laneTidMap}
                                    palette={palette}
                                    trimRange={trimRange}
                                    flameZoom={flameZoom}
                                    applyZoom={applyZoom}
                                    showTidColumn={showTidColumn}
                                    lockedTid={lockedTid}
                                    setLockedTid={setLockedTid}
                                    selectedTid={selectedTid}
                                    measureRange={measureRange}
                                    setMeasureRange={setMeasureRange}
                                    isShiftPressed={isShiftPressed}
                                    searchQuery={searchQuery}
                                    checkSegmentMatch={checkSegmentMatch}
                                    showOnlyFail={showOnlyFail}
                                    selectedSegmentId={selectedSegmentId}
                                    setSelectedSegmentId={setSelectedSegmentId}
                                    multiSelectedIds={multiSelectedIds}
                                    setMultiSelectedIds={setMultiSelectedIds}
                                    onJumpToRange={onJumpToRange}
                                    onViewRawRange={onViewRawRange}
                                    isActive={true} // Assuming it's active when rendered
                                    isOpen={true} // Assuming it's open when rendered
                                    setIsInitialDrawComplete={setIsInitialDrawComplete}
                                    exportCanvasRef={canvasRef}
                                    generateTicks={generateTicks}
                                    flameChartContainerRef={flameChartContainerRef}
                                    dragCleanupRef={dragCleanupRef}
                                />
                            )}

                            {viewMode === 'chart' && flameSegments.length > 0 && (
                                <PerfMinimap
                                    result={result}
                                    flameSegments={flameSegments}
                                    maxLane={maxLane}
                                    searchQuery={searchQuery}
                                    palette={palette}
                                    trimRange={trimRange}
                                    flameZoom={flameZoom}
                                    applyZoom={applyZoom}
                                    checkSegmentMatch={checkSegmentMatch}
                                />
                            )}

                            {viewMode === 'list' && (
                                <PerfBottleneckList
                                    result={result}
                                    showOnlyFail={showOnlyFail}
                                    searchQuery={searchQuery}
                                    checkSegmentMatch={checkSegmentMatch}
                                    selectedSegmentId={selectedSegmentId}
                                    setSelectedSegmentId={setSelectedSegmentId}
                                    setMultiSelectedIds={setMultiSelectedIds}
                                    onJumpToRange={onJumpToRange}
                                    onViewRawRange={onViewRawRange}
                                />
                            )}



                            {/* Docked Detail Panel (Definitive Map visibility solution) */}
                            <PerfSegmentDetail
                                useCompactDetail={useCompactDetail!}
                                selectedSegmentId={selectedSegmentId}
                                result={result}
                                setSelectedSegmentId={setSelectedSegmentId}
                                onViewRawRange={onViewRawRange}
                            />
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

export const PerfDashboard = React.memo(PerfDashboardBase);
