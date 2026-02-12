
import React, { useState, useMemo } from 'react';
import { useCpuData } from './useCpuData';
import CpuGraph from './CpuGraph';
import MemoryGraph from './MemoryGraph';
import CpuProcessTable from './CpuProcessTable';
import { Activity, Play, Square, Cpu, HardDrive } from 'lucide-react';
import ThreadModal from './ThreadModal';

interface CpuAnalyzerProps {
    isActive?: boolean;
}

const CpuAnalyzer: React.FC<CpuAnalyzerProps> = ({ isActive = false }) => {
    const [deviceId, setDeviceId] = useState('mock');
    const [appName, setAppName] = useState('');
    const [interval, setInterval] = useState('1');

    const {
        status, data, memoryData, memoryStatus, processList, threads, error,
        startMonitoring, stopMonitoring,
        startMemoryMonitoring, stopMemoryMonitoring,
        startThreadMonitoring, stopThreadMonitoring,
        getCallStack
    } = useCpuData(deviceId, undefined, isActive);

    const [selectedPid, setSelectedPid] = useState<string | null>(null);

    const isMonitoring = status === 'monitoring' || memoryStatus === 'monitoring';

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

    const handleProcessClick = (pid: string) => {
        setSelectedPid(pid);
        startThreadMonitoring(pid);
    };

    const handleCloseModal = () => {
        stopThreadMonitoring();
        setSelectedPid(null);
    };

    // Auto-analysis of memory data
    const memoryStats = useMemo(() => {
        if (memoryData.length === 0) return null;

        const totals = memoryData.map(d => d.pss + d.gemrss + d.swap + d.gpu);
        const maxTotal = Math.max(...totals);
        const minTotal = Math.min(...totals);
        const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;

        // Spike detection: if total jumped > 20% in last few frames
        let spikeDetected = false;
        if (totals.length > 5) {
            const last = totals[totals.length - 1];
            const prev = totals[totals.length - 2];
            if (last > prev * 1.2) spikeDetected = true;
        }

        // Sustained high detection: if last 60s (approx 60 frames) never dropped below 90% of max
        let sustainedHigh = false;
        if (totals.length >= 60) {
            // Check if all recent values are high
            const recent = totals.slice(-60);
            const lowPoint = Math.min(...recent);
            if (lowPoint > maxTotal * 0.9 && maxTotal > 50000) { // arbitrary threshold 50MB
                sustainedHigh = true;
            }
        }

        return {
            max: maxTotal,
            min: minTotal,
            avg: avgTotal,
            spikeDetected,
            sustainedHigh
        };
    }, [memoryData]);



    if (!isActive) return null;

    return (
        <div className="flex flex-col h-full bg-[#0b0f19] text-white overflow-hidden">
            {/* System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 border-b border-white/5 bg-[#0f172a]">
                <div className="p-1 bg-blue-500/10 rounded-lg text-blue-400 no-drag"><Cpu size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200 no-drag">CPU Analyzer</span>
            </div>

            <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                {/* Header / Controls */}
                <div className="flex-none p-4 bg-slate-800/50 rounded-lg shadow-md border border-white/5 flex items-center justify-between no-drag">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Performance Analyzer</h2>
                            <div className="flex items-center space-x-3 text-xs font-mono">
                                <span className="text-gray-400">CPU Status: <span className={status === 'monitoring' ? 'text-green-400' : 'text-gray-500'}>{status}</span></span>
                                <span className="text-gray-500">|</span>
                                <span className="text-gray-400">Mem Status: <span className={memoryStatus.includes('monitoring') ? 'text-green-400' : 'text-gray-500'}>{memoryStatus}</span></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Target Device</label>
                            <input
                                type="text"
                                value={deviceId}
                                onChange={(e) => setDeviceId(e.target.value)}
                                className="bg-[#2a2a2a] border border-[#444] rounded px-3 py-1 text-sm font-mono text-white w-32 focus:border-blue-500 outline-none"
                                placeholder="Device ID"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Mem App Name</label>
                            <input
                                type="text"
                                value={appName}
                                onChange={(e) => setAppName(e.target.value)}
                                className="bg-[#2a2a2a] border border-[#444] rounded px-3 py-1 text-sm font-mono text-white w-32 focus:border-blue-500 outline-none"
                                placeholder="e.g. com.app"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Interval (s)</label>
                            <input
                                type="number"
                                value={interval}
                                onChange={(e) => setInterval(e.target.value)}
                                className="bg-[#2a2a2a] border border-[#444] rounded px-3 py-1 text-sm font-mono text-white w-20 focus:border-blue-500 outline-none"
                                min="1"
                            />
                        </div>

                        <div className="h-8 w-[1px] bg-[#444] mx-2"></div>

                        {!isMonitoring ? (
                            <button
                                onClick={handleStart}
                                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded shadow hover:scale-105 active:scale-95 transition-all"
                            >
                                <Play size={16} fill="currentColor" />
                                <span className="font-semibold text-sm">Start</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded shadow hover:scale-105 active:scale-95 transition-all"
                            >
                                <Square size={16} fill="currentColor" />
                                <span className="font-semibold text-sm">Stop</span>
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="flex-none p-3 bg-red-900/30 border border-red-800 text-red-200 rounded text-sm flex items-center">
                        <span className="mr-2">⚠️</span> {error}
                    </div>
                )}

                {/* Split View */}
                <div className="flex-1 min-h-0 flex space-x-4">
                    {/* Left: CPU */}
                    <div className="flex-1 flex flex-col space-y-4">
                        <div className="flex-none">
                            <div className="flex items-center mb-2 space-x-2">
                                <Cpu size={16} className="text-blue-400" />
                                <h3 className="text-sm font-semibold text-gray-300">Total CPU Usage</h3>
                            </div>
                            <CpuGraph data={data} />
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-300">Top Processes</h3>
                                <span className="text-[10px] text-gray-500">Click row for threads</span>
                            </div>
                            <div className="flex-1 min-h-0 border border-[#333] rounded-lg shadow-inner bg-[#000]/20">
                                <CpuProcessTable processes={processList} onRowClick={handleProcessClick} />
                            </div>
                        </div>
                    </div>

                    {/* Right: Memory */}
                    <div className="flex-1 flex flex-col space-y-4">
                        <div className="flex-none">
                            <div className="flex items-center mb-2 space-x-2">
                                <HardDrive size={16} className="text-purple-400" />
                                <h3 className="text-sm font-semibold text-gray-300">Memory Usage (KB)</h3>
                            </div>
                            <MemoryGraph data={memoryData} />
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 p-4 bg-[#1e1e1e] rounded-lg border border-[#333]">
                            <h3 className="text-sm font-semibold text-gray-300 mb-4">Memory Analysis</h3>

                            {memoryStats ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#2a2a2a] p-3 rounded">
                                            <div className="text-xs text-gray-500 uppercase">Avg Total</div>
                                            <div className="text-xl font-mono text-purple-400">{(memoryStats.avg / 1024).toFixed(1)} MB</div>
                                        </div>
                                        <div className="bg-[#2a2a2a] p-3 rounded">
                                            <div className="text-xs text-gray-500 uppercase">Max Total</div>
                                            <div className="text-xl font-mono text-white">{(memoryStats.max / 1024).toFixed(1)} MB</div>
                                        </div>
                                        <div className="bg-[#2a2a2a] p-3 rounded">
                                            <div className="text-xs text-gray-500 uppercase">Min Total</div>
                                            <div className="text-xl font-mono text-gray-400">{(memoryStats.min / 1024).toFixed(1)} MB</div>
                                        </div>
                                    </div>

                                    {/* Heuristics */}
                                    <div className="space-y-2 pt-2 border-t border-[#333]">
                                        {memoryStats.spikeDetected && (
                                            <div className="p-2 bg-red-900/40 border border-red-800 rounded text-xs text-red-200 flex items-center animate-pulse">
                                                ⚠️ Rapid Memory Spike Detected!
                                            </div>
                                        )}
                                        {memoryStats.sustainedHigh && (
                                            <div className="p-2 bg-yellow-900/40 border border-yellow-800 rounded text-xs text-yellow-200 flex items-center">
                                                ⚠️ Memory has stayed near peak for 60s (Possible Leak)
                                            </div>
                                        )}
                                        {!memoryStats.spikeDetected && !memoryStats.sustainedHigh && (
                                            <div className="text-xs text-gray-500 flex items-center">
                                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span> Memory usage appears stable.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-600 text-sm italic">
                                    Start monitoring to see memory stats...
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Thread Modal */}
                {selectedPid && (
                    <ThreadModal
                        pid={selectedPid}
                        threads={threads}
                        onClose={handleCloseModal}
                    />
                )}
            </div>
        </div>
    );
};

export default CpuAnalyzer;
