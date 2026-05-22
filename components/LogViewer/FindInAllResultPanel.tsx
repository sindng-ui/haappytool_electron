/**
 * FindInAllResultPanel.tsx
 * 전체 찾기 결과 패널 — 우측 LogViewerPane 아래 배치 🐧⚡
 * - 상단 드래그 핸들로 높이 조절 (localStorage 저장)
 * - React.memo + 스냅샷 구조로 로깅 성능에 영향 제로
 * - 닫기(X) / 재검색(↻) 버튼
 * - Notepad++ 스타일 트리 결과 (GlobalSearchResultView 재활용)
 */

import React, { useRef, useState, useCallback, useEffect, memo } from 'react';
import { X, RotateCcw, FileSearch } from 'lucide-react';
import { GlobalSearchResultView, TabSearchResult } from './GlobalSearchResultView';
import { FindInAllRule } from '../../hooks/useFindInAllHistory';
import { LogRule } from '../../types';

const LS_HEIGHT_KEY = 'find-in-all-panel-height';
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.7; // 70vh

interface FindInAllResultPanelProps {
    isVisible: boolean;
    results: TabSearchResult[];
    isSearching: boolean;
    lastSearchRule: FindInAllRule | null;
    onClose: () => void;
    onReSearch: () => void;
    onJumpToTabLine: (tabId: string, pane: 'left' | 'right', lineNum: number) => void;
}

/** FindInAllRule → GlobalSearchResultView가 사용하는 LogRule-like 객체로 변환 */
function buildDisplayRule(rule: FindInAllRule | null): LogRule | null {
    if (!rule) return null;
    return {
        id: 'find-in-all-temp',
        name: 'Find in All',
        includeGroups: rule.includeKeywords.map(k => [k]),
        excludes: rule.excludeKeywords,
        highlights: [],
        happyCombosCaseSensitive: rule.caseSensitive,
        blockListCaseSensitive: rule.blockListCaseSensitive,
    };
}

const FindInAllResultPanel: React.FC<FindInAllResultPanelProps> = memo(({
    isVisible,
    results,
    isSearching,
    lastSearchRule,
    onClose,
    onReSearch,
    onJumpToTabLine,
}) => {
    const [height, setHeight] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(LS_HEIGHT_KEY);
            if (saved) return Math.max(MIN_HEIGHT, parseInt(saved, 10));
        } catch {}
        return DEFAULT_HEIGHT;
    });

    const isDragging = useRef(false);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);
    const panelRef = useRef<HTMLDivElement>(null);

    // 높이 저장 (드래그 완료 시)
    const saveHeight = useCallback((h: number) => {
        try { localStorage.setItem(LS_HEIGHT_KEY, String(h)); } catch {}
    }, []);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        dragStartY.current = e.clientY;
        dragStartHeight.current = height;

        const onMouseMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = dragStartY.current - ev.clientY; // 위로 드래그 = 높이 증가
            const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
            const newH = Math.min(maxH, Math.max(MIN_HEIGHT, dragStartHeight.current + delta));
            setHeight(newH);
        };

        const onMouseUp = (ev: MouseEvent) => {
            isDragging.current = false;
            const delta = dragStartY.current - ev.clientY;
            const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
            const finalH = Math.min(maxH, Math.max(MIN_HEIGHT, dragStartHeight.current + delta));
            saveHeight(finalH);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [height, saveHeight]);

    const displayRule = buildDisplayRule(lastSearchRule);

    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
    const filesWithMatches = results.filter(r => r.matches.length > 0).length;

    if (!isVisible) return null;

    return (
        <div
            ref={panelRef}
            className="shrink-0 flex flex-col border-t border-indigo-500/20 bg-slate-950 relative overflow-hidden"
            style={{ height }}
        >
            {/* ── 드래그 핸들 (상단) ── */}
            <div
                onMouseDown={handleDragStart}
                className="h-2 cursor-row-resize bg-slate-900 hover:bg-indigo-500/20 transition-colors flex items-center justify-center shrink-0 group"
                title="드래그로 높이 조절"
            >
                <div className="w-12 h-0.5 bg-slate-700 rounded-full group-hover:bg-indigo-400 transition-colors" />
            </div>

            {/* ── 헤더 바 ── */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2">
                    <FileSearch size={13} className="text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-300">Find Results</span>

                    {!isSearching && results.length > 0 && (
                        <div className="text-[10px] text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800/60 flex items-center gap-1">
                            <span className="text-emerald-400 font-bold">{filesWithMatches}</span>
                            <span>files /</span>
                            <span className="text-yellow-400 font-bold">{totalMatches}</span>
                            <span>matches</span>
                        </div>
                    )}

                    {lastSearchRule && lastSearchRule.includeKeywords.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
                            <span className="text-indigo-400/70">»</span>
                            <span className="truncate">{lastSearchRule.includeKeywords.slice(0, 2).join(', ')}</span>
                            {lastSearchRule.includeKeywords.length > 2 && (
                                <span className="text-slate-600">+{lastSearchRule.includeKeywords.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {/* 재검색 버튼 */}
                    <button
                        onClick={onReSearch}
                        disabled={isSearching || !lastSearchRule}
                        className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="재검색 (마지막 룰로 다시 실행)"
                    >
                        <RotateCcw size={13} className={isSearching ? 'animate-spin' : ''} />
                    </button>
                    {/* 닫기 버튼 */}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all"
                        title="결과 패널 닫기"
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* ── 결과 영역 (GlobalSearchResultView 재활용) ── */}
            <div className="flex-1 overflow-hidden">
                <GlobalSearchResultView
                    results={results}
                    rule={displayRule}
                    onJumpToTabLine={onJumpToTabLine}
                    isSearching={isSearching}
                />
            </div>
        </div>
    );
});

FindInAllResultPanel.displayName = 'FindInAllResultPanel';
export default FindInAllResultPanel;
