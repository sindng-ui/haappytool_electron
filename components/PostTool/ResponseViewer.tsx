import React, { useState, useEffect, useRef } from 'react';
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

    // Raw Search
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const getRawContent = () => {
        if (!response) return '';
        return typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data);
    };

    const handleRawSearch = (direction: 'next' | 'prev') => {
        if (!textareaRef.current || !searchText) return;
        const content = textareaRef.current.value.toLowerCase();
        const query = searchText.toLowerCase();
        const currentPos = textareaRef.current.selectionStart;

        let index = -1;
        if (direction === 'next') {
            index = content.indexOf(query, currentPos + 1);
            if (index === -1) index = content.indexOf(query, 0); // Wrap
        } else {
            index = content.lastIndexOf(query, currentPos - 1);
            if (index === -1) index = content.lastIndexOf(query); // Wrap
        }

        if (index !== -1) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(index, index + query.length);

            // Calculate scroll position
            const textLines = content.substring(0, index).split('\n');
            const lineNum = textLines.length;
            const lineHeight = 16; // Approx line height for text-xs (12px) + padding
            // It's hard to be exact with textarea, but we can try to center it
            const scrollPos = (lineNum - 1) * lineHeight;

            // Basic scroll attempt (Blur/Focus trick usually works for native scroll-to-caret)
            textareaRef.current.blur();
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(index, index + query.length);
        }
    };



    // Preview Mode Search State
    const [previewMatches, setPreviewMatches] = useState<string[]>([]);
    const [previewMatchIndex, setPreviewMatchIndex] = useState(-1);

    // Collect Matches for Preview Mode
    useEffect(() => {
        if (viewMode === 'preview' && isJson && parsedJson && searchText) {
            const matches: string[] = [];
            const query = searchText.toLowerCase();

            const traverse = (data: any, path: string) => {
                if (typeof data === 'object' && data !== null) {
                    Object.keys(data).forEach(key => {
                        const newPath = path ? `${path}.${key}` : key;
                        // Check Key Match
                        if (key.toLowerCase().includes(query)) {
                            matches.push(newPath + ":key");
                        }
                        traverse(data[key], newPath);
                    });
                } else {
                    // Primitive Value
                    if (String(data).toLowerCase().includes(query)) {
                        matches.push(path + ":value");
                    }
                }
            };

            traverse(parsedJson, "");
            setPreviewMatches(matches);
            setPreviewMatchIndex(matches.length > 0 ? 0 : -1);
        } else {
            setPreviewMatches([]);
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (viewMode === 'raw') handleRawSearch('next');
            else if (viewMode === 'preview') handlePreviewNav('next');
            else if (viewMode === 'pretty') setTriggerNext(n => n + 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (viewMode === 'raw') handleRawSearch('next');
            else if (viewMode === 'preview') handlePreviewNav('next');
            else if (viewMode === 'pretty') setTriggerNext(n => n + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (viewMode === 'raw') handleRawSearch('prev');
            else if (viewMode === 'preview') handlePreviewNav('prev');
            else if (viewMode === 'pretty') setTriggerNext(n => n - 1);
        }
    };

    const [activeTab, setActiveTab] = useState<'BODY' | 'HEADERS'>('BODY');

    // Derived Headers List
    const headersList = response ? Object.entries(response.headers) : [];

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
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
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

                        {(viewMode === 'raw' || viewMode === 'preview') && searchText && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded px-1 h-6 gap-1 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                                {viewMode === 'preview' && previewMatches.length > 0 && (
                                    <span className="text-[10px] text-slate-500 px-1 font-mono">{previewMatchIndex + 1}/{previewMatches.length}</span>
                                )}
                                <button onClick={() => viewMode === 'raw' ? handleRawSearch('prev') : handlePreviewNav('prev')} className="p-0.5 hover:text-indigo-500 text-slate-500"><ArrowUp size={12} /></button>
                                <button onClick={() => viewMode === 'raw' ? handleRawSearch('next') : handlePreviewNav('next')} className="p-0.5 hover:text-indigo-500 text-slate-500"><ArrowDown size={12} /></button>
                            </div>
                        )}

                        <div className="relative flex-1 max-w-sm flex items-center gap-1">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
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

                        {(viewMode === 'raw' || viewMode === 'preview') && searchText && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded px-1 h-6 gap-1 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                                {viewMode === 'preview' && previewMatches.length > 0 && (
                                    <span className="text-[10px] text-slate-500 px-1 font-mono">{previewMatchIndex + 1}/{previewMatches.length}</span>
                                )}
                                <button onClick={() => viewMode === 'raw' ? handleRawSearch('prev') : handlePreviewNav('prev')} className="p-0.5 hover:text-indigo-500 text-slate-500"><ArrowUp size={12} /></button>
                                <button onClick={() => viewMode === 'raw' ? handleRawSearch('next') : handlePreviewNav('next')} className="p-0.5 hover:text-indigo-500 text-slate-500"><ArrowDown size={12} /></button>
                            </div>
                        )}

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
                                    srcDoc={typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}
                                    className="w-full h-full border-none bg-white"
                                    sandbox="allow-scripts"
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
