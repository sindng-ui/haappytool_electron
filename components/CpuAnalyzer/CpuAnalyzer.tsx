
import React, { useState } from 'react';
import { useCpuData } from './useCpuData';
import CpuGraph from './CpuGraph';
import CpuProcessTable from './CpuProcessTable';
import { Activity, Play, Square, Cpu } from 'lucide-react';

import ThreadModal from './ThreadModal';

const CpuAnalyzer: React.FC = () => {
    // Basic state for device ID. Ideally this comes from a global context or device selector.
    // For now, defaulting to 'mock' for easy testing, user can change.
    const [deviceId, setDeviceId] = useState('mock');
    const {
        status, data, processList, threads, error,
        startMonitoring, stopMonitoring,
        startThreadMonitoring, stopThreadMonitoring,
        getCallStack
    } = useCpuData(deviceId);

    const [selectedPid, setSelectedPid] = useState<string | null>(null);

    const isMonitoring = status === 'monitoring';

    const handleProcessClick = (pid: string) => {
        setSelectedPid(pid);
        startThreadMonitoring(pid);
    };

    const handleCloseModal = () => {
        stopThreadMonitoring();
        setSelectedPid(null);
    };

    return (
        <div className="flex flex-col h-full bg-[#111] text-white p-6 space-y-6">
            {/* Header / Controls */}
            <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg shadow-md border border-[#333]">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                        <Activity className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Tizen CPU Analyzer</h2>
                        <p className="text-xs text-gray-400 font-mono">Status: <span className={isMonitoring ? 'text-green-400' : 'text-gray-500'}>{status}</span></p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Target Device ID</label>
                        <input
                            type="text"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                            className="bg-[#2a2a2a] border border-[#444] rounded px-3 py-1 text-sm font-mono text-white focus:border-blue-500 focus:outline-none w-48 transition-colors"
                            placeholder="e.g. mock, 192.168.1.5:26101"
                        />
                    </div>

                    <div className="h-8 w-[1px] bg-[#444] mx-2"></div>

                    {!isMonitoring ? (
                        <button
                            onClick={startMonitoring}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded shadow transition-all hover:scale-105 active:scale-95"
                        >
                            <Play size={16} fill="currentColor" />
                            <span className="font-semibold text-sm">Start Analysis</span>
                        </button>
                    ) : (
                        <button
                            onClick={stopMonitoring}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded shadow transition-all hover:scale-105 active:scale-95"
                        >
                            <Square size={16} fill="currentColor" />
                            <span className="font-semibold text-sm">Stop</span>
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 rounded text-sm flex items-center">
                    <span className="mr-2">⚠️</span> {error}
                </div>
            )}

            {/* Main Content Grid */}
            <div className="flex flex-col flex-1 min-h-0 space-y-6">

                {/* Graph Section */}
                <div className="flex-none">
                    <div className="flex items-center mb-2 space-x-2">
                        <Cpu size={16} className="text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-300">Total CPU Usage History</h3>
                    </div>
                    <CpuGraph data={data} />
                </div>

                {/* Process List Section */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-300">Top Processes (CPU Consumption)</h3>
                        <span className="text-xs text-gray-500">Click a row to view threads</span>
                    </div>
                    <div className="flex-1 min-h-0 border border-[#333] rounded-lg shadow-inner bg-[#000]/20">
                        <CpuProcessTable processes={processList} onRowClick={handleProcessClick} />
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

            {/* Analysis / Insight Panel */}
            <div className="p-4 bg-[#1e1e1e] rounded-lg border border-[#333]">
                <h4 className="text-sm font-bold text-gray-300 mb-2">Automated Analysis</h4>
                {processList.length > 0 ? (
                    (() => {
                        const topProc = processList[0];
                        if (topProc && topProc.cpu > 50) {
                            return (
                                <p className="text-sm text-yellow-400">
                                    <span className="font-bold">{topProc.name}</span> is consuming significant CPU resources ({topProc.cpu}%).
                                    This might indicate a tight loop, heavy rendering, or a memory leak in JS execution.
                                </p>
                            );
                        } else if (data.length > 5 && data[data.length - 1].total > 90) {
                            return <p className="text-sm text-red-400">System-wide CPU usage is critically high. The system might become unresponsive.</p>;
                        } else {
                            return <p className="text-sm text-gray-500">System performance appears nominal. No critical anomalies detected.</p>;
                        }
                    })()
                ) : (
                    <p className="text-sm text-gray-600 italic">Waiting for data...</p>
                )}
            </div>

        </div>
    );
};

export default CpuAnalyzer;
