import React, { useState, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { STDiscoveryData, STDevice, STRoom, STLocation, STNodeType } from '../../types';
import { STDeviceStatusSummary } from './useSmartThingsDiscover';

// ─── Device Type to Icon Helper ──────────────────────────────────────────────
export function getDeviceIcon(deviceTypeName?: string, label?: string): React.ElementType {
    const text = `${deviceTypeName ?? ''} ${label ?? ''}`.toLowerCase();

    if (text.includes('light') || text.includes('bulb') || text.includes('lamp') || text.includes('led')) {
        return Lucide.Lightbulb;
    }
    if (text.includes('plug') || text.includes('outlet') || text.includes('switch')) {
        return Lucide.Zap;
    }
    if (text.includes('lock') || text.includes('door')) {
        return Lucide.Lock;
    }
    if (text.includes('sensor') || text.includes('motion') || text.includes('temp') || text.includes('humidity')) {
        return Lucide.Thermometer;
    }
    if (text.includes('tv') || text.includes('media') || text.includes('speaker') || text.includes('audio')) {
        return Lucide.Tv;
    }
    if (text.includes('camera') || text.includes('cctv')) {
        return Lucide.Camera;
    }
    return Lucide.Cpu;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface SmartThingsTreeViewProps {
    data: STDiscoveryData;
    onSelectNode: (raw: any | null, type: STNodeType, id: string) => void;
    selectedNodeId?: string | null;
    deviceStatusMap?: Record<string, STDeviceStatusSummary>;
    onFetchDeviceStatus?: (deviceId: string) => void;
    searchQuery?: string;
}

// ─── Device Node Item ─────────────────────────────────────────────────────────
const DeviceItem: React.FC<{
    device: STDevice;
    onSelect: (raw: any, type: STNodeType, id: string) => void;
    isSelected: boolean;
    status?: STDeviceStatusSummary;
    onFetchStatus?: (deviceId: string) => void;
}> = React.memo(({ device, onSelect, isSelected, status, onFetchStatus }) => {
    const IconComponent = getDeviceIcon(device.deviceTypeName, device.label);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(device.raw, 'device', device.deviceId);
        if (onFetchStatus && !status) {
            onFetchStatus(device.deviceId);
        }
    };

    return (
        <div
            data-testid={`st-tree-device-${device.deviceId}`}
            onClick={handleClick}
            className={`flex items-center gap-2 py-1 px-2 rounded-md text-xs cursor-pointer transition-all ${
                isSelected
                    ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
        >
            <IconComponent size={12} className={isSelected ? 'text-indigo-400' : 'text-slate-400'} />
            <span className="truncate flex-1">{device.label}</span>

            {/* Health State Badge (ONLINE / OFFLINE / UNHEALTHY) */}
            {status?.healthState && (
                <span
                    data-testid={`st-health-${device.deviceId}`}
                    className={`flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border shadow-sm ${
                        status.healthState === 'ONLINE'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : status.healthState === 'OFFLINE'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                >
                    <span
                        className={`w-1.5 h-1.5 rounded-full ${
                            status.healthState === 'ONLINE'
                                ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse'
                                : status.healthState === 'OFFLINE'
                                ? 'bg-red-500'
                                : 'bg-amber-400'
                        }`}
                    />
                    {status.healthState}
                </span>
            )}

            {/* Quick View Status Badges */}
            {status?.loading && (
                <Lucide.Loader2 size={10} className="animate-spin text-indigo-400" />
            )}
            {!status?.loading && status?.switch && (
                <span
                    className={`text-[9px] font-extrabold uppercase px-1 py-0.2 rounded border ${
                        status.switch === 'on'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/30'
                    }`}
                >
                    {status.switch}
                </span>
            )}
            {!status?.loading && status?.temperature !== undefined && (
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {status.temperature}{status.unit || '°C'}
                </span>
            )}
            {!status?.loading && status?.motion && (
                <span
                    className={`text-[9px] font-extrabold uppercase px-1 py-0.2 rounded border ${
                        status.motion === 'active'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/30'
                    }`}
                >
                    {status.motion}
                </span>
            )}

            {device.deviceTypeName && !status?.healthState && !status?.switch && status?.temperature === undefined && (
                <span className="text-[9px] text-slate-500 font-mono truncate max-w-[70px]">
                    {device.deviceTypeName}
                </span>
            )}
        </div>
    );
});

// ─── Room Node Group ──────────────────────────────────────────────────────────
const RoomNode: React.FC<{
    room: STRoom;
    devices: STDevice[];
    onSelect: (raw: any, type: STNodeType, id: string) => void;
    selectedNodeId?: string | null;
    deviceStatusMap?: Record<string, STDeviceStatusSummary>;
    onFetchDeviceStatus?: (deviceId: string) => void;
    forceExpand?: boolean;
}> = React.memo(({ room, devices, onSelect, selectedNodeId, deviceStatusMap, onFetchDeviceStatus, forceExpand }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isSelected = selectedNodeId === room.roomId;
    const collapsed = forceExpand ? false : isCollapsed;

    return (
        <div className="ml-3 my-0.5 border-l border-slate-700/50 pl-2">
            {/* Room Header */}
            <div
                data-testid={`st-tree-room-${room.roomId}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(room.raw, 'room', room.roomId);
                }}
                className={`flex items-center justify-between py-1 px-2 rounded-md text-xs cursor-pointer transition-colors ${
                    isSelected
                        ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                        : 'text-slate-300 hover:bg-white/5'
                }`}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed((v) => !v);
                        }}
                        className="text-slate-500 hover:text-slate-300"
                    >
                        <Lucide.ChevronDown
                            size={12}
                            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
                        />
                    </button>
                    <Lucide.Home size={12} className="text-purple-400 shrink-0" />
                    <span className="font-semibold truncate">{room.name}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                    {devices.length}
                </span>
            </div>

            {/* Devices List */}
            {!collapsed && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-800 pl-1.5">
                    {devices.map((device) => (
                        <DeviceItem
                            key={device.deviceId}
                            device={device}
                            onSelect={onSelect}
                            isSelected={selectedNodeId === device.deviceId}
                            status={deviceStatusMap?.[device.deviceId]}
                            onFetchStatus={onFetchDeviceStatus}
                        />
                    ))}
                    {devices.length === 0 && (
                        <div className="text-[10px] text-slate-600 italic py-0.5 px-2">
                            No devices in room
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ─── Location Node Group ──────────────────────────────────────────────────────
const LocationNode: React.FC<{
    location: STLocation;
    rooms: STRoom[];
    devices: STDevice[];
    onSelect: (raw: any, type: STNodeType, id: string) => void;
    selectedNodeId?: string | null;
    deviceStatusMap?: Record<string, STDeviceStatusSummary>;
    onFetchDeviceStatus?: (deviceId: string) => void;
    forceExpand?: boolean;
}> = React.memo(({ location, rooms, devices, onSelect, selectedNodeId, deviceStatusMap, onFetchDeviceStatus, forceExpand }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isSelected = selectedNodeId === location.locationId;
    const collapsed = forceExpand ? false : isCollapsed;

    // Filter devices belonging directly to this location
    const locationDevices = devices.filter((d) => d.locationId === location.locationId);
    // Unassigned devices (no roomId or roomId not in rooms list)
    const roomIds = new Set(rooms.map((r) => r.roomId));
    const unassignedDevices = locationDevices.filter((d) => !d.roomId || !roomIds.has(d.roomId));

    return (
        <div className="my-1 border border-slate-700/40 rounded-lg bg-slate-900/60 overflow-hidden">
            {/* Location Header */}
            <div
                data-testid={`st-tree-location-${location.locationId}`}
                onClick={() => onSelect(location.raw, 'location', location.locationId)}
                className={`flex items-center justify-between py-1.5 px-2.5 cursor-pointer transition-colors ${
                    isSelected
                        ? 'bg-indigo-500/20 text-indigo-300 font-bold'
                        : 'hover:bg-white/5 text-slate-200'
                }`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed((v) => !v);
                        }}
                        className="text-slate-400 hover:text-slate-200"
                    >
                        <Lucide.ChevronDown
                            size={13}
                            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
                        />
                    </button>
                    <Lucide.MapPin size={13} className="text-indigo-400 shrink-0" />
                    <span className="font-bold text-xs truncate">{location.name}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                        {rooms.length} R / {locationDevices.length} D
                    </span>
                </div>
            </div>

            {/* Location Content */}
            {!collapsed && (
                <div className="p-1 space-y-1 bg-slate-950/40">
                    {/* Rooms */}
                    {rooms.map((room) => {
                        const roomDevices = locationDevices.filter((d) => d.roomId === room.roomId);
                        return (
                            <RoomNode
                                key={room.roomId}
                                room={room}
                                devices={roomDevices}
                                onSelect={onSelect}
                                selectedNodeId={selectedNodeId}
                                deviceStatusMap={deviceStatusMap}
                                onFetchDeviceStatus={onFetchDeviceStatus}
                                forceExpand={forceExpand}
                            />
                        );
                    })}

                    {/* Unassigned Devices */}
                    {unassignedDevices.length > 0 && (
                        <div className="ml-3 my-0.5 border-l border-amber-500/30 pl-2">
                            <div className="flex items-center gap-1.5 py-1 px-2 text-[11px] font-semibold text-amber-400/80">
                                <Lucide.HelpCircle size={11} />
                                Unassigned ({unassignedDevices.length})
                            </div>
                            <div className="ml-3 space-y-0.5 border-l border-slate-800 pl-1.5">
                                {unassignedDevices.map((device) => (
                                    <DeviceItem
                                        key={device.deviceId}
                                        device={device}
                                        onSelect={onSelect}
                                        isSelected={selectedNodeId === device.deviceId}
                                        status={deviceStatusMap?.[device.deviceId]}
                                        onFetchStatus={onFetchDeviceStatus}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────
const SmartThingsTreeView: React.FC<SmartThingsTreeViewProps> = ({
    data,
    onSelectNode,
    selectedNodeId,
    deviceStatusMap,
    onFetchDeviceStatus,
    searchQuery = '',
}) => {
    if (!data || data.locations.length === 0) {
        return (
            <div className="p-3 text-center text-xs text-slate-500 italic">
                No location data discovered yet.
            </div>
        );
    }

    const query = searchQuery.trim().toLowerCase();
    const isSearching = query.length > 0;

    // Filter devices matching query
    const filteredDevices = isSearching
        ? data.devices.filter(
              (d) =>
                  d.label.toLowerCase().includes(query) ||
                  (d.deviceTypeName && d.deviceTypeName.toLowerCase().includes(query)),
          )
        : data.devices;

    if (isSearching && filteredDevices.length === 0) {
        return (
            <div className="p-3 text-center text-xs text-slate-500 italic">
                No devices match "{searchQuery}"
            </div>
        );
    }

    return (
        <div data-testid="st-tree-view" className="mt-2 space-y-1.5">
            {data.locations.map((location) => {
                const locationRooms = data.rooms.filter((r) => r.locationId === location.locationId);
                return (
                    <LocationNode
                        key={location.locationId}
                        location={location}
                        rooms={locationRooms}
                        devices={filteredDevices}
                        onSelect={onSelectNode}
                        selectedNodeId={selectedNodeId}
                        deviceStatusMap={deviceStatusMap}
                        onFetchDeviceStatus={onFetchDeviceStatus}
                        forceExpand={isSearching}
                    />
                );
            })}
        </div>
    );
};

export default React.memo(SmartThingsTreeView);
