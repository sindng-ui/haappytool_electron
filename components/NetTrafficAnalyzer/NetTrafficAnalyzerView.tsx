import React, { useState, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { Button } from '../ui/Button';
import { useNetTrafficLogic } from '../../hooks/useNetTrafficLogic';
import { useToast } from '../../contexts/ToastContext';
import { TrafficPattern, TemplateGroup, RawCall, UAPattern, UAResult } from '../../workers/NetTraffic.worker';

const NetTrafficAnalyzerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [resultTab, setResultTab] = useState<'endpoints' | 'ua' | 'insights'>('endpoints');
  const { addToast } = useToast();
  
  // Files
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [leftFile, setLeftFile] = useState<File | null>(null);
  const [rightFile, setRightFile] = useState<File | null>(null);

  // Patterns
  const [patterns, setPatterns] = useState<TrafficPattern[]>([
    { id: '1', alias: 'Smart Traffic', keywords: 'ST_APP, https://', extractRegex: '', enabled: true }
  ]);
  const [uaPattern, setUAPattern] = useState<UAPattern>({
    keywords: 'ST_APP, User Agent',
    template: 'User Agent> $(ClientName)/$(ClientVersion)/$(AppName)/$(AppVersion)/asdf',
    enabled: true
  });

  const { 
    analyzing, progress, 
    singleResult, leftResult, rightResult, 
    singleUAResult, leftUAResult, rightUAResult, 
    singleInsights, leftInsights, rightInsights,
    startAnalysis 
  } = useNetTrafficLogic();
  
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const handleStartAnalysis = async () => {
    setHasAnalyzed(true);
    await startAnalysis(activeTab, patterns, uaPattern, singleFile, leftFile, rightFile);
  };

  const toggleExpand = (key: string) => {
    const newSet = new Set(expandedKeys);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedKeys(newSet);
  };

  const copyToClipboard = (text: string, summary: string) => {
    navigator.clipboard.writeText(text);
    addToast(summary, 'success', 2500);
  };

  const formatTemplateGroup = (group: TemplateGroup): string => {
    let md = `### 📊 Endpoint Analysis: ${group.alias || 'Auto'}\n\n`;
    md += `| Attribute | Value |\n| :--- | :--- |\n`;
    md += `| **Template URI** | \`${group.templateUri}\` |\n`;
    md += `| **Total Calls** | ${group.totalCount} |\n`;
    md += `| **Unique Variations** | ${group.rawCalls.length} |\n\n`;
    
    md += `#### 📋 Raw Call details\n\n`;
    md += `| Raw URI | Count | Sample Log |\n| :--- | :--- | :--- |\n`;
    group.rawCalls.forEach(rc => {
      const sample = rc.examples[0] ? `\`${rc.examples[0].substring(0, 50)}${rc.examples[0].length > 50 ? '...' : ''}\`` : '-';
      md += `| \`${rc.rawUri}\` | ${rc.count} | ${sample} |\n`;
    });
    return md;
  };

  const formatUAResult = (row: UAResult): string => {
    let md = `### 📱 User Agent Summary\n\n`;
    md += `| Variable | Value |\n| :--- | :--- |\n`;
    Object.entries(row.variables).forEach(([k, v]) => {
      md += `| **${k}** | ${v} |\n`;
    });
    md += `| **Total Context Hits** | ${row.count} |\n\n`;

    md += `#### 🌐 API Traffic Hierarchy (Full Detail)\n\n`;
    row.endpoints.forEach(ep => {
      md += `##### 📡 Endpoint: \`${ep.templateUri}\` (Total: ${ep.totalCount}, Unique: ${ep.rawCalls.length})\n\n`;
      md += `| Raw URI | Hits | Sample Log |\n| :--- | :--- | :--- |\n`;
      ep.rawCalls.forEach(rc => {
        const sample = rc.examples[0] ? `\`${rc.examples[0].substring(0, 50)}${rc.examples[0].length > 50 ? '...' : ''}\`` : '-';
        md += `| \`${rc.rawUri}\` | ${rc.count} | ${sample} |\n`;
      });
      md += `\n`;
    });
    return md;
  };

  const handleAddPattern = () => {
    setPatterns([...patterns, {
      id: Date.now().toString(),
      alias: '',
      keywords: '',
      extractRegex: '',
      enabled: true
    }]);
  };

  const handleUpdatePattern = (id: string, field: keyof TrafficPattern, value: any) => {
    setPatterns(patterns.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemovePattern = (id: string) => {
    setPatterns(patterns.filter(p => p.id !== id));
  };

  // Drag & Drop
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dropTarget, setDropTarget] = useState<'single' | 'left' | 'right' | null>(null);

  const handleDragEnter = (e: React.DragEvent, target: 'single' | 'left' | 'right') => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(true); setDropTarget(target);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false); setDropTarget(null);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent, target: 'single' | 'left' | 'right') => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false); setDropTarget(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (target === 'single') setSingleFile(file);
      else if (target === 'left') setLeftFile(file);
      else setRightFile(file);
    }
  };

  const renderFileDropArea = (target: 'single' | 'left' | 'right', file: File | null, label: string) => {
    const isTarget = dragActive && dropTarget === target;
    return (
      <div 
        className={`flex-1 min-h-[120px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-300 ${
          isTarget 
            ? 'border-indigo-500 bg-indigo-500/10 backdrop-blur-md shadow-lg shadow-indigo-500/20' 
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/30 hover:border-indigo-400 dark:hover:border-indigo-600'
        }`}
        onDragEnter={(e) => handleDragEnter(e, target)}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, target)}
      >
        {file ? (
          <div className="flex flex-col items-center text-center group/file relative">
            <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-full mb-2 group-hover/file:scale-110 transition-transform">
              <Lucide.FileText size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px] text-xs leading-tight">{file.name}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            <Button variant="ghost" size="sm" className="mt-3 text-red-500 h-8 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs" onClick={() => {
              if (target === 'single') setSingleFile(null);
              else if (target === 'left') setLeftFile(null);
              else setRightFile(null);
            }}>Change File</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center text-slate-400">
            <Lucide.CloudUpload size={32} className="mb-3 opacity-30 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">Drop {label} Here</span>
            <span className="text-[10px] opacity-60 mt-1">or click to browse</span>
          </div>
        )}
      </div>
    );
  };

  const renderTable = (data: TemplateGroup[], title: string) => {
    if (data.length === 0) return (
      <div className="p-10 text-center text-slate-400 italic">No data matched this category.</div>
    );
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-3 font-black text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs uppercase tracking-widest">
          <span>{title}</span>
          <span className="font-normal opacity-50">{data.length} Endpoints</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-950 shadow-sm text-slate-400 text-[10px] uppercase tracking-widest z-10">
              <tr>
                <th className="px-5 py-3 border-b dark:border-slate-800">Endpoint Structure</th>
                <th className="px-5 py-3 border-b dark:border-slate-800 text-right w-24">Hits</th>
              </tr>
            </thead>
            <tbody>
              {data.map((group, idx) => {
                const key = group.templateUri;
                const isExpanded = expandedKeys.has(key);
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 border-b border-indigo-50/20 dark:border-slate-800 last:border-0 transition-colors cursor-pointer group/row ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : ''}`}
                      onClick={() => toggleExpand(key)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start space-x-3">
                          <Lucide.ChevronRight size={16} className={`mt-0.5 flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-indigo-500 font-bold' : 'text-slate-400'}`} />
                          <div className="flex flex-col min-w-0 flex-1">
                             <div className="font-mono text-[13px] text-slate-800 dark:text-slate-300 break-all leading-relaxed flex items-start">
                               <div className="flex-1">
                                 {group.templateUri.split('$(UUID)').map((part, pIdx, arr) => (
                                   <React.Fragment key={pIdx}>
                                     {part}
                                     {pIdx < arr.length - 1 && (
                                       <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1.5 rounded-md mx-0.5 font-black text-xs">$(UUID)</span>
                                     )}
                                   </React.Fragment>
                                 ))}
                               </div>
                               <button 
                                 className="ml-3 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover/row:opacity-100 transition-all hover:scale-110 active:scale-95"
                                 onClick={(e) => { e.stopPropagation(); copyToClipboard(formatTemplateGroup(group), `Endpoint detail copied (${group.rawCalls.length} variations)`); }}
                                 title="Copy Full Analysis"
                               >
                                 <Lucide.Copy size={14} />
                               </button>
                             </div>
                             <div className="flex items-center mt-2 space-x-3 opacity-60">
                                <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md truncate max-w-[200px]">Alias: {group.alias}</span>
                                <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter">{group.rawCalls.length} Unique Entities</span>
                             </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-black text-indigo-600 dark:text-indigo-400 text-base tabular-nums">
                        {group.totalCount.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/40 dark:bg-black/40">
                        <td colSpan={2} className="p-0 border-b dark:border-slate-800">
                          <div className="p-6 pl-14 space-y-4">
                             <div className="space-y-3">
                                {group.rawCalls.map((rc, rcIdx) => (
                                  <div key={rcIdx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group/rc hover:border-emerald-500/30 transition-colors">
                                     <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex justify-between items-center border-b dark:border-slate-800">
                                        <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all flex-1 font-medium">{rc.rawUri}</div>
                                        <div className="flex items-center space-x-4 ml-6">
                                            <button 
                                              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-400 hover:text-emerald-500 opacity-0 group-hover/rc:opacity-100 transition-all shadow-sm"
                                              onClick={() => copyToClipboard(rc.rawUri, 'Raw URI copied to clipboard')}
                                              title="Copy Raw URI"
                                            >
                                              <Lucide.Copy size={12} />
                                            </button>
                                           <div className="font-black text-slate-600 dark:text-slate-400 text-[10px] tabular-nums bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">X{rc.count}</div>
                                        </div>
                                     </div>
                                     <div className="p-3 bg-white dark:bg-slate-900 space-y-1.5">
                                        {rc.examples.map((ex, exIdx) => (
                                          <div key={exIdx} className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap break-all border-l-2 border-emerald-500/20 pl-3 py-0.5">
                                            {ex}
                                          </div>
                                        ))}
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderUATable = (data: UAResult[], title: string) => {
    if (data.length === 0) return (
      <div className="p-10 text-center text-slate-400 italic">No User Agent data extracted.</div>
    );
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="bg-rose-50/50 dark:bg-rose-900/10 px-5 py-3 font-black text-rose-700 dark:text-rose-300 border-b border-rose-100 dark:border-rose-900/30 flex justify-between items-center text-xs uppercase tracking-widest">
          <div className="flex items-center space-x-2">
            <Lucide.Smartphone size={16} />
            <span>{title}</span>
          </div>
          <span className="font-normal opacity-50">{data.length} Identified Clients</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-950 shadow-sm text-slate-400 text-[10px] uppercase tracking-widest z-10">
              <tr>
                <th className="px-5 py-3 border-b dark:border-slate-800">Client Context & Payload</th>
                <th className="px-5 py-3 border-b dark:border-slate-800 text-right w-24">Hits</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const uaKey = `ua-${JSON.stringify(row.variables)}`;
                const isExpanded = expandedKeys.has(uaKey);
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-rose-50/50 dark:hover:bg-rose-900/10 border-b border-rose-50/20 dark:border-slate-800 transition-colors cursor-pointer group/ua ${isExpanded ? 'bg-rose-50/30 dark:bg-rose-900/5' : ''}`}
                      onClick={() => toggleExpand(uaKey)}
                    >
                      <td className="px-5 py-5">
                        <div className="flex items-start space-x-3">
                          <Lucide.ChevronRight size={16} className={`mt-1 flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-rose-500 font-bold' : 'text-slate-400'}`} />
                          <div className="flex flex-wrap gap-2.5 flex-1">
                            {Object.entries(row.variables).map(([k, v]) => (
                               <div key={k} className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 bg-white dark:bg-slate-800 shadow-sm group/tag hover:border-indigo-400 transition-colors">
                                  <span className="text-[8px] text-slate-400 font-black uppercase leading-none mb-1.5 tracking-tighter">{k}</span>
                                  <span className="text-[12px] font-mono text-indigo-600 dark:text-indigo-400 leading-none font-bold">{v}</span>
                               </div>
                            ))}
                          </div>
                          <button 
                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 opacity-0 group-hover/ua:opacity-100 transition-all hover:scale-110 shadow-sm"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(formatUAResult(row), `User context analysis copied (${row.endpoints.length} APIs logged)`); }}
                            title="Copy Hierarchy to Markdown"
                          >
                             <Lucide.Copy size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right font-black text-rose-600 dark:text-rose-400 text-lg tabular-nums">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/30 dark:bg-black/30">
                         <td colSpan={2} className="p-0 border-b dark:border-slate-800">
                            <div className="p-6 pl-14 space-y-6">
                               <div className="flex items-center space-x-3">
                                  <div className="h-0.5 w-6 bg-rose-500 rounded-full" />
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Traffic Pipeline for this Client</div>
                               </div>
                               <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg shadow-black/5">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                     <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[9px] font-bold tracking-tighter">
                                        <tr>
                                           <th className="px-4 py-2 border-b dark:border-slate-800">Endpoint Template</th>
                                           <th className="px-4 py-2 border-b dark:border-slate-800 text-right w-24">Hits</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {row.endpoints.map((ep, eIdx) => {
                                          const epKey = `${uaKey}-ep-${ep.templateUri}`;
                                          const isEpExpanded = expandedKeys.has(epKey);
                                          return (
                                            <React.Fragment key={eIdx}>
                                              <tr 
                                                className={`border-b dark:border-slate-800 last:border-0 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer group/ep transition-colors ${isEpExpanded ? 'bg-indigo-50/20' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(epKey); }}
                                              >
                                                 <td className="px-4 py-3 flex items-center space-x-3 min-w-0">
                                                    <Lucide.ChevronRight size={14} className={`transition-transform duration-300 ${isEpExpanded ? 'rotate-90 text-indigo-500' : 'text-slate-400'}`} />
                                                    <span className="font-mono text-slate-700 dark:text-slate-300 break-all flex-1 font-medium">{ep.templateUri}</span>
                                                    <button 
                                                      className="p-1 px-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500 opacity-0 group-hover/ep:opacity-100 transition-all text-[10px]"
                                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(formatTemplateGroup(ep as any), 'Endpoint metrics copied'); }}
                                                      title="Copy Endpoint Data"
                                                    >
                                                       <Lucide.Copy size={12} />
                                                    </button>
                                                 </td>
                                                 <td className="px-4 py-3 text-right font-black text-indigo-500 tabular-nums text-sm truncate">{ep.totalCount}</td>
                                              </tr>
                                              {isEpExpanded && (
                                                <tr className="bg-slate-50/50 dark:bg-black/20">
                                                   <td colSpan={2} className="p-4 pl-10">
                                                      <div className="space-y-3">
                                                         {ep.rawCalls.map((rc, rcIdx) => (
                                                           <div key={rcIdx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-[10px] group/uarc shadow-sm">
                                                              <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 flex justify-between items-center border-b dark:border-slate-700">
                                                                 <div className="font-mono text-emerald-600 dark:text-emerald-400 break-all flex-1 font-bold"> {rc.rawUri} </div>
                                                                 <div className="flex items-center space-x-3 ml-4">
                                                                    <button 
                                                                      className="p-1.5 rounded-md bg-white dark:bg-slate-700 text-slate-400 hover:text-emerald-500 opacity-0 group-hover/uarc:opacity-100 transition-all"
                                                                      onClick={() => copyToClipboard(rc.rawUri, 'Full URI copied')}
                                                                    >
                                                                      <Lucide.Copy size={11} />
                                                                    </button>
                                                                    <div className="font-black opacity-80 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">X{rc.count}</div>
                                                                 </div>
                                                              </div>
                                                              <div className="p-2.5 space-y-1.5">
                                                                 {rc.examples.map((ex, exIdx) => (
                                                                   <div key={exIdx} className="font-mono text-[9px] text-slate-500 whitespace-pre-wrap break-all border-l-2 border-indigo-200 dark:border-indigo-900/50 pl-2.5 leading-relaxed">
                                                                      {ex}
                                                                   </div>
                                                                 ))}
                                                              </div>
                                                           </div>
                                                         ))}
                                                      </div>
                                                   </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                        {row.endpoints.length === 0 && (
                                          <tr><td colSpan={2} className="p-10 text-center text-slate-400 italic">No traffic recorded for this session.</td></tr>
                                        )}
                                     </tbody>
                                  </table>
                               </div>
                            </div>
                         </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderInsightsTab = (insights: any, title: string) => {
    if (!insights) return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic">
        <Lucide.ZapOff size={40} className="mb-2 opacity-20" />
        <p>No insights found in this log.</p>
      </div>
    );

    const timelineEntries = (Object.entries(insights.timeline) as [string, number][]).sort((a, b) => {
      if (a[0].endsWith('m') && b[0].endsWith('m')) {
        return parseInt(a[0]) - parseInt(b[0]);
      }
      return a[0].localeCompare(b[0]);
    });
    const maxTimeline = Math.max(...Object.values(insights.timeline) as number[], 1);
    const hostEntries = (Object.entries(insights.hosts) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const methodEntries = (Object.entries(insights.methods) as [string, number][]).sort((a, b) => b[1] - a[1]);

    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar overflow-x-hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 hover:border-indigo-500/30 transition-all group">
            <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest group-hover:text-indigo-400">Total Intelligence Requests</div>
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tighter">{insights.totalRequests.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 hover:border-emerald-500/30 transition-all group">
            <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest group-hover:text-emerald-400">Active External Hosts</div>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">{Object.keys(insights.hosts).length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 hover:border-amber-500/30 transition-all group">
            <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest group-hover:text-amber-400">Avg Traffic Intensity</div>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tighter">
              {(insights.totalRequests / (timelineEntries.length || 1)).toFixed(1)} <span className="text-xs font-medium text-slate-400 ml-1">r/m</span>
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5">
          <h4 className="text-xs font-black text-slate-500 uppercase mb-6 flex items-center tracking-widest">
            <div className="p-1.5 bg-indigo-500 text-white rounded-lg mr-3"><Lucide.Activity size={16} /></div> 
            Network Traffic Density Timeline
          </h4>
          <div className="flex items-end space-x-1.5 h-40 w-full group/chart px-2">
            {timelineEntries.map(([min, count]) => (
              <div key={min} className="flex-1 flex flex-col items-center group/bar h-full justify-end">
                <div 
                  className="w-full bg-indigo-500/30 group-hover/chart:bg-indigo-500/10 hover:!bg-indigo-500 transition-all rounded-t-md relative cursor-pointer"
                  style={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 whitespace-nowrap z-20 shadow-xl pointer-events-none">
                    <div className="font-black text-indigo-300">{min}</div>
                    <div>{count} Requests</div>
                  </div>
                </div>
              </div>
            ))}
            {timelineEntries.length === 0 && <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic py-10">Waiting for intelligence data...</div>}
          </div>
          <div className="flex justify-between mt-4 text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 font-bold uppercase tracking-wider">
             <span className="flex items-center"><Lucide.Clock size={10} className="mr-1" /> {timelineEntries[0]?.[0] || 'Start'}</span>
             <span className="opacity-40">Temporal Distribution Focus</span>
             <span className="flex items-center">{timelineEntries[timelineEntries.length-1]?.[0] || 'End'} <Lucide.Clock size={10} className="ml-1" /></span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Domains */}
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5">
            <h4 className="text-xs font-black text-slate-500 uppercase mb-6 flex items-center tracking-widest">
              <div className="p-1.5 bg-emerald-500 text-white rounded-lg mr-3"><Lucide.Globe size={16} /></div> 
              Strategic Domain Intelligence
            </h4>
            <div className="space-y-4">
              {hostEntries.map(([host, count]) => (
                <div key={host} className="group/host">
                  <div className="flex justify-between text-[11px] mb-2 px-1">
                    <span className="font-mono text-slate-600 dark:text-slate-300 truncate mr-3 font-bold group-hover/host:text-emerald-500 transition-colors">{host}</span>
                    <span className="font-black text-slate-700 dark:text-slate-400 tabular-nums">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${((count as number) / insights.totalRequests) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Methods */}
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5">
             <h4 className="text-xs font-black text-slate-500 uppercase mb-6 flex items-center tracking-widest">
              <div className="p-1.5 bg-amber-500 text-white rounded-lg mr-3"><Lucide.Layers size={16} /></div> 
              Protocol Activity Analysis
            </h4>
            <div className="space-y-4">
              {methodEntries.map(([method, count]) => (
                <div key={method} className="flex items-center group/method p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all">
                  <span className={`w-14 text-[9px] font-black text-center py-1 rounded-lg mr-4 tracking-tighter shadow-sm ${
                    method === 'GET' ? 'bg-blue-500 text-white' : 
                    method === 'POST' ? 'bg-emerald-500 text-white' :
                    method === 'PUT' ? 'bg-amber-500 text-white' :
                    'bg-slate-400 text-white'
                  }`}>{method}</span>
                  <div className="flex-1 flex items-center">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mr-4 shadow-inner">
                      <div className="bg-slate-400 h-full transition-all duration-500" style={{ width: `${((count as number) / insights.totalRequests) * 100}%` }} />
                    </div>
                    <span className="text-xs font-black w-10 text-right tabular-nums text-slate-700 dark:text-slate-300">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans text-sm selection:bg-indigo-500/30">
      {/* Header Tabs */}
      <div className="flex items-center space-x-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 backdrop-blur-md shrink-0 z-20">
        <button
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'single' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'}`}
          onClick={() => setActiveTab('single')}
        >Single Analysis</button>
        <button
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'compare' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'}`}
          onClick={() => setActiveTab('compare')}
        >Compare View</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Settings */}
        <div className="w-[320px] border-r border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 p-6 shrink-0 flex flex-col overflow-y-auto custom-scrollbar z-10 space-y-8">
          
          {/* Section 1: Data Acquisition */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center mb-5">
               <Lucide.Database size={16} className="mr-3 text-indigo-500" /> 01. Data Acquisition
            </h3>
            <div className="space-y-4">
              {activeTab === 'single' ? renderFileDropArea('single', singleFile, 'Source Log') : (
                <div className="flex flex-col space-y-3">
                  {renderFileDropArea('left', leftFile, 'Primary')}
                  {renderFileDropArea('right', rightFile, 'Reference')}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: User Agent Profile */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center mb-5">
               <Lucide.UserSearch size={16} className="mr-3 text-emerald-500" /> 02. Client context
            </h3>
            <div className="group bg-indigo-50/20 dark:bg-indigo-900/10 backdrop-blur-md rounded-2xl border border-indigo-100/30 dark:border-indigo-500/10 p-5 shadow-inner transition-all hover:border-indigo-500/20 space-y-4">
               <label className="flex items-center space-x-3 cursor-pointer group/toggle">
                 <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={uaPattern.enabled} onChange={(e) => setUAPattern({...uaPattern, enabled: e.target.checked})} />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
                 </div>
                 <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight group-hover/toggle:text-indigo-500 transition-colors">Active Identifier</span>
               </label>
               
               <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Required Keywords</label>
                 <input 
                    type="text" 
                    value={uaPattern.keywords} 
                    onChange={(e) => setUAPattern({...uaPattern, keywords: e.target.value})} 
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    placeholder="e.g. User Agent, Device"
                 />
               </div>
               
               <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Registry Template</label>
                 <textarea 
                    rows={2}
                    value={uaPattern.template} 
                    onChange={(e) => setUAPattern({...uaPattern, template: e.target.value})} 
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none"
                    placeholder="$(Label) pattern"
                 />
               </div>
            </div>
          </div>

          {/* Section 3: Intelligence Filters */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center mb-5">
               <Lucide.Cpu size={16} className="mr-3 text-amber-500" /> 03. Traffic filters
            </h3>
            <div className="space-y-4">
              {patterns.map((p) => (
                <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-3 hover:shadow-lg transition-all group/p">
                  <div className="flex items-center space-x-3">
                    <input type="checkbox" checked={p.enabled} onChange={(e) => handleUpdatePattern(p.id, 'enabled', e.target.checked)} className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500" />
                    <input 
                      type="text" 
                      placeholder="Node Alias" 
                      value={p.alias} 
                      onChange={(e) => handleUpdatePattern(p.id, 'alias', e.target.value)} 
                      className="flex-1 bg-transparent border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-amber-500 transition-all px-1 py-0.5 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 outline-none" 
                    />
                    <button onClick={() => handleRemovePattern(p.id)} className="text-red-500 opacity-0 group-hover/p:opacity-50 hover:!opacity-100 transition-all"><Lucide.Trash2 size={14} /></button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Signature keywords" 
                    value={p.keywords} 
                    onChange={(e) => handleUpdatePattern(p.id, 'keywords', e.target.value)} 
                    className="w-full bg-slate-100/50 dark:bg-slate-950/50 rounded-lg px-3 py-1.5 text-xs font-mono border border-transparent focus:border-amber-500/30 transition-all outline-none" 
                  />
                </div>
              ))}
              <Button variant="outline" className="w-full text-[10px] h-10 border-dashed rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-900 transition-all" onClick={handleAddPattern}>
                <Lucide.PlusCircle size={14} className="mr-2" /> Append Logic
              </Button>
            </div>
          </div>

          {/* Bottom Action */}
          <div className="mt-auto pt-8">
            <Button 
                variant="primary" 
                className={`w-full py-4 font-black uppercase tracking-[0.2em] flex items-center justify-center rounded-2xl transition-all duration-500 ${analyzing ? 'bg-indigo-900' : 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0 active:shadow-indigo-500/10'}`}
                onClick={handleStartAnalysis}
                disabled={analyzing || (activeTab === 'single' && !singleFile) || (activeTab === 'compare' && (!leftFile || !rightFile))}
            >
              {analyzing ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center mb-1">
                    <Lucide.Cpu size={20} className="mr-3 animate-pulse" />
                    <span>Crunching Data...</span>
                  </div>
                  <div className="text-[10px] opacity-60 font-medium">{progress}% Complete</div>
                </div>
              ) : (
                <>
                  <Lucide.Zap size={20} className="mr-3" /> 
                  <span>Run Analysis</span>
                </>
              )}
            </Button>
            <p className="text-[9px] text-center text-slate-400 mt-4 font-bold uppercase tracking-widest opacity-40">System Engine: v1.1.4 Deep-Trace</p>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="flex-1 p-6 bg-white dark:bg-slate-950 overflow-hidden flex flex-col relative">
          
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none -z-1" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none -z-1" />

          {hasAnalyzed && !analyzing && (
            <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6 space-x-10 shrink-0 z-10 px-2">
              {(['endpoints', 'ua', 'insights'] as const).map(t => (
                <button 
                  key={t} 
                  onClick={() => setResultTab(t)} 
                  className={`pb-4 px-1 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 relative ${resultTab === t ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t}
                  {resultTab === t && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full animate-in slide-in-from-bottom-1" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col z-10">
            {!hasAnalyzed ? (
              <div className="flex-1 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-500">
                <div className="p-8 bg-slate-50 dark:bg-slate-900 rounded-full mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950">
                  <Lucide.BarChart3 size={48} className="opacity-20 group-hover:opacity-60 text-indigo-500 transition-all" />
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-2">Ready for Neural Parsing</h4>
                <p className="text-sm opacity-60">Upload your telemetry logs and initiate the deep analysis engine.</p>
              </div>
            ) : analyzing ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-500/10 rounded-full animate-spin border-t-indigo-600 border-r-indigo-600" />
                  <Lucide.Activity size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 animate-pulse" />
                </div>
                <div className="flex flex-col items-center space-y-3">
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Processing Stream</div>
                  <div className="w-64 bg-slate-100 dark:bg-slate-900 h-2 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200 dark:ring-slate-800">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full transition-all duration-300 shadow-lg shadow-indigo-500/40" style={{width: `${progress}%`}} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black tracking-widest">{progress}% AGGREGATED</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-500">
                  {resultTab === 'endpoints' && renderTable(singleResult.filter(g => g.templateUri.includes('$(UUID)')), 'Aggregated API Endpoints')}
                  {resultTab === 'ua' && renderUATable(singleUAResult, 'User Agent Identification 브리핑')}
                  {resultTab === 'insights' && (activeTab === 'single' ? renderInsightsTab(singleInsights, 'Traffic Insights Dashboard') : (
                    <div className="flex-1 flex h-full space-x-6 overflow-hidden">
                       <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <div className="bg-white dark:bg-slate-800 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 shadow-sm">Primary Dataset (Left)</div>
                         {renderInsightsTab(leftInsights, 'Left Dataset Insights')}
                       </div>
                       <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <div className="bg-white dark:bg-slate-800 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 shadow-sm">Reference Dataset (Right)</div>
                         {renderInsightsTab(rightInsights, 'Right Dataset Insights')}
                       </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetTrafficAnalyzerView;
