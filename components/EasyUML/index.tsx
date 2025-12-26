import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHappyTool } from '../../contexts/HappyToolContext';
import { useToast } from '../../contexts/ToastContext';
import * as Lucide from 'lucide-react';

// --- Constants ---
const SNAP_Y = 20; // Vertical snap grid
const HEADER_HEIGHT = 80;
const CANVAS_PADDING = 40;

// --- Types ---
interface Lifeline {
    id: string;
    name: string;
    x: number;
    shape: 'box' | 'actor' | 'database';
}

interface Message {
    id: string;
    fromId: string;
    toId: string;
    y: number;
    label: string;
    lineStyle: 'solid' | 'dashed';
    arrowStyle: 'filled' | 'open' | 'none';
}

const EasyUML: React.FC = () => {
    const { addToast } = useToast();

    // State
    const [lifelines, setLifelines] = useState<Lifeline[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Persistent Style State
    const [defaultLineStyle, setDefaultLineStyle] = useState<Message['lineStyle']>('solid');
    const [defaultArrowStyle, setDefaultArrowStyle] = useState<Message['arrowStyle']>('filled');

    // History State
    interface DiagramState {
        lifelines: Lifeline[];
        messages: Message[];
    }
    const [history, setHistory] = useState<DiagramState[]>([]);
    const [future, setFuture] = useState<DiagramState[]>([]);

    const saveHistory = () => {
        setHistory(prev => [...prev.slice(-49), { lifelines, messages }]);
        setFuture([]);
    };

    const undo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setFuture(prev => [({ lifelines, messages }), ...prev]);
        setLifelines(previous.lifelines);
        setMessages(previous.messages);
        setHistory(prev => prev.slice(0, -1));
        setSelectedId(null);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        setHistory(prev => [...prev, ({ lifelines, messages })]);
        setLifelines(next.lifelines);
        setMessages(next.messages);
        setFuture(prev => prev.slice(1));
        setSelectedId(null);
    };

    // Hover State for Floating Handle
    const [hoveredLifelineId, setHoveredLifelineId] = useState<string | null>(null);
    const [hoveredY, setHoveredY] = useState<number>(0);

    // Interaction State
    const [dragState, setDragState] = useState<{
        type: 'LIFELINE' | 'MESSAGE_CREATE' | 'MESSAGE_MOVE';
        id?: string; // ID of moving item or 'from' lifeline ID for creation
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Pending Connection State (Click-to-Connect)
    const [pendingConnectionStart, setPendingConnectionStart] = useState<{ id: string, startX: number, startY: number } | null>(null);

    // --- Helpers ---
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const autoLayoutLifelines = (currentLifelines: Lifeline[]): Lifeline[] => {
        const count = currentLifelines.length;
        if (count === 0) return [];

        // Use visible width from ref if available, else window
        const containerWidth = canvasRef.current ? canvasRef.current.clientWidth : (window.innerWidth - 300);
        // Ensure at least enough space for them all to not be squished
        const availableWidth = Math.max(800, containerWidth);

        const output = [...currentLifelines];
        const spacing = availableWidth / (count + 1);

        return output.map((l, index) => ({
            ...l,
            x: spacing * (index + 1)
        }));
    };

    const getCanvasCoords = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const scrollLeft = canvasRef.current.scrollLeft;
        const scrollTop = canvasRef.current.scrollTop;
        return {
            x: e.clientX - rect.left + scrollLeft,
            y: e.clientY - rect.top + scrollTop
        };
    };

    const snapY = (y: number) => Math.round(y / SNAP_Y) * SNAP_Y;

    // --- Handlers ---

    // Keyboard Navigation
    const handleTabNavigation = (shiftKey: boolean) => {
        // Collect all editable items in order: Lifelines (X) -> Messages (Y)
        const sortedLifelines = [...lifelines].sort((a, b) => a.x - b.x);
        const sortedMessages = [...messages].sort((a, b) => a.y - b.y);

        const allIds = [...sortedLifelines.map(l => l.id), ...sortedMessages.map(m => m.id)];
        const currentIndex = allIds.indexOf(editingId || selectedId || '');

        let nextIndex;
        if (currentIndex === -1) {
            nextIndex = shiftKey ? allIds.length - 1 : 0;
        } else {
            nextIndex = shiftKey ? currentIndex - 1 : currentIndex + 1;
        }

        // Loop around
        if (nextIndex >= allIds.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = allIds.length - 1;

        if (allIds[nextIndex]) {
            setEditingId(allIds[nextIndex]);
            setSelectedId(allIds[nextIndex]);
        }
    };

    // Global Keys (Delete, Escape)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editingId) setEditingId(null);
                else setSelectedId(null);
                return;
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                handleTabNavigation(e.shiftKey);
                return;
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
                return;
            }

            // Arrow Key Navigation
            if (selectedId && !editingId) {
                const isLifeline = lifelines.find(l => l.id === selectedId);
                const isMessage = messages.find(m => m.id === selectedId);

                if (isLifeline) {
                    const sorted = [...lifelines].sort((a, b) => a.x - b.x);
                    const idx = sorted.findIndex(l => l.id === selectedId);
                    if (e.key === 'ArrowLeft' && idx > 0) setSelectedId(sorted[idx - 1].id);
                    if (e.key === 'ArrowRight' && idx < sorted.length - 1) setSelectedId(sorted[idx + 1].id);
                }

                if (isMessage) {
                    const sorted = [...messages].sort((a, b) => a.y - b.y);
                    const idx = sorted.findIndex(m => m.id === selectedId);
                    if (e.key === 'ArrowUp' && idx > 0) setSelectedId(sorted[idx - 1].id);
                    if (e.key === 'ArrowDown' && idx < sorted.length - 1) setSelectedId(sorted[idx + 1].id);
                }
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {

                const isLifeline = lifelines.find(l => l.id === selectedId);
                if (isLifeline) {
                    saveHistory();
                    const newLifelines = lifelines.filter(l => l.id !== selectedId);
                    setLifelines(autoLayoutLifelines(newLifelines)); // Auto-layout remaining
                    setMessages(prev => prev.filter(m => m.fromId !== selectedId && m.toId !== selectedId));
                    setSelectedId(null);
                    addToast('Actor Deleted', 'info');
                    return;
                }

                // Check if it's a message
                const isMessage = messages.find(m => m.id === selectedId);
                if (isMessage) {
                    saveHistory();
                    setMessages(prev => prev.filter(m => m.id !== selectedId));
                    setSelectedId(null);
                    addToast('Message Deleted', 'info');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, lifelines, messages, editingId, addToast]);


    // 1. Add Lifeline (Double Click Header)
    const handleHeaderDoubleClick = (e: React.MouseEvent) => {
        addToast('Creating New Actor...', 'info');
        // Ignore click coords, use auto-layout
        saveHistory();
        const newLifeline: Lifeline = {
            id: generateId(),
            name: 'New Actor',
            x: 0,
            shape: 'box'
        };
        setLifelines(prev => autoLayoutLifelines([...prev, newLifeline]));
    };

    // 2. Start Dragging
    const handleMouseDown = (e: React.MouseEvent, type: 'LIFELINE' | 'MESSAGE_CREATE' | 'MESSAGE_MOVE', id?: string) => {
        e.stopPropagation();

        if (id && type !== 'MESSAGE_CREATE') setSelectedId(id); // Select on interaction unless creating message

        const { x, y } = getCanvasCoords(e);
        const startY = type === 'MESSAGE_CREATE' ? snapY(hoveredY) : y; // Start from snapped hover Y if creating

        // Save history for Moves (since they mutate state immediately in MouseMove)
        if (type === 'LIFELINE' || type === 'MESSAGE_MOVE') {
            saveHistory();
        }

        setDragState({
            type,
            id,
            startX: x,
            startY: startY,
            currentX: x,
            currentY: startY // If creating, snap start Y immediately
        });
    };

    const [cursorX, setCursorX] = useState<number>(0);

    // 3. Move Drag
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const { x, y } = getCanvasCoords(e);

        // Always track hover Y for floating handle
        setHoveredY(y);
        setCursorX(x);

        // PROXIMITY-BASED HOVER DETECTION (More stable than onMouseLeave)
        if (!dragState && !pendingConnectionStart) {
            const HOVER_THRESHOLD = 90; // Half of 180px width
            const closest = lifelines.find(l => Math.abs(l.x - x) < HOVER_THRESHOLD);

            // Only update if changed or if Y position implies we are below header
            if (closest && y > HEADER_HEIGHT) {
                setHoveredLifelineId(closest.id);
            } else {
                setHoveredLifelineId(null);
            }
        }

        if (!dragState) return;

        setDragState(prev => prev ? ({ ...prev, currentX: x, currentY: y }) : null);

        if (dragState.type === 'LIFELINE' && dragState.id) {
            setLifelines(prev => prev.map(l => l.id === dragState.id ? { ...l, x: x } : l));
        }
        if (dragState.type === 'MESSAGE_MOVE' && dragState.id) {
            // Constrain Y to snap
            const snappedY = snapY(y);
            // Ensure it's below header
            if (snappedY > HEADER_HEIGHT + 20) {
                setMessages(prev => prev.map(m => m.id === dragState.id ? { ...m, y: snappedY } : m));
            }
        }
    }, [dragState, lifelines, pendingConnectionStart]);

    // 4. End Drag
    const handleMouseUp = () => {
        if (!dragState) return;

        if (dragState.type === 'MESSAGE_CREATE' && dragState.id) {
            const dx = Math.abs(dragState.currentX - dragState.startX);
            const dy = Math.abs(dragState.currentY - dragState.startY);

            // If it was a CLICK (not a drag), start Pending Connection
            if (dx < 5 && dy < 5) {
                setPendingConnectionStart({
                    id: dragState.id,
                    startX: dragState.startX,
                    startY: snapY(dragState.startY) // Snap immediately
                });
                setDragState(null);
                addToast('Select target actor', 'info');
                return;
            }

            // Otherwise, it was a drag - finish it
            // Find target lifeline
            // Simple proximity check
            const target = lifelines.find(l => Math.abs(l.x - dragState.currentX) < 40);

            if (target && target.id !== dragState.id) {
                // Create Message with PERSISTENT styles
                saveHistory();
                const newMessage: Message = {
                    id: generateId(),
                    fromId: dragState.id,
                    toId: target.id,
                    y: snapY(dragState.currentY),
                    label: 'message()',
                    lineStyle: defaultLineStyle,
                    arrowStyle: defaultArrowStyle
                };
                setMessages(prev => [...prev.filter(m => m.y !== newMessage.y), newMessage]);
                setSelectedId(newMessage.id); // Select the new message
            }
        }

        setDragState(null);
    };

    // Cycle Shape
    const toggleShape = (id: string) => {
        setLifelines(prev => prev.map(l => {
            if (l.id === id) {
                const shapes: Lifeline['shape'][] = ['box', 'actor', 'database'];
                const nextShape = shapes[(shapes.indexOf(l.shape) + 1) % shapes.length];
                return { ...l, shape: nextShape };
            }
            return l;
        }));
    };

    // Global mouse up for safety
    useEffect(() => {
        const up = () => setDragState(null);
        window.addEventListener('mouseup', up);
        return () => window.removeEventListener('mouseup', up);
    }, []);

    // --- Rendering ---

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 select-none">
            {/* Toolbar / Info */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm z-10">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Lucide.Activity className="w-5 h-5 text-indigo-500" />
                        Easy UML
                    </h1>
                    <p className="text-xs text-slate-500">
                        {pendingConnectionStart
                            ? "Select target Actor to complete connection (Esc to cancel)"
                            : "Double-click Header to add Actor. Drag (+) or Click (+) to connect. Toggle shapes."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={(e) => {
                            addToast('Auto-adding Actor', 'info');
                            saveHistory();
                            const newLifeline: Lifeline = {
                                id: generateId(),
                                name: 'New Actor',
                                x: 0,
                                shape: 'box'
                            };
                            setLifelines(prev => autoLayoutLifelines([...prev, newLifeline]));
                        }}
                        className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded shadow-sm transition-colors"
                    >
                        + Add Actor
                    </button>
                    <button onClick={() => { setLifelines([]); setMessages([]); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <Lucide.RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Canvas */}
            <div
                ref={canvasRef}
                className={`flex-1 overflow-auto relative ${pendingConnectionStart ? 'cursor-alias' : 'cursor-crosshair'} bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]`}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseDown={(e) => {
                    // If connecting via click, creating the message on click
                    if (pendingConnectionStart) {
                        const { x, y } = getCanvasCoords(e);
                        // Find target (allowing some tolerance)
                        const target = lifelines.find(l => Math.abs(l.x - x) < 60);

                        if (target && target.id !== pendingConnectionStart.id) {
                            // Create Message
                            saveHistory();
                            const newMessage: Message = {
                                id: generateId(),
                                fromId: pendingConnectionStart.id,
                                toId: target.id,
                                y: snapY(pendingConnectionStart.startY),
                                label: 'message()',
                                lineStyle: defaultLineStyle,
                                arrowStyle: defaultArrowStyle
                            };
                            setMessages(prev => [...prev.filter(m => m.y !== newMessage.y), newMessage]);
                            setSelectedId(newMessage.id);
                            addToast('Connected!', 'success');
                        }

                        setPendingConnectionStart(null); // Reset state
                        return;
                    }
                    setSelectedId(null);
                }}
            >
                <svg className="w-full h-full min-w-[1000px] min-h-[1000px] pointer-events-none">
                    <defs>
                        {/* Filled Arrow */}
                        <marker id="arrow-filled" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" className="fill-slate-900 dark:fill-slate-200" />
                        </marker>
                        {/* Open Arrow */}
                        <marker id="arrow-open" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polyline points="0 0, 10 3.5, 0 7" fill="none" className="stroke-slate-900 dark:stroke-slate-200" strokeWidth="1.5" />
                        </marker>
                    </defs>

                    {/* Lifeline Lines & Hover Areas */}
                    {lifelines.map(l => (
                        <g key={l.id} className="pointer-events-auto">
                            {/* Visual Line */}
                            <line
                                x1={l.x} y1={HEADER_HEIGHT}
                                x2={l.x} y2="100%"
                                className={`
                                    stroke-2 transition-colors
                                    ${selectedId === l.id ? 'stroke-indigo-400 dark:stroke-indigo-600' : 'stroke-slate-300 dark:stroke-slate-700'}
                                `}
                                strokeDasharray="5,5"
                            />
                            {/* Invisible Hit Area for Hover - MAXIMIZED for easier access - 180px width */}
                            <rect
                                x={l.x - 90}
                                y={HEADER_HEIGHT}
                                width="180"
                                height="100%"
                                fill="transparent"
                                className="cursor-crosshair"
                            />
                        </g>
                    ))}

                    {/* Messages */}
                    {messages.map(m => {
                        const from = lifelines.find(l => l.id === m.fromId);
                        const to = lifelines.find(l => l.id === m.toId);
                        if (!from || !to) return null;

                        const isHovered = hoveredMessageId === m.id;
                        const markerId = m.arrowStyle === 'none' ? undefined : (m.arrowStyle === 'open' ? 'url(#arrow-open)' : 'url(#arrow-filled)');
                        const dashArray = m.lineStyle === 'dashed' ? '5,5' : undefined;

                        return (
                            <g
                                key={m.id}
                                className={`pointer-events-auto ${editingId === m.id ? 'cursor-default' : 'cursor-ns-resize'}`}
                                onMouseDown={(e) => {
                                    if (editingId === m.id) return; // Disable drag if editing
                                    handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                }}
                                onMouseEnter={() => setHoveredMessageId(m.id)}
                                onMouseLeave={() => setHoveredMessageId(null)}
                            >
                                {/* Interaction Hit Area (invisible fat line) */}
                                <line x1={from.x} y1={m.y} x2={to.x} y2={m.y} stroke="transparent" strokeWidth="30" />

                                {/* Visible Line */}
                                <line
                                    x1={from.x} y1={m.y} x2={to.x} y2={m.y}
                                    className={`
                                        stroke-2 transition-all
                                        ${selectedId === m.id ? 'stroke-indigo-500 dark:stroke-indigo-400 stroke-[3px]' : 'stroke-slate-900 dark:stroke-slate-200'}
                                    `}
                                    strokeDasharray={dashArray}
                                    markerEnd={markerId}
                                />

                                {/* Controls (Only visible on hover/edit or SELECTED) */}
                                {(isHovered || editingId === m.id || selectedId === m.id) && (
                                    <foreignObject x={Math.min(from.x, to.x)} y={m.y - 45} width={Math.abs(to.x - from.x)} height={20}>
                                        <div className="flex justify-center gap-1">
                                            {/* Line Style Toggle */}
                                            <button
                                                className="w-5 h-5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center hover:border-indigo-500 shadow-sm"
                                                title="Toggle Line Style"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    const nextLineStyle = m.lineStyle === 'solid' ? 'dashed' : 'solid';
                                                    setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, lineStyle: nextLineStyle } : msg));
                                                    setDefaultLineStyle(nextLineStyle); // Update default
                                                }}
                                            >
                                                {m.lineStyle === 'solid' ? <Lucide.Minus className="w-3 h-3" /> : <Lucide.MoreHorizontal className="w-3 h-3" />}
                                            </button>

                                            {/* Arrow Style Toggle */}
                                            <button
                                                className="w-5 h-5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center hover:border-indigo-500 shadow-sm"
                                                title="Toggle Arrow Style"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    const nextStyle = m.arrowStyle === 'filled' ? 'open' : (m.arrowStyle === 'open' ? 'none' : 'filled');
                                                    setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, arrowStyle: nextStyle } : msg));
                                                    setDefaultArrowStyle(nextStyle); // Update default
                                                }}
                                            >
                                                {m.arrowStyle === 'filled' ? <Lucide.ChevronRight className="w-3 h-3" /> : (m.arrowStyle === 'open' ? <Lucide.ChevronRight className="w-3 h-3 text-slate-400" /> : <Lucide.X className="w-3 h-3" />)}
                                            </button>
                                        </div>
                                    </foreignObject>
                                )}

                                {/* Label Bubble */}
                                <foreignObject x={Math.min(from.x, to.x)} y={m.y - 25} width={Math.abs(to.x - from.x)} height={20}>
                                    <div className="flex justify-center" onMouseDown={(e) => e.stopPropagation()}>
                                        {editingId === m.id ? (
                                            <input
                                                autoFocus
                                                className="bg-white dark:bg-slate-800 border rounded px-1 text-xs outline-none shadow-lg min-w-[50px] text-center"
                                                defaultValue={m.label}
                                                onBlur={(e) => {
                                                    setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, label: e.target.value } : msg));
                                                    setEditingId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    // Stop propagation to prevent global listeners
                                                    e.stopPropagation();

                                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                                        e.currentTarget.blur();
                                                        setEditingId(null);
                                                    }
                                                    if (e.key === 'Tab') {
                                                        e.preventDefault();
                                                        // Save changes before moving
                                                        const newValue = e.currentTarget.value;
                                                        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, label: newValue } : msg));
                                                        handleTabNavigation(e.shiftKey);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <span
                                                className="bg-white/80 dark:bg-slate-900/80 px-1 text-xs font-mono rounded cursor-text hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors border border-transparent hover:border-indigo-200"
                                                onDoubleClick={(e) => { e.stopPropagation(); setEditingId(m.id); }}
                                            >
                                                {m.label}
                                            </span>
                                        )}
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    })}

                    {/* Floating Handle (Only when hovering a lifeline and NOT dragging AND NOT pending connection) */}
                    {!dragState && !pendingConnectionStart && hoveredLifelineId && (
                        <g transform={`translate(${lifelines.find(l => l.id === hoveredLifelineId)?.x || 0}, ${snapY(hoveredY)})`} className="pointer-events-auto cursor-crosshair">
                            {/* Visual Handle - Increased Size */}
                            <circle r="18" fill="indigo" className="fill-indigo-500 opacity-80 shadow-sm" />
                            <text textAnchor="middle" dy="8" fill="white" fontSize="24" fontWeight="bold">+</text>

                            {/* Interactive Area Trigger - MAXIMIZED RADIUS 80px */}
                            <circle
                                r="80"
                                fill="transparent"
                                onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_CREATE', hoveredLifelineId)}
                            />
                        </g>
                    )}

                    {/* Ghost Line (Creating Message - DRAG or CLICK) */}
                    {(dragState?.type === 'MESSAGE_CREATE' || pendingConnectionStart) && (
                        <line
                            x1={dragState?.startX ?? pendingConnectionStart?.startX}
                            y1={dragState?.currentY ?? pendingConnectionStart?.startY}
                            x2={dragState?.currentX ?? cursorX}
                            y2={dragState?.currentY ?? pendingConnectionStart?.startY}
                            className="stroke-indigo-500 stroke-2 stroke-dashed"
                            markerEnd="url(#arrow-filled)"
                        />
                    )}
                </svg>

                {/* DOM Layer for Lifeline Headers (Clickable) */}
                <div
                    className="absolute top-0 left-0 border-b border-indigo-500/20 bg-indigo-50/10 z-20 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                    style={{ width: '100%', minWidth: '1000px', height: HEADER_HEIGHT }}
                    onDoubleClick={handleHeaderDoubleClick}
                    title="Double Click here to add Actor"
                >
                    {lifelines.map(l => (
                        <div
                            key={l.id}
                            className="absolute top-2 transform -translate-x-1/2 p-2 group cursor-grab active:cursor-grabbing flex flex-col items-center"
                            style={{ left: l.x }}
                            onMouseDown={(e) => {
                                if (editingId === l.id) return; // Disable drag if editing
                                handleMouseDown(e, 'LIFELINE', l.id);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()} // Prevent bubble to header
                        >
                            <div
                                className={`
                                    bg-white dark:bg-slate-800 border-2 rounded-lg shadow-sm transition-all flex flex-col items-center justify-center gap-1 h-[70px] relative
                                    ${selectedId === l.id ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-500'}
                                `}
                                style={{ minWidth: 140, maxWidth: 240, width: 'max-content' }} // Dynamic width
                            >
                                {/* Shape Icon (Takes up standardized space) */}
                                <div className="h-6 flex items-center justify-center">
                                    {l.shape === 'actor' && <Lucide.User className="w-6 h-6 text-indigo-500" />}
                                    {l.shape === 'database' && <Lucide.Database className="w-5 h-5 text-indigo-500" />}
                                </div>
                                {/* Default Box has empty 24px height spacer implicitly via flex/gap or just centers text if no icon */}

                                {editingId === l.id ? (
                                    <input
                                        autoFocus
                                        className="bg-transparent outline-none text-center w-full font-bold text-sm px-1"
                                        defaultValue={l.name}
                                        onBlur={(e) => {
                                            setLifelines(prev => prev.map(user => user.id === l.id ? { ...user, name: e.target.value } : user));
                                            setEditingId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            // Stop propagation to prevent global listeners (like Delete/Backspace) from firing
                                            e.stopPropagation();

                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                e.currentTarget.blur();
                                                setEditingId(null);
                                            }
                                            if (e.key === 'Tab') {
                                                e.preventDefault();
                                                // Save changes before moving
                                                const newValue = e.currentTarget.value;
                                                setLifelines(prev => prev.map(user => user.id === l.id ? { ...user, name: newValue } : user));
                                                handleTabNavigation(e.shiftKey);
                                            }
                                        }}
                                    />
                                ) : (
                                    <span
                                        className="font-bold text-sm select-none truncate w-full text-center px-1"
                                        title={l.name}
                                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(l.id); }}
                                    >
                                        {l.name}
                                    </span>
                                )}

                                {/* Shape Toggle Button (Moved to Top-Right, Larger) */}
                                <button
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center hover:border-indigo-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    title="Change Shape"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        toggleShape(l.id);
                                    }}
                                >
                                    <Lucide.Shapes className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div >
    );
};

export default EasyUML;
