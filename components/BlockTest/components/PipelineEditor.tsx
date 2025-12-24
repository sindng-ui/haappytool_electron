import React, { useState, useEffect, useCallback } from 'react';
import { Pipeline, PipelineItem, CommandBlock } from '../types';
import * as Lucide from 'lucide-react';

interface PipelineEditorProps {
    pipeline: Pipeline;
    blocks: CommandBlock[];
    onChange: (pipeline: Pipeline) => void;
    onRun: () => void;
    hasResults?: boolean;
    onViewResults?: () => void;
}

// Simple Undo/Redo Hook
function useUndoRedo<T>(initialState: T, onChange: (state: T) => void): [T, (newState: T) => void, () => void, () => void, boolean, boolean] {
    const [history, setHistory] = useState<T[]>([initialState]);
    const [index, setIndex] = useState(0);

    const setState = useCallback((newState: T) => {
        setHistory(prev => {
            const next = prev.slice(0, index + 1);
            next.push(newState);
            return next;
        });
        setIndex(prev => prev + 1);
        onChange(newState);
    }, [index, onChange]);

    const undo = useCallback(() => {
        if (index > 0) {
            setIndex(prev => prev - 1);
            onChange(history[index - 1]);
        }
    }, [index, history, onChange]);

    const redo = useCallback(() => {
        if (index < history.length - 1) {
            setIndex(prev => prev + 1);
            onChange(history[index + 1]);
        }
    }, [index, history, onChange]);

    return [history[index], setState, undo, redo, index > 0, index < history.length - 1];
}

const PipelineEditor: React.FC<PipelineEditorProps> = ({ pipeline, blocks, onChange, onRun, hasResults, onViewResults }) => {
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Toast State
    const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

    const showToast = (message: string) => {
        setToast({ message, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // Undo/Redo Wrapper
    const [currentPipeline, setPipeline, undo, redo, canUndo, canRedo] = useUndoRedo(pipeline, onChange);

    const updateItems = (newItems: PipelineItem[]) => {
        setPipeline({ ...currentPipeline, items: newItems });
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (canRedo) redo();
                } else {
                    e.preventDefault();
                    if (canUndo) undo();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (canRedo) redo();
                return;
            }

            // Deselect on Escape
            if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedIds(new Set());
                return;
            }

            // Delete (Backpsace / Delete only, NO Escape)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedIds.size > 0) {
                    e.preventDefault();
                    // Recursive deletion function
                    const deleteFromList = (items: PipelineItem[]): PipelineItem[] => {
                        return items
                            .filter(item => !selectedIds.has(item.id))
                            .map(item => {
                                if (item.children) {
                                    return {
                                        ...item,
                                        children: deleteFromList(item.children)
                                    };
                                }
                                return item;
                            });
                    };

                    const newItems = deleteFromList(currentPipeline.items);
                    updateItems(newItems);
                    setSelectedIds(new Set());
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, currentPipeline, undo, redo, canUndo, canRedo]);

    // Selection Handlers - STRICT CONTIGUOUS LOGIC
    const handleSelect = (id: string, multi: boolean, siblings: PipelineItem[]) => {
        if (multi) {
            const next = new Set(selectedIds);

            if (next.has(id)) {
                next.delete(id);
                setSelectedIds(next);
            } else {
                if (next.size > 0) {
                    const selectedSiblingIndices = siblings
                        .map((item, idx) => next.has(item.id) ? idx : -1)
                        .filter(idx => idx !== -1);

                    if (selectedSiblingIndices.length !== next.size) {
                        showToast("Cannot select items from different groups.");
                        return;
                    }

                    const newIndex = siblings.findIndex(item => item.id === id);
                    const allIndices = [...selectedSiblingIndices, newIndex].sort((a, b) => a - b);
                    const isContiguous = allIndices.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1);

                    if (!isContiguous) {
                        showToast("Selection must be contiguous!");
                        return;
                    }
                }

                next.add(id);
                setSelectedIds(next);
            }
        } else {
            setSelectedIds(new Set([id]));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleGroup = () => {
        if (selectedIds.size === 0) return;

        const groupInList = (items: PipelineItem[]): { items: PipelineItem[], success: boolean } => {
            const selectedIndices = items
                .map((item, idx) => selectedIds.has(item.id) ? idx : -1)
                .filter(idx => idx !== -1)
                .sort((a, b) => a - b);

            if (selectedIndices.length > 0) {
                const isContiguous = selectedIndices.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1);

                if (isContiguous && selectedIndices.length === selectedIds.size) {
                    const firstIndex = selectedIndices[0];
                    const selectedItems = items.slice(firstIndex, firstIndex + selectedIndices.length);

                    const newLoop: PipelineItem = {
                        id: `loop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'loop',
                        loopCount: 2,
                        children: selectedItems
                    };

                    const newItems = [...items];
                    newItems.splice(firstIndex, selectedIndices.length, newLoop);
                    return { items: newItems, success: true };
                }
            }

            let grouped = false;
            const nextItems = items.map(item => {
                if (item.type === 'loop' && item.children) {
                    const res = groupInList(item.children);
                    if (res.success) {
                        grouped = true;
                        return { ...item, children: res.items };
                    }
                }
                return item;
            });

            return { items: nextItems, success: grouped };
        };

        const result = groupInList(currentPipeline.items);
        if (result.success) {
            updateItems(result.items);
            setSelectedIds(new Set());
        } else {
            console.warn("Could not group.");
        }
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void) => {
        e.preventDefault();
        e.stopPropagation();

        const data = e.dataTransfer.getData('application/json');
        if (!data) return;

        try {
            const payload = JSON.parse(data);
            let newItem: PipelineItem | null = null;

            if (payload.type === 'add_block') {
                newItem = {
                    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'block',
                    blockId: payload.blockId
                };
            }

            if (newItem) {
                const targetList = parentItems ? [...parentItems] : [...currentPipeline.items];
                if (targetIndex !== undefined) {
                    targetList.splice(targetIndex, 0, newItem);
                } else {
                    targetList.push(newItem);
                }

                if (updateParent) {
                    updateParent(targetList);
                } else {
                    updateItems(targetList);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const container = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - container.left;
        const mouseY = e.clientY - container.top;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(0.2, scale + delta), 4);
        const worldX = (mouseX - pan.x) / scale;
        const worldY = (mouseY - pan.y) / scale;
        const newPanX = mouseX - worldX * newScale;
        const newPanY = mouseY - worldY * newScale;
        setScale(newScale);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            clearSelection();
        }
        if (e.button === 0 || e.button === 1) {
            setIsPanning(true);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(prev => ({
                x: prev.x + e.movementX,
                y: prev.y + e.movementY
            }));
        }
    };

    const handleMouseUp = () => setIsPanning(false);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 relative">
            {/* Toast Notification */}
            {toast.visible && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 pointer-events-none">
                    <div className="bg-red-500/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-xl border border-red-400 font-bold flex items-center gap-2">
                        <Lucide.AlertCircle size={18} />
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 shadow-md z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Lucide.Workflow size={20} className="text-indigo-400" />
                    </div>
                    <input
                        value={currentPipeline.name}
                        onChange={(e) => setPipeline({ ...currentPipeline, name: e.target.value })}
                        className="text-xl font-bold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 outline-none text-slate-100 placeholder-slate-600 transition-all font-mono"
                        placeholder="Pipeline Name"
                    />
                </div>

                <div className="flex items-center gap-4">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleGroup}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/30 transition-all text-xs font-bold uppercase tracking-wider"
                        >
                            <Lucide.Combine size={14} />
                            Group as Loop ({selectedIds.size})
                        </button>
                    )}

                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 font-mono text-xs text-slate-400">
                        <span>{Math.round(scale * 100)}%</span>
                        <button onClick={() => { setPan({ x: 0, y: 0 }); setScale(1); }} className="ml-2 hover:text-white" title="Reset View">
                            <Lucide.Maximize size={12} />
                        </button>
                    </div>
                    <button onClick={undo} disabled={!canUndo} className="p-2 text-slate-400 hover:text-white disabled:opacity-30"><Lucide.Undo2 size={18} /></button>
                    <button onClick={redo} disabled={!canRedo} className="p-2 text-slate-400 hover:text-white disabled:opacity-30"><Lucide.Redo2 size={18} /></button>

                    {hasResults && onViewResults && (
                        <button onClick={onViewResults} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 rounded-lg transition-all mr-2">
                            <Lucide.History size={16} />
                            <span>View Results</span>
                        </button>
                    )}

                    <button onClick={onRun} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-lg shadow-md hover:shadow-emerald-500/20 active:scale-95 transition-all">
                        <div className="p-1 bg-white/20 rounded-full"><Lucide.Play size={14} fill="currentColor" /></div>
                        <span>RUN PIPELINE</span>
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div
                className={`flex-1 overflow-hidden relative bg-[#0B0F19] bg-[radial-gradient(#1f2937_1px,transparent_1px)] select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ backgroundSize: `${20 * scale}px ${20 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, currentPipeline.items.length)}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    className="w-full min-h-full flex justify-center pt-20 transition-transform duration-75 ease-out origin-top-left"
                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
                >
                    <div className="relative flex flex-col items-center">
                        <GraphFlow
                            items={currentPipeline.items}
                            blocks={blocks}
                            onChange={updateItems}
                            onDrop={handleDrop}
                            selectedIds={selectedIds}
                            onSelect={handleSelect}
                            direction="row"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const GraphFlow: React.FC<{
    items: PipelineItem[];
    blocks: CommandBlock[];
    onChange: (items: PipelineItem[]) => void;
    onDrop: (e: React.DragEvent, index: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void) => void;
    selectedIds: Set<string>;
    onSelect: (id: string, multi: boolean, siblings: PipelineItem[]) => void;
    direction?: 'row' | 'col';
    isNested?: boolean;
}> = ({ items, blocks, onChange, onDrop, selectedIds, onSelect, direction = 'row', isNested = false }) => {
    const isRow = direction === 'row';

    return (
        <div className={`flex ${isRow ? 'flex-row items-start' : 'flex-col items-center'} cursor-default`}>
            {/* Start Node - Hidden if Nested */}
            {!isNested && (
                <div
                    className={`${isRow ? 'mr-2 mt-[calc(48px/2-28px)]' : 'mb-2'} relative z-10 group`}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-green-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all">
                        <Lucide.Cpu size={24} className="text-green-400" />
                    </div>
                    <div className={`absolute ${isRow ? 'top-full left-1/2 -translate-x-1/2 mt-2' : 'left-full top-1/2 -translate-y-1/2 ml-2'} text-[10px] font-bold text-green-500 tracking-wider uppercase bg-slate-900/80 px-2 py-0.5 rounded-full border border-green-900/50 backdrop-blur-sm whitespace-nowrap`}>Start</div>
                </div>
            )}

            {items.map((item, index) => (
                <div
                    key={item.id}
                    className={`flex ${isRow ? 'flex-row h-full items-start' : 'flex-col w-full items-center'} justify-center`}
                >
                    {/* Connector Wire */}
                    <div className={`${isRow ? 'mt-[24px]' : ''}`}>
                        <Wire onDrop={(e) => onDrop(e, index, items, onChange)} vertical={!isRow} />
                    </div>

                    <div className={`relative z-10 flex items-start justify-center node-appear-animation group/node ${isRow ? 'px-1 h-full' : 'py-1 w-full'}`}>
                        {item.type === 'block' ? (
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onSelect(item.id, e.ctrlKey || e.shiftKey || e.metaKey, items);
                                }}
                            >
                                <BlockNode item={item} blocks={blocks} selected={selectedIds.has(item.id)} />
                            </div>
                        ) : (
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onSelect(item.id, e.ctrlKey || e.shiftKey || e.metaKey, items);
                                }}
                            >
                                <LoopNode
                                    item={item}
                                    blocks={blocks}
                                    onChange={(newItem) => {
                                        const next = [...items];
                                        next[index] = newItem;
                                        onChange(next);
                                    }}
                                    onDrop={onDrop}
                                    selectedIds={selectedIds}
                                    onSelect={onSelect}
                                    selected={selectedIds.has(item.id)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Final Wire - Hidden if Nested */}
            {!isNested && (
                <div className={`${isRow ? 'mt-[24px]' : ''}`}>
                    <Wire onDrop={(e) => onDrop(e, items.length, items, onChange)} isLast vertical={!isRow} />
                </div>
            )}

            {/* End Node - Hidden if Nested */}
            {!isNested && (
                <div className={`${isRow ? 'ml-2 mt-[calc(48px/2-24px)]' : 'mt-2'} relative z-10 opacity-50 grayscale`} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-slate-700"></div>
                    </div>
                    <div className={`absolute ${isRow ? 'top-full left-1/2 -translate-x-1/2 mt-2' : 'left-full top-1/2 -translate-y-1/2 ml-2'} text-[10px] font-bold text-slate-600 tracking-wider uppercase`}>End</div>
                </div>
            )}
        </div>
    );
};

const Wire: React.FC<{ onDrop: (e: React.DragEvent) => void, isLast?: boolean, vertical?: boolean }> = ({ onDrop, isLast, vertical }) => {
    const baseClasses = `relative group transition-all duration-300 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.6)] cursor-crosshair z-0 flex items-center justify-center`;

    let sizeClasses = '';
    if (vertical) {
        sizeClasses = isLast
            ? 'h-16 w-1.5 border-l-2 border-dashed border-slate-700 bg-transparent hover:w-2.5'
            : 'h-8 w-1.5 bg-slate-700 hover:w-2.5';
    } else {
        sizeClasses = isLast
            ? 'w-16 h-1.5 border-t-2 border-dashed border-slate-700 bg-transparent hover:h-2.5'
            : 'w-12 h-1.5 bg-slate-700 hover:h-2.5';
    }

    return (
        <div
            className={`${baseClasses} ${sizeClasses}`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.stopPropagation(); onDrop(e); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-white opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg transition-all scale-0 group-hover:scale-100 z-20">
                <Lucide.Plus size={14} className="text-white" />
            </div>
        </div>
    );
};

const BlockNode: React.FC<{ item: PipelineItem; blocks: CommandBlock[]; selected?: boolean }> = ({ item, blocks, selected }) => {
    const block = blocks.find(b => b.id === item.blockId);
    if (!block) return <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-xl backdrop-blur-md">Unknown</div>;
    const isPredefined = block.type === 'predefined';
    return (
        <div className={`relative w-48 rounded-xl border backdrop-blur-md shadow-xl transition-all hover:scale-105 active:scale-95 cursor-default group h-[48px] ${selected ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0B0F19] bg-indigo-900/90 border-indigo-400' : isPredefined ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50' : 'bg-indigo-950/90 border-indigo-500/50 shadow-indigo-900/40'}`}>
            <div className="p-3 flex items-center gap-3 h-full">
                <div className={`p-1.5 rounded-lg ${isPredefined ? 'bg-slate-700 text-slate-300' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'}`}><Lucide.Box size={16} /></div>
                <div className="flex-1 min-w-0"><h4 className="font-bold text-sm text-slate-100 truncate">{block.name}</h4></div>
            </div>
        </div>
    );
};

const LoopNode: React.FC<{
    item: PipelineItem;
    blocks: CommandBlock[];
    onChange: (item: PipelineItem) => void;
    onDrop: (e: React.DragEvent, index: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void) => void;
    selectedIds: Set<string>;
    onSelect: (id: string, multi: boolean, siblings: PipelineItem[]) => void;
    selected?: boolean;
}> = ({ item, blocks, onChange, onDrop, selectedIds, onSelect, selected }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    // This handler acts as a proxy. 
    // If it receives a specific target (from a child Wire or Loop), it passes it up.
    // If it receives no target (from its own Container drop), it defaults to itself.
    const handleInternalDrop = (e: React.DragEvent, index: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void) => {
        if (parentItems && updateParent) {
            // Propagate the specific drop target up the chain
            onDrop(e, index, parentItems, updateParent);
        } else {
            // Default to dropping into this loop
            onDrop(e, index, item.children || [], (newChildren) => {
                onChange({ ...item, children: newChildren });
            });
        }
    };

    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        // Treat container drop as appending to the end of THIS loop
        handleInternalDrop(e, (item.children || []).length);
    };

    return (
        <div
            className={`
                min-w-[200px] rounded-2xl border-2 backdrop-blur-sm relative flex flex-col cursor-default transition-all
                ${selected ? 'border-orange-500 bg-orange-900/30 ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0B0F19]' : 'border-orange-500/40 bg-orange-950/20'}
                ${isDragOver ? 'ring-4 ring-indigo-500/50 bg-indigo-900/30 scale-105' : ''}
            `}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
            }}
            onDrop={handleContainerDrop}
        >
            {/* Header */}
            <div className="w-full bg-orange-900/40 border-b border-orange-500/20 px-4 py-3 flex items-center justify-between rounded-t-xl gap-4">
                <div className="flex items-center gap-2">
                    <Lucide.Repeat size={18} className="text-orange-500" />
                    <span className="font-bold text-orange-200">LOOP</span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-1 border border-orange-500/30">
                    <span className="text-xs text-orange-600 font-bold">x</span>
                    <input
                        type="number"
                        min="1"
                        value={item.loopCount || ''}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            onChange({ ...item, loopCount: isNaN(val) ? 0 : val });
                        }}
                        className="w-12 bg-transparent text-center outline-none text-orange-400 font-bold font-mono text-xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            {/* Internal Flow */}
            <div className="w-full px-4 py-4 flex flex-col items-center justify-center min-h-[100px]">
                {(item.children || []).length > 0 ? (
                    <GraphFlow
                        items={item.children || []}
                        blocks={blocks}
                        onChange={(newChildren) => onChange({ ...item, children: newChildren })}
                        onDrop={handleInternalDrop}
                        selectedIds={selectedIds}
                        onSelect={onSelect}
                        direction="col"
                        isNested={true}
                    />
                ) : (
                    <div className="w-full h-full min-h-[80px] rounded-xl border-2 border-dashed border-orange-500/30 bg-orange-500/5 text-orange-500/50 flex flex-col items-center justify-center pointer-events-none">
                        <Lucide.PlusCircle size={24} />
                        <span className="text-xs font-bold uppercase tracking-widest">Drop Nodes</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PipelineEditor;
