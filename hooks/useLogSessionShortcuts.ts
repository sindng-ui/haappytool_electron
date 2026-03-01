import React from 'react';

interface UseLogSessionShortcutsProps {
    isActive: boolean;
    isDualView: boolean;
    isSaveDialogOpen: boolean;
    isViewerOpen: boolean;
    isTransactionDrawerOpen: boolean;
    stateRef: React.MutableRefObject<{
        activeLineIndexLeft: number;
        activeLineIndexRight: number;
        selectedIndicesLeft: Set<number>;
        selectedIndicesRight: Set<number>;
        leftBookmarks: Set<number>;
        rightBookmarks: Set<number>;
    }>;
    tizenSocket: any;
    leftViewerRef: React.RefObject<any>;
    rightViewerRef: React.RefObject<any>;
    searchInputRef: React.RefObject<HTMLInputElement>;

    // Actions
    setIsTransactionDrawerOpen: (open: boolean) => void;
    jumpToGlobalLine: (index: number, pane: 'left' | 'right') => void;
    toggleLeftBookmark: (index: number) => void;
    toggleRightBookmark: (index: number) => void;
    handlePageNavRequestLeft: (direction: 'next' | 'prev') => void;
    handlePageNavRequestRight: (direction: 'next' | 'prev') => void;
    handleClearLogs: () => void;
    setIsPanelOpen: (updater: (prev: boolean) => boolean) => void;
    onShowBookmarksLeft: () => void;
    onShowBookmarksRight: () => void;
    jumpToHighlight: (idx: number, pane: 'left' | 'right') => void;
    setIsGoToLineModalOpen: (updater: (prev: boolean) => boolean) => void;
    handleCopyLogs: (pane: 'left' | 'right') => void;
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;

    // Performance Analysis States (for blocking Ctrl+F)
    leftPerfAnalysisResult: any;
    rightPerfAnalysisResult: any;
    isAnalyzingPerformanceLeft: boolean;
    isAnalyzingPerformanceRight: boolean;
}

export const useLogSessionShortcuts = ({
    isActive,
    isDualView,
    isSaveDialogOpen,
    isViewerOpen,
    isTransactionDrawerOpen,
    stateRef,
    tizenSocket,
    leftViewerRef,
    rightViewerRef,
    searchInputRef,
    setIsTransactionDrawerOpen,
    jumpToGlobalLine,
    toggleLeftBookmark,
    toggleRightBookmark,
    handlePageNavRequestLeft,
    handlePageNavRequestRight,
    handleClearLogs,
    setIsPanelOpen,
    onShowBookmarksLeft,
    onShowBookmarksRight,
    jumpToHighlight,
    setIsGoToLineModalOpen,
    handleCopyLogs,
    addToast,
    leftPerfAnalysisResult,
    rightPerfAnalysisResult,
    isAnalyzingPerformanceLeft,
    isAnalyzingPerformanceRight
}: UseLogSessionShortcutsProps) => {

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // 1. ESC: Close Transaction Drawer
            if (e.key === 'Escape') {
                if (isTransactionDrawerOpen) {
                    setIsTransactionDrawerOpen(false);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // If Save Dialog or Archive Viewer is open, disable all shortcuts
            if (isSaveDialogOpen || isViewerOpen) return;

            // All other shortcuts require the session to be active
            if (!isActive) return;

            // F3: Next Bookmark, F4 (or Shift+F3): Prev Bookmark
            if (e.key === 'F3' || e.key === 'F4') {
                e.preventDefault();
                e.stopPropagation();

                if (!isDualView && e.shiftKey) return;

                let targetPane = 'left';
                if (e.shiftKey) {
                    if (!isDualView) return;
                    targetPane = 'right';
                } else {
                    targetPane = 'left';
                }

                const isPrev = e.key === 'F3';
                const st = stateRef.current;
                const bookmarks = targetPane === 'right' ? st.rightBookmarks : st.leftBookmarks;
                const currentLine = targetPane === 'right' ? st.activeLineIndexRight : st.activeLineIndexLeft;

                const sorted = Array.from(bookmarks).sort((a, b) => a - b);
                if (sorted.length === 0) return;

                let targetIdx = -1;

                if (isPrev) {
                    const prevs = sorted.filter(b => b < currentLine);
                    if (prevs.length > 0) targetIdx = prevs[prevs.length - 1];
                    else targetIdx = sorted[sorted.length - 1];
                } else {
                    const nexts = sorted.filter(b => b > currentLine);
                    if (nexts.length > 0) targetIdx = nexts[0];
                    else targetIdx = sorted[0];
                }

                if (targetIdx !== -1) {
                    jumpToGlobalLine(targetIdx, targetPane as 'left' | 'right');
                }
                return;
            }

            // Space: Toggle Bookmark
            if (e.code === 'Space') {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                let targetPane = 'left';
                if (isDualView) {
                    const activeEl = document.activeElement;
                    if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                        targetPane = 'right';
                    }
                }

                const st = stateRef.current;
                const currentIndex = targetPane === 'right' ? st.activeLineIndexRight : st.activeLineIndexLeft;

                if (currentIndex !== -1) {
                    if (targetPane === 'right') toggleRightBookmark(currentIndex);
                    else toggleLeftBookmark(currentIndex);
                }
                return;
            }

            // PageDown / PageUp
            if (e.key === 'PageDown' || e.key === 'PageUp') {
                let targetPane = 'left';
                if (isDualView) {
                    const activeEl = document.activeElement;
                    if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                        targetPane = 'right';
                    }
                }

                const viewer = targetPane === 'left' ? leftViewerRef.current : rightViewerRef.current;
                if (!viewer) return;

                if (e.key === 'PageDown') {
                    if (viewer.isAtBottom()) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (targetPane === 'left') handlePageNavRequestLeft('next');
                        else handlePageNavRequestRight('next');
                    }
                } else {
                    if (viewer.isAtTop()) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (targetPane === 'left') handlePageNavRequestLeft('prev');
                        else handlePageNavRequestRight('prev');
                    }
                }
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                // Ctrl + Shift + X: Clear Logs
                if (e.shiftKey && (e.key === 'x' || e.key === 'X')) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (tizenSocket) {
                        handleClearLogs();
                    }
                    return;
                }

                // Ctrl + ` : Toggle Configuration Panel
                if (e.key === '`' || e.key === '~') {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPanelOpen(prev => !prev);
                    return;
                }

                // Ctrl + B: View Bookmarks
                if (e.key === 'b' || e.key === 'B') {
                    e.preventDefault();
                    e.stopPropagation();

                    let target = 'left';
                    if (isDualView) {
                        const activeEl = document.activeElement;
                        if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                            target = 'right';
                        }
                    }

                    if (target === 'right') onShowBookmarksRight();
                    else onShowBookmarksLeft();
                    return;
                }

                // Ctrl + 1~5: Jump to Highlight #N
                if (['1', '2', '3', '4', '5'].includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();

                    const highlightIdx = parseInt(e.key, 10) - 1;

                    let targetPath = 'left';
                    if (isDualView) {
                        const activeEl = document.activeElement;
                        if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                            targetPath = 'right';
                        }
                    }

                    jumpToHighlight(highlightIdx, targetPath as 'left' | 'right');
                    return;
                }

                // Ctrl + F (Find)
                if ((e.key === 'f' || e.key === 'F') && !e.shiftKey) {
                    if (leftPerfAnalysisResult || rightPerfAnalysisResult || isAnalyzingPerformanceLeft || isAnalyzingPerformanceRight) {
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    searchInputRef.current?.focus();
                    return;
                }

                // Ctrl + G (Go To Line)
                if (e.key === 'g' || e.key === 'G') {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsGoToLineModalOpen((prev: boolean) => !prev);
                    return;
                }

                // Ctrl + C (Copy)
                if (e.key === 'c' || e.key === 'C') {
                    const selection = window.getSelection()?.toString();
                    if (selection && selection.length > 0) {
                        navigator.clipboard.writeText(selection.replace(/\r?\n$/, ''));
                        addToast('Selection copied!', 'success');
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }

                    let targetPane = 'left';
                    if (isDualView) {
                        const activeEl = document.activeElement;
                        if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                            targetPane = 'right';
                        }
                    }

                    const st = stateRef.current;
                    const selectedIndices = targetPane === 'right' ? st.selectedIndicesRight : st.selectedIndicesLeft;

                    if (selectedIndices.size > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyLogs(targetPane as 'left' | 'right');
                    }
                    return;
                }
            }
        };

        const handleGlobalCopy = () => {
            const selection = window.getSelection()?.toString();
            if (selection && selection.length > 0) {
                if (!document.activeElement?.matches('input, textarea')) {
                    addToast('Selection copied to clipboard!', 'success');
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
        window.addEventListener('copy', handleGlobalCopy);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
            window.removeEventListener('copy', handleGlobalCopy);
        };
    }, [
        isActive, isDualView, isSaveDialogOpen, isViewerOpen, isTransactionDrawerOpen,
        stateRef, tizenSocket, leftViewerRef, rightViewerRef, searchInputRef,
        setIsTransactionDrawerOpen, jumpToGlobalLine, toggleLeftBookmark, toggleRightBookmark,
        handlePageNavRequestLeft, handlePageNavRequestRight, handleClearLogs, setIsPanelOpen,
        onShowBookmarksLeft, onShowBookmarksRight, jumpToHighlight, setIsGoToLineModalOpen,
        handleCopyLogs, addToast, leftPerfAnalysisResult, rightPerfAnalysisResult,
        isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight
    ]);
};
