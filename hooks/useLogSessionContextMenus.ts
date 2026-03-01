import React from 'react';
import * as Lucide from 'lucide-react';
import { extractTransactionIds } from '../utils/transactionAnalysis';

interface UseLogSessionContextMenusProps {
    nativeSelection: { text: string } | null;
    selectedIndicesLeft: Set<number>;
    selectedIndicesRight: Set<number>;
    activeLineIndexLeft: number;
    activeLineIndexRight: number;
    isDualView: boolean;
    leftFileName: string | null;
    rightFileName: string | null;
    showContextMenu: (e: React.MouseEvent, items: any[]) => void;
    requestLeftLines: (start: number, count: number) => Promise<any>;
    requestRightLines: (start: number, count: number) => Promise<any>;
    analyzeTransactionAction: (identity: any, sourcePane: 'left' | 'right') => void;
    openSaveDialog: (options: any) => void;
}

export const useLogSessionContextMenus = ({
    nativeSelection,
    selectedIndicesLeft,
    selectedIndicesRight,
    activeLineIndexLeft,
    activeLineIndexRight,
    isDualView,
    leftFileName,
    rightFileName,
    showContextMenu,
    requestLeftLines,
    requestRightLines,
    analyzeTransactionAction,
    openSaveDialog
}: UseLogSessionContextMenusProps) => {

    const handleUnifiedSave = async () => {
        // 1. 브라우저의 현재 텍스트 선택 영역을 최우선으로 확인합니다 (Alt+Drag 대응)
        const currentSel = window.getSelection();
        const browserText = currentSel && !currentSel.isCollapsed ? currentSel.toString().trim() : null;

        if (browserText || nativeSelection) {
            const content = browserText || nativeSelection?.text || '';
            const sourceFile = isDualView ? undefined : (leftFileName || undefined);

            openSaveDialog({
                content,
                sourceFile,
                // 텍스트 선택의 경우 정확한 라인 번호를 알기 어려우므로 undefined로 유지
                startLine: undefined,
                endLine: undefined,
            });
        } else {
            // 2. 라인 단위 선택(클릭/드래그) 저장 로직
            const targetIsLeft = (selectedIndicesLeft && selectedIndicesLeft.size > 0);
            const indices = targetIsLeft ? selectedIndicesLeft : selectedIndicesRight;
            const requestFn = targetIsLeft ? requestLeftLines : requestRightLines;
            const fName = targetIsLeft ? leftFileName : rightFileName;

            if (!indices || indices.size === 0) return;

            const sorted = Array.from(indices).sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const count = max - min + 1;

            try {
                const lines = await requestFn(min, count);
                const content = lines
                    .filter((_, idx) => indices.has(min + idx))
                    .map((l: any) => l.content)
                    .join('\n');

                if (content) {
                    openSaveDialog({
                        content,
                        sourceFile: fName,
                        startLine: min + 1,
                        endLine: max + 1
                    });
                }
            } catch (e) {
                console.error('[LogSession] Failed to retrieve selected lines', e);
            }
        }
    };

    const handleContextMenu = React.useCallback(async (e: React.MouseEvent) => {
        // ✅ Prevent default immediately to ensure custom menu works correctly even with async logic
        e.preventDefault();

        // 브라우저의 실시간 선택 영역을 확인합니다.
        const currentSelection = window.getSelection();
        const hasTextSelection = currentSelection && !currentSelection.isCollapsed && currentSelection.toString().trim().length > 0;

        const hasNative = !!nativeSelection || hasTextSelection;
        const hasLeftLine = selectedIndicesLeft && selectedIndicesLeft.size > 0;
        const hasRightLine = isDualView && selectedIndicesRight && selectedIndicesRight.size > 0;

        const menuItems = [];

        // Determine which pane we are clicking on (best effort)
        const targetPane: 'left' | 'right' = (e.currentTarget as HTMLElement).closest('[data-pane-id="right"]') ? 'right' : 'left';

        // const hasSelectionInTarget = targetPane === 'left' ? hasLeftLine : hasRightLine;

        if (hasNative || hasLeftLine || hasRightLine) {
            menuItems.push({
                label: 'Save Selection to Archive',
                icon: React.createElement(Lucide.Archive, { size: 16 }),
                action: handleUnifiedSave
            });
        }

        // --- Transaction Analysis Entry Point ---
        try {
            const indices = targetPane === 'left' ? selectedIndicesLeft : selectedIndicesRight;
            console.log(`[ContextMenu] Checking selection for ${targetPane}:`, {
                indicesCount: indices?.size || 0,
                indices: Array.from(indices || [])
            });

            if (indices && indices.size >= 1) {
                const activeIdx = targetPane === 'left' ? activeLineIndexLeft : activeLineIndexRight;
                const lineIdx = indices.has(activeIdx) ? activeIdx : Array.from(indices)[0];
                const requestFn = targetPane === 'left' ? requestLeftLines : requestRightLines;

                const lines = await requestFn(lineIdx, 1);
                console.log(`[ContextMenu] Requested line content for idx ${lineIdx}:`, lines?.[0]?.content);

                if (lines && lines.length > 0) {
                    const content = lines[0].content;
                    const extractedIds = extractTransactionIds(content);
                    console.log(`[ContextMenu] IDs extracted from line:`, extractedIds);

                    if (extractedIds.length > 0) {
                        menuItems.push({ type: 'separator' });
                        extractedIds.forEach(id => {
                            menuItems.push({
                                label: `Analyze Transaction: ${id.type.toUpperCase()} (${id.value})`,
                                icon: React.createElement(Lucide.Activity, { size: 16 }),
                                action: () => analyzeTransactionAction(id, targetPane)
                            });
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[LogSession] Context menu analysis check failed', err);
        }

        if (menuItems.length > 0) {
            showContextMenu(e, menuItems);
        }
    }, [nativeSelection, selectedIndicesLeft, selectedIndicesRight, activeLineIndexLeft, activeLineIndexRight, isDualView, showContextMenu, requestLeftLines, requestRightLines, analyzeTransactionAction, handleUnifiedSave]);

    return { handleContextMenu, handleUnifiedSave };
};
