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

  // 🐧 Invoke server start command
  const handleStartServer = async () => {
    setStartingServer(true);
    try {
      const result = await (window as any).electronAPI.startRagServer();
      if (result.status === 'success' || result.status === 'already_running') {
        addToast(result.message || 'Server started successfully! 🐧🚀', 'success');
        // Immediate status check attempt
        setTimeout(checkServerStatus, 2000);
      } else {
        addToast(`Server start failed: ${result.message}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error while starting server: ${err.message}`, 'error');
    } finally {
      setStartingServer(false);
    }
  };

  // 🐧 Server status check logic
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
    const timer = setInterval(checkServerStatus, 15000); // 🐧 15 seconds for stability!
    return () => clearInterval(timer);
  }, [checkServerStatus]);

  // 🐧 Search execution logic
  const fetchResults = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (serverStatus !== 'online') {
      addToast('RAG server is offline! Please start the server.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${RAG_SERVER_URL}/search?q=${encodeURIComponent(searchQuery)}`);
      if (resp.ok) {
        const data: RagResponse = await resp.json();
        setResults(data.hints);
      } else {
        addToast('An error occurred during search.', 'error');
      }
    } catch (err) {
      addToast('Server communication failed! Please check if the server is running.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 🐧 Debounce implementation (500ms)
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

  // Star rating rendering based on similarity
  const renderStars = (distance: number) => {
    // Lower distance means higher similarity (assuming 0.0 ~ 1.0)
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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden font-sans">
      {/* Header Section - Standardized for Zero-Sidebar (h-16, pl-16) */}
      <div className="h-16 flex items-center justify-between pl-16 pr-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0 select-none title-drag">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <Lucide.BrainCircuit size={20} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 uppercase">
                RAG ISSUE ANALYST
              </h1>
              {/* Server Status Indicator (Mini) */}
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                serverStatus === 'online' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
              }`}>
                <div className={`w-1 h-1 rounded-full ${
                  serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`} />
                {serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>
            <p className="text-[9px] text-slate-500 font-medium uppercase tracking-[0.2em] mt-0.5">
              AI-Powered Insight Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 no-drag">
          {serverStatus === 'online' ? (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
              <Lucide.Database size={10} />
              {totalIndexed.toLocaleString()} ISSUES INDEXED
            </div>
          ) : (
            <button
              onClick={handleStartServer}
              disabled={startingServer}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-[10px] font-bold shadow-md transition-all active:scale-95"
            >
              {startingServer ? <Lucide.Loader2 size={12} className="animate-spin" /> : <Lucide.Play size={12} fill="currentColor" />}
              {startingServer ? 'STARTING...' : 'START RAG SERVER'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-hidden">

      {/* Search Input Section */}
      <div className="relative mb-6 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Lucide.Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Please enter the symptoms or issues you're curious about..."
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
            <p className="font-medium text-lg italic">"It seems there are no matching past cases for this issue..."</p>
            <p className="text-sm mt-2 opacity-60">How about trying with other keywords?</p>
          </div>
        ) : !query && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Lucide.SearchCode size={64} className="mb-4 opacity-20" />
            <p className="font-medium">Enter a search term and AI will analyze it brilliantly!</p>
          </div>
        )}
      </div>
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
