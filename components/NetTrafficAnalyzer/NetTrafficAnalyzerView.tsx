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
        className={`flex-1 min-h-[100px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 transition-colors ${
          isTarget ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
        }`}
        onDragEnter={(e) => handleDragEnter(e, target)}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, target)}
      >
        {file ? (
          <div className="flex flex-col items-center text-center">
            <Lucide.FileText size={24} className="text-indigo-500 mb-2" />
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{file.name}</span>
            <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            <Button variant="ghost" size="sm" className="mt-2 text-red-500 h-7" onClick={() => {
              if (target === 'single') setSingleFile(null);
              else if (target === 'left') setLeftFile(null);
              else setRightFile(null);
            }}>Change</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center text-slate-500">
            <Lucide.UploadCloud size={28} className="mb-2 opacity-50" />
            <span className="text-xs font-medium">Drag & Drop {label}</span>
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
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <span>{title}</span>
          <span className="text-xs font-normal opacity-70">{data.length} Endpoints</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-3 border-b dark:border-slate-800">Endpoint / Template (UUID Normalized)</th>
                <th className="p-3 border-b dark:border-slate-800 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((group, idx) => {
                const key = group.templateUri;
                const isExpanded = expandedKeys.has(key);
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors cursor-pointer group/row ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                      onClick={() => toggleExpand(key)}
                    >
                      <td className="p-3">
                        <div className="flex items-start space-x-2">
                          <Lucide.ChevronRight size={16} className={`mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <div className="flex flex-col min-w-0 flex-1">
                             <div className="font-mono text-[13px] text-slate-800 dark:text-slate-200 break-all leading-tight flex items-start">
                               <div className="flex-1">
                                 {group.templateUri.split('$(UUID)').map((part, pIdx, arr) => (
                                   <React.Fragment key={pIdx}>
                                     {part}
                                     {pIdx < arr.length - 1 && (
                                       <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1 rounded mx-0.5 font-bold">$(UUID)</span>
                                     )}
                                   </React.Fragment>
                                 ))}
                               </div>
                               <button 
                                 className="ml-2 p-1 text-slate-400 hover:text-indigo-500 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                 onClick={(e) => { e.stopPropagation(); copyToClipboard(formatTemplateGroup(group), `Endpoint 템플릿 정보 복사됨 (${group.rawCalls.length}건 상세 포함)`); }}
                                 title="Copy Full Markdown Table"
                               >
                                 <Lucide.Copy size={14} />
                               </button>
                             </div>
                             <div className="flex items-center mt-1 space-x-2">
                                <span className="text-[10px] text-slate-400 italic">{group.rawCalls.length} unique IDs</span>
                             </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-base">
                        {group.totalCount.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/50 dark:bg-black/20">
                        <td colSpan={2} className="p-0">
                          <div className="p-4 pl-12 space-y-4">
                             <div className="space-y-3">
                                {group.rawCalls.map((rc, rcIdx) => (
                                  <div key={rcIdx} className="bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group/rc">
                                     <div className="bg-slate-50 dark:bg-slate-900 px-3 py-1.5 flex justify-between items-center border-b dark:border-slate-800">
                                        <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all flex-1">{rc.rawUri}</div>
                                        <div className="flex items-center space-x-3 ml-4">
                                            <button 
                                              className="p-1 text-slate-400 hover:text-emerald-500 opacity-0 group-hover/rc:opacity-100 transition-opacity"
                                              onClick={() => copyToClipboard(rc.rawUri, '상세 호출 주소 복사됨')}
                                              title="Copy Raw URI"
                                            >
                                              <Lucide.Copy size={12} />
                                            </button>
                                           <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">Count: {rc.count}</div>
                                        </div>
                                     </div>
                                     <div className="p-2 space-y-1">
                                        {rc.examples.map((ex, exIdx) => (
                                          <div key={exIdx} className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap break-all border-l border-slate-200 pl-2">
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
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-rose-50 dark:bg-rose-900/10 px-4 py-2 font-bold text-rose-700 dark:text-rose-300 border-b border-rose-100 dark:border-rose-900/30 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Lucide.UserCheck size={16} />
            <span>{title}</span>
          </div>
          <span className="text-xs font-normal opacity-70">{data.length} Variations</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-3 border-b dark:border-slate-800">User Agent Context</th>
                <th className="p-3 border-b dark:border-slate-800 text-right w-24">Hits</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const uaKey = `ua-${JSON.stringify(row.variables)}`;
                const isExpanded = expandedKeys.has(uaKey);
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-rose-50/50 dark:hover:bg-rose-900/10 border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer group/ua ${isExpanded ? 'bg-rose-50/30 dark:bg-rose-900/5' : ''}`}
                      onClick={() => toggleExpand(uaKey)}
                    >
                      <td className="p-3">
                        <div className="flex items-start space-x-2">
                          <Lucide.ChevronRight size={16} className={`mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <div className="flex flex-wrap gap-2 flex-1">
                            {Object.entries(row.variables).map(([k, v]) => (
                               <div key={k} className="flex flex-col border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 bg-white dark:bg-slate-800/50 shadow-sm">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase leading-none mb-1">{k}</span>
                                  <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 leading-none">{v}</span>
                               </div>
                            ))}
                          </div>
                          <button 
                            className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover/ua:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(formatUAResult(row), `UA 분석 정보 복사됨 (API ${row.endpoints.length}건 포함)`); }}
                            title="Copy Full UA & Traffic Markdown"
                          >
                             <Lucide.Copy size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/30 dark:bg-black/20">
                         <td colSpan={2} className="p-0">
                            <div className="p-4 pl-12 space-y-4">
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-l-2 border-rose-500 pl-2">Traffic Triggered by this App</div>
                               <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                     <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                                        <tr>
                                           <th className="p-2 border-b dark:border-slate-800">Endpoint</th>
                                           <th className="p-2 border-b dark:border-slate-800 text-right w-20">Calls</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {row.endpoints.map((ep, eIdx) => {
                                          const epKey = `${uaKey}-ep-${ep.templateUri}`;
                                          const isEpExpanded = expandedKeys.has(epKey);
                                          return (
                                            <React.Fragment key={eIdx}>
                                              <tr 
                                                className={`border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer group/ep ${isEpExpanded ? 'bg-indigo-50/20' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(epKey); }}
                                              >
                                                 <td className="p-2 flex items-center space-x-2">
                                                    <Lucide.ChevronRight size={12} className={`transition-transform ${isEpExpanded ? 'rotate-90 text-indigo-500' : 'text-slate-400'}`} />
                                                    <span className="font-mono text-slate-700 dark:text-slate-300 break-all flex-1">{ep.templateUri}</span>
                                                    <button 
                                                      className="p-1 text-slate-400 hover:text-indigo-500 opacity-0 group-hover/ep:opacity-100 transition-opacity"
                                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(formatTemplateGroup(ep as any), '엔드포인트 템플릿 상세 복사됨'); }}
                                                      title="Copy Endpoint Markdown"
                                                    >
                                                       <Lucide.Copy size={12} />
                                                    </button>
                                                 </td>
                                                 <td className="p-2 text-right font-bold text-indigo-500">{ep.totalCount}</td>
                                              </tr>
                                              {isEpExpanded && (
                                                <tr className="bg-slate-100/30 dark:bg-black/40">
                                                   <td colSpan={2} className="p-3 pl-8">
                                                      <div className="space-y-3">
                                                         {ep.rawCalls.map((rc, rcIdx) => (
                                                           <div key={rcIdx} className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden text-[10px] group/uarc">
                                                              <div className="bg-slate-50 dark:bg-slate-800 px-2 py-1 flex justify-between items-center border-b dark:border-slate-700">
                                                                 <div className="font-mono text-emerald-600 dark:text-emerald-400 break-all flex-1"> {rc.rawUri} </div>
                                                                 <div className="flex items-center space-x-2">
                                                                    <button 
                                                                      className="p-1 text-slate-400 hover:text-emerald-500 opacity-0 group-hover/uarc:opacity-100 transition-opacity"
                                                                      onClick={() => copyToClipboard(rc.rawUri, '상세 호출 주소 복사됨')}
                                                                    >
                                                                      <Lucide.Copy size={10} />
                                                                    </button>
                                                                    <div className="font-bold opacity-70">x{rc.count}</div>
                                                                 </div>
                                                              </div>
                                                              <div className="p-1.5 space-y-1">
                                                                 {rc.examples.map((ex, exIdx) => (
                                                                   <div key={exIdx} className="font-mono text-slate-500 whitespace-pre-wrap break-all border-l border-slate-200 pl-1.5">
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
                                          <tr><td colSpan={2} className="p-4 text-center text-slate-400 italic">No traffic recorded for this session.</td></tr>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar overflow-x-hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Requests</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{insights.totalRequests.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unique Hosts</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{Object.keys(insights.hosts).length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Avg Load</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {(insights.totalRequests / (timelineEntries.length || 1)).toFixed(1)} <span className="text-xs font-normal text-slate-400">req/min</span>
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center">
            <Lucide.Activity size={14} className="mr-2 text-indigo-500" /> Traffic Timeline (Request Density)
          </h4>
          <div className="flex items-end space-x-1 h-32 w-full group/chart">
            {timelineEntries.map(([min, count]) => (
              <div key={min} className="flex-1 flex flex-col items-center group/bar h-full justify-end">
                <div 
                  className="w-full bg-indigo-500/20 group-hover/chart:bg-indigo-500/10 hover:!bg-indigo-500 transition-all rounded-t-sm relative"
                  style={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1 rounded opacity-0 group-hover/bar:opacity-100 whitespace-nowrap z-10">
                    {min}: {count}
                  </div>
                </div>
              </div>
            ))}
            {timelineEntries.length === 0 && <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs italic">No time data available</div>}
          </div>
          <div className="flex justify-between mt-2 text-[8px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1">
             <span>{timelineEntries[0]?.[0] || 'Start'}</span>
             <span>Time Axis (Bucketized)</span>
             <span>{timelineEntries[timelineEntries.length-1]?.[0] || 'End'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Domains */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center">
              <Lucide.Globe size={14} className="mr-2 text-emerald-500" /> Top Call Domains
            </h4>
            <div className="space-y-3">
              {hostEntries.map(([host, count]) => (
                <div key={host}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-mono text-slate-600 dark:text-slate-400 truncate mr-2">{host}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${((count as number) / insights.totalRequests) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Methods */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center">
              <Lucide.Layers size={14} className="mr-2 text-amber-500" /> HTTP Method Distribution
            </h4>
            <div className="space-y-3">
              {methodEntries.map(([method, count]) => (
                <div key={method} className="flex items-center">
                  <span className={`w-12 text-[10px] font-black text-center py-0.5 rounded mr-3 ${
                    method === 'GET' ? 'bg-blue-100 text-blue-700' : 
                    method === 'POST' ? 'bg-emerald-100 text-emerald-700' :
                    method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{method}</span>
                  <div className="flex-1 flex items-center">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mr-3">
                      <div className="bg-slate-400 h-full" style={{ width: `${((count as number) / insights.totalRequests) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold w-8 text-right">{count}</span>
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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans text-sm">
      {/* Header Tabs */}
      <div className="flex items-center space-x-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'single' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          onClick={() => setActiveTab('single')}
        >단일 로그 분석</button>
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'compare' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          onClick={() => setActiveTab('compare')}
        >Compare (Split Diff)</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Settings */}
        <div className="w-[35%] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shrink-0 flex flex-col overflow-y-auto overflow-x-hidden">
          
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <Lucide.Database size={16} className="mr-2 text-indigo-500" /> 1. 로그 파일 수신
          </h3>
          <div className="mb-6 flex space-x-2">
            {activeTab === 'single' ? renderFileDropArea('single', singleFile, 'log file') : (
              <>
                {renderFileDropArea('left', leftFile, 'Left')}
                {renderFileDropArea('right', rightFile, 'Right')}
              </>
            )}
          </div>

          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <Lucide.Combine size={16} className="mr-2 text-indigo-500" /> 2. User Agent 패턴 (Template)
          </h3>
          <div className="mb-6 p-3 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-900/5 rounded-lg space-y-3">
             <div className="flex items-center space-x-2 mb-1">
               <input type="checkbox" checked={uaPattern.enabled} onChange={(e) => setUAPattern({...uaPattern, enabled: e.target.checked})} />
               <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">분석 활성화</span>
             </div>
             <div>
               <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">필수 키워드</label>
               <input type="text" value={uaPattern.keywords} onChange={(e) => setUAPattern({...uaPattern, keywords: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs" />
             </div>
             <div>
               <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">추출 템플릿 ($(Var))</label>
               <input type="text" value={uaPattern.template} onChange={(e) => setUAPattern({...uaPattern, template: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-mono" />
             </div>
          </div>

          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <Lucide.Filter size={16} className="mr-2 text-indigo-500" /> 3. 트래픽 패턴 필터
          </h3>
          <div className="space-y-3 mb-4">
            {patterns.map((p) => (
              <div key={p.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" checked={p.enabled} onChange={(e) => handleUpdatePattern(p.id, 'enabled', e.target.checked)} />
                  <input type="text" placeholder="Alias" value={p.alias} onChange={(e) => handleUpdatePattern(p.id, 'alias', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs" />
                  <button onClick={() => handleRemovePattern(p.id)} className="text-red-500 opacity-50"><Lucide.X size={14} /></button>
                </div>
                <input type="text" placeholder="Keywords" value={p.keywords} onChange={(e) => handleUpdatePattern(p.id, 'keywords', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono" />
              </div>
            ))}
            <Button variant="outline" className="w-full text-xs h-8 border-dashed" onClick={handleAddPattern}><Lucide.Plus size={14} className="mr-1" /> 패턴 추가</Button>
          </div>

          <div className="mt-auto pt-4">
            <Button 
                variant="primary" 
                className="w-full py-3 font-bold flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleStartAnalysis}
                disabled={analyzing || (activeTab === 'single' && !singleFile) || (activeTab === 'compare' && (!leftFile || !rightFile))}
            >
              {analyzing ? <><Lucide.Loader2 size={18} className="mr-2 animate-spin" /> {progress}%</> : <><Lucide.Play size={18} className="mr-2" /> 분석 시작</>}
            </Button>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col">
          {hasAnalyzed && !analyzing && (
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4 space-x-6 shrink-0">
              {(['endpoints', 'ua', 'insights'] as const).map(t => (
                <button key={t} onClick={() => setResultTab(t)} className={`pb-2 px-1 text-sm font-bold transition-colors capitalize ${resultTab === t ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col">
            {!hasAnalyzed ? (
              <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-400">
                <Lucide.BarChart2 size={40} className="mb-3 opacity-20" />
                <p>분석 버튼을 눌러주세요.</p>
              </div>
            ) : analyzing ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <Lucide.Loader2 size={40} className="text-indigo-500 animate-spin" />
                <div className="w-48 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all" style={{width: `${progress}%`}} />
                </div>
                <p className="text-sm text-slate-500 font-mono">Processing data... {progress}%</p>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                  {resultTab === 'endpoints' && renderTable(singleResult.filter(g => g.templateUri.includes('$(UUID)')), 'Aggregated API Endpoints')}
                  {resultTab === 'ua' && renderUATable(singleUAResult, 'User Agent Breakdown')}
                  {resultTab === 'insights' && (activeTab === 'single' ? renderInsightsTab(singleInsights, 'Traffic Insights') : (
                    <div className="flex-1 flex h-full space-x-2">
                       <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-800">
                         <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase text-slate-500">Left File</div>
                         {renderInsightsTab(leftInsights, 'Left Insights')}
                       </div>
                       <div className="flex-1 flex flex-col overflow-hidden">
                         <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase text-slate-500">Right File</div>
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
