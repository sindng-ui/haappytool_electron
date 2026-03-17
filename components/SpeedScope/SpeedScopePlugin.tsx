import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalysisResult } from '../../utils/perfAnalysis';
import { PerfDashboard } from '../LogViewer/PerfDashboard';
import { getStoredValue, setStoredValue } from '../../utils/db';
import SpeedScopeWorker from '../../workers/SpeedScopeParser.worker.ts?worker';

const {
    UploadCloud, Activity, Clock, Search, ChevronLeft, ChevronRight,
    Trash2, Plus, RotateCcw, Columns, Maximize2
} = Lucide;

interface SpeedScopePluginProps {
    isActive?: boolean;
}

const SpeedScopePlugin: React.FC<SpeedScopePluginProps> = ({ isActive = true }) => {
    const { addToast } = useToast();

    // File states
    const [fileLeft, setFileLeft] = useState<{ path: string; name: string } | null>(null);
    const [fileRight, setFileRight] = useState<{ path: string; name: string } | null>(null);

    // Results
    const [resultLeft, setResultLeft] = useState<AnalysisResult | null>(null);
    const [resultRight, setResultRight] = useState<AnalysisResult | null>(null);

    // UI States
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [failThreshold, setFailThreshold] = useState<number>(100); // 100ms default
    const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [compareMode, setCompareMode] = useState(false);

    const workerRef = useRef<Worker | null>(null);

    const getWorker = useCallback(() => {
        if (!workerRef.current) {
            workerRef.current = new SpeedScopeWorker();
        }
        return workerRef.current;
    }, []);

    useEffect(() => {
        // Load keywords from localStorage
        const saved = localStorage.getItem('happytool_speedscope_keywords');
        if (saved) {
            try {
                setSearchKeywords(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load speedscope keywords", e);
            }
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('happytool_speedscope_keywords', JSON.stringify(searchKeywords));
    }, [searchKeywords]);

    const handleFileLoad = async (file: File, side: 'left' | 'right') => {
        const text = await file.text();
        const path = window.electronAPI.getFilePath(file);

        if (side === 'left') setFileLeft({ path, name: file.name });
        else setFileRight({ path, name: file.name });

        setIsAnalyzing(true);
        const worker = getWorker();
        const requestId = Math.random().toString(36).substring(7);

        const handleMessage = (e: MessageEvent) => {
            const { type, payload, requestId: resId } = e.data;
            if (resId !== requestId) return;

            if (type === 'ANALYSIS_COMPLETE') {
                if (side === 'left') setResultLeft(payload.result);
                else setResultRight(payload.result);
                setIsAnalyzing(false);
                addToast(`${side === 'left' ? 'First' : 'Second'} file analyzed successfully.`, "success");
                worker.removeEventListener('message', handleMessage);
            } else if (type === 'ERROR') {
                setIsAnalyzing(false);
                addToast(payload.error, "error");
                worker.removeEventListener('message', handleMessage);
            }
        };

        worker.addEventListener('message', handleMessage);
        worker.postMessage({
            type: 'PARSE_SPEED_SCOPE',
            payload: {
                jsonString: text,
                fileName: file.name,
                perfThreshold: failThreshold,
                dangerLevels: [
                    { ms: failThreshold, color: '#f59e0b', label: 'Slow' },
                    { ms: failThreshold * 2, color: '#ef4444', label: 'Critical' }
                ]
            },
            requestId
        });
    };

    const addKeyword = () => {
        if (newKeyword.trim() && !searchKeywords.includes(newKeyword.trim())) {
            setSearchKeywords([...searchKeywords, newKeyword.trim()]);
            setNewKeyword('');
        }
    };

    return (
        <div className="flex w-full h-full flex-col bg-[#0b0f19] text-slate-200 overflow-hidden relative">
            {/* Header */}
            <div className="h-10 shrink-0 title-drag pl-4 pr-2 flex items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-[#0f172a] to-[#0d1321]">
                <div className="flex items-center gap-3 no-drag">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Activity size={14} />
                    </div>
                    <span className="font-black text-xs uppercase tracking-widest text-indigo-200">
                        Speed Scope Analyzer
                    </span>
                </div>

                <div className="flex items-center gap-2 no-drag">
                    {/* Controls */}
                    <div className="flex items-center gap-1.5 bg-slate-900/50 border border-white/5 px-2 py-1 rounded-lg">
                        <Clock size={12} className="text-amber-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Fail Threshold</span>
                        <input
                            type="number"
                            value={failThreshold}
                            onChange={(e) => setFailThreshold(Number(e.target.value))}
                            className="w-16 bg-transparent text-[11px] font-mono text-indigo-400 outline-none border-b border-white/10 text-center"
                        />
                        <span className="text-[9px] text-slate-600 font-bold uppercase">ms</span>
                    </div>

                    <button
                        onClick={() => setCompareMode(!compareMode)}
                        className={`p-1.5 rounded-lg transition-all ${compareMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                        title="Compare Mode"
                    >
                        <Columns size={14} />
                    </button>

                    <button
                        onClick={() => {
                            setFileLeft(null); setFileRight(null);
                            setResultLeft(null); setResultRight(null);
                        }}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                        title="Reset All"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Search Bar */}
                <div className="bg-[#0f172a] p-2 flex items-center gap-3 border-b border-white/5">
                    <div className="flex items-center gap-2 flex-1 scrollbar-hide overflow-x-auto">
                        <Search size={14} className="text-slate-500 shrink-0" />
                        {searchKeywords.map(kw => (
                            <span key={kw} className="flex items-center gap-1 bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-500/20 shrink-0">
                                {kw}
                                <button onClick={() => setSearchKeywords(searchKeywords.filter(k => k !== kw))}>
                                    <Trash2 size={10} />
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            placeholder="Add keyword & Enter (multi-search)..."
                            value={newKeyword}
                            onChange={e => setNewKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addKeyword()}
                            className="bg-transparent text-[11px] outline-none placeholder:text-slate-700 min-w-[150px]"
                        />
                    </div>
                </div>

                <div className={`flex-1 flex ${compareMode ? 'flex-row' : 'flex-col'} overflow-hidden`}>
                    {/* Left Pane / Single Pane */}
                    <div className={`flex-1 flex flex-col relative ${compareMode ? 'border-r border-white/10' : ''}`}>
                        {!resultLeft ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
                                <label className="flex flex-col items-center cursor-pointer group">
                                    <div className="p-10 bg-slate-900/50 border-2 border-dashed border-white/10 rounded-3xl group-hover:border-indigo-500/50 transition-all flex flex-col items-center group-hover:bg-indigo-500/5">
                                        <UploadCloud size={48} className="text-slate-600 group-hover:text-indigo-400 transition-colors mb-4" />
                                        <p className="text-sm font-bold text-slate-400">Drop SpeedScope JSON or Click</p>
                                        <p className="text-[10px] text-slate-600 mt-2 uppercase font-black tracking-widest">Target: Main Thread Only</p>
                                    </div>
                                    <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileLoad(e.target.files[0], 'left')} />
                                </label>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden relative">
                                <PerfDashboard
                                    isOpen={true} isActive={isActive}
                                    result={resultLeft}
                                    isAnalyzing={isAnalyzing}
                                    targetTime={failThreshold}
                                    isFullScreen={true}
                                    onClose={() => setResultLeft(null)}
                                    activeTags={searchKeywords}
                                    paneId="left"
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Pane (Compare) */}
                    {compareMode && (
                        <div className="flex-1 flex flex-col relative">
                            {!resultRight ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
                                    <label className="flex flex-col items-center cursor-pointer group">
                                        <div className="p-10 bg-slate-900/50 border-2 border-dashed border-white/10 rounded-3xl group-hover:border-indigo-500/50 transition-all flex flex-col items-center group-hover:bg-indigo-500/5">
                                            <UploadCloud size={48} className="text-slate-600 group-hover:text-indigo-400 transition-colors mb-4" />
                                            <p className="text-sm font-bold text-slate-400">Load Second File to Compare</p>
                                        </div>
                                        <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileLoad(e.target.files[0], 'right')} />
                                    </label>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-hidden relative">
                                    <PerfDashboard
                                        isOpen={true} isActive={isActive}
                                        result={resultRight}
                                        isAnalyzing={isAnalyzing}
                                        targetTime={failThreshold}
                                        isFullScreen={true}
                                        onClose={() => setResultRight(null)}
                                        activeTags={searchKeywords}
                                        paneId="right"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {isAnalyzing && (
                <div className="absolute inset-0 z-50 bg-[#0b0f19]/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="mb-4"
                    >
                        <Lucide.Loader2 size={40} className="text-indigo-500" />
                    </motion.div>
                    <p className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em] animate-pulse">Analyzing Speed Scope Data...</p>
                </div>
            )}
        </div>
    );
};

export default SpeedScopePlugin;
