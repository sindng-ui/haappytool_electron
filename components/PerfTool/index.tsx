import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { extractTimestamp, formatDuration } from '../../utils/logTime';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';
import { PerfDashboard } from '../LogViewer/PerfDashboard';

const {
    Play, Target, Loader2, UploadCloud, Activity,
    Clock, Palette, Plus, Trash2, SortDesc, Search, ChevronRight
} = Lucide;

interface DangerThreshold {
    ms: number;
    color: string;
    label: string;
}

const PerfTool: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
    const { addToast } = useToast();

    const [fileHandle, setFileHandle] = useState<{ path: string; name: string } | null>(null);
    const [targetKeyword, setTargetKeyword] = useState<string>('');
    const [perfThreshold, setPerfThreshold] = useState<number>(1000);
    const [dangerLevels, setDangerLevels] = useState<DangerThreshold[]>([
        { ms: 500, color: '#f59e0b', label: 'Slow' },
        { ms: 2000, color: '#be123c', label: 'Very Slow' }
    ]);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);

    const [pidList, setPidList] = useState<{ pid: string, count: number }[] | null>(null);

    // Raw Viewer State
    const [rawViewerOpen, setRawViewerOpen] = useState(false);
    const [rawRange, setRawRange] = useState<{ start: number, end: number } | null>(null);

    // Load persistence
    useEffect(() => {
        const saved = localStorage.getItem('happytool_perf_tool_settings_v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.targetKeyword) setTargetKeyword(parsed.targetKeyword);
                if (parsed.perfThreshold) setPerfThreshold(parsed.perfThreshold);
                if (parsed.fileHandle) setFileHandle(parsed.fileHandle);
                if (parsed.dangerLevels) setDangerLevels(parsed.dangerLevels);
            } catch (e) {
                console.error("Failed to load perf tool settings", e);
            }
        }
    }, []);

    useEffect(() => {
        const settings = { targetKeyword, perfThreshold, fileHandle, dangerLevels };
        localStorage.setItem('happytool_perf_tool_settings_v2', JSON.stringify(settings));
    }, [targetKeyword, perfThreshold, fileHandle, dangerLevels]);

    const addDangerLevel = () => {
        if (dangerLevels.length >= 8) return;
        setDangerLevels([...dangerLevels, { ms: 3000, color: '#ef4444', label: 'Critical' }]);
    };
    const sortDangerLevels = () => {
        setDangerLevels([...dangerLevels].sort((a, b) => b.ms - a.ms));
    };
    const updateDangerLevel = (index: number, updates: Partial<DangerThreshold>) => {
        const next = [...dangerLevels];
        next[index] = { ...next[index], ...updates };
        setDangerLevels(next);
    };
    const removeDangerLevel = (index: number) => {
        setDangerLevels(dangerLevels.filter((_, i) => i !== index));
    };

    const getDangerColor = (duration: number): string | undefined => {
        let color: string | undefined = undefined;
        // Sort ascending to get the highest matched threshold
        const sorted = [...dangerLevels].sort((a, b) => a.ms - b.ms);
        for (const lvl of sorted) {
            if (duration >= lvl.ms) {
                color = lvl.color;
            }
        }
        return color;
    };

    // Tag -> PID Scanning
    const scanPid = useCallback(async () => {
        if (!fileHandle?.path) {
            addToast("Please load a log file first.", "error");
            return;
        }
        if (!targetKeyword.trim()) {
            addToast("Enter a Tag in Target Keyword field first to search for PIDs.", "error");
            return;
        }

        setIsScanning(true);
        setPidList(null);

        const requestId = Math.random().toString(36).substring(7);
        const keywordLower = targetKeyword.toLowerCase().trim();
        const pidCounts = new Map<string, number>();

        let streamBuffer = '';
        let offChunk: (() => void) | undefined;
        let offComplete: (() => void) | undefined;

        const processLine = (line: string) => {
            if (line.toLowerCase().includes(keywordLower)) {
                // Try to extract PID using common formats
                // Android format: 11-06 14:00:00.000 1234 5678 I Tag :
                // Tizen format: [1234:5678]
                const androidMatch = line.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(\d+)\s+/);
                const tizenMatch = line.match(/\[\s*(\d+)\s*:\s*\d+\s*\]/);

                const pid = androidMatch ? androidMatch[1] : (tizenMatch ? tizenMatch[1] : null);
                if (pid) {
                    pidCounts.set(pid, (pidCounts.get(pid) || 0) + 1);
                }
            }
        };

        const onChunk = (data: { chunk: string; requestId: string }) => {
            if (data.requestId !== requestId) return;
            const fullChunk = streamBuffer + data.chunk;
            const lines = fullChunk.split(/\r?\n/);
            streamBuffer = lines.pop() || '';
            for (const line of lines) {
                processLine(line);
            }
        };

        const onComplete = (data: { requestId: string }) => {
            if (data.requestId !== requestId) return;
            if (streamBuffer) processLine(streamBuffer);

            if (offChunk) offChunk();
            if (offComplete) offComplete();

            setIsScanning(false);
            const results = Array.from(pidCounts.entries())
                .map(([pid, count]) => ({ pid, count }))
                .sort((a, b) => b.count - a.count);

            if (results.length === 0) {
                addToast("No PIDs found for this Tag.", "warning");
            } else {
                setPidList(results);
            }
        };

        if (window.electronAPI?.onFileChunk) {
            offChunk = window.electronAPI.onFileChunk(onChunk);
            offComplete = window.electronAPI.onFileStreamComplete(onComplete);
            window.electronAPI.streamReadFile(fileHandle.path, requestId);
        }
    }, [fileHandle, targetKeyword, addToast]);


    // Full Analysis
    const runAnalysis = useCallback(async () => {
        if (!fileHandle?.path) {
            addToast("Please load a log file first.", "error");
            return;
        }
        if (!targetKeyword.trim()) {
            addToast("Please enter a Target Keyword (PID or Log Tag).", "error");
            return;
        }

        setIsAnalyzing(true);
        setResult(null);
        setPidList(null);

        const requestId = Math.random().toString(36).substring(7);
        const keywordLower = targetKeyword.toLowerCase().trim();

        // Matched logs array
        const matchedLogs: { timestamp: number; lineContent: string; lineIndex: number }[] = [];

        let currentLineIndex = 0;
        let streamBuffer = '';

        let offChunk: (() => void) | undefined;
        let offComplete: (() => void) | undefined;
        let offError: (() => void) | undefined;

        const cleanup = () => {
            if (offChunk) offChunk();
            if (offComplete) offComplete();
            if (offError) offError();
        };

        const processLine = (line: string, index: number) => {
            if (line.toLowerCase().includes(keywordLower)) {
                const ts = extractTimestamp(line);
                if (ts !== null) {
                    // Determine implicit 'end' of previous event to build sequential intervals.
                    matchedLogs.push({ timestamp: ts, lineContent: line, lineIndex: index });
                }
            }
        };

        const onChunk = (data: { chunk: string; requestId: string }) => {
            if (data.requestId !== requestId) return;

            const fullChunk = streamBuffer + data.chunk;
            const lines = fullChunk.split(/\r?\n/);

            streamBuffer = lines.pop() || '';

            for (const line of lines) {
                currentLineIndex++;
                processLine(line, currentLineIndex);
            }
        };

        const onComplete = (data: { requestId: string }) => {
            if (data.requestId !== requestId) return;

            if (streamBuffer) {
                currentLineIndex++;
                processLine(streamBuffer, currentLineIndex);
            }
            cleanup();

            if (matchedLogs.length < 2) {
                setIsAnalyzing(false);
                addToast("Not enough logs matched the keyword to form intervals.", "warning");
                return;
            }

            // Generate Interval Segments
            const segments: AnalysisSegment[] = [];
            let passCount = 0;
            let failCount = 0;

            for (let i = 0; i < matchedLogs.length - 1; i++) {
                const current = matchedLogs[i];
                const next = matchedLogs[i + 1];
                const duration = next.timestamp - current.timestamp;

                const isFail = duration >= perfThreshold;
                if (isFail) failCount++; else passCount++;

                segments.push({
                    id: `interval-${i}-${Math.random().toString(36).substring(7)}`,
                    name: `Interval ${i + 1}`,
                    startTime: current.timestamp,
                    endTime: next.timestamp,
                    duration,
                    startLine: current.lineIndex,
                    endLine: next.lineIndex,
                    originalStartLine: current.lineIndex,
                    originalEndLine: next.lineIndex,
                    type: 'manual', // Closest type available in AnalysisSegment
                    status: isFail ? 'fail' : 'pass',
                    logs: [current.lineContent, next.lineContent],
                    dangerColor: getDangerColor(duration),
                    lane: 0 // Will be assigned by PerfDashboard logic or defaults
                });
            }

            const totalDuration = matchedLogs[matchedLogs.length - 1].timestamp - matchedLogs[0].timestamp;

            const finishedResult: AnalysisResult = {
                fileName: fileHandle.name,
                totalDuration,
                segments,
                startTime: matchedLogs[0].timestamp,
                endTime: matchedLogs[matchedLogs.length - 1].timestamp,
                logCount: currentLineIndex,
                passCount,
                failCount,
                bottlenecks: segments.filter(s => s.duration >= perfThreshold),
                perfThreshold
            };

            setResult(finishedResult);
            setIsAnalyzing(false);
            addToast(`Analysis complete: ${segments.length} intervals found`, "success");
        };

        const onError = (data: { error: string; requestId: string }) => {
            if (data.requestId !== requestId) return;
            setIsAnalyzing(false);
            addToast(`Analysis error: ${data.error}`, "error");
            cleanup();
        };

        if (window.electronAPI?.onFileChunk) {
            offChunk = window.electronAPI.onFileChunk(onChunk);
            offComplete = window.electronAPI.onFileStreamComplete(onComplete);
            offError = window.electronAPI.onFileStreamError(onError);
        }

        window.electronAPI.streamReadFile(fileHandle.path, requestId);
    }, [fileHandle, targetKeyword, perfThreshold, dangerLevels, addToast]);

    // Copy Logs Feature
    const handleCopyLogs = useCallback(async (start: number, end: number) => {
        if (!fileHandle?.path) return;

        const requestId = Math.random().toString(36).substring(7);
        let streamBuffer = '';
        let currentLineIndex = 0;
        const collected: string[] = [];

        const onChunk = (data: { chunk: string; requestId: string }) => {
            if (data.requestId !== requestId) return;
            const fullChunk = streamBuffer + data.chunk;
            const parts = fullChunk.split(/\r?\n/);
            streamBuffer = parts.pop() || '';

            for (const line of parts) {
                currentLineIndex++;
                if (currentLineIndex >= start && currentLineIndex <= end) {
                    collected.push(line);
                }
            }
        };

        const onComplete = async (data: { requestId: string }) => {
            if (data.requestId !== requestId) return;
            if (offChunk) offChunk();
            if (offComplete) offComplete();

            try {
                await navigator.clipboard.writeText(collected.join('\n'));
                addToast(`Copied ${collected.length} lines to clipboard`, "success");
            } catch (e) {
                addToast("Failed to copy logs", "error");
            }
        };

        let offChunk: any, offComplete: any;
        if (window.electronAPI) {
            offChunk = window.electronAPI.onFileChunk(onChunk);
            offComplete = window.electronAPI.onFileStreamComplete(onComplete);
            window.electronAPI.streamReadFile(fileHandle.path, requestId);
        }
    }, [fileHandle, addToast]);


    return (
        <div className="flex w-full h-full flex-col bg-[#0b0f19] text-slate-200 overflow-hidden relative">
            {/* System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 flex items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-[#0f172a] to-[#0d1321]">
                <div className="flex items-center gap-3 no-drag">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-lg text-indigo-400 shadow-lg shadow-indigo-500/5">
                        <Activity size={14} className="icon-glow" />
                    </div>
                    <span className="font-black text-xs text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 tracking-wide">
                        Perf Tool
                    </span>
                </div>
            </div>

            <main className="flex-1 flex overflow-hidden relative">
                {/* Config Sidebar */}
                <aside className="w-[340px] shrink-0 border-r border-white/5 flex flex-col bg-slate-900/80 backdrop-blur-sm z-20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-7">

                        {/* 1. File Upload */}
                        <div className={`group relative border-2 border-dashed rounded-3xl p-6 flex flex-col items-center gap-3 transition-all duration-300 ${fileHandle ? 'border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/5' : 'border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5'}`}>
                            <div className={`p-3 rounded-2xl ${fileHandle ? 'bg-emerald-500/10' : 'bg-white/5 group-hover:bg-indigo-500/10'} transition-all`}>
                                <UploadCloud size={24} className={`${fileHandle ? 'text-emerald-400' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors`} />
                            </div>
                            <div className="text-center">
                                <p className="text-[11px] font-bold text-slate-200 truncate w-56 px-4">
                                    {fileHandle ? fileHandle.name : 'Target Log File'}
                                </p>
                                {!fileHandle && <p className="text-[8px] text-slate-500 uppercase font-black mt-1 tracking-wider">Drop or Click to Upload</p>}
                            </div>
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setFileHandle({ path: window.electronAPI.getFilePath(f), name: f.name });
                            }} />
                        </div>

                        {/* 2. Target Keyword & PID Scanner */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><Target size={12} className="text-indigo-400" /> Target Keyword</span>
                                <button
                                    onClick={scanPid}
                                    disabled={isScanning || !fileHandle || !targetKeyword}
                                    className="text-[9px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                >
                                    {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                                    Find PID by Tag
                                </button>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter PID or Log Tag (e.g. 1234 or SystemUI)"
                                value={targetKeyword}
                                onChange={e => setTargetKeyword(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] outline-none focus:border-indigo-500/40 transition-colors placeholder:text-slate-600 font-mono"
                            />

                            <AnimatePresence>
                                {pidList && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2 mt-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            <p className="text-[9px] text-slate-500 font-bold mb-2 px-1 uppercase tracking-wider">Discovered PIDs for Tag</p>
                                            {pidList.map(({ pid, count }) => (
                                                <button
                                                    key={pid}
                                                    onClick={() => {
                                                        setTargetKeyword(pid);
                                                        setPidList(null);
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group"
                                                >
                                                    <span className="font-mono text-[11px] text-indigo-300 font-bold">{pid}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-500">{count} logs</span>
                                                        <ChevronRight size={12} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* 3. Performance Thresholds Configuration */}
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={12} className="text-amber-400" /> Pass/Fail Threshold
                                    </label>
                                    <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 rounded">ms</span>
                                </div>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900/50 text-slate-200 text-xs font-mono p-3 rounded-xl border border-slate-700/50 focus:border-indigo-500/50 focus:bg-slate-900 focus:outline-none transition-all shadow-inner"
                                    value={perfThreshold}
                                    onChange={(e) => setPerfThreshold(parseInt(e.target.value) || 0)}
                                    placeholder="1000"
                                />
                                <p className="mt-2 text-[9px] text-slate-500 leading-relaxed">
                                    Intervals running longer than this limit will trigger a <span className="text-rose-400 font-bold">FAIL</span> state in reports.
                                </p>
                            </div>

                            {/* Risk Levels (Danger Thresholds) */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Palette size={12} className="text-pink-400" /> Risk Levels (Visual)
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <button onClick={sortDangerLevels} className="p-1 px-1.5 text-slate-500 hover:text-indigo-400 transition-colors" title="Sort by ms (Desc)">
                                            <SortDesc size={14} />
                                        </button>
                                        <button onClick={addDangerLevel} className="p-1 text-slate-500 hover:text-indigo-400 transition-colors" title="Add Level">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    {dangerLevels.map((lvl, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group p-2 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5 transition-all">
                                            <div className="relative shrink-0">
                                                <input
                                                    type="color"
                                                    className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-none p-0 overflow-hidden shadow-sm"
                                                    value={lvl.color}
                                                    onChange={(e) => updateDangerLevel(idx, { color: e.target.value })}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                className="flex-1 bg-slate-950/60 text-[11px] text-slate-300 px-3 py-2 rounded-xl border border-slate-700/30 focus:outline-none focus:border-indigo-500/50 min-w-0 font-medium"
                                                value={lvl.label}
                                                onChange={(e) => updateDangerLevel(idx, { label: e.target.value })}
                                                placeholder="Label"
                                            />
                                            <div className="flex items-center bg-slate-950 rounded-xl border border-slate-700/30 px-3 py-2 shrink-0">
                                                <input
                                                    type="text"
                                                    className="w-16 bg-transparent text-[11px] font-mono text-indigo-400 text-right focus:outline-none"
                                                    value={lvl.ms === 0 ? '' : lvl.ms}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : (parseInt(e.target.value) || 0);
                                                        updateDangerLevel(idx, { ms: val });
                                                    }}
                                                    placeholder="0"
                                                />
                                                <span className="text-[9px] text-slate-600 ml-1 font-black uppercase">ms</span>
                                            </div>
                                            <button
                                                onClick={() => removeDangerLevel(idx)}
                                                className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-white/5 space-y-3 bg-slate-900 z-30 shrink-0">
                        <button onClick={runAnalysis} disabled={isAnalyzing || !fileHandle} className={`w-full py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 ${fileHandle ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/20' : 'bg-slate-800 text-slate-600'}`}>
                            {isAnalyzing ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Play size={14} /> Run Analysis</>}
                        </button>
                    </div>
                </aside>

                {/* Content View - Embedded PerfDashboard */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative">
                    <AnimatePresence mode="wait">
                        {!result && !isAnalyzing ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center select-none text-slate-500">
                                <Activity size={48} className=" mb-4 opacity-50" />
                                <h2 className="text-lg font-bold tracking-wider">Ready for Analysis</h2>
                                <p className="text-xs mt-2 text-center max-w-sm">Load a log file, configure the Target Keyword (PID/Tag) and Thresholds, then click Run Analysis.</p>
                            </motion.div>
                        ) : (
                            <PerfDashboard
                                isOpen={true}
                                onClose={() => { }} // Not used in fullscreen
                                result={result}
                                isAnalyzing={isAnalyzing}
                                targetTime={perfThreshold}
                                isFullScreen={true}
                                onViewRawRange={(start, end) => {
                                    setRawRange({ start, end });
                                    setRawViewerOpen(true);
                                }}
                                onCopyRawRange={handleCopyLogs}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Raw Viewer Modal */}
            <AnimatePresence>
                {rawViewerOpen && rawRange && fileHandle && (
                    <PerfRawViewer
                        isOpen={rawViewerOpen}
                        onClose={() => setRawViewerOpen(false)}
                        fileHandle={fileHandle}
                        startLine={rawRange.start}
                        endLine={rawRange.end}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

interface PerfRawViewerProps {
    isOpen: boolean;
    onClose: () => void;
    fileHandle: { path: string; name: string };
    startLine: number;
    endLine: number;
}

const PerfRawViewer: React.FC<PerfRawViewerProps> = ({ isOpen, onClose, fileHandle, startLine, endLine }) => {
    const [lines, setLines] = useState<{ index: number, content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const targetRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);
        setLines([]);

        const requestId = Math.random().toString(36).substring(7);
        let streamBuffer = '';
        let currentLineIndex = 0;
        const collected: { index: number, content: string }[] = [];

        // Add some padding
        const pad = 50;
        const searchStart = Math.max(1, startLine - pad);
        const searchEnd = endLine + pad;

        const onChunk = (data: { chunk: string; requestId: string }) => {
            if (data.requestId !== requestId) return;
            const fullChunk = streamBuffer + data.chunk;
            const parts = fullChunk.split(/\r?\n/);
            streamBuffer = parts.pop() || '';

            for (const line of parts) {
                currentLineIndex++;
                if (currentLineIndex >= searchStart && currentLineIndex <= searchEnd) {
                    collected.push({ index: currentLineIndex, content: line });
                }
            }
        };

        const onComplete = (data: { requestId: string }) => {
            if (data.requestId !== requestId) return;
            setIsLoading(false);
            setLines(collected);
            if (offChunk) offChunk();
            if (offComplete) offComplete();

            // Wait for render, then scroll
            setTimeout(() => {
                targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        };

        let offChunk: any, offComplete: any;
        if (window.electronAPI) {
            offChunk = window.electronAPI.onFileChunk(onChunk);
            offComplete = window.electronAPI.onFileStreamComplete(onComplete);
            window.electronAPI.streamReadFile(fileHandle.path, requestId);
        }

        return () => {
            if (offChunk) offChunk();
            if (offComplete) offComplete();
        };
    }, [isOpen, fileHandle, startLine, endLine]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-5xl h-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <Lucide.FileText size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Raw Log View</h3>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">
                                Lines {startLine} - {endLine} (with context)
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <Lucide.X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-slate-950/50 font-mono text-[11px] leading-relaxed">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                            <Loader2 size={24} className="animate-spin text-indigo-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Loading Logs...</span>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {lines.map(l => {
                                const isTargetStart = l.index === startLine;
                                const isTarget = l.index >= startLine && l.index <= endLine;
                                return (
                                    <div
                                        key={l.index}
                                        ref={isTargetStart ? targetRef : null}
                                        className={`flex gap-4 px-2 py-0.5 rounded transition-colors ${isTarget ? 'bg-indigo-500/20 border-l-2 border-indigo-500' : 'opacity-40 hover:opacity-100'}`}
                                    >
                                        <span className="w-12 shrink-0 text-slate-400 text-right select-none">{l.index}</span>
                                        <span className={`whitespace-pre-wrap break-all ${isTarget ? 'text-indigo-100' : 'text-slate-400'}`}>{l.content}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PerfTool;
