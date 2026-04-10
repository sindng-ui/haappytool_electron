import { useState, useEffect, useCallback } from 'react';
import { getStoredValue, setStoredValue } from '../utils/db';
import { LogViewPreferences } from '../types';

export const defaultLogViewPreferences: LogViewPreferences = {
    rowHeight: 20,
    fontSize: 11,
    fontFamily: 'Consolas, monospace',
    levelStyles: [
        { level: 'V', color: '#888888', enabled: false },
        { level: 'D', color: '#00FFFF', enabled: false },
        { level: 'I', color: '#00FF00', enabled: false },
        { level: 'W', color: '#FFA500', enabled: true },
        { level: 'E', color: '#FF0000', enabled: true }
    ],
    showLineNumbers: true
};

/**
 * logViewPreferences 로드/저장/업데이트를 전담하는 훅.
 * perfDashboardHeight 저장도 여기서 함께 관리합니다.
 */
export function useLogViewPreferences() {
    const [logViewPreferences, setLogViewPreferences] = useState<LogViewPreferences>(defaultLogViewPreferences);
    const [perfDashboardHeight, setPerfDashboardHeightState] = useState(320);
    const [splitAnalyzerHeight, setSplitAnalyzerHeightState] = useState(350);

    // 초기 로드
    useEffect(() => {
        getStoredValue('perfDashboardHeight').then(saved => {
            if (saved) setPerfDashboardHeightState(parseInt(saved) || 320);
        });

        getStoredValue('splitAnalyzerHeight').then(saved => {
            if (saved) setSplitAnalyzerHeightState(parseInt(saved) || 350);
        });

        getStoredValue('logViewPreferences').then(saved => {
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setLogViewPreferences({ ...defaultLogViewPreferences, ...parsed });
                } catch (e) {
                    console.error('Failed to parse logViewPreferences', e);
                }
            }
        });
    }, []);

    // 업데이트 + 자동 저장
    const updateLogViewPreferences = useCallback((updates: Partial<LogViewPreferences>) => {
        setLogViewPreferences(prev => {
            const next = { ...prev, ...updates };

            // 폰트 크기나 줄높이 변경 시 offset 갱신
            const standardFormula = (fs: number) => 20 + (fs - 11) * 2;
            const currentFS = next.fontSize || 11;
            const currentRH = next.rowHeight || standardFormula(currentFS);

            if ('rowHeight' in updates || 'fontSize' in updates) {
                next.rowHeightOffset = currentRH - standardFormula(currentFS);
            }

            setStoredValue('logViewPreferences', JSON.stringify(next));
            return next;
        });
    }, []);

    // perfDashboardHeight 저장 래퍼
    const setPerfDashboardHeight = useCallback((h: number) => {
        setPerfDashboardHeightState(h);
        setStoredValue('perfDashboardHeight', String(h));
    }, []);

    // Split Analyzer Height 저장 래퍼
    const setSplitAnalyzerHeight = useCallback((h: number) => {
        setSplitAnalyzerHeightState(h);
        setStoredValue('splitAnalyzerHeight', String(h));
    }, []);

    // Zoom In: 폰트 +1, 기존 오프셋 유지
    const handleZoomIn = useCallback((source: 'mouse' | 'keyboard' = 'keyboard') => {
        setLogViewPreferences(prev => {
            const currentFontSize = prev.fontSize || 11;
            const newFontSize = Math.min(30, currentFontSize + 1);
            const standardFormula = (fs: number) => 20 + (fs - 11) * 2;
            const currentStandardRowHeight = standardFormula(currentFontSize);
            const rowHeightOffset = prev.rowHeightOffset !== undefined
                ? prev.rowHeightOffset
                : (prev.rowHeight || currentStandardRowHeight) - currentStandardRowHeight;
            const newRowHeight = Math.max(12, standardFormula(newFontSize) + rowHeightOffset);
            const zf = window.electronAPI?.getZoomFactor ? window.electronAPI.getZoomFactor() : 1;
            console.log(`[Zoom Debug] ${source} IN: Font ${prev.fontSize} -> ${newFontSize}, Row ${prev.rowHeight} -> ${newRowHeight}, ZF: ${zf}`);
            if (newFontSize !== currentFontSize || prev.rowHeight !== newRowHeight) {
                const next = { ...prev, fontSize: newFontSize, rowHeight: newRowHeight, rowHeightOffset };
                setStoredValue('logViewPreferences', JSON.stringify(next));
                return next;
            }
            return prev;
        });
    }, []);

    // Zoom Out: 폰트 -1, 기존 오프셋 유지
    const handleZoomOut = useCallback((source: 'mouse' | 'keyboard' = 'keyboard') => {
        setLogViewPreferences(prev => {
            const currentFontSize = prev.fontSize || 11;
            const newFontSize = Math.max(8, currentFontSize - 1);
            const standardFormula = (fs: number) => 20 + (fs - 11) * 2;
            const currentStandardRowHeight = standardFormula(currentFontSize);
            const rowHeightOffset = prev.rowHeightOffset !== undefined
                ? prev.rowHeightOffset
                : (prev.rowHeight || currentStandardRowHeight) - currentStandardRowHeight;
            const newRowHeight = Math.max(12, standardFormula(newFontSize) + rowHeightOffset);
            const zf = window.electronAPI?.getZoomFactor ? window.electronAPI.getZoomFactor() : 1;
            console.log(`[Zoom Debug] ${source} OUT: Font ${prev.fontSize} -> ${newFontSize}, Row ${prev.rowHeight} -> ${newRowHeight}, ZF: ${zf}`);
            if (newFontSize !== currentFontSize || prev.rowHeight !== newRowHeight) {
                const next = { ...prev, fontSize: newFontSize, rowHeight: newRowHeight, rowHeightOffset };
                setStoredValue('logViewPreferences', JSON.stringify(next));
                return next;
            }
            if (prev.rowHeight !== newRowHeight) {
                const next = { ...prev, rowHeight: newRowHeight, rowHeightOffset };
                setStoredValue('logViewPreferences', JSON.stringify(next));
                return next;
            }
            return prev;
        });
    }, []);

    return {
        logViewPreferences,
        setLogViewPreferences, // handleZoomIn/Out 등 직접 prev => next 패턴이 필요한 곳에서 사용
        updateLogViewPreferences,
        perfDashboardHeight,
        setPerfDashboardHeight,
        splitAnalyzerHeight,
        setSplitAnalyzerHeight,
        handleZoomIn,
        handleZoomOut,
    };
}
