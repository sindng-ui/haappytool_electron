import React, { useState, useCallback, useRef } from 'react';
import * as Lucide from 'lucide-react';

const { Upload, FileText, Smartphone, MapPin, Box, Activity, Wifi, Grid, List: ListIcon, Search, Sun, Zap, Tv, Speaker, Thermometer, Wind, Lock, Eye, Droplets } = Lucide;

interface STDevice {
    id: string;
    name: string;
    state?: string;
    health?: 'ONLINE' | 'OFFLINE';
    displayType?: string;
    iconUrl?: string;
    description?: string;
}

interface STRoom {
    id: string;
    name: string;
    devices: STDevice[];
}

interface STLocation {
    id: string;
    name: string;
    rooms: STRoom[];
}

import { useTextSelectionMenu } from './LogArchive/hooks/useTextSelectionMenu';

const ReverseEngineer: React.FC = () => {
    const { handleContextMenu, ContextMenuComponent } = useTextSelectionMenu();
    const [dragActive, setDragActive] = useState(false);
    const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'COMPLETED'>('IDLE');
    const [locations, setLocations] = useState<STLocation[]>([]);
    const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
    const [fileName, setFileName] = useState('');
    const [processedLines, setProcessedLines] = useState(0);
    const [totalLines, setTotalLines] = useState(0);

    const dragCounter = useRef(0);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === 'dragenter') {
            dragCounter.current += 1;
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            dragCounter.current -= 1;
            if (dragCounter.current === 0) {
                setDragActive(false);
            }
        } else if (e.type === 'dragover') {
            // Necessary to allow dropping
        }
    }, []);

    const parseLogFile = async (file: File) => {
        setStatus('PROCESSING');
        setFileName(file.name);
        setLocations([]);
        setProcessedLines(0);

        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const fileSize = file.size;
        let offset = 0;
        let leftover = '';

        // Temporary storage for parsing
        const locationMap = new Map<string, STLocation>();
        const deviceMap = new Map<string, STDevice & { roomId?: string, locationId?: string }>();

        // Mocking parser state - in reality we'd need complex regex state machines
        // We'll look for simple patterns for this MVP

        const reader = new FileReader();

        reader.onload = (e) => {
            const chunk = e.target?.result as string;
            if (!chunk) return;

            const text = leftover + chunk;
            const lines = text.split('\n');
            leftover = lines.pop() || ''; // Save incomplete line

            let localLinesProcessed = 0;

            for (const line of lines) {
                localLinesProcessed++;

                // Very basic heuristic parser for demo purposes
                // Real implementation would need specific log patterns provided by user
                if (line.includes('/ST_APP')) {
                    // Try to find JSON blobs which often contain sync data
                    try {
                        const jsonMatch = line.match(/\{.*\}/);
                        if (jsonMatch) {
                            const data = JSON.parse(jsonMatch[0]);

                            // Heuristic: Look for Location/Room/Device structures
                            // 1. Structure Sync
                            if (data.locations && Array.isArray(data.locations)) {
                                data.locations.forEach((loc: any) => {
                                    if (!locationMap.has(loc.locationId || loc.id)) {
                                        locationMap.set(loc.locationId || loc.id, {
                                            id: loc.locationId || loc.id,
                                            name: loc.name || 'Unknown Location',
                                            rooms: []
                                        });
                                    }

                                    if (loc.rooms) {
                                        loc.rooms.forEach((room: any) => {
                                            // Find existing loc
                                            const l = locationMap.get(loc.locationId || loc.id);
                                            if (l && !l.rooms.find(r => r.id === room.id)) {
                                                l.rooms.push({
                                                    id: room.id || room.roomId,
                                                    name: room.name || 'Unknown Room',
                                                    devices: []
                                                });
                                            }
                                        });
                                    }
                                });
                            }

                            // 2. Device List
                            if (data.devices && Array.isArray(data.devices)) {
                                data.devices.forEach((dev: any) => {
                                    deviceMap.set(dev.deviceId || dev.id, {
                                        id: dev.deviceId || dev.id,
                                        name: dev.label || dev.name || 'Unknown Device',
                                        state: dev.state || 'Unknown',
                                        health: dev.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
                                        displayType: dev.displayType,
                                        iconUrl: (dev.icon && typeof dev.icon === 'string' && dev.icon.startsWith('http')) ? dev.icon : undefined,
                                        roomId: dev.roomId,
                                        locationId: dev.locationId
                                    });
                                });
                            }
                        }
                    } catch (e) {
                        // Ignore JSON parse errors in logs
                    }
                }
            }

            setProcessedLines(prev => prev + localLinesProcessed);

            offset += CHUNK_SIZE;
            if (offset < fileSize) {
                readNextChunk();
            } else {
                finishParsing();
            }
        };

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            reader.readAsText(slice);
        };

        const finishParsing = () => {
            // Rehydrate hierarchy
            const finalLocations = Array.from(locationMap.values());

            // If no locations found but devices exist, create a default one
            if (finalLocations.length === 0 && deviceMap.size > 0) {
                finalLocations.push({
                    id: 'default',
                    name: 'Extracted Home',
                    rooms: []
                });
                locationMap.set('default', finalLocations[0]);
            }

            // Distribute devices
            deviceMap.forEach(dev => {
                let loc = locationMap.get(dev.locationId || '');
                if (!loc) loc = finalLocations[0]; // Fallback

                let room = loc.rooms.find(r => r.id === dev.roomId);
                if (!room) {
                    // Create unassigned room if needed
                    let unassigned = loc.rooms.find(r => r.id === 'unassigned');
                    if (!unassigned) {
                        unassigned = { id: 'unassigned', name: 'Unassigned Devices', devices: [] };
                        loc.rooms.push(unassigned);
                    }
                    room = unassigned;
                }

                room.devices.push(dev);
            });

            setLocations(finalLocations);
            setTotalLines(prev => prev); // Trigger update
            setStatus('COMPLETED');
        };

        // Start reading
        readNextChunk();
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        dragCounter.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            parseLogFile(e.dataTransfer.files[0]);
        }
    }, []);

    return (
        <div
            className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 transition-colors duration-300 relative"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onContextMenu={(e) => handleContextMenu(e, { sourceFile: 'ReverseEngineer' })}
        >
            {/* Header */}
            <div className="h-14 border-b border-indigo-500/30 bg-[#0f172a] flex items-center px-6 pr-36 justify-between shrink-0 z-10 relative title-drag">
                <div className="flex items-center gap-3 no-drag">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <Smartphone className="text-indigo-400" size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-100">Reverse Engineer</span>
                        <span className="text-[10px] text-slate-500">Log to Structure Converter</span>
                    </div>
                </div>

                {status === 'COMPLETED' && (
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 no-drag">
                        <button onClick={() => setViewMode('CARD')} className={`p-1.5 rounded-md transition-all ${viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-400'}`}>
                            <Grid size={16} />
                        </button>
                        <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-400'}`}>
                            <ListIcon size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Drag Overlay */}
            {dragActive && (
                <div className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm flex items-center justify-center border-4 border-indigo-500 border-dashed m-4 rounded-3xl pointer-events-none">
                    <div className="flex flex-col items-center gap-4 bg-slate-900/80 p-8 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <Upload size={48} className="text-indigo-400 animate-bounce" />
                        <span className="text-xl font-bold text-white">Release to analyze log</span>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden relative z-0">
                {status === 'IDLE' && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        <div
                            className={`group flex flex-col items-center gap-4 p-12 rounded-3xl border-2 border-dashed border-slate-700/50 bg-slate-900/20 transition-all duration-300 hover:bg-slate-800/40 hover:border-indigo-500/50 hover:scale-[1.02] cursor-pointer
                            `}
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) parseLogFile(file);
                                };
                                input.click();
                            }}
                        >
                            <div className="p-4 rounded-2xl bg-slate-800/50 group-hover:bg-indigo-500/20 transition-colors shadow-xl">
                                <Upload size={32} className="text-slate-500 group-hover:text-indigo-400 transition-colors icon-glow" />
                            </div>
                            <div className="text-center space-y-1">
                                <span className="text-sm font-bold text-slate-300 group-hover:text-indigo-200 transition-colors block">
                                    Click to browse log file
                                </span>
                                <span className="text-xs text-slate-500 group-hover:text-indigo-400/70 transition-colors block">
                                    or drag and drop anywhere
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'PROCESSING' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50">
                        <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Analyzing Log Structure...</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{fileName}</p>
                        <p className="text-xs text-slate-400 mt-1 font-mono">{processedLines.toLocaleString()} lines processed</p>
                    </div>
                )}

                {status === 'COMPLETED' && (
                    <div className="h-full overflow-y-auto custom-scrollbar p-6">
                        {locations.map(loc => (
                            <div key={loc.id} className="mb-8 last:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                                    <MapPin className="text-indigo-500" size={24} />
                                    <div>
                                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">{loc.name}</h2>
                                        <p className="text-xs text-slate-400 font-mono tracking-wide">ID: {loc.id}</p>
                                    </div>
                                    <div className="ml-auto px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-500">
                                        {loc.rooms.reduce((acc, r) => acc + r.devices.length, 0)} Devices
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {loc.rooms.map(room => (
                                        <div key={room.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Box size={16} className="text-slate-400" />
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{room.name}</span>
                                                </div>
                                                <span className="text-xs text-slate-400 font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{room.id}</span>
                                            </div>

                                            <div className="p-6">
                                                {viewMode === 'CARD' ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                        {room.devices.map(dev => (
                                                            <div className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg hover:border-indigo-500/30 transition-all duration-300">
                                                                <div className="flex items-start justify-between mb-3">
                                                                    <div className={`p-2 rounded-lg flex items-center justify-center w-10 h-10 ${dev.health === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                                        {dev.iconUrl ? (
                                                                            <img
                                                                                src={dev.iconUrl}
                                                                                alt=""
                                                                                className="w-full h-full object-contain drop-shadow-sm"
                                                                                onError={(e) => {
                                                                                    e.currentTarget.style.display = 'none';
                                                                                    // Show fallback icon sibling
                                                                                    const parent = e.currentTarget.parentElement;
                                                                                    if (parent) {
                                                                                        const fallback = parent.querySelector('.fallback-icon');
                                                                                        if (fallback) fallback.classList.remove('hidden');
                                                                                    }
                                                                                }}
                                                                            />
                                                                        ) : null}

                                                                        {/* Fallback Icon (Hidden if image loads, shown if no image or error) */}
                                                                        <div className={`fallback-icon ${dev.iconUrl ? 'hidden' : ''}`}>
                                                                            {(() => {
                                                                                const n = (dev.name || '').toLowerCase();
                                                                                const t = (dev.displayType || '').toLowerCase();
                                                                                let Icon = Box;
                                                                                if (t.includes('light') || n.includes('light') || n.includes('bulb')) Icon = Sun;
                                                                                else if (t.includes('switch') || t.includes('outlet') || t.includes('plug')) Icon = Zap;
                                                                                else if (t.includes('tv')) Icon = Tv;
                                                                                else if (t.includes('speaker') || t.includes('audio') || t.includes('sound')) Icon = Speaker;
                                                                                else if (t.includes('thermostat') || t.includes('temp') || n.includes('temp')) Icon = Thermometer;
                                                                                else if (t.includes('fan') || t.includes('air') || t.includes('wind')) Icon = Wind;
                                                                                else if (t.includes('lock') || n.includes('lock')) Icon = Lock;
                                                                                else if (t.includes('camera') || n.includes('cam')) Icon = Eye;
                                                                                else if (t.includes('water') || t.includes('leak') || n.includes('water')) Icon = Droplets;
                                                                                else if (t.includes('sensor') || n.includes('sensor')) Icon = Activity;
                                                                                else if (t.includes('hub') || n.includes('hub')) Icon = Wifi;

                                                                                return <Icon size={20} />;
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                    <div className={`w-2 h-2 rounded-full ${dev.health === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                                </div>

                                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate mb-1" title={dev.name}>{dev.name}</h4>
                                                                <div className="text-[10px] text-slate-400 font-mono mb-3 truncate">{dev.id}</div>

                                                                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                                                        {dev.displayType || 'Device'}
                                                                    </span>
                                                                    {dev.state && (
                                                                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded text-[10px] font-medium text-indigo-600 dark:text-indigo-300 truncate max-w-[80px]">
                                                                            {dev.state}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {room.devices.length === 0 && (
                                                            <div className="col-span-full py-8 text-center text-slate-400 text-sm italic border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                                                No devices found in this room
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                                                                <tr>
                                                                    <th className="px-4 py-3 rounded-l-lg">Status</th>
                                                                    <th className="px-4 py-3">Name</th>
                                                                    <th className="px-4 py-3">ID</th>
                                                                    <th className="px-4 py-3">Type</th>
                                                                    <th className="px-4 py-3 rounded-r-lg">Details</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {room.devices.map(dev => (
                                                                    <tr key={dev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                                        <td className="px-4 py-3">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${dev.health === 'ONLINE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                                                                                }`}>
                                                                                {dev.health || 'UNKNOWN'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{dev.name}</td>
                                                                        <td className="px-4 py-3 font-mono text-xs text-slate-500 select-all">{dev.id}</td>
                                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{dev.displayType || '-'}</td>
                                                                        <td className="px-4 py-3 text-slate-500">{dev.state}</td>
                                                                    </tr>
                                                                ))}
                                                                {room.devices.length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                                                            No devices
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {loc.rooms.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-900/30 rounded-2xl">
                                            No rooms detected
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {locations.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p className="text-lg font-medium">No recognizable structure found</p>
                                <p className="text-sm opacity-60">Try checking if the log contains /ST_APP tags with hierarchy data.</p>
                                <button
                                    onClick={() => setStatus('IDLE')}
                                    className="mt-6 text-indigo-500 hover:text-indigo-400 text-sm font-bold"
                                >
                                    Try Another File
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {ContextMenuComponent}
        </div>
    );
};

export default ReverseEngineer;
