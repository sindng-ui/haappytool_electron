import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse } from '../../types';
import JsonFormatter from '../JsonTools/JsonFormatter';

const { Copy, Search, Check, FileJson, AlignLeft } = Lucide;

interface ResponseViewerProps {
    response: PerfResponse | null;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
    const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');
    const [searchText, setSearchText] = useState('');
    const [copied, setCopied] = useState(false);
    const [parsedJson, setParsedJson] = useState<any>(null);
    const [isJson, setIsJson] = useState(false);

    useEffect(() => {
        if (response) {
            let json = null;
            let seemsJson = false;

            if (typeof response.data === 'object') {
                json = response.data;
                seemsJson = true;
            } else if (typeof response.data === 'string') {
                try {
                    const trimmed = response.data.trim();
                    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                        json = JSON.parse(response.data);
                        seemsJson = true;
                    }
                } catch { /* Not JSON */ }
            }

            setParsedJson(json);
            setIsJson(seemsJson);
            setViewMode(seemsJson ? 'pretty' : 'raw');
        } else {
            setParsedJson(null);
            setIsJson(false);
        }
    }, [response]);

    const handleCopy = () => {
        if (!response) return;
        const textToCopy = typeof response.data === 'object'
            ? JSON.stringify(response.data, null, 2)
            : String(response.data);

        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
            {/* Toolbar */}
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
                </div>

                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search response..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border-none rounded-md focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 text-slate-700 dark:text-slate-300 shadow-sm"
                    />
                </div>

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
                            expandLevel={2}
                            fontSize={12}
                        />
                    </div>
                ) : (
                    <textarea
                        readOnly
                        value={typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data)}
                        className="w-full h-full p-4 font-mono text-xs text-slate-800 dark:text-slate-300 resize-none focus:outline-none bg-transparent"
                    />
                )}
            </div>
        </div>
    );
};

export default ResponseViewer;
