import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';
import { PerfDashboard } from '../LogViewer/PerfDashboard';
import { getStoredValue, setStoredValue } from '../../utils/db';
import SpeedScopeWorker from '../../workers/SpeedScopeParser.worker.ts?worker';
import SplitAnalysisWorker from '../../workers/SplitAnalysis.worker.ts?worker';
import { SplitAnalysisResult } from '../../workers/SplitAnalysisUtils';
import { SplitAnalyzerPanel } from '../LogViewer/SplitAnalyzerPanel';
import { comparePerformanceResults, DiffAnalysisResult } from '../../utils/performanceDiff';
import { PerfFlameDiff } from './PerfFlameDiff';

const {
    UploadCloud, Activity, Clock, Search, ChevronLeft, ChevronRight,
    Trash2, Plus, RotateCcw, Columns, Maximize2, Cpu, Zap, Loader2
} = Lucide;

interface SpeedScopePluginProps {
    isActive?: boolean;
}

const ThreadSelector: React.FC<{
    profiles: any[];
    selectedIndex: number;
    onSelect: (idx: number) => void;
    side: 'left' | 'right';
}> = ({ profiles, selectedIndex, onSelect, side }) => {
    if (profiles.length <= 1) return null;

    return (
        <div className="flex items-center gap-2 p-1.5 bg-[#1a1f2e]/60 backdrop-blur-md border-b border-white/5 overflow-x-auto scrollbar-hide no-drag">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 rounded-md border border-indigo-500/20 mr-2 shrink-0">
                <Cpu size={12} className="text-indigo-400" />
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-tighter">Threads</span>
            </div>
            {profiles.map((p, idx) => (
                <button
                    key={`${side}-${idx}`}
                    onClick={() => onSelect(idx)}
                    className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                        selectedIndex === idx 
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                        : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-indigo-500/30'
                    }`}
                >
                    {p.name || `Thread ${idx}`} <span className="opacity-50 text-[8px] ml-1 uppercase">{p.type}</span>
                </button>
            ))}
        </div>
    );
};

const SpeedScopePlugin: React.FC<SpeedScopePluginProps> = ({ isActive = true }) => {
    const { addToast } = useToast();

    // File states
    const [fileLeft, setFileLeft] = useState<{ path: string; name: string } | null>(null);
    const [fileRight, setFileRight] = useState<{ path: string; name: string } | null>(null);

    // Results
    const [resultLeft, setResultLeft] = useState<AnalysisResult | null>(null);
    const [resultRight, setResultRight] = useState<AnalysisResult | null>(null);
    
    // Multi-Profile Storage
    const [allSegmentsLeft, setAllSegmentsLeft] = useState<AnalysisSegment[][] | null>(null);
    const [allSegmentsRight, setAllSegmentsRight] = useState<AnalysisSegment[][] | null>(null);
    const [profilesLeft, setProfilesLeft] = useState<any[]>([]);
    const [profilesRight, setProfilesRight] = useState<any[]>([]);
    const [selIdxLeft, setSelIdxLeft] = useState(0);
    const [selIdxRight, setSelIdxRight] = useState(0);

    // UI States
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [failThreshold, setFailThreshold] = useState<number>(100); // 100ms default
    const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [compareMode, setCompareMode] = useState(false);
    
    // Diff Analysis States
    const [isSplitAnalyzing, setIsSplitAnalyzing] = useState(false);
    const [isSplitAnalyzerOpen, setIsSplitAnalyzerOpen] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisResults, setAnalysisResults] = useState<SplitAnalysisResult[]>([]);
    const [pointResults, setPointResults] = useState<any[]>([]);
    const [isUnifiedDiff, setIsUnifiedDiff] = useState(false);
    const [diffResult, setDiffResult] = useState<DiffAnalysisResult | null>(null);

    // Drag & Drop States
    const [isDraggingLeft, setIsDraggingLeft] = useState(false);
    const [isDraggingRight, setIsDraggingRight] = useState(false);

    const workerRef = useRef<Worker | null>(null);
    const analyzerWorkerRef = useRef<Worker | null>(null);

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
            if (analyzerWorkerRef.current) {
                analyzerWorkerRef.current.terminate();
                analyzerWorkerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('happytool_speedscope_keywords', JSON.stringify(searchKeywords));
    }, [searchKeywords]);

    const handleFileLoad = useCallback(async (file: File, side: 'left' | 'right') => {
        const text = await file.text();
        const path = window.electronAPI ? window.electronAPI.getFilePath(file) : file.name;

        if (side === 'left') {
            setFileLeft({ path, name: file.name });
            setResultLeft(null);
            setAllSegmentsLeft(null);
        } else {
            setFileRight({ path, name: file.name });
            setResultRight(null);
            setAllSegmentsRight(null);
        }

        setIsAnalyzing(true);
        const worker = getWorker();
        const requestId = Math.random().toString(36).substring(7);

        const handleMessage = (e: MessageEvent) => {
            const { type, payload, requestId: resId } = e.data;
            if (resId !== requestId) return;

            if (type === 'ANALYSIS_COMPLETE') {
                const res = payload.result;
                if (side === 'left') {
                    setAllSegmentsLeft(res.allSegments);
                    setProfilesLeft(res.profiles);
                    setSelIdxLeft(res.selectedProfileIndex);
                    setResultLeft(res);
                } else {
                    setAllSegmentsRight(res.allSegments);
                    setProfilesRight(res.profiles);
                    setSelIdxRight(res.selectedProfileIndex);
                    setResultRight(res);
                }
                setIsAnalyzing(false);
                addToast(`${side === 'left' ? 'First' : 'Second'} file analyzed successfully. Supported ${res.profiles.length} profiles.`, "success");
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
    }, [failThreshold, getWorker, addToast]);

    const switchProfile = (side: 'left' | 'right', index: number) => {
        if (side === 'left' && allSegmentsLeft && profilesLeft[index]) {
            setSelIdxLeft(index);
            const segments = allSegmentsLeft[index];
            const pInfo = profilesLeft[index];
            setResultLeft(prev => prev ? {
                ...prev,
                segments: [...segments].sort((a, b) => a.startTime - b.startTime),
                totalDuration: pInfo.duration,
                startTime: Math.min(...segments.map(s => s.startTime)),
                endTime: Math.max(...segments.map(s => s.endTime)),
                logCount: pInfo.segmentCount,
                passCount: segments.filter(s => s.status === 'pass').length,
                failCount: segments.filter(s => s.status === 'fail').length,
                bottlenecks: segments.filter(s => s.status === 'fail'),
                functionStats: pInfo.functionStats,
            } : null);
        } else if (side === 'right' && allSegmentsRight && profilesRight[index]) {
            setSelIdxRight(index);
            const segments = allSegmentsRight[index];
            const pInfo = profilesRight[index];
            setResultRight(prev => prev ? {
                ...prev,
                segments: [...segments].sort((a, b) => a.startTime - b.startTime),
                totalDuration: pInfo.duration,
                startTime: Math.min(...segments.map(s => s.startTime)),
                endTime: Math.max(...segments.map(s => s.endTime)),
                logCount: pInfo.segmentCount,
                passCount: segments.filter(s => s.status === 'pass').length,
                failCount: segments.filter(s => s.status === 'fail').length,
                bottlenecks: segments.filter(s => s.status === 'fail'),
                functionStats: pInfo.functionStats,
            } : null);
        }
    };

    const performAnalysis = useCallback(async () => {
        if (!resultLeft || !resultRight) return;

        setIsSplitAnalyzing(true);
        setIsSplitAnalyzerOpen(true);
        setAnalysisProgress(0);

        if (!analyzerWorkerRef.current) {
            analyzerWorkerRef.current = new SplitAnalysisWorker();
        }

        const analyzerWorker = analyzerWorkerRef.current;

        // Convert segments to SequenceItem
        const leftSequence = resultLeft.segments.map((s, idx) => ({
            content: s.functionName || s.fileName || 'unknown',
            originalLineNum: idx,
            timestamp: s.startTime,
            isError: s.status === 'fail',
            severity: s.duration
        }));

        const rightSequence = resultRight.segments.map((s, idx) => ({
            content: s.functionName || s.fileName || 'unknown',
            originalLineNum: idx,
            timestamp: s.startTime,
            isError: s.status === 'fail',
            severity: s.duration
        }));

        const handleMessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            if (type === 'STATUS_UPDATE') {
                setAnalysisProgress(payload.progress);
            } else if (type === 'SPLIT_ANALYSIS_COMPLETE') {
                setAnalysisResults(payload.results);
                setPointResults(payload.pointResults);
                setIsSplitAnalyzing(false);
                addToast(`Analysis complete: found ${payload.results.length} deltas.`, "success");
                analyzerWorker.removeEventListener('message', handleMessage);
            }
        };

        analyzerWorker.addEventListener('message', handleMessage);
        analyzerWorker.postMessage({
            leftSequence,
            rightSequence,
            leftPointMetrics: {},
            rightPointMetrics: {},
            leftAliasEvents: [],
            rightAliasEvents: []
        });

    }, [resultLeft, resultRight, addToast]);

    const toggleUnifiedDiff = useCallback(() => {
        if (!resultLeft || !resultRight) {
            addToast("Please load both files first.", "warning");
            return;
        }
        
        if (!isUnifiedDiff) {
            const diff = comparePerformanceResults(resultLeft, resultRight);
            setDiffResult(diff);
            setIsUnifiedDiff(true);
        } else {
            setIsUnifiedDiff(false);
        }
    }, [resultLeft, resultRight, isUnifiedDiff, addToast]);

    const handleDrag = useCallback((e: React.DragEvent, side: 'left' | 'right', isEntering: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (side === 'left') setIsDraggingLeft(isEntering);
        else setIsDraggingRight(isEntering);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, side: 'left' | 'right') => {
        e.preventDefault();
        e.stopPropagation();
        if (side === 'left') setIsDraggingLeft(false);
        else setIsDraggingRight(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileLoad(file, side);
        }
    }, [handleFileLoad]);

    const addKeyword = () => {
        if (newKeyword.trim() && !searchKeywords.includes(newKeyword.trim())) {
            setSearchKeywords([...searchKeywords, newKeyword.trim()]);
            setNewKeyword('');
        }
    };

    return (
        <div className="flex w-full h-full flex-col bg-[#0b0f19] text-slate-200 overflow-hidden relative">
            {/* Header */}
            <div className="h-10 shrink-0 title-drag pl-4 pr-52 flex items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-[#0f172a] to-[#0d1321]">
                <div className="flex items-center gap-3 no-drag">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Activity size={14} />
                    </div>
                    <span className="font-black text-xs uppercase tracking-widest text-indigo-200">
                        Speed Scope Analyzer
                    </span>
                </div>

                <div className="flex items-center gap-2 no-drag">
                    {/* Compare/Analyze Tools */}
                    {compareMode && resultLeft && resultRight && (
                        <button
                            onClick={performAnalysis}
                            disabled={isSplitAnalyzing}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg ${
                                isSplitAnalyzing 
                                ? 'bg-blue-900/50 text-blue-300 animate-pulse' 
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                            }`}
                            title="Analyze Differences"
                        >
                            <Zap size={12} className={isSplitAnalyzing ? "animate-spin" : ""} />
                            <span>{isSplitAnalyzing ? 'Analyzing...' : 'Analyze Diff'}</span>
                        </button>
                    )}

                    <button
                        onClick={toggleUnifiedDiff}
                        disabled={!resultLeft || !resultRight}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg ${
                            isUnifiedDiff 
                            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        } disabled:opacity-30`}
                        title="Unified Diff Mode"
                    >
                        <Lucide.Diff size={14} />
                        <span>Unified Diff</span>
                    </button>

                    <button
                        onClick={() => {
                            setCompareMode(!compareMode);
                            if (isUnifiedDiff) setIsUnifiedDiff(false);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${compareMode && !isUnifiedDiff ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                        title="Compare Mode"
                    >
                        <Columns size={14} />
                    </button>

                    <button
                        onClick={() => {
                            setFileLeft(null); setFileRight(null);
                            setResultLeft(null); setResultRight(null);
                            setAllSegmentsLeft(null); setAllSegmentsRight(null);
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

                <div className={`flex-1 flex ${compareMode || isUnifiedDiff ? 'flex-row' : 'flex-col'} overflow-hidden w-full min-h-0`}>
                    {/* Unified Diff View */}
                    {isUnifiedDiff && diffResult ? (
                        <div className="flex-1 flex flex-col bg-[#0b0f19] relative">
                            <div className="p-3 bg-teal-500/10 border-b border-teal-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Lucide.GitCompare size={14} className="text-teal-400" />
                                    <span className="text-[10px] font-black uppercase text-teal-300 tracking-tighter">Unified Diff View (Target: {fileRight?.name})</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-[9px] text-rose-400 font-bold uppercase">Red: Slower</span>
                                    <span className="text-[9px] text-blue-400 font-bold uppercase">Blue: Faster</span>
                                    <span className="text-[9px] text-teal-400 font-bold uppercase">Green: Added</span>
                                </div>
                            </div>
                            <div className="flex-1 relative overflow-hidden">
                                <PerfFlameDiff
                                    targetResult={diffResult.targetResult}
                                    diffSegments={diffResult.diffSegments}
                                    maxLane={Math.max(...diffResult.diffSegments.map(s => s.lane || 0))}
                                    flameZoom={null}
                                    applyZoom={() => {}}
                                    searchTerms={[]}
                                    checkSegmentMatch={() => true}
                                    selectedSegmentId={null}
                                    setSelectedSegmentId={() => {}}
                                    multiSelectedIds={[]}
                                    setMultiSelectedIds={() => {}}
                                    isActive={isActive}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Left Pane / Single Pane */}
                            <div className={`${compareMode ? 'w-1/2 border-r border-white/10' : 'flex-1'} flex flex-col relative min-h-0`}>
                                {resultLeft && (
                                    <ThreadSelector 
                                        profiles={profilesLeft} 
                                        selectedIndex={selIdxLeft} 
                                        onSelect={(idx) => switchProfile('left', idx)} 
                                        side="left"
                                    />
                                )}
                                {!resultLeft ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
                                        <label 
                                            className={`flex flex-col items-center cursor-pointer group transition-all duration-300 ${isDraggingLeft ? 'scale-105' : ''}`}
                                            onDragOver={(e) => handleDrag(e, 'left', true)}
                                            onDragEnter={(e) => handleDrag(e, 'left', true)}
                                            onDragLeave={(e) => handleDrag(e, 'left', false)}
                                            onDrop={(e) => handleDrop(e, 'left')}
                                        >
                                            <div className={`p-10 bg-slate-900/50 border-2 border-dashed rounded-3xl transition-all flex flex-col items-center ${isDraggingLeft ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-white/10 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5'}`}>
                                                <UploadCloud size={48} className={`transition-colors mb-4 ${isDraggingLeft ? 'text-indigo-400' : 'text-slate-600 group-hover:text-indigo-400'}`} />
                                                <p className={`text-sm font-bold transition-colors ${isDraggingLeft ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                    {isDraggingLeft ? 'Release to Start Analysis' : 'Drop SpeedScope JSON or Click'}
                                                </p>
                                                <p className="text-[10px] text-slate-600 mt-2 uppercase font-black tracking-widest text-center">Full Profile Support & Auto-Conversion</p>
                                            </div>
                                            <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileLoad(e.target.files[0], 'left')} />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-hidden relative min-h-0" data-pane-id="left">
                                        <PerfDashboard
                                            isOpen={true} isActive={isActive && (!isUnifiedDiff)}
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
                                <div className="w-1/2 flex flex-col relative min-h-0">
                                    {resultRight && (
                                        <ThreadSelector 
                                            profiles={profilesRight} 
                                            selectedIndex={selIdxRight} 
                                            onSelect={(idx) => switchProfile('right', idx)} 
                                            side="right"
                                        />
                                    )}
                                    {!resultRight ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
                                            <label 
                                                className={`flex flex-col items-center cursor-pointer group transition-all duration-300 ${isDraggingRight ? 'scale-105' : ''}`}
                                                onDragOver={(e) => handleDrag(e, 'right', true)}
                                                onDragEnter={(e) => handleDrag(e, 'right', true)}
                                                onDragLeave={(e) => handleDrag(e, 'right', false)}
                                                onDrop={(e) => handleDrop(e, 'right')}
                                            >
                                                <div className={`p-10 bg-slate-900/50 border-2 border-dashed rounded-3xl transition-all flex flex-col items-center ${isDraggingRight ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-white/10 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5'}`}>
                                                    <UploadCloud size={48} className={`transition-colors mb-4 ${isDraggingRight ? 'text-indigo-400' : 'text-slate-600 group-hover:text-indigo-400'}`} />
                                                    <p className={`text-sm font-bold transition-colors ${isDraggingRight ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                        {isDraggingRight ? 'Release to Load' : 'Load Second File to Compare'}
                                                    </p>
                                                </div>
                                                <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileLoad(e.target.files[0], 'right')} />
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-hidden relative min-h-0" data-pane-id="right">
                                            <PerfDashboard
                                                isOpen={true} isActive={isActive && (!isUnifiedDiff)}
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
                        </>
                    )}
                </div>
            </main>

            {isSplitAnalyzerOpen && (
                <div className="h-1/3 border-t border-indigo-500/20 bg-[#0f172a] overflow-hidden flex flex-col z-40">
                    <SplitAnalyzerPanel
                        results={{ results: analysisResults, pointResults: pointResults }}
                        onClose={() => setIsSplitAnalyzerOpen(false)}
                        isLoading={isSplitAnalyzing}
                        progress={analysisProgress}
                        onJumpToRange={(lane, start, end) => {
                            // Jump logic for SpeedScope segments
                            console.log(`Jump to ${lane} ${start}-${end}`);
                            // Optional: Implement jump to segment in PerfDashboard
                        }}
                    />
                </div>
            )}

            {isAnalyzing && (
                <div className="absolute inset-0 z-50 bg-[#0b0f19]/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="mb-4"
                    >
                        <Loader2 size={40} className="text-indigo-500" />
                    </motion.div>
                    <p className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em] animate-pulse">Analyzing Speed Scope Data...</p>
                </div>
            )}
        </div>
    );
};

export default SpeedScopePlugin;
