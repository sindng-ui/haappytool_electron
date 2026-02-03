
import React, { useState, useEffect } from 'react';
import { useCpuData } from '../../components/CpuAnalyzer/useCpuData';
import CpuGraph from '../../components/CpuAnalyzer/CpuGraph';
import MemoryGraph from '../../components/CpuAnalyzer/MemoryGraph';
import {
    Activity, Play, Square, Cpu, HardDrive,
    AlertCircle, Info, TrendingUp, Layers
} from 'lucide-react';

interface TizenPerfMonitorProps {
    deviceId: string;
    sdbPath?: string;
    isActive?: boolean;
}

const TizenPerfMonitor: React.FC<TizenPerfMonitorProps> = ({ deviceId, sdbPath, isActive = false }) => {
    const [appName, setAppName] = useState('');
    const [interval, setIntervalVal] = useState('1');

    const {
        status, data, memoryData, memoryStatus, processList, error,
        startMonitoring, stopMonitoring,
        startMemoryMonitoring, stopMemoryMonitoring
    } = useCpuData(deviceId, sdbPath, isActive);

    const isMonitoring = status.includes('monitoring') || memoryStatus.includes('monitoring');

    const handleStart = () => {
        startMonitoring();
        if (appName) {
            startMemoryMonitoring(appName, parseInt(interval));
        }
    };

    const handleStop = () => {
        stopMonitoring();
        stopMemoryMonitoring();
    };

    // Calculate some basics
    const lastCpu = data.length > 0 ? data[data.length - 1].total : 0;
    const lastMem = memoryData.length > 0 ? (memoryData[memoryData.length - 1].pss / 1024).toFixed(1) : '0';

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Controls Bar */}
            <div className="p-4 bg-slate-900/50 border-b border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tizen App ID</label>
                        <input
                            placeholder="e.g. org.tizen.example"
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 w-64"
                            value={appName}
                            onChange={e => setAppName(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Polling (s)</label>
                        <input
                            type="number"
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 w-20"
                            value={interval}
                            onChange={e => setIntervalVal(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isMonitoring ? (
                        <button
                            onClick={handleStart}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            <Play size={16} fill="currentColor" /> Start Analysis
                        </button>
                    ) : (
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 animate-pulse"
                        >
                            <Square size={16} fill="currentColor" /> Stop
                        </button>
                    )}
                </div>
            </div>

            {/* Main Stats Display */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-12 gap-6">

                    {/* CPU Widget */}
                    <div className="col-span-12 lg:col-span-7 space-y-4">
                        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                        <Cpu size={20} />
                                    </div>
                                    <h3 className="font-bold text-slate-200">System Load</h3>
                                </div>
                                <div className="text-2xl font-mono text-blue-400">{lastCpu.toFixed(1)}%</div>
                            </div>
                            <div className="h-48">
                                <CpuGraph data={data} />
                            </div>
                        </div>

                        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Layers size={18} className="text-slate-500" />
                                <h3 className="font-bold text-slate-200 text-sm italic">Top Processes</h3>
                            </div>
                            <div className="space-y-2">
                                {processList.slice(0, 5).map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-white/5 group hover:border-indigo-500/30 transition-all">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-slate-500 w-8">{p.pid}</span>
                                            <span className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors truncate max-w-[200px]">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-500"
                                                    style={{ width: `${Math.min(100, (p.cpu / 400) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono text-blue-400 w-12 text-right">{p.cpu.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                                {processList.length === 0 && (
                                    <div className="py-10 text-center text-slate-600 text-xs italic">Waiting for CPU data...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Memory Widget */}
                    <div className="col-span-12 lg:col-span-5 space-y-6">
                        <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900/40 border border-white/5 rounded-3xl p-6 relative">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                                        <HardDrive size={20} />
                                    </div>
                                    <h3 className="font-bold text-slate-200">App Memory</h3>
                                </div>
                                <div className="text-2xl font-mono text-indigo-400">{lastMem} <span className="text-xs">MB</span></div>
                            </div>
                            <div className="h-40">
                                <MemoryGraph data={memoryData} />
                            </div>

                            <div className="mt-6 flex flex-col gap-3">
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                    <span>Analysis Status</span>
                                    <span className={memoryStatus.includes('monitoring') ? 'text-green-500' : 'text-slate-600'}>
                                        {memoryStatus}
                                    </span>
                                </div>
                                {memoryData.length > 0 && (
                                    <div className="flex items-start gap-3 p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                                        <TrendingUp size={16} className="text-indigo-400 mt-0.5" />
                                        <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                            Collecting PSS and GEMRSS data. Visualizing heap growth for memory leak detection.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Tips */}
                        <div className="p-6 bg-slate-900/40 border border-white/5 rounded-3xl shadow-xl">
                            <div className="flex items-center gap-2 mb-4 text-amber-400">
                                <Info size={16} />
                                <h4 className="text-xs font-bold uppercase tracking-widest">Tizen .NET Performance Tips</h4>
                            </div>
                            <ul className="space-y-3 text-[11px] text-slate-400 italic">
                                <li>• Check <span className="text-slate-200">GC</span> collection counts using logs when memory spikes.</li>
                                <li>• High CPU in <span className="text-slate-200">NaturalUI</span> might mean layout recursion.</li>
                                <li>• Use <span className="text-slate-200">sdb shell vd_memps</span> for deeper PSS/VSS/RSS analysis.</li>
                            </ul>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400">
                                <AlertCircle size={18} className="shrink-0" />
                                <div className="text-xs font-mono">{error}</div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-slate-900 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold text-slate-400 uppercase">
                        <Activity size={12} className="text-blue-500" /> System: {status}
                    </div>
                </div>
                <div className="text-[10px] text-slate-500 italic">
                    Powered by HappyTool Performance Engine
                </div>
            </div>
        </div>
    );
};

export default TizenPerfMonitor;
