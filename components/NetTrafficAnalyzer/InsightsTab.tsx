import React, { useMemo } from 'react';
import * as Lucide from 'lucide-react';

interface InsightsTabProps {
  insights: any;
  sourceName: string;
  onCopy: (text: string, summary: string) => void;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ insights, sourceName, onCopy }) => {
  if (!insights) return null;

  const timelineEntries = useMemo(() => 
    (Object.entries(insights.timeline) as [string, number][]).sort((a, b) => {
      if (a[0].endsWith('m') && b[0].endsWith('m')) return parseInt(a[0]) - parseInt(b[0]);
      return a[0].localeCompare(b[0]);
    }), [insights.timeline]);

  const maxTimeline = useMemo(() => Math.max(...Object.values(insights.timeline) as number[], 1), [insights.timeline]);
  
  const peakEntry = useMemo(() => {
    let peak = { min: '', count: 0 };
    timelineEntries.forEach(([min, count]) => {
      if ((count as number) > peak.count) { peak = { min, count: count as number }; }
    });
    return peak;
  }, [timelineEntries]);

  const hostEntries = useMemo(() => 
    Object.entries(insights.hosts).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)), 
    [insights.hosts]);

  const methodEntries = useMemo(() => 
    Object.entries(insights.methods).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)), 
    [insights.methods]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar bg-[#0b0f19]">
      {/* Report Header */}
      <div className="flex items-center justify-between bg-[#0f172a] p-3 rounded-lg border border-indigo-500/20 shadow-xl">
        <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
          <Lucide.BarChart3 size={14} className="mr-2.5" /> Intelligence Report: {sourceName}
        </div>
        <button
          className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-tight flex items-center space-x-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-md"
          onClick={() => {
            let md = `# Network Insights Report: ${sourceName}\n\n`;
            md += `## Summary Statistics\n`;
            md += `- Total Requests: ${insights.totalRequests.toLocaleString()}\n`;
            md += `- Unique Domains: ${Object.keys(insights.hosts).length}\n`;
            md += `- Activity Span: ${timelineEntries.length} minutes\n\n`;
            md += `\n## Top Hostnames\n`;
            hostEntries.slice(0, 15).forEach(([h, c]) => { md += `| ${h} | ${c} |\n`; });
            md += `\n## Request Methods\n`;
            methodEntries.forEach(([m, c]) => { md += `- ${m}: ${c}\n`; });
            onCopy(md, `${sourceName} Report copied`);
          }}
        >
          <Lucide.Copy size={12} />
          <span>Export Report</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Requests', value: insights.totalRequests.toLocaleString(), color: '#6366f1', icon: <Lucide.Zap size={12} /> },
          { label: 'Unique Domains', value: Object.keys(insights.hosts).length, color: '#10b981', icon: <Lucide.Globe size={12} /> },
          { label: 'Activity Window', value: `${timelineEntries.length}m`, color: '#f59e0b', icon: <Lucide.Clock size={12} /> }
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900/50 border border-slate-800/80 p-3.5 rounded-xl relative overflow-hidden shadow-sm group hover:border-slate-700 transition-all">
            {/* Left color accent bar (inline style to avoid Tailwind dynamic class issue) */}
            <div className="absolute top-0 left-0 w-1.5 h-full opacity-50 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: stat.color }} />
            <div className="flex items-center space-x-1.5 mb-2">
              <span style={{ color: stat.color }}>{stat.icon}</span>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
            </div>
            <div className="text-2xl font-black text-slate-100 tabular-nums leading-none">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Timeline Chart - Enlarged */}
      <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl shadow-sm">
        <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center justify-between">
          <div className="flex items-center">
            <Lucide.Activity size={12} className="mr-2 text-indigo-400" /> Traffic Timeline
          </div>
          <div className="flex items-center space-x-3">
            {peakEntry.count > 0 && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                🔥 Peak: {peakEntry.min} ({peakEntry.count} hits)
              </span>
            )}
            <span className="text-[8px] opacity-40">Per-minute distribution</span>
          </div>
        </div>
        <div className="flex items-end space-x-[2px] h-40 w-full">
          {timelineEntries.map(([min, count]) => {
            const isPeak = min === peakEntry.min;
            const ratio = ((count as number) / maxTimeline) * 100;
            return (
              <div key={min} className="flex-1 relative group/bar cursor-crosshair"
                style={{ height: '100%' }}>
                <div 
                  className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-200 ${isPeak ? 'group-hover/bar:opacity-100' : 'group-hover/bar:opacity-90'}`}
                  style={{ 
                    height: `${ratio}%`,
                    background: isPeak 
                      ? 'linear-gradient(180deg, #f59e0b, #6366f1)' 
                      : 'linear-gradient(180deg, #818cf880, #6366f140)',
                    boxShadow: isPeak ? '0 0 12px rgba(245,158,11,0.3)' : 'none'
                  }}
                />
                {/* Hover tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg border border-slate-700">
                  <span className="font-bold">{min}</span>: {count} {isPeak && '🔥'}
                </div>
              </div>
            );
          })}
        </div>
        {/* X-axis labels (show first, middle, last) */}
        {timelineEntries.length > 2 && (
          <div className="flex justify-between mt-2 text-[8px] text-slate-600 font-mono">
            <span>{timelineEntries[0][0]}</span>
            <span>{timelineEntries[Math.floor(timelineEntries.length / 2)][0]}</span>
            <span>{timelineEntries[timelineEntries.length - 1][0]}</span>
          </div>
        )}
      </div>

      {/* Bottom Grid: Hosts & Methods */}
      <div className="grid grid-cols-2 gap-3">
        {/* Hostnames */}
        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
            <Lucide.Server size={12} className="mr-2 text-emerald-400" /> Top Domains
          </div>
          <div className="space-y-2.5">
            {hostEntries.slice(0, 6).map(([host, count], hIdx) => {
                const ratio = ((count as number) / insights.totalRequests) * 100;
                return (
                  <div key={host} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        {hIdx === 0 && <span className="text-[10px]">👑</span>}
                        <span className="text-slate-300 font-mono break-all pr-2 truncate">{host}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-bold text-emerald-400 font-mono tabular-nums">{(count as number).toLocaleString()}</span>
                        <span className="text-[8px] text-slate-600 tabular-nums w-[36px] text-right">{ratio.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

        {/* Methods */}
        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
            <Lucide.Code2 size={12} className="mr-2 text-indigo-400" /> HTTP Methods
          </div>
          <div className="space-y-3">
            {methodEntries.map(([m, c]) => {
                const ratio = ((c as number) / insights.totalRequests) * 100;
                const methodBarColors: Record<string, string> = {
                  GET: '#22d3ee', POST: '#10b981', PUT: '#f59e0b', DELETE: '#f43f5e', PATCH: '#a78bfa', HEAD: '#94a3b8'
                };
                const barColor = methodBarColors[m] || '#6366f1';
                return (
                  <div key={m} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-black tracking-wider" style={{ color: barColor }}>{m}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-300 font-mono tabular-nums">{(c as number).toLocaleString()}</span>
                        <span className="text-[8px] text-slate-600 tabular-nums w-[40px] text-right">{ratio.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor}88)` }} />
                    </div>
                  </div>
                );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsTab;
