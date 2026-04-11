import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useHappyTool } from '@/contexts/HappyToolContext';
import { useToast } from '@/contexts/ToastContext';
import * as Lucide from 'lucide-react';

interface RagHint {
  id: string;
  distance: number;
  title: string;
  root_cause_hint: string;
  resolution_hint: string;
  component: string;
}

interface RagResponse {
  query: string;
  hints: RagHint[];
}

const RagAnalyzerTest: React.FC = () => {
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RagHint[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [totalIndexed, setTotalIndexed] = useState<number>(0);
  const [startingServer, setStartingServer] = useState(false);

  const RAG_SERVER_URL = 'http://localhost:8888';

  // 🐧 서버 시작 명령 호출
  const handleStartServer = async () => {
    setStartingServer(true);
    try {
      const result = await (window as any).electronAPI.startRagServer();
      if (result.status === 'success' || result.status === 'already_running') {
        addToast(result.message || '서버가 성공적으로 시작되었습니다! 🐧🚀', 'success');
        // 즉시 상태 체크 시도
        setTimeout(checkServerStatus, 2000);
      } else {
        addToast(`서버 실행 실패: ${result.message}`, 'error');
      }
    } catch (err: any) {
      addToast(`서버 실행 중 오류 발생: ${err.message}`, 'error');
    } finally {
      setStartingServer(false);
    }
  };

  // 🐧 서버 상태 체크 로직
  const checkServerStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${RAG_SERVER_URL}/status`);
      if (resp.ok) {
        const data = await resp.json();
        setServerStatus('online');
        setTotalIndexed(data.total_indexed_issues || 0);
      } else {
        setServerStatus('offline');
      }
    } catch (err) {
      setServerStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkServerStatus();
    const timer = setInterval(checkServerStatus, 15000); // 🐧 형님, 5초는 너무 잦아서 15초로 늦췄습니다!
    return () => clearInterval(timer);
  }, [checkServerStatus]);

  // 🐧 검색 실행 로직
  const fetchResults = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (serverStatus !== 'online') {
      addToast('형님, RAG 서버가 오프라인입니다! 서버를 켜 주십쇼!', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${RAG_SERVER_URL}/search?q=${encodeURIComponent(searchQuery)}`);
      if (resp.ok) {
        const data: RagResponse = await resp.json();
        setResults(data.hints);
      } else {
        addToast('검색 중 오류가 발생했습니다, 형님!', 'error');
      }
    } catch (err) {
      addToast('서버 통신 실패! 서버가 켜져 있는지 봐주십쇼.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 🐧 Debounce 구현 (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        fetchResults(query);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // 유사도에 따른 별점 렌더링
  const renderStars = (distance: number) => {
    // distance가 낮을수록 유사도가 높음 (0.0 ~ 1.0 가정)
    const score = Math.max(0, Math.min(5, Math.round((1 - distance) * 5)));
    return (
      <div className="flex gap-1 text-yellow-400">
        {[...Array(5)].map((_, i) => (
          <Lucide.Star key={i} size={14} fill={i < score ? 'currentColor' : 'none'} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden font-sans">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Lucide.BrainCircuit size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                RAG ISSUE ANALYST
              </h1>
              {/* Server Status Indicator (Mini) */}
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                serverStatus === 'online' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' 
                  : serverStatus === 'offline'
                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : serverStatus === 'offline' ? 'bg-rose-500' : 'bg-slate-400'
                }`} />
                {serverStatus === 'online' ? 'ONLINE' : serverStatus === 'offline' ? 'OFFLINE' : 'CHECKING'}
              </div>

              {/* 🐧 START SERVER 버튼을 안전한 왼쪽으로 이동! */}
              {serverStatus === 'offline' && (
                <button
                  onClick={handleStartServer}
                  disabled={startingServer}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 ml-2"
                >
                  {startingServer ? <Lucide.Loader2 size={14} className="animate-spin" /> : <Lucide.Play size={14} fill="currentColor" />}
                  {startingServer ? 'STARTING...' : 'START SERVER'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                AI-Powered Insight Engine (Test)
              </p>
              {serverStatus === 'online' && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                  <Lucide.Database size={10} />
                  {totalIndexed} ISSUES INDEXED
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 🐧 우측 상단은 윈도우 컨트롤 영역이라 비워둡니다. */}
        </div>
      </div>

      {/* Search Input Section */}
      <div className="relative mb-6 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Lucide.Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="형님, 궁금하신 장애 증상을 입력해 주십시오..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition-all shadow-sm text-base placeholder:text-slate-400"
        />
        {loading && (
          <div className="absolute inset-y-0 right-4 flex items-center">
            <Lucide.Loader2 className="animate-spin text-indigo-500" size={18} />
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {results.length > 0 ? (
          results.map((hint, idx) => (
            <div 
              key={hint.id} 
              className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm"
            >
              {/* Card Decoration */}
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-full opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase">
                    {hint.component}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[400px]">
                    {hint.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {renderStars(hint.distance)}
                  <span className="text-[10px] font-mono text-slate-400">dist: {hint.distance.toFixed(4)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-1.5 mb-1 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                    <Lucide.AlertCircle size={12} />
                    ROOT CAUSE
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                    {hint.root_cause_hint}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30">
                  <div className="flex items-center gap-1.5 mb-1 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                    <Lucide.Lightbulb size={12} />
                    RESOLUTION
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                    {hint.resolution_hint}
                  </p>
                </div>
              </div>

              {/* Compact Action Bar */}
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
                  Check Details
                </button>
                <button className="px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                  Apply
                </button>
              </div>
            </div>
          ))
        ) : query && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Lucide.DatabaseBackup size={64} className="mb-4 opacity-20" />
            <p className="font-medium text-lg italic">"형님, 이 건에 대한 매칭되는 과거 사례가 아직 없나 봅니다..."</p>
            <p className="text-sm mt-2 opacity-60">다른 키워드로 검색해 보시는 건 어떻습니까?</p>
          </div>
        ) : !query && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Lucide.SearchCode size={64} className="mb-4 opacity-20" />
            <p className="font-medium">검색어를 입력하시면 AI가 기가 막히게 분석해 드립니다!</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}} />
    </div>
  );
};

export default RagAnalyzerTest;
