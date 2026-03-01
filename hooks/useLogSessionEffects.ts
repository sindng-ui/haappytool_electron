import React from 'react';

interface UseLogSessionEffectsParams {
    isActive: boolean;
    leftFileName: string | null;
    currentTitle?: string;
    onTitleChange?: (title: string) => void;
    handleZoomIn: (source: string) => void;
    handleZoomOut: (source: string) => void;
    leftPerfAnalysisResult: any;
    rightPerfAnalysisResult: any;
    isAnalyzingPerformanceLeft: boolean;
    isAnalyzingPerformanceRight: boolean;
}

/**
 * Ctrl+Wheel 기반 폰트 줌 + 탭 타이틀 동기화를 담당하는 훅.
 * 순수 side-effect only 로직이므로 반환값 없음.
 */
export function useLogSessionEffects({
    isActive,
    leftFileName,
    currentTitle,
    onTitleChange,
    handleZoomIn,
    handleZoomOut,
    leftPerfAnalysisResult,
    rightPerfAnalysisResult,
    isAnalyzingPerformanceLeft,
    isAnalyzingPerformanceRight,
}: UseLogSessionEffectsParams) {
    // --- Tab Title Sync ---
    React.useEffect(() => {
        if (onTitleChange) {
            const newTitle = leftFileName || 'New Log';
            if (newTitle !== currentTitle) {
                onTitleChange(newTitle);
            }
        }
    }, [leftFileName, onTitleChange, currentTitle]);

    // --- Ctrl + Wheel Zoom ---
    React.useEffect(() => {
        if (!isActive) return;

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                const target = e.target as HTMLElement;
                if (!target || typeof target.closest !== 'function') return;

                const logPane = target.closest('.log-viewer-pane');
                const targetPaneId = logPane?.getAttribute('data-pane-id');
                const isOverDashboard = !!target.closest('.perf-dashboard-container');

                let shouldSkipForPerf = false;
                if (targetPaneId === 'left') {
                    shouldSkipForPerf = !!(leftPerfAnalysisResult || isAnalyzingPerformanceLeft);
                } else if (targetPaneId === 'right') {
                    shouldSkipForPerf = !!(rightPerfAnalysisResult || isAnalyzingPerformanceRight);
                } else if (isOverDashboard) {
                    shouldSkipForPerf = true;
                } else if (!targetPaneId && (leftPerfAnalysisResult || rightPerfAnalysisResult)) {
                    shouldSkipForPerf = true;
                }

                if (shouldSkipForPerf) return;

                e.preventDefault();
                e.stopPropagation();

                if (e.deltaY < 0) {
                    handleZoomIn('mouse');
                } else {
                    handleZoomOut('mouse');
                }
            }
        };

        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => {
            window.removeEventListener('wheel', onWheel, { capture: true });
        };
    }, [isActive, handleZoomIn, handleZoomOut, leftPerfAnalysisResult, rightPerfAnalysisResult, isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight]);
}
