import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface FlattenedNode {
    id: string;
    key: string;
    value: any;
    level: number;
    isExpanded: boolean;
    hasChildren: boolean;
    parentKeyPath: string; // "key1.key2"
    path: string[];
}

const { Trash2, AlignLeft, Minimize2, CheckCircle, AlertCircle, Copy, FileJson, PlusSquare, MinusSquare, ChevronDown, ChevronRight, Search, ArrowUp, ArrowDown } = Lucide;
import { useToast } from '../../contexts/ToastContext';

// --- Helper Components ---

interface JsonNodeProps {
    keyName?: string;
    value: any;
    isLast: boolean;
    level: number;
    initialExpand: boolean;
    expandSignal: number; // 0=none, 1=expand, 2=collapse
}

const JsonNode: React.FC<JsonNodeProps> = ({ keyName, value, isLast, level, initialExpand, expandSignal }) => {
    const [expanded, setExpanded] = useState(initialExpand);

    useEffect(() => {
        if (expandSignal === 1) setExpanded(true);
        if (expandSignal === 2) setExpanded(false);
    }, [expandSignal]);

    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);
    const isEmpty = isObject && Object.keys(value).length === 0;

    const renderValue = (val: any) => {
        if (val === null) return <span className="text-red-400">null</span>;
        if (typeof val === 'string') return <span className="text-emerald-400">"{val}"</span>;
        if (typeof val === 'number') return <span className="text-blue-400">{val}</span>;
        if (typeof val === 'boolean') return <span className="text-orange-400">{val ? 'true' : 'false'}</span>;
        return <span className="text-slate-300">{String(val)}</span>;
    };

    if (isObject && !isEmpty) {
        const keys = Object.keys(value);
        return (
            <div className="font-mono text-sm leading-6">
                <div className="flex items-start hover:bg-slate-800/30 rounded px-1 transition-colors group">
                    <span className="w-4 mr-1 shrink-0 flex items-center justify-center cursor-pointer text-slate-500 hover:text-indigo-400 mt-1" onClick={() => setExpanded(!expanded)}>
                        {expanded ? <MinusSquare size={12} /> : <PlusSquare size={12} />}
                    </span>
                    <div className="flex-1 break-all">
                        {keyName && <span className="text-indigo-400 font-bold mr-1">"{keyName}":</span>}
                        <span className="text-slate-400">{isArray ? '[' : '{'}</span>
                        {!expanded && (
                            <span className="text-slate-500 italic text-xs mx-1 cursor-pointer select-none" onClick={() => setExpanded(true)}>
                                {isArray ? `${keys.length} items` : `${keys.length} keys`}
                            </span>
                        )}
                        {!expanded && <span className="text-slate-400">{isArray ? ']' : '}'}</span>}
                        {!expanded && !isLast && <span className="text-slate-500">,</span>}
                    </div>
                </div>
                {expanded && (
                    <div style={{ paddingLeft: '1.5rem' }}>
                        {keys.map((key, idx) => (
                            <JsonNode
                                key={key}
                                keyName={isArray ? undefined : key} // Arrays don't show index keys usually
                                value={value[key]}
                                isLast={idx === keys.length - 1}
                                level={level + 1}
                                initialExpand={initialExpand}
                                expandSignal={expandSignal}
                            />
                        ))}
                    </div>
                )}
                {expanded && (
                    <div className="pl-[1.5rem]">
                        <span className="text-slate-400">{isArray ? ']' : '}'}</span>
                        {!isLast && <span className="text-slate-500">,</span>}
                    </div>
                )}
            </div>
        );
    }

    // Primitive or Empty
    return (
        <div className="font-mono text-sm leading-6 flex hover:bg-slate-800/30 rounded px-1 group transition-colors">
            <span className="w-4 mr-1 shrink-0"></span> {/* Spacer for align */}
            <div className="break-all">
                {keyName && <span className="text-indigo-400 font-bold mr-1">"{keyName}":</span>}
                {isObject ? (
                    // Empty Object/Array
                    <span className="text-slate-500">{isArray ? '[]' : '{}'}</span>
                ) : (
                    renderValue(value)
                )}
                {!isLast && <span className="text-slate-500">,</span>}
            </div>
        </div>
    );
};


// --- Main Formatter Component ---

// Local Flattening Removed - Moved to Worker


interface JsonFormatterProps {
    data?: any;
    search?: string;
    expandLevel?: number; // Not used yet but requested
    fontSize?: number; // Not used yet
    triggerNext?: number; // Increment to trigger next result
    triggerPrev?: number; // Increment to trigger prev result
    onMatchStatus?: (index: number, count: number) => void;
}

// --- Flattened Row Component ---

interface JsonFormatterRowProps {
    index: number;
    item: FlattenedNode;
    isMatch: boolean;
    toggleExpand: (id: string) => void;
    copyToClipboard: (text: string) => void;
}

const JsonFormatterRow = React.memo(({ index, item, isMatch, toggleExpand, copyToClipboard }: JsonFormatterRowProps) => {
    const { key, value, level, isExpanded, hasChildren, id } = item;
    const isArray = Array.isArray(value);
    const indent = level * 20;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = JSON.stringify(value, null, 2);
        copyToClipboard(text);
    };

    return (
        <div className={`font-mono text-sm leading-6 flex items-center pr-2 whitespace-nowrap h-7 transition-colors group ${isMatch ? 'bg-indigo-500/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
            <div style={{ width: indent, flexShrink: 0 }}></div>

            <span
                className="w-5 h-5 flex items-center justify-center cursor-pointer text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 mr-1 shrink-0 select-none transition-colors"
                onClick={() => hasChildren && toggleExpand(id)}
            >
                {hasChildren ? (
                    isExpanded ? <MinusSquare size={13} /> : <PlusSquare size={13} />
                ) : (
                    <span className="w-3"></span>
                )}
            </span>

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={isMatch ? "text-indigo-600 dark:text-indigo-300 font-bold" : "text-indigo-600 dark:text-indigo-400 font-bold"}>"{key}":</span>

                {hasChildren ? (
                    <>
                        <span className="text-slate-500 dark:text-slate-400 font-bold">{isArray ? '[' : '{'}</span>
                        {!isExpanded && (
                            <span className="text-slate-500 italic text-xs mx-1 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleExpand(id)}>
                                {isArray ? `${value.length} items` : `${Object.keys(value).length} keys`}
                            </span>
                        )}
                        {!isExpanded && <span className="text-slate-500 dark:text-slate-400 font-bold">{isArray ? ']' : '}'}</span>}
                    </>
                ) : (
                    <span className="break-all text-ellipsis overflow-hidden">
                        {value === null ? <span className="text-red-500 dark:text-red-400 font-bold">null</span> :
                            typeof value === 'string' ? <span className="text-emerald-600 dark:text-emerald-400">"{value}"</span> :
                                typeof value === 'number' ? <span className="text-blue-600 dark:text-blue-400 font-medium">{value}</span> :
                                    typeof value === 'boolean' ? <span className="text-orange-600 dark:text-orange-400 font-bold">{String(value)}</span> :
                                        <span className="text-slate-500 dark:text-slate-300">{String(value)}</span>
                        }
                    </span>
                )}
                <span className="text-slate-400 dark:text-slate-500">,</span>
            </div>

            {/* Copy Button (Visible on Group Hover) */}
            <button
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-all ml-2"
                title="Copy Subtree JSON"
            >
                <Copy size={12} />
            </button>
        </div>
    );
});
JsonFormatterRow.displayName = 'JsonFormatterRow';

const JsonFormatter: React.FC<JsonFormatterProps> = ({ data, search, triggerNext, triggerPrev, onMatchStatus }) => {
    const [input, setInput] = useState('');
    const [parsedData, setParsedData] = useState<any>(null);
    const [formattedString, setFormattedString] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [valid, setValid] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Determines if we are in "Viewer Mode" (controlled via props) or "Tool Mode" (standalone)
    const isViewerMode = data !== undefined;

    // Toast
    const { addToast } = useToast();

    // Virtualization State
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [flattenedItems, setFlattenedItems] = useState<FlattenedNode[]>([]);

    const workerRef = React.useRef<Worker | null>(null);
    const searchWorkerRef = React.useRef<Worker | null>(null);
    const virtuosoRef = React.useRef<VirtuosoHandle>(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);

    // Watch for external trigger Next
    useEffect(() => {
        if (data !== undefined && searchQuery && searchResults.length > 0) {
            nextResult();
        }
    }, [triggerNext]);

    // Watch for external trigger Prev
    useEffect(() => {
        if (data !== undefined && searchQuery && searchResults.length > 0) {
            prevResult();
        }
    }, [triggerPrev]);

    // Notify Parent of Match Status
    useEffect(() => {
        if (onMatchStatus) {
            onMatchStatus(currentResultIndex, searchResults.length);
        }
    }, [currentResultIndex, searchResults.length, onMatchStatus]);

    // Sync Search Prop
    useEffect(() => {
        if (search !== undefined) {
            setSearchQuery(search);
        }
    }, [search]);

    // Trigger search when query changes (debounce handled by user typing speed usually, or we can debounce here)
    useEffect(() => {
        if (isViewerMode && searchQuery && parsedData) {
            // Check if we have formatted string to search in? 
            // In ViewerMode, we might not have formattedString unless we generate it. 
            // SearchWorker expects text. 
            // Let's generate string for search if missing.
            const textToSearch = JSON.stringify(parsedData);
            // This is simple JSON.stringify. formattedString usually is pertty. 
            // Worker searches using simple string matching or regex? 
            // Let's check `handleSearch`. It sends `text` and `query`. 

            // We need to trigger search. 
            handleSearch(textToSearch);
        } else if (!searchQuery) {
            setSearchResults([]);
            setCurrentResultIndex(-1);
        }
    }, [searchQuery, parsedData, isViewerMode]);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../../workers/JsonParser.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (e) => {
            const { type, payload, error: errMsg, requestId } = e.data;
            setIsProcessing(false);

            if (type === 'ERROR') {
                setError(errMsg);
                setValid(false);
                setParsedData(null);
                setFormattedString('');
                setFlattenedItems([]);
            } else if (type === 'SUCCESS') {
                if (requestId === 'format') {
                    setParsedData(payload.data);
                    setFormattedString(payload.formatted);
                    setValid(true);
                    setError(null);

                    // Initial Expand: Level 1
                    const initialPaths = new Set<string>();
                    setExpandedPaths(initialPaths);

                    // Trigger calc via worker
                    // Note: 'payload.data' is already cached in parsing flow, but let's be explicit if needed.
                    // Actually PARSE_AND_FORMAT updates cache.
                    workerRef.current?.postMessage({
                        type: 'FLATTEN',
                        payload: { expandedPaths: Array.from(initialPaths) }
                    });

                    setSearchResults([]);
                    setCurrentResultIndex(-1);

                } else if (requestId === 'minify') {
                    copyToClipboard(payload);
                }
            } else if (type === 'SET_DATA_SUCCESS') {
                // Data set, request initial flatten
                const initialPaths = new Set<string>();
                setExpandedPaths(initialPaths);
                workerRef.current?.postMessage({
                    type: 'FLATTEN',
                    payload: { expandedPaths: [] }
                });
            } else if (type === 'FLATTEN_SUCCESS') {
                setFlattenedItems(payload); // payload is FlattenedNode[]
            }
        };

        searchWorkerRef.current = new Worker(new URL('../../workers/Search.worker.ts', import.meta.url), { type: 'module' });
        searchWorkerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;
            setIsSearching(false);
            if (type === 'SEARCH_COMPLETE') {
                setSearchResults(payload); // payload is string[] of paths
                if (payload.length > 0) {
                    setCurrentResultIndex(0);
                    jumpToResult(payload[0]);
                } else {
                    setCurrentResultIndex(-1);
                }
            }
        };

        return () => {
            workerRef.current?.terminate();
            searchWorkerRef.current?.terminate();
        };
    }, []);

    // Handle Data Prop Change (Viewer Mode)
    useEffect(() => {
        if (data !== undefined) {
            setParsedData(data);
            setValid(true);
            setError(null);

            // Send data to worker
            workerRef.current?.postMessage({
                type: 'SET_DATA',
                payload: data
            });
        }
    }, [data]);


    const toggleExpand = (pathStr: string) => {
        const newSet = new Set(expandedPaths);
        if (newSet.has(pathStr)) {
            newSet.delete(pathStr);
        } else {
            newSet.add(pathStr);
        }
        setExpandedPaths(newSet);

        workerRef.current?.postMessage({
            type: 'FLATTEN',
            payload: { expandedPaths: Array.from(newSet) }
        });
    };

    // Batch Expand/Collapse
    const expandAll = () => {
        // Recursive expansion needs data access. 
        // Only worker has data now efficiently or we use parsedData?
        // We have parsedData locally too.
        if (!parsedData) return;
        const newSet = new Set<string>();
        const traverseAdd = (node: any, path: string[], depth: number) => {
            if (depth > 5) return; // Safety Limit
            if (node && typeof node === 'object') {
                Object.keys(node).forEach(key => {
                    const p = [...path, key];
                    const ps = p.join('.');
                    newSet.add(ps);
                    traverseAdd(node[key], p, depth + 1);
                });
            }
        };
        traverseAdd(parsedData, [], 0);
        setExpandedPaths(newSet);

        workerRef.current?.postMessage({
            type: 'FLATTEN',
            payload: { expandedPaths: Array.from(newSet) }
        });
    };

    const collapseAll = () => {
        setExpandedPaths(new Set());
        workerRef.current?.postMessage({
            type: 'FLATTEN',
            payload: { expandedPaths: [] }
        });
    };

    const copyToClipboard = (text: string) => {
        if (window.electronAPI?.copyToClipboard) {
            window.electronAPI.copyToClipboard(text);
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(console.error);
        }
        addToast("Copied to clipboard!", "success");
    };

    const handleFormat = () => {
        if (!input.trim()) return;
        setIsProcessing(true);
        setError(null);
        workerRef.current?.postMessage({
            type: 'PARSE_AND_FORMAT',
            payload: { text: input, mode: 'format' },
            requestId: 'format'
        });
    };

    const handleMinify = () => {
        if (!input.trim()) return;
        setIsProcessing(true);
        workerRef.current?.postMessage({
            type: 'PARSE_AND_FORMAT',
            payload: { text: input, mode: 'minify' },
            requestId: 'minify'
        });
    };

    const clearFormatter = () => {
        setInput('');
        setParsedData(null);
        setFormattedString('');
        setError(null);
        setValid(false);
        setFlattenedItems([]);
        setSearchResults([]);
        setCurrentResultIndex(-1);
        setSearchQuery('');
    };

    const handleSearch = (overrideText?: string) => {
        const text = overrideText || formattedString || input;
        if (!searchQuery || !text) return;

        setIsSearching(true);
        searchWorkerRef.current?.postMessage({
            type: 'SEARCH_JSON',
            payload: { text: text, query: searchQuery, caseSensitive: false }
        });
    };

    const pendingJumpRef = useRef<string | null>(null);

    // Scroll to pending jump target when items update
    useEffect(() => {
        if (pendingJumpRef.current && flattenedItems.length > 0) {
            const index = flattenedItems.findIndex(item => item.id === pendingJumpRef.current);
            if (index !== -1 && virtuosoRef.current) {
                virtuosoRef.current.scrollToIndex({ index, align: 'center' });
                pendingJumpRef.current = null;
            }
        }
    }, [flattenedItems]);

    const jumpToResult = (pathStr: string) => {
        const parts = pathStr.split('.');
        if (parts.length === 0) return;

        const newSet = new Set(expandedPaths);
        let currentPath = '';
        let changed = false;

        for (let i = 0; i < parts.length - 1; i++) {
            currentPath = i === 0 ? parts[0] : `${currentPath}.${parts[i]}`;
            if (!newSet.has(currentPath)) {
                newSet.add(currentPath);
                changed = true;
            }
        }

        if (changed) {
            setExpandedPaths(newSet);
            // Request Flatten logic from worker
            pendingJumpRef.current = pathStr;
            workerRef.current?.postMessage({
                type: 'FLATTEN',
                payload: { expandedPaths: Array.from(newSet) }
            });
        } else {
            const index = flattenedItems.findIndex(item => item.id === pathStr);
            if (index !== -1 && virtuosoRef.current) {
                virtuosoRef.current.scrollToIndex({ index, align: 'center' });
            }
        }
    };

    const nextResult = () => {
        if (searchResults.length === 0) return;
        const next = (currentResultIndex + 1) % searchResults.length;
        setCurrentResultIndex(next);
        jumpToResult(searchResults[next]);
    };

    const prevResult = () => {
        if (searchResults.length === 0) return;
        const prev = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentResultIndex(prev);
        jumpToResult(searchResults[prev]);
    };

    // Row Renderer logic is now extracted to JsonFormatterRow component
    // We pass the component to Virtuoso's itemContent prop


    return (
        <div className="flex h-full gap-6">
            {!isViewerMode && (
                <div className="flex-1 flex flex-col gap-2">
                    {/* ... Input Column (Only in Tool Mode) ... */}
                    <div className="flex justify-between items-center text-slate-500 font-medium px-2 shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider">Raw Input</span>
                        <button onClick={clearFormatter} className="p-1 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Clear">
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <div className="relative flex-1 flex flex-col min-h-0">
                        <textarea
                            className={`flex-1 bg-white dark:bg-slate-900 rounded-2xl border p-4 font-mono text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 resize-none shadow-sm custom-scrollbar transition-all ${error ? 'border-red-500/50 focus:ring-red-500/50' : 'border-slate-200 dark:border-white/10 focus:ring-indigo-500/50'}`}
                            placeholder="Paste JSON here (Large files supported)..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            spellCheck={false}
                            disabled={isProcessing}
                        />
                        {isProcessing && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-center">
                                <Lucide.Loader2 className="animate-spin text-indigo-500" size={32} />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 mt-2 shrink-0">
                        <button onClick={handleFormat} disabled={isProcessing} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 border-2 border-transparent">
                            <AlignLeft size={16} /> Beautify (Virtual Tree)
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col gap-2 relative min-h-0">
                {!isViewerMode && (
                    <div className="flex justify-between items-center text-slate-500 font-medium px-2 shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            {valid ? <span className="text-emerald-600 dark:text-emerald-500 flex items-center gap-1"><CheckCircle size={12} /> Valid JSON ({flattenedItems.length} nodes)</span> :
                                error ? <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Invalid JSON</span> :
                                    'Tree Output'}
                        </span>
                        <div className="flex items-center gap-2">
                            {valid && (
                                <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 mr-2 h-7 shadow-sm">
                                    <Search size={14} className="text-slate-400 ml-2" />
                                    <input
                                        className="bg-transparent border-none text-xs text-slate-700 dark:text-slate-300 w-32 px-2 focus:outline-none placeholder-slate-400"
                                        placeholder="Search key/val..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                                    />
                                    {searchResults.length > 0 && (
                                        <div className="flex items-center border-l border-slate-200 dark:border-slate-800 px-1">
                                            <span className="text-[10px] text-slate-400 mr-1 font-mono">{currentResultIndex + 1}/{searchResults.length}</span>
                                            <button onClick={prevResult} className="p-0.5 hover:text-indigo-400 text-slate-400"><ArrowUp size={12} /></button>
                                            <button onClick={nextResult} className="p-0.5 hover:text-indigo-400 text-slate-400"><ArrowDown size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* ... Controls for Tool Mode ... */}
                        </div>
                    </div>
                )}

                {/* Simplified Controls for Viewer Mode (if needed, or assume parent handles search UI) */}
                {isViewerMode && (
                    <div className="flex justify-end gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            {/* Internal Search Display Removed - Managed by Parent */}
                            <button onClick={expandAll} className="text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-500 transition-colors">Expand All</button>
                            <button onClick={collapseAll} className="text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-500 transition-colors">Collapse All</button>
                        </div>
                    </div>
                )}


                <div className={`flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-2 font-mono text-sm relative shadow-sm overflow-hidden ${isViewerMode ? 'border-none rounded-none bg-transparent' : ''}`}>
                    {error ? (
                        <div className="text-red-500 dark:text-red-400 p-4 overflow-auto h-full">
                            <strong>Error parsing JSON:</strong><br />
                            {error}
                        </div>
                    ) : parsedData ? (
                        <div className="h-full w-full bg-slate-50 dark:bg-transparent rounded-xl">
                            <Virtuoso
                                ref={virtuosoRef}
                                style={{ height: '100%', width: '100%' }}
                                totalCount={flattenedItems.length}
                                itemContent={(index) => {
                                    const item = flattenedItems[index];
                                    if (!item) return null;
                                    const isMatch = currentResultIndex >= 0 && searchResults[currentResultIndex] === item.id;
                                    return (
                                        <JsonFormatterRow
                                            index={index}
                                            item={item}
                                            isMatch={isMatch}
                                            toggleExpand={toggleExpand}
                                            copyToClipboard={copyToClipboard}
                                        />
                                    );
                                }}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                            {/* Empty State */}
                            <p>No Data</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JsonFormatter;
