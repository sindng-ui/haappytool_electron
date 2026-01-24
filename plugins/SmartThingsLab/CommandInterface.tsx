import React, { useState, useEffect } from 'react';
import { Send, Terminal, Play, AlertCircle, Loader2 } from 'lucide-react';
import { STDevice, STCommandRequest } from './types';
import { SmartThingsService } from './services/smartThingsService';

interface CommandInterfaceProps {
    device: STDevice;
    service: SmartThingsService;
    token: string;
    onLog: (entry: any) => void;
}

export const CommandInterface: React.FC<CommandInterfaceProps> = ({ device, service, token, onLog }) => {
    const [selectedComponent, setSelectedComponent] = useState<string>('main');
    const [selectedCapability, setSelectedCapability] = useState<string>('');
    const [selectedCommand, setSelectedCommand] = useState<string>('');
    const [argsInput, setArgsInput] = useState<string>('[]');

    const [capabilities, setCapabilities] = useState<{ id: string, version?: number }[]>([]);
    const [availableCommands, setAvailableCommands] = useState<Record<string, any> | null>(null);
    const [loadingCaps, setLoadingCaps] = useState(false);
    const [executing, setExecuting] = useState(false);

    // Update Capabilities when Component changes
    useEffect(() => {
        const comp = device.components?.find(c => c.id === selectedComponent);
        if (comp) {
            setCapabilities(comp.capabilities);
            if (comp.capabilities.length > 0) {
                setSelectedCapability(comp.capabilities[0].id);
            }
        }
    }, [selectedComponent, device]);

    // Fetch Capability Definition when Capability changes
    useEffect(() => {
        if (!selectedCapability) return;

        const fetchCap = async () => {
            setLoadingCaps(true);
            try {
                // Find version
                const capRef = capabilities.find(c => c.id === selectedCapability);
                const version = capRef?.version || 1;

                const capDef = await service.getCapability(selectedCapability, version);
                setAvailableCommands(capDef.commands);

                // Select first command if available
                const cmds = Object.keys(capDef.commands || {});
                if (cmds.length > 0) setSelectedCommand(cmds[0]);
                else setSelectedCommand('');

            } catch (e) {
                console.error("Failed to fetch capability", e);
                setAvailableCommands(null);
            } finally {
                setLoadingCaps(false);
            }
        };

        fetchCap();
    }, [selectedCapability, service]);

    const handleExecute = async () => {
        if (!selectedCommand) return;
        setExecuting(true);

        try {
            let parsedArgs: any[] = [];
            try {
                parsedArgs = JSON.parse(argsInput);
                if (!Array.isArray(parsedArgs)) throw new Error("Args must be an array");
            } catch (e) {
                onLog({ type: 'error', message: 'Invalid Arguments JSON', timestamp: new Date() });
                setExecuting(false);
                return;
            }

            const cmd: STCommandRequest = {
                component: selectedComponent,
                capability: selectedCapability,
                command: selectedCommand,
                arguments: parsedArgs
            };

            onLog({ type: 'request', data: cmd, timestamp: new Date() });

            const result = await service.executeCommand(device.deviceId, [cmd]);

            onLog({ type: 'response', data: result, timestamp: new Date() });

        } catch (e: any) {
            onLog({ type: 'error', message: e.message, timestamp: new Date() });
        } finally {
            setExecuting(false);
        }
    };

    const copyAsCurl = () => {
        const url = `https://api.smartthings.com/v1/devices/${device.deviceId}/commands`;
        const body = {
            commands: [{
                component: selectedComponent,
                capability: selectedCapability,
                command: selectedCommand,
                arguments: JSON.parse(argsInput)
            }]
        };
        const curl = `curl -X POST "${url}" \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body, null, 2)}'`;
        navigator.clipboard.writeText(curl);
        alert('CURL copied!');
    };

    const copyAsCli = () => {
        const commands = [{
            component: selectedComponent,
            capability: selectedCapability,
            command: selectedCommand,
            arguments: JSON.parse(argsInput)
        }];
        const cli = `smartthings devices:commands ${device.deviceId} '${JSON.stringify(commands)}'`;
        navigator.clipboard.writeText(cli);
        alert('CLI command copied!');
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-xs tracking-wider">
                    <Terminal size={14} />
                    Command Executor
                </div>
                <div className="flex gap-1">
                    <button onClick={copyAsCurl} className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-slate-500 transition-colors">CURL</button>
                    <button onClick={copyAsCli} className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-slate-500 transition-colors">CLI</button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Component Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Component</label>
                    <select
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-md px-2 py-1.5 text-sm"
                        value={selectedComponent}
                        onChange={e => setSelectedComponent(e.target.value)}
                    >
                        {device.components?.map(c => (
                            <option key={c.id} value={c.id}>{c.id}</option>
                        ))}
                    </select>
                </div>

                {/* Capability Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Capability</label>
                    <select
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-md px-2 py-1.5 text-sm"
                        value={selectedCapability}
                        onChange={e => setSelectedCapability(e.target.value)}
                    >
                        {capabilities.map(c => (
                            <option key={c.id} value={c.id}>{c.id}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Command Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Command {loadingCaps && '(Loading...)'}</label>
                    <select
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-md px-2 py-1.5 text-sm"
                        value={selectedCommand}
                        onChange={e => setSelectedCommand(e.target.value)}
                        disabled={!availableCommands}
                    >
                        {availableCommands ? Object.keys(availableCommands).map(c => (
                            <option key={c} value={c}>{c}</option>
                        )) : <option value="">No commands</option>}
                    </select>
                </div>

                {/* Arguments Input */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Arguments (JSON Array)</label>
                    <input
                        type="text"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-md px-2 py-1.5 text-sm font-mono"
                        value={argsInput}
                        onChange={e => setArgsInput(e.target.value)}
                        placeholder="[]"
                    />
                </div>
            </div>

            <button
                onClick={handleExecute}
                disabled={executing || !selectedCommand}
                className="w-full py-2 mt-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition-colors"
            >
                {executing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Execute Command
            </button>
        </div>
    );
};
