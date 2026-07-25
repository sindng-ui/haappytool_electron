import React, { useState, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { STDevice, PostGlobalAuth, PostGlobalVariable, EnvironmentProfile } from '../../types';
import { makeReplaceVariables } from './useSmartThingsDiscover';

// ─── Capability & Command Command Presets ─────────────────────────────────────
export interface STCommandPreset {
    label: string;
    capability: string;
    command: string;
    arguments?: any[];
    variant?: 'primary' | 'danger' | 'secondary';
}

export const COMMON_COMMAND_PRESETS: STCommandPreset[] = [
    { label: 'Turn On', capability: 'switch', command: 'on', variant: 'primary' },
    { label: 'Turn Off', capability: 'switch', command: 'off', variant: 'secondary' },
    { label: 'Lock', capability: 'lock', command: 'lock', variant: 'primary' },
    { label: 'Unlock', capability: 'lock', command: 'unlock', variant: 'danger' },
];

export interface CapabilityInspectorProps {
    device: STDevice;
    globalVariables: PostGlobalVariable[];
    envProfiles: EnvironmentProfile[];
    globalAuth?: PostGlobalAuth | null;
    onCommandExecuted?: (response: any) => void;
}

export async function sendDeviceCommand(
    deviceId: string,
    capability: string,
    command: string,
    args: any[] = [],
    globalVariables: PostGlobalVariable[],
    envProfiles: EnvironmentProfile[],
    globalAuth?: PostGlobalAuth | null
): Promise<any> {
    const replaceVars = makeReplaceVariables(globalVariables, envProfiles);
    const baseUrl = replaceVars('{{baseUrl}}');
    const url = `${baseUrl}/v1/devices/${deviceId}/commands`;

    const payload = {
        commands: [
            {
                component: 'main',
                capability,
                command,
                arguments: args,
            },
        ],
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (globalAuth?.enabled && globalAuth.type === 'bearer' && globalAuth.bearerToken) {
        headers['Authorization'] = `Bearer ${globalAuth.bearerToken}`;
    }

    if (typeof window !== 'undefined' && (window as any).electronAPI?.proxyRequest) {
        const res = await (window as any).electronAPI.proxyRequest({
            method: 'POST',
            url,
            headers,
            body: JSON.stringify(payload),
        });
        if (res.error) throw new Error(res.message || 'Command execution failed via proxy');
        return res.data;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
}

const CapabilityInspector: React.FC<CapabilityInspectorProps> = ({
    device,
    globalVariables,
    envProfiles,
    globalAuth,
    onCommandExecuted,
}) => {
    const [executingCommand, setExecutingCommand] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [customCap, setCustomCap] = useState('switch');
    const [customCmd, setCustomCmd] = useState('on');
    const [customArgs, setCustomArgs] = useState('');

    const handleExecute = useCallback(
        async (capability: string, command: string, args: any[] = []) => {
            const key = `${capability}:${command}`;
            setExecutingCommand(key);
            setErrorMsg(null);

            try {
                const res = await sendDeviceCommand(
                    device.deviceId,
                    capability,
                    command,
                    args,
                    globalVariables,
                    envProfiles,
                    globalAuth
                );
                if (onCommandExecuted) onCommandExecuted(res);
            } catch (err: any) {
                setErrorMsg(err.message || 'Command execution failed');
            } finally {
                setExecutingCommand(null);
            }
        },
        [device.deviceId, globalVariables, envProfiles, globalAuth, onCommandExecuted]
    );

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let parsedArgs: any[] = [];
        if (customArgs.trim()) {
            try {
                parsedArgs = JSON.parse(`[${customArgs}]`);
            } catch {
                parsedArgs = [customArgs];
            }
        }
        handleExecute(customCap, customCmd, parsedArgs);
    };

    return (
        <div data-testid="capability-inspector" className="p-3 bg-slate-900 border border-slate-700/60 rounded-xl space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
                <div className="flex items-center gap-2">
                    <Lucide.Sliders size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-slate-200">Capability Inspector</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                    {device.label}
                </span>
            </div>

            {/* Quick Command Presets */}
            <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Commands
                </span>
                <div className="flex flex-wrap gap-1.5">
                    {COMMON_COMMAND_PRESETS.map((preset) => {
                        const key = `${preset.capability}:${preset.command}`;
                        const isLoading = executingCommand === key;

                        return (
                            <button
                                key={key}
                                data-testid={`cmd-btn-${preset.command}`}
                                onClick={() => handleExecute(preset.capability, preset.command, preset.arguments)}
                                disabled={!!executingCommand}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                    preset.variant === 'primary'
                                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30'
                                        : preset.variant === 'danger'
                                        ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                } ${executingCommand ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <Lucide.Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <Lucide.Play size={10} />
                                )}
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Custom Command Form */}
            <form onSubmit={handleCustomSubmit} className="space-y-2 pt-1 border-t border-slate-700/40">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Custom Command
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                    <input
                        type="text"
                        placeholder="Capability (e.g. switch)"
                        value={customCap}
                        onChange={(e) => setCustomCap(e.target.value)}
                        className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        placeholder="Command (e.g. on)"
                        value={customCmd}
                        onChange={(e) => setCustomCmd(e.target.value)}
                        className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        placeholder="Arguments (comma separated e.g. 50, 'red')"
                        value={customArgs}
                        onChange={(e) => setCustomArgs(e.target.value)}
                        className="flex-1 text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        type="submit"
                        disabled={!!executingCommand}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors"
                    >
                        Send
                    </button>
                </div>
            </form>

            {/* Error Feedback */}
            {errorMsg && (
                <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded p-1.5 flex items-center gap-1">
                    <Lucide.AlertCircle size={12} />
                    {errorMsg}
                </div>
            )}
        </div>
    );
};

export default React.memo(CapabilityInspector);
