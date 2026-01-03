import React, { useState, useEffect, useCallback } from 'react';
import { Pipeline, PipelineItem, CommandBlock } from '../types';
import * as Lucide from 'lucide-react';
import { THEME } from '../theme';

interface PipelineEditorProps {
    pipeline: Pipeline;
    blocks: CommandBlock[];
    onChange: (pipeline: Pipeline) => void;
    onRun: () => void;
    hasResults?: boolean;
    onViewResults?: () => void;
    onUploadTemplate: (name: string, data: string) => Promise<{ success: boolean, path: string, url?: string }>;
}

// Simple Undo/Redo Hook
function useUndoRedo<T>(initialState: T, onChange: (state: T) => void): [T, (newState: T) => void, () => void, () => void, boolean, boolean] {
    const [history, setHistory] = useState<T[]>([initialState]);
    const [index, setIndex] = useState(0);

    const setState = useCallback((newState: T) => {
        // Prevent duplicate history entries
        const currentHead = history[index];
        if (JSON.stringify(currentHead) === JSON.stringify(newState)) return;

        setHistory(prev => {
            const next = prev.slice(0, index + 1);
            next.push(newState);
            if (next.length > 50) return next.slice(next.length - 50); // Limit history
            return next;
        });
        setIndex(prev => {
            const newIndex = prev + 1;
            return newIndex > 49 ? 49 : newIndex; // Keep index within bounds if sliced
        });
        onChange(newState);
    }, [history, index, onChange]);

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

    return [history[index] || initialState, setState, undo, redo, index > 0, index < history.length - 1];
}

const PipelineEditor: React.FC<PipelineEditorProps> = ({ pipeline, blocks, onChange, onRun, hasResults, onViewResults, onUploadTemplate }) => {
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [editingHintId, setEditingHintId] = useState<string | null>(null);

    // Toast State
    const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

    const showToast = (message: string) => {
        setToast({ message, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // Undo/Redo Wrapper
    const [currentPipeline, setPipeline, undo, redo, canUndo, canRedo] = useUndoRedo(pipeline, onChange);

    if (!currentPipeline) return <div className="p-10 text-center text-slate-500">Loading Pipeline...</div>;

    const updateItems = (newItems: PipelineItem[]) => {
        setPipeline({ ...currentPipeline, items: newItems });
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

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

            // Select All (Ctrl + A)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                const allIds = new Set<string>();
                const collectIds = (items: PipelineItem[]) => {
                    items.forEach(item => {
                        allIds.add(item.id);
                        if (item.children) collectIds(item.children); // Recurse
                    });
                };
                collectIds(currentPipeline.items);
                setSelectedIds(allIds);
                return;
            }

            // Group (Ctrl + G)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                handleGroup();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedIds(new Set());
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedIds.size > 0) {
                    e.preventDefault();
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
    const handleSelect = (id: string, multi: boolean, range: boolean, siblings: PipelineItem[]) => {
        if (range && lastClickedId) {
            const currentIndex = siblings.findIndex(item => item.id === id);
            const lastIndex = siblings.findIndex(item => item.id === lastClickedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeItems = siblings.slice(start, end + 1);

                if (multi) {
                    const next = new Set(selectedIds);
                    rangeItems.forEach(item => next.add(item.id));
                    setSelectedIds(next);
                } else {
                    setSelectedIds(new Set(rangeItems.map(item => item.id)));
                }
                return;
            }
        }

        setLastClickedId(id);

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

        // Helper to get all descendant IDs of a list of items
        const getAllDescendantIds = (items: PipelineItem[]): Set<string> => {
            const ids = new Set<string>();
            const traverse = (list: PipelineItem[]) => {
                for (const item of list) {
                    ids.add(item.id);
                    if (item.children) traverse(item.children);
                }
            };
            traverse(items);
            return ids;
        };

        const groupInList = (items: PipelineItem[]): { items: PipelineItem[], success: boolean } => {
            const selectedIndices = items
                .map((item, idx) => selectedIds.has(item.id) ? idx : -1)
                .filter(idx => idx !== -1)
                .sort((a, b) => a - b);

            if (selectedIndices.length > 0) {
                const isContiguous = selectedIndices.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1);

                if (isContiguous) {
                    // Check if we have "captured" all selected items.
                    // If selectedIds contains items that are NOT in (selectedItems U their descendants),
                    // then we are missing something from the selection (e.g. valid disjoint selection elsewhere),
                    // so we should NOT group here (or risk splitting the selection).
                    // BUT, if the "others" are just descendants of what we are grouping, it's fine!

                    const firstIndex = selectedIndices[0];
                    const selectedItems = items.slice(firstIndex, firstIndex + selectedIndices.length);
                    const capturedIds = getAllDescendantIds(selectedItems);

                    // Check if there are any selectedIds that are NOT in capturedIds
                    // We iterate over selectedIds because it's usually smaller or efficient enough.
                    let hasExtraneousSelection = false;
                    for (const id of selectedIds) {
                        if (!capturedIds.has(id)) {
                            hasExtraneousSelection = true;
                            break;
                        }
                    }

                    if (!hasExtraneousSelection) {
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
            // console.warn("Could not group.");
            showToast("Could not group. Ensure selection is contiguous.");
        }
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void, targetContainerId?: string) => {
        e.preventDefault();
        e.stopPropagation();

        const data = e.dataTransfer.getData('application/json');
        if (!data) return;

        try {
            const payload = JSON.parse(data);

            if (payload.type === 'move_item') {
                const itemId = payload.itemId;
                if (!itemId) return;

                // Find item info
                const findItemInfo = (items: PipelineItem[], containerId: string = 'root'): { item: PipelineItem, containerId: string, index: number, list: PipelineItem[] } | null => {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].id === itemId) return { item: items[i], containerId, index: i, list: items };
                        if (items[i].children) {
                            const found = findItemInfo(items[i].children!, items[i].id);
                            if (found) return found;
                        }
                    }
                    return null;
                };

                const sourceInfo = findItemInfo(currentPipeline.items);
                if (!sourceInfo) return;

                // 1. Same Container Move
                if (sourceInfo.containerId === (targetContainerId || 'root')) {
                    if (parentItems && updateParent) {
                        const newList = [...parentItems];
                        const [movedItem] = newList.splice(sourceInfo.index, 1);
                        let adjustedTarget = targetIndex;
                        if (sourceInfo.index < targetIndex) adjustedTarget--;

                        newList.splice(adjustedTarget, 0, movedItem);
                        updateParent(newList);
                    }
                }
                // 2. Cross Container Move
                else {
                    const removeFromTree = (items: PipelineItem[]): PipelineItem[] => {
                        return items.filter(item => {
                            if (item.id === itemId) return false;
                            if (item.children) item.children = removeFromTree(item.children);
                            return true;
                        });
                    };

                    let newRootItems = removeFromTree(currentPipeline.items);
                    const itemToMove = sourceInfo.item;

                    const insertIntoTree = (items: PipelineItem[], cId: string): boolean => {
                        if (cId === 'root') {
                            items.splice(targetIndex, 0, itemToMove);
                            return true;
                        }
                        for (const item of items) {
                            if (item.id === cId && item.children) {
                                item.children.splice(targetIndex, 0, itemToMove);
                                return true;
                            }
                            if (item.children) {
                                if (insertIntoTree(item.children, cId)) return true;
                            }
                        }
                        return false;
                    };

                    if (targetContainerId === 'root') {
                        newRootItems.splice(targetIndex, 0, itemToMove);
                        updateItems(newRootItems);
                    } else {
                        if (insertIntoTree(newRootItems, targetContainerId || 'root')) {
                            updateItems(newRootItems);
                        }
                    }
                }
                return;
            }

            let newItem: PipelineItem | null = null;
            if (payload.type === 'add_block') {
                const blockDef = blocks.find(b => b.id === payload.blockId);
                newItem = {
                    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'block',
                    blockId: payload.blockId,
                    logCommand: blockDef?.logCommand,
                    logFileName: blockDef?.logFileName,
                    stopCommand: blockDef?.stopCommand
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
        if (e.target === e.currentTarget) clearSelection();
        if (e.button === 0 || e.button === 1) setIsPanning(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        }
    };

    const handleMouseUp = () => setIsPanning(false);

    return (
        <div className={`flex-1 flex flex-col h-full relative ${THEME.editor.container}`}>
            {toast.visible && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 pointer-events-none">
                    <div className="bg-red-500/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-xl border border-red-400 font-bold flex items-center gap-2">
                        <Lucide.AlertCircle size={18} />
                        {toast.message}
                    </div>
                </div>
            )}

            {/* [PIPELINE EDITOR HEADER BACKGROUND] - This controls the top bar in the editor */}
            <div className={`p-1.5 flex justify-between items-center z-10 ${THEME.editor.header}`}>
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

                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleGroup}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/30 transition-all text-xs font-bold uppercase tracking-wider"
                        >
                            <Lucide.Combine size={14} />
                            Group as Loop ({selectedIds.size})
                        </button>
                    )}

                    <div className={`flex items-center gap-1 rounded-lg px-2 py-1 border font-mono text-xs ${THEME.editor.controls}`}>
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

            {/* [CANVAS BACKGROUND] - This controls the infinite canvas background */}
            <div
                className={`flex-1 overflow-hidden relative select-none ${THEME.editor.canvas.bg} ${THEME.editor.canvas.dots} ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ backgroundSize: `${20 * scale}px ${20 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, currentPipeline.items.length, undefined, undefined, 'root')}
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
                            editingHintId={editingHintId}
                            onEditHint={setEditingHintId}
                            direction="row"
                            containerId="root"
                            onUploadTemplate={onUploadTemplate}
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
    onDrop: (e: React.DragEvent, index: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void, targetContainerId?: string) => void;
    selectedIds: Set<string>;
    onSelect: (id: string, multi: boolean, range: boolean, siblings: PipelineItem[]) => void;
    editingHintId: string | null;
    onEditHint: (id: string | null) => void;
    direction?: 'row' | 'col';
    isNested?: boolean;
    containerId?: string;
    onUploadTemplate: (name: string, data: string) => Promise<{ success: boolean, path: string, url?: string }>;
}> = ({ items, blocks, onChange, onDrop, selectedIds, onSelect, editingHintId, onEditHint, onUploadTemplate, direction = 'row', isNested = false, containerId = 'root' }) => {
    const isRow = direction === 'row';

    return (
        <div className={`flex ${isRow ? 'flex-row items-start' : 'flex-col items-center'} cursor-default`}>
            {!isNested && (
                <div
                    className={`${isRow ? 'mr-2 mt-[calc(48px/2-28px)]' : 'mb-2'} relative z-10 group`}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all group-hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] shadow-[0_0_20px_rgba(34,197,94,0.3)] ${THEME.editor.node.start}`}>
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
                    <div className={`${isRow ? '-mt-2' : ''}`}>
                        <Wire onDrop={(e) => onDrop(e, index, items, onChange, containerId)} vertical={!isRow} />
                    </div>

                    <div className={`relative z-10 flex items-start justify-center node-appear-animation group/node ${isRow ? 'px-1 h-full' : 'py-1 w-full'}`}>
                        {item.type === 'block' ? (
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onSelect(item.id, e.ctrlKey || e.metaKey, e.shiftKey, items);
                                }}
                                draggable
                                onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'move_item', itemId: item.id }));
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                            >
                                <BlockNode
                                    item={item}
                                    blocks={blocks}
                                    selected={selectedIds.has(item.id)}
                                    onChange={(updatedItem) => {
                                        const next = [...items];
                                        next[index] = updatedItem;
                                        onChange(next);
                                    }}
                                    editingHintId={editingHintId}
                                    onEditHint={onEditHint}
                                    onUploadTemplate={onUploadTemplate}
                                />
                            </div>
                        ) : (
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onSelect(item.id, e.ctrlKey || e.metaKey, e.shiftKey, items);
                                }}
                                draggable
                                onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'move_item', itemId: item.id }));
                                    e.dataTransfer.effectAllowed = 'move';
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
                                    editingHintId={editingHintId}
                                    onEditHint={onEditHint}
                                    onUploadTemplate={onUploadTemplate}
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {!isNested && (
                <div className={`${isRow ? '-mt-2' : ''}`}>
                    <Wire onDrop={(e) => onDrop(e, items.length, items, onChange, containerId)} isLast vertical={!isRow} />
                </div>
            )}

            {!isNested && (
                <div className={`${isRow ? 'ml-2 mt-[calc(48px/2-24px)]' : 'mt-2'} relative z-10 opacity-50 grayscale`} onMouseDown={(e) => e.stopPropagation()}>
                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${THEME.editor.node.end}`}>
                        <div className="w-4 h-4 rounded-full bg-slate-700"></div>
                    </div>
                    <div className={`absolute ${isRow ? 'top-full left-1/2 -translate-x-1/2 mt-2' : 'left-full top-1/2 -translate-y-1/2 ml-2'} text-[10px] font-bold text-slate-600 tracking-wider uppercase`}>End</div>
                </div>
            )}
        </div>
    );
};

const Wire: React.FC<{ onDrop: (e: React.DragEvent) => void, isLast?: boolean, vertical?: boolean }> = ({ onDrop, isLast, vertical }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    // Large hit area container (Invisible target)
    // The sizes here determine how "easy" it is to hit the gap.
    const containerClasses = vertical
        ? `w-20 ${isLast ? 'h-24' : 'h-16'} flex items-center justify-center relative cursor-crosshair`
        : `${isLast ? 'w-16' : 'w-12'} h-16 flex items-center justify-center relative cursor-crosshair`;

    // Visible Line Styles
    const activeColor = 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]';
    const inactiveColor = 'bg-slate-700 group-hover:bg-slate-600';

    let lineElement = null;

    if (vertical) {
        if (isLast) {
            // Vertical Dashed Line (End)
            lineElement = <div className={`h-full w-0 border-l-4 border-dashed transition-colors duration-300 ${isDragOver ? 'border-indigo-500' : 'border-slate-700 group-hover:border-indigo-400'}`} />;
        } else {
            // Vertical Solid Line
            lineElement = <div className={`h-full w-2 rounded-full transition-all duration-300 ${isDragOver ? activeColor : inactiveColor}`} />;
        }
    } else {
        if (isLast) {
            // Horizontal Dashed Line (End)
            lineElement = <div className={`w-full h-0 border-t-4 border-dashed transition-colors duration-300 ${isDragOver ? 'border-indigo-500' : 'border-slate-700 group-hover:border-indigo-400'}`} />;
        } else {
            // Horizontal Solid Line
            lineElement = <div className={`w-full h-2 rounded-full transition-all duration-300 ${isDragOver ? activeColor : inactiveColor}`} />;
        }
    }

    return (
        <div
            className={`group ${containerClasses} transition-all ${isDragOver ? 'z-30 scale-105' : 'z-0'}`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={(e) => { e.stopPropagation(); setIsDragOver(false); onDrop(e); }}
        >
            {lineElement}

            {/* Plus Icon (centered) */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center shadow-lg transition-all z-20 pointer-events-none ${isDragOver ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100'}`}>
                <Lucide.Plus size={20} className="text-white" />
            </div>
        </div>
    );
};

const BlockNode: React.FC<{
    item: PipelineItem;
    blocks: CommandBlock[];
    selected?: boolean;
    onChange: (item: PipelineItem) => void;
    editingHintId: string | null;
    onEditHint: (id: string | null) => void;
    onUploadTemplate: (name: string, data: string) => Promise<{ success: boolean, path: string, url?: string }>;
}> = ({ item, blocks, selected, onChange, editingHintId, onEditHint, onUploadTemplate }) => {
    const block = blocks.find(b => b.id === item.blockId);
    if (!block) return <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-xl backdrop-blur-md">Unknown</div>;
    const isPredefined = block.type === 'predefined';
    const isSpecial = block.type === 'special';

    return (
        <div
            className={`relative w-56 rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-default group h-[48px] ${THEME.editor.node.base} ${selected ? THEME.editor.node.selected : isPredefined ? THEME.editor.node.predefined : isSpecial ? THEME.editor.node.special : THEME.editor.node.custom}`}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onEditHint(item.id);
            }}
        >
            {/* Hint Display/Editor */}
            {(item.hint || editingHintId === item.id) && (
                <div className="absolute -top-3 left-4 z-50">
                    {editingHintId === item.id ? (
                        <input
                            autoFocus
                            className="bg-yellow-100 text-yellow-900 text-xs px-2 py-1 rounded shadow-lg outline-none border border-yellow-300 min-w-[100px]"
                            defaultValue={item.hint || ''}
                            onBlur={(e) => {
                                onChange({ ...item, hint: e.target.value });
                                onEditHint(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="bg-yellow-100/90 text-yellow-900/90 text-[10px] font-bold px-2 py-0.5 rounded shadow border border-yellow-200/50 max-w-[150px] truncate">
                            {item.hint}
                        </div>
                    )}
                </div>
            )}

            <div className="p-3 flex items-center gap-3 h-full">
                <div className={`p-1.5 rounded-lg ${isPredefined ? 'bg-slate-700 text-slate-300' : isSpecial ? 'bg-violet-900/50 text-violet-300' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'}`}>
                    {isSpecial ? (
                        block.id === 'special_wait_image' ? <Lucide.Image size={16} /> :
                            block.id === 'special_log_start' ? <Lucide.FileText size={16} /> :
                                block.id === 'special_log_stop' ? <Lucide.Square size={16} /> :
                                    <Lucide.Moon size={16} />
                    ) : isPredefined ? <Lucide.Package size={16} /> : <Lucide.Terminal size={16} />}
                </div>
                <div className="flex-1 min-w-0"><h4 className="font-bold text-sm text-slate-100 truncate">{block.name}</h4></div>

                {isSpecial && block.id === 'special_sleep' && (
                    <div className="ml-auto flex items-center gap-1 bg-black/40 rounded px-2 py-0.5 border border-violet-500/30 transition-colors hover:border-violet-400" onClick={e => e.stopPropagation()}>
                        <input
                            type="number"
                            className="w-12 bg-transparent text-right outline-none text-xs text-violet-200 font-mono focus:text-white"
                            placeholder="ms"
                            defaultValue={item.sleepDuration || 1000}
                            step={1000}
                            min={0}
                            onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                onChange({ ...item, sleepDuration: isNaN(val) ? 1000 : val });
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                        />
                        <span className="text-[10px] text-violet-500">ms</span>
                    </div>
                )}

                {/* Log Start Inputs */}
                {isSpecial && block.id === 'special_log_start' && (
                    <div className="ml-auto w-[200px]" onClick={e => e.stopPropagation()} title={`Command: ${item.logCommand}`}>
                        <div className="relative group/input">
                            <Lucide.FileText size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                className="w-full bg-slate-900/50 hover:bg-slate-900/80 text-emerald-100 text-[11px] font-mono pl-7 pr-2 py-1 rounded border border-indigo-500/20 hover:border-indigo-500/40 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none placeholder:text-slate-600 transition-all"
                                placeholder="File (e.g. log_$(time).txt)"
                                value={item.logFileName || ''}
                                onChange={(e) => onChange({ ...item, logFileName: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* Log Stop Inputs */}
                {isSpecial && block.id === 'special_log_stop' && (
                    <div className="ml-auto w-[180px]" onClick={e => e.stopPropagation()}>
                        <div className="relative group/input">
                            <Lucide.Ban size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-red-400 transition-colors" />
                            <input
                                type="text"
                                className="w-full bg-slate-900/50 hover:bg-slate-900/80 text-red-100 text-[11px] font-mono pl-7 pr-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none placeholder:text-slate-600 transition-all"
                                placeholder="Stop Cmd (Optional)"
                                value={item.stopCommand || ''}
                                onChange={(e) => onChange({ ...item, stopCommand: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isSpecial && block.id === 'special_wait_image' && (
                    <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <label className="flex items-center gap-1 bg-black/40 rounded px-2 py-0.5 border border-violet-500/30 transition-colors hover:border-violet-400 cursor-pointer relative group/img">
                            {item.imageTemplateUrl ? (
                                <div className="relative">
                                    <img
                                        src={`http://localhost:3003${item.imageTemplateUrl}`}
                                        alt="tmpl"
                                        className="w-16 h-8 object-cover rounded border border-emerald-500/50"
                                    />
                                    {/* Hover Zoom */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover/img:block z-[60] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 pointer-events-none">
                                        <img src={`http://localhost:3003${item.imageTemplateUrl}`} alt="preview" className="w-full rounded" />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <Lucide.Image size={10} className="text-slate-400" />
                                    <span className="text-[10px] text-violet-200">Set</span>
                                </div>
                            )}

                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = async (ev) => {
                                            const data = ev.target?.result as string;
                                            try {
                                                console.log("DEBUG: [BlockNode] File selected:", file.name, "Data length:", data.length);
                                                const res = await onUploadTemplate(file.name, data);
                                                console.log("DEBUG: [BlockNode] Upload response:", res);

                                                if (res.success) {
                                                    const newItem = { ...item, imageTemplatePath: res.path, imageTemplateUrl: res.url };
                                                    console.log("DEBUG: [BlockNode] Updating item state:", newItem);
                                                    onChange(newItem);
                                                } else {
                                                    console.error("DEBUG: [BlockNode] Upload failed:", res);
                                                    alert("Upload failed");
                                                }
                                            } catch (err) {
                                                console.error("DEBUG: [BlockNode] Exception:", err);
                                            }
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </label>

                        <div className="flex items-center gap-1 bg-black/40 rounded px-2 py-0.5 border border-violet-500/30 transition-colors hover:border-violet-400">
                            <input
                                type="number"
                                className="w-10 bg-transparent text-right outline-none text-xs text-violet-200 font-mono focus:text-white"
                                placeholder="ms"
                                defaultValue={item.matchTimeout || 10000}
                                step={1000}
                                min={0}
                                onBlur={(e) => {
                                    const val = parseInt(e.target.value);
                                    onChange({ ...item, matchTimeout: isNaN(val) ? 10000 : val });
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                            />
                            <span className="text-[10px] text-violet-500">ms</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const LoopNode: React.FC<{
    item: PipelineItem;
    blocks: CommandBlock[];
    onChange: (item: PipelineItem) => void;
    onDrop: (e: React.DragEvent, index: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void, targetContainerId?: string) => void;
    selectedIds: Set<string>;
    onSelect: (id: string, multi: boolean, range: boolean, siblings: PipelineItem[]) => void;
    selected?: boolean;
    editingHintId: string | null;
    onEditHint: (id: string | null) => void;
    onUploadTemplate: (name: string, data: string) => Promise<{ success: boolean, path: string, url?: string }>;
}> = ({ item, blocks, onChange, onDrop, selectedIds, onSelect, selected, editingHintId, onEditHint, onUploadTemplate }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleInternalDrop = (e: React.DragEvent, index: number, parentItems?: PipelineItem[], updateParent?: (items: PipelineItem[]) => void, targetContainerId?: string) => {
        if (parentItems && updateParent) {
            onDrop(e, index, parentItems, updateParent, targetContainerId);
        } else {
            onDrop(e, index, item.children || [], (newChildren) => {
                onChange({ ...item, children: newChildren });
            }, item.id);
        }
    };

    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        handleInternalDrop(e, (item.children || []).length);
    };

    return (
        <div
            className={`
                min-w-[200px] rounded-2xl border-2 backdrop-blur-sm relative flex flex-col cursor-default transition-all
                ${selected ? THEME.editor.node.loopSelected : THEME.editor.node.loop}
                ${isDragOver ? 'ring-4 ring-indigo-500/50 bg-indigo-900/30 scale-105' : ''}
            `}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onEditHint(item.id);
            }}
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
            {/* Hint Display/Editor */}
            {(item.hint || editingHintId === item.id) && (
                <div className="absolute -top-4 left-4 z-50">
                    {editingHintId === item.id ? (
                        <input
                            autoFocus
                            className="bg-yellow-100 text-yellow-900 text-sm px-3 py-1 rounded shadow-lg outline-none border border-yellow-300 min-w-[120px]"
                            defaultValue={item.hint || ''}
                            onBlur={(e) => {
                                onChange({ ...item, hint: e.target.value });
                                onEditHint(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="bg-yellow-100/90 text-yellow-900/90 text-xs font-bold px-3 py-1 rounded shadow border border-yellow-200/50 max-w-[180px] truncate">
                            {item.hint}
                        </div>
                    )}
                </div>
            )}

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
                        onBlur={(e) => {
                            if (!item.loopCount || item.loopCount < 1) {
                                onChange({ ...item, loopCount: 1 });
                            }
                        }}
                    />
                </div>
            </div>

            <div className="w-full px-4 py-4 flex flex-col items-center justify-center min-h-[100px]">
                {(item.children || []).length > 0 ? (
                    <GraphFlow
                        items={item.children || []}
                        blocks={blocks}
                        onChange={(newChildren) => onChange({ ...item, children: newChildren })}
                        onDrop={handleInternalDrop}
                        selectedIds={selectedIds}
                        onSelect={onSelect}
                        editingHintId={editingHintId}
                        onEditHint={onEditHint}
                        direction="col"
                        isNested={true}
                        containerId={item.id}
                        onUploadTemplate={onUploadTemplate}
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
