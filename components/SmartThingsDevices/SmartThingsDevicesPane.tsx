
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import isoMapBg from '../../iso-map.png';

const { Smartphone, MapPin, Box, Wifi, AlertCircle, Loader2, Thermometer, Droplets, Wind, Sun, Cloud, Gauge, Play, Plus, Minus, RotateCcw, RotateCw } = Lucide;
import DeviceTile from '../SmartHomeDashboard/DeviceTile';
import '../SmartHomeDashboard/styles.css';

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
    name: string;
    rooms: Record<string, Room>;
    weather?: {
        temperature?: number;
        temperatureUnit?: string;
        humidity?: number;
        condition?: string;
    };
    airQuality?: {
        aqi?: number;
        rating?: string; // "Good", "Moderate", etc.
    };
}

type ServerType = 'stacceptance' | 'smartthings';
type ViewMode = 'CARD' | 'LIST' | 'GRAPH' | 'MAP';

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
    // Use refs for physics state to avoid re-renders during animation
    const nodesRef = React.useRef<Node[]>([]);
    const linksRef = React.useRef<Link[]>([]);

    // UI State
    const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
    const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);

    // Drag state
    const isDragging = React.useRef(false);
    const draggedNodeId = React.useRef<string | null>(null);
    const dragOffset = React.useRef({ x: 0, y: 0 });

    // Initialize Graph Data
    // Initialize Graph Data
    React.useEffect(() => {
        const newNodes: Node[] = [];
        const newLinks: Link[] = [];
        const width = canvasRef.current?.offsetWidth || 800;
        const height = canvasRef.current?.offsetHeight || 600;

        // Centralize initialization
        const cx = width / 2;
        const cy = height / 2;

        Object.values(data).forEach((loc, i, arr) => {
            // Location Node (Clusters)
            // Distribute locations in a circle initially
            const angle = (i / arr.length) * Math.PI * 2;
            const lx = cx + Math.cos(angle) * 150;
            const ly = cy + Math.sin(angle) * 150;

            newNodes.push({
                id: loc.locationId,
                type: 'LOCATION',
                label: loc.name,
                x: lx,
                y: ly,
                vx: 0, vy: 0,
                radius: 20, // Larger
                color: '#6366f1', // Indigo 500
                phase: Math.random() * Math.PI * 2,
                speed: 0.002
            });

            Object.values(loc.rooms).forEach((room, j, rArr) => {
                const roomId = room.roomId;
                // Place rooms near location
                const rAngle = angle + (j / rArr.length - 0.5);
                const rx = lx + Math.cos(rAngle) * 60;
                const ry = ly + Math.sin(rAngle) * 60;

                newNodes.push({
                    id: roomId,
                    type: 'ROOM',
                    label: room.name || 'Room',
                    x: rx,
                    y: ry,
                    vx: 0, vy: 0,
                    radius: 12,
                    color: '#10b981', // Emerald 500
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.005
                });

                newLinks.push({ source: loc.locationId, target: roomId });

                room.devices.forEach(dev => {
                    newNodes.push({
                        id: dev.deviceId,
                        type: 'DEVICE',
                        label: dev.label || dev.name,
                        // Place near Room instead of Location
                        x: rx + (Math.random() - 0.5) * 50,
                        y: ry + (Math.random() - 0.5) * 50,
                        vx: 0, vy: 0,
                        radius: 8,
                        color: '#f43f5e', // Rose 500
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.01
                    });
                    newLinks.push({ source: roomId, target: dev.deviceId });
                });
            });
        });

        // --- Warm Up Simulation ---
        // Run physics for N ticks to stabilize standard layout
        const warmUpTicks = 120;
        const nodeMap = new Map(newNodes.map((n, i) => [n.id, i]));

        // Physics Consts (Match Render Loop)
        const repulsion = 5000; // Updated to match render loop
        const springLength = 200; // Updated
        const springStrength = 0.015; // Updated for floaty feel
        const damping = 0.75; // Updated
        const centerForce = 0.005; // Slightly stronger centering during warm-up
        const REPULSION_DIST_CUTOFF = 1000; // Updated
        const REPULSION_DIST_SQ = REPULSION_DIST_CUTOFF * REPULSION_DIST_CUTOFF;

        for (let tick = 0; tick < warmUpTicks; tick++) {
            const forces = new Float32Array(newNodes.length * 2);

            // 1. Repulsion
            for (let i = 0; i < newNodes.length; i++) {
                for (let j = i + 1; j < newNodes.length; j++) {
                    const idx = i * 2;
                    const jdx = j * 2;
                    const dx = newNodes[i].x - newNodes[j].x;
                    if (Math.abs(dx) > REPULSION_DIST_CUTOFF) continue;
                    const dy = newNodes[i].y - newNodes[j].y;
                    if (Math.abs(dy) > REPULSION_DIST_CUTOFF) continue;
                    let distSq = dx * dx + dy * dy;
                    if (distSq > REPULSION_DIST_SQ) continue;
                    if (distSq === 0) distSq = 1;
                    const force = repulsion / distSq;
                    const dist = Math.sqrt(distSq);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    forces[idx] += fx;
                    forces[idx + 1] += fy;
                    forces[jdx] -= fx;
                    forces[jdx + 1] -= fy;
                }
            }

            // 2. Attraction
            newLinks.forEach(link => {
                const sIdx = nodeMap.get(link.source);
                const tIdx = nodeMap.get(link.target);
                if (sIdx === undefined || tIdx === undefined) return;
                const source = newNodes[sIdx];
                const target = newNodes[tIdx];
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - springLength) * springStrength;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                const si = sIdx * 2;
                const ti = tIdx * 2;
                forces[si] += fx;
                forces[si + 1] += fy;
                forces[ti] -= fx;
                forces[ti + 1] -= fy;
            });

            // 3. Apply
            for (let i = 0; i < newNodes.length; i++) {
                const node = newNodes[i];
                const fIdx = i * 2;
                const dx = cx - node.x;
                const dy = cy - node.y;
                forces[fIdx] += dx * centerForce;
                forces[fIdx + 1] += dy * centerForce;

                node.vx = (node.vx + forces[fIdx]) * damping;
                node.vy = (node.vy + forces[fIdx + 1]) * damping;
                node.x += node.vx;
                node.y += node.vy;
            }
        }

        nodesRef.current = newNodes;
        linksRef.current = newLinks;
    }, [data]);

    // Animation Loop
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optimization
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            if (!canvasRef.current) return;
            // Resize check
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
            const width = canvas.width;
            const height = canvas.height;
            const cx = width / 2;
            const cy = height / 2;

            // Clear Background
            ctx.fillStyle = localStorage.getItem('theme') === 'dark' ? '#0f172a' : '#f8fafc'; // slate-900 or slate-50
            ctx.fillRect(0, 0, width, height);

            const nodes = nodesRef.current;
            const links = linksRef.current;
            const activeFocus = focusedNodeId;

            // --- Physics Step ---
            // Constants - tuned for Obsidian-like feel (Spacious, floaty)
            const repulsion = 5000;
            const springLength = 200;
            const springStrength = 0.015;
            const damping = 0.75;
            const centerForce = 0.005; // Very weak center pull to allow sprawl

            // Optimization: Spatial Hashing or just basic cutoff
            // Simple Barnes-Hut approximation: If distance is large, treat as single interaction? 
            // Or just cutoff repulsion.
            const REPULSION_DIST_CUTOFF = 1000; // Large influence range
            const REPULSION_DIST_SQ = REPULSION_DIST_CUTOFF * REPULSION_DIST_CUTOFF;

            // Reset forces logic is embedded in loop for perf? No, standard accumulation.
            const forces = new Float32Array(nodes.length * 2); // [fx, fy, fx, fy...]

            // 1. Repulsion
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const idx = i * 2;
                    const jdx = j * 2;

                    const dx = nodes[i].x - nodes[j].x;
                    if (Math.abs(dx) > REPULSION_DIST_CUTOFF) continue; // Early X Cutoff

                    const dy = nodes[i].y - nodes[j].y;
                    if (Math.abs(dy) > REPULSION_DIST_CUTOFF) continue; // Early Y Cutoff

                    let distSq = dx * dx + dy * dy;
                    if (distSq > REPULSION_DIST_SQ) continue; // Distance Cutoff (Performance Key)
                    if (distSq === 0) distSq = 1;

                    const force = repulsion / distSq;
                    const dist = Math.sqrt(distSq);

                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    forces[idx] += fx;
                    forces[idx + 1] += fy;
                    forces[jdx] -= fx;
                    forces[jdx + 1] -= fy;
                }
            }

            // 2. Attraction (Springs)
            // Use index map for O(1) lookup
            const nodeMap = new Map(nodes.map((n, i) => [n.id, i]));

            links.forEach(link => {
                const sIdx = nodeMap.get(link.source);
                const tIdx = nodeMap.get(link.target);
                if (sIdx === undefined || tIdx === undefined) return;

                const source = nodes[sIdx];
                const target = nodes[tIdx];

                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const force = (dist - springLength) * springStrength;

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                const si = sIdx * 2;
                const ti = tIdx * 2;

                forces[si] += fx;
                forces[si + 1] += fy;
                forces[ti] -= fx;
                forces[ti + 1] -= fy;
            });

            // 3. Update Positions
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (draggedNodeId.current === node.id) {
                    // Dragging overrides physics
                    continue;
                }

                const fIdx = i * 2;

                // Center Gravity
                const dx = cx - node.x;
                const dy = cy - node.y;
                forces[fIdx] += dx * centerForce;
                forces[fIdx + 1] += dy * centerForce;

                // Apply with velocity limit
                node.vx = (node.vx + forces[fIdx]) * damping;
                node.vy = (node.vy + forces[fIdx + 1]) * damping;

                // Velocity cap to prevent "shattering" (Instability)
                const maxV = 10.0;
                const vSq = node.vx * node.vx + node.vy * node.vy;
                if (vSq > maxV * maxV) {
                    const vLen = Math.sqrt(vSq);
                    node.vx = (node.vx / vLen) * maxV;
                    node.vy = (node.vy / vLen) * maxV;
                }

                // Stop Micro-movements (Energy saver not strictly needed for perf, but looks stable)
                if (Math.abs(node.vx) < 0.01) node.vx = 0;
                if (Math.abs(node.vy) < 0.01) node.vy = 0;

                node.x += node.vx;
                node.y += node.vy;
            }

            // --- Rendering Step ---

            // Draw Links
            ctx.lineWidth = 1;
            links.forEach(link => {
                const s = nodes.find(n => n.id === link.source);
                const t = nodes.find(n => n.id === link.target);
                if (s && t) {
                    // Focus Mode Dimming
                    const isFocus = activeFocus ? (
                        link.source === activeFocus || link.target === activeFocus
                    ) : true;

                    ctx.strokeStyle = isFocus
                        ? (localStorage.getItem('theme') === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.4)')
                        : 'rgba(100, 100, 100, 0.05)';

                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(t.x, t.y);
                    ctx.stroke();
                }
            });

            // Draw Nodes
            nodes.forEach(node => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isFocused = activeFocus === node.id;

                // Focus Logic: If focus active, dim others unless connected
                let dim = false;
                if (activeFocus && node.id !== activeFocus) {
                    // Check connection
                    const isConnected = links.some(l =>
                        (l.source === activeFocus && l.target === node.id) ||
                        (l.source === node.id && l.target === activeFocus)
                    );
                    if (!isConnected) dim = true;
                }

                ctx.globalAlpha = dim ? 0.1 : 1.0;

                // Halo for selection
                if (isSelected || isFocused) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(99, 102, 241, 0.3)'; // Indigo glow
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();

                // Stroke for definition
                ctx.strokeStyle = localStorage.getItem('theme') === 'dark' ? '#1e293b' : '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.globalAlpha = 1.0; // Reset alpha for Text

                // Draw Label
                // Only draw if not dimmed, or is selected/hovered/focused or type is LOCATION (always show major nodes)
                if (!dim || isSelected || isHovered) {
                    const fontSize = (isSelected || isHovered || node.type === 'LOCATION') ? 14 : 12;
                    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                    const textPadding = 4;
                    const text = node.label;
                    const metrics = ctx.measureText(text);
                    const tx = node.x + node.radius + 6;
                    const ty = node.y + (fontSize / 3);

                    // Text Background (Visibility enhancement)
                    ctx.fillStyle = localStorage.getItem('theme') === 'dark' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)';
                    // Round rect approximation
                    ctx.fillRect(tx - 2, ty - fontSize + 2, metrics.width + 4, fontSize + 4);

                    ctx.fillStyle = localStorage.getItem('theme') === 'dark' ? '#e2e8f0' : '#1e293b';
                    ctx.fillText(text, tx, ty);
                }
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [selectedNode, focusedNodeId, hoveredNodeId]); // Re-bind render if selection state changes to ensure immediate update

    // --- Interaction Handlers ---

    const getNodeAtPos = (x: number, y: number) => {
        const nodes = nodesRef.current;
        // Search top-down
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const dx = x - node.x;
            const dy = y - node.y;
            // Hitbox slightly larger than visual radius
            if (dx * dx + dy * dy <= (node.radius + 5) * (node.radius + 5)) {
                return node;
            }
        }
        return null;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const node = getNodeAtPos(mouseX, mouseY);
        if (node) {
            draggedNodeId.current = node.id;
            isDragging.current = true;
            dragOffset.current = { x: mouseX - node.x, y: mouseY - node.y };
            setSelectedNode(node); // Click selects
        } else {
            // Clicked empty space
            setSelectedNode(null);
            setFocusedNodeId(null); // Clear focus
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isDragging.current && draggedNodeId.current) {
            // Fast lookup
            const node = nodesRef.current.find(n => n.id === draggedNodeId.current);
            if (node) {
                node.x = mouseX - dragOffset.current.x;
                node.y = mouseY - dragOffset.current.y;
                node.vx = 0; // Arrest momentum
                node.vy = 0;
            }
        } else {
            // Hover check
            const node = getNodeAtPos(mouseX, mouseY);
            if (node?.id !== hoveredNodeId) {
                setHoveredNodeId(node?.id || null);
                canvas.style.cursor = node ? 'pointer' : 'default';
            }
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        draggedNodeId.current = null;
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const node = getNodeAtPos(mouseX, mouseY);
        if (node) {
            // Toggle Focus Mode
            if (focusedNodeId === node.id) {
                setFocusedNodeId(null);
            } else {
                setFocusedNodeId(node.id);
            }
        } else {
            // Reset zoom/pan or focus if double click empty (optional)
            setFocusedNodeId(null);
        }
    };

    return (
        <div className="relative w-full h-full">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-default select-none block"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
            />

            {/* Context Overlay (Selected Node Info) */}
            {selectedNode && (
                <div className="absolute bottom-4 right-4 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className={`w-3 h-3 rounded-full ${selectedNode.type === 'LOCATION' ? 'bg-[#6366f1]' :
                            selectedNode.type === 'ROOM' ? 'bg-[#10b981]' : 'bg-[#f43f5e]'
                            }`}></div>
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{selectedNode.label}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <div>ID: <span className="text-slate-700 dark:text-slate-300 select-all">{selectedNode.id}</span></div>
                        <div>Type: <span className="text-slate-700 dark:text-slate-300">{selectedNode.type}</span></div>
                    </div>
                    <div className="mt-3 text-[10px] text-slate-400 italic">
                        Double-click to focus connections
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper for View Toggle (Unchanged)
const ViewToggle = ({ mode, onChange }: { mode: ViewMode, onChange: (m: ViewMode) => void }) => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button onClick={() => onChange('CARD')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'CARD' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Card View</button>
        <button onClick={() => onChange('LIST')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'LIST' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>List View</button>
        <button onClick={() => onChange('GRAPH')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'GRAPH' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Graph View</button>
        <button onClick={() => onChange('MAP')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'MAP' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Map View</button>
    </div>
);

const MapView: React.FC<{ data: Record<string, Location> }> = ({ data }) => {
    const [selectedDevice, setSelectedDevice] = useState<(Device & { roomName: string, locId: string }) | null>(null);

    // Zoom & Pan & Rotate State
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1, rotation: 0 });
    const isDragging = React.useRef(false);
    const lastMousePos = React.useRef({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        // Simple zoom
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(transform.scale * (1 + scaleAmount), 0.5), 5);
        setTransform(prev => ({ ...prev, scale: newScale }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleZoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }));
    const handleZoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.5) }));
    const handleRotateCw = () => setTransform(prev => ({ ...prev, rotation: prev.rotation + 90 }));
    const handleRotateCcw = () => setTransform(prev => ({ ...prev, rotation: prev.rotation - 90 }));
    const handleReset = () => setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });

    // Flatten devices with room info
    const allDevices = React.useMemo(() => {
        const devs: (Device & { roomName: string, locId: string })[] = [];
        Object.values(data).forEach(loc => {
            Object.values(loc.rooms).forEach(room => {
                room.devices.forEach(d => {
                    devs.push({ ...d, roomName: room.name || 'Unassigned', locId: loc.locationId });
                });
            });
        });
        return devs;
    }, [data]);

    // Use the first location for Weather/AQI display (Limit for single map view mostly)
    const primaryLocation = Object.values(data)[0];

    // Coordinate Mapping Logic (Percentage 0-100)
    // Map standard Korea apartment room names to the ISO image zones
    const getCoordinates = (roomName: string, index: number, totalInRoom: number) => {
        const r = roomName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Define Zones (Center % position) based on the image structure
        // Image structure assumption:
        // Top Left: Kitchen/Utility
        // Top Right: Master Bedroom
        // Center: Living Room
        // Bottom Left: Bedroom 2
        // Bottom Right: Bedroom 3 / Balcony

        let zone = { x: 50, y: 50, w: 20, h: 20 }; // Default Living Room

        if (r.includes('living') || r.includes('거실') || r.includes('main')) {
            zone = { x: 55, y: 55, w: 25, h: 25 };
        } else if (r.includes('kitchen') || r.includes('dining') || r.includes('주방') || r.includes('식당')) {
            zone = { x: 35, y: 35, w: 15, h: 15 }; // Upper Left ish
        } else if (r.includes('master') || r.includes('bed1') || r.includes('안방') || r.includes('침실1')) {
            zone = { x: 75, y: 40, w: 15, h: 20 }; // Top Right Room
        } else if (r.includes('bed2') || r.includes('침실2') || r.includes('공부') || r.includes('study')) {
            zone = { x: 30, y: 70, w: 15, h: 15 }; // Bottom Left Room
        } else if (r.includes('bed3') || r.includes('침실3') || r.includes('dress') || r.includes('옷방')) {
            zone = { x: 65, y: 75, w: 15, h: 15 }; // Bottom Right Room
        } else if (r.includes('bath') || r.includes('toilet') || r.includes('화장실') || r.includes('욕실')) {
            zone = { x: 50, y: 30, w: 10, h: 10 }; // Small area near top
        } else if (r.includes('balcony') || r.includes('veranda') || r.includes('베란다')) {
            zone = { x: 80, y: 60, w: 10, h: 30 }; // Right edge
        }

        // Scatter logic within zone to prevent stack
        // Simple grid layout within the zone
        // If 1 item -> center
        // If 4 items -> 2x2 grid
        const cols = Math.ceil(Math.sqrt(totalInRoom));
        const row = Math.floor(index / cols);
        const col = index % cols;

        // Offset from zone center
        const offsetX = (col - (cols - 1) / 2) * (zone.w / (cols || 1));
        const offsetY = (row - (cols - 1) / 2) * (zone.h / (cols || 1));

        return { x: zone.x + offsetX, y: zone.y + offsetY };
    };

    // Group devices by room to calculate indices
    const devicesByRoom = React.useMemo(() => {
        const map: Record<string, typeof allDevices> = {};
        allDevices.forEach(d => {
            const key = d.roomName + d.locId;
            if (!map[key]) map[key] = [];
            map[key].push(d);
        });
        return map;
    }, [allDevices]);

    return (
        <div
            className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center p-8 select-none cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Background Image Container with Aspect Ratio */}
            <div
                className="relative w-full max-w-[1200px] aspect-[4/3] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden group will-change-transform origin-center duration-300 transition-transform ease-out"
                style={{ transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${transform.scale})` }}
            >
                {/* Floor Plan Image */}
                <img
                    src={isoMapBg}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                    alt="Floor Plan"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />

                {/* Markers Overlay */}
                <div className="absolute inset-0">
                    {Object.values(devicesByRoom).map(roomDevs =>
                        roomDevs.map((dev, i) => {
                            const pos = getCoordinates(dev.roomName, i, roomDevs.length);
                            const isActive = selectedDevice?.deviceId === dev.deviceId;

                            // Marker Style
                            // Determine icon based on device type (name heuristic)
                            let Icon = Box;
                            let colorClass = "bg-indigo-500";
                            const n = dev.label?.toLowerCase() || dev.name.toLowerCase();
                            if (n.includes('light') || n.includes('bulb') || n.includes('lamp') || n.includes('전등') || n.includes('조명')) { Icon = Sun; colorClass = "bg-yellow-500"; }
                            else if (n.includes('tv') || n.includes('vision')) { Icon = Smartphone; colorClass = "bg-blue-500"; }
                            else if (n.includes('speaker') || n.includes('sound')) { Icon = Wifi; colorClass = "bg-purple-500"; }
                            else if (n.includes('air') || n.includes('purifier') || n.includes('공기')) { Icon = Wind; colorClass = "bg-cyan-500"; }
                            else if (n.includes('sensor') || n.includes('detect')) { Icon = AlertCircle; colorClass = "bg-rose-500"; }
                            else if (n.includes('hub') || n.includes('station')) { Icon = Box; colorClass = "bg-slate-600"; }

                            return (
                                <div
                                    key={dev.deviceId}
                                    className="absolute cursor-pointer z-10 hover:z-50 transition-all duration-300 ease-out will-change-transform"
                                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) rotate(${-transform.rotation}deg)` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDevice(dev);
                                    }}
                                >
                                    {/* Pin Effect */}
                                    <div className={`relative w-8 h-8 rounded-full shadow-lg border-2 border-white dark:border-slate-800 ${colorClass} flex items-center justify-center ${isActive ? 'ring-4 ring-white/50 scale-110' : ''} animate-in zoom-in duration-300`}>
                                        <Icon size={16} className="text-white drop-shadow-md" />

                                        {/* Label on Hover */}
                                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/marker:opacity-100 pointer-events-none transition-opacity">
                                            {dev.label || dev.name}
                                        </div>
                                    </div>
                                    {/* Pulse for active */}
                                    {isActive && <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${colorClass}`}></div>}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Weather Widget (Floating) */}
                {primaryLocation && (primaryLocation.weather || primaryLocation.airQuality) && (
                    <div className="absolute top-6 left-6 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl hover:bg-white/20 transition-all cursor-default group">
                        <div className="flex items-center gap-3 mb-3">
                            <MapPin className="text-white drop-shadow-md" size={18} />
                            <div>
                                <div className="text-white font-bold text-sm leading-none drop-shadow-sm">{primaryLocation.name}</div>
                                <div className="text-[10px] text-white/70">Home Environment</div>
                            </div>
                        </div>

                        <div className="flex gap-6">
                            {/* Weather */}
                            {primaryLocation.weather && (
                                <div className="flex items-center gap-3">
                                    <div className="bg-gradient-to-br from-yellow-300 to-orange-500 w-10 h-10 rounded-full flex items-center justify-center shadow-lg">
                                        {/* Icon based on condition */}
                                        {primaryLocation.weather.condition?.toLowerCase().includes('cloud') ? <Cloud className="text-white" size={20} /> : <Sun className="text-white" size={20} />}
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white leading-none drop-shadow-md">
                                            {Math.round(primaryLocation.weather.temperature || 0)}°
                                        </div>
                                        <div className="text-[10px] text-white/80 font-medium uppercase tracking-wide">
                                            {primaryLocation.weather.condition || 'Sunny'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Separator */}
                            <div className="w-px bg-white/20"></div>

                            {/* AQI */}
                            {primaryLocation.airQuality && (
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20 ${primaryLocation.airQuality.rating?.match(/good|best|좋음/i) ? 'bg-emerald-500' :
                                        primaryLocation.airQuality.rating?.match(/moderate|보통/i) ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}>
                                        <Gauge className="text-white" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-white leading-tight drop-shadow-md">
                                            {primaryLocation.airQuality.rating}
                                        </div>
                                        <div className="text-[10px] text-white/80 font-medium uppercase tracking-wide">
                                            Air Quality
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Zoom Controls */}
            <div className="absolute top-6 right-6 flex flex-col gap-2 z-50">
                <button onClick={handleZoomIn} className="p-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white rounded-lg shadow-lg border border-white/10 transition-all active:scale-95" title="Zoom In">
                    <Plus size={20} />
                </button>
                <button onClick={handleZoomOut} className="p-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white rounded-lg shadow-lg border border-white/10 transition-all active:scale-95" title="Zoom Out">
                    <Minus size={20} />
                </button>
                <button onClick={handleRotateCcw} className="p-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white rounded-lg shadow-lg border border-white/10 transition-all active:scale-95" title="Rotate Left">
                    <RotateCcw size={20} />
                </button>
                <button onClick={handleRotateCw} className="p-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white rounded-lg shadow-lg border border-white/10 transition-all active:scale-95" title="Rotate Right">
                    <RotateCw size={20} />
                </button>
                <button onClick={handleReset} className="p-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white-400 rounded-lg shadow-lg border border-white/10 transition-all active:scale-95" title="Reset View">
                    <Box size={20} />
                </button>
            </div>

            {/* Device Detail Card (Absolute Positioned outside the map, or bottom right) */}
            {selectedDevice && (
                <div className="absolute bottom-8 right-8 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 p-0 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-right-4 overflow-hidden z-50">
                    <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600 relative p-4 flex flex-col justify-end">
                        <div className="absolute top-3 right-3 text-white/80 bg-black/20 px-2 py-0.5 rounded-full text-[10px] font-mono backdrop-blur-sm">
                            {selectedDevice.roomName}
                        </div>
                        <h3 className="text-white font-bold text-lg drop-shadow-md truncate">{selectedDevice.label || selectedDevice.name}</h3>
                        <div className="text-white/80 text-xs font-mono">{selectedDevice.deviceId}</div>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                                <div className="text-[10px] text-slate-400 uppercase">Status</div>
                                <div className="text-sm font-bold text-emerald-500">Online</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                                <div className="text-[10px] text-slate-400 uppercase">Type</div>
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate px-1">{selectedDevice.name}</div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Capabilities</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedDevice.components && selectedDevice.components.map((c: any, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-[10px] rounded-md font-medium">
                                        {c.id || 'main'}
                                    </span>
                                ))}
                                {!selectedDevice.components && <span className="text-xs text-slate-400 italic">No details available</span>}
                            </div>
                        </div>

                        <button
                            className="w-full mt-2 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedDevice(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

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

            // 1.5 Fetch Summary (Weather/PQ) for EACH location
            setProgress('Fetching Weather & Air Quality...');
            await Promise.all(Object.keys(locationMap).map(async (locId) => {
                try {
                    // Use the same client base URL logic
                    const baseUrl = `https://client.${serverType}.com`;
                    const summaryRes = await fetch(`${baseUrl}/summary?locationId=${locId}`, {
                        method: 'GET',
                        headers: {
                            ...getHeaders,
                            'Accept-Language': 'ko' // User requested 'ko'
                        }
                    });

                    if (summaryRes.ok) {
                        const summaryData = await summaryRes.json();
                        // Assume structure based on typical summary APIs or user hint
                        // The user didn't specify exact JSON, but implied it's in the response.
                        // We'll look for common fields.
                        // Example: { weather: { temp: 20 }, airQuality: { ... } }
                        // Adapting to whatever common format exists or storing raw if unsure, but we need Typed UI.
                        // Let's optimisticly map what we find.

                        if (summaryData) {
                            // Map Weather
                            if (summaryData.weather) {
                                locationMap[locId].weather = {
                                    temperature: summaryData.weather.temperature,
                                    temperatureUnit: summaryData.weather.temperatureUnit || 'C',
                                    humidity: summaryData.weather.humidity,
                                    condition: summaryData.weather.condition // e.g. "Sunny"
                                };
                            }
                            // Map Air Quality
                            if (summaryData.airQuality) {
                                locationMap[locId].airQuality = {
                                    aqi: summaryData.airQuality.amount || summaryData.airQuality.index,
                                    rating: summaryData.airQuality.label || summaryData.airQuality.rating
                                };
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch summary for location ${locId}`, e);
                }
            }));

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

    const handleSimulation = () => {
        setIsLoading(true);
        setError(null);
        setGroupedData(null);
        setProgress('Generating Demo Data...');

        setTimeout(() => {
            const demoLocationId = 'loc_demo_001';
            const mockData: Record<string, Location> = {
                [demoLocationId]: {
                    locationId: demoLocationId,
                    name: 'My Sweet Home',
                    weather: {
                        temperature: 24.5,
                        temperatureUnit: 'C',
                        humidity: 45,
                        condition: 'Partly Cloudy'
                    },
                    airQuality: {
                        aqi: 35,
                        rating: 'Good'
                    },
                    rooms: {
                        'room_living': {
                            roomId: 'room_living',
                            name: 'Living Room',
                            devices: [
                                { deviceId: 'd_tv', name: 'Smart TV', label: 'Living Room TV', locationId: demoLocationId, roomId: 'room_living', components: [{ id: 'main' }] },
                                { deviceId: 'd_ac', name: 'Air Conditioner', label: 'Living Room AC', locationId: demoLocationId, roomId: 'room_living', components: [{ id: 'main' }] },
                                { deviceId: 'd_spk', name: 'Smart Speaker', label: 'Galaxy Home Mini', locationId: demoLocationId, roomId: 'room_living', components: [{ id: 'audio' }] },
                                { deviceId: 'd_light_main', name: 'Light', label: 'Main Light', locationId: demoLocationId, roomId: 'room_living', components: [{ id: 'switch' }] },
                                { deviceId: 'd_robot', name: 'Robot Cleaner', label: 'Jet Bot AI+', locationId: demoLocationId, roomId: 'room_living', components: [{ id: 'main' }] },
                            ]
                        },
                        'room_kitchen': {
                            roomId: 'room_kitchen',
                            name: 'Kitchen',
                            devices: [
                                { deviceId: 'd_ref', name: 'Refrigerator', label: 'Bespoke Fridge', locationId: demoLocationId, roomId: 'room_kitchen', components: [{ id: 'main' }, { id: 'cooler' }] },
                                { deviceId: 'd_dish', name: 'Dishwasher', label: 'Dishwasher', locationId: demoLocationId, roomId: 'room_kitchen', components: [{ id: 'main' }] },
                                { deviceId: 'd_oven', name: 'Oven', label: 'Smart Oven', locationId: demoLocationId, roomId: 'room_kitchen', components: [{ id: 'main' }] },
                                { deviceId: 'd_light_k', name: 'Light', label: 'Kitchen Light', locationId: demoLocationId, roomId: 'room_kitchen', components: [{ id: 'switch' }] },
                            ]
                        },
                        'room_master': {
                            roomId: 'room_master',
                            name: 'Master Bedroom',
                            devices: [
                                { deviceId: 'd_light_m', name: 'Light', label: 'Bedroom Light', locationId: demoLocationId, roomId: 'room_master', components: [{ id: 'switch' }] },
                                { deviceId: 'd_curtain', name: 'Window Shade', label: 'Smart Curtain', locationId: demoLocationId, roomId: 'room_master', components: [{ id: 'windowShade' }] },
                                { deviceId: 'd_purifier', name: 'Air Purifier', label: 'Bedroom Air Purifier', locationId: demoLocationId, roomId: 'room_master', components: [{ id: 'main' }] },
                            ]
                        },
                        'room_bed2': {
                            roomId: 'room_bed2',
                            name: 'Bedroom 2',
                            devices: [
                                { deviceId: 'd_lamp', name: 'Light', label: 'Desk Lamp', locationId: demoLocationId, roomId: 'room_bed2', components: [{ id: 'switch' }] },
                                { deviceId: 'd_pc', name: 'Switch', label: 'Gaming PC Plug', locationId: demoLocationId, roomId: 'room_bed2', components: [{ id: 'switch' }] },
                            ]
                        },
                        'room_bath': {
                            roomId: 'room_bath',
                            name: 'Bathroom',
                            devices: [
                                { deviceId: 'd_motion', name: 'Motion Sensor', label: 'Bath Motion', locationId: demoLocationId, roomId: 'room_bath', components: [{ id: 'motion' }] },
                            ]
                        },
                        'room_balcony': {
                            roomId: 'room_balcony',
                            name: 'Balcony',
                            devices: [
                                { deviceId: 'd_wash', name: 'Washer', label: 'Washing Machine', locationId: demoLocationId, roomId: 'room_balcony', components: [{ id: 'washer' }] },
                                { deviceId: 'd_dry', name: 'Dryer', label: 'Dryer', locationId: demoLocationId, roomId: 'room_balcony', components: [{ id: 'dryer' }] },
                            ]
                        }
                    }
                }
            };
            setGroupedData(mockData);
            setIsLoading(false);
            setViewMode('MAP'); // Automatically switch to Map View
        }, 800);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
            {/* Consistent System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 border-b border-indigo-500/30 bg-[#0f172a]">
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
                        className={`mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition-all flex-1 ${isLoading
                            ? 'bg-indigo-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                        {isLoading ? `Fetching... ${progress}` : 'Fetch Devices'}
                    </button>

                    <button
                        onClick={handleSimulation}
                        disabled={isLoading}
                        className="mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-sm"
                        title="Load Demo Data"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        Demo
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
                    <div className="sh-container animate-in fade-in duration-500 bg-transparent">
                        {Object.values(groupedData).map((location) => (
                            <div key={location.locationId} className="mb-8">
                                <div className="sh-header px-4">
                                    <div className="flex items-center gap-2">
                                        <span>{location.name}</span>
                                    </div>
                                    {(location.weather || location.airQuality) && (
                                        <div className="flex items-center gap-2 text-sm font-normal">
                                            {location.weather && (
                                                <>
                                                    <Sun size={18} />
                                                    <span>{Math.round(location.weather.temperature || 0)} °{location.weather.temperatureUnit}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6 px-4">
                                    {Object.values(location.rooms).map((room: any) => (
                                        <div key={room.roomId}>
                                            <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">{room.name || 'Unassigned'}</h3>
                                            <div className="sh-grid">
                                                {room.devices.map((device: Device) => {
                                                    // Adapter to convert SmartThings Device to Smart Home Device format
                                                    // State inference is tricky without full capabilities, defaulting to 'off' or 'on' based on name or random for demo
                                                    const mappedDevice: any = {
                                                        id: device.deviceId,
                                                        name: room.name || 'Unassigned',
                                                        subLabel: device.label || device.name,
                                                        state: 'off', // Default
                                                        type: 'light', // Default
                                                        isFavorite: false,
                                                        location: room.name || 'Unassigned'
                                                    };

                                                    // Simple heuristic for type
                                                    const n = (device.label || device.name).toLowerCase();
                                                    if (n.includes('tv')) mappedDevice.type = 'tv';
                                                    else if (n.includes('refri') || n.includes('fridge')) mappedDevice.type = 'refrigerator';
                                                    else if (n.includes('dish')) mappedDevice.type = 'dishwasher';

                                                    // Visual state heuristic (randomly active for demo purposes or checking components)
                                                    // In real app, we'd check components[0].status
                                                    if (device.components && device.components.length > 0) {
                                                        // Mock: if ID is even, it's on
                                                        // mappedDevice.state = 'on';
                                                    }

                                                    return (
                                                        <DeviceTile key={device.deviceId} device={mappedDevice} />
                                                    );
                                                })}
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
                                        {(loc.weather || loc.airQuality) && (
                                            <div className="ml-auto flex items-center gap-3 text-xs opacity-80">
                                                {loc.weather && (
                                                    <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                                                        <Thermometer size={10} /> {loc.weather.temperature}°{loc.weather.temperatureUnit}
                                                    </span>
                                                )}
                                                {loc.airQuality && (
                                                    <span className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-800">
                                                        <Gauge size={10} /> {loc.airQuality.rating}
                                                    </span>
                                                )}
                                            </div>
                                        )}
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

                {groupedData && viewMode === 'MAP' && (
                    <div className="flex-1 w-full h-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner relative bg-slate-900">
                        <MapView data={groupedData} />
                    </div>
                )}

            </div>
        </div >
    );
};

export default SmartThingsDevicesPane;
