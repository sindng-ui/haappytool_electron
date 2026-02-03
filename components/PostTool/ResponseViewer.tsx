import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse } from '../../types';
import JsonFormatter from '../JsonTools/JsonFormatter';
import JsonTableViewer from './JsonTableViewer';

const { Copy, Search, Check, FileJson, AlignLeft, Eye, ArrowUp, ArrowDown } = Lucide;

interface ResponseViewerProps {
    response: PerfResponse | null;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
    const [viewMode, setViewMode] = useState<'pretty' | 'raw' | 'preview'>('raw');
    const [searchText, setSearchText] = useState('');
    const [copied, setCopied] = useState(false);
    const [parsedJson, setParsedJson] = useState<any>(null);
    const [isJson, setIsJson] = useState(false);

    const [triggerNext, setTriggerNext] = useState(0);
    const [triggerPrev, setTriggerPrev] = useState(0);

    // Search Status State
    const [prettyMatchStatus, setPrettyMatchStatus] = useState({ index: -1, count: 0 });
    const [rawMatches, setRawMatches] = useState<number[]>([]);
    const [currentRawIndex, setCurrentRawIndex] = useState(-1);

    // Raw Search Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (response) {
            let seemsJson = false;
            // Shallow check for JSON to enable buttons without parsing
            if (typeof response.data === 'object') {
                seemsJson = true;
            } else if (typeof response.data === 'string') {
                const trimmed = response.data.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    seemsJson = true;
                }
            }

            // Reset state on new response
            setParsedJson(null);
            setIsJson(seemsJson);
            setViewMode('raw');
            setSearchText('');
            setTriggerNext(0);
            setTriggerPrev(0);
            setPrettyMatchStatus({ index: -1, count: 0 });
        } else {
            setParsedJson(null);
            setIsJson(false);
        }
    }, [response]);

    // Lazy Parse Effect
    useEffect(() => {
        if (viewMode !== 'raw' && !parsedJson && response) {
            if (typeof response.data === 'object') {
                setParsedJson(response.data);
            } else if (typeof response.data === 'string' && isJson) {
                try {
                    const parsed = JSON.parse(response.data);
                    setParsedJson(parsed);
                } catch (e) {
                    console.error("Failed to lazy parse JSON", e);
                }
            }
        }
    }, [viewMode, response, isJson, parsedJson]);

    const handleCopy = () => {
        if (!response) return;
        const textToCopy = typeof response.data === 'object'
            ? JSON.stringify(response.data, null, 2)
            : String(response.data);

        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getRawContent = useCallback(() => {
        if (!response) return '';
        return typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data);
    }, [response]);

    // --- Raw Mode Search Logic ---
    useEffect(() => {
        if (viewMode !== 'raw' || !searchText) {
            setRawMatches([]);
            setCurrentRawIndex(-1);
            return;
        }

        const content = getRawContent().toLowerCase();
        const query = searchText.toLowerCase();
        const matches: number[] = [];
        let pos = content.indexOf(query);
        while (pos !== -1) {
            matches.push(pos);
            pos = content.indexOf(query, pos + 1);
        }
        setRawMatches(matches);
        if (matches.length > 0) {
            // Find match closest to current selection? Or just reset?
            // Resetting is safer for explicit search behavior
            setCurrentRawIndex(-1);
        } else {
            setCurrentRawIndex(-1);
        }
    }, [viewMode, searchText, getRawContent]);

    const handleRawSearch = (direction: 'next' | 'prev') => {
        if (!textareaRef.current || rawMatches.length === 0) return;

        let nextIndex: number;
        if (direction === 'next') {
            // When -1, goes to 0 (first). When at end, wraps to 0.
            nextIndex = (currentRawIndex + 1) % rawMatches.length;
        } else {
            // When -1, goes to last. When at 0, wraps to last.
            nextIndex = currentRawIndex <= 0 ? rawMatches.length - 1 : currentRawIndex - 1;
        }

        setCurrentRawIndex(nextIndex);

        const matchPos = rawMatches[nextIndex];
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(matchPos, matchPos + searchText.length);

        // Restore focus to input for consecutive searches
        setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    const handleIframeSearch = (direction: 'next' | 'prev') => {
        if (!iframeRef.current || !iframeRef.current.contentWindow) return;
        const win = iframeRef.current.contentWindow as any;
        if (win.find) {
            win.find(searchText, false, direction === 'prev', true, false, true, false);
        }
    };


    // Preview Mode Search State
    const [previewMatches, setPreviewMatches] = useState<string[]>([]);
    const [previewMatchIndex, setPreviewMatchIndex] = useState(-1);

    // Optimization: Pre-calculated sets to avoid recursion in render
    const [matchedPaths, setMatchedPaths] = useState<Set<string>>(new Set());
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

    // Collect Matches for Preview Mode (Debounced)
    useEffect(() => {
        if (viewMode === 'preview' && isJson && parsedJson && searchText) {
            const timer = setTimeout(() => {
                const matches: string[] = [];
                const newMatchedPaths = new Set<string>();
                const newExpandedPaths = new Set<string>();
                const query = searchText.toLowerCase();

                // Returns true if this branch has a match
                const traverse = (data: any, path: string): boolean => {
                    let hasChildMatch = false;

                    if (typeof data === 'object' && data !== null) {
                        Object.keys(data).forEach(key => {
                            const newPath = path ? `${path}.${key}` : key;

                            // Check Key Match
                            let keyMatch = false;
                            if (key.toLowerCase().includes(query)) {
                                matches.push(newPath + ":key");
                                newMatchedPaths.add(newPath + ":key");
                                keyMatch = true;
                            }

                            // Recurse
                            const childHadMatch = traverse(data[key], newPath);

                            if (keyMatch || childHadMatch) {
                                hasChildMatch = true;
                                // Expand this node (parent of key/value)
                                if (path) newExpandedPaths.add(path);
                                else newExpandedPaths.add("ROOT"); // Special marker for root if needed
                            }
                        });
                    } else {
                        // Primitive Value
                        if (String(data).toLowerCase().includes(query)) {
                            matches.push(path + ":value");
                            newMatchedPaths.add(path + ":value");
                            return true;
                        }
                    }
                    return hasChildMatch;
                };

                const rootHasMatch = traverse(parsedJson, "");
                if (rootHasMatch) newExpandedPaths.add("ROOT");

                setPreviewMatches(matches);
                setMatchedPaths(newMatchedPaths);
                setExpandedPaths(newExpandedPaths);
                setPreviewMatchIndex(matches.length > 0 ? 0 : -1);
            }, 300); // 300ms Debounce

            return () => clearTimeout(timer);
        } else {
            setPreviewMatches([]);
            setMatchedPaths(new Set());
            setExpandedPaths(new Set());
            setPreviewMatchIndex(-1);
        }
    }, [viewMode, isJson, parsedJson, searchText]);

    const handlePreviewNav = (direction: 'next' | 'prev') => {
        if (previewMatches.length === 0) return;
        setPreviewMatchIndex(prev => {
            if (direction === 'next') {
                return (prev + 1) % previewMatches.length;
            } else {
                return (prev - 1 + previewMatches.length) % previewMatches.length;
            }
        });
    };

    const handleSearchNav = (direction: 'next' | 'prev') => {
        if (viewMode === 'raw') handleRawSearch(direction);
        else if (viewMode === 'preview') {
            if (isJson) handlePreviewNav(direction);
            else handleIframeSearch(direction);
        }
        else if (viewMode === 'pretty') {
            if (direction === 'next') setTriggerNext(n => n + 1);
            else setTriggerPrev(n => n + 1);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) handleSearchNav('prev');
            else handleSearchNav('next');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleSearchNav('next');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleSearchNav('prev');
        }
    };

    const [activeTab, setActiveTab] = useState<'BODY' | 'HEADERS'>('BODY');

    // Derived Headers List
    const headersList = response ? Object.entries(response.headers) : [];

    // Unified Match Info
    let matchDisplay = null;
    if (searchText) {
        let current = 0;
        let total = 0;
        let navEnabled = false;

        if (viewMode === 'raw') {
            total = rawMatches.length;
            current = currentRawIndex;
            navEnabled = total > 0;
        } else if (viewMode === 'preview' && isJson) {
            total = previewMatches.length;
            current = previewMatchIndex;
            navEnabled = total > 0;
        } else if (viewMode === 'pretty') {
            total = prettyMatchStatus.count;
            current = prettyMatchStatus.index;
            navEnabled = total > 0;
        }

        if (total > 0) {
            matchDisplay = (
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded px-1 h-6 gap-1 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200 ml-1">
                    <span className="text-[10px] text-slate-500 px-1 font-mono">{current + 1}/{total}</span>
                    <button onClick={() => handleSearchNav('prev')} className="p-0.5 hover:text-indigo-500 text-slate-500"><ArrowUp size={12} /></button>
                    <button onClick={() => handleSearchNav('next')} className="p-0.5 hover:text-indigo-500 text-slate-500"><ArrowDown size={12} /></button>
                </div>
            );
        } else if (searchText.length > 2) {
            matchDisplay = (
                <div className="flex items-center px-2 h-6 animate-in fade-in zoom-in duration-200">
                    <span className="text-[10px] text-slate-400 font-mono">No matches</span>
                </div>
            );
        }
    }

    const handlePrettyMatchStatus = useCallback((index: number, count: number) => {
        setPrettyMatchStatus(prev => {
            if (prev.index === index && prev.count === count) return prev;
            return { index, count };
        });
    }, []);

    if (!response) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <Lucide.Send size={48} className="mb-4 opacity-50" />
                <p className="text-sm font-medium">Send a request to see the response here</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Error Banner */}
            {response.status === 0 && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 text-red-500 text-xs font-bold animate-in slide-in-from-top-2 duration-200">
                    <Lucide.AlertCircle size={14} />
                    <span>Error: {typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}</span>
                </div>
            )}

            {/* Main Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-900 px-4 gap-6 text-xs font-bold text-slate-500 dark:text-slate-500 shrink-0">
                <button
                    onClick={() => setActiveTab('BODY')}
                    className={`py-2 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'BODY' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Body
                </button>
                <button
                    onClick={() => setActiveTab('HEADERS')}
                    className={`py-2 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'HEADERS' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Headers <span className="bg-slate-200 dark:bg-slate-800 px-1.5 rounded-full text-[10px] text-slate-600 dark:text-slate-400">{headersList.length}</span>
                </button>
            </div>

            {activeTab === 'BODY' ? (
                <>
                    {/* Toolbar (Only for Body) */}
                    <div className="h-9 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex items-center px-2 gap-2 shrink-0">
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 flex text-xs font-bold">
                            <button
                                onClick={() => setViewMode('pretty')}
                                disabled={!isJson}
                                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'pretty'
                                    ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                            >
                                <FileJson size={14} /> Pretty
                            </button>
                            <button
                                onClick={() => setViewMode('raw')}
                                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'raw'
                                    ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                <AlignLeft size={14} /> Raw
                            </button>
                            <button
                                onClick={() => setViewMode('preview')}
                                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'preview'
                                    ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                <Eye size={14} /> Preview
                            </button>
                        </div>

                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                        <div className="relative flex-1 max-w-sm flex items-center gap-1">
                            <div className="relative flex-1 flex items-center">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={viewMode === 'pretty' ? "Search JSON..." : "Search text..."}
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={false}
                                    className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border-none rounded-md focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 text-slate-700 dark:text-slate-300 shadow-sm disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {matchDisplay}

                        <div className="ml-auto flex items-center gap-1">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-500 transition-colors"
                                title="Copy to Clipboard"
                            >
                                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 relative overflow-hidden">
                        {viewMode === 'pretty' && isJson ? (
                            <div className="absolute inset-0 overflow-hidden">
                                <JsonFormatter
                                    data={parsedJson}
                                    search={searchText}
                                    triggerNext={triggerNext}
                                    triggerPrev={triggerPrev}
                                    onMatchStatus={handlePrettyMatchStatus}
                                    expandLevel={2}
                                    fontSize={12}
                                />
                            </div>
                        ) : viewMode === 'preview' ? (
                            isJson ? (
                                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                                    <JsonTableViewer
                                        data={parsedJson}
                                        isRoot={true}
                                        search={searchText}
                                        activeMatch={previewMatches[previewMatchIndex]}
                                    />
                                </div>
                            ) : (
                                <iframe
                                    ref={iframeRef}
                                    srcDoc={typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}
                                    className="w-full h-full border-none bg-white"
                                    sandbox="allow-scripts allow-popups allow-modals allow-same-origin"
                                />
                            )
                        ) : (
                            <textarea
                                ref={textareaRef}
                                readOnly
                                value={getRawContent()}
                                className="w-full h-full p-4 font-mono text-xs text-slate-800 dark:text-slate-300 resize-none focus:outline-none bg-transparent"
                            />
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-0 relative">
                    <div className="w-full text-xs text-left">
                        {headersList.map(([key, value], i) => (
                            <HeaderRow key={i} name={key} value={value} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface HeaderRowProps {
    name: string;
    value: string;
}

const HeaderRow = React.memo(({ name, value }: HeaderRowProps) => (
    <div className="flex border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
        <div className="w-1/3 min-w-[150px] p-2 font-bold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-white/5 shrink-0 select-text truncate" title={name}>
            {name}
        </div>
        <div className="flex-1 p-2 font-mono text-slate-800 dark:text-slate-200 select-text break-all">
            {value}
        </div>
    </div>
));

export default ResponseViewer;
