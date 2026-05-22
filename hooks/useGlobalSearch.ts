import { useState, useCallback } from 'react';
import { TabSearchResult } from '../components/LogViewer/GlobalSearchResultView';
import { LogRule } from '../types';
import { workerRegistry } from './LogWorkerRegistry';
import { assembleIncludeGroups } from '../utils/filterGroupUtils';

export interface UseGlobalSearchProps {
    tabs: Array<{ id: string; title: string; filePath?: string }>;
    activeTabId: string;
}

export const useGlobalSearch = (
    tabs: Array<{ id: string; title: string; filePath?: string }>,
    activeTabId: string
) => {
    const [searchResults, setSearchResults] = useState<TabSearchResult[]>([]);
    const [isSearchingAll, setIsSearchingAll] = useState(false);

    const searchAllOpenFiles = useCallback(async (globalRule: LogRule) => {
        if (isSearchingAll) return;
        setIsSearchingAll(true);
        setSearchResults([]);

        try {
            const preparedRule: LogRule = {
                ...globalRule,
                includeGroups: assembleIncludeGroups(globalRule)
            };

            const allWorkersMap = workerRegistry.getAllWorkers();
            const promises: Promise<TabSearchResult | null>[] = [];

            for (const [tabId, workerPair] of allWorkersMap.entries()) {
                const tabInfo = tabs.find(t => t.id === tabId);
                const tabName = tabInfo ? tabInfo.title : `Tab ${tabId}`;

                // Left pane search
                if (workerPair.left && workerPair.left.ready && workerPair.left.path) {
                    promises.push(
                        performWorkerSearch(
                            tabId,
                            tabName,
                            'left',
                            workerPair.left.worker,
                            workerPair.left.path,
                            preparedRule
                        )
                    );
                }

                // Right pane search
                if (workerPair.right && workerPair.right.ready && workerPair.right.path) {
                    promises.push(
                        performWorkerSearch(
                            tabId,
                            tabName,
                            'right',
                            workerPair.right.worker,
                            workerPair.right.path,
                            preparedRule
                        )
                    );
                }
            }

            const results = await Promise.all(promises);
            const validResults = results.filter((r): r is TabSearchResult => r !== null);
            setSearchResults(validResults);
        } catch (error) {
            console.error('[GlobalSearch] Search failed', error);
        } finally {
            setIsSearchingAll(false);
        }
    }, [tabs, isSearchingAll]);

    const handleJumpToTabLine = useCallback((tabId: string, pane: 'left' | 'right', lineNum: number) => {
        // 1. Dispatch event to switch active tab
        window.dispatchEvent(
            new CustomEvent('global-search-switch-tab', { detail: { tabId } })
        );

        // 2. Dispatch event to jump to line after visual switch completed
        setTimeout(() => {
            window.dispatchEvent(
                new CustomEvent('global-search-jump-line', {
                    detail: { tabId, pane, lineNum }
                })
            );
        }, 120);
    }, []);

    const clearSearchResults = useCallback(() => {
        setSearchResults([]);
        setIsSearchingAll(false);
    }, []);

    return {
        searchResults,
        isSearchingAll,
        searchAllOpenFiles,
        handleJumpToTabLine,
        clearSearchResults
    };
};

function performWorkerSearch(
    tabId: string,
    tabName: string,
    pane: 'left' | 'right',
    worker: any,
    filePath: string,
    rule: LogRule
): Promise<TabSearchResult | null> {
    return new Promise((resolve) => {
        const requestId = `global-search-${tabId}-${pane}-${Date.now()}-${Math.random()}`;
        const fileName = filePath.split(/[/\\]/).pop() || '';

        const messageHandler = (e: MessageEvent) => {
            const data = e.data;
            if (data && data.type === 'SEARCH_GLOBAL_MISSION_RESULT' && data.requestId === requestId) {
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
                        content: m.content
                    }))
                });
            }
        };

        worker.addEventListener('message', messageHandler);

        // Request search via worker with OOM safeguard
        worker.postMessage({
            type: 'SEARCH_GLOBAL_MISSION',
            payload: { rule },
            requestId
        });

        // 10 seconds timeout safeguard
        setTimeout(() => {
            worker.removeEventListener('message', messageHandler);
            resolve(null);
        }, 10000);
    });
}
