
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import TizenFileExplorer from './TizenFileExplorer';
import TizenPerfMonitor from './TizenPerfMonitor';
import TizenAppManager from './TizenAppManager';

const { FolderTree, Activity, Settings2, Box } = Lucide;

import { useToast } from '../../contexts/ToastContext';

type Tab = 'explorer' | 'perf' | 'apps' | 'settings';

interface TizenLabPluginProps {
    isActive?: boolean;
}

const TizenLabPlugin: React.FC<TizenLabPluginProps> = ({ isActive = false }) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('explorer');
    const [deviceId, setDeviceId] = useState(() => localStorage.getItem('lastSdbDeviceId') || '');
    const [sdbPath, setSdbPath] = useState(() => localStorage.getItem('tizen_sdb_path') || '');

    if (!isActive) return null;

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
            {/* Tab Bar */}
            <div className="h-14 bg-[#0f172a] border-b border-indigo-500/20 flex items-center px-6 pr-[140px] gap-8 flex-shrink-0 title-drag">
                <div className="flex items-center gap-2 mr-4 no-drag">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Activity size={18} />
                    </div>
                    <span className="font-bold text-sm tracking-tight text-white uppercase">Tizen Lab</span>
                </div>

                <div className="flex h-full no-drag">
                    <button
                        onClick={() => setActiveTab('explorer')}
                        className={`px-4 flex items-center gap-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'explorer' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <FolderTree size={14} /> File Explorer
                    </button>
                    <button
                        onClick={() => setActiveTab('apps')}
                        className={`px-4 flex items-center gap-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'apps' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Box size={14} /> App Manager
                    </button>
                    <button
                        onClick={() => setActiveTab('perf')}
                        className={`px-4 flex items-center gap-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'perf' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Activity size={14} /> Performance Monitor
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 flex items-center gap-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'settings' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Settings2 size={14} /> Lab Settings
                    </button>
                </div>

                <div className="ml-auto flex items-center gap-3 no-drag">
                    <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-1.5 border border-slate-700">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Device</span>
                        <input
                            className="bg-transparent border-none outline-none text-[11px] font-mono text-indigo-300 w-24"
                            value={deviceId}
                            onChange={(e) => {
                                setDeviceId(e.target.value);
                                localStorage.setItem('lastSdbDeviceId', e.target.value);
                            }}
                            placeholder="auto-detect"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'explorer' && <TizenFileExplorer deviceId={deviceId} sdbPath={sdbPath} isActive={isActive && activeTab === 'explorer'} />}
                {activeTab === 'apps' && <TizenAppManager deviceId={deviceId} sdbPath={sdbPath} isActive={isActive && activeTab === 'apps'} />}
                {activeTab === 'perf' && <TizenPerfMonitor deviceId={deviceId} sdbPath={sdbPath} isActive={isActive && activeTab === 'perf'} />}
                {activeTab === 'settings' && (
                    <div className="p-8 max-w-2xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings2 className="text-indigo-400" size={20} />
                                Plugin Configuration
                            </h2>
                            <p className="text-slate-500 text-xs">Configure how Tizen Lab interacts with your development environment.</p>
                        </div>

                        <div className="grid gap-6">
                            {/* SDB Path Setting */}
                            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-300">SDB Executable Path</label>
                                        <p className="text-[10px] text-slate-500">Specify the absolute path to 'sdb' if it's not in your system PATH.</p>
                                    </div>
                                    <div className="px-2 py-1 bg-indigo-500/10 rounded text-[9px] font-bold text-indigo-400 uppercase tracking-tight">System Global</div>
                                </div>
                                <input
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-xs font-mono text-indigo-300 outline-none focus:border-indigo-500/50 transition-all"
                                    placeholder="e.g. C:\tizen-studio\tools\sdb.exe"
                                    value={sdbPath}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setSdbPath(newVal);
                                        localStorage.setItem('tizen_sdb_path', newVal);
                                        // Force re-render if needed, but for now just saving is fine
                                        addToast('SDB Path updated. Changes will apply on next operation.', 'info');
                                    }}
                                />
                            </div>

                            {/* Refresh Interval Setting */}
                            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-300">Performance Refresh Rate</label>
                                        <p className="text-[10px] text-slate-500">How often the performance monitor updates device stats.</p>
                                    </div>
                                    <div className="px-2 py-1 bg-amber-500/10 rounded text-[9px] font-bold text-amber-400 uppercase tracking-tight">UI Performance</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="500"
                                        max="5000"
                                        step="500"
                                        className="flex-1 accent-indigo-500"
                                        value={parseInt(localStorage.getItem('tizen_perf_interval') || '2000')}
                                        onChange={(e) => {
                                            localStorage.setItem('tizen_perf_interval', e.target.value);
                                            addToast(`Refresh rate set to ${e.target.value}ms`, 'info');
                                        }}
                                    />
                                    <span className="text-sm font-mono text-indigo-400 w-16 text-right">
                                        {localStorage.getItem('tizen_perf_interval') || '2000'}ms
                                    </span>
                                </div>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => {
                                    if (confirm('Reset all Tizen Lab settings to default?')) {
                                        localStorage.removeItem('tizen_sdb_path');
                                        localStorage.removeItem('tizen_perf_interval');
                                        localStorage.removeItem('tizen_last_path');
                                        localStorage.removeItem('local_last_path');
                                        location.reload();
                                    }
                                }}
                                className="w-fit px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white transition-all mx-auto"
                            >
                                Reset to Default Settings
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TizenLabPlugin;
