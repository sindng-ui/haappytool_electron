
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
    name?: string;
    // Wait, the user specifically says "location -> room -> device의 계층구조".
    // Without fetching /rooms, we only have roomId. I will just use roomId as the key/label for now.
    devices: Device[];
}

interface Location {
    locationId: string;
    name: string; // Fetched from location API
    rooms: Record<string, Room>; // Map roomId -> Room
}

type ServerType = 'stacceptance' | 'smartthings';
type ViewMode = 'CARD' | 'LIST' | 'GRAPH';

// Simple Vector Math
const vec = {
    add: (v1: { x: number, y: number }, v2: { x: number, y: number }) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1: { x: number, y: number }, v2: { x: number, y: number }) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    mult: (v: { x: number, y: number }, s: number) => ({ x: v.x * s, y: v.y * s }),
    len: (v: { x: number, y: number }) => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v: { x: number, y: number }) => { const l = Math.sqrt(v.x * v.x + v.y * v.y); return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l }; }
};

interface Node {
    id: string;
    type: 'LOCATION' | 'ROOM' | 'DEVICE';
    label: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    phase: number;
    speed: number;
}

interface Link {
    source: string;
    target: string;
}

const ForceGraphView: React.FC<{ data: Record<string, Location> }> = ({ data }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [nodes, setNodes] = React.useState<Node[]>([]);
    const [links, setLinks] = React.useState<Link[]>([]);

    // Drag state
    const isDragging = React.useRef(false);
    const draggedNodeId = React.useRef<string | null>(null);
    const lastMousePos = React.useRef({ x: 0, y: 0 });

    // Initialize Graph Data (Once)
    React.useEffect(() => {
        const newNodes: Node[] = [];
        const newLinks: Link[] = [];
        const width = canvasRef.current?.offsetWidth || 800;
        const height = canvasRef.current?.offsetHeight || 600;

        Object.values(data).forEach(loc => {
            // Location Node
            newNodes.push({
                id: loc.locationId,
                type: 'LOCATION',
                label: loc.name,
                x: Math.random() * width,
                y: Math.random() * height,
                vx: 0, vy: 0,
                radius: 15,
                color: '#6366f1', // Indigo 500
                phase: Math.random() * Math.PI * 2,
                speed: 0.002 + Math.random() * 0.004
            });

            Object.values(loc.rooms).forEach(room => {
                // Room Node - only if we have room info or devices
                const roomId = room.roomId;
                newNodes.push({
                    id: roomId,
                    type: 'ROOM',
                    label: room.name || 'Unassigned',
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: 0, vy: 0,
                    radius: 10,
                    color: '#10b981', // Emerald 500
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.005 + Math.random() * 0.005
                });

                // Link Loc -> Room
                newLinks.push({ source: loc.locationId, target: roomId });

                room.devices.forEach(dev => {
                    // Device Node
                    newNodes.push({
                        id: dev.deviceId,
                        type: 'DEVICE',
                        label: dev.label || dev.name,
                        x: Math.random() * width,
                        y: Math.random() * height,
                        vx: 0, vy: 0,
                        radius: 6,
                        color: '#f43f5e', // Rose 500
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.01 + Math.random() * 0.01
                    });

                    // Link Room -> Device
                    newLinks.push({ source: roomId, target: dev.deviceId });
                });
            });
        });

        // Dedup nodes if IDs conflict? (IDs should be unique across types usually, but let's assume they are unique enough)
        // If IDs are not unique between Location/Room/Device, collision might happen.
        // Assuming unique IDs.

        setNodes(newNodes);
        setLinks(newLinks);
    }, [data]);

    // Animation Loop
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            // Resize check
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
            const width = canvas.width;
            const height = canvas.height;

            // Physics Parameters
            const repulsion = 2000;
            const springLength = 80;
            const springStrength = 0.05;
            const damping = 0.90;
            const centerForce = 0.005;

            // Update Physics
            nodes.forEach(node => {
                // 1. Repulsion (simplified Coulomb)
                let fx = 0, fy = 0;
                nodes.forEach(other => {
                    if (node.id === other.id) return;
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const distSq = dx * dx + dy * dy || 1;
                    const force = repulsion / distSq;
                    const dist = Math.sqrt(distSq);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                });

                // 2. Links (Attraction)
                // Need to find connected nodes inefficiently here or pre-calc neighbors.
                // Optimizing: Iterate links instead.
            });

            // NOTE: Optimized Physics Loop
            // Apply Drag if active

            // Compute Forces
            // Reset forces for step
            const forces = nodes.map(() => ({ fx: 0, fy: 0 }));

            // Repulsion (N^2) - minimal for < 500 nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const distSq = dx * dx + dy * dy || 1;
                    const dist = Math.sqrt(distSq); // clamping could help stability
                    const force = repulsion / (distSq + 100);

                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    forces[i].fx += fx;
                    forces[i].fy += fy;
                    forces[j].fx -= fx;
                    forces[j].fy -= fy;
                }
            }

            // Attraction (Links)
            links.forEach(link => {
                const sIdx = nodes.findIndex(n => n.id === link.source);
                const tIdx = nodes.findIndex(n => n.id === link.target);
                if (sIdx === -1 || tIdx === -1) return;

                const source = nodes[sIdx];
                const target = nodes[tIdx];

                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const force = (dist - springLength) * springStrength;

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                forces[sIdx].fx += fx;
                forces[sIdx].fy += fy;
                forces[tIdx].fx -= fx;
                forces[tIdx].fy -= fy;
            });

            // Center Gravity & Update
            nodes.forEach((node, i) => {
                if (draggedNodeId.current === node.id) return; // Don't move dragged node by physics

                // Center Gravity
                const dx = (width / 2) - node.x;
                const dy = (height / 2) - node.y;
                forces[i].fx += dx * centerForce;
                forces[i].fy += dy * centerForce;

                // Apply velocity
                node.vx = (node.vx + forces[i].fx) * damping;
                node.vy = (node.vy + forces[i].fy) * damping;

                // Move
                node.x += node.vx;
                node.y += node.vy;

                // Floating "Breathing" Effect (Sine Wave)
                // We add a small velocity based on time to simulate 'floating' in water/space
                const time = Date.now();
                const floatX = Math.sin(time * node.speed + node.phase) * 0.05;
                const floatY = Math.cos(time * node.speed + node.phase) * 0.05;

                node.x += floatX;
                node.y += floatY;

                // Bounds Check (soft)
                // if (node.x < 0) node.x = 0;
                // if (node.y < 0) node.y = 0;
                // if (node.x > width) node.x = width;
                // if (node.y > height) node.y = height;
            });

            // Draw
            ctx.clearRect(0, 0, width, height);

            // Draw Links
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'; // slate-500/30
            ctx.lineWidth = 1;
            links.forEach(link => {
                const s = nodes.find(n => n.id === link.source);
                const t = nodes.find(n => n.id === link.target);
                if (s && t) {
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(t.x, t.y);
                    ctx.stroke();
                }
            });

            // Draw Nodes
            nodes.forEach(node => {
                ctx.fillStyle = node.color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fill();

                // Label (only if Location or Room, or hovered - simulating simple always on for now)
                ctx.fillStyle = '#94a3b8'; // slate-400
                ctx.font = '10px monospace';
                ctx.fillText(node.label, node.x + node.radius + 2, node.y + 3);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [nodes, links]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Find clicked node
        // Reverse iterate to find top-most
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const dx = mouseX - node.x;
            const dy = mouseY - node.y;
            if (dx * dx + dy * dy <= node.radius * node.radius * 4) { // generous hit area
                draggedNodeId.current = node.id;
                isDragging.current = true;
                break;
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !draggedNodeId.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const node = nodes.find(n => n.id === draggedNodeId.current);
        if (node) {
            node.x = mouseX;
            node.y = mouseY;
            // Zero velocity while dragging
            node.vx = 0;
            node.vy = 0;
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        draggedNodeId.current = null;
    };

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full bg-slate-50 dark:bg-slate-900 cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
    );
};

// Helper for View Toggle
const ViewToggle = ({ mode, onChange }: { mode: ViewMode, onChange: (m: ViewMode) => void }) => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button onClick={() => onChange('CARD')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'CARD' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Card View</button>
        <button onClick={() => onChange('LIST')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'LIST' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>List View</button>
        <button onClick={() => onChange('GRAPH')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'GRAPH' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Graph View</button>
    </div>
);

const SmartThingsDevicesPane: React.FC = () => {
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem('st_access_token') || '');
    const [serverType, setServerType] = useState<ServerType>('smartthings');
    const [viewMode, setViewMode] = useState<ViewMode>('CARD');

    // Save token when changed
    React.useEffect(() => {
        localStorage.setItem('st_access_token', accessToken);
    }, [accessToken]);

    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [groupedData, setGroupedData] = useState<Record<string, Location> | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Expansion State
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string, force?: boolean) => {
        const newSet = new Set(expandedIds);
        if (force !== undefined) {
            if (force) newSet.add(id);
            else newSet.delete(id);
        } else {
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
        }
        setExpandedIds(newSet);
    };

    const expandAll = () => {
        if (!groupedData) return;
        const allIds = new Set<string>();
        Object.values(groupedData).forEach(loc => {
            allIds.add(loc.locationId);
            Object.values(loc.rooms).forEach(room => {
                allIds.add(room.roomId);
                room.devices.forEach(d => allIds.add(d.deviceId));
            });
        });
        setExpandedIds(allIds);
    };

    const collapseAll = () => setExpandedIds(new Set());

    const handleFetch = async () => {
        if (!accessToken) {
            setError('Please enter an Access Token.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGroupedData(null);
        setProgress('Starting...');

        const locationMap: Record<string, Location> = {};

        try {
            const getHeaders = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            };

            // 1. Fetch Locations
            setProgress('Fetching Locations...');
            const locRes = await fetch(`https://client.${serverType}.com/v1/locations`, { method: 'GET', headers: getHeaders });
            if (!locRes.ok) throw new Error(`Locations Request failed: ${locRes.status}`);
            const locJson = await locRes.json();
            const locItems: any[] = locJson.items || [];

            locItems.forEach(l => {
                locationMap[l.locationId] = { locationId: l.locationId, name: l.name || l.locationId, rooms: {} };
            });

            // 2. Fetch Rooms for EACH location
            setProgress('Fetching Rooms...');
            await Promise.all(Object.keys(locationMap).map(async (locId) => {
                try {
                    // Correct standard API endpoint for rooms is api.smartthings.com or client? Usually api.
                    // User specified: https://api.smartthings.com/v1/locations/{each_locaitonId}/rooms
                    // But for consistency we might use the client url based on serverType?
                    // User Request says: https://api.smartthings.com/v1/locations/...
                    // Let's deduce base url from serverType:
                    const baseUrl = serverType === 'stacceptance' ? 'https://api.stacceptance.com' : 'https://api.smartthings.com';

                    const roomRes = await fetch(`${baseUrl}/v1/locations/${locId}/rooms`, { method: 'GET', headers: getHeaders });
                    if (roomRes.ok) {
                        const roomJson = await roomRes.json();
                        const roomItems: any[] = roomJson.items || [];
                        roomItems.forEach(r => {
                            locationMap[locId].rooms[r.roomId] = { roomId: r.roomId, name: r.name, devices: [] } as any;
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to fetch rooms for location ${locId}`, e);
                }
            }));

            // 3. Fetch Devices
            setProgress('Fetching Devices...');
            const devUrl = `https://client.${serverType}.com/v1/devices?includeAllowedActions=true&includeHealth=true&includeGroups=true&includeStatus=true`;
            const devRes = await fetch(devUrl, { method: 'GET', headers: getHeaders });
            if (!devRes.ok) throw new Error(`Devices Request failed: ${devRes.status}`);
            const devJson = await devRes.json();

            const devices: Device[] = devJson.items || [];

            // 4. Distribute Devices
            devices.forEach(device => {
                const locId = device.locationId;
                const roomId = device.roomId;

                // Ensure location exists (fallback if device has unknown location)
                if (!locationMap[locId]) {
                    locationMap[locId] = { locationId: locId, name: 'Unknown Location', rooms: {} };
                }

                // Ensure room exists
                if (roomId) {
                    if (!locationMap[locId].rooms[roomId]) {
                        locationMap[locId].rooms[roomId] = { roomId, devices: [] } as any;
                    }
                    locationMap[locId].rooms[roomId].devices.push(device);
                } else {
                    // Unassigned Room
                    if (!locationMap[locId].rooms['Unassigned']) {
                        locationMap[locId].rooms['Unassigned'] = { roomId: 'Unassigned', devices: [] } as any;
                    }
                    locationMap[locId].rooms['Unassigned'].devices.push(device);
                }
            });

            setGroupedData(locationMap);

        } catch (err: any) {
            setError(err.message || 'Unknown error occurred.');
        } finally {
            setIsLoading(false);
            setProgress('');
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

                    {/* Server Type & Mode Selection */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Environment & View</label>
                        </div>
                        <div className="flex items-center justify-between">
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

                            <ViewToggle mode={viewMode} onChange={setViewMode} />
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
                        {isLoading ? `Fetching... ${progress}` : 'Fetch Devices'}
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

                {groupedData && viewMode === 'CARD' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {Object.values(groupedData).map((location) => (
                            <div key={location.locationId} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-500" />
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{location.name} <span className="text-slate-400 font-normal">({location.locationId})</span></span>
                                </div>
                                <div className="p-4 space-y-4">
                                    {Object.values(location.rooms).map((room: any) => (
                                        <div key={room.roomId} className="pl-4 border-l-2 border-indigo-100 dark:border-slate-700">
                                            <div className="mb-2 flex items-center gap-2">
                                                <Box className="w-3 h-3 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                    {room.name || 'Unassigned'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                                                {room.devices.map((device: Device) => (
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

                {groupedData && viewMode === 'LIST' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 mb-2">
                            <button onClick={expandAll} className="text-xs font-bold text-indigo-500 hover:text-indigo-400">Expand All</button>
                            <span className="text-slate-600">|</span>
                            <button onClick={collapseAll} className="text-xs font-bold text-slate-500 hover:text-slate-400">Collapse All</button>
                        </div>
                        {Object.values(groupedData).map(loc => {
                            const isLocExpanded = expandedIds.has(loc.locationId);
                            const roomCount = Object.keys(loc.rooms).length;

                            return (
                                <div key={loc.locationId} className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
                                    <div
                                        className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => toggleExpand(loc.locationId)}
                                    >
                                        <Lucide.ChevronRight size={16} className={`text-slate-400 transition-transform ${isLocExpanded ? 'rotate-90' : ''}`} />
                                        <MapPin size={16} className="text-indigo-500" />
                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{loc.name}</span>
                                        <span className="text-xs text-slate-400">({roomCount} Rooms)</span>
                                    </div>

                                    {isLocExpanded && (
                                        <div className="p-2 pl-8 flex flex-col gap-2 border-t border-slate-200 dark:border-slate-800">
                                            {Object.values(loc.rooms).map((room: any) => {
                                                const isRoomExpanded = expandedIds.has(room.roomId);
                                                const devCount = room.devices.length;

                                                return (
                                                    <div key={room.roomId} className="border border-slate-200 dark:border-slate-800/50 rounded bg-slate-50 dark:bg-slate-950/30">
                                                        <div
                                                            className="flex items-center gap-2 p-2 cursor-pointer hover:bg-white/5"
                                                            onClick={() => toggleExpand(room.roomId)}
                                                        >
                                                            <Lucide.ChevronRight size={14} className={`text-slate-400 transition-transform ${isRoomExpanded ? 'rotate-90' : ''}`} />
                                                            <Box size={14} className="text-slate-500" />
                                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{room.name || 'Unassigned'}</span>
                                                            <span className="text-xs text-slate-400">({devCount} Devices)</span>
                                                        </div>

                                                        {isRoomExpanded && (
                                                            <div className="p-2 pl-8 flex flex-col gap-1 border-t border-slate-200 dark:border-slate-800/50">
                                                                {room.devices.map((device: Device) => {
                                                                    const isDevExpanded = expandedIds.has(device.deviceId);
                                                                    return (
                                                                        <div key={device.deviceId} className="border-l-2 border-slate-200 dark:border-slate-800 pl-3 py-1">
                                                                            <div
                                                                                className="flex items-center gap-2 cursor-pointer group"
                                                                                onClick={() => toggleExpand(device.deviceId)}
                                                                            >
                                                                                <Lucide.ChevronRight size={12} className={`text-slate-500 transition-transform ${isDevExpanded ? 'rotate-90' : ''}`} />
                                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-400 transition-colors">{device.label || device.name}</span>
                                                                            </div>
                                                                            {isDevExpanded && (
                                                                                <div className="pl-5 mt-1 text-xs text-slate-500 font-mono select-text bg-slate-100 dark:bg-slate-900 p-2 rounded">
                                                                                    <div>ID: {device.deviceId}</div>
                                                                                    <div>Name: {device.name}</div>
                                                                                    <div>Label: {device.label}</div>
                                                                                    {device.components && <div>Components: {device.components.length}</div>}
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
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {groupedData && viewMode === 'GRAPH' && (
                    <div className="flex-1 w-full h-[800px] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner relative">
                        {/* Legend overlay */}
                        <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm pointer-events-none">
                            <div className="flex items-center gap-2 text-xs mb-1"><div className="w-2 h-2 rounded-full bg-[#6366f1]"></div><span className="text-slate-600 dark:text-slate-300">Location</span></div>
                            <div className="flex items-center gap-2 text-xs mb-1"><div className="w-2 h-2 rounded-full bg-[#10b981]"></div><span className="text-slate-600 dark:text-slate-300">Room</span></div>
                            <div className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full bg-[#f43f5e]"></div><span className="text-slate-600 dark:text-slate-300">Device</span></div>
                        </div>
                        <ForceGraphView data={groupedData} />
                    </div>
                )}

            </div>
        </div>
    );
};

export default SmartThingsDevicesPane;
