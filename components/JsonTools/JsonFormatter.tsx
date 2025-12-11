import React, { useState, useEffect, useMemo } from 'react';
import * as Lucide from 'lucide-react';

const { Trash2, AlignLeft, Minimize2, CheckCircle, AlertCircle, Copy, FileJson, PlusSquare, MinusSquare, ChevronDown, ChevronRight } = Lucide;

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

const JsonFormatter: React.FC = () => {
    const [input, setInput] = useState('');
    const [parsedData, setParsedData] = useState<any>(null);
    const [formattedString, setFormattedString] = useState(''); // For Copy/Minify view
    const [error, setError] = useState<string | null>(null);
    const [valid, setValid] = useState(false);
    const [expandSignal, setExpandSignal] = useState(0); // 0=IDLE, 1=EXPAND, 2=COLLAPSE

    const [showToast, setShowToast] = useState(false);

    // ... (useEffect for expandSignal)

    // Hide toast after 2s
    useEffect(() => {
        if (showToast) {
            const t = setTimeout(() => setShowToast(false), 2000);
            return () => clearTimeout(t);
        }
    }, [showToast]);

    const copyToClipboard = (text: string) => {
        if (window.electronAPI?.copyToClipboard) {
            window.electronAPI.copyToClipboard(text);
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(console.error);
        }
        setShowToast(true);
    };

    const handleFormat = () => {
        if (!input.trim()) {
            setParsedData(null);
            setFormattedString('');
            setValid(false);
            setError(null);
            return;
        }
        try {
            const obj = JSON.parse(input);
            setParsedData(obj);
            // formattedString serves as the default copy text (Beautified)
            setFormattedString(JSON.stringify(obj, null, 2));
            setValid(true);
            setError(null);
            setExpandSignal(1); // Default expand all on new format
        } catch (e: any) {
            setValid(false);
            setParsedData(null);
            setError(e.message);
            setFormattedString('');
        }
    };

    const handleMinify = () => {
        if (!input.trim()) return;
        try {
            const obj = JSON.parse(input);
            const minified = JSON.stringify(obj);
            copyToClipboard(minified);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const clearFormatter = () => {
        setInput('');
        setParsedData(null);
        setFormattedString('');
        setError(null);
        setValid(false);
    };

    return (
        <div className="flex h-full gap-6">
            <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center text-slate-400 px-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Raw Input</span>
                    <div className="flex gap-2">
                        <button onClick={clearFormatter} className="p-1 hover:text-red-400 transition-colors" title="Clear">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                <textarea
                    className={`flex-1 bg-slate-900 rounded-2xl border p-4 font-mono text-sm text-slate-300 focus:outline-none focus:ring-1 resize-none shadow-inner custom-scrollbar ${error ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-800 focus:ring-indigo-500'}`}
                    placeholder="Paste your JSON here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    spellCheck={false}
                />
                <div className="flex gap-3 mt-2">
                    <button onClick={handleFormat} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                        <AlignLeft size={16} /> Beautify (Tree View)
                    </button>
                    <button onClick={handleMinify} className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-sm border border-slate-700 transition-colors flex items-center gap-2" title="Copy Minified to Clipboard">
                        <Minimize2 size={16} /> Minify (Copy)
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 relative">
                <div className="flex justify-between items-center text-slate-400 px-2">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        {valid ? <span className="text-green-500 flex items-center gap-1"><CheckCircle size={12} /> Valid JSON</span> :
                            error ? <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Invalid JSON</span> :
                                'Tree Output'}
                    </span>
                    <div className="flex items-center gap-2">
                        {valid && (
                            <>
                                <button onClick={() => setExpandSignal(1)} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-700 transition-colors mr-2">
                                    Expand All
                                </button>
                                <button onClick={() => setExpandSignal(2)} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-700 transition-colors mr-2">
                                    Collapse All
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => {
                                if (formattedString) {
                                    copyToClipboard(formattedString);
                                }
                            }}
                            disabled={!valid}
                            className="p-1 hover:text-indigo-400 transition-colors disabled:opacity-30"
                            title="Copy Formatted Result"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-sm overflow-auto custom-scrollbar relative shadow-inner">
                    {error ? (
                        <div className="text-red-400 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <strong>Error parsing JSON:</strong><br />
                            {error}
                        </div>
                    ) : parsedData ? (
                        <div className="text-sm leading-6">
                            <JsonNode
                                value={parsedData}
                                isLast={true}
                                level={0}
                                initialExpand={true}
                                expandSignal={expandSignal}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <FileJson size={48} className="mb-4 opacity-50" />
                            <p>Ready to format</p>
                        </div>
                    )}

                    {/* Toast Notification */}
                    <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-xl border border-slate-700 flex items-center gap-2 transition-all duration-300 pointer-events-none ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <CheckCircle size={16} className="text-emerald-400" />
                        <span className="text-xs font-bold">Copied to clipboard!</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JsonFormatter;
