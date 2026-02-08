import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useHappyTool } from '../../contexts/HappyToolContext';
import { useRequestRunner } from '../../hooks/useRequestRunner';
import { Folder, MapPin, Smartphone, Server, Play, ChevronRight, ChevronDown, Activity, Info } from 'lucide-react';
import { SavedRequest } from '../../types';

const EP_GROUP_ID = 'easy-post-defaults-group';
const REQ_LOCATIONS = 'ep-get-locations';
const REQ_ROOMS = 'ep-get-rooms';
const REQ_DEVICES = 'ep-get-devices';
const REQ_LOC_SUMMARY = 'ep-get-loc-summary';
const REQ_DEVICE_STATUS = 'ep-get-device-status';
const REQ_DEVICE_CANVAS = 'ep-get-device-canvas';
const REQ_DEVICE_COMMAND = 'ep-send-device-command';

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
    isExpanded?: boolean;
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
    canvas?: any; // Loaded on demand
    loadingCanvas?: boolean;
    statusViewMode?: 'raw' | 'structured'; // Toggle between raw JSON and structured view
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

    // --- Seeding Logic (Performance Optimized) ---
    // ✅ FIX: Use useRef to prevent infinite loop and run only once
    const hasSeededRef = useRef(false);

    useEffect(() => {
        // Only run once on mount
        if (hasSeededRef.current) return;

        const groupExists = savedRequestGroups.find(g => g.id === EP_GROUP_ID);
        const allRequestsExist = [REQ_LOCATIONS, REQ_ROOMS, REQ_DEVICES, REQ_LOC_SUMMARY, REQ_DEVICE_STATUS]
            .every(reqId => savedRequests.find(r => r.id === reqId));

        // Early exit if already seeded
        if (groupExists && allRequestsExist) {
            hasSeededRef.current = true;
            return;
        }

        // Create defaults only if needed
        const defaults: SavedRequest[] = [
            {
                id: REQ_LOCATIONS,
                name: 'Get Locations',
                method: 'GET',
                url: 'https://api.smartthings.com/v1/locations',
                headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
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
                url: 'https://api.smartthings.com/v1/devices?includeAllowedActions=true&includeHealth=true&includeGroups=true&includeStatus=true',
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

        // Only update if necessary
        const missingRequests = defaults.filter(def => !savedRequests.find(r => r.id === def.id));

        if (missingRequests.length > 0) {
            setSavedRequests([...savedRequests, ...missingRequests]);
        }

        if (!groupExists) {
            setSavedRequestGroups([...savedRequestGroups, { id: EP_GROUP_ID, name: 'Easy Post Defaults', collapsed: false }]);
        }

        hasSeededRef.current = true;
        console.log('[EasyPost] ✅ Defaults seeded (one-time only)');
    }, []); // ✅ Empty dependency array - runs only once on mount

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
                    devices: locDevices.filter((d: any) => d.roomId === room.roomId),
                    isExpanded: true
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
                        devices: unassignedDevices,
                        isExpanded: true
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

    const toggleRoomExpand = (locationId: string, roomId: string) => {
        setLocations(prev => prev.map(loc =>
            loc.locationId === locationId
                ? {
                    ...loc,
                    rooms: loc.rooms.map(room =>
                        room.roomId === roomId
                            ? { ...room, isExpanded: !room.isExpanded }
                            : room
                    )
                }
                : loc
        ));
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

    const handleGetDeviceCanvas = async (device: DeviceData) => {
        // Temporary request for canvas
        const canvasReq: SavedRequest = {
            id: 'temp-canvas',
            name: 'Get Device Canvas',
            method: 'GET',
            url: `https://api.smartthings.com/v1/devices/${device.deviceId}/presentation`,
            headers: [],
            body: '',
        };

        updateDevice(device.deviceId, d => ({ ...d, loadingCanvas: true, isExpanded: true }));

        try {
            const res = await executeRequest(canvasReq, runnerOptions);
            updateDevice(device.deviceId, d => ({ ...d, loadingCanvas: false, canvas: res.data }));
            addToLog(`Canvas loaded for ${device.label}`);
        } catch (e: any) {
            updateDevice(device.deviceId, d => ({ ...d, loadingCanvas: false }));
            addToLog(`Canvas load failed: ${e.message}`);
        }
    };

    const handleSendCommand = async (device: DeviceData, capability: string, command: string, args: any[] = []) => {
        const cmdReq: SavedRequest = {
            id: 'temp-cmd',
            name: 'Send Device Command',
            method: 'POST',
            url: `https://api.smartthings.com/v1/devices/${device.deviceId}/commands`,
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
                commands: [{
                    component: 'main',
                    capability,
                    command,
                    arguments: args
                }]
            }),
        };

        try {
            await executeRequest(cmdReq, runnerOptions);
            addToLog(`✅ Command sent to ${device.label}: ${capability}.${command}`);
            // Refresh status after command
            setTimeout(() => handleGetDeviceStatus(device), 1000);
        } catch (e: any) {
            addToLog(`❌ Command failed: ${e.message}`);
        }
    };

    const toggleStatusViewMode = (deviceId: string) => {
        updateDevice(deviceId, d => ({
            ...d,
            statusViewMode: d.statusViewMode === 'structured' ? 'raw' : 'structured'
        }));
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
                        isExpanded: true,
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
                        isExpanded: true,
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
                        isExpanded: false,
                        devices: [
                            { deviceId: 'dev-006', locationId: 'loc-002-office', roomId: 'room-201', label: 'Projector' },
                            { deviceId: 'dev-007', locationId: 'loc-002-office', roomId: 'room-201', label: 'Smart Light' },
                        ]
                    },
                    {
                        roomId: 'unassigned', // Explicit Unassigned
                        locationId: 'loc-002-office',
                        name: 'Unassigned',
                        isExpanded: true,
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
                                            <div className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-lg transition-colors"
                                                onClick={() => toggleRoomExpand(loc.locationId, room.roomId)}>
                                                <Folder size={16} className="text-amber-500" />
                                                <div className="flex flex-col flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-slate-600 dark:text-slate-300">{room.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 rounded-full">
                                                            {room.devices.length} Devices
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">ID: {room.roomId}</span>
                                                </div>
                                                {room.isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                            </div>

                                            {room.isExpanded && (
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

                                                            {dev.isExpanded && (
                                                                <div className="px-3 pb-3 pt-0 text-xs">
                                                                    <div className="h-px bg-slate-200 dark:bg-slate-700/50 mb-2" />

                                                                    {/* Action Buttons */}
                                                                    <div className="mb-3 flex gap-2 flex-wrap">
                                                                        <button onClick={(e) => { e.stopPropagation(); handleGetDeviceStatus(dev); }}
                                                                            className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded hover:bg-emerald-500/20 font-bold flex items-center gap-1">
                                                                            {dev.loadingStatus ? <Activity size={10} className="animate-spin" /> : 'Get Status'}
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleGetDeviceCanvas(dev); }}
                                                                            className="text-[10px] bg-purple-500/10 text-purple-500 px-2 py-1 rounded hover:bg-purple-500/20 font-bold flex items-center gap-1">
                                                                            {dev.loadingCanvas ? <Activity size={10} className="animate-spin" /> : 'Get Canvas'}
                                                                        </button>
                                                                        {dev.status && (
                                                                            <button onClick={(e) => { e.stopPropagation(); toggleStatusViewMode(dev.deviceId); }}
                                                                                className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded hover:bg-indigo-500/20 font-bold">
                                                                                {dev.statusViewMode === 'structured' ? 'Raw View' : 'Structured View'}
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Components & Capabilities */}
                                                                    {(dev.components && dev.components.length > 0) ? (
                                                                        <div className="mb-3 space-y-1">
                                                                            <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Info</div>
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

                                                                    {/* Canvas View */}
                                                                    {dev.canvas && (
                                                                        <div className="mb-3 space-y-1">
                                                                            <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Device Canvas</div>
                                                                            <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto max-h-40 custom-scrollbar">
                                                                                <pre>{JSON.stringify(dev.canvas, null, 2)}</pre>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Status View */}
                                                                    {dev.status && (
                                                                        <div className="space-y-1">
                                                                            <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Current Status</div>

                                                                            {dev.statusViewMode === 'structured' ? (
                                                                                <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded space-y-2">
                                                                                    {dev.status.components && Object.entries(dev.status.components).map(([compId, compData]: [string, any]) => (
                                                                                        <div key={compId} className="border border-slate-200 dark:border-slate-700 rounded p-2">
                                                                                            <div className="text-[10px] font-bold text-indigo-500 mb-1">{compId}</div>
                                                                                            {Object.entries(compData).map(([capId, capData]: [string, any]) => (
                                                                                                <div key={capId} className="ml-2 mb-2">
                                                                                                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">{capId}</div>
                                                                                                    <div className="ml-2 space-y-1">
                                                                                                        {Object.entries(capData).map(([attrName, attrData]: [string, any]) => (
                                                                                                            <div key={attrName} className="flex items-center justify-between text-[10px]">
                                                                                                                <span className="text-slate-600 dark:text-slate-400">{attrName}:</span>
                                                                                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                                                                    {typeof attrData?.value !== 'undefined' ? String(attrData.value) : JSON.stringify(attrData)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    {/* Command Buttons */}
                                                                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                                                                        {capId === 'switch' && (
                                                                                                            <>
                                                                                                                <button
                                                                                                                    onClick={(e) => { e.stopPropagation(); handleSendCommand(dev, 'switch', 'on'); }}
                                                                                                                    className="text-[9px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded hover:bg-green-500/20 font-bold">
                                                                                                                    ON
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    onClick={(e) => { e.stopPropagation(); handleSendCommand(dev, 'switch', 'off'); }}
                                                                                                                    className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded hover:bg-red-500/20 font-bold">
                                                                                                                    OFF
                                                                                                                </button>
                                                                                                            </>
                                                                                                        )}
                                                                                                        {capId === 'audioVolume' && (
                                                                                                            <>
                                                                                                                <button
                                                                                                                    onClick={(e) => { e.stopPropagation(); handleSendCommand(dev, 'audioVolume', 'volumeUp'); }}
                                                                                                                    className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/20 font-bold">
                                                                                                                    Vol+
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    onClick={(e) => { e.stopPropagation(); handleSendCommand(dev, 'audioVolume', 'volumeDown'); }}
                                                                                                                    className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/20 font-bold">
                                                                                                                    Vol-
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    onClick={(e) => { e.stopPropagation(); handleSendCommand(dev, 'audioVolume', 'setVolume', [50]); }}
                                                                                                                    className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/20 font-bold">
                                                                                                                    Set 50%
                                                                                                                </button>
                                                                                                            </>
                                                                                                        )}
                                                                                                        {capId === 'refresh' && (
                                                                                                            <button
                                                                                                                onClick={(e) => { e.stopPropagation(); handleSendCommand(dev, 'refresh', 'refresh'); }}
                                                                                                                className="text-[9px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded hover:bg-cyan-500/20 font-bold">
                                                                                                                Refresh
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="bg-slate-900 text-emerald-400 p-2 rounded font-mono text-[10px] whitespace-pre-wrap overflow-x-auto max-h-40 custom-scrollbar">
                                                                                    {JSON.stringify(dev.status, null, 2)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {room.devices.length === 0 && <div className="text-xs text-slate-400 italic">No devices</div>}
                                                </div>
                                            )}
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
