import React, { useCallback, useRef, useState, useEffect } from 'react';
import { LogRule } from '../../../types';
import { AnalysisType } from '../protocol';
import { ChevronDown, FileText, Upload, X, Play, Square, Settings, Target, Layers, Search, Database, Sparkles, Loader2 } from 'lucide-react';
import { AgentRunStatus } from '../hooks/useAnalysisAgent';
import { parseLogText } from '../services/hintExtractor';
import { useToast } from '../../../contexts/ToastContext';

interface RagHint {
  id: string;
  distance: number;
  title: string;
  root_cause_hint: string;
  resolution_hint: string;
  component: string;
}

interface AgentConfigPanelProps {
  status: AgentRunStatus;
  logRules: LogRule[];
  onStart: (
    files: { text: string; name: string }[],
    rule: LogRule | null,
    analysisType: AnalysisType,
    userHints?: { pid: string; tid: string; custom: string; ragHint?: RagHint | null }
  ) => void;
  onCancel: () => void;
  onReset: () => void;
}

const ANALYSIS_TYPES: { value: AnalysisType; label: string; emoji: string; desc: string }[] = [
  { value: 'crash', label: 'Crash', emoji: '💥', desc: '앱 크래시 / 시그널 / 스택트레이스 분석' },
  { value: 'deadlock', label: 'Deadlock', emoji: '🔒', desc: '교착 상태 / 뮤텍스 / 스레드 블록 분석' },
  { value: 'perf', label: 'Perf Analyze', emoji: '⚡', desc: '성능 병목 / 타임아웃 / 지연 분석' },
  { value: 'traffic', label: 'Traffic Analyze', emoji: '🌐', desc: 'HTTP 오류 / 트래픽 이상 분석' },
];

const AgentConfigPanel: React.FC<AgentConfigPanelProps> = React.memo(({
  status,
  logRules,
  onStart,
  onCancel,
  onReset,
}) => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('crash');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [files, setFiles] = useState<{ id: string; name: string; text: string; lineCount: number }[]>([]);
  const [pid, setPid] = useState<string>('');
  const [tid, setTid] = useState<string>('');
  const [userHint, setUserHint] = useState<string>('');
  
  // 🐧 RAG 관련 상태
  const [ragQuery, setRagQuery] = useState('');
  const [ragResults, setRagResults] = useState<RagHint[]>([]);
  const [selectedRagHint, setSelectedRagHint] = useState<RagHint | null>(null);
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [isRagServerOnline, setIsRagServerOnline] = useState(false);

  // 🐧 기존 필수 상태 복구
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { addToast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const RAG_SERVER_URL = 'http://localhost:8888';

  const isRunning = status === 'running' || status === 'extracting' || status === 'waiting_user';
  const isDone = status === 'completed' || status === 'cancelled' || status === 'error';

  const loadFile = useCallback(async (file: File) => {
    setIsLoadingFile(true);
    try {
      const text = await file.text();
      const lines = await parseLogText(text);
      const newFile = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        text,
        lineCount: lines.length,
      };
      setFiles(prev => [...prev, newFile]);
    } catch (err) {
      console.error('파일 로드 오류:', err);
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    // 같은 파일을 다시 선택할 수 있도록 초기화
    e.target.value = '';
  }, [loadFile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 🐧 RAG 서버 상태 체크
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const resp = await fetch(`${RAG_SERVER_URL}/status`);
        setIsRagServerOnline(resp.ok);
      } catch (err) {
        setIsRagServerOnline(false);
      }
    };
    checkStatus();
    const timer = setInterval(checkStatus, 15000);
    return () => clearInterval(timer);
  }, []);

  // 🐧 RAG 검색 로직 (Debounce)
  useEffect(() => {
    if (!ragQuery.trim()) {
      setRagResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!isRagServerOnline) return;
      setIsRagLoading(true);
      try {
        const resp = await fetch(`${RAG_SERVER_URL}/search?q=${encodeURIComponent(ragQuery)}`);
        if (resp.ok) {
          const data = await resp.json();
          // 형님, 상위 3개만 깔끔하게 보여드리겠습니다!
          setRagResults(data.hints?.slice(0, 3) || []);
        }
      } catch (err) {
        console.error('RAG search failed:', err);
      } finally {
        setIsRagLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [ragQuery, isRagServerOnline]);

  const handleStart = useCallback(() => {
    if (files.length === 0) return;
    const rule = logRules.find(r => r.id === selectedRuleId) ?? null;
    onStart(
      files.map(f => ({ text: f.text, name: f.name })),
      rule,
      analysisType,
      { pid, tid, custom: userHint, ragHint: selectedRagHint }
    );
  }, [files, selectedRuleId, analysisType, logRules, onStart, pid, tid, userHint, selectedRagHint]);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setFiles([]);
    setPid('');
    setTid('');
    setUserHint('');
    setRagQuery('');
    setRagResults([]);
    setSelectedRagHint(null);
    onReset();
  }, [onReset]);

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar px-3 pt-3 pb-6 space-y-6 bg-[#020617]/40 backdrop-blur-xl">
      {/* 1단계: 분석 모드 및 미션 */}
      <section className="space-y-1.5">
        <div className="flex items-center gap-2 px-1 text-indigo-400">
          <Settings size={14} className="opacity-80 icon-glow" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-glow">Analysis Mode</h3>
        </div>

        <div className={`card-gradient p-[1px] group/section transition-all duration-300 relative ${isDropdownOpen ? 'z-50' : 'z-10'}`}>
          <div className="bg-[#0f172a]/70 backdrop-blur-sm rounded-2xl p-5 space-y-5 relative">
            {/* 좌우 하이라이트 그라데이션 오버레이 */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/5 via-transparent to-white/5 opacity-40 group-hover/section:opacity-60 transition-opacity duration-500" />
            <div className="absolute inset-0 rounded-2xl pointer-events-none border border-white/5 bg-gradient-to-br from-white/10 to-transparent" />

            <div className="relative z-10 space-y-5">
              {/* 분석 유형 */}
              <div>
                <div className="grid grid-cols-4 gap-2">
                  {ANALYSIS_TYPES.map(at => (
                    <button
                      key={at.value}
                      onClick={() => setAnalysisType(at.value)}
                      disabled={isRunning}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all duration-300 text-center group min-h-[72px] relative overflow-hidden ${analysisType === at.value
                        ? 'border-indigo-500/50 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20'
                        : 'border-slate-800 bg-[#020617]/60 text-slate-500 hover:border-slate-600 hover:bg-[#020617]/90'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {analysisType === at.value && (
                        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                      )}
                      <span className={`text-xl transition-transform duration-500 group-hover:scale-110 ${analysisType === at.value ? 'scale-110 rotate-3' : 'grayscale group-hover:grayscale-0 opacity-70'}`}>
                        {at.emoji}
                      </span>
                      <span className={`font-black text-[9px] tracking-tighter uppercase leading-none transition-colors ${analysisType === at.value ? 'text-indigo-200' : 'text-slate-500 group-hover:text-slate-300'}`}>{at.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mission 선택 */}
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1 opacity-80">
                  Mission Filter
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => !isRunning && setIsDropdownOpen(!isDropdownOpen)}
                    disabled={isRunning}
                    className="w-full bg-[#020617]/90 border border-white/5 rounded-xl px-4 py-3.5 text-[12px] text-white flex items-center justify-between hover:border-indigo-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 font-bold group shadow-inner"
                  >
                    <span className="truncate group-hover:text-indigo-200 transition-colors">
                      {selectedRuleId
                        ? logRules.find(r => r.id === selectedRuleId)?.name || '전체 로그 분석 (필터 없음)'
                        : '전체 로그 분석 (필터 없음)'}
                    </span>
                    <ChevronDown size={14} className={`text-slate-500 group-hover:text-indigo-400 transition-all duration-300 ${isDropdownOpen ? 'rotate-180 text-indigo-400' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0f172a] border border-white/20 rounded-xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] z-50 overflow-y-auto max-h-[300px] custom-scrollbar py-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div
                        onClick={() => { setSelectedRuleId(''); setIsDropdownOpen(false); }}
                        className={`px-4 py-2.5 text-[12px] cursor-pointer transition-colors ${!selectedRuleId ? 'bg-indigo-600/80 text-white font-black' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                      >
                        전체 로그 분석 (필터 없음)
                      </div>
                      {logRules.map(rule => (
                        <div
                          key={rule.id}
                          onClick={() => { setSelectedRuleId(rule.id); setIsDropdownOpen(false); }}
                          className={`px-4 py-3 text-[12px] cursor-pointer transition-colors border-t border-white/5 ${selectedRuleId === rule.id ? 'bg-indigo-600/80 text-white font-black' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          {rule.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2단계: 로그 소스 */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between px-1 text-emerald-400">
          <div className="flex items-center gap-2">
            <Layers size={14} className="opacity-80 icon-glow" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-glow">Log Sources ({files.length})</h3>
          </div>
          {files.length > 0 && !isRunning && (
            <button
              onClick={handleClearAll}
              className="text-[9px] text-red-500/60 hover:text-red-400 transition-all uppercase tracking-[0.1em] font-black"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="card-gradient p-[1px] group/section z-10 relative">
          <div className="bg-[#0f172a]/70 backdrop-blur-sm rounded-2xl p-4 space-y-4 relative">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/5 via-transparent to-white/5 opacity-40 group-hover/section:opacity-60 transition-opacity duration-500" />
            
            <div className="relative z-10 flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar-sm pr-1">
              {files.map(file => (
                <div key={file.id} className="bg-[#020617]/80 border border-white/5 rounded-xl p-3.5 flex items-center gap-4 group/item hover:border-emerald-500/30 transition-all shadow-lg hover:bg-emerald-500/5">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/20 group-hover/item:scale-110 transition-transform">
                    <FileText size={18} className="text-emerald-400/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-slate-100 truncate mb-0.5">{file.name}</p>
                    <p className="text-[9px] text-emerald-400/50 font-black uppercase tracking-wider">
                      {file.lineCount.toLocaleString()} Lines
                    </p>
                  </div>
                  {!isRunning && (
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-600 hover:text-red-400 transition-all flex-shrink-0 group-hover/item:opacity-100"
                      title="제거"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}

              {/* 파일 추가 영역 */}
              <div
                onClick={() => !isRunning && fileInputRef.current?.click()}
                onDragOver={e => { if (!isRunning) { e.preventDefault(); setIsDragOver(true); } }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => { if (!isRunning) handleDrop(e); }}
                className={`border-2 border-dashed rounded-xl p-5 text-center flex items-center justify-center gap-3 transition-all ${isRunning
                  ? 'border-slate-800/10 bg-transparent cursor-not-allowed pointer-events-none opacity-10'
                  : `group/add border-white/5 bg-[#020617]/60 hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer ${isDragOver ? 'border-emerald-400/50 bg-emerald-500/10 scale-[0.98]' : ''}`
                  }`}
              >
                {isLoadingFile ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Loading...</p>
                  </>
                ) : (
                  <>
                    <Upload size={16} className={`transition-all duration-300 ${isRunning ? 'text-slate-800' : 'text-slate-600 group-hover/add:text-emerald-400 group-hover/add:scale-110'}`} />
                    <p className={`text-[9px] uppercase tracking-[0.25em] transition-colors ${isRunning ? 'text-slate-800 font-medium' : 'text-slate-600 group-hover/add:text-slate-200 font-black'}`}>
                      Drop or Click to Add Log
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt,.out,.dump,*"
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
      </section>

      {/* 3단계: 분석 컨텍스트 */}
      <section className="space-y-1.5">
        <div className="flex items-center gap-2 px-1 text-rose-400">
          <Target size={14} className="opacity-80 icon-glow" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-glow">Target Context</h3>
        </div>

        <div className="card-gradient p-[1px] group/section z-10 relative">
          <div className="bg-[#0f172a]/70 backdrop-blur-sm rounded-2xl p-5 space-y-5 relative">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/5 via-transparent to-white/5 opacity-40 group-hover/section:opacity-60 transition-opacity duration-500" />
            
            <div className="relative z-10 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] ml-1 opacity-80">
                    Process ID (PID)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pid}
                      onChange={e => setPid(e.target.value)}
                      disabled={isRunning}
                      placeholder="e.g. 1234"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all placeholder:text-slate-600 font-bold"
                    />
                    <div className="absolute inset-0 rounded-xl pointer-events-none border border-white/5 bg-gradient-to-br from-white/5 to-transparent opacity-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] ml-1 opacity-80">
                    Thread ID (TID)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tid}
                      onChange={e => setTid(e.target.value)}
                      disabled={isRunning}
                      placeholder="e.g. 5678"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all placeholder:text-slate-600 font-bold"
                    />
                    <div className="absolute inset-0 rounded-xl pointer-events-none border border-white/5 bg-gradient-to-br from-white/5 to-transparent opacity-10" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] ml-1 opacity-80">
                  User Hints
                </label>
                <div className="relative">
                  <textarea
                    value={userHint}
                    onChange={e => setUserHint(e.target.value)}
                    disabled={isRunning}
                    placeholder="분석 정밀도를 위해 힌트를 추가해주세요..."
                    rows={3}
                    className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3.5 text-[12px] text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all placeholder:text-slate-600 resize-none custom-scrollbar-sm font-bold"
                  />
                  <div className="absolute inset-0 rounded-xl pointer-events-none border border-white/5 bg-gradient-to-br from-white/5 to-transparent opacity-10" />
                </div>
              </div>

              {/* 🐧 RAG 검색 섹션 */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between ml-1">
                  <label className="block text-[9px] font-black text-indigo-400 uppercase tracking-[0.1em] opacity-80">
                    Rag Search (Similar Issues)
                  </label>
                  {isRagServerOnline ? (
                    <span className="text-[8px] text-emerald-500 font-bold flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                    </span>
                  ) : (
                    <span className="text-[8px] text-rose-500 font-bold flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-rose-500" /> OFFLINE
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search size={12} className={isRagLoading ? "text-indigo-400 animate-spin" : "text-slate-500"} />
                  </div>
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={e => setRagQuery(e.target.value)}
                    disabled={isRunning || !isRagServerOnline}
                    placeholder={isRagServerOnline ? "유사 사례 검색..." : "서버 오프라인"}
                    className="w-full bg-[#020617] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder:text-slate-600 font-bold"
                  />
                </div>

                {/* 검색 결과 */}
                {ragResults.length > 0 && !selectedRagHint && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {ragResults.map(hint => (
                      <div
                        key={hint.id}
                        onClick={() => setSelectedRagHint(hint)}
                        className="bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter opacity-70 group-hover:opacity-100">{hint.component}</span>
                          <span className="text-[8px] font-mono text-slate-500">{(1 - hint.distance).toFixed(2)} match</span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-bold truncate group-hover:text-white transition-colors">{hint.title}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 선택된 힌트 */}
                {selectedRagHint && (
                  <div className="bg-indigo-600/20 border border-indigo-400/40 rounded-xl p-3 relative group animate-in zoom-in-95 duration-200">
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-900/50">
                      <Sparkles size={10} fill="currentColor" />
                    </div>
                    <button
                      onClick={() => setSelectedRagHint(null)}
                      className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={10} />
                    </button>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Database size={10} className="text-indigo-400" />
                      <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest leading-none">Selected Context</span>
                    </div>
                    <p className="text-[10px] text-white font-bold leading-tight mb-2 pr-4">{selectedRagHint.title}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                       <div className="bg-black/20 p-1.5 rounded border border-white/5">
                          <span className="text-[7px] font-black text-rose-400 uppercase block mb-0.5">Root Cause</span>
                          <p className="text-[8px] text-slate-400 line-clamp-2 leading-tight">{selectedRagHint.root_cause_hint}</p>
                       </div>
                       <div className="bg-black/20 p-1.5 rounded border border-white/5">
                          <span className="text-[7px] font-black text-emerald-400 uppercase block mb-0.5">Resolution</span>
                          <p className="text-[8px] text-slate-400 line-clamp-2 leading-tight">{selectedRagHint.resolution_hint}</p>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 액션 버튼 */}
      <div className="pt-8 pb-4 mt-auto">
        {isRunning ? (
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-3 py-8 px-8 rounded-xl bg-red-600 text-white border border-red-400/30 font-black transition-all duration-300 hover:bg-red-500 shadow-lg shadow-red-900/50 hover:shadow-red-500/30 hover:scale-[1.01] active:scale-[0.98] uppercase tracking-[0.2em] text-xs group"
          >
            <Square size={16} fill="currentColor" className="animate-pulse" />
            Stop Analysis
          </button>
        ) : isDone ? (
          <div className="flex gap-3">
            <button
              onClick={handleClearAll}
              className="flex-1 py-8 px-6 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 font-black text-[10px] transition-all duration-300 hover:bg-slate-700 hover:text-white hover:scale-[1.01] active:scale-[0.98] uppercase tracking-[0.2em]"
            >
              Reset
            </button>
            <button
              onClick={handleStart}
              disabled={files.length === 0}
              className="flex-[2.5] flex items-center justify-center gap-3 py-4.5 px-8 rounded-xl bg-indigo-600 text-white border border-indigo-400/30 font-black text-[11px] transition-all duration-300 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed group"
            >
              <Play size={16} className="transition-transform group-hover:scale-110" />
              Execute Analysis
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleStart}
              disabled={files.length === 0 || isLoadingFile || isRunning}
              className="relative w-full flex items-center justify-center gap-4 py-8 px-10 rounded-xl bg-indigo-600 text-white border border-indigo-400/30 font-black text-xs transition-all duration-300 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-[0.3em] group overflow-hidden"
            >
              {isRunning || isLoadingFile ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play size={20} className="transition-transform group-hover:scale-110 duration-500" />
              )}
              {isRunning ? 'Analyzing...' : 'Execute Analysis'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default AgentConfigPanel;
