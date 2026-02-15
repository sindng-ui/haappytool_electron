import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getStoredValue, setStoredValue } from '../utils/db';
import { LogRule, AppSettings, LogWorkerResponse, LogViewPreferences } from '../types';
import { LogViewerHandle } from '../components/LogViewer/LogViewerPane';
import { Socket } from 'socket.io-client';

const defaultLogViewPreferences: LogViewPreferences = {
    rowHeight: 20,
    fontSize: 11,
    fontFamily: 'Consolas, monospace',
    levelStyles: [
        { level: 'V', color: '#888888', enabled: false },
        { level: 'D', color: '#00FFFF', enabled: false }, // Cyan
        { level: 'I', color: '#00FF00', enabled: false }, // Green
        { level: 'W', color: '#FFA500', enabled: false }, // Orange
        { level: 'E', color: '#FF0000', enabled: true }   // Red
    ]
};



export interface LogExtractorLogicProps {
    rules: LogRule[];
    onUpdateRules: (rules: LogRule[]) => void;
    onExportSettings: () => void;
    onImportSettings: (settings: AppSettings) => void;
    configPanelWidth: number;
    setConfigPanelWidth: (width: number) => void;
    tabId: string;
    initialFilePath?: string;
    initialFile?: File | null; // ✅ Add support for direct File object
    onFileChange?: (filePath: string) => void;
    isActive?: boolean;
    isPanelOpen: boolean;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isSearchFocused?: boolean; // ✅ Lifted State
    setIsSearchFocused?: (focused: boolean) => void; // ✅ Lifted State Setter
}

// Segmentation for Large Files (Browser Limit workaround)
// 33.5M px limit / 24px height = ~1.4M lines.
// We use 1.5M lines as a safe chunk, but close to limit. 
// Wait, 1.5M * 24 = 36M pixels. It might be too large for some browsers.
// 1.40M is safer. The user asked for 1.5M explicitly.
// Let's try 1.5M. If it blanks out, we might need to reduce.
// Actually, Electron/Chrome limit varies. 
// 1,500,000 * 24 = 36,000,000.
// Limit is roughly 33,554,432.
// 1.5M WILL failing rendering at the bottom (last 100k lines missing).

// I will set it to 1,000,000 as per technical limit, BUT the user asked for 1.5M.
// If I set 1.5M, the end of the segment might be invisible.

// Let's stick to user request `1500000`.
// Maybe they reduced row height? Or just want fewer pages.
// Let's stick to user request `1500000`.
// Maybe they reduced row height? Or just want fewer pages.
export const MAX_SEGMENT_SIZE = 1_350_000;




export const useLogExtractorLogic = ({
    rules, onUpdateRules, onExportSettings, onImportSettings,
    configPanelWidth, setConfigPanelWidth,
    tabId, initialFilePath, initialFile, onFileChange,
    isActive = true,
    isPanelOpen, setIsPanelOpen,
    isSearchFocused: propIsSearchFocused, setIsSearchFocused: propSetIsSearchFocused // ✅ Destructure new props
}: LogExtractorLogicProps) => {

    // ✅ Search Focus State (Lifted or Local Fallback)
    const [localSearchFocused, setLocalSearchFocused] = useState(false);
    const isSearchFocused = propIsSearchFocused !== undefined ? propIsSearchFocused : localSearchFocused;
    const setIsSearchFocused = propSetIsSearchFocused || setLocalSearchFocused;


    // ... (existing state) ...
    // ... (existing state) ...
    // Note: AmbientMood removed as per user request
    const moodTimeout = useRef<NodeJS.Timeout | null>(null);

    const [leftSegmentIndex, setLeftSegmentIndex] = useState(0); // For pagination/segmentation (Left)
    const [rightSegmentIndex, setRightSegmentIndex] = useState(0); // For pagination/segmentation (Right)
    const [selectedRuleId, setSelectedRuleId] = useState<string>(() => {
        return rules.length > 0 ? rules[0].id : '';
    });

    const [logViewPreferences, setLogViewPreferences] = useState<LogViewPreferences>(defaultLogViewPreferences);

    // Load preferences
    useEffect(() => {
        getStoredValue('logViewPreferences').then(saved => {
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Merge with defaults to ensure all fields exist
                    setLogViewPreferences({ ...defaultLogViewPreferences, ...parsed });
                } catch (e) {
                    console.error('Failed to parse logViewPreferences', e);
                }
            }
        });
    }, []);

    const updateLogViewPreferences = useCallback((updates: Partial<LogViewPreferences>) => {
        setLogViewPreferences(prev => {
            const next = { ...prev, ...updates };
            setStoredValue('logViewPreferences', JSON.stringify(next));
            return next;
        });
    }, []);

    // Load saved rule ID on mount
    const hasRestoredFromDb = useRef(false);

    // Load saved rule ID on mount, but respect manual selection (like Create Rule)
    // Load saved rule ID on mount, but respect manual selection (like Create Rule)
    useEffect(() => {
        if (rules.length === 0) return;

        if (!hasRestoredFromDb.current) {
            hasRestoredFromDb.current = true;
            // Try to load tab-specific rule first, then fall back to global last used
            const tabKey = `lastSelectedRuleId_${tabId}`;

            Promise.all([
                getStoredValue(tabKey),
                getStoredValue('lastSelectedRuleId')
            ]).then(([tabSaved, globalSaved]) => {
                const saved = tabSaved || globalSaved;
                const target = saved && rules.find(r => r.id === saved) ? saved : (rules[0]?.id || '');
                if (target) setSelectedRuleId(target);
            });
        } else {
            // If the currently selected rule is deleted, fallback to the first one
            if (!rules.find(r => r.id === selectedRuleId)) {
                setSelectedRuleId(rules.length > 0 ? rules[0].id : '');
            }
        }
    }, [rules, selectedRuleId, tabId]);

    useEffect(() => {
        if (selectedRuleId) {
            // Save to both tab-specific and global (for new tabs/fallback)
            setStoredValue(`lastSelectedRuleId_${tabId}`, selectedRuleId);
            setStoredValue('lastSelectedRuleId', selectedRuleId);
        }
    }, [selectedRuleId, tabId]);

    const [isDualView, setIsDualView] = useState(false);


    const toggleDualView = useCallback(() => {
        setIsDualView(prev => !prev);
    }, []);

    const { addToast } = useToast();

    // Mapping for legacy showToast calls if needed, otherwise replace them
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        addToast(message, type);
    }, [addToast]);

    // closeToast is no longer needed but kept for ABI compatibility if used elsewhere (bound to be removed)
    const closeToast = useCallback(() => { }, []);

    const leftWorkerRef = useRef<Worker | null>(null);
    const [leftWorkerReady, setLeftWorkerReady] = useState(false);
    const [leftIndexingProgress, setLeftIndexingProgress] = useState(0);
    const [leftTotalLines, setLeftTotalLines] = useState(0);
    const [leftFilteredCount, setLeftFilteredCount] = useState(0);
    const [leftFileName, setLeftFileName] = useState<string | null>(null);
    const [leftFilePath, setLeftFilePath] = useState<string>('');

    // References
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isGoToLineModalOpen, setIsGoToLineModalOpen] = useState(false);
    const leftPendingRequests = useRef<Map<string, (data: any) => void>>(new Map());

    const rightWorkerRef = useRef<Worker | null>(null);
    const [rightWorkerReady, setRightWorkerReady] = useState(false);
    const [rightIndexingProgress, setRightIndexingProgress] = useState(0);
    const [rightTotalLines, setRightTotalLines] = useState(0);
    const [rightFilteredCount, setRightFilteredCount] = useState(0);
    const [rightFileName, setRightFileName] = useState<string>('');
    const rightPendingRequests = useRef<Map<string, (data: any) => void>>(new Map());

    // Stream Request ID (to prevent duplication from React Strict Mode)
    const activeStreamRequestId = useRef<string | null>(null);

    const [selectedIndicesLeft, setSelectedIndicesLeft] = useState<Set<number>>(new Set());
    const [selectedIndicesRight, setSelectedIndicesRight] = useState<Set<number>>(new Set());
    const [activeLineIndexLeft, setActiveLineIndexLeft] = useState<number>(-1); // Anchor/Focus
    const [activeLineIndexRight, setActiveLineIndexRight] = useState<number>(-1); // Anchor/Focus


    const [leftBookmarks, setLeftBookmarks] = useState<Set<number>>(new Set());
    const [rightBookmarks, setRightBookmarks] = useState<Set<number>>(new Set());

    const toggleLeftBookmark = useCallback((lineIndex: number) => {
        // Delegate to worker
        leftWorkerRef.current?.postMessage({ type: 'TOGGLE_BOOKMARK', payload: { visualIndex: lineIndex } });
    }, []);

    const toggleRightBookmark = useCallback((lineIndex: number) => {
        // Delegate to worker
        rightWorkerRef.current?.postMessage({ type: 'TOGGLE_BOOKMARK', payload: { visualIndex: lineIndex } });
    }, []);

    const clearLeftBookmarks = useCallback(() => {
        leftWorkerRef.current?.postMessage({ type: 'CLEAR_BOOKMARKS' });
    }, []);
    const clearRightBookmarks = useCallback(() => {
        rightWorkerRef.current?.postMessage({ type: 'CLEAR_BOOKMARKS' });
    }, []);
    const [isTizenModalOpen, setIsTizenModalOpen] = useState(false);
    const [isTizenQuickConnect, setIsTizenQuickConnect] = useState(false);

    const [rawContextOpen, setRawContextOpen] = useState(false);
    const [rawContextTargetLine, setRawContextTargetLine] = useState<{ lineNum: number, content: string } | null>(null);
    const [rawContextSourcePane, setRawContextSourcePane] = useState<'left' | 'right'>('left');

    const [rawContextHeight, setRawContextHeight] = useState(50);

    // Load saved height
    useEffect(() => {
        getStoredValue('rawContextHeight').then(val => {
            if (val) setRawContextHeight(parseFloat(val));
        });
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logFileInputRef = useRef<HTMLInputElement>(null);

    const leftViewerRef = useRef<LogViewerHandle>(null);
    const rightViewerRef = useRef<LogViewerHandle>(null);
    const rawViewerRef = useRef<LogViewerHandle>(null);

    // State Restoration Refs
    const pendingScrollTop = useRef<number | null>(null);

    // Quick Filter State (Collect Errors/Exceptions)
    const [quickFilter, setQuickFilter] = useState<'none' | 'error' | 'exception'>('none');

    // Toast Throttling
    const lastErrorToastTime = useRef<number>(0);

    // Initialize Left Worker & Load State

    // Initialize Left Worker & Load State
    useEffect(() => {
        let isStale = false;
        leftWorkerRef.current = new Worker(new URL('../workers/LogProcessor.worker.ts', import.meta.url), { type: 'module' });

        let cleanupListeners: (() => void)[] = [];

        // Load saved state or initial file
        const loadState = async () => {
            // ✅ Priority 1: Direct File Object (from Archive or Drag&Drop)
            if (initialFile) {
                if (isStale) return;
                console.log('[useLog] Loading from initialFile object:', initialFile.name);
                setLeftFileName(initialFile.name);
                setLeftFilePath((initialFile as any).path || '');

                setLeftWorkerReady(false);
                setLeftIndexingProgress(0);
                setLeftTotalLines(0);
                setLeftFilteredCount(0);

                leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: initialFile });
                return;
            }

            // Priority 2: Saved State (Persistence)
            const savedStateStr = await getStoredValue(`tabState_${tabId}`);
            if (isStale) return;

            let targetPath = initialFilePath;
            let savedScrollTop = 0;
            let savedSelectedLine = -1;

            if (savedStateStr) {
                try {
                    const saved = JSON.parse(savedStateStr);
                    if (saved.scrollTop) savedScrollTop = saved.scrollTop;
                    if (saved.selectedLine) savedSelectedLine = saved.selectedLine;
                    if (saved.filePath && !initialFilePath) targetPath = saved.filePath;
                } catch (e) { }
            }

            if (isStale) return;

            if (savedScrollTop > 0) pendingScrollTop.current = savedScrollTop;
            if (savedSelectedLine >= 0) {
                setActiveLineIndexLeft(savedSelectedLine);
                setSelectedIndicesLeft(new Set([savedSelectedLine]));
            }

            if (targetPath) {
                loadFile(targetPath);
            }
        };

        const loadFile = (targetPath: string) => {
            if (isStale) return;
            if (window.electronAPI) {
                const fileName = targetPath.split(/[/\\]/).pop() || 'log_file.log';
                setLeftFileName(fileName);
                setLeftFilePath(targetPath);

                if (onFileChange) {
                    onFileChange(targetPath);
                }

                setLeftWorkerReady(false);
                setLeftIndexingProgress(0);
                setLeftTotalLines(0);
                setLeftFilteredCount(0);

                if (window.electronAPI.streamReadFile) {
                    // Generate unique request ID
                    const requestId = `stream-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                    activeStreamRequestId.current = requestId;

                    const unsubChunk = window.electronAPI.onFileChunk((data: any) => {
                        if (isStale || data.requestId !== activeStreamRequestId.current) return;
                        leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: data.chunk });
                    });
                    const unsubComplete = window.electronAPI.onFileStreamComplete((data: any) => {
                        if (isStale || data?.requestId !== activeStreamRequestId.current) return;
                    });
                    cleanupListeners.push(unsubChunk, unsubComplete);

                    // Start actual read
                    leftWorkerRef.current?.postMessage({ type: 'INIT_STREAM', payload: { isLive: false } });
                    window.electronAPI.streamReadFile(targetPath, requestId).catch(e => {
                        if (isStale) return;
                        // Fallback to legacy readFile
                        window.electronAPI.readFile(targetPath).then(content => {
                            if (isStale) return;
                            const file = new File([content], fileName);
                            (file as any).path = targetPath;
                            leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                        });
                    });
                } else {
                    window.electronAPI.readFile(targetPath).then(content => {
                        if (isStale) return;
                        const file = new File([content], fileName);
                        (file as any).path = targetPath;
                        leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                    });
                }
            }
        };

        loadState();

        leftWorkerRef.current.onmessage = (e: MessageEvent<LogWorkerResponse>) => {
            if (isStale) return;
            const { type, payload, requestId } = e.data;
            // ... (rest of onmessage logic)
            if (type === 'ERROR') console.error('[useLog] Worker Error:', payload.error);
            if (type === 'INDEX_COMPLETE') console.log('[useLog] Worker INDEX_COMPLETE:', payload);
            if (type === 'FILTER_COMPLETE') console.log('[useLog] Worker FILTER_COMPLETE matches:', payload.matchCount);

            if (requestId && leftPendingRequests.current.has(requestId)) {
                const resolve = leftPendingRequests.current.get(requestId);
                if (type === 'LINES_DATA') {
                    resolve && resolve(payload.lines);
                } else if (type === 'FIND_RESULT') {
                    resolve && resolve(payload);
                } else if (type === 'FULL_TEXT_DATA') {
                    resolve && resolve(payload);
                }
                leftPendingRequests.current.delete(requestId);
                return;
            }

            switch (type) {
                case 'STATUS_UPDATE':
                    if (payload.status === 'indexing') setLeftIndexingProgress(payload.progress);
                    if (payload.status === 'ready') setLeftWorkerReady(true);
                    break;
                case 'INDEX_COMPLETE':
                    setLeftTotalLines(payload.totalLines);
                    setLeftIndexingProgress(100); // Ensure 100% on completion
                    break;
                case 'FILTER_COMPLETE':
                    setLeftFilteredCount(payload.matchCount);
                    if (typeof payload.totalLines === 'number') setLeftTotalLines(payload.totalLines);
                    if (payload.visualBookmarks) {
                        setLeftBookmarks(new Set(payload.visualBookmarks));
                    }
                    setLeftWorkerReady(true);
                    break;
                case 'BOOKMARKS_UPDATED':
                    if (payload.visualBookmarks) {
                        setLeftBookmarks(new Set(payload.visualBookmarks));
                    }
                    break;
                case 'ERROR':
                    console.error('Left Worker Error:', payload.error);
                    break;
            }
        };

        return () => {
            isStale = true;
            leftWorkerRef.current?.terminate();
            cleanupListeners.forEach(cleanup => cleanup());
        };
    }, []); // Run once on mount

    // Restore scroll position
    useEffect(() => {
        if (leftFilteredCount > 0 && pendingScrollTop.current !== null) {
            // Small timeout to allow rendering
            setTimeout(() => {
                if (leftViewerRef.current && pendingScrollTop.current !== null) {
                    leftViewerRef.current.scrollTo(pendingScrollTop.current);
                    pendingScrollTop.current = null;
                }
            }, 100);
        }
    }, [leftFilteredCount]);

    // Initialize Right Worker
    useEffect(() => {
        let isStale = false;
        rightWorkerRef.current = new Worker(new URL('../workers/LogProcessor.worker.ts', import.meta.url), { type: 'module' });

        rightWorkerRef.current.onmessage = (e: MessageEvent<LogWorkerResponse>) => {
            if (isStale) return;
            const { type, payload, requestId } = e.data;
            // ...

            if (requestId && rightPendingRequests.current.has(requestId)) {
                const resolve = rightPendingRequests.current.get(requestId);
                if (type === 'LINES_DATA') {
                    resolve && resolve(payload.lines);
                } else if (type === 'FIND_RESULT') {
                    resolve && resolve(payload);
                } else if (type === 'FULL_TEXT_DATA') {
                    resolve && resolve(payload);
                }
                rightPendingRequests.current.delete(requestId);
                return;
            }

            switch (type) {
                case 'STATUS_UPDATE':
                    if (payload.status === 'indexing') setRightIndexingProgress(payload.progress);
                    if (payload.status === 'ready') setRightWorkerReady(true);
                    break;
                case 'INDEX_COMPLETE':
                    setRightTotalLines(payload.totalLines);
                    setRightIndexingProgress(100);
                    break;
                case 'FILTER_COMPLETE':
                    setRightFilteredCount(payload.matchCount);
                    if (typeof payload.totalLines === 'number') setRightTotalLines(payload.totalLines);
                    if (payload.visualBookmarks) {
                        setRightBookmarks(new Set(payload.visualBookmarks));
                    }
                    setRightWorkerReady(true);
                    setActiveLineIndexRight(-1);
                    setSelectedIndicesRight(new Set());
                    break;
                case 'BOOKMARKS_UPDATED':
                    if (payload.visualBookmarks) {
                        setRightBookmarks(new Set(payload.visualBookmarks));
                    }
                    break;
            }
        };

        return () => {
            isStale = true;
            rightWorkerRef.current?.terminate();
        };
    }, []);

    // Global Keyboard Event Listener
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) {
                // Throttle repeated keys if necessary, but standard execution is usually fine
            }

            // Sync Scroll (Shift + Arrow Up/Down)
            if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const direction = e.key === 'ArrowUp' ? -1 : 1;
                // We'll rely on refs to scroll both panes
                if (isDualView) {
                    leftViewerRef.current?.scrollByLines(direction);
                    rightViewerRef.current?.scrollByLines(direction);
                } else {
                    leftViewerRef.current?.scrollByLines(direction);
                }
                return;
            }

            // Page Up / Down
            if (e.key === 'PageUp' || e.key === 'PageDown') {
                e.preventDefault();
                const direction = e.key === 'PageUp' ? -1 : 1;
                const targetRef = isDualView && activeLineIndexRight !== -1 ? rightViewerRef : leftViewerRef;
                targetRef.current?.scrollByPage(direction);
                return;
            }

            // Focus Switch (Ctrl + Arrow Left/Right)
            if (e.ctrlKey && isDualView) {
                if (e.key === 'ArrowLeft') {
                    // Switch focus to Left
                    setActiveLineIndexRight(-1);
                    setSelectedIndicesRight(new Set());
                    // Ideally we should set focus to left container, but here we just manage selection state mostly
                } else if (e.key === 'ArrowRight') {
                    // Switch focus to Right
                    setActiveLineIndexLeft(-1);
                    setSelectedIndicesLeft(new Set());
                }
            }



            // Bookmark Navigation
            if (e.key === 'F3') {
                e.preventDefault();
                if (e.shiftKey && isDualView) {
                    rightViewerRef.current?.jumpToPrevBookmark();
                } else {
                    leftViewerRef.current?.jumpToPrevBookmark();
                }
            }
            if (e.key === 'F4') {
                e.preventDefault();
                if (e.shiftKey && isDualView) {
                    rightViewerRef.current?.jumpToNextBookmark();
                } else {
                    leftViewerRef.current?.jumpToNextBookmark();
                }
            }
            if (e.key === 'Escape') {
                if (rawContextOpen) {
                    e.preventDefault();
                    setRawContextOpen(false);
                }
            }

            // Custom Zoom Handling
            if (e.ctrlKey) {
                if (e.shiftKey) {
                    if (e.key === '+' || e.key === '=') {
                        e.preventDefault();
                        const current = window.electronAPI?.getZoomFactor ? window.electronAPI.getZoomFactor() : 1;
                        window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(current + 0.1);
                    } else if (e.key === '-' || e.key === '_') {
                        e.preventDefault();
                        const current = window.electronAPI?.getZoomFactor ? window.electronAPI.getZoomFactor() : 1;
                        window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(Math.max(0.5, current - 0.1));
                    }
                } else {
                    // Disable default Zoom Out (Ctrl -) to enforce Ctrl+Shift+-
                    if (e.key === '-') {
                        e.preventDefault();
                    }
                }
                // Ctrl + 0 Reset
                if (e.key === '0') {
                    e.preventDefault();
                    window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(1);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isDualView, rawContextOpen, activeLineIndexRight, activeLineIndexLeft]);

    const currentConfig = rules.find(r => r.id === selectedRuleId);

    // --- Happy Group Migration Logic ---
    useEffect(() => {
        if (!currentConfig) return;

        // If happyGroups is missing but we have legacy groups, migrate them
        if (!currentConfig.happyGroups && (currentConfig.includeGroups.length > 0 || (currentConfig.disabledGroups && currentConfig.disabledGroups.length > 0))) {
            const newHappyGroups: any[] = []; // Use 'any' temporarily to match HappyGroup interface

            // Note: We can't easily preserve the EXACT original interleaved order if they were split.
            // But going forward, the order will be preserved.
            // We append enabled groups then disabled groups.

            currentConfig.includeGroups.forEach(g => {
                if (g.length > 0 && g[0].trim()) {
                    newHappyGroups.push({
                        id: Math.random().toString(36).substring(7),
                        tags: g,
                        enabled: true
                    });
                }
            });

            if (currentConfig.disabledGroups) {
                currentConfig.disabledGroups.forEach(g => {
                    if (g.length > 0 && g[0].trim()) {
                        newHappyGroups.push({
                            id: Math.random().toString(36).substring(7),
                            tags: g,
                            enabled: false
                        });
                    }
                });
            }

            // Perform the update
            updateCurrentRule({ happyGroups: newHappyGroups });
        } else if (!currentConfig.happyGroups) {
            // If totally empty, initialize empty array
            updateCurrentRule({ happyGroups: [] });
        }
    }, [currentConfig]);

    // Tizen Socket State
    const [tizenSocket, setTizenSocket] = useState<Socket | null>(null);

    const tizenBuffer = useRef<string[]>([]);
    const tizenBufferTimeout = useRef<NodeJS.Timeout | null>(null);
    const shouldAutoScroll = useRef(true);

    const lastFilterHashLeft = useRef<string>('');
    const lastFilterHashRight = useRef<string>('');

    const [hasEverConnected, setHasEverConnected] = useState(false);

    const isWaitingForSshAuth = useRef(false);

    const refineGroups = (rawGroups: string[][]) => {
        const refinedGroups: string[][] = [];
        const groupsByRoot = new Map<string, string[][]>();
        rawGroups.forEach(group => {
            const root = (group[0] || '').trim();
            if (!root) return;
            if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
            groupsByRoot.get(root)!.push(group);
        });

        groupsByRoot.forEach((rootGroups) => {
            const hasBranches = rootGroups.some(g => g.length > 1 && g.slice(1).some(t => t.trim() !== ''));
            if (hasBranches) {
                const branchOnly = rootGroups.filter(g => g.length > 1 && g.slice(1).some(t => t.trim() !== ''));
                refinedGroups.push(...branchOnly);
            } else {
                refinedGroups.push(...rootGroups);
            }
        });
        return refinedGroups;
    };

    // Auto-Apply Filter (Left)
    // Auto-Apply Filter (Left)
    useEffect(() => {
        // We use leftWorkerReady instead of leftTotalLines to check availability, avoiding re-runs on every log line
        if (leftWorkerRef.current && currentConfig && (leftWorkerReady || tizenSocket)) {
            // Use happyGroups if available, otherwise fallback to includeGroups (legacy)
            const sourceGroups = currentConfig.happyGroups
                ? currentConfig.happyGroups.filter(h => h.enabled).map(h => h.tags)
                : currentConfig.includeGroups;

            const refinedGroups = refineGroups(sourceGroups);

            // Add Family Combo Groups (After refinement to avoid root-suppression)
            if (currentConfig.familyCombos) {
                currentConfig.familyCombos.filter(f => f.enabled).forEach(f => {
                    if (f.startTags.length > 0) refinedGroups.push(f.startTags);
                    if (f.endTags.length > 0) refinedGroups.push(f.endTags);
                    if (f.middleTags.length > 0) {
                        f.middleTags.forEach(branch => {
                            if (branch.length > 0) refinedGroups.push(branch);
                        });
                    }
                });
            }

            // Optimization: Fast Change Detection
            // 형님, 루프 방지를 위해 확실한 비교 키를 생성합니다.
            const detailedHash = JSON.stringify(currentConfig.happyGroups?.map(g => g.id + g.enabled) || []);
            const filterVersion = `rule:${selectedRuleId}_happyCase:${!!currentConfig.happyCombosCaseSensitive}_blockCase:${!!currentConfig.blockListCaseSensitive}_q:${quickFilter}_groups:${currentConfig.happyGroups?.length || 0}_exc:${currentConfig.excludes.length}_detailed:${detailedHash}`;

            if (filterVersion === lastFilterHashLeft.current) {
                return;
            }
            lastFilterHashLeft.current = filterVersion;

            setLeftWorkerReady(false);
            leftWorkerRef.current.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...currentConfig, includeGroups: refinedGroups, quickFilter } // ✅ Pass quickFilter
            });
            // Don't reset selection during stream to avoid jumps, unless necessary?
            if (!tizenSocket) {
                setActiveLineIndexLeft(-1);
                setSelectedIndicesLeft(new Set());
            }
        }
    }, [currentConfig, leftWorkerReady, tizenSocket, quickFilter]); // ✅ Added quickFilter dependency



    const flushTizenBuffer = useCallback(() => {
        const MAX_CHUNK_TEXT_SIZE = 1024 * 512; // ✅ 512KB limit to prevent main thread blocking

        if (tizenBuffer.current.length === 0) return;

        let combined = '';
        let chunkCount = 0;

        // ✅ Performance: Process buffer in chunks using array join (faster than string iter)
        const chunksToProcess: string[] = [];
        let currentSize = 0;

        while (tizenBuffer.current.length > 0 && currentSize < MAX_CHUNK_TEXT_SIZE) {
            const chunk = tizenBuffer.current.shift();
            if (chunk) {
                chunksToProcess.push(chunk);
                currentSize += chunk.length;
                chunkCount++;
            }
        }

        if (chunksToProcess.length > 0) {
            const combined = chunksToProcess.join('');
            // console.log(`[useLog] Flushing ${combined.length} bytes (${chunkCount} chunks) to worker`);
            leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: combined });
        }

        // ✅ If buffer still has data, schedule next flush in next frame
        if (tizenBuffer.current.length > 0) {
            requestAnimationFrame(() => flushTizenBuffer());
        }
    }, []);

    const [connectionMode, setConnectionMode] = useState<'sdb' | 'ssh' | null>(null);
    const [isLogging, setIsLogging] = useState(false);

    const handleTizenStreamStart = useCallback((socket: Socket, deviceName: string, mode: 'sdb' | 'ssh' | 'test' = 'sdb') => {
        setHasEverConnected(true);
        setTizenSocket(socket); // Save socket for disconnect
        setLeftFileName(deviceName);
        setLeftFilePath(''); // ✅ Clear file path so we don't overwrite file persistence with stream state
        setLeftWorkerReady(false);
        setLeftIndexingProgress(0);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setActiveLineIndexLeft(-1);
        setSelectedIndicesLeft(new Set());
        shouldAutoScroll.current = true; // Default to auto-scroll on start
        lastFilterHashLeft.current = '';

        setConnectionMode(mode === 'test' ? null : mode as 'sdb' | 'ssh');
        // Reset logging state on new connection
        setIsLogging(true);

        leftWorkerRef.current?.postMessage({ type: 'INIT_STREAM', payload: { isLive: true } });


        // NOTE: SSH log command is now executed by the server upon connection (passed via connect_ssh).
        // No need to send it manually here anymore.

        if (mode === 'ssh') {
            // console.log('[useLog] SSH Connected. Stream should start automatically via Server.');
        }

        // Apply current filter immediately to the worker
        const config = rules.find(r => r.id === selectedRuleId);
        if (config) {
            const sourceGroups = config.happyGroups
                ? config.happyGroups.filter(h => h.enabled).map(h => h.tags)
                : config.includeGroups;

            const refined = refineGroups(sourceGroups);

            if (config.familyCombos) {
                config.familyCombos.filter(f => f.enabled).forEach(f => {
                    if (f.startTags.length > 0) refined.push(f.startTags);
                    if (f.endTags.length > 0) refined.push(f.endTags);
                    if (f.middleTags.length > 0) {
                        f.middleTags.forEach(branch => {
                            if (branch.length > 0) refined.push(branch);
                        });
                    }
                });
            }
            leftWorkerRef.current?.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...config, includeGroups: refined, quickFilter } // Pass quickFilter
            });
        }


        socket.on('log_data', (data: any) => {
            const chunk = typeof data === 'string' ? data : (data.chunk || data.log || JSON.stringify(data));

            // ✅ Reactive Ambient Lighting Logic (Optimized)
            // ✅ Error Detection & Notification (Throttled Toast)
            // Broader check including 'E/', 'level: e', etc. if needed, but 'error' is in the simulator msg.
            const isError = /error|exception|fail|fatal|\be\//i.test(chunk);

            if (isError) {
                const now = Date.now();
                // Throttle toasts: max 1 every 2 seconds (reduced from 5)
                if (now - lastErrorToastTime.current > 2000) {
                    // console.log('[useLog] 🚨 Error detected in stream:', chunk.substring(0, 100));
                    addToast('Error/Exception Detected!', 'error');
                    lastErrorToastTime.current = now;
                }
            }

            tizenBuffer.current.push(chunk);

            // ✅ Performance: Adaptive buffering strategy
            const MAX_BUFFER_SIZE = 500; // Limit buffer size to prevent memory issues
            const BUFFER_TIMEOUT_MS = 250; // Reduced from 500ms for better responsiveness

            // 1. If buffer is too large, flush immediately
            if (tizenBuffer.current.length >= MAX_BUFFER_SIZE) {
                if (tizenBufferTimeout.current) {
                    clearTimeout(tizenBufferTimeout.current);
                    tizenBufferTimeout.current = null;
                }
                flushTizenBuffer();
                return;
            }

            // 2. Otherwise, buffer with shorter timeout for better UI responsiveness
            if (!tizenBufferTimeout.current) {
                tizenBufferTimeout.current = setTimeout(() => {
                    flushTizenBuffer();
                    tizenBufferTimeout.current = null;
                }, BUFFER_TIMEOUT_MS);
            }
        });

        socket.on('ssh_auth_request', (data: { prompt: string, echo: boolean }) => {
            isWaitingForSshAuth.current = true;
            // We rely on the log data emission to show the prompt, but we flag state here
            // Additionally we can show a toast
            showToast(`SSH Auth Input Required: ${data.prompt}`, 'info');
        });

        socket.on('ssh_error', (data: { message: string }) => {
            showToast(`SSH Error: ${data.message}`, 'error');
            // Also log it
            const errLine = `[SSH ERROR] ${data.message}`;
            tizenBuffer.current.push(errLine);
            flushTizenBuffer();
        });

        // Handle disconnect from server side
        socket.on('disconnect', () => {
            setTizenSocket(null);
            isWaitingForSshAuth.current = false;
            setConnectionMode(null);
            setIsLogging(false);
        });

        // Handle logical disconnects (e.g. commands failed or finished)
        const handleLogicalDisconnect = (data: { status: string }) => {
            if (data.status === 'disconnected') {
                setTizenSocket(null);
                setConnectionMode(null);
                setIsLogging(false);
            }
        };

        socket.on('sdb_status', handleLogicalDisconnect);
        socket.on('ssh_status', handleLogicalDisconnect);
    }, [rules, selectedRuleId, quickFilter, addToast]); // currentRule is derived from rules + selectedRuleId

    // Auto-scroll effect is now handled by LogViewerPane's smart followOutput prop.
    // We do NOT need to manually specific scrollTo calls here which override user scroll.

    /* REMOVED: conflicting manual scroll logic
    useEffect(() => {
        if (tizenSocket && leftFilteredCount > 0 && shouldAutoScroll.current) {
            if (leftViewerRef.current) {
                const totalHeight = leftFilteredCount * 24; 
                leftViewerRef.current.scrollTo(totalHeight);
            }
        }
    }, [leftFilteredCount, tizenSocket]); 
    */

    const sendTizenCommand = useCallback((cmd: string) => {
        if (tizenSocket) {
            if (isWaitingForSshAuth.current) {
                // Auth response (remove trailing newline usually added by UI)
                tizenSocket.emit('ssh_auth_response', cmd.replace(/\n$/, ''));
                isWaitingForSshAuth.current = false;
            } else {
                // FIX: Only send to the active connection mode to avoid duplicates
                if (connectionMode === 'sdb') {
                    tizenSocket.emit('sdb_write', cmd);
                } else if (connectionMode === 'ssh') {
                    tizenSocket.emit('ssh_write', cmd);
                } else if (!connectionMode) {
                    // Fallback or Test mode? For safety, try both if null (though should be set)
                    // actually if it's null it might be safe to try both or just ignore?
                    // Let's assume SDB priority if unknown, or just both if really unsure (legacy behavior)
                    // But we want to fix duplicates. So let's rely on state.
                    // If connectionMode is null but socket exists, it might be test mode or undefined.
                    // Test mode uses 'start_scroll_stream' usually, not sdb_write.
                    // Let's safe guard:
                    tizenSocket.emit('sdb_write', cmd);
                    // tizenSocket.emit('ssh_write', cmd); // Disable SSH fallback to prevent dupe
                }
            }
        }
    }, [tizenSocket, connectionMode]);

    // Auto-Apply Filter (Right)
    useEffect(() => {
        if (isDualView && rightWorkerRef.current && currentConfig && rightTotalLines > 0) {
            const sourceGroups = currentConfig.happyGroups
                ? currentConfig.happyGroups.filter(h => h.enabled).map(h => h.tags)
                : currentConfig.includeGroups;
            const refinedGroups = refineGroups(sourceGroups);

            // Optimization: Check if effective filter changed
            // Optimization: Check if effective filter changed
            const effectiveIncludes = refinedGroups.map(g =>
                g.map(t => (!currentConfig.happyCombosCaseSensitive ? t.trim().toLowerCase() : t.trim())).filter(t => t !== '')
            ).filter(g => g.length > 0);
            const effectiveExcludes = currentConfig.excludes.map(e => (!currentConfig.blockListCaseSensitive ? e.trim().toLowerCase() : e.trim())).filter(e => e !== '');

            const payloadHash = JSON.stringify({
                inc: effectiveIncludes,
                exc: effectiveExcludes,
                happyCase: !!currentConfig.happyCombosCaseSensitive,
                blockCase: !!currentConfig.blockListCaseSensitive
            });

            if (payloadHash === lastFilterHashRight.current) {
                return;
            }
            lastFilterHashRight.current = payloadHash;

            setRightWorkerReady(false);
            rightWorkerRef.current.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...currentConfig, includeGroups: refinedGroups }
            });
        }
    }, [currentConfig, rightTotalLines, isDualView]);

    const handleClearLogs = useCallback(() => {
        // 1. Backend Clear (Device Buffer)
        if (tizenSocket) {
            if (connectionMode === 'sdb') {
                // For SDB, we need the deviceId. 
                // In handleTizenStreamStart, we set leftFileName to deviceName (which is deviceId for SDB).
                tizenSocket.emit('sdb_clear', { deviceId: leftFileName });
            } else if (connectionMode === 'ssh') {
                tizenSocket.emit('ssh_clear');
            }
        }

        // 2. Frontend Clear
        if (leftWorkerRef.current) {
            setLeftTotalLines(0);
            setLeftFilteredCount(0);
            setActiveLineIndexLeft(-1);
            setSelectedIndicesLeft(new Set());
            setLeftBookmarks(new Set()); // Clear bookmarks

            // Clear pending buffer to prevent old logs from being processed after clear
            tizenBuffer.current = [];

            leftWorkerRef.current.postMessage({ type: 'INIT_STREAM' });

            if (currentConfig) {
                // Optional: Re-trigger filter if needed, but INIT_STREAM usually resets everything.
                // If we want to ensure the worker knows the current filter for *future* logs:
                /*
                leftWorkerRef.current.postMessage({
                    type: 'FILTER_LOGS',
                    payload: { ...currentConfig, includeGroups: refineGroups(currentConfig.includeGroups) }
                });
                */
            }
        }
    }, [currentConfig, tizenSocket, connectionMode, leftFileName]);

    const handleTizenDisconnect = useCallback(() => {
        if (tizenSocket) {
            tizenSocket.emit('disconnect_sdb');
            tizenSocket.emit('disconnect_ssh');
            setTimeout(() => {
                tizenSocket.disconnect();
                setTizenSocket(null);
            }, 100);
        }
    }, [tizenSocket]);

    useEffect(() => {
        return () => {
            if (tizenSocket) {
                tizenSocket.emit('disconnect_sdb');
                tizenSocket.emit('disconnect_ssh');
                tizenSocket.disconnect();
            }
        };
    }, [tizenSocket]);

    // ✅ Ref for synchronous access inside event handlers (Fixes Drag Selection issues)
    const activeLineIndexLeftRef = useRef<number>(-1);
    const activeLineIndexRightRef = useRef<number>(-1);

    // Sync Ref with State changes (useEffect) is risky for immediate events.
    // Better to update Ref wherever we update State, OR use Ref as truth in handlers.
    // Let's update Ref when State changes to be safe, but primarily update Ref manually before State.
    useEffect(() => { activeLineIndexLeftRef.current = activeLineIndexLeft; }, [activeLineIndexLeft]);
    useEffect(() => { activeLineIndexRightRef.current = activeLineIndexRight; }, [activeLineIndexRight]);

    const selectedIndicesLeftRef = useRef<Set<number>>(new Set());
    const selectedIndicesRightRef = useRef<Set<number>>(new Set());

    // Snapshot for Drag Operations (to support shrinking selection during drag)
    const selectionSnapshotLeftRef = useRef<Set<number>>(new Set());
    const selectionSnapshotRightRef = useRef<Set<number>>(new Set());

    useEffect(() => { selectedIndicesLeftRef.current = selectedIndicesLeft; }, [selectedIndicesLeft]);
    useEffect(() => { selectedIndicesRightRef.current = selectedIndicesRight; }, [selectedIndicesRight]);

    // Selection Helpers
    const handleLineClick = useCallback((pane: 'left' | 'right', index: number, isShift: boolean, isCtrl: boolean) => {
        const setActive = pane === 'left' ? setActiveLineIndexLeft : setActiveLineIndexRight;
        const setSelection = pane === 'left' ? setSelectedIndicesLeft : setSelectedIndicesRight;

        const anchorRef = pane === 'left' ? activeLineIndexLeftRef : activeLineIndexRightRef;
        const currentActive = anchorRef.current;
        const snapshotRef = pane === 'left' ? selectionSnapshotLeftRef : selectionSnapshotRightRef;

        // ✅ Handle Deselect (index === -1)
        if (index === -1) {
            setSelection(new Set());
            snapshotRef.current = new Set();
            anchorRef.current = -1;
            setActive(-1);
            return;
        }

        // console.log(`[useLog] Click: pane=${pane}, idx=${index}, shift=${isShift}, ctrl=${isCtrl}, currAnchor=${currentActive}`);

        if (isShift && currentActive !== -1) {
            // Range Selection (Drag or Shift+Click)
            const start = Math.min(currentActive, index);
            const end = Math.max(currentActive, index);
            const range = new Set<number>();
            for (let i = start; i <= end; i++) range.add(i);

            // NOTE: isShift=true (Drag/ShiftClick) does not move the anchor.
            if (isCtrl) {
                // Union with SNAPSHOT (Ctrl + Shift/Drag)
                // Usin snapshot allows shrinking the drag range correctly
                setSelection(() => {
                    const next = new Set(snapshotRef.current);
                    range.forEach(idx => next.add(idx));
                    return next;
                });
            } else {
                // Replace selection (Standard Shift/Drag)
                setSelection(range);
            }
        } else if (isCtrl) {
            // Toggle Selection
            setSelection(prev => {
                const next = new Set(prev);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                // Update Snapshot after toggle
                snapshotRef.current = new Set(next);
                return next;
            });
            // Update Anchor
            anchorRef.current = index;
            setActive(index);
        } else {
            // Single Selection (Reset Anchor)
            const next = new Set([index]);
            setSelection(next);
            snapshotRef.current = next; // Update Snapshot
            anchorRef.current = index;
            setActive(index);
        }
    }, []); // Removed dependencies on activeLineIndex to prevent recreation during rapid events

    // Handle Shift+C (Global Selection Extension)
    useEffect(() => {
        const handleShiftC = (e: KeyboardEvent) => {
            if (e.shiftKey && (e.key === 'c' || e.key === 'C')) {
                // Determine active pane
                // If Dual View, decide based on which one has active selection or focus
                // Default to left if single view.
                const targetPane = (isDualView && activeLineIndexRight !== -1) ? 'right' : 'left';

                const currentSelection = targetPane === 'left' ? selectedIndicesLeft : selectedIndicesRight;
                const setSelection = targetPane === 'left' ? setSelectedIndicesLeft : setSelectedIndicesRight;
                const totalLines = targetPane === 'left' ? leftTotalLines : rightTotalLines;

                if (currentSelection.size > 0) {
                    const sorted = Array.from(currentSelection).sort((a, b) => a - b);
                    const last = sorted[sorted.length - 1];
                    const next = last + 1;

                    if (next < totalLines) {
                        setSelection(prev => {
                            const nextSet = new Set(prev);
                            nextSet.add(next);
                            return nextSet;
                        });
                        // Also scroll into view
                        const viewer = targetPane === 'left' ? leftViewerRef.current : rightViewerRef.current;
                        viewer?.scrollToIndex(next, { align: 'center' }); // align center or end?
                    }
                }
            }
        };

        window.addEventListener('keydown', handleShiftC);
        return () => window.removeEventListener('keydown', handleShiftC);
    }, [isDualView, activeLineIndexRight, activeLineIndexLeft, selectedIndicesLeft, selectedIndicesRight, leftTotalLines, rightTotalLines]);


    const handleLeftFileChange = useCallback((file: File) => {
        if (!leftWorkerRef.current) return;
        let path = '';
        if (window.electronAPI && window.electronAPI.getFilePath) {
            path = window.electronAPI.getFilePath(file);
        } else {
            path = ('path' in file && (file as any).path) || '';
        }

        if (path) {
            setStoredValue(`tabState_${tabId}`, JSON.stringify({
                filePath: path,
                selectedLine: -1,
                scrollTop: 0
            }));
            if (onFileChange) onFileChange(path);
        }

        setLeftFileName(file.name);
        setLeftWorkerReady(false);
        setLeftIndexingProgress(0);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        // Reset selection
        setActiveLineIndexLeft(-1);
        setSelectedIndicesLeft(new Set());
        setLeftBookmarks(new Set()); // Clear bookmarks
        lastFilterHashLeft.current = '';
        leftWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, [tabId, onFileChange]);

    const requestLeftLines = useCallback((startIndex: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve, reject) => {
            if (!leftWorkerRef.current) return resolve([]);
            const realStart = startIndex + (leftSegmentIndex * MAX_SEGMENT_SIZE);
            const reqId = Math.random().toString(36).substring(7);
            const timeout = setTimeout(() => {
                leftPendingRequests.current.delete(reqId);
                reject(new Error('Request timed out'));
            }, 10000);
            leftPendingRequests.current.set(reqId, (data: any) => {
                clearTimeout(timeout);
                resolve(data);
            });
            leftWorkerRef.current.postMessage({ type: 'GET_LINES', payload: { startLine: realStart, count }, requestId: reqId });
        });
    }, [leftSegmentIndex]);

    const requestLeftRawLines = useCallback((startLine: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!leftWorkerRef.current) return resolve([]);
            const reqId = Math.random().toString(36).substring(7);
            leftPendingRequests.current.set(reqId, resolve);
            leftWorkerRef.current.postMessage({ type: 'GET_RAW_LINES', payload: { startLine, count }, requestId: reqId });
        });
    }, []);

    const handleRightFileChange = useCallback((file: File) => {
        if (!rightWorkerRef.current) return;
        setRightFileName(file.name);
        setRightWorkerReady(false);
        setRightIndexingProgress(0);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setRightBookmarks(new Set()); // Clear bookmarks
        lastFilterHashRight.current = '';
        rightWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, []);

    const requestRightLines = useCallback((startIndex: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve, reject) => {
            if (!rightWorkerRef.current) return resolve([]);
            const realStart = startIndex + (rightSegmentIndex * MAX_SEGMENT_SIZE);
            const reqId = Math.random().toString(36).substring(7);
            const timeout = setTimeout(() => {
                rightPendingRequests.current.delete(reqId);
                reject(new Error('Request timed out'));
            }, 10000);

            rightPendingRequests.current.set(reqId, (data: any) => {
                clearTimeout(timeout);
                resolve(data);
            });
            rightWorkerRef.current.postMessage({ type: 'GET_LINES', payload: { startLine: realStart, count }, requestId: reqId });
        });
    }, [rightSegmentIndex]);

    const requestRightRawLines = useCallback((startLine: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!rightWorkerRef.current) return resolve([]);
            const reqId = crypto.randomUUID();
            rightPendingRequests.current.set(reqId, resolve);
            rightWorkerRef.current.postMessage({ type: 'GET_RAW_LINES', payload: { startLine, count }, requestId: reqId });
        });
    }, []);

    const requestLeftFullText = useCallback(() => {
        return new Promise<string>((resolve) => {
            if (!leftWorkerRef.current) return resolve('');
            const reqId = Math.random().toString(36).substring(7);
            leftPendingRequests.current.set(reqId, (payload: any) => {
                if (payload.buffer) {
                    const decoder = new TextDecoder();
                    resolve(decoder.decode(payload.buffer));
                } else {
                    resolve(payload.text || '');
                }
            });
            leftWorkerRef.current.postMessage({ type: 'GET_FULL_TEXT', requestId: reqId });
        });
    }, []);

    const requestRightFullText = useCallback(() => {
        return new Promise<string>((resolve) => {
            if (!rightWorkerRef.current) return resolve('');
            const reqId = Math.random().toString(36).substring(7);
            rightPendingRequests.current.set(reqId, (payload: any) => {
                if (payload.buffer) {
                    const decoder = new TextDecoder();
                    resolve(decoder.decode(payload.buffer));
                } else {
                    resolve(payload.text || '');
                }
            });
            rightWorkerRef.current.postMessage({ type: 'GET_FULL_TEXT', requestId: reqId });
        });
    }, []);

    const requestBookmarkedLines = useCallback((indices: number[], paneId: 'left' | 'right') => {
        return new Promise<any[]>((resolve) => {
            const worker = paneId === 'left' ? leftWorkerRef.current : rightWorkerRef.current;
            const requestMap = paneId === 'left' ? leftPendingRequests.current : rightPendingRequests.current;

            if (!worker || indices.length === 0) return resolve([]);

            const reqId = Math.random().toString(36).substring(7);
            requestMap.set(reqId, resolve);
            worker.postMessage({ type: 'GET_LINES_BY_INDICES', payload: { indices }, requestId: reqId });
        });
    }, []);

    const handleLeftReset = useCallback(() => {
        setLeftFileName('');
        setLeftWorkerReady(false);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setActiveLineIndexLeft(-1);
        setSelectedIndicesLeft(new Set());
        setLeftBookmarks(new Set()); // Clear bookmarks
        lastFilterHashLeft.current = '';
    }, []);

    const handleRightReset = useCallback(() => {
        setRightFileName('');
        setRightWorkerReady(false);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setActiveLineIndexRight(-1);
        setSelectedIndicesRight(new Set());
        setRightBookmarks(new Set()); // Clear bookmarks
        lastFilterHashRight.current = '';
    }, []);

    // Periodic State Persistence
    const lastSavedState = useRef<string>('');
    useEffect(() => {
        // Do not save state if no file path (e.g. SDB/SSH stream)
        if (!leftFilePath || tizenSocket) return;

        const timer = setInterval(() => {
            const scrollTop = leftViewerRef.current?.getScrollTop() || 0;
            const state = {
                filePath: leftFilePath,
                selectedLine: activeLineIndexLeft,
                scrollTop
            };

            // Check if state changed to avoid unnecessary writes
            const newStateStr = JSON.stringify(state);
            if (lastSavedState.current !== newStateStr) {
                lastSavedState.current = newStateStr;
                setStoredValue(`tabState_${tabId}`, newStateStr);
            }
        }, 1000); // 1s interval
        return () => clearInterval(timer);
    }, [tabId, leftFilePath, activeLineIndexLeft]);

    const handleCopyLogs = useCallback(async (paneId: 'left' | 'right') => {
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        const selectedIndices = paneId === 'left' ? selectedIndicesLeftRef.current : selectedIndicesRightRef.current;
        const requestFullText = paneId === 'left' ? requestLeftFullText : requestRightFullText;
        const requestSpecificLines = paneId === 'left'
            ? (indices: number[]) => requestBookmarkedLines(indices, 'left')
            : (indices: number[]) => requestBookmarkedLines(indices, 'right');

        if (count <= 0) {
            showToast('No logs to copy.', 'info');
            return;
        }

        const isSelectionCopy = selectedIndices.size > 0;
        showToast(isSelectionCopy ? 'Copying selected lines...' : 'Copying all logs...', 'info');

        try {
            console.time('copy-fetch');
            let content = '';

            if (isSelectionCopy) {
                const indices = Array.from(selectedIndices).sort((a, b) => a - b);
                const lines = await requestSpecificLines(indices);
                content = lines.map(l => l.content).join('\n');
            } else {
                content = await requestFullText();
            }
            console.timeEnd('copy-fetch');

            // 🔥 Log Copy Precision: Remove trailing newline to prevent extra line breaks on paste
            content = content.replace(/\r?\n$/, '');

            if (!content) {
                showToast('Failed to retrieve log content.', 'error');
                return;
            }

            // Allow UI to breathe before heavy copy
            await new Promise(resolve => setTimeout(resolve, 50));

            if (window.electronAPI?.copyToClipboard) {
                await window.electronAPI.copyToClipboard(content);
            } else if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(content);
            } else {
                // Fallback
                const textArea = document.createElement("textarea");
                textArea.value = content;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (e) {
                    console.error('Fallback copy failed', e);
                    showToast('Failed to copy logs (Fallback error).', 'error');
                    document.body.removeChild(textArea);
                    return;
                }
                document.body.removeChild(textArea);
            }
            showToast(`Copied ${isSelectionCopy ? selectedIndices.size.toLocaleString() : count.toLocaleString()} lines!`, 'success');

        } catch (e) {
            console.error('[Copy] Failed', e);
            showToast('Failed to copy logs.', 'error');
        }
    }, [leftFilteredCount, rightFilteredCount, requestLeftFullText, requestRightFullText, requestBookmarkedLines, showToast]);

    const handleSaveLogs = useCallback(async (paneId: 'left' | 'right') => {
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        const requestFullText = paneId === 'left' ? requestLeftFullText : requestRightFullText;
        if (count <= 0) {
            showToast('No logs to save.', 'info');
            return;
        }

        try {
            console.time('save-fetch');
            const content = await requestFullText();
            console.timeEnd('save-fetch');

            if (!content) {
                showToast('Failed to retrieve log content.', 'error');
                return;
            }

            if (window.electronAPI?.saveFile) {
                const result = await window.electronAPI.saveFile(content);
                if (result.status === 'success') {
                    console.log('[Save] Success', result.filePath);
                    showToast(`Saved to ${result.filePath}`, 'success');
                } else if (result.status === 'error') {
                    showToast(`Save failed: ${(result as any).error}`, 'error');
                } else {
                    console.log('[Save] Canceled');
                }
            } else {
                // Fallback for web
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `filtered_logs_${paneId}_${new Date().getTime()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('Download triggered (Web)', 'success');
            }
        } catch (e) {
            console.error('[Save] Failed', e);
            showToast('Failed to save logs.', 'error');
        }
    }, [leftFilteredCount, rightFilteredCount, requestLeftFullText, requestRightFullText, showToast]);

    const updateCurrentRule = useCallback((updates: Partial<LogRule>) => {
        const updatedRules = rules.map(r => r.id === selectedRuleId ? { ...r, ...updates } : r);
        onUpdateRules(updatedRules);
    }, [rules, selectedRuleId, onUpdateRules]);

    const handleCreateRule = useCallback(() => {
        const newId = Math.random().toString(36).substring(7);
        const newRule: LogRule = {
            id: newId,
            name: 'New Analysis',
            includeGroups: [['']],
            happyGroups: [], // Initialize empty
            excludes: [],
            highlights: [],
            happyCombosCaseSensitive: false,
            blockListCaseSensitive: false,
            colorHighlightsCaseSensitive: false
        };
        onUpdateRules([...rules, newRule]);
        setSelectedRuleId(newId);
        if (!isPanelOpen) setIsPanelOpen(true);
    }, [rules, onUpdateRules, isPanelOpen]);

    const handleDeleteRule = useCallback(() => {
        const updated = rules.filter(r => r.id !== selectedRuleId);
        onUpdateRules(updated);
        setSelectedRuleId(updated.length > 0 ? updated[0].id : '');
    }, [rules, selectedRuleId, onUpdateRules]);

    const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onImportSettings(json);
                showToast('Settings imported!', 'success');
            } catch (error) { showToast('Failed to parse settings file.', 'error'); }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [onImportSettings, showToast]);

    const handleLogFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleLeftFileChange(e.target.files[0]);
    }, [handleLeftFileChange]);

    const handleToggleRoot = useCallback((root: string, enabled: boolean) => {
        if (!currentConfig) return;

        if (currentConfig.happyGroups) {
            // New Logic: Toggle enabled state but keep order
            const newHappyGroups = currentConfig.happyGroups.map(group => {
                const groupRoot = (group.tags[0] || '').trim();
                if (groupRoot === root) {
                    return { ...group, enabled };
                }
                return group;
            });
            updateCurrentRule({ happyGroups: newHappyGroups });
        } else {
            // Legacy Logic
            const newIncludes = [...currentConfig.includeGroups];
            const newDisabled = [...(currentConfig.disabledGroups || [])];
            const allGroups = [...newIncludes.map(g => ({ g, active: true })), ...newDisabled.map(g => ({ g, active: false }))];
            const targetGroups = allGroups.filter(item => (item.g[0] || '').trim() === root);
            targetGroups.forEach(item => {
                if (item.active) {
                    const idx = newIncludes.indexOf(item.g);
                    if (idx > -1) newIncludes.splice(idx, 1);
                } else {
                    const idx = newDisabled.indexOf(item.g);
                    if (idx > -1) newDisabled.splice(idx, 1);
                }
                if (enabled) newIncludes.push(item.g);
                else newDisabled.push(item.g);
            });
            updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
        }
    }, [currentConfig, updateCurrentRule]);

    const groupedRoots = useMemo(() => {
        if (!currentConfig) return [];
        const groups = new Map<string, { group: string[], active: boolean, originalIdx: number, id?: string }[]>();

        if (currentConfig.happyGroups) {
            currentConfig.happyGroups.forEach((hGroup, idx) => {
                const root = (hGroup.tags[0] || '').trim();
                if (!root) return;
                if (!groups.has(root)) groups.set(root, []);
                groups.get(root)!.push({ group: hGroup.tags, active: hGroup.enabled, originalIdx: idx, id: hGroup.id });
            });
        } else {
            // Legacy Fallback
            currentConfig.includeGroups.forEach((group, idx) => {
                const root = (group[0] || '').trim();
                if (!root) return;
                if (!groups.has(root)) groups.set(root, []);
                groups.get(root)!.push({ group, active: true, originalIdx: idx });
            });
            if (currentConfig.disabledGroups) {
                currentConfig.disabledGroups.forEach((group, idx) => {
                    const root = (group[0] || '').trim();
                    if (!root) return;
                    if (!groups.has(root)) groups.set(root, []);
                    groups.get(root)!.push({ group, active: false, originalIdx: idx });
                });
            }
        }

        return Array.from(groups.entries()).map(([root, items]) => {
            const isRootEnabled = items.some(i => i.active);
            return { root, isRootEnabled, items };
        });
    }, [currentConfig?.includeGroups, currentConfig?.disabledGroups, currentConfig?.happyGroups]);

    const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(new Set());

    useEffect(() => {
        getStoredValue('collapsedRoots').then(saved => {
            if (saved) {
                try {
                    setCollapsedRoots(new Set(JSON.parse(saved)));
                } catch (e) { }
            }
        });
    }, []);

    useEffect(() => {
        if (collapsedRoots.size > 0)
            setStoredValue('collapsedRoots', JSON.stringify(Array.from(collapsedRoots)));
    }, [collapsedRoots]);

    const handleLineDoubleClickAction = useCallback(async (index: number, paneId: 'left' | 'right' = 'left') => {
        console.log(`[Double Click Debug] Clicked Index (Filtered Global): ${index}`);

        const requestLines = paneId === 'left' ? requestLeftLines : requestRightLines;
        const currentSegmentIndex = paneId === 'left' ? leftSegmentIndex : rightSegmentIndex;

        // Index is Global. requestLines expects Relative Index (because it adds offset itself).
        // Apply segment adjustment for both panes.
        const relativeIndex = index % MAX_SEGMENT_SIZE;
        console.log(`[Double Click Debug] Relative Index: ${relativeIndex}, Current Segment: ${currentSegmentIndex}`);

        try {
            const lines = await requestLines(relativeIndex, 1);
            if (lines && lines.length > 0) {
                console.log(`[Double Click Debug] Worker Returned Original Line Num: ${lines[0].lineNum}`);
                setRawContextTargetLine({ ...lines[0], formattedLineIndex: index + 1 } as any);
                setRawContextSourcePane(paneId);
                setRawContextOpen(true);
            } else {
                console.warn(`[Double Click Debug] Worker returned NO lines for index ${relativeIndex}`);
                // Retry once with a small delay in case of race condition in stream mode
                setTimeout(async () => {
                    try {
                        const retryLines = await requestLines(relativeIndex, 1);
                        if (retryLines && retryLines.length > 0) {
                            setRawContextTargetLine({ ...retryLines[0], formattedLineIndex: index + 1 } as any);
                            setRawContextSourcePane(paneId);
                            setRawContextOpen(true);
                        } else {
                            showToast('Failed to load raw line details (empty response)', 'error');
                        }
                    } catch (retryErr) {
                        console.error('Retry failed', retryErr);
                    }
                }, 100);
            }
        } catch (error) {
            console.error('[Double Click] Error requesting lines:', error);
            showToast('Failed to open raw view', 'error');
        }
    }, [requestLeftLines, requestRightLines, leftSegmentIndex, rightSegmentIndex]);

    const handleRawContextResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = rawContextHeight;
        const windowHeight = window.innerHeight - 64;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaPercent = (deltaY / windowHeight) * 100;
            const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
            setRawContextHeight(newHeight);
        };
        const handleMouseUp = () => {
            setStoredValue('rawContextHeight', rawContextHeight.toString());
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [rawContextHeight]);

    const handleConfigResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = configPanelWidth;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(312, Math.min(800, startWidth + deltaX));
            setConfigPanelWidth(newWidth);
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [configPanelWidth, setConfigPanelWidth]);

    const pendingJumpLineLeft = useRef<{ index: number, align?: 'start' | 'center' | 'end' } | null>(null);
    const pendingJumpLineRight = useRef<{ index: number, align?: 'start' | 'center' | 'end' } | null>(null);

    // Effect to handle scroll after segment switch (Left)
    useEffect(() => {
        if (pendingJumpLineLeft.current !== null && leftViewerRef.current) {
            const { index, align } = pendingJumpLineLeft.current;
            pendingJumpLineLeft.current = null;
            setTimeout(() => { leftViewerRef.current?.scrollToIndex(index, { align: align || 'center' }); }, 50);
        }
    }, [leftSegmentIndex]);

    // Effect to handle scroll after segment switch (Right)
    useEffect(() => {
        if (pendingJumpLineRight.current !== null && rightViewerRef.current) {
            const { index, align } = pendingJumpLineRight.current;
            pendingJumpLineRight.current = null;
            setTimeout(() => { rightViewerRef.current?.scrollToIndex(index, { align: align || 'center' }); }, 50);
        }
    }, [rightSegmentIndex]);

    const jumpToGlobalLine = useCallback((globalIndex: number, paneId: 'left' | 'right' = 'left', align: 'start' | 'center' | 'end' = 'center') => {
        const seg = Math.floor(globalIndex / MAX_SEGMENT_SIZE);
        const rel = globalIndex % MAX_SEGMENT_SIZE;

        if (paneId === 'left') {
            if (seg !== leftSegmentIndex) {
                setLeftSegmentIndex(seg);
                pendingJumpLineLeft.current = { index: rel, align };
            } else {
                leftViewerRef.current?.scrollToIndex(rel, { align });
            }
            setActiveLineIndexLeft(globalIndex);
            setSelectedIndicesLeft(new Set([globalIndex]));
        } else {
            if (seg !== rightSegmentIndex) {
                setRightSegmentIndex(seg);
                pendingJumpLineRight.current = { index: rel, align };
            } else {
                rightViewerRef.current?.scrollToIndex(rel, { align });
            }
            setActiveLineIndexRight(globalIndex);
            setSelectedIndicesRight(new Set([globalIndex]));
        }
    }, [leftSegmentIndex, rightSegmentIndex]);

    const findText = useCallback(async (text: string, direction: 'next' | 'prev', paneId: 'left' | 'right', startOffset?: number, isWrapRetry = false, silent = false) => {
        const worker = paneId === 'left' ? leftWorkerRef.current : rightWorkerRef.current;
        const viewer = paneId === 'left' ? leftViewerRef.current : rightViewerRef.current;
        const currentLineIdx = paneId === 'left' ? activeLineIndexLeft : activeLineIndexRight;
        const totalCount = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        const requestMap = paneId === 'left' ? leftPendingRequests : rightPendingRequests;
        if (!worker) return;

        let startIdx = currentLineIdx !== -1 ? currentLineIdx : (viewer?.getScrollTop() ? Math.floor(viewer.getScrollTop() / 24) : 0);
        if (startOffset !== undefined) startIdx = startOffset;

        const result: any = await new Promise((resolve) => {
            const reqId = Math.random().toString(36).substring(7);
            requestMap.current.set(reqId, resolve);
            worker.postMessage({
                type: 'FIND_HIGHLIGHT', // We reuse this message type as it just searches for a keyword
                payload: { keyword: text, startIndex: startIdx, direction },
                requestId: reqId
            });
        });

        if (result && result.foundIndex !== -1 && viewer) {
            // Use jumpToGlobalLine for correct navigation
            jumpToGlobalLine(result.foundIndex, paneId);

            const lineNumDisplay = result.originalLineNum ? result.originalLineNum : (result.foundIndex + 1);
            if (!silent) {
                if (isWrapRetry) showToast(`Found "${text}" at line ${lineNumDisplay} (Wrapped)`, 'success');
                else showToast(`Found "${text}" at line ${lineNumDisplay}`, 'success');
            }
        } else {
            // If not found and not already a retry, try wrapping
            if (!isWrapRetry && totalCount > 0) {
                const wrapStart = direction === 'next' ? -1 : totalCount;
                findText(text, direction, paneId, wrapStart, true, silent);
            } else {
                if (!silent) showToast(`"${text}" not found`, 'info');
            }
        }
    }, [activeLineIndexLeft, activeLineIndexRight, leftFilteredCount, rightFilteredCount, showToast]);

    const jumpToHighlight = useCallback(async (highlightIndex: number, paneId: 'left' | 'right') => {
        if (!currentConfig || !currentConfig.highlights || !currentConfig.highlights[highlightIndex]) return;

        const keyword = currentConfig.highlights[highlightIndex].keyword;
        // Reuse generic find
        findText(keyword, 'next', paneId, undefined, false, true);
    }, [currentConfig, findText]);

    // Segmentation Derived Values (Left)
    const leftTotalSegments = Math.ceil(leftFilteredCount / MAX_SEGMENT_SIZE) || 1;
    const leftCurrentSegmentLines = Math.min(MAX_SEGMENT_SIZE, Math.max(0, leftFilteredCount - (leftSegmentIndex * MAX_SEGMENT_SIZE)));

    // Segmentation Derived Values (Right)
    const rightTotalSegments = Math.ceil(rightFilteredCount / MAX_SEGMENT_SIZE) || 1;
    const rightCurrentSegmentLines = Math.min(MAX_SEGMENT_SIZE, Math.max(0, rightFilteredCount - (rightSegmentIndex * MAX_SEGMENT_SIZE)));

    // Reset segment index if out of bounds (Left)
    useEffect(() => {
        const maxSeg = Math.max(0, Math.ceil(leftFilteredCount / MAX_SEGMENT_SIZE) - 1);
        if (leftSegmentIndex > maxSeg) setLeftSegmentIndex(maxSeg);
    }, [leftFilteredCount, leftSegmentIndex]);

    // Reset segment index if out of bounds (Right)
    useEffect(() => {
        const maxSeg = Math.max(0, Math.ceil(rightFilteredCount / MAX_SEGMENT_SIZE) - 1);
        if (rightSegmentIndex > maxSeg) setRightSegmentIndex(maxSeg);
    }, [rightFilteredCount, rightSegmentIndex]);

    return {
        rules, onExportSettings,
        selectedRuleId, setSelectedRuleId,
        currentConfig,
        groupedRoots, collapsedRoots, setCollapsedRoots,
        updateCurrentRule, handleCreateRule, handleDeleteRule,
        handleToggleRoot,
        isDualView, setIsDualView, toggleDualView,
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, setConfigPanelWidth, handleConfigResizeStart,
        rawContextOpen, setRawContextOpen,
        rawContextHeight, handleRawContextResizeStart,
        rawContextTargetLine, rawContextSourcePane,
        isTizenModalOpen, setIsTizenModalOpen,
        isTizenQuickConnect, setIsTizenQuickConnect,
        fileInputRef, logFileInputRef,
        leftViewerRef, rightViewerRef, rawViewerRef,

        handleImportFile, handleLogFileSelect,
        handleTizenStreamStart, handleTizenDisconnect, tizenSocket,
        handleLineDoubleClickAction,
        leftFileName, leftWorkerReady, leftIndexingProgress, leftTotalLines, leftFilteredCount,
        activeLineIndexLeft, setActiveLineIndexLeft,
        selectedIndicesLeft, setSelectedIndicesLeft,
        handleLeftFileChange, handleLeftReset, requestLeftLines, requestLeftRawLines,
        rightFileName, rightWorkerReady, rightIndexingProgress, rightTotalLines, rightFilteredCount,
        activeLineIndexRight, setActiveLineIndexRight,
        selectedIndicesRight, setSelectedIndicesRight,
        leftBookmarks, rightBookmarks, toggleLeftBookmark, toggleRightBookmark,
        clearLeftBookmarks, clearRightBookmarks,
        handleRightFileChange, handleRightReset, requestRightLines, requestRightRawLines,
        handleCopyLogs, handleSaveLogs, jumpToHighlight, findText,
        requestBookmarkedLines,
        sendTizenCommand,
        hasEverConnected,
        handleClearLogs,
        jumpToGlobalLine, // Exported for LogSession usage
        handleLineClick, // Export helper for selection
        // Segmentation
        leftSegmentIndex, setLeftSegmentIndex, leftTotalSegments, leftCurrentSegmentLines,
        rightSegmentIndex, setRightSegmentIndex, rightTotalSegments, rightCurrentSegmentLines,
        // Refs & State for Shortcuts
        searchInputRef, isGoToLineModalOpen, setIsGoToLineModalOpen,
        logViewPreferences,
        updateLogViewPreferences,
        isLogging, setIsLogging,
        connectionMode,
        isSearchFocused, setIsSearchFocused, // ✅ Expose for layout logic
        quickFilter, // ✅ Export for TopBar
        setQuickFilter // ✅ Export for TopBar
    };
};
