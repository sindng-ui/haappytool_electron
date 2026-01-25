import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useHappyTool } from '../../contexts/HappyToolContext';
import { SmartThingsService } from './services/smartThingsService';
import { SSEService } from './services/sseService';
import { HierarchyPane } from './HierarchyPane';
import { DeviceCard } from './DeviceCard';
import { CommandInterface } from './CommandInterface';
import { RawDataViewer } from './RawDataViewer';
import { CapabilityExplorer } from './CapabilityExplorer';
import { VirtualDeviceManager } from './VirtualDeviceManager';
import { LiveMonitor } from './LiveMonitor';
import { STLocation, STRoom, STDevice, STDeviceStatus, STCapability } from './types';
import * as Lucide from 'lucide-react';

const { Settings, RefreshCw, Activity, Terminal, Database, Smartphone, Zap, Wrench } = Lucide;

type SelectionType = 'LOCATION' | 'ROOM' | 'DEVICE';
type Tab = 'DATA' | 'EVENTS' | 'LOGS' | 'CAPABILITIES' | 'TOOLS' | 'MONITOR';

const SmartThingsLabPlugin: React.FC = () => {
    const { postGlobalAuth } = useHappyTool();
    const [token, setToken] = useState<string>('');

    // Services
    const service = useMemo(() => new SmartThingsService(token), [token]);
    const sse = useMemo(() => new SSEService(), []);

    // Data State
    const [locations, setLocations] = useState<STLocation[]>([]);
    const [rooms, setRooms] = useState<STRoom[]>([]);
    const [devices, setDevices] = useState<STDevice[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, STDeviceStatus>>({});
    const [healthMap, setHealthMap] = useState<Record<string, { state: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' }>>({});
    const [capabilitiesMap, setCapabilitiesMap] = useState<Record<string, STCapability[]>>({});

    // UI State
    const [selectedId, setSelectedId] = useState<string>('');
    const [selectionType, setSelectionType] = useState<SelectionType | null>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>('DATA');

    // SSE Filtering State
    const [eventFilter, setEventFilter] = useState('');

    // Logs & Events
    const [sseEvents, setSseEvents] = useState<any[]>([]);
    const [commandLogs, setCommandLogs] = useState<any[]>([]);
    const [sseUrl, setSseUrl] = useState<string>('https://sse.example.com/events');

    const [loading, setLoading] = useState(false);
    const [loadingCaps, setLoadingCaps] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize Token from Global Auth if available
    useEffect(() => {
        if (postGlobalAuth.enabled && postGlobalAuth.type === 'bearer' && postGlobalAuth.bearerToken) {
            setToken(postGlobalAuth.bearerToken);
        }
    }, [postGlobalAuth]);

    // Data Refresh
    const refreshData = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const locs = await service.getLocations();
            setLocations(locs);

            const allRooms: STRoom[] = [];
            for (const loc of locs) {
                try {
                    const r = await service.getRooms(loc.locationId);
                    allRooms.push(...r);
                } catch (e) {
                    console.warn(`Failed to fetch rooms for ${loc.locationId}`, e);
                }
            }
            setRooms(allRooms);

            const devs = await service.getDevices();
            setDevices(devs);

            // Fetch health for all items asynchronously
            devs.forEach(async d => {
                try {
                    const health = await service.getDeviceHealth(d.deviceId);
                    setHealthMap(prev => ({ ...prev, [d.deviceId]: health }));
                } catch (e) { }
            });

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh when token detected
    useEffect(() => {
        if (token && locations.length === 0) {
            refreshData();
        }
    }, [token]);

    const handleSelect = useCallback(async (item: any, type: SelectionType) => {
        setSelectionType(type);
        setSelectedItem(item);

        if (type === 'DEVICE') {
            const dev = item as STDevice;
            const deviceId = dev.deviceId;
            setSelectedId(deviceId);

            // Parallel Fetch
            try {
                const [stat, health] = await Promise.all([
                    service.getDeviceStatus(deviceId),
                    service.getDeviceHealth(deviceId)
                ]);
                setStatusMap(prev => ({ ...prev, [deviceId]: stat }));
                setHealthMap(prev => ({ ...prev, [deviceId]: health }));

                // Fetch Capabilities if not already in map
                if (!capabilitiesMap[deviceId]) {
                    setLoadingCaps(true);
                    const caps: STCapability[] = [];
                    const capRefs = dev.components?.flatMap(c => c.capabilities) || [];
                    for (const ref of capRefs) {
                        try {
                            const c = await service.getCapability(ref.id, ref.version || 1);
                            caps.push(c);
                        } catch (e) { }
                    }
                    setCapabilitiesMap(prev => ({ ...prev, [deviceId]: caps }));
                    setLoadingCaps(false);
                }
            } catch (e) {
                console.error("Failed to fetch device details", e);
            }
        } else if (type === 'LOCATION') {
            setSelectedId((item as STLocation).locationId);
        } else {
            setSelectedId((item as STRoom).roomId);
        }
    }, [service, capabilitiesMap]);

    const handleLog = useCallback((entry: any) => {
        setCommandLogs(prev => [entry, ...prev]);
    }, []);

    // SSE Handler
    const handleSSEMessage = (event: any) => {
        // Simple filtering logic if needed inside listener, but UI filter is more flexible
        setSseEvents(prev => [event, ...prev]);
        if (event.deviceId && statusMap[event.deviceId]) {
            service.getDeviceStatus(event.deviceId).then(stat => {
                setStatusMap(prev => ({ ...prev, [event.deviceId]: stat }));
            });
        }
    };

    const filteredSSE = useMemo(() => {
        if (!eventFilter) return sseEvents;
        const lower = eventFilter.toLowerCase();
        return sseEvents.filter(e =>
            JSON.stringify(e).toLowerCase().includes(lower)
        );
    }, [sseEvents, eventFilter]);

    const toggleSSE = () => {
        if (sseEvents.length > 0 && !sseUrl) {
            sse.disconnect();
            return;
        }
        sse.connect(sseUrl, token);
        sse.addListener('device-event', handleSSEMessage);
        sse.addListener('message', handleSSEMessage);
    };

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2">
                        <Smartphone size={18} className="text-indigo-500" />
                        ST Lab
                    </h2>
                    <button onClick={refreshData} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title="Refresh">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                {!token && (
                    <div className="p-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                        Authentication Token missing. Please set Bearer Token in Global Settings (Environment).
                    </div>
                )}

                {error && (
                    <div className="p-2 m-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded border border-red-200">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-hidden">
                    <HierarchyPane
                        locations={locations}
                        rooms={rooms}
                        devices={devices}
                        onSelect={handleSelect}
                        selectedId={selectedId}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
                    {selectedItem ? (
                        <>
                            {selectionType === 'DEVICE' && (
                                <div className="flex flex-col xl:flex-row gap-4">
                                    <DeviceCard
                                        device={selectedItem}
                                        status={statusMap[selectedItem.deviceId]}
                                        health={healthMap[selectedItem.deviceId]}
                                        token={token}
                                        onCommand={async (comp, cap, cmd, args) => {
                                            const req = { component: comp, capability: cap, command: cmd, arguments: args || [] };
                                            handleLog({ type: 'request', data: req, timestamp: new Date() });
                                            try {
                                                const res = await service.executeCommand(selectedItem.deviceId, [req]);
                                                handleLog({ type: 'response', data: res, timestamp: new Date() });
                                                // Refresh status after command
                                                const newStat = await service.getDeviceStatus(selectedItem.deviceId);
                                                setStatusMap(p => ({ ...p, [selectedItem.deviceId]: newStat }));
                                            } catch (e: any) {
                                                handleLog({ type: 'error', message: e.message, timestamp: new Date() });
                                            }
                                        }}
                                    />
                                    <div className="flex-1 min-w-[300px]">
                                        <CommandInterface
                                            device={selectedItem}
                                            service={service}
                                            token={token}
                                            onLog={handleLog}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 flex flex-col min-h-[500px]">
                                <div className="flex gap-1 mb-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                                    <TabButton active={activeTab === 'DATA'} onClick={() => setActiveTab('DATA')} icon={<Database size={14} />} label="Data" />
                                    <TabButton active={activeTab === 'CAPABILITIES'} onClick={() => setActiveTab('CAPABILITIES')} icon={<Zap size={14} />} label="Capabilities" />
                                    <TabButton active={activeTab === 'MONITOR'} onClick={() => setActiveTab('MONITOR')} icon={<Activity size={14} />} label="Monitor" />
                                    <TabButton active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS')} icon={<Terminal size={14} />} label="Logs" />
                                    <TabButton active={activeTab === 'EVENTS'} onClick={() => setActiveTab('EVENTS')} icon={<Activity size={14} />} label="SSE" />
                                    <TabButton active={activeTab === 'TOOLS'} onClick={() => setActiveTab('TOOLS')} icon={<Wrench size={14} />} label="Tools" />
                                </div>

                                <div className="flex-1 relative">
                                    {activeTab === 'DATA' && (
                                        <RawDataViewer
                                            data={selectionType === 'DEVICE' ? {
                                                info: selectedItem,
                                                status: statusMap[selectedItem.deviceId],
                                                health: healthMap[selectedItem.deviceId]
                                            } : selectedItem}
                                            title={selectionType ? `${selectionType} Raw JSON` : 'Raw Data'}
                                        />
                                    )}
                                    {activeTab === 'CAPABILITIES' && (
                                        <CapabilityExplorer
                                            capabilities={capabilitiesMap[selectedItem.deviceId] || []}
                                            loading={loadingCaps}
                                        />
                                    )}
                                    {activeTab === 'MONITOR' && selectionType === 'DEVICE' && (
                                        <LiveMonitor
                                            device={selectedItem}
                                            sseEvents={sseEvents}
                                        />
                                    )}
                                    {activeTab === 'LOGS' && (
                                        <RawDataViewer data={commandLogs} title="Command History" />
                                    )}
                                    {activeTab === 'EVENTS' && (
                                        <div className="h-full flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="SSE URL"
                                                    className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    value={sseUrl}
                                                    onChange={e => setSseUrl(e.target.value)}
                                                />
                                                <button
                                                    onClick={toggleSSE}
                                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold shadow-sm active:scale-95 transition-all outline-none"
                                                >
                                                    Connect
                                                </button>
                                                <input
                                                    type="text"
                                                    placeholder="Filter Events..."
                                                    className="w-48 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md"
                                                    value={eventFilter}
                                                    onChange={e => setEventFilter(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <RawDataViewer data={filteredSSE} title="Real-time Events Stream" />
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === 'TOOLS' && (
                                        <VirtualDeviceManager
                                            service={service}
                                            locations={locations}
                                            onRefresh={refreshData}
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <Smartphone size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
                            <p className="font-medium">Select a Location, Room, or Device to start debugging</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${active ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'}`}
    >
        {icon} {label}
    </button>
);

export default SmartThingsLabPlugin;
