import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHappyTool } from '../../contexts/HappyToolContext';
import { useToast } from '../../contexts/ToastContext';
import * as Lucide from 'lucide-react';
import * as htmlToImage from 'html-to-image';

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
    note?: string;
    noteColor?: string;
    isActivate?: boolean;
    isDeactivate?: boolean;
    type?: 'MESSAGE' | 'DIVIDER' | 'NOTE_ACROSS' | 'FRAGMENT';

    // Extensions for Special Items
    descriptorType?: 'DIVIDER' | 'NOTE_ACROSS' | 'FRAGMENT';
    isFragment?: boolean;
    fragmentHeight?: number;
    fragmentCondition?: string;

    content?: string;
    height?: number; // For FRAGMENT
    customWidth?: number; // For FRAGMENT resizing
    customLeft?: number; // For FRAGMENT positioning
    elseOffset?: number; // For FRAGMENT else line position
}

interface SavedDiagram {
    id: string;
    name: string;
    lifelines: Lifeline[];
    messages: Message[];
    lastModified: number;
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

    // Canvas State
    const [canvasHeight, setCanvasHeight] = useState<number>(1000);

    // Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [plantUMLCode, setPlantUMLCode] = useState('');

    // --- Diagram Management State ---
    const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
    const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);

    // --- Initialization & Persistence ---
    useEffect(() => {
        // 1. Load from LocalStorage on mount
        const savedData = localStorage.getItem('happytool_easyuml_diagrams');
        const savedActiveId = localStorage.getItem('happytool_easyuml_active_id');

        let initialDiagrams: SavedDiagram[] = [];

        if (savedData) {
            try {
                initialDiagrams = JSON.parse(savedData);
            } catch (e) {
                console.error("Failed to parse diagrams", e);
            }
        }

        if (initialDiagrams.length === 0) {
            // Create Default if none exist
            const defaultId = generateId();
            initialDiagrams = [{
                id: defaultId,
                name: 'Untitled Diagram',
                lifelines: [],
                messages: [],
                lastModified: Date.now()
            }];
            localStorage.setItem('happytool_easyuml_active_id', defaultId);
        }

        setDiagrams(initialDiagrams);

        // Determine active ID
        let targetId = savedActiveId;
        if (!targetId || !initialDiagrams.find(d => d.id === targetId)) {
            targetId = initialDiagrams[0].id;
        }

        setActiveDiagramId(targetId);

        // Load content
        const activeDiagram = initialDiagrams.find(d => d.id === targetId);
        if (activeDiagram) {
            setLifelines(activeDiagram.lifelines);
            setMessages(activeDiagram.messages);
        }
    }, []);

    // 2. Auto-Save Current State to Active Diagram & LocalStorage
    useEffect(() => {
        if (!activeDiagramId || diagrams.length === 0) return;

        setDiagrams(prev => {
            const index = prev.findIndex(d => d.id === activeDiagramId);
            if (index === -1) return prev;

            const updated = [...prev];
            // Only update if changed to avoid unnecessary cycles (though simple ref check might be enough)
            updated[index] = {
                ...updated[index],
                lifelines,
                messages,
                lastModified: Date.now()
            };

            // Persist to LocalStorage
            localStorage.setItem('happytool_easyuml_diagrams', JSON.stringify(updated));
            return updated;
        });
    }, [lifelines, messages, activeDiagramId]); // Sync whenever content changes

    // 3. Persist Active ID
    useEffect(() => {
        if (activeDiagramId) {
            localStorage.setItem('happytool_easyuml_active_id', activeDiagramId);
        }
    }, [activeDiagramId]);


    // --- Diagram Actions ---
    const createNewDiagram = () => {
        const newId = generateId();
        const newDiagram: SavedDiagram = {
            id: newId,
            name: `Untitled ${diagrams.length + 1}`,
            lifelines: [],
            messages: [],
            lastModified: Date.now()
        };

        setDiagrams(prev => [...prev, newDiagram]);
        setActiveDiagramId(newId);
        setLifelines([]);
        setMessages([]);
        addToast('New Diagram Created', 'success');
    };

    const deleteDiagram = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (diagrams.length <= 1) {
            addToast('Cannot delete the last diagram', 'error');
            return;
        }

        const confirm = window.confirm('Are you sure you want to delete this diagram?');
        if (!confirm) return;

        const newDiagrams = diagrams.filter(d => d.id !== id);
        setDiagrams(newDiagrams);
        localStorage.setItem('happytool_easyuml_diagrams', JSON.stringify(newDiagrams)); // Immediate sync

        // If we deleted the active one, switch to the first available
        if (activeDiagramId === id) {
            const next = newDiagrams[0];
            setActiveDiagramId(next.id);
            setLifelines(next.lifelines);
            setMessages(next.messages);
        }
        addToast('Diagram Deleted', 'info');
    };

    const switchDiagram = (id: string) => {
        const target = diagrams.find(d => d.id === id);
        if (!target) return;

        setActiveDiagramId(id);
        setLifelines(target.lifelines);
        setMessages(target.messages);
    };

    const renameDiagram = (id: string, newName: string) => {
        setDiagrams(prev => {
            const updated = prev.map(d => d.id === id ? { ...d, name: newName } : d);
            localStorage.setItem('happytool_easyuml_diagrams', JSON.stringify(updated));
            return updated;
        });
    };
    const [showSequenceNumbers, setShowSequenceNumbers] = useState(false);

    // History State
    interface DiagramState {
        lifelines: Lifeline[];
        messages: Message[];
        canvasHeight: number;
    }
    const [history, setHistory] = useState<DiagramState[]>([]);
    const [future, setFuture] = useState<DiagramState[]>([]);

    const saveHistory = () => {
        setHistory(prev => [...prev.slice(-49), { lifelines, messages, canvasHeight }]);
        setFuture([]);
    };

    const undo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setFuture(prev => [({ lifelines, messages, canvasHeight }), ...prev]);
        setLifelines(previous.lifelines);
        setMessages(previous.messages);
        setCanvasHeight(previous.canvasHeight);
        setHistory(prev => prev.slice(0, -1));
        setSelectedId(null);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        setHistory(prev => [...prev, ({ lifelines, messages, canvasHeight })]);
        setLifelines(next.lifelines);
        setMessages(next.messages);
        setCanvasHeight(next.canvasHeight);
        setFuture(prev => prev.slice(1));
        setSelectedId(null);
    };

    // Hover State for Floating Handle
    const [hoveredLifelineId, setHoveredLifelineId] = useState<string | null>(null);
    const [hoveredY, setHoveredY] = useState<number>(0);

    // Interaction State
    const [dragState, setDragState] = useState<{
        type: 'LIFELINE' | 'MESSAGE_CREATE' | 'MESSAGE_MOVE' | 'MESSAGE_RESIZE';
        id?: string; // ID of moving item or 'from' lifeline ID for creation
        resizeHandle?: 'left' | 'right' | 'bottom' | 'else' | 'bottom-left' | 'bottom-right';
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        initialWidth?: number;
        initialHeight?: number;
        initialLeft?: number;
        initialElseOffset?: number;
        initialOffsetY?: number;
    } | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Pending Connection State (Click-to-Connect)
    const [pendingConnectionStart, setPendingConnectionStart] = useState<{ id: string, startX: number, startY: number } | null>(null);
    const [pendingPlacement, setPendingPlacement] = useState<{ type: 'DIVIDER' | 'NOTE_ACROSS' | 'FRAGMENT' } | null>(null);

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

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) {
                // Ignore if an input/textarea has focus (double safety)
                const activeTag = document.activeElement?.tagName.toLowerCase();
                if (activeTag === 'input' || activeTag === 'textarea') return;

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
    // 2. Start Dragging
    const handleMouseDown = (e: React.MouseEvent, type: 'LIFELINE' | 'MESSAGE_CREATE' | 'MESSAGE_MOVE' | 'MESSAGE_RESIZE', id?: string, resizeHandle?: 'left' | 'right' | 'bottom' | 'else' | 'bottom-left' | 'bottom-right') => {
        console.log(`[MouseDown] Type: ${type}, ID: ${id}`);
        e.stopPropagation();

        if (id && type !== 'MESSAGE_CREATE') setSelectedId(id); // Select on interaction unless creating message

        const { x, y } = getCanvasCoords(e);
        let finalStartX = x;

        // Strict Snap for Message Creation
        if (type === 'MESSAGE_CREATE' && id) {
            const l = lifelines.find(line => line.id === id);
            if (l) finalStartX = l.x;
        }

        const startY = type === 'MESSAGE_CREATE' ? snapY(hoveredY) : y; // Start from snapped hover Y if creating

        // Save history for Moves (since they mutate state immediately in MouseMove)
        if (type === 'LIFELINE' || type === 'MESSAGE_MOVE' || type === 'MESSAGE_RESIZE') {
            saveHistory();
        }

        let initialWidth, initialHeight, initialLeft, initialElseOffset;
        if (type === 'MESSAGE_RESIZE' && id) {
            const m = messages.find(msg => msg.id === id);
            if (m) {
                // Determine Bounds for default
                const minX = lifelines.length > 0 ? Math.min(...lifelines.map(l => l.x)) : 100;

                // Smart Slot Creation Calculation if NEW (or reset)
                let calculatedLeft = m.customLeft;
                let calculatedWidth = m.customWidth;

                // If dimensions are missing (newly created), calculate based on mouse X
                if (calculatedLeft === undefined || calculatedWidth === undefined) {
                    const mouseX = x; // use startX

                    // Find slots
                    const sortedLifelines = [...lifelines].sort((a, b) => a.x - b.x);
                    if (sortedLifelines.length >= 2) {
                        let targetSlot = { left: sortedLifelines[0].x, width: sortedLifelines[1].x - sortedLifelines[0].x }; // Default first slot

                        for (let i = 0; i < sortedLifelines.length - 1; i++) {
                            const l1 = sortedLifelines[i];
                            const l2 = sortedLifelines[i + 1];
                            if (mouseX >= l1.x && mouseX < l2.x) {
                                targetSlot = { left: l1.x, width: l2.x - l1.x };
                                break;
                            }
                        }

                        if (mouseX >= sortedLifelines[sortedLifelines.length - 1].x) {
                            // After last? Make it some default width attached to last
                            targetSlot = { left: sortedLifelines[sortedLifelines.length - 1].x, width: 200 };
                        } else if (mouseX < sortedLifelines[0].x) {
                            targetSlot = { left: sortedLifelines[0].x - 200, width: 200 };
                        }

                        calculatedLeft = targetSlot.left;
                        calculatedWidth = targetSlot.width;
                    } else {
                        // Fallback if < 2 lines
                        calculatedLeft = Math.max(50, minX - 60);
                        calculatedWidth = 500;
                    }
                }

                initialLeft = calculatedLeft ?? Math.max(50, minX - 60);
                initialWidth = calculatedWidth ?? 500;
                initialHeight = m.height || 200;
                initialElseOffset = m.elseOffset || (initialHeight / 2);
            }
        }

        const initialOffsetY = (type === 'MESSAGE_MOVE' && id)
            ? y - (messages.find(m => m.id === id)?.y || 0)
            : 0;

        setDragState({
            type,
            id,
            resizeHandle,
            startX: finalStartX,
            startY: startY,
            currentX: x,
            initialWidth, initialHeight, initialLeft, initialElseOffset,
            initialOffsetY, // Store offset
            currentY: startY // If creating, snap start Y immediately
        });
    };

    const [cursorX, setCursorX] = useState<number>(0);

    // 3. Move Drag
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const { x, y } = getCanvasCoords(e);

        // Always track hover Y for floating handle
        setHoveredY(snapY(y));

        // Fix: Hovered Lifeline Logic in Parent to prevent "Hover Loss" on undo/re-render
        // If we are NOT dragging anything, check what we are under
        if (!dragState) {
            const hoveredL = lifelines.find(l => Math.abs(l.x - x) < 60);
            if (hoveredL) {
                if (hoveredLifelineId !== hoveredL.id) setHoveredLifelineId(hoveredL.id);
            } else {
                if (hoveredLifelineId) setHoveredLifelineId(null);
            }
        }

        if (!dragState) return;

        // If dragging lifeline
        if (dragState.type === 'LIFELINE' && dragState.id) {
            const HOVER_THRESHOLD = 90;
            const closest = lifelines.find(l => Math.abs(l.x - x) < HOVER_THRESHOLD);

            if (closest && y > HEADER_HEIGHT) {
                // Check if we are close to an existing message (Vertical Proximity)
                // If so, suppress the "+" handle to allow selection of the message
                const isNearMessage = messages.some(m => {
                    // Check if message is attached to this lifeline
                    if (m.fromId !== closest.id && m.toId !== closest.id) return false;
                    // Check vertical distance
                    return Math.abs(m.y - y) < 30; // 30px buffer around message line
                });

                // console.log(`[MouseMove] Closest: ${closest.name}, NearMsg: ${isNearMessage}, Y: ${y}`); // DEBUG LOG (Optional, maybe too spammy?)

                if (isNearMessage) {
                    setHoveredLifelineId(null);
                } else {
                    setHoveredLifelineId(closest.id);
                }
            } else {
                setHoveredLifelineId(null);
            }
        }

        if (!dragState) return;

        // DRAG THRESHOLD: Prevent accidental moves when clicking to select
        const dx = Math.abs(x - dragState.startX);
        const dy = Math.abs(y - dragState.startY);
        if (dx < 5 && dy < 5) return;

        setDragState(prev => prev ? ({ ...prev, currentX: x, currentY: y }) : null);

        if (dragState.type === 'LIFELINE' && dragState.id) {
            setLifelines(prev => prev.map(l => l.id === dragState.id ? { ...l, x: x } : l));
        }
        if (dragState.type === 'MESSAGE_MOVE' && dragState.id) {
            // Apply Offset
            const offsetY = dragState.initialOffsetY || 0;
            const targetY = y - offsetY;

            // Constrain Y to snap
            const snappedY = snapY(targetY);
            // Ensure it's below header
            if (snappedY > HEADER_HEIGHT + 20) {
                // console.log(`[MessageMove] ID: ${dragState.id} -> Y: ${snappedY}`);
                setMessages(prev => prev.map(m => m.id === dragState.id ? { ...m, y: snappedY } : m));
            }
        }

        // Resizing
        if (dragState.type === 'MESSAGE_RESIZE' && dragState.id) {
            const dx = x - dragState.startX;
            const dy = y - dragState.startY;

            setMessages(prev => prev.map(m => {
                if (m.id !== dragState.id) return m;

                const updates: any = {};

                if (dragState.resizeHandle === 'bottom') {
                    updates.height = Math.max(40, (dragState.initialHeight || 60) + dy);
                }
                if (dragState.resizeHandle === 'right') {
                    let newWidth = Math.max(100, (dragState.initialWidth || 400) + dx);

                    // Magnetic Snap to Lifelines 
                    const proposedRightX = (dragState.initialLeft || 0) + newWidth;
                    const nearestLifeline = lifelines.reduce((nearest, current) => {
                        return Math.abs(current.x - proposedRightX) < Math.abs(nearest.x - proposedRightX) ? current : nearest;
                    }, lifelines[0]);

                    if (nearestLifeline && Math.abs(nearestLifeline.x - proposedRightX) < 20) {
                        newWidth = nearestLifeline.x - (dragState.initialLeft || 0);
                    }

                    updates.customWidth = newWidth;
                }
                if (dragState.resizeHandle === 'left') {
                    let newLeft = (dragState.initialLeft || 0) + dx;
                    let newWidth = Math.max(100, (dragState.initialWidth || 400) - dx);

                    // Magnetic Snap to Lifelines
                    const nearestLifeline = lifelines.reduce((nearest, current) => {
                        return Math.abs(current.x - newLeft) < Math.abs(nearest.x - newLeft) ? current : nearest;
                    }, lifelines[0]);

                    if (nearestLifeline && Math.abs(nearestLifeline.x - newLeft) < 20) {
                        const snapDx = nearestLifeline.x - (dragState.initialLeft || 0);
                        newLeft = nearestLifeline.x;
                        newWidth = Math.max(100, (dragState.initialWidth || 400) - snapDx);
                    }

                    updates.customWidth = newWidth;
                    updates.customLeft = newLeft;
                }
                // Corner Resizing & Edge Snapping
                if (dragState.resizeHandle === 'bottom-right' || dragState.resizeHandle === 'right') {
                    // Right Edge Logic
                    let newWidth = Math.max(50, (dragState.initialWidth || 500) + dx);

                    // Magnetic Snap Right
                    const proposedRightX = (dragState.initialLeft || 0) + newWidth;
                    const nearestLifeline = lifelines.reduce((nearest, current) => {
                        return Math.abs(current.x - proposedRightX) < Math.abs(nearest.x - proposedRightX) ? current : nearest;
                    }, lifelines[0]);

                    if (nearestLifeline && Math.abs(nearestLifeline.x - proposedRightX) < 20) {
                        newWidth = nearestLifeline.x - (dragState.initialLeft || 0);
                    }

                    updates.customWidth = newWidth;
                    if (dragState.resizeHandle === 'bottom-right') {
                        updates.height = Math.max(40, (dragState.initialHeight || 200) + dy);
                    }
                }

                if (dragState.resizeHandle === 'bottom-left' || dragState.resizeHandle === 'left') {
                    // Left Edge Logic
                    let newLeft = (dragState.initialLeft || 0) + dx;
                    let newWidth = Math.max(50, (dragState.initialWidth || 500) - dx);

                    // Magnetic Snap Left
                    const nearestLifeline = lifelines.reduce((nearest, current) => {
                        return Math.abs(current.x - newLeft) < Math.abs(nearest.x - newLeft) ? current : nearest;
                    }, lifelines[0]);

                    if (nearestLifeline && Math.abs(nearestLifeline.x - newLeft) < 20) {
                        const snapDx = nearestLifeline.x - (dragState.initialLeft || 0);
                        newLeft = nearestLifeline.x;
                        newWidth = Math.max(50, (dragState.initialWidth || 500) - snapDx);
                    }

                    updates.customWidth = newWidth;
                    updates.customLeft = newLeft;
                    if (dragState.resizeHandle === 'bottom-left') {
                        updates.height = Math.max(40, (dragState.initialHeight || 200) + dy);
                    }
                }

                // SLOT JEMP logic for MOVE
                if (dragState.type === 'MESSAGE_MOVE' && m.isFragment) {
                    // If moving a fragment, we snap to strict slots based on center position
                    const currentMidX = (dragState.initialLeft || 0) + (dragState.initialWidth || 200) / 2 + dx;

                    // Find which slot this MidX falls into
                    const sortedLifelines = [...lifelines].sort((a, b) => a.x - b.x);
                    for (let i = 0; i < sortedLifelines.length - 1; i++) {
                        const l1 = sortedLifelines[i];
                        const l2 = sortedLifelines[i + 1];
                        if (currentMidX >= l1.x && currentMidX < l2.x) {
                            // MATCH! Snap to this slot
                            updates.customLeft = l1.x;
                            updates.customWidth = l2.x - l1.x;
                            break;
                        }
                    }
                } else if (dragState.type === 'MESSAGE_MOVE') {
                    // Normal behavior for others
                }

                if (dragState.resizeHandle === 'bottom-left') {
                    // Similar to left + bottom
                    let newLeft = (dragState.initialLeft || 0) + dx;
                    let newWidth = Math.max(100, (dragState.initialWidth || 400) - dx);

                    // Magnetic Snap Left
                    const nearestLifeline = lifelines.reduce((nearest, current) => {
                        return Math.abs(current.x - newLeft) < Math.abs(nearest.x - newLeft) ? current : nearest;
                    }, lifelines[0]);

                    if (nearestLifeline && Math.abs(nearestLifeline.x - newLeft) < 20) {
                        const snapDx = nearestLifeline.x - (dragState.initialLeft || 0);
                        newLeft = nearestLifeline.x;
                        newWidth = Math.max(100, (dragState.initialWidth || 400) - snapDx);
                    }

                    updates.customWidth = newWidth;
                    updates.customLeft = newLeft;
                    updates.height = Math.max(40, (dragState.initialHeight || 200) + dy);
                }

                if (dragState.resizeHandle === 'else') {
                    const newOffset = Math.max(10, Math.min((m.height || 200) - 10, (dragState.initialElseOffset || 30) + dy));
                    updates.elseOffset = newOffset;
                }

                return { ...m, ...updates };
            }));
        }
    }, [dragState, lifelines, pendingConnectionStart, messages, hoveredLifelineId]); // Added 'messages' dependency

    // 4. End Drag
    const handleMouseUp = () => {
        if (!dragState) return;

        if (dragState.type === 'MESSAGE_CREATE' && dragState.id) {
            const dx = Math.abs(dragState.currentX - dragState.startX);
            const dy = Math.abs(dragState.currentY - dragState.startY);

            // If it was a CLICK (not a drag), do NOT start Pending Connection.
            // This allows the button to remain visible for Double-Click (Self-Message).
            if (dx < 5 && dy < 5) {
                setDragState(null);
                return;
            }

            // Otherwise, it was a drag - finish it
            // Find target lifeline
            // Simple proximity check
            const target = lifelines.find(l => Math.abs(l.x - dragState.currentX) < 40);

            if (target) {
                // PREVENT SINGLE CLICK SELF CONNECTIONS
                // User wants double-click for self-messages
                if (target.id === dragState.id) {
                    setDragState(null);
                    return;
                }

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

            setDragState(null);
        };
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

    // Uniform Relayout & Spacing (User Request: "Fit to screen like Add Actor, then add/sub one unit")
    const changeSpacing = (delta: number) => {
        if (lifelines.length < 1 || !canvasRef.current) return;
        saveHistory();

        // 1. Calculate Base Spacing
        let baseSpacing = 200;

        // Check if currently uniform (gaps are roughly same)
        let isUniform = true;
        let currentTotal = 0;

        if (lifelines.length > 1) {
            const firstGap = lifelines[1].x - lifelines[0].x;
            for (let i = 0; i < lifelines.length - 1; i++) {
                const gap = lifelines[i + 1].x - lifelines[i].x;
                currentTotal += gap;
                if (Math.abs(gap - firstGap) > 1) { // 1px tolerance
                    isUniform = false;
                }
            }
            const currentAvg = currentTotal / (lifelines.length - 1);

            if (isUniform) {
                // If already uniform, we ACCUMULATE from current state
                baseSpacing = currentAvg;
            } else {
                // If messy, we RESET to Screen Fit
                const containerWidth = canvasRef.current.clientWidth;
                const availableWidth = Math.max(800, containerWidth);
                baseSpacing = availableWidth / (lifelines.length + 1);
            }

            // Calculate Scale Ratio for Prop. Resizing
            const oldMetric = isUniform ? baseSpacing : currentAvg;
            // 2. Apply Delta
            const newSpacing = Math.max(50, baseSpacing + delta);
            const ratio = oldMetric > 0 ? (newSpacing / oldMetric) : 1;

            // 3. Re-distribute Lifelines
            setLifelines(prev => prev.map((l, index) => ({
                ...l,
                x: newSpacing * (index + 1)
            })));

            // 4. Re-distribute Fragments (Proportional Scaling)
            setMessages(prev => prev.map(m => {
                if ((m.type === 'FRAGMENT' || m.type === 'DIVIDER') && m.customLeft !== undefined) {
                    return {
                        ...m,
                        customLeft: m.customLeft * ratio,
                        customWidth: m.customWidth ? m.customWidth * ratio : undefined
                    };
                }
                return m;
            }));
        } else {
            // Single item - use its x position as 'spacing' or default
            const containerWidth = canvasRef.current.clientWidth;
            baseSpacing = Math.max(800, containerWidth) / 2;

            // 2. Apply Delta
            const newSpacing = Math.max(50, baseSpacing + delta);

            // 3. Re-distribute
            setLifelines(prev => prev.map((l, index) => ({
                ...l,
                x: newSpacing * (index + 1)
            })));
        }

        // addToast(`Spacing ${isUniform ? 'Adjusted' : 'Reset & Adjusted'}`, 'info'); // Removed by user request
    };

    const increaseSpacing = () => changeSpacing(40);
    const decreaseSpacing = () => changeSpacing(-40);

    // Add Special Items
    // Add Special Items
    const addDescriptor = (type: 'DIVIDER' | 'NOTE_ACROSS' | 'FRAGMENT') => {
        setPendingPlacement({ type });
        if (type !== 'DIVIDER') {
            addToast(`Click on diagram to place ${type.replace('_', ' ')}`, 'info');
        }
    };

    // Global Listeners (Mouse Up & Key Down)
    useEffect(() => {
        const handleMouseUpGlobal = () => setDragState(null);

        const handleKeyDownGlobal = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (pendingConnectionStart) {
                    setPendingConnectionStart(null);
                    addToast('Connection Cancelled', 'info');
                }
                if (dragState?.type === 'MESSAGE_MOVE' || dragState?.type === 'MESSAGE_CREATE') {
                    setDragState(null);
                }
            }

            // Delete Selected Item
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) {
                // Prevent browser back navigation
                if (e.key === 'Backspace' && e.target === document.body) {
                    e.preventDefault();
                }

                // Check if it's a message
                if (messages.find(m => m.id === selectedId)) {
                    saveHistory();
                    setMessages(prev => prev.filter(m => m.id !== selectedId));
                    setSelectedId(null);
                    addToast('Item Deleted', 'success');
                }
                // Check if it's a lifeline (Actor) - Optional, but good for consistency
                else if (lifelines.find(l => l.id === selectedId)) {
                    saveHistory();
                    setLifelines(prev => prev.filter(l => l.id !== selectedId));
                    setMessages(prev => prev.filter(m => m.fromId !== selectedId && m.toId !== selectedId));
                    setSelectedId(null);
                    addToast('Actor Deleted', 'success');
                }
            }
        };

        window.addEventListener('mouseup', handleMouseUpGlobal);
        window.addEventListener('keydown', handleKeyDownGlobal);
        return () => {
            window.removeEventListener('mouseup', handleMouseUpGlobal);
            window.removeEventListener('keydown', handleKeyDownGlobal);
        };
    }, [pendingConnectionStart, dragState]);

    const generatePlantUML = () => {
        let code = '@startuml\n';

        // 1. Define Participants (preserve order)
        // Sort by x position effectively auto-handled by just listing them, 
        // but explicit definition ensures correct type (actor vs database)
        lifelines.forEach(l => {
            let type = 'participant';
            if (l.shape === 'actor') type = 'actor';
            if (l.shape === 'database') type = 'database';
            // Sanitize name: remove spaces or wrap in quotes
            const safeName = l.name.includes(' ') ? `"${l.name}"` : l.name;
            const alias = `L${l.id}`; // Use ID as alias to avoid name collisions
            code += `${type} ${safeName} as ${alias}\n`;
        });

        code += '\n';

        // 2. Define Messages (sorted by Y)
        // 2. Define Messages (sorted by Y) - with End Event Queue for Fragments
        const sortedMessages = [...messages].sort((a, b) => a.y - b.y);
        const endQueue: { y: number, text: string }[] = [];

        sortedMessages.forEach(m => {
            // Check for ending blocks
            while (endQueue.length > 0 && endQueue[0].y < m.y) {
                const end = endQueue.shift();
                if (end) code += `${end.text}\n`;
            }
            endQueue.sort((a, b) => a.y - b.y); // Keep queue sorted

            // SPECIAL TYPES
            if (m.type === 'DIVIDER') {
                code += `== ${m.label || 'Divider'} ==\n`;
                return;
            }
            if (m.type === 'NOTE_ACROSS') {
                code += `note over ${lifelines.map(l => `L${l.id}`).join(', ')}\n${m.label}\nend note\n`;
                return;
            }
            if (m.type === 'FRAGMENT') {
                code += `alt ${m.label || 'Alt'}\n`;
                if (m.content) code += `  ${m.content}\n`;
                if (m.height) {
                    // Schedule 'end' at m.y + m.height
                    endQueue.push({ y: m.y + m.height, text: 'end' });
                    endQueue.sort((a, b) => a.y - b.y);
                    // Also handles 'else' if we split it? Currently standard fragment box.
                } else {
                    code += 'end\n';
                }
                return;
            }

            // STANDARD MESSAGE
            const from = lifelines.find(l => l.id === m.fromId);
            const to = lifelines.find(l => l.id === m.toId);
            if (!from || !to) return;

            const fromAlias = `L${from.id}`;
            const toAlias = `L${to.id}`;

            // Determine arrow type
            let arrow = '->';
            if (m.lineStyle === 'dashed') {
                if (m.arrowStyle === 'open') arrow = '-->>';
                else arrow = '-->';
            } else {
                if (m.arrowStyle === 'open') arrow = '->>';
                else arrow = '->';
            }

            // Label
            const label = m.label ? `: ${m.label}` : '';

            code += `${fromAlias} ${arrow} ${toAlias}${label}\n`;

            // EXTENSIONS
            if (m.isActivate) code += `activate ${toAlias}\n`;
            if (m.isDeactivate) code += `deactivate ${fromAlias}\n`;
            if (m.note) {
                code += `note right\n${m.note}\nend note\n`;
            }
        });

        // Flush remaining ends
        while (endQueue.length > 0) {
            const end = endQueue.shift();
            if (end) code += `${end.text}\n`;
        }

        code += '@enduml';
        return code;
    };

    const exportToImage = async () => {
        if (!canvasRef.current) return;

        try {
            // Calculate Content Dimensions & Bounds
            const lifelinesX = lifelines.map(l => l.x);
            const minLifelineX = lifelines.length > 0 ? Math.min(...lifelinesX) : 0;
            const maxLifelineX = lifelines.length > 0 ? Math.max(...lifelinesX) : 0;

            // Calculate lowest point (Messages, Dividers, Fragments)
            const maxContentY = messages.length > 0
                ? Math.max(...messages.map(m => m.y + (m.height || 0)))
                : 0;

            // Margins
            const RIGHT_MARGIN = 300; // Increased buffer for right side
            const BOTTOM_MARGIN = 100;

            // 1. Calculate Shift (Left Crop)
            const startContentX = Math.max(0, minLifelineX - 100);

            // 2. Calculate Final Width
            const targetContentEnd = maxLifelineX + RIGHT_MARGIN;
            const contentWidth = Math.max(1000, targetContentEnd - startContentX);

            // 3. Vertical Height (Crop to content, ignore canvas expansion)
            const contentHeight = Math.max(800, maxContentY + BOTTOM_MARGIN);

            const isDark = document.documentElement.classList.contains('dark');

            // Use scrollWidth to ensure clone is full size
            const scrollWidth = canvasRef.current.scrollWidth;
            const scrollHeight = canvasRef.current.scrollHeight;

            // CLEAR SELECTION & HOVER to prevent UI controls from appearing in image
            setSelectedId(null);
            setEditingId(null);
            setHoveredMessageId(null);
            setHoveredLifelineId(null);

            // Allow a brief render cycle for state updates to apply before capturing
            await new Promise(resolve => setTimeout(resolve, 50));

            const dataUrl = await htmlToImage.toPng(canvasRef.current, {
                backgroundColor: isDark ? '#020617' : '#ffffff',
                cacheBust: true,
                width: contentWidth,
                height: contentHeight,
                style: {
                    width: `${Math.max(scrollWidth, targetContentEnd + 200)}px`,
                    height: `${Math.max(scrollHeight, contentHeight)}px`,
                    transform: `translate(${-startContentX}px, 0)`,
                    transformOrigin: 'top left',
                    overflow: 'visible',
                    backgroundImage: 'none'
                },
                filter: (node) => true
            });

            // Download
            const link = document.createElement('a');
            link.download = `easyuml-export-${generateId()}.png`;
            link.href = dataUrl;
            link.click();
            addToast('Image Exported!', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            addToast('Export Failed', 'error');
        }
    };

    // --- Rendering ---

    // Calculate Activation Boxes
    const activationBoxes = React.useMemo(() => {
        const boxes: { id: string, lifelineId: string, x: number, y: number, height: number, depth: number }[] = [];
        const activeStacks: Record<string, number[]> = {}; // lifelineId -> [startY]

        // Sort messages by Y
        const sorted = [...messages].sort((a, b) => a.y - b.y);

        sorted.forEach(m => {
            if (m.isActivate && m.toId !== 'global') {
                if (!activeStacks[m.toId]) activeStacks[m.toId] = [];
                activeStacks[m.toId].push(m.y);
            }
            if (m.isDeactivate && m.fromId !== 'global') {
                if (activeStacks[m.fromId] && activeStacks[m.fromId].length > 0) {
                    const startY = activeStacks[m.fromId].pop()!;
                    const lifeline = lifelines.find(l => l.id === m.fromId);
                    const depth = activeStacks[m.fromId].length;
                    if (lifeline) {
                        boxes.push({ id: `active-${m.fromId}-${startY}`, lifelineId: m.fromId, x: lifeline.x, y: startY, height: m.y - startY, depth });
                    }
                }
            }
        });

        // Handle unclosed activations - Extend to bottom
        const maxMessageY = messages.length > 0 ? Math.max(...messages.map(m => m.y)) : 0;
        const bottomY = Math.max(canvasHeight, maxMessageY + 100);

        Object.keys(activeStacks).forEach(lid => {
            activeStacks[lid].forEach((startY, index) => {
                const lifeline = lifelines.find(l => l.id === lid);
                if (lifeline) {
                    boxes.push({ id: `active-unclosed-${lid}-${startY}`, lifelineId: lid, x: lifeline.x, y: startY, height: bottomY - startY, depth: index });
                }
            });
        });

        return boxes;
    }, [messages, lifelines, canvasHeight]);

    // --- Drag and Drop Creation ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type') as 'DIVIDER' | 'FRAGMENT' | null;

        if (type && ['DIVIDER', 'FRAGMENT'].includes(type)) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const dropY = e.clientY - rect.top + (canvasRef.current?.scrollTop || 0);
            // Calculate Drop X relative to canvas (using scrollLeft if needed)
            const dropX = e.clientX - rect.left + (canvasRef.current?.scrollLeft || 0);

            const snappedY = snapY(dropY);

            let customLeft: number | undefined = undefined;
            let customWidth: number | undefined = undefined;

            // --- Magnetic Slot Snap Logic (Mouse-Center based) ---
            if (type === 'FRAGMENT' && lifelines.length > 1) {
                const sorted = [...lifelines].sort((a, b) => a.x - b.x);

                // Find containing slot
                let foundSlot = false;
                for (let i = 0; i < sorted.length - 1; i++) {
                    const l1 = sorted[i];
                    const l2 = sorted[i + 1];
                    if (dropX >= l1.x && dropX < l2.x) {
                        const PADDING = 60;
                        customLeft = l1.x - PADDING;
                        customWidth = (l2.x - l1.x) + (PADDING * 2);
                        foundSlot = true;
                        break;
                    }
                }

                // Fallback: Before first or After last
                if (!foundSlot) {
                    if (dropX < sorted[0].x) {
                        // Before first: Try to attach right side to First
                        customWidth = 200;
                        customLeft = sorted[0].x - 200;
                    } else {
                        // After last: Attach left side to Last
                        customLeft = sorted[sorted.length - 1].x;
                        customWidth = 200;
                    }
                }

            } else if (type === 'FRAGMENT') {
                // No lifelines or just 1
                customWidth = 300;
                customLeft = dropX - 150;
            }

            const newMessage: Message = {
                id: generateId(),
                fromId: 'global',
                toId: 'global',
                y: snappedY,
                label: type === 'DIVIDER' ? '== New Divider ==' : 'Alt Condition',
                lineStyle: 'solid',
                arrowStyle: 'none',
                type: type,
                height: type === 'FRAGMENT' ? 200 : undefined,
                customWidth: customWidth,
                customLeft: customLeft,
                elseOffset: type === 'FRAGMENT' ? 100 : undefined
            };

            setMessages(prev => [...prev, newMessage]);
            saveHistory();
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 select-none relative">
            {/* Consistent System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 border-b border-indigo-500/30 bg-slate-900">
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Lucide.GitGraph size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200 no-drag">EasyUML Sequence Diagram</span>
            </div>

            {/* Toolbar / Info */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm z-10 overflow-x-auto no-scrollbar">
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 min-w-[200px]">
                        {/* Diagram Switcher (Folder Icon) */}
                        <div className="relative group p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer text-slate-500 transition-colors" title="Switch Diagram">
                            <Lucide.FolderOpen className="w-5 h-5 text-indigo-500" />
                            {/* Native Select (Hidden but functional) */}
                            <select
                                value={activeDiagramId || ''}
                                onChange={(e) => switchDiagram(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            >
                                {diagrams.map(d => <option key={d.id} value={d.id} className="dark:bg-slate-900">{d.name}</option>)}
                            </select>
                            <div className="absolute -bottom-1 -right-1 pointer-events-none bg-white dark:bg-slate-900 rounded-full">
                                <Lucide.ChevronDown className="w-3 h-3 text-slate-400" />
                            </div>
                        </div>

                        {/* Title Input (Main) */}
                        <input
                            value={diagrams.find(d => d.id === activeDiagramId)?.name || ''}
                            onChange={(e) => activeDiagramId && renameDiagram(activeDiagramId, e.target.value)}
                            className="font-bold text-lg bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 border border-transparent focus:border-indigo-300 rounded px-2 py-0.5 outline-none transition-all w-[200px] text-slate-700 dark:text-slate-200"
                            placeholder="Diagram Name"
                            title="Rename Diagram"
                        />

                        {/* Actions */}
                        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
                            <button onClick={createNewDiagram} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-500 transition-colors" title="Create New Diagram">
                                <Lucide.PlusCircle className="w-4 h-4" />
                            </button>

                            {diagrams.length > 1 && (
                                <button onClick={(e) => activeDiagramId && deleteDiagram(activeDiagramId, e)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-red-500 transition-colors" title="Delete Current Diagram">
                                    <Lucide.Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>

                    {/* NEW ITEMS TOOLBAR - DRAGGABLE */}
                    <div className="flex gap-1">
                        <div
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('type', 'DIVIDER')}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-grab active:cursor-grabbing"
                            title="Drag Divider to Canvas"
                        >
                            <Lucide.MinusSquare className="w-5 h-5" />
                        </div>
                        <div
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('type', 'FRAGMENT')}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-grab active:cursor-grabbing"
                            title="Drag Fragment (Alt/Else) to Canvas"
                        >
                            <Lucide.BoxSelect className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>

                    {/* Export PlantUML Button */}
                    <button
                        onClick={() => {
                            const code = generatePlantUML();
                            setPlantUMLCode(code);
                            setShowExportModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium border border-indigo-200 dark:border-indigo-800"
                    >
                        <Lucide.Code className="w-4 h-4" />
                        Export PlantUML
                    </button>

                    {/* Export Image Button */}
                    <button
                        onClick={exportToImage}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-sm font-medium border border-emerald-200 dark:border-emerald-800"
                    >
                        <Lucide.Image className="w-4 h-4" />
                        Export Image
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    {/* Auto-Numbering Toggle */}
                    <button
                        onClick={() => setShowSequenceNumbers(!showSequenceNumbers)}
                        className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${showSequenceNumbers ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                        title="Toggle Auto-Numbering"
                    >
                        <Lucide.ListOrdered className="w-4 h-4" />
                    </button>

                    {pendingConnectionStart && (
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                            Select target Actor to complete connection (Esc to cancel)
                        </p>
                    )}
                    <button
                        onClick={(e) => {
                            // addToast('Auto-adding Actor', 'info'); // Removed by user request
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

                    {/* Spacing Controls */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                        <button onClick={decreaseSpacing} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400" title="Decrease Spacing (Compact)">
                            <Lucide.ChevronsRightLeft className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        <button onClick={increaseSpacing} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400" title="Increase Spacing (Spread)">
                            <Lucide.ChevronsLeftRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <button onClick={() => { saveHistory(); setLifelines([]); setMessages([]); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <Lucide.RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>


            {/* Diagram Canvas */}
            <div
                ref={canvasRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex-1 overflow-auto relative bg-slate-50 dark:bg-slate-900/50"
            >
                <div
                    className="relative min-w-full min-h-[200px] origin-top-left transition-all duration-75 ease-out bg-white dark:bg-slate-900"
                    style={{
                        width: 'max-content', // Allow it to grow
                        height: Math.max(800, canvasHeight)
                    }}
                    onMouseDown={(e) => {
                        // 1. Pending Placement Logic
                        if (pendingPlacement) {
                            const { y } = getCanvasCoords(e);
                            saveHistory();
                            const newMsg: Message = {
                                id: generateId(),
                                fromId: 'global',
                                toId: 'global',
                                y: snapY(y),
                                label: pendingPlacement.type === 'DIVIDER' ? '== New Divider ==' : (pendingPlacement.type === 'NOTE_ACROSS' ? 'Note Across' : 'Alt'),
                                type: pendingPlacement.type, // Required for rendering loop
                                descriptorType: pendingPlacement.type,
                                isFragment: pendingPlacement.type === 'FRAGMENT',
                                fragmentHeight: pendingPlacement.type === 'FRAGMENT' ? 200 : undefined,
                                fragmentCondition: pendingPlacement.type === 'FRAGMENT' ? '[condition]' : undefined,
                                lineStyle: 'solid',
                                arrowStyle: 'none'
                            };
                            setMessages(prev => [...prev, newMsg].sort((a, b) => a.y - b.y));
                            setPendingPlacement(null);
                            addToast('Item Placed', 'success');
                            return;
                        }

                        // Only clear selection if clicking on background
                        if (e.target === e.currentTarget) {
                            setSelectedId(null);
                        }
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {/* Grid Background */}
                    <svg
                        className="w-full min-w-[1000px] pointer-events-none"
                        style={{ minHeight: canvasHeight }}
                    // Explicitly inject the current theme colors as CSS variables or just use them inline 
                    // But inline is safer for html-to-image
                    >
                        <defs>
                            {/* Filled Arrow */}
                            <marker id="arrow-filled" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon
                                    points="0 0, 10 3.5, 0 7"
                                    className="fill-slate-900 dark:fill-slate-200"
                                    style={{ fill: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a' }}
                                />
                            </marker>
                            {/* Open Arrow */}
                            <marker id="arrow-open" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polyline
                                    points="0 0, 10 3.5, 0 7"
                                    fill="none"
                                    className="stroke-slate-900 dark:stroke-slate-200"
                                    strokeWidth="1.5"
                                    style={{ stroke: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a' }}
                                />
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
                                    style={{
                                        stroke: selectedId === l.id
                                            ? (document.documentElement.classList.contains('dark') ? '#4f46e5' : '#818cf8')
                                            : (document.documentElement.classList.contains('dark') ? '#334155' : '#cbd5e1')
                                    }}
                                />
                                {/* Invisible Hit Area for Hover - MAXIMIZED for easier access - 180px width */}
                                <rect
                                    x={l.x - 100}
                                    y={HEADER_HEIGHT}
                                    width="200"
                                    height="100%"
                                    fill="transparent"
                                    className={`${pendingPlacement || pendingConnectionStart ? 'pointer-events-none' : 'cursor-crosshair'}`}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        saveHistory();
                                        const { y } = getCanvasCoords(e);
                                        const newMessage: Message = {
                                            id: generateId(),
                                            fromId: l.id,
                                            toId: l.id, // SELF MESSAGE
                                            y: snapY(y),
                                            label: 'message()',
                                            lineStyle: defaultLineStyle,
                                            arrowStyle: defaultArrowStyle
                                        };
                                        setMessages(prev => [...prev.filter(m => m.y !== newMessage.y), newMessage]);
                                        setSelectedId(newMessage.id);
                                        addToast('Self-Message Created', 'success');
                                    }}
                                />    </g>
                        ))}

                        {/* Activation Boxes */}
                        {activationBoxes.map(box => (
                            <rect
                                key={box.id}
                                x={box.x - 5 + (box.depth * 5)} // Center (width 10, offset 5 left). Plus depth offset.
                                y={box.y}
                                width={10}
                                height={box.height}
                                className="fill-white dark:fill-gray-600 stroke-slate-900 dark:stroke-slate-200"
                                strokeWidth="1"
                            />
                        ))}

                        {/* Messages */}
                        {messages.map((m, i) => {
                            // --- SPECIAL ITEMS (DIVIDER, NOTE ACROSS, FRAGMENT) ---
                            if (m.type && ['DIVIDER', 'NOTE_ACROSS', 'FRAGMENT'].includes(m.type)) {
                                const minX = lifelines.length > 0 ? Math.min(...lifelines.map(l => l.x)) : 100;
                                const maxX = lifelines.length > 0 ? Math.max(...lifelines.map(l => l.x)) : 500;

                                // Default Dimensions
                                // const minX = lifelines.length > 0 ? Math.min(...lifelines.map(l => l.x)) : 100;
                                // const maxX = lifelines.length > 0 ? Math.max(...lifelines.map(l => l.x)) : 500;

                                // Default Dimensions (Global deprecated, now local)
                                const defaultLeft = lifelines.length > 0 ? Math.min(...lifelines.map(l => l.x)) - 30 : 50;
                                const defaultWidth = 200; // New default

                                // Use Custom or Default
                                const left = m.customLeft ?? defaultLeft;
                                const width = m.customWidth ?? defaultWidth;

                                const isHovered = hoveredMessageId === m.id;
                                const isSelected = selectedId === m.id;
                                const height = m.height || 60; // Default height for fragment

                                // DIVIDER
                                if (m.type === 'DIVIDER') {
                                    const hasCustom = m.customLeft !== undefined;
                                    const x1 = hasCustom ? m.customLeft! : 0;
                                    const width = hasCustom ? (m.customWidth || 1000) : '100%';

                                    // If using percentage, x2 is 100%. If pixels, x2 is x1 + width
                                    const x2 = hasCustom ? (x1 + (width as number)) : '100%';

                                    // Dynamic Content Centering if no custom position
                                    let labelX: number | string = x1;
                                    let labelWidth: number | string = width;

                                    if (!hasCustom && lifelines.length > 0) {
                                        // Center between first and last actor
                                        const minX = Math.min(...lifelines.map(l => l.x));
                                        const maxX = Math.max(...lifelines.map(l => l.x));
                                        const center = (minX + maxX) / 2;
                                        labelX = center - 150; // Half of 300px width
                                        labelWidth = 300;
                                    } else if (!hasCustom) {
                                        // Fallback usually not needed if actors exist
                                        labelX = 0;
                                        labelWidth = '100%';
                                    }

                                    return (
                                        <g
                                            className={`pointer-events-auto ${editingId === m.id ? 'cursor-default' : 'cursor-ns-resize'}`}
                                            onMouseDown={(e) => {
                                                if (editingId === m.id) return;
                                                handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                            }}
                                            onMouseEnter={() => setHoveredMessageId(m.id)}
                                            onMouseLeave={() => setHoveredMessageId(null)}
                                        >
                                            {/* Line */}
                                            <line
                                                x1={x1} y1={m.y}
                                                x2={x2} y2={m.y}
                                                className={`transition-colors ${selectedId === m.id ? 'stroke-indigo-400' : 'stroke-indigo-300 dark:stroke-indigo-400'}`}
                                                strokeWidth="4"
                                            // strokeDasharray="10,10" // Removed dash for visibility
                                            />
                                            {/* Centered Label - Draggable */}
                                            <foreignObject x={labelX} y={m.y - 20} width={labelWidth} height={40} style={{ pointerEvents: 'none' }}>
                                                <div className="flex justify-center w-full">
                                                    <span
                                                        className={`bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-500 px-3 py-1 rounded text-xs font-bold text-indigo-600 dark:text-indigo-200 shadow-sm transition-all pointer-events-auto cursor-ns-resize hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedId === m.id ? 'ring-2 ring-indigo-400' : ''}`}
                                                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(m.id); }}
                                                        onMouseDown={(e) => {
                                                            if (editingId === m.id) return;
                                                            handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                                        }}
                                                    >
                                                        {editingId === m.id ? (
                                                            <input
                                                                autoFocus
                                                                onFocus={(e) => e.target.select()}
                                                                className="bg-transparent text-center outline-none min-w-[50px]"
                                                                defaultValue={m.label}
                                                                onBlur={(e) => { setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, label: e.target.value } : msg)); setEditingId(null); saveHistory(); }}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                onMouseDown={(e) => e.stopPropagation()} // Stop drag when editing
                                                            />
                                                        ) : m.label}
                                                    </span>
                                                </div>
                                            </foreignObject>
                                        </g>
                                    );
                                }

                                {/* NOTE ACROSS */ }
                                if (m.type === 'NOTE_ACROSS') {
                                    return (
                                        <g
                                            className={`pointer-events-auto ${editingId === m.id ? 'cursor-default' : 'cursor-ns-resize'}`}
                                            onMouseDown={(e) => {
                                                if (editingId === m.id) return;
                                                handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                            }}
                                            onMouseEnter={() => setHoveredMessageId(m.id)}
                                            onMouseLeave={() => setHoveredMessageId(null)}
                                        >
                                            <foreignObject x={left} y={m.y - 15} width={width} height={40}>
                                                <div
                                                    className={`bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 text-center p-2 rounded shadow-sm text-xs text-slate-700 dark:text-slate-300 cursor-text transition-all ${selectedId === m.id ? 'ring-2 ring-indigo-400' : ''}`}
                                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(m.id); }}
                                                    onMouseDown={(e) => { e.stopPropagation(); setSelectedId(m.id); }} // Click to select
                                                >
                                                    {editingId === m.id ? (
                                                        <input
                                                            autoFocus
                                                            className="bg-transparent text-center outline-none w-full"
                                                            defaultValue={m.label}
                                                            onBlur={(e) => { setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, label: e.target.value } : msg)); setEditingId(null); saveHistory(); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                        />
                                                    ) : m.label}
                                                </div>
                                            </foreignObject>


                                        </g>
                                    );
                                }

                                {/* FRAGMENT (ALT/ELSE) */ }
                                if (m.type === 'FRAGMENT') {
                                    return (
                                        <g
                                            className={`pointer-events-auto ${editingId === m.id ? 'cursor-default' : 'cursor-ns-resize'}`}
                                            onMouseDown={(e) => {
                                                if (editingId === m.id) return;
                                                handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                            }}
                                            onMouseEnter={() => setHoveredMessageId(m.id)}
                                            onMouseLeave={() => setHoveredMessageId(null)}
                                        >
                                            <g>
                                                <rect
                                                    x={left} y={m.y} width={width} height={height}
                                                    fill="transparent"
                                                    className={`stroke-2 transition-colors ${selectedId === m.id ? 'stroke-indigo-500' : 'stroke-slate-400 dark:stroke-slate-500'}`}
                                                />
                                                <path d={`M ${left} ${m.y} L ${left + 70} ${m.y} L ${left + 80} ${m.y + 20} L ${left} ${m.y + 20} Z`}
                                                    className="fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-500"
                                                    strokeWidth="1"
                                                />
                                                <text
                                                    x={left + 5} y={m.y + 14}
                                                    className="text-[11px] font-bold fill-slate-600 dark:fill-slate-300 cursor-text"
                                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(m.id); }}
                                                >
                                                    {editingId === m.id ? '...' : (m.label || 'alt')}
                                                </text>
                                                {editingId === m.id && (
                                                    <foreignObject x={left + 5} y={m.y} width={60} height={20}>
                                                        <input
                                                            autoFocus
                                                            className="w-full h-full bg-white dark:bg-slate-900 text-[11px] font-bold outline-none border border-indigo-500"
                                                            defaultValue={m.label}
                                                            onBlur={(e) => { setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, label: e.target.value } : msg)); setEditingId(null); saveHistory(); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                        />
                                                    </foreignObject>
                                                )}

                                                <text x={left + 10} y={m.y + 35} className="text-xs fill-slate-500 italic">[{m.content || 'condition'}]</text>

                                                {/* Else Divider */}
                                                <g transform={`translate(0, ${m.elseOffset || (height / 2)})`}>
                                                    <line x1={left} y1={m.y} x2={left + width} y2={m.y}
                                                        className="stroke-slate-400 dark:stroke-slate-600 stroke-1" strokeDasharray="5,5" />
                                                    <text x={left + 10} y={m.y + 15} className="text-xs fill-slate-500 italic">[else]</text>

                                                    {/* Else Drag Handle */}
                                                    {isSelected && (
                                                        <rect
                                                            x={left} y={m.y - 5} width={width} height={10}
                                                            fill="transparent"
                                                            className="cursor-col-resize hover:fill-indigo-500/10 cursor-ns-resize"
                                                            onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_RESIZE', m.id, 'else')}
                                                        />
                                                    )}
                                                </g>
                                            </g>


                                            {/* Resize Handles (Only when selected) */}
                                            {isSelected && (
                                                <g>
                                                    {/* Left Handle */}
                                                    <rect
                                                        x={left - 5} y={m.y} width={5} height={height}
                                                        fill="transparent"
                                                        className="cursor-ew-resize hover:fill-indigo-500/20"
                                                        onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_RESIZE', m.id, 'left')}
                                                    />
                                                    {/* Right Handle */}
                                                    <rect
                                                        x={left + width} y={m.y} width={5} height={height}
                                                        fill="transparent"
                                                        className="cursor-ew-resize hover:fill-indigo-500/20"
                                                        onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_RESIZE', m.id, 'right')}
                                                    />
                                                    {/* Bottom Handle */}
                                                    <rect
                                                        x={left} y={m.y + height} width={width} height={5}
                                                        fill="transparent"
                                                        className="cursor-ns-resize hover:fill-indigo-500/20"
                                                        onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_RESIZE', m.id, 'bottom')}
                                                    />
                                                    {/* Bottom-Right Handle (Corner) */}
                                                    <rect
                                                        x={left + width} y={m.y + height} width={8} height={8}
                                                        fill="white" stroke="blue" strokeWidth={1}
                                                        className="cursor-nwse-resize"
                                                        onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_RESIZE', m.id, 'bottom-right')}
                                                    />
                                                    {/* Bottom-Left Handle (Corner) */}
                                                    <rect
                                                        x={left - 8} y={m.y + height} width={8} height={8}
                                                        fill="white" stroke="blue" strokeWidth={1}
                                                        className="cursor-nesw-resize"
                                                        onMouseDown={(e) => handleMouseDown(e, 'MESSAGE_RESIZE', m.id, 'bottom-left')}
                                                    />
                                                </g>
                                            )}
                                        </g>
                                    );
                                }


                            }

                            const from = lifelines.find(l => l.id === m.fromId);
                            const to = lifelines.find(l => l.id === m.toId);
                            if (!from || !to) return null;

                            const isHovered = hoveredMessageId === m.id;
                            const markerId = m.arrowStyle === 'none' ? undefined : (m.arrowStyle === 'open' ? 'url(#arrow-open)' : 'url(#arrow-filled)');
                            const dashArray = m.lineStyle === 'dashed' ? '5,5' : undefined;

                            // SELF MESSAGE (LOOP)
                            if (from.id === to.id) {
                                return (
                                    <g
                                        key={m.id}
                                        className={`pointer-events-auto ${editingId === m.id ? 'cursor-default' : 'cursor-ns-resize'}`}
                                        onMouseDown={(e) => {
                                            if (editingId === m.id) return;
                                            handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                        }}
                                        onMouseEnter={() => setHoveredMessageId(m.id)}
                                        onMouseLeave={() => setHoveredMessageId(null)}
                                    >
                                        {/* Interaction Loop Area (Increased Hit Area) */}
                                        {/* Interaction Loop Area (Increased Hit Area) */}
                                        <path
                                            d={`M ${from.x} ${m.y} L ${from.x + 60} ${m.y} L ${from.x + 60} ${m.y + 60} L ${from.x} ${m.y + 60}`}
                                            stroke="transparent"
                                            strokeWidth="40"
                                            fill="none"
                                        />

                                        {/* Visible Loop */}
                                        <path
                                            d={`M ${from.x} ${m.y} L ${from.x + 60} ${m.y} L ${from.x + 60} ${m.y + 60} L ${from.x} ${m.y + 60}`}
                                            className={`
                                            stroke-2 transition-all fill-none
                                            ${selectedId === m.id ? 'stroke-indigo-500 dark:stroke-indigo-400 stroke-[3px]' : 'stroke-slate-900 dark:stroke-slate-200'}
                                        `}
                                            strokeDasharray={dashArray}
                                            markerEnd={markerId}
                                            style={{
                                                stroke: selectedId === m.id
                                                    ? (document.documentElement.classList.contains('dark') ? '#818cf8' : '#6366f1')
                                                    : (document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a')
                                            }}
                                        />

                                        {/* Auto-Numbering Badge (Loop) */}
                                        {showSequenceNumbers && (
                                            <g transform={`translate(${from.x - 15}, ${m.y + 10})`}>
                                                <circle r="8" className="fill-slate-200 dark:fill-slate-700 stroke-slate-400 dark:stroke-slate-600" />
                                                <text
                                                    textAnchor="middle" dy="3"
                                                    className="text-[10px] fill-slate-700 dark:fill-slate-300 font-mono font-bold"
                                                    style={{ fontSize: '10px' }}
                                                >
                                                    {i + 1}
                                                </text>
                                            </g>
                                        )}

                                        {/* Controls (Above Loop) */}
                                        {(isHovered || editingId === m.id || selectedId === m.id) && (
                                            <foreignObject x={from.x + 60} y={m.y - 15} width={180} height={30}>
                                                <div className="flex justify-center gap-1">
                                                    {/* Line Style Toggle */}
                                                    <button
                                                        className="w-5 h-5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center hover:border-indigo-500 shadow-sm"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            const nextLineStyle = m.lineStyle === 'solid' ? 'dashed' : 'solid';
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, lineStyle: nextLineStyle } : msg));
                                                        }}
                                                    >
                                                        {m.lineStyle === 'solid' ? <Lucide.Minus className="w-3 h-3" /> : <Lucide.MoreHorizontal className="w-3 h-3" />}
                                                    </button>

                                                    {/* Arrow Style Toggle */}
                                                    <button
                                                        className="w-5 h-5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center hover:border-indigo-500 shadow-sm"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            const nextStyle = m.arrowStyle === 'filled' ? 'open' : (m.arrowStyle === 'open' ? 'none' : 'filled');
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, arrowStyle: nextStyle } : msg));
                                                        }}
                                                    >
                                                        {m.arrowStyle === 'filled' ? <Lucide.ChevronRight className="w-3 h-3" /> : (m.arrowStyle === 'open' ? <Lucide.ChevronRight className="w-3 h-3 text-slate-400" /> : <Lucide.X className="w-3 h-3" />)}
                                                    </button>

                                                    {/* Add Note Button */}
                                                    <button
                                                        className="w-5 h-5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-full flex items-center justify-center hover:border-yellow-500 shadow-sm text-yellow-600 dark:text-yellow-400"
                                                        title={m.note ? "Remove Note" : "Add Note"}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            if (m.note) {
                                                                setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: undefined } : msg));
                                                            } else {
                                                                setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: 'New Note', noteColor: 'yellow' } : msg));
                                                            }
                                                        }}
                                                    >
                                                        <Lucide.StickyNote className="w-3 h-3" />
                                                    </button>

                                                    {/* Activate/Deactivate Toggles */}
                                                    <button
                                                        className={`w-5 h-5 border rounded-full flex items-center justify-center shadow-sm ${m.isActivate ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500 text-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}
                                                        title={m.isActivate ? "Cancel Activation" : "Activate Target"}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, isActivate: !msg.isActivate } : msg));
                                                        }}
                                                    >
                                                        <Lucide.ArrowDownToLine className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        className={`w-5 h-5 border rounded-full flex items-center justify-center shadow-sm ${m.isDeactivate ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500 text-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}
                                                        title={m.isDeactivate ? "Cancel Deactivation" : "Deactivate Source"}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, isDeactivate: !msg.isDeactivate } : msg));
                                                        }}
                                                    >
                                                        <Lucide.ArrowUpFromLine className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </foreignObject>
                                        )}

                                        {/* Self Message Note Rendering */}
                                        {(m.note !== undefined && m.note !== null) && (
                                            <foreignObject
                                                x={from.x + 80 + ((m.label?.length || 0) * 7)}
                                                y={m.y + 30}
                                                width={150}
                                                height={60}
                                                className="overflow-visible"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="group relative w-full h-full">
                                                    {editingId === `note-${m.id}` ? (
                                                        <textarea
                                                            autoFocus
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full h-full bg-yellow-100 dark:bg-yellow-900/80 text-xs p-1 border border-yellow-300 rounded shadow-sm resize-none outline-none text-slate-800 dark:text-slate-100 placeholder-yellow-700/50"
                                                            value={m.note}
                                                            onChange={(e) => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: e.target.value } : msg))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); setEditingId(null); saveHistory(); }
                                                                if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                                                            }}
                                                            onBlur={() => { setEditingId(null); saveHistory(); }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-full h-full bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-700/50 p-1 text-xs text-slate-600 dark:text-slate-300 overflow-hidden text-center flex items-center justify-center cursor-text hover:bg-yellow-100 dark:hover:bg-yellow-900/60 transition-colors relative"
                                                            onDoubleClick={(e) => { e.stopPropagation(); setEditingId(`note-${m.id}`); }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                        >
                                                            {m.note}
                                                            {/* Remove Note Button */}
                                                            <button
                                                                className="absolute -top-2 -right-2 w-4 h-4 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow transition-opacity"
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: undefined } : msg));
                                                                }}
                                                            >
                                                                <Lucide.X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </foreignObject>
                                        )}

                                        {/* Label (Inside Loop) - Better Placed */}
                                        <foreignObject x={from.x + 10} y={m.y + 10} width={250} height={40}>
                                            <div className="flex justify-start items-center h-full group">
                                                {/* Delete Button REMOVED by user request */}
                                                {editingId === m.id ? (
                                                    <input
                                                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking input
                                                        autoFocus
                                                        onFocus={(e) => e.target.select()}
                                                        className="bg-white dark:bg-slate-800 border rounded px-1 text-xs outline-none shadow-lg min-w-[50px]"
                                                        defaultValue={m.label}
                                                        style={{ color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a' }}
                                                        onBlur={(e) => {
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, label: e.target.value } : msg));
                                                            setEditingId(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            e.stopPropagation();
                                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                                e.currentTarget.blur();
                                                                setEditingId(null);
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className="font-bold text-xs select-none truncate px-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-text"
                                                        title={m.label}
                                                        style={{ color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a' }}
                                                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(m.id); }}
                                                    >
                                                        {m.label}
                                                    </span>
                                                )}
                                            </div>
                                        </foreignObject>
                                    </g>
                                );
                            }

                            // STANDARD MESSAGE (A -> B)
                            return (
                                <g
                                    key={m.id}
                                    className={`pointer-events-auto ${editingId === m.id ? 'cursor-default' : 'cursor-ns-resize'}`}
                                    onMouseDown={(e) => {
                                        if (editingId === m.id) return; // Disable drag if editing
                                        handleMouseDown(e, 'MESSAGE_MOVE', m.id);
                                    }}
                                    onMouseEnter={() => {
                                        console.log(`[MouseEnter] Msg: ${m.id}`);
                                        setHoveredMessageId(m.id);
                                    }}
                                    onMouseLeave={() => setHoveredMessageId(null)}
                                >
                                    {/* Interaction Hit Area (Increased Hit Area) */}
                                    <line x1={from.x} y1={m.y} x2={to.x} y2={m.y} stroke="transparent" strokeWidth="60" />

                                    {/* Visible Line */}
                                    <line
                                        x1={from.x} y1={m.y} x2={to.x} y2={m.y}
                                        className={`
                                        stroke-2 transition-all
                                        ${selectedId === m.id ? 'stroke-indigo-500 dark:stroke-indigo-400 stroke-[3px]' : 'stroke-slate-900 dark:stroke-slate-200'}
                                    `}
                                        strokeDasharray={dashArray}
                                        markerEnd={markerId}
                                        style={{
                                            stroke: selectedId === m.id
                                                ? (document.documentElement.classList.contains('dark') ? '#818cf8' : '#6366f1')
                                                : (document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a')
                                        }}
                                    />

                                    {/* Auto-Numbering Badge (Standard) */}
                                    {showSequenceNumbers && (
                                        <g transform={`translate(${from.x + (to.x > from.x ? 15 : -15)}, ${m.y - 10})`}>
                                            <circle r="8" className="fill-slate-200 dark:fill-slate-700 stroke-slate-400 dark:stroke-slate-600" />
                                            <text
                                                textAnchor="middle" dy="3"
                                                className="text-[10px] fill-slate-700 dark:fill-slate-300 font-mono font-bold"
                                                style={{ fontSize: '10px' }}
                                            >
                                                {i + 1}
                                            </text>
                                        </g>
                                    )}

                                    {/* Controls (Only visible on hover/edit or SELECTED) */}
                                    {(isHovered || editingId === m.id || selectedId === m.id) && (
                                        <foreignObject x={Math.min(from.x, to.x)} y={m.y - 55} width={Math.abs(to.x - from.x)} height={30}>
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

                                                {/* Add Note Button */}
                                                <button
                                                    className="w-5 h-5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-full flex items-center justify-center hover:border-yellow-500 shadow-sm text-yellow-600 dark:text-yellow-400"
                                                    title={m.note ? "Remove Note" : "Add Note"}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        if (m.note) {
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: undefined } : msg));
                                                        } else {
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: 'New Note', noteColor: 'yellow' } : msg));
                                                        }
                                                    }}
                                                >
                                                    <Lucide.StickyNote className="w-3 h-3" />
                                                </button>

                                                {/* Activate/Deactivate Toggles */}
                                                <button
                                                    className={`w-5 h-5 border rounded-full flex items-center justify-center shadow-sm ${m.isActivate ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500 text-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}
                                                    title={m.isActivate ? "Cancel Activation" : "Activate Target"}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, isActivate: !msg.isActivate } : msg));
                                                    }}
                                                >
                                                    <Lucide.ArrowDownToLine className="w-3 h-3" />
                                                </button>
                                                <button
                                                    className={`w-5 h-5 border rounded-full flex items-center justify-center shadow-sm ${m.isDeactivate ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500 text-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-500'}`}
                                                    title={m.isDeactivate ? "Cancel Deactivation" : "Deactivate Source"}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, isDeactivate: !msg.isDeactivate } : msg));
                                                    }}
                                                >
                                                    <Lucide.ArrowUpFromLine className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </foreignObject>
                                    )}

                                    {/* Note Rendering - Moved BELOW message to avoid overlap */}
                                    {(m.note !== undefined && m.note !== null) && (
                                        <foreignObject
                                            x={Math.max(from.x, to.x) + 40}
                                            y={m.y}
                                            width={150}
                                            height={60}
                                            className="overflow-visible"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="group relative w-full h-full">
                                                {editingId === `note-${m.id}` ? (
                                                    <textarea
                                                        autoFocus
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full h-full bg-yellow-100 dark:bg-yellow-900/80 text-xs p-1 border border-yellow-300 rounded shadow-sm resize-none outline-none text-slate-800 dark:text-slate-100 placeholder-yellow-700/50"
                                                        value={m.note}
                                                        onChange={(e) => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: e.target.value } : msg))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); setEditingId(null); saveHistory(); }
                                                            if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                                                        }}
                                                        onBlur={() => { setEditingId(null); saveHistory(); }}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-full h-full bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-700/50 p-1 text-xs text-slate-600 dark:text-slate-300 overflow-hidden text-center flex items-center justify-center cursor-text hover:bg-yellow-100 dark:hover:bg-yellow-900/60 transition-colors relative"
                                                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(`note-${m.id}`); }}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    >
                                                        {m.note}
                                                        {/* Remove Note Button */}
                                                        <button
                                                            className="absolute -top-2 -right-2 w-4 h-4 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow transition-opacity"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, note: undefined } : msg));
                                                            }}
                                                        >
                                                            <Lucide.X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </foreignObject>
                                    )}

                                    {/* Note Rendering */}


                                    {/* Label Bubble */}
                                    <foreignObject x={Math.min(from.x, to.x)} y={m.y - 35} width={Math.abs(to.x - from.x)} height={40}>
                                        <div className="flex justify-center items-center h-full group">
                                            {/* Delete Button REMOVED by user request */}
                                            {editingId === m.id ? (
                                                <input
                                                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking input
                                                    autoFocus
                                                    onFocus={(e) => e.target.select()}
                                                    className="bg-white dark:bg-slate-800 border rounded px-1 text-xs outline-none shadow-lg min-w-[50px] text-center"
                                                    defaultValue={m.label}
                                                    style={{ color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a' }}
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
                                                    style={{ color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#0f172a' }}
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

                        {/* Floating Handle (Only when hovering a lifeline and NOT dragging AND NOT pending connection AND NOT hovering a message) */}
                        {/* Floating Handle (Only when hovering a lifeline and (NOT dragging OR dragging to create) AND NOT pending connection AND NOT hovering a message) */}
                        {((!dragState || dragState.type === 'MESSAGE_CREATE') && !pendingConnectionStart && hoveredLifelineId && !hoveredMessageId) && (
                            <g transform={`translate(${lifelines.find(l => l.id === hoveredLifelineId)?.x || 0}, ${snapY(hoveredY)})`} className="pointer-events-auto cursor-crosshair">
                                {/* Visual Handle - Increased Size */}
                                <circle r="18" fill="indigo" className="fill-indigo-500 opacity-80 shadow-sm" />
                                <text textAnchor="middle" dy="8" fill="white" fontSize="24" fontWeight="bold">+</text>

                                {/* Interactive Area Trigger - MAXIMIZED RADIUS 40px */}
                                <circle
                                    r="40"
                                    fill="transparent"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleMouseDown(e, 'MESSAGE_CREATE', hoveredLifelineId);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        saveHistory();
                                        const { y } = getCanvasCoords(e);
                                        const newMessage: Message = {
                                            id: generateId(),
                                            fromId: hoveredLifelineId,
                                            toId: hoveredLifelineId, // SELF MESSAGE
                                            y: snapY(y),
                                            label: 'message()',
                                            lineStyle: defaultLineStyle,
                                            arrowStyle: defaultArrowStyle
                                        };
                                        setMessages(prev => [...prev.filter(m => m.y !== newMessage.y), newMessage]);
                                        setSelectedId(newMessage.id);
                                        addToast('Self-Message Created', 'success');
                                    }}
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
                                className="stroke-indigo-500 stroke-2 stroke-dashed pointer-events-none"
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
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingId(l.id); // Enable renaming
                                }}
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

                                    {/* Delete Button (Visible on Hover) */}
                                    <button
                                        className="absolute -top-2 -right-2 bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-slate-200 dark:border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            saveHistory();
                                            setLifelines(prev => prev.filter(line => line.id !== l.id));
                                            setMessages(prev => prev.filter(m => m.fromId !== l.id && m.toId !== l.id));
                                        }}
                                        title="Delete Actor"
                                    >
                                        <Lucide.X className="w-3 h-3" />
                                    </button>
                                    {/* Default Box has empty 24px height spacer implicitly via flex/gap or just centers text if no icon */}

                                    {editingId === l.id ? (
                                        <input
                                            autoFocus
                                            onFocus={(e) => e.target.select()}
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

                                    {/* Delete Button REMOVED by user request */}
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



                {/* Expand Canvas Button */}
                <div className="fixed bottom-6 right-6 z-30">
                    <button
                        className="p-3 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all text-xs font-bold flex flex-col items-center gap-1"
                        onClick={() => {
                            saveHistory();
                            setCanvasHeight(prev => prev + 500);
                            // No Toast
                        }}
                        title="Expand Canvas Height"
                    >
                        <Lucide.ChevronsDown className="w-5 h-5" />
                    </button>
                </div>

                {/* Export Modal */}
                {
                    showExportModal && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-[600px] flex flex-col max-h-[80vh] border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-lg">
                                    <h3 className="font-bold flex items-center gap-2">
                                        <Lucide.Code className="w-4 h-4 text-indigo-500" />
                                        Export PlantUML
                                    </h3>
                                    <button onClick={() => setShowExportModal(false)} className="hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded">
                                        <Lucide.X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-0 flex-1 relative">
                                    <textarea
                                        className="w-full h-[400px] bg-slate-50 dark:bg-slate-950 p-4 font-mono text-sm resize-none outline-none text-slate-700 dark:text-slate-300"
                                        value={plantUMLCode}
                                        readOnly
                                    />
                                </div>
                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950 rounded-b-lg">
                                    <button
                                        onClick={() => setShowExportModal(false)}
                                        className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(plantUMLCode);
                                            addToast('Copied to clipboard!', 'success');
                                            setShowExportModal(false);
                                        }}
                                        className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded font-medium shadow-sm transition-colors flex items-center gap-2"
                                    >
                                        <Lucide.Copy className="w-4 h-4" />
                                        Copy Code
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </div >
    );
};

export default EasyUML;
