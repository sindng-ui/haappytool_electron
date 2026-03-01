import React from 'react';

interface UseLogSessionArchiveParams {
    leftWorkerReady: boolean;
    rightWorkerReady: boolean;
    leftFilteredCount: number;
    rightFilteredCount: number;
    requestLeftLines: (start: number, count: number) => Promise<any[]>;
    requestRightLines: (start: number, count: number) => Promise<any[]>;
    leftFileName: string | null;
    rightFileName: string | null;
    openSaveDialog: (opts: any) => void;
    isDualView: boolean;
    selectedIndicesLeft: Set<number> | null;
    selectedIndicesRight: Set<number> | null;
    tizenSocket: any;
}

export const MAX_ARCHIVE_LINES = 300_000;

export function useLogSessionArchive({
    leftWorkerReady,
    rightWorkerReady,
    leftFilteredCount,
    rightFilteredCount,
    requestLeftLines,
    requestRightLines,
    leftFileName,
    rightFileName,
    openSaveDialog,
    isDualView,
    selectedIndicesLeft,
    selectedIndicesRight,
    tizenSocket,
}: UseLogSessionArchiveParams) {
    // --- Archive Save (full filtered file) ---
    const isLeftArchiveEnabled = leftWorkerReady && leftFilteredCount > 0 && leftFilteredCount <= MAX_ARCHIVE_LINES && !tizenSocket;
    const isRightArchiveEnabled = rightWorkerReady && rightFilteredCount > 0 && rightFilteredCount <= MAX_ARCHIVE_LINES;

    const onArchiveSaveLeft = React.useCallback(async () => {
        if (!leftWorkerReady || leftFilteredCount === 0) return;
        try {
            const lines = await requestLeftLines(0, leftFilteredCount);
            const content = lines.map(l => l.content).join('\n');
            openSaveDialog({
                content,
                sourceFile: leftFileName || undefined,
                startLine: 1,
                endLine: leftFilteredCount,
            });
        } catch (e) {
            console.error('[LogSession] Failed to fetch lines for archive', e);
        }
    }, [leftWorkerReady, leftFilteredCount, requestLeftLines, leftFileName, openSaveDialog]);

    const onArchiveSaveRight = React.useCallback(async () => {
        if (!rightWorkerReady || rightFilteredCount === 0) return;
        try {
            const lines = await requestRightLines(0, rightFilteredCount);
            const content = lines.map(l => l.content).join('\n');
            openSaveDialog({
                content,
                sourceFile: rightFileName || undefined,
                startLine: 1,
                endLine: rightFilteredCount,
            });
        } catch (e) {
            console.error('[LogSession] Failed to fetch lines for archive', e);
        }
    }, [rightWorkerReady, rightFilteredCount, requestRightLines, rightFileName, openSaveDialog]);

    // --- Selection Duration Calculation ---
    const [leftSelectionDuration, setLeftSelectionDuration] = React.useState<string | null>(null);
    const [rightSelectionDuration, setRightSelectionDuration] = React.useState<string | null>(null);

    React.useEffect(() => {
        const calculateDuration = async () => {
            const calc = async (indices: Set<number>, requestFn: (start: number, count: number) => Promise<any[]>) => {
                if (!indices || indices.size < 2) return null;
                const sorted = Array.from(indices).sort((a, b) => a - b);
                const firstIdx = sorted[0];
                const lastIdx = sorted[sorted.length - 1];
                try {
                    const [firstLine, lastLine] = await Promise.all([
                        requestFn(firstIdx, 1),
                        requestFn(lastIdx, 1)
                    ]);
                    if (firstLine && firstLine.length > 0 && lastLine && lastLine.length > 0) {
                        const { extractTimestamp, formatDuration } = await import('../utils/logTime');
                        const startTime = extractTimestamp(firstLine[0].content);
                        const endTime = extractTimestamp(lastLine[0].content);
                        if (startTime !== null && endTime !== null) {
                            const diff = Math.abs(endTime - startTime);
                            return formatDuration(diff);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to calculate time difference', e);
                }
                return null;
            };

            if (selectedIndicesLeft && selectedIndicesLeft.size > 1) {
                setLeftSelectionDuration(await calc(selectedIndicesLeft, requestLeftLines));
            } else {
                setLeftSelectionDuration(null);
            }

            if (isDualView && selectedIndicesRight && selectedIndicesRight.size > 1) {
                setRightSelectionDuration(await calc(selectedIndicesRight, requestRightLines));
            } else {
                setRightSelectionDuration(null);
            }
        };

        const timer = setTimeout(calculateDuration, 200);
        return () => clearTimeout(timer);
    }, [selectedIndicesLeft, selectedIndicesRight, isDualView, requestLeftLines, requestRightLines]);

    return {
        isLeftArchiveEnabled,
        isRightArchiveEnabled,
        onArchiveSaveLeft,
        onArchiveSaveRight,
        leftSelectionDuration,
        rightSelectionDuration,
    };
}
