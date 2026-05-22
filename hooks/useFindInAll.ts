/**
 * useFindInAll.ts
 * 전체 찾기 기능 전담 훅 🐧⚡
 * - 모달 열기/닫기 상태 관리
 * - 검색 실행 & 결과를 스냅샷으로 고정
 * - 결과 패널 표시/숨김 관리
 * - LogSession 리렌더 체인과 격리
 */

import { useState, useCallback, useRef } from 'react';
import { TabSearchResult } from '../components/LogViewer/GlobalSearchResultView';
import { workerRegistry } from './LogWorkerRegistry';
import { assembleIncludeGroups } from '../utils/filterGroupUtils';
import { FindInAllRule, useFindInAllHistory } from './useFindInAllHistory';
import { LogRule } from '../types';

export interface UseFindInAllProps {
    tabs: Array<{ id: string; title: string; filePath?: string }>;
}

export const useFindInAll = ({ tabs }: UseFindInAllProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isResultPanelOpen, setIsResultPanelOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    /** 검색 완료 후 고정되는 스냅샷 (다시 찾기 전까지 불변) */
    const [snapshotResults, setSnapshotResults] = useState<TabSearchResult[]>([]);
    const [lastSearchRule, setLastSearchRule] = useState<FindInAllRule | null>(null);
    const isSearchingRef = useRef(false);

    const { addHistory } = useFindInAllHistory();

    const openModal = useCallback(() => setIsModalOpen(true), []);
    const closeModal = useCallback(() => setIsModalOpen(false), []);
    const closeResultPanel = useCallback(() => setIsResultPanelOpen(false), []);

    /** 전체 찾기 실행 — 결과를 스냅샷으로 고정 */
    const executeFindInAll = useCallback(async (rule: FindInAllRule) => {
        if (isSearchingRef.current) return;
        isSearchingRef.current = true;
        setIsSearching(true);
        setLastSearchRule(rule);

        // 모달 닫기 & 결과 패널 열기
        setIsModalOpen(false);
        setIsResultPanelOpen(true);
        setSnapshotResults([]); // 기존 결과 초기화

        try {
            // FindInAllRule → LogRule 변환 (워커 요구 형식)
            const logRule: LogRule = {
                id: 'find-in-all-temp',
                name: 'Find in All',
                includeGroups: rule.includeKeywords.filter(k => k.trim()).map(k => [k.trim()]),
                excludes: rule.excludeKeywords.filter(k => k.trim()),
                highlights: [],
                happyCombosCaseSensitive: rule.caseSensitive,
                blockListCaseSensitive: rule.blockListCaseSensitive,
            };
            // includeGroups 정제 (assembleIncludeGroups 적용)
            const preparedRule: LogRule = {
                ...logRule,
                includeGroups: assembleIncludeGroups(logRule),
            };

            const allWorkersMap = workerRegistry.getAllWorkers();
            const promises: Promise<TabSearchResult | null>[] = [];

            for (const [tabId, workerPair] of allWorkersMap.entries()) {
                const tabInfo = tabs.find(t => t.id === tabId);
                const tabName = tabInfo ? tabInfo.title : `Tab ${tabId}`;

                if (workerPair.left?.ready && workerPair.left?.path) {
                    promises.push(
                        performFindInAllSearch(tabId, tabName, 'left', workerPair.left.worker, workerPair.left.path, preparedRule)
                    );
                }
                if (workerPair.right?.ready && workerPair.right?.path) {
                    promises.push(
                        performFindInAllSearch(tabId, tabName, 'right', workerPair.right.worker, workerPair.right.path, preparedRule)
                    );
                }
            }

            const results = await Promise.all(promises);
            const validResults = results.filter((r): r is TabSearchResult => r !== null);

            // 스냅샷 고정 — 이후 외부 변화에 영향받지 않음
            setSnapshotResults(validResults);

            // 이력에 저장 (DB 비동기, 렌더 블로킹 없음)
            addHistory(rule).catch(e => console.error('[FindInAll] History save error', e));

        } catch (error) {
            console.error('[FindInAll] Search failed', error);
        } finally {
            setIsSearching(false);
            isSearchingRef.current = false;
        }
    }, [tabs, addHistory]);

    /** 마지막 룰로 재검색 */
    const reExecuteLastSearch = useCallback(() => {
        if (lastSearchRule) {
            executeFindInAll(lastSearchRule);
        }
    }, [lastSearchRule, executeFindInAll]);

    /** 탭/패인/라인으로 점프 (이벤트 기반, LogSession과 결합 최소화) */
    const handleJumpToTabLine = useCallback((tabId: string, pane: 'left' | 'right', lineNum: number) => {
        window.dispatchEvent(new CustomEvent('global-search-switch-tab', { detail: { tabId } }));
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('global-search-jump-line', { detail: { tabId, pane, lineNum } }));
        }, 120);
    }, []);

    return {
        isModalOpen,
        isResultPanelOpen,
        isSearching,
        snapshotResults,
        lastSearchRule,
        openModal,
        closeModal,
        closeResultPanel,
        executeFindInAll,
        reExecuteLastSearch,
        handleJumpToTabLine,
    };
};

// ─── 내부 워커 검색 함수 ────────────────────────────────────────────────────

function performFindInAllSearch(
    tabId: string,
    tabName: string,
    pane: 'left' | 'right',
    worker: any,
    filePath: string,
    rule: LogRule
): Promise<TabSearchResult | null> {
    return new Promise((resolve) => {
        const requestId = `find-in-all-${tabId}-${pane}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const fileName = filePath.split(/[/\\]/).pop() || '';

        const messageHandler = (e: MessageEvent) => {
            const data = e.data;
            if (data?.type === 'SEARCH_GLOBAL_MISSION_RESULT' && data.requestId === requestId) {
                worker.removeEventListener('message', messageHandler);
                const matches = data.payload?.results || [];
                resolve({
                    tabId,
                    tabName,
                    fileName,
                    filePath,
                    pane,
                    matches: matches.map((m: any) => ({
                        lineNum: m.lineNum,
                        content: m.content,
                    })),
                });
            }
        };

        worker.addEventListener('message', messageHandler);
        worker.postMessage({ type: 'SEARCH_GLOBAL_MISSION', payload: { rule }, requestId });

        // 15초 타임아웃 세이프가드
        setTimeout(() => {
            worker.removeEventListener('message', messageHandler);
            resolve(null);
        }, 15000);
    });
}
