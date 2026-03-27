import React from 'react';
import * as Lucide from 'lucide-react';

interface InsightsTabProps {
  insights: any;
  sourceName: string;
  onCopy: (text: string, summary: string) => void;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ insights, sourceName, onCopy }) => {
  if (!insights) return null;

  const timelineEntries = (Object.entries(insights.timeline) as [string, number][]).sort((a, b) => {
    if (a[0].endsWith('m') && b[0].endsWith('m')) return parseInt(a[0]) - parseInt(b[0]);
    return a[0].localeCompare(b[0]);
  });
  const maxTimeline = Math.max(...Object.values(insights.timeline) as number[], 1);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar bg-[#0b0f19]">
      <div className="flex items-center justify-between bg-[#0f172a] p-3 rounded-lg border border-indigo-500/20 shadow-xl">
        <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
          <Lucide.FileText size={14} className="mr-2.5" /> Telemetry Intelligence Report: {sourceName}
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
            Object.entries(insights.hosts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 15).forEach(([h, c]) => {
              md += `| ${h} | ${c} |\n`;
            });
            
            md += `\n## Request Methods\n`;
            Object.entries(insights.methods).sort((a: any, b: any) => b[1] - a[1]).forEach(([m, c]) => {
              md += `- ${m}: ${c}\n`;
            });
            
            onCopy(md, `${sourceName} Report copied`);
          }}
        >
          <Lucide.Copy size={12} />
          <span>Export MD Report</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Volume', value: insights.totalRequests.toLocaleString(), color: 'indigo', icon: <Lucide.Zap size={10} /> },
          { label: 'Target Domains', value: Object.keys(insights.hosts).length, color: 'emerald', icon: <Lucide.Globe size={10} /> },
          { label: 'Duration Window', value: `${timelineEntries.length}m`, color: 'amber', icon: <Lucide.Clock size={10} /> }
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900/50 border border-slate-800/80 p-3 rounded-xl relative overflow-hidden shadow-sm group hover:border-indigo-500/30 transition-all">
            <div className={`absolute top-0 left-0 w-1.5 h-full bg-${stat.color}-500 opacity-40 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-center space-x-1.5 mb-1.5">
              <span className={`text-${stat.color}-400`}>{stat.icon}</span>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
            </div>
            <div className="text-xl font-black text-slate-100 tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl shadow-sm">
        <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center justify-between">
          <div className="flex items-center">
            <Lucide.Activity size={12} className="mr-2 text-indigo-400" /> Temporal Traffic Distribution
          </div>
          <div className="text-[8px] opacity-40">Minute-by-minute Telemetry</div>
        </div>
        <div className="flex items-end space-x-1 h-24 w-full">
          {timelineEntries.map(([min, count]) => (
            <div key={min} className="flex-1 bg-indigo-500/20 hover:bg-indigo-400 transition-all rounded-t-[2px] relative group/bar"
              style={{ height: `${((count as number) / maxTimeline) * 100}%` }}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10">
                {min}: {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
            <Lucide.Server size={12} className="mr-2 text-emerald-400" /> Primary Hostnames
          </div>
          <div className="space-y-2">
            {Object.entries(insights.hosts).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0, 6).map(([host, count]) => {
                const ratio = ((count as number) / insights.totalRequests) * 100;
                return (
                  <div key={host} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-300 font-mono break-all pr-4">{host}</span>
                      <span className="font-bold text-emerald-400 font-mono shrink-0 tabular-nums">{count as number}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                      <div className="bg-emerald-500/50 h-full" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
            })}
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
            <Lucide.Code2 size={12} className="mr-2 text-indigo-400" /> Request Methods
          </div>
          <div className="space-y-2.5">
            {Object.entries(insights.methods).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).map(([m, c]) => {
                const ratio = ((c as number) / insights.totalRequests) * 100;
                return (
                  <div key={m} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-white font-black tracking-widest">{m}</span>
                      <span className="font-bold text-slate-400 font-mono tabular-nums">{c as number} <span className="text-[8px] opacity-40 ml-1">({ratio.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${ratio}%` }} />
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
