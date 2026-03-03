import React from 'react';
import * as Lucide from 'lucide-react';
import { AnalysisResult, AnalysisSegment } from '../../../utils/perfAnalysis';
import { PerfFlameGraph } from './PerfFlameGraph';

export interface PerfChartLayoutProps {
    result: AnalysisResult;
    flameSegments: AnalysisSegment[];
    maxLane: number;
    laneTidMap: Map<number, string>;
    palette: string[];
    trimRange: { startTime: number; endTime: number } | null;
    flameZoom: { startTime: number; endTime: number } | null;
    applyZoom: (range: { startTime: number; endTime: number } | null) => void;

    // TID column logic
    showTidColumn: boolean;
    lockedTid: string | null;
    setLockedTid: React.Dispatch<React.SetStateAction<string | null>>;
    selectedTid: string | null;

    // Measurement ruler
    measureRange: { startTime: number; endTime: number } | null;
    setMeasureRange: React.Dispatch<React.SetStateAction<{ startTime: number; endTime: number } | null>>;

    // DOM Refs for drag and scroll
    flameChartContainerRef: React.RefObject<HTMLDivElement>;
    dragCleanupRef: React.MutableRefObject<(() => void) | null>;

    // Interactions
    isShiftPressed: boolean;
    searchQuery: string;
    checkSegmentMatch: (s: AnalysisSegment, query: string) => boolean;
    showOnlyFail: boolean;
    selectedSegmentId: string | null;
    setSelectedSegmentId: (id: string | null) => void;
    multiSelectedIds: string[];
    setMultiSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;

    onJumpToRange?: (start: number, end: number) => void;
    onViewRawRange?: (originalStart: number, originalEnd: number, filteredIndex?: number) => void;

    isActive: boolean;
    isOpen: boolean;
    setIsInitialDrawComplete: React.Dispatch<React.SetStateAction<boolean>>;
    exportCanvasRef: React.RefObject<HTMLCanvasElement>;

    // Axis ticks helper function
    generateTicks: (start: number, end: number, minTicks?: number) => number[];
}

export const PerfChartLayout: React.FC<PerfChartLayoutProps> = ({
    result, flameSegments, maxLane, laneTidMap, palette, trimRange, flameZoom, applyZoom,
    showTidColumn, lockedTid, setLockedTid, selectedTid,
    measureRange, setMeasureRange, isShiftPressed, searchQuery, checkSegmentMatch, showOnlyFail,
    selectedSegmentId, setSelectedSegmentId, multiSelectedIds, setMultiSelectedIds,
    onJumpToRange, onViewRawRange, isActive, isOpen, setIsInitialDrawComplete, exportCanvasRef,
    generateTicks, flameChartContainerRef, dragCleanupRef
}) => {
    // TID 컬럼 제외 실제 차트 영역의 ref — 이 div 기준으로 마우스 좌표를 계산하면 오프셋 보정 불필요
    const innerChartRef = React.useRef<HTMLDivElement>(null);

    return (
        <div className="flex-1 w-full relative flex flex-col min-h-0 bg-slate-900 overflow-hidden">
            <div
                className="flex-1 overflow-auto custom-scrollbar relative flex bg-black/40"
                ref={flameChartContainerRef}
            >
                <div
                    className="flex flex-row min-w-full relative"
                    style={{
                        height: `${Math.max(200, (maxLane + 1) * 28 + 24)}px`
                    }}
                >
                    {/* TID Sidebar (Sticky Left) */}
                    {showTidColumn && (
                        <div className="sticky left-0 w-[52px] shrink-0 z-[100] pointer-events-none bg-slate-900/95 ">
                            <div className="absolute top-0 bottom-0 right-0 w-px bg-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.5)]" />
                            <div className="absolute left-0 right-0 h-px bg-white/10" style={{ top: '52px' }} />
                            <div className="absolute top-0 left-0 right-0 h-5 border-b border-white/5 flex items-center justify-center bg-slate-950/20 ">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.3em]">TID</span>
                            </div>
                            {Array.from({ length: maxLane + 1 }).map((_, i) => {
                                const tid = laneTidMap.get(i);
                                if (!tid) return null;
                                const isFirstInTid = i === 0 || laneTidMap.get(i - 1) !== tid;
                                const tidColor = palette[i % palette.length];
                                const isTidSelected = tid === (lockedTid || selectedTid);
                                const isLocked = tid === lockedTid;
                                return (
                                    <div
                                        key={`tid-label-${i}`}
                                        className={`absolute left-0 right-0 h-[24px] flex items-center pr-1 transition-all ${isTidSelected ? 'z-[110]' : ''}`}
                                        style={{ top: `${i * 28 + 24}px` }}
                                    >
                                        {isFirstInTid ? (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (tid === 'Global') return;
                                                    setLockedTid(prev => prev === tid ? null : tid);
                                                }}
                                                className={`relative w-full h-[18px] flex items-center justify-center rounded-r-md border-y border-r pointer-events-auto cursor-pointer transition-all ${isLocked
                                                    ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                                    : isTidSelected
                                                        ? 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                        : 'bg-slate-900/40 border-white/5 hover:bg-slate-900/80 hover:border-white/10'
                                                    }`}>
                                                {isLocked && <Lucide.Lock size={8} className="absolute left-1 text-amber-500" />}
                                                <div className={`absolute left-0 top-0 bottom-0 rounded-full transition-all ${isTidSelected ? 'w-1' : 'w-[2px]'}`} style={{ backgroundColor: i === 0 ? '#f59e0b' : (isLocked ? '#f59e0b' : tidColor) }} />
                                                <span className={`text-[9px] font-mono tracking-tighter transition-all ${isTidSelected ? 'font-black scale-105' : 'font-bold'}`} style={{ color: i === 0 ? '#f59e0b' : (isLocked ? '#fbbf24' : tidColor) }}>
                                                    {i === 0 ? '*' : (tid.length > 5 ? tid.substring(0, 5) : tid)}
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

                    {/* Scrollable Map Area — TID 제외 순수 차트 영역, 마우스 좌표 기준점 */}
                    <div
                        className="flex-1 relative bg-slate-950/20"
                        ref={innerChartRef}
                        onMouseDown={(e) => {
                            if (isShiftPressed) {
                                e.preventDefault();
                                // rect가 이미 차트 영역(TID 제외) 기준 → 오프셋 보정 불필요!
                                const rect = e.currentTarget.getBoundingClientRect();
                                const containerWidth = Math.max(1, rect.width);
                                const viewStart = flameZoom?.startTime ?? (trimRange?.startTime ?? result.startTime);
                                const viewEnd = flameZoom?.endTime ?? (trimRange?.endTime ?? result.endTime);
                                const viewDuration = Math.max(1, viewEnd - viewStart);

                                /**
                                 * Magnet snap: 픽셀 기준으로 가장 가까운 세그먼트 경계를 찾아 스냅
                                 */
                                const SNAP_THRESHOLD = 12; // px
                                const snapToSegmentBoundary = (rawTime: number): number => {
                                    let closestTime = rawTime;
                                    let closestDistPx = SNAP_THRESHOLD + 1;
                                    for (let i = 0; i < flameSegments.length; i++) {
                                        const seg = flameSegments[i];
                                        for (const t of [seg.startTime, seg.endTime]) {
                                            const distPx = Math.abs(((t - rawTime) / viewDuration) * containerWidth);
                                            if (distPx < closestDistPx) {
                                                closestDistPx = distPx;
                                                closestTime = t;
                                            }
                                        }
                                    }
                                    return closestTime;
                                };

                                const startX = e.clientX - rect.left;
                                const timeAtX = snapToSegmentBoundary(
                                    viewStart + (startX / containerWidth) * viewDuration
                                );
                                setMeasureRange({ startTime: timeAtX, endTime: timeAtX });

                                const onMove = (moveEvent: MouseEvent) => {
                                    const currentX = moveEvent.clientX - rect.left;
                                    const rawTime = viewStart + (currentX / containerWidth) * viewDuration;
                                    const snappedTime = snapToSegmentBoundary(rawTime);
                                    setMeasureRange(prev => prev ? { ...prev, endTime: snappedTime } : null);
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
                                // Shift 없이 클릭 → 선택 영역 초기화
                                if (measureRange) setMeasureRange(null);
                            }
                        }}
                    >
                        {/* Global Divider Line */}
                        <div
                            className="absolute left-0 right-0 h-px bg-white/10 z-[10] shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                            style={{ top: '52px' }} // lane 0 is from 24 to 44. 24 + 28 = 52.
                        />
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
                        <div className="absolute top-0 left-0 right-0 h-6 border-b border-white/5 text-slate-400 font-mono text-[9px] select-none pointer-events-none z-[110] overflow-visible">
                            {generateTicks(flameZoom?.startTime ?? (trimRange?.startTime ?? result.startTime), flameZoom?.endTime ?? (trimRange?.endTime ?? result.endTime), 8).map(t => {
                                const viewStart = flameZoom?.startTime ?? (trimRange?.startTime ?? result.startTime);
                                const viewDuration = Math.max(1, (flameZoom?.endTime ?? (trimRange?.endTime ?? result.endTime)) - viewStart);
                                const left = ((t - viewStart) / viewDuration) * 100;
                                // hide ticks that are off-screen
                                if (left < 0 || left > 100) return null;
                                return (
                                    <div key={t} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${left}%`, top: 0 }}>
                                        <span className="opacity-70 leading-none pt-1">{(t - result.startTime).toFixed(0)}</span>
                                        <div className="w-px h-2 bg-white/20 mt-0.5" />
                                    </div>
                                );
                            })}</div>

                        {/* Time Ruler UI */}
                        {measureRange && (() => {
                            const viewStart = flameZoom?.startTime ?? (trimRange?.startTime ?? result.startTime);
                            const viewDuration = Math.max(1, (flameZoom?.endTime ?? (trimRange?.endTime ?? result.endTime)) - viewStart);
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
                                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 font-bold text-[11px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap flex items-center gap-1.5  border border-amber-400">
                                        <Lucide.Clock size={11} />
                                        {(rulerEnd - rulerStart).toLocaleString(undefined, { maximumFractionDigits: 2 })}ms
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 💡 Canvas-based Flame Chart Rendering */}
                        <PerfFlameGraph
                            result={result}
                            flameSegments={flameSegments}
                            maxLane={maxLane}
                            laneTidMap={laneTidMap}
                            palette={palette}
                            trimRange={trimRange}
                            flameZoom={flameZoom}
                            applyZoom={applyZoom}
                            isShiftPressed={isShiftPressed}
                            searchQuery={searchQuery}
                            checkSegmentMatch={checkSegmentMatch}
                            showOnlyFail={showOnlyFail}
                            lockedTid={lockedTid}
                            selectedTid={selectedTid}
                            selectedSegmentId={selectedSegmentId}
                            setSelectedSegmentId={setSelectedSegmentId}
                            multiSelectedIds={multiSelectedIds}
                            setMultiSelectedIds={setMultiSelectedIds}
                            onJumpToRange={onJumpToRange}
                            onViewRawRange={onViewRawRange}
                            isActive={isActive}
                            isOpen={isOpen}
                            setIsInitialDrawComplete={setIsInitialDrawComplete}
                            exportCanvasRef={exportCanvasRef}
                        />
                    </div>
                </div>

                {flameSegments.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                        <span className="text-xs uppercase tracking-widest font-bold">No segments found</span>
                    </div>
                )}
            </div>
        </div>
    );
};
