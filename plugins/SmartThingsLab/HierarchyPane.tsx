import React, { useState } from 'react';
import { ChevronRight, ChevronDown, MapPin, Box, Smartphone, Search } from 'lucide-react';
import { STLocation, STRoom, STDevice } from './types';

interface HierarchyPaneProps {
    locations: STLocation[];
    rooms: STRoom[];
    devices: STDevice[];
    onSelect: (item: STLocation | STRoom | STDevice, type: 'LOCATION' | 'ROOM' | 'DEVICE') => void;
    selectedId?: string;
}

export const HierarchyPane: React.FC<HierarchyPaneProps> = ({ locations, rooms, devices, onSelect, selectedId }) => {
    // Map data for easier access
    const [expandedLocs, setExpandedLocs] = useState<Set<string>>(new Set());
    const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const toggleLoc = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedLocs);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedLocs(newSet);
    };

    const toggleRoom = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedRooms);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRooms(newSet);
    };

    // Filter Logic
    const filteredDevices = devices.filter(d => d.label?.toLowerCase().includes(searchTerm.toLowerCase()) || d.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Grouping
    const roomsByLoc = locations.reduce((acc, loc) => {
        acc[loc.locationId] = rooms.filter(r => r.locationId === loc.locationId);
        return acc;
    }, {} as Record<string, STRoom[]>);

    const devicesByRoom = rooms.reduce((acc, room) => {
        acc[room.roomId] = filteredDevices.filter(d => d.roomId === room.roomId);
        return acc;
    }, {} as Record<string, STDevice[]>);

    const unassignedDevices = filteredDevices.filter(d => !d.roomId);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            {/* Search Bar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="relative">
                    <Search className="absolute left-2 top-2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search devices..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border-none rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto p-2">
                {locations.map(loc => {
                    const locRooms = roomsByLoc[loc.locationId] || [];
                    const isExpanded = expandedLocs.has(loc.locationId) || searchTerm.length > 0;

                    // Filter out locations with no matching items if searching? 
                    // For simplicity, keeping structure.

                    return (
                        <div key={loc.locationId} className="mb-2">
                            <div
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedId === loc.locationId ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                                onClick={() => onSelect(loc, 'LOCATION')}
                            >
                                <button onClick={(e) => toggleLoc(loc.locationId, e)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <MapPin size={16} className="text-gray-400" />
                                <span className="text-sm truncate select-none">{loc.name}</span>
                            </div>

                            {isExpanded && (
                                <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 mt-1 space-y-1">
                                    {locRooms.map(room => {
                                        const roomDevices = devicesByRoom[room.roomId] || [];
                                        const isRoomExpanded = expandedRooms.has(room.roomId) || searchTerm.length > 0;

                                        return (
                                            <div key={room.roomId}>
                                                <div
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedId === room.roomId ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
                                                    onClick={() => onSelect(room, 'ROOM')}
                                                >
                                                    <button onClick={(e) => toggleRoom(room.roomId, e)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400">
                                                        {isRoomExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                    <Box size={14} />
                                                    <span className="text-sm truncate select-none">{room.name}</span>
                                                </div>

                                                {isRoomExpanded && (
                                                    <div className="ml-5 mt-1 space-y-0.5">
                                                        {roomDevices.map(device => (
                                                            <div
                                                                key={device.deviceId}
                                                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedId === device.deviceId ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-500'}`}
                                                                onClick={() => onSelect(device, 'DEVICE')}
                                                            >
                                                                <Smartphone size={14} />
                                                                <span className="text-sm truncate select-none">{device.label || device.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
