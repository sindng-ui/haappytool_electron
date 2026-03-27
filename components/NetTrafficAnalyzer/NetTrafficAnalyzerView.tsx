import React, { useState, useRef, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { Button } from '../ui/Button';
import { useNetTrafficLogic } from '../../hooks/useNetTrafficLogic';
import { useToast } from '../../contexts/ToastContext';
import { TrafficPattern, TemplateGroup, RawCall, UAPattern, UAResult } from '../../workers/NetTraffic.worker';

const RawLogNavigator: React.FC<{
  file: File | null;
  lineIndices: number[];
  onClose: () => void;
  title: string;
}> = ({ file, lineIndices, onClose, title }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (file) {
      setLoading(true);
      file.text().then(text => {
        setLines(text.split('\n'));
        setLoading(false);
      }).catch(err => {
        console.error('Failed to read log file', err);
        setLoading(false);
      });
    }
  }, [file]);

  useEffect(() => {
    if (!loading && lines.length > 0 && lineIndices.length > 0) {
      const targetLine = lineIndices[currentIndex];
      const el = lineRefs.current[targetLine];
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }
  }, [currentIndex, lines, loading, lineIndices]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-[#0f172a] border border-indigo-500/30 rounded-xl shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden max-w-6xl">
        {/* Header */}
        <div className="h-12 border-b border-indigo-500/20 bg-[#0b0f19] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest leading-none bg-indigo-500/10 px-2 py-1.5 rounded">{title}</span>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="flex items-center space-x-3">
              <button 
                className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-20 active:scale-95"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              ><Lucide.ChevronLeft size={18} /></button>
              
              <div className="flex flex-col items-center min-w-[120px]">
                <div className="text-[14px] font-black text-white tabular-nums leading-none mb-1">
                  Line {lineIndices[currentIndex] + 1}
                </div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                  Match {currentIndex + 1} of {lineIndices.length}
                </div>
              </div>

              <button 
                className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-20 active:scale-95"
                onClick={() => setCurrentIndex(prev => Math.min(lineIndices.length - 1, prev + 1))}
                disabled={currentIndex === lineIndices.length - 1}
              ><Lucide.ChevronRight size={18} /></button>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all active:scale-90"><Lucide.X size={18} /></button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#0b0f19] custom-scrollbar p-0 font-mono text-[11px] relative scroll-smooth" ref={containerRef}>
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
               <Lucide.Loader size={32} className="animate-spin text-indigo-500" />
               <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Inflating Log Buffer...</span>
             </div>
          ) : (
             <div className="space-y-0 min-w-max pb-[40vh]">
               {lines.map((line, idx) => {
                 const isSelected = lineIndices[currentIndex] === idx;
                 if (!isSelected && Math.abs(lineIndices[currentIndex] - idx) > 400) return null;
                 
                 return (
                   <div 
                     key={idx} 
                     ref={el => { lineRefs.current[idx] = el; }}
                     className={`flex space-x-4 px-3 py-0.5 group transition-colors ${isSelected ? 'bg-indigo-500/20 border-l-4 border-indigo-500 opacity-100 z-10 sticky top-0 bottom-0 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'hover:bg-slate-900/40 opacity-40 hover:opacity-100'}`}
                   >
                     <span className={`w-14 shrink-0 text-right font-mono text-[10px] select-none border-r border-slate-800 pr-3 ${isSelected ? 'text-indigo-400 font-black' : 'text-slate-700'}`}>{idx + 1}</span>
                     <span className={`whitespace-pre pr-8 ${isSelected ? 'text-slate-100 font-medium' : 'text-slate-500 group-hover:text-slate-400'}`}>{line}</span>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LOCAL_STORAGE_KEY_UA = 'happytool_nettraffic_ua_pattern';
const LOCAL_STORAGE_KEY_PATTERNS = 'happytool_nettraffic_traffic_patterns';

const NetTrafficAnalyzerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [resultTab, setResultTab] = useState<'endpoints' | 'ua' | 'insights'>('endpoints');
  const { addToast } = useToast();

  // Files
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [leftFile, setLeftFile] = useState<File | null>(null);
  const [rightFile, setRightFile] = useState<File | null>(null);

  // Navigator
  const [navSource, setNavSource] = useState<{ file: File; lineIndices: number[]; title: string } | null>(null);

  // Design Constants (Synced with Log Extractor)
  const COLORS = {
    bg: '#0b0f19',
    header: '#0f172a',
    border: 'rgba(99, 102, 241, 0.3)', // indigo-500/30
    panel: '#0f172a',
    card: 'rgba(30, 41, 59, 0.5)', // slate-800/50
  };

  // Patterns
  const [patterns, setPatterns] = useState<TrafficPattern[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PATTERNS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved traffic patterns', e);
      }
    }
    return [{ id: '1', alias: 'Keywords', keywords: '', extractRegex: '', enabled: true }];
  });

  const [uaPattern, setUAPattern] = useState<UAPattern>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_UA);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved UA pattern', e);
      }
    }
    return {
      keywords: 'SC_SERVICE, User agent',
      template: 'User agent: $(ClientName)/$(ClientVersion)/$(AppName)/$(AppVersion)/$(AppDetail)',
      enabled: true
    };
  });

  const {
    analyzing, progress,
    singleResult, leftResult, rightResult,
    singleUAResult, leftUAResult, rightUAResult,
    singleInsights, leftInsights, rightInsights,
    startAnalysis
  } = useNetTrafficLogic();

  // Persistence (로컬 저장소 자동 저장)

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_UA, JSON.stringify(uaPattern));
  }, [uaPattern]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PATTERNS, JSON.stringify(patterns));
  }, [patterns]);

  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const handleStartAnalysis = async () => {
    setHasAnalyzed(true);
    await startAnalysis(activeTab, patterns, uaPattern, singleFile, leftFile, rightFile);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const copyToClipboard = (text: string, summary: string) => {
    navigator.clipboard.writeText(text);
    addToast(summary, 'success', 2000);
  };

  const getUAKey = (vars: Record<string, string>) => {
    const sorted = Object.keys(vars).sort().reduce((acc, k) => {
      acc[k] = vars[k];
      return acc;
    }, {} as any);
    return `ua-${JSON.stringify(sorted)}`;
  };

  const toggleClusterExpand = (uaKey: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(uaKey)) next.delete(uaKey);
      else next.add(uaKey);
      return next;
    });
  };

  const formatTemplateGroup = (group: TemplateGroup): string => {
    let md = `### Endpoint Analysis: ${group.alias || 'Auto'}\n\n`;
    md += `| Attribute | Value |` + '\n';
    md += `| :--- | :--- |` + '\n';
    md += `| Template URI | \`${group.templateUri}\` |` + '\n';
    md += `| Total Calls | ${group.totalCount} |` + '\n';
    return md;
  };

  const handleAddPattern = () => {
    setPatterns([...patterns, { id: Date.now().toString(), alias: '', keywords: '', extractRegex: '', enabled: true }]);
  };

  const handleUpdatePattern = (id: string, field: keyof TrafficPattern, value: any) => {
    setPatterns(patterns.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemovePattern = (id: string) => {
    setPatterns(patterns.filter(p => p.id !== id));
  };

  const handleFileSelect = (target: 'single' | 'left' | 'right', file: File) => {
    if (target === 'single') setSingleFile(file);
    else if (target === 'left') setLeftFile(file);
    else setRightFile(file);
    addToast(`File loaded: ${file.name}`, 'success', 2000);
  };

  const renderFileDropArea = (target: 'single' | 'left' | 'right', file: File | null, label: string) => {
    return (
      <div
        className={`flex-1 min-h-[110px] border border-dashed rounded-lg flex flex-col items-center justify-center p-2 transition-all group cursor-pointer ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 hover:bg-slate-900/60'
          }`}
        onClick={() => document.getElementById(`file-input-${target}`)?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile) {
            handleFileSelect(target, droppedFile);
          }
        }}
      >
        <input
          id={`file-input-${target}`}
          type="file"
          className="hidden"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              handleFileSelect(target, selectedFile);
            }
          }}
        />
        {file ? (
          <div className="flex flex-col items-center">
            <Lucide.FileText size={18} className="text-emerald-500 mb-1" />
            <span className="text-[10px] font-medium text-slate-300 truncate max-w-[120px]">{file.name}</span>
            <button
              className="text-[9px] text-rose-400 mt-1 hover:underline z-10"
              onClick={(e) => {
                e.stopPropagation();
                if (target === 'single') setSingleFile(null);
                else if (target === 'left') setLeftFile(null);
                else setRightFile(null);
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
            <Lucide.Upload size={18} className="mb-1 text-slate-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Drag & Drop {label}</span>
          </div>
        )}
      </div>
    );
  };

  const renderTable = (data: TemplateGroup[], title: string, sourceFile: File | null) => {
    return (
      <div className="flex flex-col h-full bg-[#0b0f19] rounded-lg border border-indigo-500/20 overflow-hidden">
        <div className="bg-[#0f172a] h-8 px-3 flex items-center justify-between border-b border-indigo-500/30">
          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
            <span className="text-[10px] text-slate-500">{data.length} Nodes</span>
          </div>
          <div className="flex-1 max-w-xs mx-4 relative group">
            <Lucide.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" />
            <input 
              type="text" 
              placeholder="Search endpoints..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 rounded-full pl-8 pr-4 py-1 text-[10px] outline-none transition-all placeholder:text-slate-600"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              ><Lucide.X size={12} /></button>
            )}
          </div>
          <button
            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-tight flex items-center space-x-1 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"
            onClick={() => {
              let md = `## Master API Index: ${title}\n\n`;
              [...data].sort((a, b) => b.totalCount - a.totalCount).forEach(g => {
                md += `### ${g.templateUri} (Hits: ${g.totalCount})\n`;
                md += `| Variation | Count |\n| :--- | :--- |\n`;
                g.rawCalls.forEach(rc => {
                  md += `| \`${rc.rawUri}\` | ${rc.count} |\n`;
                });
                md += `\n`;
              });
              copyToClipboard(md, 'Full API Index copied');
            }}
          >
            <Lucide.Copy size={10} />
            <span>Copy All</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="sticky top-0 bg-[#0f172a] shadow-sm text-slate-500 font-bold uppercase tracking-tighter z-10">
              <tr>
                <th className="px-3 py-1.5 border-b border-indigo-500/10">Hierarchy / Endpoint Structure</th>
                <th className="px-3 py-1.5 border-b border-indigo-500/10 text-right w-32 relative">
                  <div className="text-[8px] text-slate-600 absolute -top-0.5 right-3">Grand Total</div>
                  <div className="text-indigo-400 font-black tabular-nums">
                    {data.reduce((acc, curr) => acc + curr.totalCount, 0).toLocaleString()}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data
                .filter(g => !searchQuery || g.templateUri.toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a, b) => b.totalCount - a.totalCount).map((group, idx) => {
                const isExpanded = expandedKeys.has(group.templateUri);
                return (
                  <React.Fragment key={idx}>
                    <tr
                      className={`hover:bg-indigo-500/5 border-b border-slate-900 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-500/10' : ''}`}
                      onClick={() => toggleExpand(group.templateUri)}
                    >
                      <td className="px-2 py-1.5">
                        <div className="flex items-start space-x-1.5">
                          <Lucide.ChevronRight size={14} className={`mt-0.5 transition-transform ${isExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="font-mono text-slate-200 break-all leading-tight">
                              {group.templateUri.split('$(UUID)').map((part, pIdx, arr) => (
                                <React.Fragment key={pIdx}>
                                  {part}
                                  {pIdx < arr.length - 1 && (
                                    <span className="bg-amber-500/20 text-amber-400 px-1 rounded mx-0.5 font-bold">$(UUID)</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                            <div className="flex items-center mt-1 space-x-2 text-[9px] opacity-40">
                              <span>{group.rawCalls.length} Variations</span>
                            </div>
                          </div>
                          <button
                            className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = `Endpoint: ${group.templateUri}\n` + group.rawCalls.map(rc => `  - ${rc.rawUri} (x${rc.count})`).join('\n');
                              copyToClipboard(text, 'Hierarchy copied');
                            }}
                            title="Copy Hierarchy"
                          >
                            <Lucide.Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-indigo-400 font-mono text-xs tabular-nums">
                        {group.totalCount.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900/30">
                        <td colSpan={2} className="p-0">
                          <div className="py-2 px-3 pl-8 space-y-1.5 border-l-2 border-indigo-500/20 ml-4">
                            {group.rawCalls.map((rc, rcIdx) => (
                              <div key={rcIdx} className="bg-slate-900/50 rounded border border-slate-800 overflow-hidden text-[10px] group/rc">
                                <div className="bg-slate-950 px-2 py-1 flex justify-between items-center border-b border-slate-800">
                                  <div className="font-mono text-indigo-300 break-all flex-1">{rc.rawUri}</div>
                                  <div className="flex items-center space-x-2 ml-4">
                                    <button 
                                      className="w-6 h-6 flex items-center justify-center bg-slate-900 border border-slate-800 rounded text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90"
                                      onClick={() => setNavSource({ file: sourceFile!, lineIndices: rc.lineIndices || [], title: rc.rawUri })}
                                      title="Jump to Raw View"
                                    >
                                       <Lucide.Eye size={10} />
                                    </button>
                                    <button className="text-slate-500 hover:text-white" onClick={() => copyToClipboard(rc.rawUri, 'Path copied')}><Lucide.Copy size={11} /></button>
                                    <div className="font-bold text-slate-500 font-mono">x{rc.count}</div>
                                  </div>
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

  const renderUATable = (data: UAResult[], title: string, sourceFile: File | null) => {
    return (
      <div className="flex flex-col h-full bg-[#0b0f19] rounded-lg border border-indigo-500/20 overflow-hidden">
        <div className="bg-[#0f172a] h-10 px-3 flex items-center justify-between border-b border-indigo-500/30">
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
            <div className="flex items-center space-x-1 border-l border-slate-800 pl-4 h-4">
              <button
                className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-tight"
                onClick={() => {
                  setExpandedKeys(prev => {
                    const next = new Set(prev);
                    data.forEach(row => next.add(getUAKey(row.variables)));
                    return next;
                  });
                }}
              >Expand All</button>
              <span className="text-slate-700 text-[10px] self-center">/</span>
              <button
                className="text-[9px] font-bold text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-tight"
                onClick={() => {
                  setExpandedKeys(prev => {
                    const next = new Set(prev);
                    data.forEach(row => next.delete(getUAKey(row.variables)));
                    return next;
                  });
                }}
              >Collapse All</button>
            </div>
            <span className="text-[10px] text-slate-500 border-l border-slate-800 pl-4 h-4 flex items-center">{data.length} Clients</span>
          </div>
          <div className="flex-1 max-w-xs mx-4 relative group">
            <Lucide.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" />
            <input 
              type="text" 
              placeholder="Search UA or API..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 rounded-full pl-8 pr-4 py-1 text-[10px] outline-none transition-all placeholder:text-slate-600"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              ><Lucide.X size={12} /></button>
            )}
          </div>
          <button
            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-tight flex items-center space-x-1 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"
            onClick={() => {
              let md = `# Client Fingerprint clusters: ${title}\n\n`;
              [...data].sort((a, b) => b.count - a.count).forEach(row => {
                const vars = Object.entries(row.variables).map(([k, v]) => `${k}: ${v}`).join(', ');
                md += `## UA: [${vars}] (Hits: ${row.count})\n\n`;
                row.endpoints.forEach(ep => {
                  md += `### Pattern: ${ep.templateUri} (x${ep.totalCount})\n`;
                  md += `| Variation | Count |\n| :--- | :--- |\n`;
                  ep.rawCalls.forEach(rc => {
                    md += `| \`${rc.rawUri}\` | ${rc.count} |\n`;
                  });
                  md += `\n`;
                });
                md += `---\n\n`;
              });
              copyToClipboard(md, 'All UA Data copied');
            }}
          >
            <Lucide.Copy size={10} />
            <span>Copy All Results</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="sticky top-0 bg-[#0f172a] shadow-sm text-slate-500 font-bold uppercase tracking-tighter z-10">
              <tr>
                <th className="px-3 py-1.5 border-b border-indigo-500/10">Identified Context Details</th>
                <th className="px-3 py-1.5 border-b border-indigo-500/10 text-right w-20">Hits</th>
              </tr>
            </thead>
            <tbody>
              {data.filter(row => {
                const varsMatch = Object.values(row.variables).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()));
                const endpointsMatch = row.endpoints.some(ep => ep.templateUri.toLowerCase().includes(searchQuery.toLowerCase()));
                return !searchQuery || varsMatch || endpointsMatch;
              }).sort((a, b) => {
                const aIsNone = Object.values(a.variables).some(v => String(v).includes('No User Agent Detected'));
                const bIsNone = Object.values(b.variables).some(v => String(v).includes('No User Agent Detected'));
                if (aIsNone && !bIsNone) return 1;
                if (!aIsNone && bIsNone) return -1;
                return b.count - a.count;
              }).map((row, idx) => {
                const uaKey = getUAKey(row.variables);
                const isExpanded = expandedKeys.has(uaKey);
                return (
                  <React.Fragment key={uaKey}>
                    <tr
                      className={`hover:bg-indigo-500/5 border-b border-slate-900 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-500/10' : ''}`}
                      onClick={() => toggleClusterExpand(uaKey)}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-start space-x-1.5">
                          <Lucide.ChevronRight size={14} className={`mt-0.5 transition-transform ${isExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                          <div className="flex flex-wrap gap-1 flex-1">
                            {Object.entries(row.variables).map(([k, v]) => (
                              <div key={k} className="flex items-center space-x-1 border border-slate-800 rounded px-1.5 py-0.5 bg-slate-900/50 shadow-sm">
                                <span className="text-[8px] text-slate-500 font-black uppercase">{k}:</span>
                                <span className="text-[10px] font-mono text-emerald-400 font-bold">{v}</span>
                              </div>
                            ))}
                          </div>
                          <button
                            className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const vars = Object.entries(row.variables).map(([k, v]) => `${k}: ${v}`).join(', ');
                              const text = `UA Context: [${vars}]\n` + row.endpoints.map(ep => {
                                let epText = `  - ${ep.templateUri} (x${ep.totalCount})`;
                                if (ep.rawCalls.length > 1) {
                                  epText += '\n' + ep.rawCalls.map(rc => `    * ${rc.rawUri} (x${rc.count})`).join('\n');
                                }
                                return epText;
                              }).join('\n');
                              copyToClipboard(text, 'UA Hierarchy (Deep) copied');
                            }}
                            title="Copy Hierarchy"
                          >
                            <Lucide.Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-black text-indigo-400 font-mono text-xs">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900/30">
                        <td colSpan={2} className="p-0">
                          <div className="py-2 px-3 pl-8 space-y-2 border-l-2 border-indigo-500/20 ml-4">
                            <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden">
                              <table className="w-full text-left text-[10px] border-collapse">
                                <thead className="bg-[#0f172a] text-slate-500">
                                  <tr>
                                    <th className="px-3 py-1">Traffic Pattern</th>
                                    <th className="px-3 py-1 text-right w-20">Hit count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.endpoints.map((ep, eIdx) => {
                                    const epKey = `${uaKey}-${ep.templateUri}`;
                                    const isEpExpanded = expandedKeys.has(epKey);
                                    const hasVariations = ep.rawCalls.length > 1;
                                    return (
                                      <React.Fragment key={eIdx}>
                                        <tr className="border-b border-slate-900 hover:bg-slate-900/50">
                                          <td className="px-3 py-1 font-mono text-indigo-300 opacity-80 cursor-pointer" onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpand(epKey);
                                          }}>
                                            <div className="flex items-center justify-between group/ep">
                                              <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                                                <Lucide.ChevronRight size={10} className={`transition-transform ${isEpExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                                                <span className="truncate">{ep.templateUri}</span>
                                              </div>
                                              <button
                                                className="opacity-0 group-hover/ep:opacity-100 p-1 text-slate-500 hover:text-white transition-opacity"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const text = `Pattern: ${ep.templateUri}\n` + ep.rawCalls.map(rc => `  - ${rc.rawUri} (x${rc.count})`).join('\n');
                                                  copyToClipboard(text, 'Endpoint variations copied');
                                                }}
                                              >
                                                <Lucide.Copy size={10} />
                                              </button>
                                            </div>
                                          </td>
                                          <td className="px-3 py-1 text-right font-bold text-indigo-400 tabular-nums">{ep.totalCount}</td>
                                        </tr>
                                        {isEpExpanded && (
                                          <tr className="bg-slate-950/20">
                                            <td colSpan={2} className="p-1 px-4">
                                              <div className="space-y-1 border-l border-indigo-500/10 pl-3 my-1">
                                                {ep.rawCalls.map((rc, rcIdx) => (
                                                  <div key={rcIdx} className="bg-slate-900/50 rounded border border-slate-800 overflow-hidden text-[10px] group/rc mb-1 last:mb-0">
                                                    <div className="bg-slate-950 px-2 py-0.5 flex justify-between items-center border-b border-slate-800">
                                                      <div className="font-mono text-indigo-300 break-all flex-1 text-[9px]">{rc.rawUri}</div>
                                                      <div className="flex items-center space-x-1.5 ml-2">
                                                        <button 
                                                          className="w-6 h-6 flex items-center justify-center bg-slate-900 border border-slate-800 rounded text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90"
                                                          onClick={() => setNavSource({ file: sourceFile!, lineIndices: rc.lineIndices || [], title: rc.rawUri })}
                                                          title="Jump to Raw View"
                                                        >
                                                           <Lucide.Eye size={10} />
                                                        </button>
                                                        <button className="w-6 h-6 flex items-center justify-center bg-slate-900 border border-slate-800 rounded text-slate-500 hover:text-white transition-all active:scale-90" onClick={() => copyToClipboard(rc.rawUri, 'Path copied')}>
                                                           <Lucide.Copy size={10} />
                                                        </button>
                                                        <div className="font-bold text-slate-500 font-mono text-[9px] min-w-[30px] text-right">x{rc.count}</div>
                                                      </div>
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

  const renderInsightsTab = (insights: any, sourceName: string, sourceFile: File | null) => {
    const timelineEntries = (Object.entries(insights.timeline) as [string, number][]).sort((a, b) => {
      if (a[0].endsWith('m') && b[0].endsWith('m')) return parseInt(a[0]) - parseInt(b[0]);
      return a[0].localeCompare(b[0]);
    });
    const maxTimeline = Math.max(...Object.values(insights.timeline) as number[], 1);

    return (
      <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
        <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-indigo-500/20 shadow-lg">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
            <Lucide.FileText size={12} className="mr-2" /> Report: {sourceName}
          </div>
          <button
            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-tight flex items-center space-x-1 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"
            onClick={() => {
              let md = `# Network Insights Report: ${sourceName}\n\n`;
              md += `## Summary Statistics\n`;
              md += `- Total Requests: ${insights.totalRequests.toLocaleString()}\n`;
              md += `- Unique Domains: ${Object.keys(insights.hosts).length}\n`;
              md += `- Activity Span: ${timelineEntries.length} minutes\n\n`;
              
              md += `## Key Findings\n`;
              if (insights.findings && insights.findings.length > 0) {
                insights.findings.forEach((f: string) => md += `- ${f}\n`);
              } else {
                md += `- No specific anomalies detected.\n`;
              }
              
              md += `\n## Top Hostnames\n`;
              md += `| Hostname | Hits |\n| :--- | :--- |\n`;
              Object.entries(insights.hosts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 15).forEach(([h, c]) => {
                md += `| ${h} | ${c} |\n`;
              });
              
              md += `\n## Request Methods\n`;
              Object.entries(insights.methods).sort((a: any, b: any) => b[1] - a[1]).forEach(([m, c]) => {
                md += `- ${m}: ${c}\n`;
              });
              
              copyToClipboard(md, `${sourceName} Report copied`);
            }}
          >
            <Lucide.Copy size={10} />
            <span>Copy Full Report</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Volume', value: insights.totalRequests.toLocaleString(), color: 'indigo' },
            { label: 'Domains', value: Object.keys(insights.hosts).length, color: 'emerald' },
            { label: 'Activity Span', value: `${timelineEntries.length}m`, color: 'amber' }
          ].map(stat => (
            <div key={stat.label} className="bg-slate-900/50 border border-slate-800 p-2 rounded relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full bg-${stat.color}-500 opacity-50`} />
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
              <div className="text-sm font-black text-slate-200 tabular-nums">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-2 rounded">
          <div className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest flex items-center">
            <Lucide.Activity size={10} className="mr-2 text-indigo-400" /> Temporal Payload Map
          </div>
          <div className="flex items-end space-x-0.5 h-16 w-full">
            {timelineEntries.map(([min, count]) => (
              <div key={min} className="flex-1 bg-indigo-500/20 hover:bg-indigo-500 transition-all rounded-t-[1px]"
                style={{ height: `${((count as number) / maxTimeline) * 100}%` }} title={`${min}: ${count}`} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/50 border border-slate-800 p-2 rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Hosts</div>
            <div className="space-y-1">
              {Object.entries(insights.hosts).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0, 5).map(([host, count]) => (
                <div key={host} className="flex justify-between items-center text-[9px]">
                  <span className="text-slate-400 font-mono break-all pr-4">{host}</span>
                  <span className="font-bold text-slate-300 font-mono shrink-0">{count as number}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-2 rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Methods</div>
            <div className="space-y-1">
              {Object.entries(insights.methods).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).map(([m, c]) => (
                <div key={m} className="flex justify-between items-center text-[9px]">
                  <span className="text-indigo-400 font-black">{m}</span>
                  <span className="font-bold text-slate-300 font-mono">{c as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-[#0b0f19] font-sans selection:bg-indigo-500/20 text-slate-300`}>
      {/* Dynamic Tab Header (Log Extractor Look) */}
      <div className="h-8 flex items-center bg-[#0f172a] border-b border-indigo-500/30 px-3 space-x-0.5 shrink-0 z-20" style={{ WebkitAppRegion: 'drag' } as any}>
        <button
          className={`px-4 h-full text-[10px] font-bold uppercase tracking-wider rounded-t-lg transition-all border-l border-r border-t ${activeTab === 'single' ? 'bg-slate-900 border-indigo-500/40 text-slate-200 z-10' : 'bg-slate-950 border-transparent text-slate-500 hover:text-slate-300'}`}
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={() => setActiveTab('single')}
        >Single View</button>
        <button
          className={`px-4 h-full text-[10px] font-bold uppercase tracking-wider rounded-t-lg transition-all border-l border-r border-t ${activeTab === 'compare' ? 'bg-slate-900 border-indigo-500/40 text-slate-200 z-10' : 'bg-slate-950 border-transparent text-slate-500 hover:text-slate-300'}`}
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={() => setActiveTab('compare')}
        >Compare Engine</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Config Panel (Synced with Log Extractor) */}
        <div className="w-[450px] border-r border-indigo-500/10 bg-[#0f172a] p-4 shrink-0 flex flex-col overflow-y-auto custom-scrollbar z-10 space-y-6">

          <div className="space-y-10">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800/80">
              <Lucide.Settings size={14} className="text-indigo-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Pipeline config</span>
            </div>

            {/* Section: File */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-l-2 border-indigo-500 pl-3 py-0.5">01. Log Input</div>
              {activeTab === 'single' ? renderFileDropArea('single', singleFile, 'Source Log') : (
                <div className="grid grid-cols-2 gap-2">
                  {renderFileDropArea('left', leftFile, 'Primary')}
                  {renderFileDropArea('right', rightFile, 'Reference')}
                </div>
              )}
            </div>

            {/* Section: UA */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-l-2 border-indigo-500 pl-3 py-0.5">02. User Agent</div>
              <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-lg space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Keywords</label>
                  <input type="text" value={uaPattern.keywords} onChange={(e) => setUAPattern({ ...uaPattern, keywords: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-[11px] font-mono focus:border-indigo-500/50 outline-none text-slate-300" placeholder="Keywords..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Template mapping</label>
                  <textarea rows={3} value={uaPattern.template} onChange={(e) => setUAPattern({ ...uaPattern, template: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-[11px] font-mono focus:border-indigo-500/50 outline-none resize-none text-slate-300 leading-tight" placeholder="Mapping..." />
                </div>
              </div>
            </div>

            {/* Section: Rules */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-l-2 border-indigo-500 pl-3 py-0.5">03. Traffic Pattern</div>
              {patterns.map(p => (
                <div key={p.id} className="bg-slate-900/40 border border-slate-800 p-2.5 rounded-lg space-y-2 group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <input type="text" value={p.alias} onChange={(e) => handleUpdatePattern(p.id, 'alias', e.target.value)} className="bg-transparent border-0 p-0 text-[10px] font-black uppercase text-amber-400 outline-none w-24" placeholder="Rule name" />
                    </div>
                    <button className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePattern(p.id)}><Lucide.Trash2 size={12} /></button>
                  </div>
                  <input type="text" value={p.keywords} onChange={(e) => handleUpdatePattern(p.id, 'keywords', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-400 outline-none" placeholder="Signature..." />
                </div>
              ))}
              <button className="w-full h-8 border border-dashed border-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800/20 hover:text-slate-200 transition-colors" onClick={handleAddPattern}>+ Add Rule</button>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <Button
              variant="primary"
              className={`w-full h-10 font-black uppercase tracking-[0.2em] rounded border-b-2 ${analyzing ? 'bg-slate-800 border-slate-900 opacity-50' : 'bg-indigo-600 border-indigo-800 hover:bg-indigo-500'}`}
              onClick={handleStartAnalysis}
              disabled={analyzing || (activeTab === 'single' && !singleFile) || (activeTab === 'compare' && (!leftFile || !rightFile))}
            >
              <div className="flex items-center justify-center space-x-2">
                {analyzing ? <Lucide.Loader size={14} className="animate-spin" /> : <Lucide.Zap size={14} />}
                <span className="text-[11px]">{analyzing ? `Analyzing... ${progress}%` : 'Execute Analysis'}</span>
              </div>
            </Button>
          </div>
        </div>

        {/* Right Result Panel */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative">
          {hasAnalyzed && !analyzing && (
            <div className="h-8 flex bg-[#0f172a] border-b border-indigo-500/20 shrink-0">
              {(['endpoints', 'ua', 'insights'] as const).map(t => (
                <button key={t} onClick={() => setResultTab(t)} className={`px-5 h-full text-[9px] font-black uppercase tracking-widest transition-all ${resultTab === t ? 'text-indigo-400 bg-slate-900/50 relative' : 'text-slate-500 hover:text-slate-400'}`}>
                  {t}
                  {resultTab === t && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-indigo-500" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden p-2 flex flex-col">
            {!hasAnalyzed ? (
              <div className="flex-1 border border-dashed border-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-600">
                <Lucide.Monitor size={48} className="opacity-10 mb-4" />
                <span className="text-xs font-medium uppercase tracking-widest">Awaiting Log Injection</span>
              </div>
            ) : analyzing ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Parsing Log Stream...</div>
                <div className="w-48 bg-slate-900 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-[20px] font-black text-white font-mono">{progress}%</div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {resultTab === 'endpoints' && renderTable(singleResult.filter(g => g.templateUri.includes('$(UUID)')), 'Master API Index', singleFile)}
                {resultTab === 'ua' && renderUATable(singleUAResult, 'Client Fingerprint Clusters', singleFile)}
                {resultTab === 'insights' && (activeTab === 'single' ? renderInsightsTab(singleInsights, 'Primary', singleFile) : (
                  <div className="flex-1 flex space-x-2 overflow-hidden">
                    <div className="flex-1 flex flex-col border border-slate-900 rounded-lg overflow-hidden">
                      <div className="bg-indigo-900/20 px-3 py-1 text-[8px] font-black uppercase text-indigo-400 border-b border-indigo-900/30">Primary source</div>
                      {renderInsightsTab(leftInsights, 'Primary', leftFile)}
                    </div>
                    <div className="flex-1 flex flex-col border border-slate-900 rounded-lg overflow-hidden">
                      <div className="bg-rose-900/20 px-3 py-1 text-[8px] font-black uppercase text-rose-400 border-b border-rose-900/30">Reference source</div>
                      {renderInsightsTab(rightInsights, 'Reference', rightFile)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Bar (Log Extractor Style) */}
          <div className="h-6 border-t border-slate-900 bg-[#0f172a] px-3 flex items-center justify-between text-[10px] text-slate-500 select-none">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                <span className="font-bold uppercase tracking-tight text-slate-400">Processing Engine Online</span>
              </div>
              {hasAnalyzed && <span className="opacity-40">|</span>}
              {hasAnalyzed && <span>Telemetry Nodes: <span className="text-indigo-400 font-bold">{singleResult.length}</span></span>}
            </div>
            <div className="text-[9px] font-mono opacity-30 tracking-tighter">ENGINE_BUILD_v2.1.4_STABLE</div>
          </div>
        </div>
      </div>
      {navSource && (
        <RawLogNavigator 
          file={navSource.file} 
          lineIndices={navSource.lineIndices} 
          onClose={() => setNavSource(null)} 
          title={navSource.title} 
        />
      )}
    </div>
  );
};

export default NetTrafficAnalyzerView;
