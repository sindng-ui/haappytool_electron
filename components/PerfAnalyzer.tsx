import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { useHappyTool } from '../contexts/HappyToolContext';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';


const {
  Gauge, FileText, Settings, Play, Trash2, Clock, TrendingUp, Flame,
  CheckCircle2, Info, ChevronDown, List, BarChart3, Target, Loader2, UploadCloud, ChevronUp, AlertTriangle, Activity,
  Maximize2, Minimize2, PieChart, Table2
} = Lucide;

interface AnalysisSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  startLine: number;
  endLine: number;
  type: 'combo' | 'manual' | 'step';
  familyId?: string;
  status: 'pass' | 'fail';
  logs: string[]; // Stores [startLineContent, endLineContent] for combos
}

interface AnalysisResult {
  fileName: string;
  totalDuration: number;
  segments: AnalysisSegment[];
  startTime: number;
  endTime: number;
  logCount: number;
  passCount: number;
  failCount: number;
}

const PerfAnalyzer: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const { logRules } = useHappyTool();
  const { addToast } = useToast();

  // -- State --
  const [fileHandle, setFileHandle] = useState<{ path: string; name: string } | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [targetTime, setTargetTime] = useState<number>(1000);
  const [thresholdMs, setThresholdMs] = useState<number>(200);
  const [startLine, setStartLine] = useState<string>('');
  const [endLine, setEndLine] = useState<string>('');
  const [usePatterns, setUsePatterns] = useState(false);
  const [startPattern, setStartPattern] = useState('');
  const [endPattern, setEndPattern] = useState('');
  const [topCount, setTopCount] = useState<number>(30);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // -- Comparative Mode --
  const [comparisonFileHandle, setComparisonFileHandle] = useState<{ path: string; name: string } | null>(null);
  const [comparisonResult, setComparisonResult] = useState<AnalysisResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // -- UI Details --
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
  const [vizTab, setVizTab] = useState<'timeline' | 'flame'>('flame');
  const [flameZoom, setFlameZoom] = useState<{ startTime: number; endTime: number } | null>(null);
  const [flameExpanded, setFlameExpanded] = useState(false);

  // -- Persistence --
  useEffect(() => {
    const saved = localStorage.getItem('happytool_perf_analyzer_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.selectedRuleId) setSelectedRuleId(parsed.selectedRuleId);
        if (parsed.targetTime) setTargetTime(parsed.targetTime);
        if (parsed.thresholdMs) setThresholdMs(parsed.thresholdMs);
        if (parsed.startLine !== undefined) setStartLine(parsed.startLine);
        if (parsed.endLine !== undefined) setEndLine(parsed.endLine);
        if (parsed.usePatterns !== undefined) setUsePatterns(parsed.usePatterns);
        if (parsed.startPattern !== undefined) setStartPattern(parsed.startPattern);
        if (parsed.endPattern !== undefined) setEndPattern(parsed.endPattern);
        if (parsed.fileHandle) setFileHandle(parsed.fileHandle);
        if (parsed.topCount) setTopCount(parsed.topCount);
      } catch (e) {
        console.error("Failed to load perf analyzer settings", e);
      }
    }
  }, []);

  useEffect(() => {
    const settings = {
      selectedRuleId,
      targetTime,
      thresholdMs,
      startLine,
      endLine,
      usePatterns,
      startPattern,
      endPattern,
      fileHandle,
      topCount
    };
    localStorage.setItem('happytool_perf_analyzer_settings', JSON.stringify(settings));
  }, [selectedRuleId, targetTime, thresholdMs, startLine, endLine, usePatterns, startPattern, endPattern, fileHandle, topCount]);

  const selectedRule = useMemo(() =>
    logRules.find(r => r.id === selectedRuleId),
    [logRules, selectedRuleId]);

  const familyColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const palette = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
    selectedRule?.familyCombos?.forEach((c, i) => {
      colors[c.id] = palette[i % palette.length];
    });
    return colors;
  }, [selectedRule]);

  // -- Effects --
  useEffect(() => {
    if (logRules.length > 0 && !selectedRuleId) {
      // Only set default if no id is loaded from localStorage
      const saved = localStorage.getItem('happytool_perf_analyzer_settings');
      if (!saved || !JSON.parse(saved).selectedRuleId) {
        setSelectedRuleId(logRules[0].id);
      }
    }
  }, [logRules, selectedRuleId]);

  const flameSegments = useMemo(() => {
    if (!result) return [];
    // StartTime ASC, Duration DESC, Line ASC sequence for stable hierarchical stacking
    const sorted = [...result.segments].sort((a, b) => (a.startTime - b.startTime) || (b.duration - a.duration) || (a.startLine - b.startLine));
    const lanes: number[] = [];
    const totalDuration = result.endTime - result.startTime;
    // Reserve ~2% of visual space per item to ensure labels are readable and prevent cramping
    // This will force rapid sequential items to stack vertically (waterfall effect)
    const minVisualDuration = totalDuration * 0.02;

    return sorted.map(s => {
      let lane = 0;

      // Calculate effective end time for collision purposes (visual reservation)
      const effectiveEndTime = Math.max(s.endTime, s.startTime + minVisualDuration);

      // Find a lane where previous item ends before current item starts
      while (lanes[lane] !== undefined && lanes[lane] > s.startTime) {
        lane++;
      }

      // Update the lane with the effective end time
      lanes[lane] = effectiveEndTime;

      return {
        ...s,
        lane,
        relStart: (s.startTime - result.startTime) / 1000,
        relEnd: (s.endTime - result.startTime) / 1000,
        width: Math.max(0, (s.duration / 1000))
      };
    });
  }, [result]);

  const maxLane = useMemo(() => {
    if (!flameSegments.length) return 4; // Min guaranteed lanes
    return Math.max(4, ...flameSegments.map(s => s.lane));
  }, [flameSegments]);

  // -- Handlers --
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      let path = '';
      if (window.electronAPI?.getFilePath) {
        path = window.electronAPI.getFilePath(file);
      } else {
        path = (file as any).path;
      }

      if (!path) {
        addToast("Cannot access local file path. Please ensure you're using the Desktop app.", "error");
        return;
      }
      setFileHandle({ path, name: file.name });
      addToast(`File loaded: ${file.name}`, 'success');
    }
  };

  const parseTimestamp = (line: string): number | null => {
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}[\.,]\d{3})/);
    if (!timeMatch) return null;

    const timeStr = timeMatch[1].replace(',', '.');
    const [h, m, s_ms] = timeStr.split(':');
    const [s, ms] = s_ms.split('.');

    return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms);
  };

  const runAnalysis = useCallback(async () => {
    if (!fileHandle?.path) {
      addToast("Please load a log file first (Path missing)", "error");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setSelectedSegmentId(null);
    setFlameZoom(null);

    const requestId = Math.random().toString(36).substring(7);
    const segments: AnalysisSegment[] = [];
    let firstTimestamp = 0;
    let lastTimestamp = 0;
    let logCount = 0;
    let currentLine = 0;
    let detectedStartLine: number | null = null;
    let detectedEndLine: number | null = null;

    const startIdx = parseInt(startLine) || 0;
    const endIdx = parseInt(endLine) || Infinity;

    let startLineFound = !usePatterns;
    let endLineFound = false;

    const activeCombos: Map<string, { start: number; line: number; content: string }> = new Map();
    let lastEventTimestamp = 0;
    let lastEventContent = '';
    let lastEventLine = 0;
    let lastEventName = '';

    // Specific listeners for stream
    let offChunk: (() => void) | undefined;
    let offComplete: (() => void) | undefined;
    let offError: (() => void) | undefined;

    const cleanup = () => {
      if (offChunk) offChunk();
      if (offComplete) offComplete();
      if (offError) offError();
    };

    const hasAnyPositiveFilter = selectedRule ? (
      (selectedRule.happyGroups?.some(g => g.enabled && g.tags.length > 0)) ||
      (selectedRule.includeGroups?.some(g => g.some(t => t.trim()))) ||
      (selectedRule.familyCombos?.some(c => c.enabled))
    ) : false;
    const isHappyCS = selectedRule?.happyCombosCaseSensitive;
    const isBlockCS = selectedRule?.blockListCaseSensitive;

    const onChunk = (data: { chunk: string; requestId: string }) => {
      if (data.requestId !== requestId) return;

      const lines = data.chunk.split(/\r?\n/);
      for (const line of lines) {
        currentLine++;
        const lineLower = isHappyCS ? '' : line.toLowerCase();

        if (endLineFound) break;

        if (!startLineFound) {
          if (usePatterns && startPattern && line.includes(startPattern)) {
            startLineFound = true;
          } else if (!usePatterns && currentLine >= startIdx) {
            startLineFound = true;
          } else {
            continue;
          }
        }

        if (usePatterns && endPattern && line.includes(endPattern)) {
          endLineFound = true;
        } else if (!usePatterns && endIdx !== Infinity && currentLine > endIdx) {
          endLineFound = true;
          break;
        }

        // ✅ Mission Filtering (Happy Combo / Family Combo / Block List)
        if (selectedRule) {
          // 1. Block List Check
          const isBlocked = selectedRule.excludes?.some(exc => {
            const tExc = exc.trim();
            if (!tExc) return false;
            return isBlockCS
              ? line.includes(tExc)
              : lineLower.includes(tExc.toLowerCase());
          });
          if (isBlocked) continue;

          // 2. Combined Happy/Family Filter
          const checkIncludes = () => {
            // a. Happy Groups (New)
            if (selectedRule.happyGroups) {
              const matched = selectedRule.happyGroups.some(g =>
                g.enabled && g.tags.length > 0 && g.tags.every(tag =>
                  isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase())
                )
              );
              if (matched) return true;
            }

            // b. Include Groups (Legacy)
            if (selectedRule.includeGroups) {
              const matched = selectedRule.includeGroups.some(g => {
                const tags = g.filter(t => t.trim());
                return tags.length > 0 && tags.every(tag =>
                  isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase())
                );
              });
              if (matched) return true;
            }

            // c. Family Combos (Tags)
            if (selectedRule.familyCombos) {
              const matched = selectedRule.familyCombos.some(combo => {
                if (!combo.enabled) return false;
                // Check Start/End/Middle tags with proper AND condition per group
                const checkTags = (tags: string[]) => tags.length > 0 && tags.every(t =>
                  isHappyCS ? line.includes(t) : lineLower.includes(t.toLowerCase())
                );

                if (checkTags(combo.startTags)) return true;
                if (checkTags(combo.endTags)) return true;
                if (combo.middleTags?.some(branch => checkTags(branch))) return true;
                return false;
              });
              if (matched) return true;
            }

            return !hasAnyPositiveFilter;
          };

          if (!checkIncludes()) continue;
        }

        // ✅ Track detected mission range
        if (detectedStartLine === null) detectedStartLine = currentLine;
        detectedEndLine = currentLine;

        logCount++;
        const ts = parseTimestamp(line);
        if (ts !== null) {
          if (firstTimestamp === 0) {
            firstTimestamp = ts;
            // Initialize first event context
            lastEventTimestamp = ts;
            lastEventContent = line;
            lastEventLine = currentLine;
          }
          lastTimestamp = ts;

          if (selectedRule?.familyCombos) {
            const lineTarget = isHappyCS ? line : line.toLowerCase();
            for (const combo of selectedRule.familyCombos) {
              if (!combo.enabled) continue;

              const checkTags = (tags: string[]) => tags.length > 0 && tags.every(t =>
                lineTarget.includes(isHappyCS ? t : t.toLowerCase())
              );

              if (activeCombos.has(combo.id)) {
                if (checkTags(combo.endTags)) {
                  const startData = activeCombos.get(combo.id)!;
                  const duration = ts - startData.start;
                  segments.push({
                    id: Math.random().toString(36).substring(7),
                    name: combo.name,
                    startTime: startData.start,
                    endTime: ts,
                    duration,
                    startLine: startData.line,
                    endLine: currentLine,
                    type: 'combo',
                    familyId: combo.id,
                    status: duration > targetTime ? 'fail' : 'pass',
                    logs: [startData.content, line]
                  });
                  activeCombos.delete(combo.id);
                  lastEventTimestamp = ts;
                  lastEventContent = line;
                  lastEventLine = currentLine;
                  lastEventName = combo.name;
                }
              }

              if (checkTags(combo.startTags)) {
                activeCombos.set(combo.id, { start: ts, line: currentLine, content: line });
              }
            }
          }


          // ✅ Record Happy Combo (Happy Groups) as Point Events
          let eventProcessed = false;

          if (selectedRule.happyGroups) {
            for (const g of selectedRule.happyGroups) {
              if (eventProcessed) break;
              if (!g.enabled || g.tags.length === 0) continue;

              const matched = g.tags.every(tag => isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase()));
              if (matched) {
                const duration = lastEventTimestamp > 0 ? ts - lastEventTimestamp : 0;
                // Only consider it a valid duration step if lines are different and we have history
                const hasPrevLog = lastEventTimestamp > 0 && lastEventLine !== currentLine;
                const currentName = g.tags[0] || 'Event';

                segments.push({
                  id: Math.random().toString(36).substring(7),
                  name: hasPrevLog && lastEventName ? `${lastEventName} ~ ${currentName}` : currentName,
                  startTime: hasPrevLog ? lastEventTimestamp : ts,
                  endTime: ts,
                  duration: duration,
                  startLine: hasPrevLog ? lastEventLine : currentLine,
                  endLine: currentLine,
                  type: 'step',
                  status: duration > targetTime ? 'fail' : 'pass',
                  logs: hasPrevLog ? [lastEventContent, line] : [line]
                });

                lastEventTimestamp = ts;
                lastEventContent = line;
                lastEventLine = currentLine;
                lastEventName = currentName;
                eventProcessed = true;
              }
            }
          }

          // ✅ Record Legacy Include Groups as Point Events (Only if not already processed)
          if (!eventProcessed && selectedRule.includeGroups) {
            for (const g of selectedRule.includeGroups) {
              if (eventProcessed) break;
              const tags = g.filter(t => t.trim());
              if (tags.length === 0) continue;

              const matched = tags.every(tag => isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase()));
              if (matched) {
                const duration = lastEventTimestamp > 0 ? ts - lastEventTimestamp : 0;
                const hasPrevLog = lastEventTimestamp > 0 && lastEventLine !== currentLine;
                const currentName = tags[0];

                segments.push({
                  id: Math.random().toString(36).substring(7),
                  name: hasPrevLog && lastEventName ? `${lastEventName} ~ ${currentName}` : currentName,
                  startTime: hasPrevLog ? lastEventTimestamp : ts,
                  endTime: ts,
                  duration: duration,
                  startLine: hasPrevLog ? lastEventLine : currentLine,
                  endLine: currentLine,
                  type: 'step',
                  status: duration > targetTime ? 'fail' : 'pass',
                  logs: hasPrevLog ? [lastEventContent, line] : [line]
                });

                lastEventTimestamp = ts;
                lastEventContent = line;
                lastEventLine = currentLine;
                lastEventName = currentName;
                eventProcessed = true;
              }
            }
          }
        }
      }
    };

    const onComplete = (data: { requestId: string }) => {
      if (data.requestId !== requestId) return;
      cleanup();

      const finishedResult: AnalysisResult = {
        fileName: fileHandle.name,
        totalDuration: lastTimestamp - firstTimestamp,
        segments: segments.sort((a, b) => a.startTime - b.startTime),
        startTime: firstTimestamp,
        endTime: lastTimestamp,
        logCount,
        passCount: segments.filter(s => s.status === 'pass').length,
        failCount: segments.filter(s => s.status === 'fail').length
      };

      if (viewMode === 'compare' && isComparing) {
        setComparisonResult(finishedResult);
        setIsComparing(false);
      } else {
        setResult(finishedResult);
      }

      const saved = localStorage.getItem('happytool_perf_analyzer_settings');
      if (detectedStartLine !== null) setStartLine(detectedStartLine.toString());
      if (detectedEndLine !== null) setEndLine(detectedEndLine.toString());

      setIsAnalyzing(false);
      addToast("Analysis complete", "success");
    };

    const onError = (data: { error: string; requestId: string }) => {
      if (data.requestId !== requestId) return;
      setIsComparing(false);
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
  }, [fileHandle, selectedRule, startLine, endLine, usePatterns, startPattern, endPattern, targetTime, addToast, isComparing, viewMode]);

  // -- Advanced Analytics --
  const stats = useMemo(() => {
    if (!result) return null;
    const groups: Record<string, number[]> = {};
    result.segments.forEach(s => {
      if (!groups[s.name]) groups[s.name] = [];
      groups[s.name].push(s.duration);
    });

    return Object.entries(groups).map(([name, durs]) => {
      const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
      const max = Math.max(...durs);
      const min = Math.min(...durs);
      const stdDev = Math.sqrt(durs.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / durs.length);
      const total = durs.reduce((a, b) => a + b, 0);
      return { name, avg, max, min, stdDev, total, count: durs.length };
    }).sort((a, b) => b.total - a.total);
  }, [result]);

  const topBottlenecks = useMemo(() => {
    if (!result) return [];
    return [...result.segments].sort((a, b) => b.duration - a.duration).slice(0, 5);
  }, [result]);

  const selectedSegment = useMemo(() =>
    result?.segments.find(s => s.id === selectedSegmentId) ||
    comparisonResult?.segments.find(s => s.id === selectedSegmentId),
    [result, comparisonResult, selectedSegmentId]);

  // Summary stats grouped by event name (for Summary tab)
  const summaryGroups = useMemo(() => {
    if (!result) return [];
    const groups: Record<string, { count: number; total: number; max: number; min: number }> = {};
    result.segments.forEach(s => {
      if (!groups[s.name]) groups[s.name] = { count: 0, total: 0, max: 0, min: Infinity };
      groups[s.name].count++;
      groups[s.name].total += s.duration;
      groups[s.name].max = Math.max(groups[s.name].max, s.duration);
      groups[s.name].min = Math.min(groups[s.name].min, s.duration);
    });
    const maxTotal = Math.max(...Object.values(groups).map(g => g.total), 1);
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([name, g]) => ({ name, ...g, maxTotal }));
  }, [result]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0b0f19] text-slate-200 overflow-hidden">
      {/* System Header */}
      <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-[#0f172a] to-[#0d1321]">
        <div className="flex items-center gap-3 no-drag">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-lg text-indigo-400 shadow-lg shadow-indigo-500/5"><Gauge size={14} className="icon-glow" /></div>
          <span className="font-black text-xs text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 tracking-wide">Perf Analyzer Max</span>
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full no-drag backdrop-blur-sm">
            <Loader2 size={10} className="animate-spin text-indigo-400" />
            <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider">Analyzing Scope...</span>
          </div>
        )}
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Config Sidebar */}
        <aside className="w-80 border-r border-white/5 flex flex-col bg-slate-900/40 backdrop-blur-sm z-20">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            {/* Primary Log Upload */}
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

            {/* Comparison Log Upload */}
            <div className={`group relative border-2 border-dashed rounded-3xl p-4 flex flex-col items-center gap-2 transition-all duration-300 ${comparisonFileHandle ? 'border-sky-500/30 bg-sky-500/5 shadow-lg shadow-sky-500/5' : 'border-white/5 hover:border-sky-500/50 opacity-50 hover:opacity-80'}`}>
              <Activity size={18} className={`${comparisonFileHandle ? 'text-sky-400' : 'text-slate-600 group-hover:text-sky-400'} transition-colors`} />
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 truncate w-56 px-4">
                  {comparisonFileHandle ? comparisonFileHandle.name : 'Reference Log (Optional)'}
                </p>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setComparisonFileHandle({ path: window.electronAPI.getFilePath(f), name: f.name });
              }} />
            </div>

            {/* Mission & Controls */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 tracking-wider"><Settings size={12} className="text-indigo-400" /> Mission Profile</label>
                <select value={selectedRuleId} onChange={(e) => setSelectedRuleId(e.target.value)} className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] outline-none focus:border-indigo-500/40 transition-colors">
                  {logRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Limit (ms)</span>
                  <input type="number" value={targetTime} onChange={e => setTargetTime(parseInt(e.target.value))} className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2 text-xs focus:border-indigo-500/50 outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Diff Target</span>
                  <button onClick={() => setViewMode(viewMode === 'single' ? 'compare' : 'single')} className={`w-full py-2 rounded-xl border text-[10px] font-bold transition-all ${viewMode === 'compare' ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'border-white/5 text-slate-500 hover:border-white/10'}`}>
                    {viewMode === 'compare' ? 'COMPARE ON' : 'SINGLE MODE'}
                  </button>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase px-1 tracking-wider">
                  <span>Range Analysis</span>
                  <button onClick={() => setUsePatterns(!usePatterns)} className="text-indigo-400 hover:text-indigo-300 transition-colors">{usePatterns ? 'Keyword' : 'Line Index'}</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Start" value={usePatterns ? startPattern : startLine} onChange={e => usePatterns ? setStartPattern(e.target.value) : setStartLine(e.target.value)} className="bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2 text-[11px] outline-none focus:border-indigo-500/40 transition-colors" />
                  <input type="text" placeholder="End" value={usePatterns ? endPattern : endLine} onChange={e => usePatterns ? setEndPattern(e.target.value) : setEndLine(e.target.value)} className="bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2 text-[11px] outline-none focus:border-indigo-500/40 transition-colors" />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-white/5 space-y-3">
            <button onClick={runAnalysis} disabled={isAnalyzing || !fileHandle} className={`w-full py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 ${fileHandle ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/20' : 'bg-slate-800 text-slate-600'}`}>
              {isAnalyzing ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Play size={14} /> Run Analysis</>}
            </button>
            {viewMode === 'compare' && (
              <button onClick={() => { setIsComparing(true); runAnalysis(); }} disabled={isAnalyzing || !comparisonFileHandle} className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase transition-all ${comparisonFileHandle ? 'bg-sky-600/20 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30' : 'bg-slate-800/50 text-slate-600'}`}>
                Run Reference Analysis
              </button>
            )}
          </div>
        </aside>

        {/* Dash/Visualization Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f19]">
          <AnimatePresence mode="wait">
            {!result ? (
              <div className="flex-1 flex flex-col items-center justify-center select-none">
                {/* Animated Orbital System - only animate when active */}
                <div className="relative w-56 h-56 mb-10">
                  {/* Outermost glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }}
                    animate={isActive ? { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] } : { scale: 1, opacity: 0.5 }}
                    transition={{ duration: 4, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
                  />

                  {/* Rotating outer ring */}
                  <motion.div
                    className="absolute inset-4 rounded-full border border-indigo-500/10"
                    animate={isActive ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 20, repeat: isActive ? Infinity : 0, ease: 'linear' }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500/40 shadow-lg shadow-indigo-500/30" />
                  </motion.div>

                  {/* Rotating middle ring (reverse) */}
                  <motion.div
                    className="absolute inset-10 rounded-full border border-purple-500/10"
                    animate={isActive ? { rotate: -360 } : { rotate: 0 }}
                    transition={{ duration: 15, repeat: isActive ? Infinity : 0, ease: 'linear' }}
                  >
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-500/50 shadow-lg shadow-purple-500/30" />
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1 h-1 rounded-full bg-sky-400/50 shadow-lg shadow-sky-400/30" />
                  </motion.div>

                  {/* Inner dash ring */}
                  <motion.div
                    className="absolute inset-16 rounded-full"
                    style={{ border: '1px dashed rgba(99,102,241,0.15)' }}
                    animate={isActive ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 30, repeat: isActive ? Infinity : 0, ease: 'linear' }}
                  />

                  {/* Center icon with breathing glow */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="relative"
                      animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={{ duration: 3, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
                    >
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 bg-indigo-500/15 rounded-2xl blur-xl scale-150"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                      <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-5 rounded-2xl border border-indigo-500/20 shadow-2xl shadow-indigo-500/10 backdrop-blur-sm">
                        <Gauge size={40} className="text-indigo-400/70" />
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Text */}
                <h2 className="text-lg font-black tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-400/70 via-purple-400/70 to-indigo-400/70">
                  Select Log to Begin
                </h2>
                <p className="text-[10px] text-slate-600 mt-3 font-medium tracking-[0.15em] uppercase opacity-60">
                  Upload a log file and run analysis
                </p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
                {/* Dynamic Stats Bar */}
                <div className="flex items-center gap-4 px-6 pt-6 overflow-x-auto no-scrollbar pb-2 shrink-0">

                  {/* Stability Index (Part of Feature 1) */}
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl px-4 py-3 flex items-center gap-3 shrink-0">
                    <Activity size={16} className="text-indigo-400" />
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase">Stability</p>
                      <p className="text-sm font-black text-indigo-300">{Math.round((result.passCount / result.segments.length) * 100)}%</p>
                    </div>
                  </div>

                  {/* Total Time Contribution (Feature 3 Insight) */}
                  {stats?.slice(0, 3).map(stat => (
                    <div key={stat.name} className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3 shrink-0">
                      <span className="w-1.5 h-6 rounded-full bg-indigo-500/30" />
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase truncate w-24">{stat.name}</p>
                        <p className="text-sm font-black text-slate-200">{Math.round((stat.total / result.totalDuration) * 100)}% Time</p>
                      </div>
                    </div>
                  ))}

                  {/* Visualization Tabs */}
                  <div className="ml-auto flex items-center gap-1 bg-white/5 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => setVizTab('timeline')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${vizTab === 'timeline' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Table2 size={12} /> Summary
                    </button>
                    <button
                      onClick={() => setVizTab('flame')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${vizTab === 'flame' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Flame size={12} /> Flame Map
                    </button>
                  </div>
                </div>

                {/* Main Absolute Timeline Chart (Improved) */}
                <div className={`${flameExpanded ? 'h-[600px]' : 'h-80'} mt-4 px-6 shrink-0 relative transition-all duration-300`}>
                  <AnimatePresence mode="wait">
                    {vizTab === 'timeline' ? (
                      <motion.div
                        key="summary"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="h-full w-full bg-slate-900/40 rounded-[32px] border border-white/5 p-6 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                            <Table2 size={10} className="text-indigo-400" /> Event Summary &amp; Statistics
                          </div>
                        </div>

                        <div className="h-[calc(100%-32px)] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-[10px]">
                            <thead className="sticky top-0 bg-slate-900/95 z-10">
                              <tr className="text-slate-500 uppercase font-black">
                                <th className="text-left py-2 px-2">Event Name</th>
                                <th className="text-right py-2 px-2">Count</th>
                                <th className="text-right py-2 px-2">Total</th>
                                <th className="text-right py-2 px-2">Avg</th>
                                <th className="text-right py-2 px-2">Max</th>
                                <th className="text-right py-2 px-2">Min</th>
                                <th className="text-left py-2 px-2 w-40">Distribution</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryGroups.map(g => (
                                <tr key={g.name} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="py-2 px-2 font-bold text-slate-200 truncate max-w-[200px]" title={g.name}>{g.name}</td>
                                  <td className="text-right py-2 px-2 text-slate-400 font-mono">{g.count}</td>
                                  <td className="text-right py-2 px-2 text-slate-200 font-black font-mono">{g.total}ms</td>
                                  <td className="text-right py-2 px-2 text-slate-400 font-mono">{Math.round(g.total / g.count)}ms</td>
                                  <td className={`text-right py-2 px-2 font-mono font-bold ${g.max > targetTime ? 'text-rose-400' : 'text-slate-400'}`}>{g.max}ms</td>
                                  <td className="text-right py-2 px-2 text-slate-400 font-mono">{g.min === Infinity ? '-' : `${g.min}ms`}</td>
                                  <td className="py-2 px-2">
                                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${g.max > targetTime ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${(g.total / g.maxTotal) * 100}%` }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="flame"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="h-full w-full bg-slate-900/40 rounded-[32px] border border-white/5 p-6 flex flex-col group/flame overflow-hidden relative"
                        onWheel={(e) => {
                          if (e.ctrlKey) {
                            // Zoom Logic
                            e.preventDefault();
                            const sensitivity = 0.001;
                            const delta = -e.deltaY * sensitivity;
                            const zoomFactor = Math.exp(delta); // Gives smooth zooming

                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left - 24; // 24 is padding-left
                            const width = rect.width - 48; // 48 is total horizontal padding
                            const ratio = Math.max(0, Math.min(1, x / width));

                            const currentStart = flameZoom ? flameZoom.startTime : result.startTime;
                            const currentEnd = flameZoom ? flameZoom.endTime : result.endTime;
                            const currentDuration = currentEnd - currentStart;

                            const newDuration = currentDuration / zoomFactor;
                            const focusTime = currentStart + (currentDuration * ratio);

                            let newStart = focusTime - (newDuration * ratio);
                            let newEnd = newStart + newDuration;

                            // Clamp to max bounds
                            if (newStart < result.startTime) {
                              newStart = result.startTime;
                              newEnd = Math.min(result.endTime, newStart + newDuration);
                            }
                            if (newEnd > result.endTime) {
                              newEnd = result.endTime;
                              newStart = Math.max(result.startTime, newEnd - newDuration);
                            }
                            // If trying to zoom out beyond limits, reset
                            if (newDuration >= (result.endTime - result.startTime)) {
                              setFlameZoom(null);
                            } else {
                              setFlameZoom({ startTime: newStart, endTime: newEnd });
                            }
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-2 shrink-0">
                          <div className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                            <Flame size={10} className="text-rose-400" /> Hierarchical Flame Map {flameZoom && <span className="text-indigo-400 font-bold ml-2 animate-pulse">[ZOOM x{((result.totalDuration) / (flameZoom.endTime - flameZoom.startTime)).toFixed(1)}]</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 opacity-50 text-[8px] font-medium text-slate-400 mr-2">
                              <span className="px-1 border border-slate-600 rounded">Ctrl</span> + <span className="px-1 border border-slate-600 rounded">Wheel</span> to Zoom
                            </div>
                            {flameZoom && (
                              <button
                                onClick={() => setFlameZoom(null)}
                                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[8px] font-black text-slate-300 transition-colors uppercase border border-white/10"
                              >
                                Reset Zoom
                              </button>
                            )}
                            <button
                              onClick={() => setFlameExpanded(v => !v)}
                              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[8px] font-black text-slate-300 transition-colors uppercase border border-white/10 flex items-center gap-1"
                            >
                              {flameExpanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                              {flameExpanded ? 'Collapse' : 'Expand'}
                            </button>
                            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                              Window: {flameZoom ? (((flameZoom.endTime - flameZoom.startTime) / 1000).toFixed(3)) : ((result.totalDuration / 1000).toFixed(3))}s
                            </div>
                          </div>
                        </div>

                        {/* Time Axis (Dynamic) */}
                        <div className="h-6 w-full flex items-end relative border-b border-white/10 mb-1 select-none overflow-hidden">
                          {(() => {
                            const start = flameZoom ? flameZoom.startTime : result.startTime;
                            const end = flameZoom ? flameZoom.endTime : result.endTime;
                            const duration = end - start;

                            // Determine optimal interval
                            const targetTicks = 10;
                            const rawInterval = duration / targetTicks;

                            // Find closest nice interval
                            const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
                            const normalized = rawInterval / magnitude;

                            let niceScalar = 1;
                            if (normalized < 1.5) niceScalar = 1;
                            else if (normalized < 3) niceScalar = 2;
                            else if (normalized < 7) niceScalar = 5;
                            else niceScalar = 10;

                            const interval = niceScalar * magnitude;

                            // Calculate first visible tick
                            const absoluteStartOffset = start - result.startTime;
                            const firstTickTime = Math.ceil(absoluteStartOffset / interval) * interval;

                            const ticks = [];
                            let currentTick = firstTickTime;
                            const endOffset = end - result.startTime;

                            // Limit ticks to avoid infinite loops if interval is 0
                            if (interval > 0) {
                              while (currentTick <= endOffset) {
                                ticks.push(currentTick);
                                currentTick += interval;
                              }
                            }

                            return ticks.map((timeOffset, i) => {
                              const posInView = timeOffset - absoluteStartOffset;
                              const left = (posInView / duration) * 100;

                              // Don't render if too close to edges
                              if (left < 0 || left > 100) return null;

                              return (
                                <div key={`tick-${timeOffset.toFixed(1)}`} className="absolute bottom-0 flex flex-col items-center pointer-events-none" style={{ left: `${left}%`, transform: 'translateX(-50%)' }}>
                                  <div className="h-1.5 w-px bg-slate-600"></div>
                                  <span className="text-[9px] font-mono text-slate-400 mt-0.5 whitespace-nowrap font-bold">+{(timeOffset / 1000).toFixed(interval < 1000 ? 3 : 2)}s</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-black/40 rounded-3xl p-6 border border-white/5 relative shadow-inner">
                          <div
                            className="relative min-w-full transition-all duration-500 ease-out"
                            style={{
                              height: `${(maxLane + 1) * 36}px`,
                              width: '100%'
                            }}
                          >
                            {flameSegments.map(s => {
                              const isSelected = s.id === selectedSegmentId;
                              const isBottleneck = s.duration > targetTime;

                              // Zoom Logic
                              const viewStart = flameZoom ? flameZoom.startTime : result.startTime;
                              const viewEnd = flameZoom ? flameZoom.endTime : result.endTime;
                              const viewDuration = viewEnd - viewStart;

                              // Skip if completely outside zoom range with buffer
                              // Buffer is needed because text might be visible even if bar start is just offscreen
                              const buffer = viewDuration * 0.5;
                              if (s.endTime < viewStart - buffer || s.startTime > viewEnd + buffer) return null;

                              const left = ((s.startTime - viewStart) / viewDuration) * 100;
                              const width = ((s.endTime - s.startTime) / viewDuration) * 100;

                              return (
                                <motion.div
                                  key={s.id}
                                  layoutId={`flame-${s.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSegmentId(s.id);
                                  }}
                                  onDoubleClick={() => {
                                    // Focus zoom on this segment with some padding
                                    const padding = s.duration * 0.1;
                                    setFlameZoom({
                                      startTime: Math.max(result.startTime, s.startTime - padding),
                                      endTime: Math.min(result.endTime, s.endTime + padding)
                                    });
                                  }}
                                  className={`absolute h-6 rounded-lg flex items-center px-2 cursor-pointer transition-all border group/item ${isSelected
                                    ? 'z-30 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-[1.02]'
                                    : 'z-10 border-transparent hover:border-white/40 hover:z-20'
                                    }`}
                                  style={{
                                    left: `${left}%`,
                                    width: `${Math.max(1, width)}%`,
                                    top: `${s.lane * 36}px`,
                                    backgroundColor: isSelected
                                      ? '#818cf8'
                                      : (isBottleneck ? '#f43f5e' : (familyColors[s.familyId || ''] || '#6366f1')),
                                    opacity: isSelected ? 1 : 0.85
                                  }}
                                >
                                  <span className="text-[7.5px] font-black text-white leading-none truncate uppercase drop-shadow-sm pointer-events-none">
                                    {width > 2 && `${s.name} (${s.duration}ms)`}
                                  </span>

                                  {/* Tooltip on hover for small items */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[7px] rounded opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/10 shadow-xl">
                                    {s.name}: {s.duration}ms | Double-click to zoom
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer Details Grid */}
                <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                  {/* Left: Top 10 Bottlenecks (Feature Request) - Reduced Width */}
                  <div className="col-span-3 flex flex-col gap-6 overflow-hidden">
                    <div className="flex-1 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between bg-white/2">
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp size={14} className="animate-pulse" /> Top <input
                            type="number"
                            value={topCount}
                            onChange={e => setTopCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-10 bg-transparent border-b border-rose-400/40 text-rose-400 text-center text-[10px] font-black mx-1 outline-none focus:border-rose-400"
                            min={1}
                          /> Bottlenecks
                        </span>
                        <span className="text-[9px] font-bold text-slate-500">SORTED BY DURATION</span>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        <div className="space-y-1">
                          {[...result.segments].sort((a, b) => b.duration - a.duration).slice(0, topCount).map((s, idx) => (
                            <div
                              key={s.id}
                              onClick={() => setSelectedSegmentId(s.id)}
                              className={`group px-2.5 py-2 rounded-xl flex items-center justify-between hover:bg-white/5 cursor-pointer transition-all border border-transparent ${selectedSegmentId === s.id ? 'bg-indigo-500/10 border-indigo-500/20' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${idx < 3 ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-slate-500'}`}>
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-[10px] font-black text-slate-200 group-hover:text-indigo-400 transition-colors uppercase truncate w-32">{s.name}</p>
                                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                    L{s.startLine} {s.type === 'combo' ? `→ L${s.endLine}` : ''} • T+{(s.startTime - result.startTime) / 1000}s
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-[11px] font-black ${s.duration > targetTime ? 'text-rose-400' : 'text-amber-400'}`}>{s.duration}ms</p>
                                <div className="h-1 w-14 bg-white/5 rounded-full mt-0.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${s.duration > targetTime ? 'bg-rose-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(100, (s.duration / Math.max(...result.segments.map(d => d.duration))) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Log Context & Detail (Feature 2) - Increased Width */}
                  <div className="col-span-9 flex flex-col bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden relative">
                    <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between shrink-0">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <FileText size={14} className="text-sky-400" /> Log Trace Selection
                      </span>
                      {selectedSegment && (
                        <div className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-indigo-400 border border-indigo-500/20">
                          L{selectedSegment.startLine} matched
                        </div>
                      )}
                    </div>

                    {!selectedSegment ? (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-20 italic text-[11px]">
                        Click a segment or chart bar to see raw trace
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
                        <div className="p-3 bg-indigo-500/5 border-b border-white/5 shrink-0">
                          <h4 className="text-[11px] font-black text-white">{selectedSegment.name}</h4>
                          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-black mt-1">
                            <span className="flex items-center gap-1"><Clock size={10} /> {selectedSegment.duration}ms</span>
                            <span className="flex items-center gap-1"><Target size={10} /> Line {selectedSegment.startLine}</span>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-slate-300 selection:bg-indigo-500/30">
                          {(() => {
                            // If combo, find all internal logs
                            let displayLogs: { type: string, line: number, content: string, start?: boolean }[] = [];

                            if (selectedSegment.type === 'combo') {
                              // Add Start Log
                              displayLogs.push({ type: 'Start Log', line: selectedSegment.startLine, content: selectedSegment.logs[0], start: true });

                              // Find other segments that started within this combo's timeframe
                              const internalSegments = result.segments.filter(s => {
                                if (s.id === selectedSegment.id) return false;

                                // Must start BEFORE parent ends
                                // AND must not end before parent starts (to handle same-timestamp previous events)
                                if (s.endLine < selectedSegment.startLine) return false;

                                const isAfterStart = s.startTime > selectedSegment.startTime ||
                                  (s.startTime === selectedSegment.startTime && s.startLine > selectedSegment.startLine);

                                return isAfterStart && s.startTime < selectedSegment.endTime;
                              }).sort((a, b) => (a.startTime - b.startTime) || (a.startLine - b.startLine));

                              internalSegments.forEach(s => {
                                if (s.type === 'combo') {
                                  displayLogs.push({ type: 'Internal Start', line: s.startLine, content: s.logs[0] });
                                } else {
                                  // For internal step events, only show the CURRENT event log (last log entry)
                                  // Skip the "prev event" log because it may reference lines before the parent combo
                                  const currentLog = s.logs[s.logs.length - 1];
                                  displayLogs.push({ type: 'Internal Log', line: s.endLine, content: currentLog });
                                }
                              });

                              // Add End Log
                              displayLogs.push({ type: 'End Log', line: selectedSegment.endLine, content: selectedSegment.logs[selectedSegment.logs.length - 1] });
                            } else {
                              // Normal segment display
                              displayLogs = selectedSegment.logs.map((l, i) => ({
                                type: selectedSegment.logs.length > 1 && i === 0 ? 'Prev Event' : 'Event Log',
                                line: i === 0 ? selectedSegment.startLine : selectedSegment.endLine,
                                content: l
                              }));
                            }

                            return displayLogs.map((logItem, idx) => (
                              <div key={idx} className="flex flex-col mb-2.5 last:mb-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-1.5 py-px rounded text-[8px] font-black uppercase ${logItem.type.includes('Start') ? 'bg-indigo-500/20 text-indigo-400' :
                                    (logItem.type.includes('End') ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-400')
                                    }`}>
                                    {logItem.type}
                                  </span>
                                  <span className="text-slate-600 font-bold italic text-[8px]">LINE {logItem.line}</span>
                                </div>
                                <div className={`px-3 py-2 rounded-lg border overflow-x-auto whitespace-pre-wrap break-all transition-all text-[10px] ${logItem.type.includes('Internal')
                                  ? 'bg-slate-900/80 border-l-2 border-l-indigo-500/50 border-y-white/5 border-r-white/5 ml-10 shadow-inner !pl-5 relative before:content-[""] before:absolute before:left-[-20px] before:top-1/2 before:w-[16px] before:h-[1px] before:bg-indigo-500/20'
                                  : 'bg-white/5 border-white/5'
                                  }`}>
                                  {logItem.content}
                                </div>
                                {logItem.start && (
                                  <div className="flex flex-col items-center py-1 opacity-30">
                                    <div className="w-px h-3 bg-gradient-to-b from-indigo-500 to-transparent"></div>
                                    <span className="text-[7px] font-black uppercase tracking-[0.3em] my-0.5">Internal Trace</span>
                                    <div className="w-px h-3 bg-gradient-to-t from-rose-500 to-transparent"></div>
                                  </div>
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Top Bottleneck Badge (Overlay) */}
                    {selectedSegment && topBottlenecks.find(t => t.id === selectedSegmentId) && (
                      <div className="absolute top-16 right-4 rotate-12 flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 text-white rounded-xl shadow-xl font-black text-[10px] uppercase shadow-rose-900/40 animate-bounce">
                        <AlertTriangle size={12} /> Bottleneck Detected
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default PerfAnalyzer;