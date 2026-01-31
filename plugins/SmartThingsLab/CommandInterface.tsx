import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Send, Terminal, Play, AlertCircle, Loader2 } from 'lucide-react';
import { STDevice, STCommandRequest } from './types';
import { SmartThingsService } from './services/smartThingsService';

interface CommandInterfaceProps {
    device: STDevice;
    service: SmartThingsService;
    token: string;
    onLog: (entry: any) => void;
}

export const CommandInterface: React.FC<CommandInterfaceProps> = React.memo(({ device, service, token, onLog }) => {
    const [selectedComponent, setSelectedComponent] = useState<string>('main');
    const [selectedCapability, setSelectedCapability] = useState<string>('');
    const [selectedCommand, setSelectedCommand] = useState<string>('');
    const [argsInput, setArgsInput] = useState<string>('[]');
    const [argValues, setArgValues] = useState<any[]>([]);
    const [inputMode, setInputMode] = useState<'SMART' | 'RAW'>('SMART');

    const [capabilities, setCapabilities] = useState<{ id: string, version?: number }[]>([]);
    const [availableCommands, setAvailableCommands] = useState<Record<string, any> | null>(null);
    const [loadingCaps, setLoadingCaps] = useState(false);
    const [executing, setExecuting] = useState(false);

    // Reset state when device changes
    useEffect(() => {
        setArgsInput('[]');
        setSelectedComponent('main');
    }, [device.deviceId]);

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
    }, [selectedCapability, service, capabilities]);

    // Initialize argValues when command changes
    useEffect(() => {
        if (!selectedCommand || !availableCommands) {
            setArgValues([]);
            return;
        }
        const cmd = availableCommands[selectedCommand];
        if (cmd && cmd.arguments) {
            const initial = cmd.arguments.map((arg: any) => {
                if (arg.schema.enum) return arg.schema.enum[0];
                if (arg.schema.type === 'integer' || arg.schema.type === 'number') return arg.schema.min || 0;
                if (arg.schema.type === 'string') return '';
                return null;
            });
            setArgValues(initial);
        } else {
            setArgValues([]);
        }
    }, [selectedCommand, availableCommands]);

    // Update argsInput for CURL/CLI copy compatibility
    useEffect(() => {
        if (inputMode === 'SMART') {
            setArgsInput(JSON.stringify(argValues));
        }
    }, [argValues, inputMode]);

    const handleExecute = async () => {
        if (!selectedCommand) return;
        setExecuting(true);

        try {
            let finalArgs: any[] = [];
            if (inputMode === 'RAW') {
                try {
                    finalArgs = JSON.parse(argsInput);
                    if (!Array.isArray(finalArgs)) throw new Error("Args must be an array");
                } catch (e) {
                    onLog({ type: 'error', message: 'Invalid Arguments JSON', timestamp: new Date() });
                    setExecuting(false);
                    return;
                }
            } else {
                finalArgs = argValues;
            }

            const cmd: STCommandRequest = {
                component: selectedComponent,
                capability: selectedCapability,
                command: selectedCommand,
                arguments: finalArgs
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

    const formatJson = () => {
        try {
            const parsed = JSON.parse(argsInput);
            setArgsInput(JSON.stringify(parsed, null, 2));
        } catch (e) {
            alert('Invalid JSON');
        }
    };

    const applyTemplate = (type: 'ATTRIBUTE_VALUE_ARRAY' | 'OBJECT') => {
        if (type === 'ATTRIBUTE_VALUE_ARRAY') {
            setArgsInput(JSON.stringify(["attributeName", ["value"]], null, 2));
        } else {
            setArgsInput(JSON.stringify({ "key": "value" }, null, 2));
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

    const updateArgValue = (index: number, val: any) => {
        setArgValues(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
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
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-tight">Arguments</label>
                            <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md">
                                <button
                                    onClick={() => setInputMode('SMART')}
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${inputMode === 'SMART' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Smart Form
                                </button>
                                <button
                                    onClick={() => setInputMode('RAW')}
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${inputMode === 'RAW' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Raw JSON
                                </button>
                            </div>
                        </div>
                        {inputMode === 'RAW' && (
                            <div className="flex gap-2">
                                <button onClick={() => applyTemplate('ATTRIBUTE_VALUE_ARRAY')} className="text-[10px] text-indigo-500 hover:text-indigo-600 font-bold uppercase transition-colors">Template</button>
                                <button onClick={formatJson} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase transition-colors">Format</button>
                            </div>
                        )}
                    </div>

                    {inputMode === 'SMART' ? (
                        <div className="flex-1 overflow-y-auto space-y-3 p-1 custom-scrollbar">
                            {availableCommands && selectedCommand && availableCommands[selectedCommand]?.arguments?.length > 0 ? (
                                availableCommands[selectedCommand].arguments.map((arg: any, idx: number) => (
                                    <div key={idx} className="flex flex-col gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                {arg.name}
                                                {arg.optional && <span className="text-[10px] font-normal text-slate-400 italic">(optional)</span>}
                                            </label>
                                            <span className="text-[10px] font-mono text-slate-400 uppercase">{arg.schema.type}</span>
                                        </div>
                                        {arg.schema.enum ? (
                                            <select
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                value={argValues[idx] || ''}
                                                onChange={e => updateArgValue(idx, e.target.value)}
                                            >
                                                {arg.schema.enum.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : arg.schema.type === 'integer' || arg.schema.type === 'number' ? (
                                            <input
                                                type="number"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                                value={argValues[idx] || 0}
                                                min={arg.schema.min}
                                                max={arg.schema.max}
                                                onChange={e => updateArgValue(idx, Number(e.target.value))}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                                value={argValues[idx] || ''}
                                                onChange={e => updateArgValue(idx, e.target.value)}
                                                placeholder={arg.name}
                                            />
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic border-2 border-dashed border-slate-100 dark:border-slate-800/50 rounded-xl">
                                    {selectedCommand ? 'No arguments required' : 'Select a command'}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            <textarea
                                rows={4}
                                className="w-full flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all custom-scrollbar shrink-0"
                                value={argsInput}
                                onChange={e => setArgsInput(e.target.value)}
                                placeholder="[arg1, arg2, ...]"
                                spellCheck={false}
                            />
                            <p className="text-[10px] text-slate-400 mt-2">Must be a valid JSON Array. Example: <code>["myAttr", ["on"]]</code></p>
                        </div>
                    )}
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
});
