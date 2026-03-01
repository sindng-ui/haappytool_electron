import React from 'react';
import { MAX_SEGMENT_SIZE } from './useLogExtractorLogic';

interface PaneCallbacksParams {
    leftViewerRef: React.RefObject<any>;
    rightViewerRef: React.RefObject<any>;
    leftFileInputRef: React.RefObject<HTMLInputElement>;
    rightFileInputRef: React.RefObject<HTMLInputElement>;
    isDualView: boolean;
    handleLineClick: (pane: 'left' | 'right', index: number, isShift: boolean, isCtrl: boolean) => void;
    handleLineDoubleClickAction: (index: number, pane: 'left' | 'right') => void;
    handleCopyLogs: (pane: 'left' | 'right') => void;
    handleSaveLogs: (pane: 'left' | 'right') => void;
    jumpToHighlight: (idx: number, pane: 'left' | 'right') => void;
    jumpToGlobalLine: (index: number, pane: 'left' | 'right', anchor?: 'start' | 'end') => void;
    setActiveLineIndexLeft: (index: number) => void;
    setActiveLineIndexRight: (index: number) => void;
    setSelectedIndicesLeft: (indices: Set<number>) => void;
    setSelectedIndicesRight: (indices: Set<number>) => void;
    setLeftBookmarksOpen: (open: boolean) => void;
    setRightBookmarksOpen: (open: boolean) => void;
    requestBookmarkedLines: (indices: number[], pane: 'left' | 'right') => Promise<{ lineNum: number; content: string; formattedLineIndex: number }[]>;
    leftSegmentIndex: number;
    rightSegmentIndex: number;
    leftTotalSegments: number;
    rightTotalSegments: number;
    leftFilteredCount: number;
    rightFilteredCount: number;
    rowHeight: number;
    leftSegmentOffset: number;
    rightSegmentOffset: number;
}

export function useLogSessionPaneCallbacks({
    leftViewerRef, rightViewerRef, leftFileInputRef, rightFileInputRef,
    isDualView,
    handleLineClick, handleLineDoubleClickAction,
    handleCopyLogs, handleSaveLogs,
    jumpToHighlight, jumpToGlobalLine,
    setActiveLineIndexLeft, setActiveLineIndexRight,
    setSelectedIndicesLeft, setSelectedIndicesRight,
    setLeftBookmarksOpen, setRightBookmarksOpen,
    requestBookmarkedLines,
    leftSegmentIndex, rightSegmentIndex,
    leftTotalSegments, rightTotalSegments,
    leftFilteredCount, rightFilteredCount,
    rowHeight, leftSegmentOffset, rightSegmentOffset,
}: PaneCallbacksParams) {
    // --- Sync Scroll ---
    const handleSyncScroll = React.useCallback((scrollTop: number, source: 'left' | 'right') => {
        if (!isDualView) return;
        const targetRef = source === 'left' ? rightViewerRef : leftViewerRef;
        if (targetRef.current) {
            const currentTop = targetRef.current.getScrollTop();
            if (Math.abs(currentTop - scrollTop) >= 1) {
                targetRef.current.scrollTo(scrollTop);
            }
        }
    }, [isDualView, leftViewerRef, rightViewerRef]);

    // --- Focus Pane ---
    const handleFocusPaneRequest = (direction: 'left' | 'right', visualY?: number) => {
        const targetRef = direction === 'left' ? leftViewerRef : rightViewerRef;
        const targetSetter = direction === 'left' ? setActiveLineIndexLeft : setActiveLineIndexRight;
        const targetSelectionSetter = direction === 'left' ? setSelectedIndicesLeft : setSelectedIndicesRight;
        const targetCount = direction === 'left' ? leftFilteredCount : rightFilteredCount;
        const targetOffset = direction === 'left' ? leftSegmentOffset : rightSegmentOffset;

        targetRef.current?.focus();

        if (visualY !== undefined && targetRef.current && targetCount > 0) {
            const targetScrollTop = targetRef.current.getScrollTop();
            const targetAbsY = targetScrollTop + visualY;
            const targetLocalIndex = Math.floor(targetAbsY / rowHeight);
            const targetGlobalIndex = targetLocalIndex + targetOffset;
            const clampedIndex = Math.max(0, Math.min(targetGlobalIndex, targetCount - 1));
            targetSetter(clampedIndex);
            targetSelectionSetter(new Set([clampedIndex]));
        }
    };

    // --- Bookmark Callbacks ---
    const requestLeftBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'left'), [requestBookmarkedLines]);
    const requestRightBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'right'), [requestBookmarkedLines]);

    const onBookmarkJumpLeft = React.useCallback((index: number) => {
        setActiveLineIndexLeft(index);
        setSelectedIndicesLeft(new Set([index]));
        leftViewerRef.current?.scrollToIndex(index);
    }, [setActiveLineIndexLeft, setSelectedIndicesLeft, leftViewerRef]);

    const onBookmarkJumpRight = React.useCallback((index: number) => {
        setActiveLineIndexRight(index);
        setSelectedIndicesRight(new Set([index]));
        rightViewerRef.current?.scrollToIndex(index);
    }, [setActiveLineIndexRight, setSelectedIndicesRight, rightViewerRef]);

    // --- Page Navigation ---
    const handlePageNavRequestLeft = React.useCallback((direction: 'next' | 'prev') => {
        if (direction === 'next') {
            if (leftSegmentIndex < leftTotalSegments - 1) {
                const target = (leftSegmentIndex + 1) * MAX_SEGMENT_SIZE;
                jumpToGlobalLine(target, 'left', 'start');
            }
        } else {
            if (leftSegmentIndex > 0) {
                const target = (leftSegmentIndex * MAX_SEGMENT_SIZE) - 1;
                jumpToGlobalLine(target, 'left', 'end');
            }
        }
    }, [leftSegmentIndex, leftTotalSegments, jumpToGlobalLine]);

    const handlePageNavRequestRight = React.useCallback((direction: 'next' | 'prev') => {
        if (direction === 'next') {
            if (rightSegmentIndex < rightTotalSegments - 1) {
                const target = (rightSegmentIndex + 1) * MAX_SEGMENT_SIZE;
                jumpToGlobalLine(target, 'right', 'start');
            }
        } else {
            if (rightSegmentIndex > 0) {
                const target = (rightSegmentIndex * MAX_SEGMENT_SIZE) - 1;
                jumpToGlobalLine(target, 'right', 'end');
            }
        }
    }, [rightSegmentIndex, rightTotalSegments, jumpToGlobalLine]);

    // --- Scroll To Bottom ---
    const handleScrollToBottomRequestLeft = React.useCallback(() => {
        if (leftFilteredCount > 0) jumpToGlobalLine(leftFilteredCount - 1, 'left', 'end');
    }, [leftFilteredCount, jumpToGlobalLine]);

    const handleScrollToBottomRequestRight = React.useCallback(() => {
        if (rightFilteredCount > 0) jumpToGlobalLine(rightFilteredCount - 1, 'right', 'end');
    }, [rightFilteredCount, jumpToGlobalLine]);

    // --- Left Pane Callbacks ---
    const onLineClickLeft = React.useCallback((index: number, isShift?: boolean, isCtrl?: boolean) => handleLineClick('left', index, !!isShift, !!isCtrl), [handleLineClick]);
    const onLineDoubleClickLeft = React.useCallback((index: number) => handleLineDoubleClickAction(index, 'left'), [handleLineDoubleClickAction]);
    const onBrowseLeft = React.useCallback(() => leftFileInputRef.current?.click(), [leftFileInputRef]);
    const onCopyLeft = React.useCallback(() => handleCopyLogs('left'), [handleCopyLogs]);
    const onSaveLeft = React.useCallback(() => handleSaveLogs('left'), [handleSaveLogs]);
    const onSyncScrollLeft = React.useCallback((dy: number) => handleSyncScroll(dy, 'left'), [handleSyncScroll]);
    const onHighlightJumpLeft = React.useCallback((idx: number) => jumpToHighlight(idx, 'left'), [jumpToHighlight]);
    const onShowBookmarksLeft = React.useCallback(() => setLeftBookmarksOpen(true), [setLeftBookmarksOpen]);

    // --- Right Pane Callbacks ---
    const onLineClickRight = React.useCallback((index: number, isShift?: boolean, isCtrl?: boolean) => handleLineClick('right', index, !!isShift, !!isCtrl), [handleLineClick]);
    const onLineDoubleClickRight = React.useCallback((index: number) => handleLineDoubleClickAction(index, 'right'), [handleLineDoubleClickAction]);
    const onBrowseRight = React.useCallback(() => rightFileInputRef.current?.click(), [rightFileInputRef]);
    const onCopyRight = React.useCallback(() => handleCopyLogs('right'), [handleCopyLogs]);
    const onSaveRight = React.useCallback(() => handleSaveLogs('right'), [handleSaveLogs]);
    const onSyncScrollRight = React.useCallback((dy: number) => handleSyncScroll(dy, 'right'), [handleSyncScroll]);
    const onHighlightJumpRight = React.useCallback((idx: number) => jumpToHighlight(idx, 'right'), [jumpToHighlight]);
    const onShowBookmarksRight = React.useCallback(() => setRightBookmarksOpen(true), [setRightBookmarksOpen]);

    return {
        handleSyncScroll,
        handleFocusPaneRequest,
        requestLeftBookmarkedLines,
        requestRightBookmarkedLines,
        onBookmarkJumpLeft,
        onBookmarkJumpRight,
        handlePageNavRequestLeft,
        handlePageNavRequestRight,
        handleScrollToBottomRequestLeft,
        handleScrollToBottomRequestRight,
        // Left Pane
        onLineClickLeft, onLineDoubleClickLeft,
        onBrowseLeft, onCopyLeft, onSaveLeft,
        onSyncScrollLeft, onHighlightJumpLeft, onShowBookmarksLeft,
        // Right Pane
        onLineClickRight, onLineDoubleClickRight,
        onBrowseRight, onCopyRight, onSaveRight,
        onSyncScrollRight, onHighlightJumpRight, onShowBookmarksRight,
    };
}
