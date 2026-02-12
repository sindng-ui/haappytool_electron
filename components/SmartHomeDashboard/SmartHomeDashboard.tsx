import React from 'react';
import * as Lucide from 'lucide-react';
import StatusBar from './StatusBar';
import DeviceTile from './DeviceTile';
import { MOCK_DEVICES } from './mockData';
import './styles.css';

const SmartHomeDashboard: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-[#0b0f19] text-slate-100 overflow-hidden">
            {/* System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 border-b border-white/5 bg-[#0f172a]">
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Lucide.LayoutDashboard size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200 no-drag">Smart Home Dashboard</span>
            </div>

            <div className="flex-1 overflow-y-auto sh-container p-6 no-drag">
                <div className="sh-header">
                    <div className="flex items-center gap-2">
                        <span>Dashboard | House</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-normal">
                        <Lucide.CloudSun size={18} />
                        <span>73 °F</span>
                    </div>
                </div>

                <StatusBar />

                <div className="mb-4">
                    <h2 className="text-lg font-medium mb-3">Favorites</h2>
                    <div className="sh-grid">
                        {MOCK_DEVICES.map((device) => (
                            <DeviceTile key={device.id} device={device} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartHomeDashboard;
