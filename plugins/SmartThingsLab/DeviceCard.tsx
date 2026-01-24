import React from 'react';
import * as Lucide from 'lucide-react';
import { STDevice, STDeviceStatus } from './types';

const { Smartphone, Power, Activity, Thermometer, Droplets, Wind, Sun, Battery, Wifi } = Lucide;

interface DeviceCardProps {
    device: STDevice;
    status?: STDeviceStatus;
    health?: { state: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' };
    token: string;
    onCommand?: (component: string, capability: string, command: string, args?: any[]) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, status, health, token, onCommand }) => {
    // Simple Icon Logic
    const getIcon = () => {
        const name = (device.label || device.name).toLowerCase();
        if (name.includes('switch') || name.includes('light') || name.includes('bulb')) return Sun;
        if (name.includes('temp') || name.includes('thermostat')) return Thermometer;
        if (name.includes('water') || name.includes('leak')) return Droplets;
        if (name.includes('motion')) return Activity;
        if (name.includes('button')) return Power;
        return Smartphone;
    };

    const Icon = getIcon();

    const copyAsCurl = (component: string, capability: string, command: string, args?: any[]) => {
        const url = `https://api.smartthings.com/v1/devices/${device.deviceId}/commands`;
        const body = { commands: [{ component, capability, command, arguments: args || [] }] };
        const curl = `curl -X POST "${url}" \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`;
        navigator.clipboard.writeText(curl);
        alert('CURL command copied to clipboard!');
    };

    // Helper to render known capabilities safely
    const renderCapabilityStatus = (componentId: string, capId: string) => {
        if (!status) return null;
        const comp = status.components[componentId];
        if (!comp) return null;
        const cap = comp[capId];
        if (!cap) return null;

        // Render attributes
        return Object.entries(cap).map(([attrName, attrVal]) => (
            <div key={attrName} className="flex justify-between items-center text-xs mt-1">
                <span className="text-slate-500 capitalize">{attrName}:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                    {attrVal.value !== null ? String(attrVal.value) : 'null'}
                    {attrVal.unit ? ` ${attrVal.unit}` : ''}
                </span>
            </div>
        ));
    };

    const healthColor = health?.state === 'ONLINE' ? 'bg-emerald-500' : health?.state === 'OFFLINE' ? 'bg-red-500' : 'bg-slate-400';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{device.label || device.name}</h3>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{device.deviceId}</div>
                        {device.type && <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 px-1 inline-block rounded">{device.type}</div>}
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${health?.state === 'ONLINE' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-red-100 bg-red-50 text-red-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${healthColor}`}></div>
                    <span className="text-[10px] font-bold uppercase">{health?.state || 'UNKNOWN'}</span>
                </div>
            </div>

            {/* Components Loop */}
            <div className="space-y-4">
                {device.components?.map(comp => (
                    <div key={comp.id} className="border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider flex justify-between">
                            <span>{comp.id === 'main' ? 'Main Component' : comp.id}</span>
                        </div>

                        <div className="space-y-3">
                            {comp.capabilities.map(cap => (
                                <div key={cap.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{cap.id}</div>
                                        <button
                                            onClick={() => copyAsCurl(comp.id, cap.id, 'command_here')} // Simple placeholder for generic command
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400"
                                            title="Copy Command as CURL"
                                        >
                                            <Lucide.Code size={10} />
                                        </button>
                                    </div>
                                    <div className="pl-1">
                                        {renderCapabilityStatus(comp.id, cap.id)}
                                        {!status && <span className="text-xs text-slate-400 italic">No status data</span>}
                                    </div>

                                    {/* Quick Actions (Hardcoded for Switch/Level/Door) */}
                                    {cap.id === 'switch' && onCommand && (
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => onCommand(comp.id, 'switch', 'on')}
                                                className="flex-1 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-slate-700 dark:text-slate-200 transition-colors font-bold"
                                            >
                                                On
                                            </button>
                                            <button
                                                onClick={() => onCommand(comp.id, 'switch', 'off')}
                                                className="flex-1 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-200 transition-colors font-bold"
                                            >
                                                Off
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
