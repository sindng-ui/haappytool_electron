import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { Button } from '../ui/Button';
import { useNetTrafficLogic } from '../../hooks/useNetTrafficLogic';
import { useToast } from '../../contexts/ToastContext';
import { TrafficPattern, UAPattern } from '../../workers/NetTraffic.worker';

// Sub-components
import RawLogNavigator from './RawLogNavigator';
import EndpointTable from './EndpointTable';
import UATable from './UATable';
import InsightsTab from './InsightsTab';

const LOCAL_STORAGE_KEY_UA = 'happytool_nettraffic_ua_pattern';
const LOCAL_STORAGE_KEY_PATTERNS = 'happytool_nettraffic_traffic_patterns';

const NetTrafficAnalyzerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [resultTab, setResultTab] = useState<'endpoints' | 'ua' | 'insights'>('endpoints');
  const { addToast } = useToast();

  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [leftFile, setLeftFile] = useState<File | null>(null);
  const [rightFile, setRightFile] = useState<File | null>(null);
  const [navSource, setNavSource] = useState<{ file: File; lineIndices: number[]; title: string } | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [patterns, setPatterns] = useState<TrafficPattern[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PATTERNS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [{ id: '1', alias: 'Keywords', keywords: '', extractRegex: '', enabled: true }];
  });

  const [uaPattern, setUAPattern] = useState<UAPattern>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_UA);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { keywords: 'SC_SERVICE, User agent', template: 'User agent: $(ClientName)/$(ClientVersion)/$(AppName)/$(AppVersion)/$(AppDetail)', enabled: true };
  });

  const {
    analyzing, progress, singleResult, leftResult, rightResult, singleUAResult, leftUAResult, rightUAResult,
    singleInsights, leftInsights, rightInsights, startAnalysis
  } = useNetTrafficLogic();

  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEY_UA, JSON.stringify(uaPattern)); }, [uaPattern]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEY_PATTERNS, JSON.stringify(patterns)); }, [patterns]);

  const handleStartAnalysis = async () => {
    setHasAnalyzed(true);
    await startAnalysis(activeTab, patterns, uaPattern, singleFile, leftFile, rightFile);
  };

  const copyToClipboard = (text: string, summary: string) => {
    navigator.clipboard.writeText(text);
    addToast(summary, 'success', 2000);
  };

  const renderFileDropArea = (target: 'single' | 'left' | 'right', file: File | null, label: string) => (
    <div
      className={`flex-1 min-h-[100px] border border-dashed rounded-xl flex flex-col items-center justify-center p-3 transition-all group cursor-pointer ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 hover:bg-slate-900/60'}`}
      onClick={() => document.getElementById(`file-input-${target}`)?.click()}
    >
      <input id={`file-input-${target}`} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && (target==='single'?setSingleFile:target==='left'?setLeftFile:setRightFile)(e.target.files[0])} />
      {file ? (
        <div className="flex flex-col items-center">
          <Lucide.FileText size={20} className="text-emerald-500 mb-1.5" />
          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[140px]">{file.name}</span>
          <button className="text-[9px] text-rose-400 mt-2 hover:underline" onClick={(e) => { e.stopPropagation(); (target==='single'?setSingleFile:target==='left'?setLeftFile:setRightFile)(null); }}>Remove</button>
        </div>
      ) : (
        <div className="flex flex-col items-center opacity-40 group-hover:opacity-100 transition-opacity">
          <Lucide.Upload size={20} className="mb-2 text-slate-400" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Drop {label}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] font-sans selection:bg-indigo-500/20 text-slate-300">
      <div className="h-8 flex items-center bg-[#0f172a] border-b border-indigo-500/30 px-3 space-x-0.5 shrink-0 z-20">
        {(['single', 'compare'] as const).map(t => (
          <button key={t} className={`px-5 h-full text-[10px] font-black uppercase tracking-widest rounded-t-lg transition-all border-l border-r border-t ${activeTab === t ? 'bg-slate-900 border-indigo-500/40 text-slate-200 z-10' : 'bg-slate-950 border-transparent text-slate-500 hover:text-slate-300'}`} onClick={() => setActiveTab(t)}>{t} View</button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[400px] border-r border-indigo-500/10 bg-[#0d1225] p-4 shrink-0 flex flex-col overflow-y-auto custom-scrollbar z-10 space-y-3">
          {/* Section 01: Log Input */}
          <div className="bg-[#0f172a] rounded-xl border border-cyan-500/15 overflow-hidden shadow-sm">
            <div className="flex items-center space-x-2.5 px-4 py-2.5 bg-cyan-500/5 border-b border-cyan-500/10">
              <div className="w-5 h-5 rounded flex items-center justify-center bg-cyan-500/15"><Lucide.FileText size={11} className="text-cyan-400" /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">01. Log Input</span>
            </div>
            <div className="p-4">
              {activeTab === 'single' ? renderFileDropArea('single', singleFile, 'Source Log') : <div className="grid grid-cols-2 gap-3">{renderFileDropArea('left', leftFile, 'Primary')} {renderFileDropArea('right', rightFile, 'Reference')}</div>}
            </div>
          </div>

          {/* Section 02: User Agent */}
          <div className="bg-[#0f172a] rounded-xl border border-violet-500/15 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-violet-500/5 border-b border-violet-500/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-500/15"><Lucide.Users size={11} className="text-violet-400" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">02. User Agent</span>
              </div>
              <span className="text-[8px] text-slate-600 uppercase tracking-wider">UA Parser Config</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <Lucide.Key size={10} className="text-violet-400/60" />
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Detection Keywords</label>
                </div>
                <input type="text" value={uaPattern.keywords} onChange={(e) => setUAPattern({ ...uaPattern, keywords: e.target.value })} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 text-[11px] font-mono focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none text-slate-300 transition-all" placeholder="e.g. User Agent, SC_SERVICE" />
                <p className="text-[8px] text-slate-600 pl-0.5">로그에서 UA 정보를 포함하는 라인 감지 키워드</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <Lucide.Braces size={10} className="text-violet-400/60" />
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Extraction Template</label>
                </div>
                <textarea rows={3} value={uaPattern.template} onChange={(e) => setUAPattern({ ...uaPattern, template: e.target.value })} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 text-[11px] font-mono focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none resize-none text-slate-300 leading-relaxed transition-all" placeholder="User Agent> $(ClientName)/$(Version)" />
                <p className="text-[8px] text-slate-600 pl-0.5">{'$(변수)'}{'로 추출할 필드를 지정'}</p>
              </div>
            </div>
          </div>

          {/* Section 03: Traffic Rule */}
          <div className="bg-[#0f172a] rounded-xl border border-amber-500/15 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-500/15"><Lucide.Route size={11} className="text-amber-400" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">03. Traffic Rule</span>
              </div>
              <span className="text-[8px] text-slate-600 tabular-nums">{patterns.length} rule{patterns.length > 1 ? 's' : ''}</span>
            </div>
            <div className="p-4 space-y-2.5">
              {patterns.map(p => (
                <div key={p.id} className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-lg space-y-2 group hover:border-amber-500/20 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Lucide.Tag size={10} className="text-amber-400/60" />
                      <input type="text" value={p.alias} onChange={(e) => setPatterns(patterns.map(x => x.id === p.id ? { ...x, alias: e.target.value } : x))} className="bg-transparent border-0 p-0 text-[10px] font-black uppercase text-amber-400 outline-none w-28 placeholder:text-amber-400/30" placeholder="Rule name" />
                    </div>
                    <button className="text-rose-500/60 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-400" onClick={() => setPatterns(patterns.filter(x => x.id !== p.id))}><Lucide.Trash2 size={12} /></button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-1"><Lucide.Key size={8} className="text-amber-500/40" /><span>Signature Keywords</span></label>
                    <input type="text" value={p.keywords} onChange={(e) => setPatterns(patterns.map(x => x.id === p.id ? { ...x, keywords: e.target.value } : x))} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-400 outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/15 transition-all" placeholder="kw1, kw2, kw3..." />
                  </div>
                </div>
              ))}
              <button className="w-full h-9 border border-dashed border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-amber-500/5 hover:text-amber-400 hover:border-amber-500/30 transition-all flex items-center justify-center space-x-1.5" onClick={() => setPatterns([...patterns, { id: Date.now().toString(), alias: '', keywords: '', extractRegex: '', enabled: true }])}>
                <Lucide.Plus size={12} /><span>New Rule</span>
              </button>
            </div>
          </div>

          {/* Execute Button */}
          <div className="mt-auto pt-4">
            <Button variant="primary" className={`w-full h-12 font-black uppercase tracking-[0.2em] rounded-xl border-b-[3px] shadow-xl ${analyzing ? 'bg-slate-800 border-slate-900 opacity-50' : 'bg-indigo-600 border-indigo-800 hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0'}`} onClick={handleStartAnalysis} disabled={analyzing || (activeTab === 'single' && !singleFile) || (activeTab === 'compare' && (!leftFile || !rightFile))}>
              <div className="flex items-center justify-center space-x-3">{analyzing ? <Lucide.Loader size={16} className="animate-spin" /> : <Lucide.Zap size={16} />}<span className="text-[11px]">{analyzing ? `Analyzing... ${progress}%` : 'Execute Analysis'}</span></div>
            </Button>
          </div>
        </div>


        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative shadow-[inset_10px_0_20px_rgba(0,0,0,0.5)]">
          {/* Result Tabs with Icons */}
          {hasAnalyzed && !analyzing && (
            <div className="shrink-0">
              <div className="h-10 flex bg-[#0f172a] border-b border-indigo-500/20">
                {([{ key: 'endpoints' as const, icon: <Lucide.Globe size={12} />, label: 'Endpoints' }, { key: 'ua' as const, icon: <Lucide.Users size={12} />, label: 'User Agents' }, { key: 'insights' as const, icon: <Lucide.BarChart3 size={12} />, label: 'Insights' }]).map(t => (
                  <button key={t.key} onClick={() => setResultTab(t.key)} className={`px-6 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${resultTab === t.key ? 'text-indigo-400 bg-slate-900/50 shadow-[inset_0_-2px_0_#6366f1]' : 'text-slate-500 hover:text-slate-400'}`}>
                    {t.icon}<span>{t.label}</span>
                  </button>
                ))}
              </div>
              {/* Summary Ribbon */}
              <div className="h-8 bg-[#0d1321] border-b border-slate-900 px-4 flex items-center space-x-6 text-[10px]">
                <div className="flex items-center space-x-1.5"><Lucide.Globe size={10} className="text-indigo-400" /><span className="text-slate-500">Patterns:</span><span className="text-indigo-400 font-black tabular-nums">{singleResult.length}</span></div>
                <div className="flex items-center space-x-1.5"><Lucide.Zap size={10} className="text-amber-400" /><span className="text-slate-500">Total Hits:</span><span className="text-amber-400 font-black tabular-nums">{singleResult.reduce((a,c)=>a+c.totalCount,0).toLocaleString()}</span></div>
                <div className="flex items-center space-x-1.5"><Lucide.Users size={10} className="text-emerald-400" /><span className="text-slate-500">Clients:</span><span className="text-emerald-400 font-black tabular-nums">{singleUAResult.length}</span></div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-3 flex flex-col">
            {!hasAnalyzed ? <div className="flex-1 border-2 border-dashed border-slate-900/50 rounded-2xl flex flex-col items-center justify-center text-slate-700 space-y-4"><Lucide.Activity size={64} className="opacity-10" /><span className="text-[10px] font-black uppercase tracking-[0.3em]">Telemetry Engine Idle</span></div> 
            : analyzing ? <div className="flex-1 flex flex-col items-center justify-center space-y-6"><div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">Synchronizing Data Streams...</div><div className="w-64 bg-slate-900 h-1.5 rounded-full overflow-hidden shadow-inner"><div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} /></div><div className="text-[32px] font-black text-white font-mono drop-shadow-lg">{progress}%</div></div> 
            : <div className="flex-1 overflow-hidden flex flex-col">
                {resultTab === 'endpoints' && <EndpointTable data={singleResult} title="Master API Index" sourceFile={singleFile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} expandedKeys={expandedKeys} toggleExpand={(k)=>setExpandedKeys(p=>{const n=new Set(p); if(n.has(k)) n.delete(k); else n.add(k); return n;})} onJumpToRaw={(f,l,t)=>setNavSource({file:f,lineIndices:l,title:t})} onCopy={copyToClipboard} />}
                {resultTab === 'ua' && <UATable data={singleUAResult} title="Fingerprint Clusters" sourceFile={singleFile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} expandedKeys={expandedKeys} setExpandedKeys={setExpandedKeys} onJumpToRaw={(f,l,t)=>setNavSource({file:f,lineIndices:l,title:t})} onCopy={copyToClipboard} />}
                {resultTab === 'insights' && (activeTab === 'single' ? <InsightsTab insights={singleInsights} sourceName="Primary" onCopy={copyToClipboard} /> : <div className="flex-1 flex space-x-3 overflow-hidden"><div className="flex-1 flex flex-col bg-slate-900/20 rounded-xl overflow-hidden border border-slate-900"><div className="bg-indigo-900/20 px-4 py-2 text-[9px] font-black uppercase text-indigo-400 border-b border-indigo-900/30">Primary source</div><InsightsTab insights={leftInsights} sourceName="Primary" onCopy={copyToClipboard} /></div><div className="flex-1 flex flex-col bg-slate-900/20 rounded-xl overflow-hidden border border-slate-900"><div className="bg-rose-900/20 px-4 py-2 text-[9px] font-black uppercase text-rose-400 border-b border-rose-900/30">Reference source</div><InsightsTab insights={rightInsights} sourceName="Reference" onCopy={copyToClipboard} /></div></div>)}
              </div>}
          </div>

          {/* Status Bar */}
          <div className="h-8 border-t border-slate-900 bg-[#0f172a] px-4 flex items-center justify-between text-[10px] text-slate-500 select-none">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" /><span className="font-black uppercase tracking-widest text-[9px]" style={{color:'#10b981'}}>Engine v2.2</span></div>
              {hasAnalyzed && <><span className="opacity-20">|</span><span className="tabular-nums">Patterns: <span className="text-indigo-400 font-black">{singleResult.length}</span></span><span className="opacity-20">|</span><span className="tabular-nums">Hits: <span className="text-indigo-400 font-black">{singleResult.reduce((a,c)=>a+c.totalCount,0).toLocaleString()}</span></span><span className="opacity-20">|</span><span className="tabular-nums">Clients: <span className="text-emerald-400 font-black">{singleUAResult.length}</span></span></>}
            </div>
            <div className="text-[9px] font-black opacity-30 tracking-[0.2em] uppercase">HappyTool NetTraffic</div>
          </div>
        </div>
      </div>
      {navSource && <RawLogNavigator file={navSource.file} lineIndices={navSource.lineIndices} onClose={() => setNavSource(null)} title={navSource.title} />}
    </div>
  );
};

export default NetTrafficAnalyzerView;
