import React, { useEffect, useState, useMemo } from 'react';
import { useHappyTool } from '../../contexts/HappyToolContext';
import { useRequestRunner } from '../../hooks/useRequestRunner';
import { Folder, MapPin, Smartphone, Server, Play, ChevronRight, ChevronDown, Activity, Info } from 'lucide-react';
import { SavedRequest } from '../../types';

// Constants for Default IDs to prevent duplicates
const EP_GROUP_ID = 'easy-post-defaults-group';
const REQ_LOCATIONS = 'ep-get-locations';
const REQ_ROOMS = 'ep-get-rooms';
const REQ_DEVICES = 'ep-get-devices';
const REQ_LOC_SUMMARY = 'ep-get-loc-summary';
const REQ_DEVICE_STATUS = 'ep-get-device-status';

interface LocationData {
    locationId: string;
    name: string;
    rooms: RoomData[];
    devices: DeviceData[];
    summary?: any;
    isExpanded?: boolean;
    loadingSummary?: boolean;
}

interface RoomData {
    roomId: string;
    locationId: string;
    name: string;
    devices: DeviceData[];
}

interface DeviceData {
    deviceId: string;
    label: string;
    locationId: string;
    roomId?: string;
    components?: any[];
    capabilities?: any[]; // From main list if available
    isExpanded?: boolean;
    status?: any; // Loaded on demand
    loadingStatus?: boolean;
}

const EasyPostPlugin: React.FC = () => {
    const {
        savedRequests,
        setSavedRequests,
        savedRequestGroups,
        setSavedRequestGroups,
        envProfiles,
        activeEnvId,
        postGlobalAuth,
        postGlobalVariables
    } = useHappyTool();

    const { executeRequest } = useRequestRunner();
    const [isLoading, setIsLoading] = useState(false);
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [executionLog, setExecutionLog] = useState<string[]>([]);

    // --- Seeding Logic ---
    useEffect(() => {
        let needsUpdate = false;
        let newRequests = [...savedRequests];
        let newGroups = [...savedRequestGroups];

        // 1. Ensure Group Exists
        if (!newGroups.find(g => g.id === EP_GROUP_ID)) {
            newGroups.push({ id: EP_GROUP_ID, name: 'Easy Post Defaults', collapsed: false });
            needsUpdate = true;
        }

        // 2. Ensure Requests Exist
        const defaults: SavedRequest[] = [
            {
                id: REQ_LOCATIONS,
                name: 'Get Locations',
                method: 'GET',
                url: 'https://api.smartthings.com/v1/locations',
                headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }], // Fallback if global auth off? User said use Global Auth.
                body: '',
                groupId: EP_GROUP_ID
            },
            {
                id: REQ_ROOMS,
                name: 'Get Rooms',
                method: 'GET',
                url: 'https://api.smartthings.com/v1/locations/{{locationId}}/rooms',
                headers: [],
                body: '',
                groupId: EP_GROUP_ID
            },
            {
                id: REQ_DEVICES,
                name: 'Get Devices',
                method: 'GET',
                url: 'https://api.smartthings.com/v1/devices',
                headers: [],
                body: '',
                groupId: EP_GROUP_ID
            },
            {
                id: REQ_LOC_SUMMARY,
                name: 'Get Location Summary',
                method: 'GET',
                url: 'https://api.smartthings.com/v1/locations/{{locationId}}',
                headers: [],
                body: '',
                groupId: EP_GROUP_ID
            },
            {
                id: REQ_DEVICE_STATUS,
                name: 'Get Device Status',
                method: 'GET',
                url: 'https://api.smartthings.com/v1/devices/{{deviceId}}/status',
                headers: [],
                body: '',
                groupId: EP_GROUP_ID
            }
        ];

        defaults.forEach(def => {
            if (!newRequests.find(r => r.id === def.id)) {
                newRequests.push(def);
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            if (newGroups.length !== savedRequestGroups.length) setSavedRequestGroups(newGroups);
            setSavedRequests(newRequests);
            console.log('Easy Post Defaults Seeded');
        }
    }, [savedRequests, savedRequestGroups]); // Run once mostly, or when they change (safe check)

    const runnerOptions = useMemo(() => ({
        savedRequests,
        envProfiles,
        activeEnvId,
        globalAuth: postGlobalAuth,
        globalVariables: postGlobalVariables,
        window: window as any
    }), [savedRequests, envProfiles, activeEnvId, postGlobalAuth, postGlobalVariables]);

    const addToLog = (msg: string) => setExecutionLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const handleLoadData = async () => {
        setIsLoading(true);
        setLocations([]);
        setExecutionLog([]);
        addToLog('Starting Data Load...');

        try {
            // 1. Get Locations
            const reqLoc = savedRequests.find(r => r.id === REQ_LOCATIONS);
            if (!reqLoc) throw new Error('Get Locations request not found');
            addToLog('Fetching Locations...');
            const resLoc = await executeRequest(reqLoc, runnerOptions);
            if (resLoc.status >= 300) throw new Error(`Failed to fetch locations: ${resLoc.status}`);

            const locData = resLoc.data?.items || [];
            addToLog(`Found ${locData.length} locations`);

            // 2. Get Devices
            const reqDev = savedRequests.find(r => r.id === REQ_DEVICES);
            if (!reqDev) throw new Error('Get Devices request not found');
            addToLog('Fetching Devices...');
            const resDev = await executeRequest(reqDev, runnerOptions);
            const devData = resDev.data?.items || []; // Usually { items: [] }
            addToLog(`Found ${devData.length} devices`);

            // 3. Process each location to get Rooms
            const reqRooms = savedRequests.find(r => r.id === REQ_ROOMS);
            if (!reqRooms) throw new Error('Get Rooms request not found');

            const processedLocations: LocationData[] = [];

            for (const loc of locData) {
                addToLog(`Fetching Rooms for ${loc.name}...`);
                // Inject locationId
                const resRooms = await executeRequest(reqRooms, runnerOptions, { locationId: loc.locationId });
                const roomsData = resRooms.data?.items || [];

                // Map Devices to Rooms
                const locDevices = devData.filter((d: any) => d.locationId === loc.locationId)
                    .map((d: any) => ({
                        ...d,
                        components: d.components || [], // Ensure components exist
                        capabilities: d.components?.flatMap((c: any) => c.capabilities) || [] // Flatten caps
                    }));

                const rooms: RoomData[] = roomsData.map((room: any) => ({
                    roomId: room.roomId,
                    locationId: loc.locationId,
                    name: room.name,
                    devices: locDevices.filter((d: any) => d.roomId === room.roomId)
                }));

                // Devices without room (or unassigned)
                const unassignedDevices = locDevices.filter((d: any) => !d.roomId || !roomsData.find((r: any) => r.roomId === d.roomId));

                // Add a "Unassigned" room if needed or just put at top level?
                // User said "Location -> Room -> Device".
                if (unassignedDevices.length > 0) {
                    rooms.push({
                        roomId: 'unassigned',
                        locationId: loc.locationId,
                        name: 'Unassigned',
                        devices: unassignedDevices
                    });
                }

                processedLocations.push({
                    locationId: loc.locationId,
                    name: loc.name,
                    rooms,
                    devices: locDevices, // All devices ref
                    isExpanded: true
                });
            }

            setLocations(processedLocations);
            addToLog('Data Load Complete!');
        } catch (e: any) {
            console.error(e);
            addToLog(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGetSummary = async (loc: LocationData) => {
        const reqSum = savedRequests.find(r => r.id === REQ_LOC_SUMMARY);
        if (!reqSum) return;

        // Toggle load state locally? complex with array.
        // Let's just update ONE item.
        setLocations(prev => prev.map(l => l.locationId === loc.locationId ? { ...l, loadingSummary: true } : l));

        try {
            const res = await executeRequest(reqSum, runnerOptions, { locationId: loc.locationId });
            setLocations(prev => prev.map(l => l.locationId === loc.locationId ? { ...l, loadingSummary: false, summary: res.data } : l));
        } catch (e) {
            setLocations(prev => prev.map(l => l.locationId === loc.locationId ? { ...l, loadingSummary: false } : l));
        }
    };

    const toggleLocationExpand = (locId: string) => {
        setLocations(prev => prev.map(l => l.locationId === locId ? { ...l, isExpanded: !l.isExpanded } : l));
    };

    // Deep update helper to find and update a device across all locations/rooms
    const updateDevice = (deviceId: string, updater: (d: DeviceData) => DeviceData) => {
        setLocations(prev => prev.map(loc => ({
            ...loc,
            rooms: loc.rooms.map(room => ({
                ...room,
                devices: room.devices.map(dev => dev.deviceId === deviceId ? updater(dev) : dev)
            }))
        })));
    };

    const toggleDeviceExpand = (deviceId: string) => {
        updateDevice(deviceId, d => ({ ...d, isExpanded: !d.isExpanded }));
    };

    const handleGetDeviceStatus = async (device: DeviceData) => {
        const reqStatus = savedRequests.find(r => r.id === REQ_DEVICE_STATUS);
        if (!reqStatus) return;

        updateDevice(device.deviceId, d => ({ ...d, loadingStatus: true, isExpanded: true }));

        try {
            const res = await executeRequest(reqStatus, runnerOptions, { deviceId: device.deviceId });
            updateDevice(device.deviceId, d => ({ ...d, loadingStatus: false, status: res.data }));
        } catch (e) {
            updateDevice(device.deviceId, d => ({ ...d, loadingStatus: false }));
        }
    };

    const handleLoadFakeData = async () => {
        setIsLoading(true);
        setLocations([]);
        setExecutionLog([]);
        addToLog('Generating Mock Data...');

        // Fake Delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const mockLocations: LocationData[] = [
            {
                locationId: 'loc-001-home',
                name: 'My Sweet Home',
                devices: [],
                isExpanded: true,
                rooms: [
                    {
                        roomId: 'room-101',
                        locationId: 'loc-001-home',
                        name: 'Living Room',
                        devices: [
                            {
                                deviceId: 'dev-001', locationId: 'loc-001-home', roomId: 'room-101', label: 'TV Samsung QLED',
                                components: [{ id: 'main', capabilities: [{ id: 'switch' }, { id: 'audioVolume' }] }],
                                status: { components: { main: { switch: { switch: { value: 'on' } }, audioVolume: { volume: { value: 25 } } } } }
                            },
                            {
                                deviceId: 'dev-002', locationId: 'loc-001-home', roomId: 'room-101', label: 'Air Conditioner',
                                components: [{ id: 'main', capabilities: [{ id: 'switch' }, { id: 'thermostatCoolingSetpoint' }] }]
                            },
                            { deviceId: 'dev-003', locationId: 'loc-001-home', roomId: 'room-101', label: 'Robot Vacuum' },
                        ]
                    },
                    {
                        roomId: 'room-102',
                        locationId: 'loc-001-home',
                        name: 'Kitchen',
                        devices: [
                            { deviceId: 'dev-004', locationId: 'loc-001-home', roomId: 'room-102', label: 'Refrigerator' },
                            { deviceId: 'dev-005', locationId: 'loc-001-home', roomId: 'room-102', label: 'Dishwasher' },
                        ]
                    }
                ],
                summary: {
                    weather: { temp: 22, condition: 'Sunny' },
                    geo: { lat: 37.5665, lng: 126.9780 },
                    mode: 'Home'
                }
            },
            {
                locationId: 'loc-002-office',
                name: 'Headquarters',
                devices: [],
                isExpanded: false,
                rooms: [
                    {
                        roomId: 'room-201',
                        locationId: 'loc-002-office',
                        name: 'Meeting Room A',
                        devices: [
                            { deviceId: 'dev-006', locationId: 'loc-002-office', roomId: 'room-201', label: 'Projector' },
                            { deviceId: 'dev-007', locationId: 'loc-002-office', roomId: 'room-201', label: 'Smart Light' },
                        ]
                    },
                    {
                        roomId: 'unassigned', // Explicit Unassigned
                        locationId: 'loc-002-office',
                        name: 'Unassigned',
                        devices: [
                            { deviceId: 'dev-008', locationId: 'loc-002-office', roomId: undefined, label: 'Lobby Sensor' }
                        ]
                    }

                ]
            }
        ];

        setLocations(mockLocations);
        addToLog('Mock Data Loaded Successfully!');
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden">
            <header className="mb-6">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 mb-2">
                    Easy Post
                </h1>
                <p className="text-slate-500 text-sm">Simplified SmartThings Data Explorer</p>
            </header>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={handleLoadData}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 transition-all
                        ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95'}`}
                >
                    {isLoading ? <Activity className="animate-spin" /> : <Play fill="currentColor" />}
                    Load SmartThings Data
                </button>

                <button
                    onClick={handleLoadFakeData}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg shadow-emerald-500/20 transition-all
                        ${isLoading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-95'}`}
                >
                    <Server size={20} />
                    Load Fake Data
                </button>
            </div>

            {/* Log Area */}
            {executionLog.length > 0 && isLoading && (
                <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl font-mono text-xs text-slate-500 max-h-32 overflow-y-auto">
                    {executionLog.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                {locations.map(loc => (
                    <div key={loc.locationId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">

                        {/* Location Header */}
                        <div className="p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => toggleLocationExpand(loc.locationId)}>
                            <div className="flex items-center gap-3">
                                <MapPin className="text-indigo-500" size={20} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">{loc.name}</h3>
                                        <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-500 font-bold">
                                            {loc.rooms.length} Rooms • {loc.devices.length} Devices
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono">ID: {loc.locationId}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleGetSummary(loc); }}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 text-xs font-bold mr-2"
                                >
                                    {loc.loadingSummary ? 'Loading...' : 'Get Summary'}
                                </button>
                                {loc.isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                            </div>
                        </div>

                        {/* Location Body */}
                        {loc.isExpanded && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800/50">
                                {loc.summary && (
                                    <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-950 rounded-lg text-xs font-mono overflow-x-auto border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-2 mb-2 text-slate-500 font-bold uppercase tracking-wider">
                                            <Info size={12} /> Location Summary
                                        </div>
                                        <pre>{JSON.stringify(loc.summary, null, 2)}</pre>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {loc.rooms.map(room => (
                                        <div key={room.roomId} className="pl-4 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Folder size={16} className="text-amber-500" />
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-slate-600 dark:text-slate-300">{room.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 rounded-full">
                                                            {room.devices.length} Devices
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">ID: {room.roomId}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 pl-4">
                                                {room.devices.map(dev => (
                                                    <div key={dev.deviceId} className={`flex flex-col rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 transition-all ${dev.isExpanded ? 'ring-2 ring-indigo-500/20 shadow-md' : 'hover:border-indigo-500/30'}`}>

                                                        {/* Device Header */}
                                                        <div className="p-2 flex items-center gap-3 cursor-pointer" onClick={() => toggleDeviceExpand(dev.deviceId)}>
                                                            <Smartphone size={16} className={`shrink-0 ${dev.isExpanded ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{dev.label || 'Unnamed Device'}</div>
                                                                <div className="text-[10px] text-slate-400 font-mono truncate">ID: {dev.deviceId}</div>
                                                            </div>
                                                            {dev.isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                                        </div>

                                                        {/* Device Details */}
                                                        {dev.isExpanded && (
                                                            <div className="px-3 pb-3 pt-0 text-xs">
                                                                <div className="h-px bg-slate-200 dark:bg-slate-700/50 mb-2" />

                                                                {/* Components & Capabilities */}
                                                                {(dev.components && dev.components.length > 0) ? (
                                                                    <div className="mb-3 space-y-1">
                                                                        <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider flex justify-between items-center">
                                                                            <span>Info</span>
                                                                            <button onClick={(e) => { e.stopPropagation(); handleGetDeviceStatus(dev); }}
                                                                                className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded hover:bg-emerald-500/20 font-bold flex items-center gap-1">
                                                                                {dev.loadingStatus ? <Activity size={10} className="animate-spin" /> : 'Get Status'}
                                                                            </button>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-950 p-2 rounded">
                                                                            {dev.components.map((comp: any) => (
                                                                                <div key={comp.id} className="col-span-2">
                                                                                    <span className="text-indigo-400 font-bold">{comp.id}</span>
                                                                                    <div className="pl-2 border-l border-slate-300 dark:border-slate-700 ml-1">
                                                                                        {comp.capabilities?.map((cap: any) => (
                                                                                            <span key={cap.id} className="block text-slate-600 dark:text-slate-400">{cap.id}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ) : <div className="text-slate-400 italic mb-2">No component info</div>}

                                                                {/* Status View */}
                                                                {dev.status && (
                                                                    <div className="space-y-1">
                                                                        <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Current Status</div>
                                                                        <div className="bg-slate-900 text-emerald-400 p-2 rounded font-mono text-[10px] whitespace-pre-wrap overflow-x-auto max-h-40 custom-scrollbar">
                                                                            {JSON.stringify(dev.status, null, 2)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {room.devices.length === 0 && <div className="text-xs text-slate-400 italic">No devices</div>}
                                            </div>
                                        </div>
                                    ))}
                                    {loc.rooms.length === 0 && <div className="text-sm text-slate-500 italic pl-6">No rooms found</div>}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EasyPostPlugin;
