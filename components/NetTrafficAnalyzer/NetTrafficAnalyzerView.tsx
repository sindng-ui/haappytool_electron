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
        className={`flex-1 min-h-[90px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-3 transition-all duration-300 ${
          isTarget 
            ? 'border-indigo-500 bg-indigo-500/10 backdrop-blur-md' 
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30'
        }`}
        onDragEnter={(e) => handleDragEnter(e, target)}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, target)}
      >
        {file ? (
          <div className="flex flex-col items-center text-center">
            <Lucide.FileText size={20} className="text-indigo-500 mb-1" />
            <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px] text-[10px]">{file.name}</span>
            <Button variant="ghost" size="sm" className="mt-1 text-red-500 h-6 px-2 text-[9px]" onClick={() => {
              if (target === 'single') setSingleFile(null);
              else if (target === 'left') setLeftFile(null);
              else setRightFile(null);
            }}>Change</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center text-slate-400">
            <Lucide.Upload size={20} className="mb-1 opacity-30" />
            <span className="text-[9px] font-black uppercase tracking-widest">Drop {label}</span>
          </div>
        )}
      </div>
    );
  };

  const renderTable = (data: TemplateGroup[], title: string) => {
    if (data.length === 0) return (
      <div className="p-6 text-center text-slate-400 italic text-xs">No matching endpoints found.</div>
    );
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 font-black text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] uppercase tracking-widest">
          <span>{title}</span>
          <span className="font-normal opacity-50">{data.length} Results</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-950 shadow-sm text-slate-400 text-[10px] uppercase tracking-tighter z-10">
              <tr>
                <th className="px-3 py-2 border-b dark:border-slate-800 font-bold">Structure / URI Template</th>
                <th className="px-3 py-2 border-b dark:border-slate-800 text-right w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((group, idx) => {
                const key = group.templateUri;
                const isExpanded = expandedKeys.has(key);
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/10 dark:bg-indigo-900/5' : ''}`}
                      onClick={() => toggleExpand(key)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-start space-x-2">
                          <Lucide.ChevronRight size={14} className={`mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : 'text-slate-400'}`} />
                          <div className="flex flex-col min-w-0 flex-1">
                             <div className="font-mono text-[12px] text-slate-800 dark:text-slate-300 break-all leading-normal flex items-start group">
                               <div className="flex-1">
                                 {group.templateUri.split('$(UUID)').map((part, pIdx, arr) => (
                                   <React.Fragment key={pIdx}>
                                     {part}
                                     {pIdx < arr.length - 1 && (
                                       <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1 rounded-sm mx-0.5 font-bold text-[10px]">$(UUID)</span>
                                     )}
                                   </React.Fragment>
                                 ))}
                               </div>
                               <button 
                                 className="ml-2 p-1 text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                 onClick={(e) => { e.stopPropagation(); copyToClipboard(formatTemplateGroup(group), `Copied detail for ${group.templateUri}`); }}
                               >
                                 <Lucide.Copy size={12} />
                               </button>
                             </div>
                             <div className="flex items-center mt-1 space-x-2 opacity-50 text-[10px]">
                                <span className="truncate max-w-[150px]">Alias: {group.alias}</span>
                                <span className="text-indigo-500 font-black tracking-tighter">{group.rawCalls.length} Variations</span>
                             </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-black text-indigo-500 text-sm tabular-nums">
                        {group.totalCount.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/50 dark:bg-black/20">
                        <td colSpan={2} className="p-0">
                          <div className="py-2 px-3 pl-8 space-y-2">
                             {group.rawCalls.map((rc, rcIdx) => (
                               <div key={rcIdx} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-[10px] group/rc shadow-sm">
                                  <div className="bg-slate-50 dark:bg-slate-800 px-3 py-1 flex justify-between items-center border-b dark:border-slate-800">
                                     <div className="font-mono text-emerald-600 dark:text-emerald-400 break-all flex-1 font-medium">{rc.rawUri}</div>
                                     <div className="flex items-center space-x-2 ml-4">
                                         <button 
                                           className="p-1 text-slate-300 hover:text-emerald-500 opacity-0 group-hover/rc:opacity-100 transition-opacity"
                                           onClick={() => copyToClipboard(rc.rawUri, 'Path copied')}
                                         >
                                           <Lucide.Copy size={11} />
                                         </button>
                                        <div className="font-bold text-slate-500 text-[10px]">x{rc.count}</div>
                                     </div>
                                  </div>
                                  <div className="p-1.5 space-y-0.5">
                                     {rc.examples.map((ex, exIdx) => (
                                       <div key={exIdx} className="text-[9px] font-mono text-slate-400 whitespace-pre-wrap break-all border-l border-emerald-500/30 pl-2 leading-tight">
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
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderUATable = (data: UAResult[], title: string) => {
    if (data.length === 0) return (
      <div className="p-6 text-center text-slate-400 italic text-xs">No client data indentified.</div>
    );
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="bg-rose-50/30 dark:bg-rose-900/10 px-4 py-2 font-black text-rose-700 dark:text-rose-400 border-b border-rose-100 dark:border-rose-900/20 flex justify-between items-center text-[10px] uppercase tracking-widest">
          <div className="flex items-center space-x-1.5">
            <Lucide.Laptop size={14} />
            <span>{title}</span>
          </div>
          <span className="font-normal opacity-50">{data.length} Nodes</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-950 shadow-sm text-slate-400 text-[10px] uppercase tracking-tighter z-10">
              <tr>
                <th className="px-3 py-2 border-b dark:border-slate-800 font-bold">Identified Context & Attributes</th>
                <th className="px-3 py-2 border-b dark:border-slate-800 text-right w-16">Hits</th>
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
                      <td className="px-3 py-2.5">
                        <div className="flex items-start space-x-2">
                          <Lucide.ChevronRight size={14} className={`mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-rose-500' : 'text-slate-400'}`} />
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {Object.entries(row.variables).map(([k, v]) => (
                               <div key={k} className="flex flex-col border border-slate-100 dark:border-slate-800 rounded px-2 py-0.5 bg-white dark:bg-slate-900/50 shadow-sm">
                                  <span className="text-[7px] text-slate-400 font-black uppercase tracking-tight">{k}</span>
                                  <span className="text-[10px] font-mono text-indigo-500 leading-tight font-bold">{v}</span>
                               </div>
                            ))}
                          </div>
                          <button 
                            className="p-1 px-1.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(formatUAResult(row), `Client analysis copied`); }}
                          >
                             <Lucide.Copy size={11} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-rose-500 text-base tabular-nums">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/30 dark:bg-black/30">
                         <td colSpan={2} className="p-0">
                            <div className="py-3 px-4 pl-9 space-y-3">
                               <div className="flex items-center space-x-2">
                                  <div className="h-0.5 w-4 bg-rose-500/50 rounded-full" />
                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client Traffic Pipeline</div>
                               </div>
                               <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                  <table className="w-full text-left text-[10px] border-collapse">
                                     <tbody>
                                        {row.endpoints.map((ep, eIdx) => {
                                          const epKey = `${uaKey}-ep-${ep.templateUri}`;
                                          const isEpExpanded = expandedKeys.has(epKey);
                                          return (
                                            <React.Fragment key={eIdx}>
                                              <tr 
                                                className={`border-b dark:border-slate-800 last:border-0 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 cursor-pointer group/ep ${isEpExpanded ? 'bg-indigo-50/20' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(epKey); }}
                                              >
                                                 <td className="px-3 py-1.5 flex items-center space-x-2 min-w-0">
                                                    <Lucide.ChevronRight size={12} className={`transition-transform ${isEpExpanded ? 'rotate-90 text-indigo-500' : 'text-slate-400'}`} />
                                                    <span className="font-mono text-slate-600 dark:text-slate-400 truncate flex-1">{ep.templateUri}</span>
                                                    <button 
                                                      className="p-1 text-slate-300 hover:text-indigo-500 opacity-0 group-hover/ep:opacity-100 transition-opacity"
                                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(formatTemplateGroup(ep as any), 'Endpoint data copied'); }}
                                                    >
                                                       <Lucide.Copy size={10} />
                                                    </button>
                                                 </td>
                                                 <td className="px-3 py-1.5 text-right font-bold text-indigo-500/80 tabular-nums">{ep.totalCount}</td>
                                              </tr>
                                              {isEpExpanded && (
                                                <tr className="bg-slate-100/20 dark:bg-black/40">
                                                   <td colSpan={2} className="p-2 pl-8">
                                                      <div className="space-y-2">
                                                         {ep.rawCalls.map((rc, rcIdx) => (
                                                           <div key={rcIdx} className="bg-white dark:bg-slate-900 rounded-md border border-slate-100 dark:border-slate-800 overflow-hidden text-[9px] group/uarc">
                                                              <div className="bg-slate-50 dark:bg-slate-800 px-2 py-1 flex justify-between items-center border-b dark:border-slate-700">
                                                                 <div className="font-mono text-emerald-600 dark:text-emerald-400 truncate flex-1"> {rc.rawUri} </div>
                                                                 <div className="font-black text-[8px] ml-2 opacity-50">x{rc.count}</div>
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
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic text-xs">
        <Lucide.Activity size={32} className="mb-2 opacity-10" />
        <p>Awaiting insight data...</p>
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
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar overflow-x-hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-indigo-500">
            <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Total Requests</div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-200 tabular-nums">{insights.totalRequests.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-500">
            <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Unique Hosts</div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-300 tabular-nums">{Object.keys(insights.hosts).length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
            <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-wider">Avg Traffic Intensity</div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-300 tabular-nums">
              {(insights.totalRequests / (timelineEntries.length || 1)).toFixed(1)} <span className="text-[10px] opacity-40">r/m</span>
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center tracking-widest">
            <Lucide.Zap size={10} className="mr-2 text-indigo-500" /> Traffic Density Profile
          </h4>
          <div className="flex items-end space-x-1 h-24 w-full group/chart px-1">
            {timelineEntries.map(([min, count]) => (
              <div key={min} className="flex-1 flex flex-col items-center group/bar h-full justify-end">
                <div 
                  className="w-full bg-indigo-500/20 hover:bg-indigo-500 transition-all rounded-t-sm relative cursor-pointer"
                  style={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 whitespace-nowrap z-20 pointer-events-none">
                    {min}: {count}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[7px] text-slate-400 border-t border-slate-50 dark:border-slate-800 pt-2 font-bold opacity-60">
             <span>{timelineEntries[0]?.[0] || 'Start'}</span>
             <span>Temporal Activity Graph</span>
             <span>{timelineEntries[timelineEntries.length-1]?.[0] || 'End'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Domains */}
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-sm p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center tracking-widest">
               <Lucide.Globe size={11} className="mr-2 text-emerald-500" /> Host Distribution
            </h4>
            <div className="space-y-2.5">
              {hostEntries.map(([host, count]) => (
                <div key={host} className="group/host">
                  <div className="flex justify-between text-[10px] mb-1 px-1">
                    <span className="font-mono text-slate-500 truncate mr-2 font-bold group-hover/host:text-emerald-500 transition-colors">{host}</span>
                    <span className="font-black text-slate-600 dark:text-slate-400">{count}</span>
                  </div>
                  <div className="w-full bg-slate-50 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${((count as number) / insights.totalRequests) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Methods */}
          <div className="bg-white dark:bg-slate-900/40 backdrop-blur-sm p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
             <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center tracking-widest">
              <Lucide.Hash size={11} className="mr-2 text-amber-500" /> Protocol Metrics
            </h4>
            <div className="space-y-2">
              {methodEntries.map(([method, count]) => (
                <div key={method} className="flex items-center group/method p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg transition-all">
                  <span className={`w-10 text-[8px] font-black text-center py-0.5 rounded-md mr-3 text-white ${
                    method === 'GET' ? 'bg-blue-500' : 
                    method === 'POST' ? 'bg-emerald-500' :
                    method === 'PUT' ? 'bg-amber-500' :
                    'bg-slate-400'
                  }`}>{method}</span>
                  <div className="flex-1 flex items-center">
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800 h-2 rounded-full overflow-hidden mr-3">
                      <div className="bg-slate-400 h-full" style={{ width: `${((count as number) / insights.totalRequests) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-black w-6 text-right tabular-nums text-slate-500">{count}</span>
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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans text-xs selection:bg-indigo-500/20">
      {/* Header Tabs */}
      <div className="flex items-center space-x-1.5 p-1.5 px-3 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/80 backdrop-blur-md shrink-0 z-20">
        <button
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'single' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
          onClick={() => setActiveTab('single')}
        >Single Analytics</button>
        <button
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'compare' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
          onClick={() => setActiveTab('compare')}
        >Compare Engine</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: High Density Settings */}
        <div className="w-[400px] border-r border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 p-4 shrink-0 flex flex-col overflow-y-auto custom-scrollbar z-10 space-y-6">
          
          {/* Section 1: Source */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-1">
               <Lucide.Archive size={14} className="mr-2 text-indigo-500" /> 01. SOURCE DEPLOYMENT
            </h3>
            <div className="space-y-3">
              {activeTab === 'single' ? renderFileDropArea('single', singleFile, 'Log Stream') : (
                <div className="flex flex-col space-y-2">
                  {renderFileDropArea('left', leftFile, 'Primary Source')}
                  {renderFileDropArea('right', rightFile, 'Reference Source')}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: UA Context */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-1">
               <Lucide.ScanSearch size={14} className="mr-2 text-emerald-500" /> 02. CLIENT SIGNATURE
            </h3>
            <div className="group bg-indigo-50/10 dark:bg-indigo-900/10 backdrop-blur-sm rounded-xl border border-indigo-100/20 dark:border-indigo-500/10 p-4 space-y-3 transition-colors hover:border-indigo-500/20">
               <label className="flex items-center space-x-2.5 cursor-pointer group/toggle">
                 <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={uaPattern.enabled} onChange={(e) => setUAPattern({...uaPattern, enabled: e.target.checked})} />
                    <div className="w-8 h-4 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
                 </div>
                 <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight group-hover/toggle:text-indigo-500 transition-colors">Identity Profiling</span>
               </label>
               
               <div className="space-y-1">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Primary Keywords</label>
                 <input 
                    type="text" 
                    value={uaPattern.keywords} 
                    onChange={(e) => setUAPattern({...uaPattern, keywords: e.target.value})} 
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500/20 transition-all outline-none"
                    placeholder="Search keywords..."
                 />
               </div>
               
               <div className="space-y-1">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Template Architecture</label>
                 <textarea 
                    rows={3}
                    value={uaPattern.template} 
                    onChange={(e) => setUAPattern({...uaPattern, template: e.target.value})} 
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500/20 transition-all outline-none resize-none leading-tight"
                    placeholder="Extraction pattern..."
                 />
               </div>
            </div>
          </div>

          {/* Section 3: Traffic Patterns */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-1">
               <Lucide.Layers3 size={14} className="mr-2 text-amber-500" /> 03. INTELLIGENCE RULES
            </h3>
            <div className="space-y-2.5">
              {patterns.map((p) => (
                <div key={p.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm space-y-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all group/p">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" checked={p.enabled} onChange={(e) => handleUpdatePattern(p.id, 'enabled', e.target.checked)} className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 w-3 h-3" />
                    <input 
                      type="text" 
                      placeholder="Node Alias" 
                      value={p.alias} 
                      onChange={(e) => handleUpdatePattern(p.id, 'alias', e.target.value)} 
                      className="flex-1 bg-transparent border-0 focus:ring-0 px-0.5 py-0 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 outline-none truncate" 
                    />
                    <button onClick={() => handleRemovePattern(p.id)} className="text-red-500 opacity-0 group-hover/p:opacity-50 hover:!opacity-100 transition-all"><Lucide.Trash size={12} /></button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Signature keywords" 
                    value={p.keywords} 
                    onChange={(e) => handleUpdatePattern(p.id, 'keywords', e.target.value)} 
                    className="w-full bg-slate-100/50 dark:bg-slate-950/50 rounded-md px-2 py-1 text-[10px] font-mono border border-transparent focus:border-amber-500/20 transition-all outline-none" 
                  />
                </div>
              ))}
              <Button variant="outline" className="w-full text-[9px] h-8 border-dashed rounded-xl font-black uppercase tracking-widest hover:bg-indigo-50/30 transition-all border-slate-300 dark:border-slate-800" onClick={handleAddPattern}>
                <Lucide.PlusCircle size={14} className="mr-2" /> Add Logic Pipeline
              </Button>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="mt-auto pt-6">
            <Button 
                variant="primary" 
                className={`w-full py-3 font-black uppercase tracking-[0.2em] flex items-center justify-center rounded-xl transition-all duration-300 shadow-md ${analyzing ? 'bg-slate-800' : 'bg-gradient-to-r from-indigo-700 to-indigo-600 hover:shadow-indigo-500/20'}`}
                onClick={handleStartAnalysis}
                disabled={analyzing || (activeTab === 'single' && !singleFile) || (activeTab === 'compare' && (!leftFile || !rightFile))}
            >
              {analyzing ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center">
                    <Lucide.RefreshCcw size={16} className="mr-2 animate-spin" />
                    <span className="text-[11px]">Processing {progress}%</span>
                  </div>
                </div>
              ) : (
                <>
                  <Lucide.Play size={16} className="mr-2" /> 
                  <span className="text-[11px]">Run Analysis</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel: Data Stream Output */}
        <div className="flex-1 p-3 bg-white dark:bg-slate-950/50 overflow-hidden flex flex-col relative">
          
          {hasAnalyzed && !analyzing && (
            <div className="flex border-b border-slate-100 dark:border-slate-800 mb-3 space-x-6 shrink-0 px-2">
              {(['endpoints', 'ua', 'insights'] as const).map(t => (
                <button 
                  key={t} 
                  onClick={() => setResultTab(t)} 
                  className={`pb-2 px-1 text-[9px] font-black uppercase tracking-widest transition-all relative ${resultTab === t ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t}
                  {resultTab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col">
            {!hasAnalyzed ? (
              <div className="flex-1 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                <Lucide.MonitorSearch size={32} className="opacity-20 mb-3" />
                <h4 className="text-sm font-black text-slate-600 dark:text-slate-400">System Ready for Log Ingestion</h4>
              </div>
            ) : analyzing ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <Lucide.Loader size={32} className="text-indigo-500 animate-spin" />
                <div className="w-48 bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                  <div className="bg-indigo-500 h-full transition-all duration-300" style={{width: `${progress}%`}} />
                </div>
                <div className="text-[10px] font-black text-slate-500 tracking-tighter">{progress}% DECODED</div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                  {resultTab === 'endpoints' && renderTable(singleResult.filter(g => g.templateUri.includes('$(UUID)')), 'Aggregated API Telemetry')}
                  {resultTab === 'ua' && renderUATable(singleUAResult, 'Authenticated Client Clusters')}
                  {resultTab === 'insights' && (activeTab === 'single' ? renderInsightsTab(singleInsights, 'Operational Metrics') : (
                    <div className="flex-1 flex h-full space-x-3 overflow-hidden">
                       <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                         <div className="bg-white dark:bg-slate-800 px-3 py-1 text-[9px] font-black uppercase text-indigo-500 border-b dark:border-slate-700">Primary Source</div>
                         {renderInsightsTab(leftInsights, 'Left Insights')}
                       </div>
                       <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                         <div className="bg-white dark:bg-slate-800 px-3 py-1 text-[9px] font-black uppercase text-rose-500 border-b dark:border-slate-700">Reference Source</div>
                         {renderInsightsTab(rightInsights, 'Right Insights')}
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
