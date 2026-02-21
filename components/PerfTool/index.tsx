import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { extractTimestamp, formatDuration } from '../../utils/logTime';
import { AnalysisResult, AnalysisSegment } from '../../utils/perfAnalysis';
import { PerfDashboard } from '../LogViewer/PerfDashboard';

const {
    Play, Target, Loader2, UploadCloud, Activity,
    Clock, Palette, Plus, Trash2, SortDesc, Search, ChevronRight, RotateCcw
} = Lucide;

interface DangerThreshold {
    ms: number;
    color: string;
    label: string;
}

const extractLogIds = (line: string): { pid: string | null, tid: string | null } => {
    let pid: string | null = null;
    let tid: string | null = null;

    // 1. (P 123, T 456) or (T 456, P 123) or (123, 456)
    // Support multiple separators: comma, space, colon, dash
    const parenMatch = line.match(/\(\s*(?:P\s*)?(\d+)\s*[,:\s-]\s*(?:T\s*)?(\d+)\s*\)/i);
    if (parenMatch) {
        pid = parenMatch[1];
        tid = parenMatch[2];
    } else {
        // 2. [PID:TID] or [PID TID] or [PID-TID]
        const bracketMatch = line.match(/\[\s*(\d+)\s*[:\s-]\s*(\d+)\s*\]/);
        if (bracketMatch) {
            pid = bracketMatch[1];
            tid = bracketMatch[2];
        } else {
            // 3. Android Standard: Date Time PID TID ...
            const androidMatch = line.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(\d+)\s+(\d+)\s+/);
            if (androidMatch) {
                pid = androidMatch[1];
                tid = androidMatch[2];
            }
        }
    }

    // 4. Handle T/P or P/T combined (Common in some Tizen/embedded formats)
    const combinedMatch = line.match(/(?:T\/P|P\/T)[\s:]*(\d+)/i);
    if (combinedMatch) {
        if (!pid) pid = combinedMatch[1];
        if (!tid) tid = combinedMatch[1];
    }

    // Fallback for individual labels if not found in pairs
    if (!pid) {
        const pMatch = line.match(/(?:P\s*|PID[:\s]|ProcessId[:\s])(\d+)/i);
        if (pMatch) pid = pMatch[1];
    }
    if (!tid) {
        const tMatch = line.match(/(?:T\s*|TID[:\s]|ThreadId[:\s])(\d+)/i);
        if (tMatch) tid = tMatch[1];
    }

    // Final fallback for simple brackets [1234] if nothing else found
    if (!pid && !tid) {
        const simpleBracket = line.match(/\[\s*(\d+)\s*\]/);
        if (simpleBracket) pid = simpleBracket[1];
    }

    return { pid, tid };
};

const extractSourceMetadata = (line: string): { fileName: string | null, functionName: string | null } => {
    // Standard format: FileName.ext: FunctionName(Line)> or FileName.ext: FunctionName:Line>
    // 1. Match filename with extension
    const fileMatch = line.match(/([\w\-\.]+\.(?:cs|cpp|h|java|kt|js|ts|tsx|py|c|h|cc|hpp|m|mm))\s*:/i);
    if (!fileMatch) return { fileName: null, functionName: null };

    const fileName = fileMatch[1];
    const afterFile = line.substring(fileMatch.index! + fileMatch[0].length).trim();

    // 2. Match function name: everything after colon up to '>' or message-start ':'
    const funcMatch = afterFile.match(/^([^>:]+)(?:[:>])/);
    let functionName = funcMatch ? funcMatch[1].trim() : null;

    // Clean up function name if it has trailing line info like :123 or (123)
    if (functionName) {
        // Remove trailing line info if desired, but user said "FunctionName(Line)" in examples, so keeping it is better.
        // But we can trim common trailing stuff if it's messy.
    }

    return { fileName, functionName };
};

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

    const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
    const activeRequestIdRef = React.useRef<string | null>(null);

    // Load persistence (Local & Session)
    useEffect(() => {
        // 1. Permanent Settings (Local)
        const localSaved = localStorage.getItem('happytool_perf_tool_settings_v2');
        if (localSaved) {
            try {
                const parsed = JSON.parse(localSaved);
                if (parsed.perfThreshold !== undefined) setPerfThreshold(parsed.perfThreshold);
                if (parsed.dangerLevels && Array.isArray(parsed.dangerLevels)) {
                    setDangerLevels(parsed.dangerLevels);
                }
            } catch (e) { console.error("Failed to load local settings", e); }
        }

        // 2. Session Data (Session) - Survives tab switch, not app restart
        const sessionSaved = sessionStorage.getItem('happytool_perf_tool_session_v1');
        if (sessionSaved) {
            try {
                const parsed = JSON.parse(sessionSaved);
                if (parsed.fileHandle !== undefined) setFileHandle(parsed.fileHandle);
                if (parsed.targetKeyword !== undefined) setTargetKeyword(parsed.targetKeyword);
                if (parsed.result !== undefined) setResult(parsed.result);
                if (parsed.pidList !== undefined) setPidList(parsed.pidList);
            } catch (e) { console.error("Failed to load session data", e); }
        }

        setIsInitialLoadDone(true);

        return () => {
            if (activeRequestIdRef.current) activeRequestIdRef.current = null;
        };
    }, []);

    // Save Permanent Settings
    useEffect(() => {
        if (!isInitialLoadDone) return;
        const settings = { perfThreshold, dangerLevels };
        localStorage.setItem('happytool_perf_tool_settings_v2', JSON.stringify(settings));
    }, [perfThreshold, dangerLevels, isInitialLoadDone]);

    // Save Session Data
    useEffect(() => {
        if (!isInitialLoadDone) return;
        const session = { fileHandle, targetKeyword, result, pidList };
        sessionStorage.setItem('happytool_perf_tool_session_v1', JSON.stringify(session));
    }, [fileHandle, targetKeyword, result, pidList, isInitialLoadDone]);

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
        activeRequestIdRef.current = requestId;
        const keywordLower = targetKeyword.toLowerCase().trim();
        const pidCounts = new Map<string, number>();

        let streamBuffer = '';
        let offChunk: (() => void) | undefined;
        let offComplete: (() => void) | undefined;

        const processLine = (line: string) => {
            if (line.toLowerCase().includes(keywordLower)) {
                // Use the robust utility to extract IDs
                const { pid } = extractLogIds(line);
                if (pid) {
                    pidCounts.set(pid, (pidCounts.get(pid) || 0) + 1);
                }
            }
        };

        const onChunk = (data: { chunk: string; requestId: string }) => {
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;
            const fullChunk = streamBuffer + data.chunk;
            const lines = fullChunk.split(/\r?\n/);
            streamBuffer = lines.pop() || '';
            for (const line of lines) {
                processLine(line);
            }
        };

        const onComplete = (data: { requestId: string }) => {
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;
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
        activeRequestIdRef.current = requestId;
        const keywordLower = targetKeyword.toLowerCase().trim();

        // Matched logs grouped by TID
        const matchedLogsByTid = new Map<string, { timestamp: number; lineContent: string; lineIndex: number }[]>();

        let currentLineIndex = 0;
        let streamBuffer = '';
        let detectedPid: string | null = null;

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
                    const { pid, tid: extractedTid } = extractLogIds(line);
                    const tid = extractedTid || 'Main';
                    if (!detectedPid && pid) detectedPid = pid;
                    if (!matchedLogsByTid.has(tid)) matchedLogsByTid.set(tid, []);
                    matchedLogsByTid.get(tid)!.push({ timestamp: ts, lineContent: line, lineIndex: index });
                }
            }
        };

        const onChunk = (data: { chunk: string; requestId: string }) => {
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;

            const fullChunk = streamBuffer + data.chunk;
            const lines = fullChunk.split(/\r?\n/);

            streamBuffer = lines.pop() || '';

            for (const line of lines) {
                currentLineIndex++;
                processLine(line, currentLineIndex);
            }
        };

        const onComplete = (data: { requestId: string }) => {
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;

            if (streamBuffer) {
                currentLineIndex++;
                processLine(streamBuffer, currentLineIndex);
            }
            cleanup();

            const allLogs = Array.from(matchedLogsByTid.values()).flat().sort((a, b) => a.timestamp - b.timestamp);
            if (allLogs.length < 2) {
                setIsAnalyzing(false);
                addToast("Not enough logs matched the keyword to form intervals.", "warning");
                return;
            }

            // Generate Interval Segments per TID
            const segments: AnalysisSegment[] = [];
            let passCount = 0;
            let failCount = 0;

            const sortedTids = Array.from(matchedLogsByTid.keys()).sort((a, b) => {
                // Prioritize Main Thread (TID == PID or TID == targetKeyword)
                const isAMain = a === detectedPid || a === targetKeyword.trim();
                const isBMain = b === detectedPid || b === targetKeyword.trim();
                if (isAMain && !isBMain) return -1;
                if (!isAMain && isBMain) return 1;
                return a.localeCompare(b);
            });
            const tidToLane = new Map<string, number>();
            sortedTids.forEach((tid, idx) => tidToLane.set(tid, idx));

            matchedLogsByTid.forEach((logs, tid) => {
                const lane = tidToLane.get(tid) || 0;
                // Sort logs within TID group to ensure interval duration consistency
                const sortedLogs = logs.sort((a, b) => a.timestamp - b.timestamp);

                for (let i = 0; i < sortedLogs.length - 1; i++) {
                    const current = sortedLogs[i];
                    const next = sortedLogs[i + 1];
                    const duration = next.timestamp - current.timestamp;

                    const isFail = duration >= perfThreshold;
                    if (isFail) failCount++; else passCount++;

                    const { fileName, functionName } = extractSourceMetadata(current.lineContent);
                    const { fileName: endFileName, functionName: endFunctionName } = extractSourceMetadata(next.lineContent);

                    segments.push({
                        id: `interval-${tid}-${i}-${Math.random().toString(36).substring(7)}`,
                        name: `TID ${tid} • Interval ${i + 1}`,
                        startTime: current.timestamp,
                        endTime: next.timestamp,
                        duration,
                        startLine: current.lineIndex,
                        endLine: next.lineIndex,
                        originalStartLine: current.lineIndex,
                        originalEndLine: next.lineIndex,
                        type: 'manual',
                        status: isFail ? 'fail' : 'pass',
                        logs: [current.lineContent, next.lineContent],
                        dangerColor: getDangerColor(duration),
                        lane,
                        tid,
                        fileName: fileName || undefined,
                        functionName: functionName || undefined,
                        endFileName: endFileName || undefined,
                        endFunctionName: endFunctionName || undefined,
                        intervalIndex: i + 1
                    });
                }
            });

            const startTime = allLogs[0].timestamp;
            const endTime = allLogs[allLogs.length - 1].timestamp;
            const totalDuration = endTime - startTime;

            const finishedResult: AnalysisResult = {
                fileName: fileHandle.name,
                totalDuration,
                segments,
                startTime,
                endTime,
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
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;
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
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;
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
            if (data.requestId !== requestId || data.requestId !== activeRequestIdRef.current) return;
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
                            {fileHandle && (
                                <button
                                    onClick={() => {
                                        setFileHandle(null);
                                        setResult(null);
                                        setPidList(null);
                                        sessionStorage.removeItem('happytool_perf_tool_session_v1');
                                    }}
                                    className="absolute top-3 right-3 p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all z-10 hover:scale-110 active:scale-90"
                                    title="Unload File & Reset Result"
                                >
                                    <Lucide.RotateCcw size={14} />
                                </button>
                            )}
                            <div className={`p-3 rounded-2xl ${fileHandle ? 'bg-emerald-500/10' : 'bg-white/5 group-hover:bg-indigo-500/10'} transition-all`}>
                                <UploadCloud size={24} className={`${fileHandle ? 'text-emerald-400' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors`} />
                            </div>
                            <div className="text-center">
                                <p className="text-[11px] font-bold text-slate-200 truncate w-56 px-4">
                                    {fileHandle ? fileHandle.name : 'Target Log File'}
                                </p>
                                {!fileHandle && <p className="text-[8px] text-slate-500 uppercase font-black mt-1 tracking-wider">Drop or Click to Upload</p>}
                            </div>
                            {!fileHandle && (
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setFileHandle({ path: window.electronAPI.getFilePath(f), name: f.name });
                                }} />
                            )}
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
                                    value={perfThreshold === 0 ? '' : perfThreshold}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/^0+/, '');
                                        const val = raw === '' ? 0 : parseInt(raw);
                                        if (!isNaN(val)) setPerfThreshold(val);
                                    }}
                                    placeholder="0"
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

                                <div className="space-y-1.5">
                                    {dangerLevels.map((lvl, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group p-1.5 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5 transition-all">
                                            <div className="relative shrink-0 ml-1">
                                                <input
                                                    type="color"
                                                    className="w-5 h-5 rounded-md cursor-pointer bg-transparent border-none p-0 overflow-hidden shadow-sm hover:scale-110 transition-transform"
                                                    value={lvl.color}
                                                    onChange={(e) => updateDangerLevel(idx, { color: e.target.value })}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                className="flex-1 bg-slate-950/40 text-[11px] text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700/20 focus:outline-none focus:border-indigo-500/50 min-w-0 font-medium"
                                                value={lvl.label}
                                                onChange={(e) => updateDangerLevel(idx, { label: e.target.value })}
                                                placeholder="Label"
                                            />
                                            <div className="flex items-center bg-slate-950/60 rounded-lg border border-slate-700/20 px-3 py-1.5 shrink-0">
                                                <input
                                                    type="text"
                                                    className="w-14 bg-transparent text-[11px] font-mono text-indigo-400 text-right focus:outline-none"
                                                    value={lvl.ms === 0 ? '' : lvl.ms}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '');
                                                        const val = raw === '' ? 0 : parseInt(raw);
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
                                isActive={true}
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
