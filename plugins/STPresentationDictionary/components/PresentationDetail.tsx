import React, { useState } from 'react';
import { Braces, Copy, Check, ShieldCheck, Zap, ToggleRight } from 'lucide-react';

interface PresentationDetailProps {
    presentation: any;
}

export const PresentationDetail: React.FC<PresentationDetailProps> = ({ presentation }) => {
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'analysis' | 'json'>('analysis');

    if (!presentation) return null;

    const { presentationId, manufacturerName, dashboard, detailView, automation } = presentation;

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(presentation, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const totalCapabilities = new Set<string>();
    const detailCaps = (detailView || []).map((d: any) => {
        if (d.capability) totalCapabilities.add(d.capability);
        return d.capability;
    });

    const dashStates = (dashboard?.states || []).map((s: any) => {
        if (s.capability) totalCapabilities.add(s.capability);
        return s.capability;
    });
    const dashActions = (dashboard?.actions || []).map((a: any) => {
        if (a.capability) totalCapabilities.add(a.capability);
        return a.capability;
    });

    const autoConds = (automation?.conditions || []).map((c: any) => {
        if (c.capability) totalCapabilities.add(c.capability);
        return c.capability;
    });
    const autoActs = (automation?.actions || []).map((a: any) => {
        if (a.capability) totalCapabilities.add(a.capability);
        return a.capability;
    });

    return (
        <div className="flex-1 bg-slate-900/60 border border-slate-800/85 rounded-2xl p-6 flex flex-col h-full overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/60 select-none">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('analysis')}
                        className={`text-sm font-extrabold pb-2 transition-all border-b-2 ${
                            activeTab === 'analysis' 
                                ? 'text-indigo-400 border-indigo-500' 
                                : 'text-slate-400 border-transparent hover:text-slate-200'
                        }`}
                    >
                        Schema Analytics
                    </button>
                    <button 
                        onClick={() => setActiveTab('json')}
                        className={`text-sm font-extrabold pb-2 transition-all border-b-2 ${
                            activeTab === 'json' 
                                ? 'text-indigo-400 border-indigo-500' 
                                : 'text-slate-400 border-transparent hover:text-slate-200'
                        }`}
                    >
                        Raw JSON
                    </button>
                </div>

                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800/60 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5 text-indigo-400" />
                            Copy JSON
                        </>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'analysis' ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-4 text-center">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Capabilities</span>
                                <span className="text-xl font-black text-indigo-400 font-mono mt-1 block">{totalCapabilities.size} Items</span>
                            </div>
                            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-4 text-center">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Dashboard Slots</span>
                                <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                                    {Math.max(dashStates.length, dashActions.length)} Items
                                </span>
                            </div>
                            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-4 text-center">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Automation Rules</span>
                                <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                                    {autoConds.length + autoActs.length} Items
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4">
                                <h4 className="text-xs font-black text-slate-200 flex items-center gap-2 mb-3">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    Dashboard Card Layout Schema
                                </h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[10px] text-slate-450 font-extrabold uppercase">States (Real-time Status):</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {dashStates.length > 0 ? (
                                                dashStates.map((s, idx) => (
                                                    <span key={`ds-${idx}`} className="bg-emerald-950/50 border border-emerald-900/60 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                                                        {s}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-500 font-bold">No States Available</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <span className="text-[10px] text-slate-450 font-extrabold uppercase">Actions (Quick Control):</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {dashActions.length > 0 ? (
                                                dashActions.map((a, idx) => (
                                                    <span key={`da-${idx}`} className="bg-indigo-950/50 border border-indigo-900/60 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                                                        {a}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-500 font-bold">No Actions Available</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4">
                                <h4 className="text-xs font-black text-slate-200 flex items-center gap-2 mb-3">
                                    <ToggleRight className="w-4 h-4 text-indigo-400" />
                                    Device Detail View Components
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {detailCaps.length > 0 ? (
                                        detailCaps.map((d, idx) => (
                                            <span key={`dv-${idx}`} className="bg-slate-900 border border-slate-800 text-slate-350 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-mono shadow-md">
                                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                                                {d}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-500 font-bold">No Detail View Schema Available</span>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4">
                                <h4 className="text-xs font-black text-slate-200 flex items-center gap-2 mb-3">
                                    <Zap className="w-4 h-4 text-amber-400" />
                                    Automation Routine Compatibility
                                </h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[10px] text-slate-450 font-extrabold uppercase">Conditions (IF Trigger):</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {autoConds.length > 0 ? (
                                                autoConds.map((c, idx) => (
                                                    <span key={`ac-${idx}`} className="bg-amber-950/40 border border-amber-900/60 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                                                        {c}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-500 font-bold">No Conditions Available</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <span className="text-[10px] text-slate-450 font-extrabold uppercase">Actions (THEN Command):</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {autoActs.length > 0 ? (
                                                autoActs.map((a, idx) => (
                                                    <span key={`aa-${idx}`} className="bg-rose-950/40 border border-rose-900/60 text-rose-350 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                                                        {a}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-500 font-bold">No Automation Actions Available</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <pre className="bg-slate-950 border border-slate-850 rounded-2xl p-5 text-slate-300 text-xs font-mono overflow-auto max-h-[460px] custom-scrollbar shadow-inner leading-relaxed">
                        <code>{JSON.stringify(presentation, null, 2)}</code>
                    </pre>
                )}
            </div>
        </div>
    );
};
