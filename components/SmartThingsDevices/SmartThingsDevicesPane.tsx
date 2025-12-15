
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

const { Smartphone, MapPin, Box, Wifi, AlertCircle, Loader2 } = Lucide;

interface Device {
    deviceId: string;
    name: string;
    label?: string; // Sometimes label is used for user-given name
    locationId: string;
    roomId: string;
    components?: any[];
}

interface Room {
    roomId: string; // Since we don't fetch rooms API, we might not have room Name, but request implies grouping by roomId. 
    // Wait, the user specifically says "location -> room -> device의 계층구조".
    // Without fetching /rooms, we only have roomId. I will just use roomId as the key/label for now.
    devices: Device[];
}

interface Location {
    locationId: string;
    rooms: Record<string, Room>; // Map roomId -> Room
}

type ServerType = 'stacceptance' | 'smartthings';

const SmartThingsDevicesPane: React.FC = () => {
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem('st_access_token') || '');
    const [serverType, setServerType] = useState<ServerType>('smartthings'); // Default to PROD (smartthings)

    // Save token when changed
    React.useEffect(() => {
        localStorage.setItem('st_access_token', accessToken);
    }, [accessToken]);
    const [isLoading, setIsLoading] = useState(false);
    const [groupedData, setGroupedData] = useState<Record<string, Location> | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFetch = async () => {
        if (!accessToken) {
            setError('Please enter an Access Token.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGroupedData(null);

        try {
            const url = `https://client.${serverType}.com/v1/devices?includeAllowedActions=true&includeHealth=true&includeGroups=true&includeStatus=true`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Request failed: ${response.status} ${response.statusText}`);
            }

            const json = await response.json();
            const devices: Device[] = json.items || []; // API usually returns { items: [] }

            // Process Data
            const locations: Record<string, Location> = {};

            devices.forEach(device => {
                const locId = device.locationId || 'Unknown Location';
                const roomId = device.roomId || 'Unassigned';

                if (!locations[locId]) {
                    locations[locId] = { locationId: locId, rooms: {} };
                }

                if (!locations[locId].rooms[roomId]) {
                    locations[locId].rooms[roomId] = { roomId, devices: [] };
                }

                locations[locId].rooms[roomId].devices.push(device);
            });

            setGroupedData(locations);

        } catch (err: any) {
            setError(err.message || 'Unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
            {/* Consistent System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 border-b border-indigo-500/30 bg-slate-950">
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Smartphone size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200 no-drag">SmartThings Devices</span>
            </div>

            {/* Control Panel */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10">

                <div className="flex flex-col gap-4">
                    {/* Access Token Input */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Token</label>
                        <input
                            type="password"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="Enter your Access Token"
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                        />
                    </div>

                    {/* Server Type Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Server Environment</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="radio"
                                    name="serverType"
                                    value="stacceptance"
                                    checked={serverType === 'stacceptance'}
                                    onChange={() => setServerType('stacceptance')}
                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                />
                                <span className="text-sm font-medium group-hover:text-indigo-500 transition-colors">Acceptance </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="radio"
                                    name="serverType"
                                    value="smartthings"
                                    checked={serverType === 'smartthings'}
                                    onChange={() => setServerType('smartthings')}
                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                />
                                <span className="text-sm font-medium group-hover:text-indigo-500 transition-colors">Product </span>
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleFetch}
                        disabled={isLoading}
                        className={`mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition-all ${isLoading
                            ? 'bg-indigo-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                        {isLoading ? 'Fetching Devices...' : 'Fetch Devices'}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3 mb-4 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-bold text-sm">Error Fetching Data</p>
                            <p className="text-xs mt-1 opacity-90">{error}</p>
                        </div>
                    </div>
                )}

                {!groupedData && !isLoading && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 opacity-60">
                        <Box className="w-16 h-16 mb-2" strokeWidth={1} />
                        <p className="text-sm font-medium">Ready to fetch devices</p>
                    </div>
                )}

                {groupedData && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {Object.values(groupedData).map((location) => (
                            <div key={location.locationId} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-500" />
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Location: {location.locationId}</span>
                                </div>
                                <div className="p-4 space-y-4">
                                    {Object.values(location.rooms).map((room) => (
                                        <div key={room.roomId} className="pl-4 border-l-2 border-indigo-100 dark:border-slate-700">
                                            <div className="mb-2 flex items-center gap-2">
                                                <Box className="w-3 h-3 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                    Room: {room.roomId === 'Unassigned' ? 'Unassigned' : room.roomId}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                                                {room.devices.map((device) => (
                                                    <div key={device.deviceId} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group cursor-default">
                                                        <div className="flex items-start justify-between mb-1">
                                                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate pr-2 group-hover:text-indigo-500 transition-colors" title={device.name}>
                                                                {device.label || device.name}
                                                            </span>
                                                            <div className={`w-2 h-2 rounded-full ${device.components ? 'bg-green-400' : 'bg-slate-300'}`}></div>
                                                        </div>
                                                        <div className="text-[10px] font-mono text-slate-400 break-all">
                                                            ID: {device.deviceId}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-1 truncate">
                                                            Name: {device.name}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartThingsDevicesPane;
