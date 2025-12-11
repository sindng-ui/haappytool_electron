import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse } from '../../types';

const { Clock, Activity, Copy, FileDown, CheckCircle } = Lucide;

interface ResponseViewerProps {
    response: PerfResponse | null;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    const getResponseString = () => {
        if (!response) return '';
        return typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data, null, 2);
    };

    const handleCopy = () => {
        const text = getResponseString();
        if (!text) return;
        navigator.clipboard.writeText(text);
        setShowToast(true);
    };

    const handleExport = async () => {
        const text = getResponseString();
        if (!text) return;

        const filename = `response_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;

        // Try Electron Save first
        // @ts-ignore
        if (window.electronAPI && window.electronAPI.saveTextFile) {
            try {
                // @ts-ignore
                await window.electronAPI.saveTextFile(text, filename);
                return;
            } catch (e) {
                console.error("Electron save failed", e);
            }
        }

        // Fallback
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900 relative">
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-800/30 shrink-0 h-10">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Response</span>
                {response && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-mono mr-2">
                            <span className={response.status >= 200 && response.status < 300 ? "text-green-400" : "text-red-400"}>
                                {response.status} {response.statusText}
                            </span>
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-400 flex items-center gap-1">
                                <Clock size={12} /> {response.timeTaken}ms
                            </span>
                        </div>
                        <div className="h-4 w-px bg-slate-700 mx-1"></div>
                        <button
                            onClick={handleCopy}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-colors"
                            title="Copy to Clipboard"
                        >
                            <Copy size={14} />
                        </button>
                        <button
                            onClick={handleExport}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-colors"
                            title="Export to File"
                        >
                            <FileDown size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {response ? (
                    <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all">
                        {getResponseString()}
                    </pre>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                        <Activity size={32} />
                        <p className="text-sm font-medium">Ready to send</p>
                    </div>
                )}
            </div>

            {/* Toast Notification */}
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-xl border border-slate-700 flex items-center gap-2 transition-all duration-300 pointer-events-none z-10 ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-xs font-bold">Copied to clipboard!</span>
            </div>
        </div>
    );
};

export default ResponseViewer;
