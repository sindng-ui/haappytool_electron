import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse } from '../../types';

const { Clock, Activity, Copy, FileDown, CheckCircle } = Lucide;

interface ResponseViewerProps {
    response: PerfResponse | null;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
    const [showToast, setShowToast] = useState(false);
    const [formattedData, setFormattedData] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Worker Ref
    const workerRef = React.useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../../workers/JsonParser.worker.ts', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'SUCCESS') {
                // Determine if payload is string or object (from format mode)
                // Worker returns { data, formatted } for 'format' mode now
                if (typeof payload === 'object' && payload.formatted) {
                    setFormattedData(payload.formatted);
                } else {
                    setFormattedData(payload); // Fallback
                }
                setIsProcessing(false);
            } else if (type === 'ERROR') {
                setFormattedData(typeof response?.data === 'string' ? response.data : JSON.stringify(response?.data));
                setIsProcessing(false);
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    useEffect(() => {
        if (!response) {
            setFormattedData('');
            return;
        }

        const rawData = response.data;
        if (typeof rawData === 'string') {
            try {
                // Attempt to parse string as JSON to format it
                const json = JSON.parse(rawData);
                setIsProcessing(true);
                workerRef.current?.postMessage({
                    type: 'PARSE_AND_FORMAT',
                    payload: { text: JSON.stringify(json), mode: 'format' },
                    requestId: 'response_view'
                });
            } catch {
                setFormattedData(rawData); // Plain string, just show
            }
        } else if (typeof rawData === 'object') {
            setIsProcessing(true);
            // It's already an object, but we want to format it pretty via worker to avoid blocking
            workerRef.current?.postMessage({
                type: 'PARSE_AND_FORMAT',
                payload: { text: JSON.stringify(rawData), mode: 'format' },
                requestId: 'response_view'
            });
        } else {
            setFormattedData(String(rawData));
        }
    }, [response]);

    const handleCopy = () => {
        if (!formattedData) return;
        navigator.clipboard.writeText(formattedData);
        setShowToast(true);
    };

    const handleExport = async () => {
        if (!formattedData) return;

        const filename = `response_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;

        // Try Electron Save first
        // @ts-ignore
        if (window.electronAPI && window.electronAPI.saveTextFile) {
            try {
                // @ts-ignore
                await window.electronAPI.saveTextFile(formattedData, filename);
                return;
            } catch (e) {
                console.error("Electron save failed", e);
            }
        }

        // Fallback
        const blob = new Blob([formattedData], { type: 'application/json' });
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
        <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
            <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-zinc-50 dark:bg-white/5 shrink-0 h-9">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Response</span>
                {response && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-mono mr-2">
                            <span className={`font-bold ${response.status >= 200 && response.status < 300 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                                {response.status} {response.statusText}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock size={12} /> {response.timeTaken}ms
                            </span>
                        </div>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
                        <button
                            onClick={handleCopy}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-white/10 p-1 rounded transition-colors"
                            title="Copy to Clipboard"
                        >
                            <Copy size={14} />
                        </button>
                        <button
                            onClick={handleExport}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-white/10 p-1 rounded transition-colors"
                            title="Export to File"
                        >
                            <FileDown size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar relative bg-slate-50 dark:bg-[#0B1120]">
                {response ? (
                    isProcessing ? (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 gap-2">
                            <Activity className="animate-spin text-indigo-500" size={24} />
                            <span className="text-xs font-medium">Formatting...</span>
                        </div>
                    ) : (
                        <pre className="font-mono text-xs text-slate-800 dark:text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
                            {formattedData}
                        </pre>
                    )
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3 opacity-60">
                        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5">
                            <Activity size={32} />
                        </div>
                        <p className="text-sm font-medium">Ready to send request</p>
                    </div>
                )}
            </div>

            {/* Toast Notification */}
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all duration-300 pointer-events-none z-10 ${showToast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <CheckCircle size={16} className="text-emerald-500" />
                <span className="text-xs font-bold">Copied to clipboard!</span>
            </div>
        </div>
    );
};

export default ResponseViewer;
