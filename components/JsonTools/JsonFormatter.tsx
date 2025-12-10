import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

const { Trash2, AlignLeft, Minimize2, CheckCircle, AlertCircle, Copy, FileJson } = Lucide;

const JsonFormatter: React.FC = () => {
    const [input, setInput] = useState('');
    const [formatted, setFormatted] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [valid, setValid] = useState(false);

    const handleFormat = () => {
        if (!input.trim()) {
            setFormatted('');
            setValid(false);
            setError(null);
            return;
        }
        try {
            const obj = JSON.parse(input);
            setFormatted(JSON.stringify(obj, null, 2));
            setValid(true);
            setError(null);
        } catch (e: any) {
            setValid(false);
            setError(e.message);
            setFormatted('');
        }
    };

    const handleMinify = () => {
        if (!input.trim()) return;
        try {
            const obj = JSON.parse(input);
            setFormatted(JSON.stringify(obj));
            setValid(true);
            setError(null);
        } catch (e: any) {
            setValid(false);
            setError(e.message);
        }
    };

    const clearFormatter = () => {
        setInput('');
        setFormatted('');
        setError(null);
        setValid(false);
    };

    const highlightJson = (jsonStr: string) => {
        if (!jsonStr) return null;
        return jsonStr.split('\n').map((line, lineIdx) => {
            const keyMatch = line.match(/^(\s*)(".*?")(\s*:\s*)(.*)$/);
            if (keyMatch) {
                const [, indent, key, colon, value] = keyMatch;
                return (
                    <div key={lineIdx} className="whitespace-pre">
                        {indent}
                        <span className="text-indigo-400 font-bold">{key}</span>
                        <span className="text-slate-500">{colon}</span>
                        <span className={getValueClass(value)}>{value}</span>
                    </div>
                );
            }
            return <div key={lineIdx} className="whitespace-pre text-slate-400">{line}</div>;
        });
    };

    const getValueClass = (val: string) => {
        val = val.trim();
        if (val.startsWith('"')) return 'text-emerald-400';
        if (val === 'true' || val === 'false') return 'text-orange-400';
        if (val === 'null') return 'text-red-400';
        if (!isNaN(Number(val.replace(',', '')))) return 'text-blue-400';
        return 'text-slate-300';
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
                        <AlignLeft size={16} /> Beautify
                    </button>
                    <button onClick={handleMinify} className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-sm border border-slate-700 transition-colors flex items-center gap-2">
                        <Minimize2 size={16} /> Minify
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center text-slate-400 px-2">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        {valid ? <span className="text-green-500 flex items-center gap-1"><CheckCircle size={12} /> Valid JSON</span> :
                            error ? <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Invalid JSON</span> :
                                'Formatted Output'}
                    </span>
                    <button
                        onClick={() => {
                            if (formatted) {
                                navigator.clipboard.writeText(formatted);
                                alert("Copied!");
                            }
                        }}
                        disabled={!valid}
                        className="p-1 hover:text-indigo-400 transition-colors disabled:opacity-30"
                        title="Copy Result"
                    >
                        <Copy size={14} />
                    </button>
                </div>
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-sm overflow-auto custom-scrollbar relative shadow-inner">
                    {error ? (
                        <div className="text-red-400 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <strong>Error parsing JSON:</strong><br />
                            {error}
                        </div>
                    ) : formatted ? (
                        <div className="text-sm leading-6">
                            {highlightJson(formatted)}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <FileJson size={48} className="mb-4 opacity-50" />
                            <p>Ready to format</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JsonFormatter;
