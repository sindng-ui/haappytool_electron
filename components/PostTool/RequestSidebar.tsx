import React, { useState, useRef, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { SavedRequest, RequestGroup } from '../../types';

const { List, Plus, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, FolderPlus, MoreVertical } = Lucide;

interface RequestSidebarProps {
    width: number;
    onResizeStart: () => void;
    savedRequests: SavedRequest[];
    activeRequestId: string | null;
    currentRequest: SavedRequest; // For binding name input when active
    onSelectRequest: (id: string) => void;
    onNewRequest: (groupId?: string) => void;
    onDeleteRequest: (e: React.MouseEvent, id: string) => void;
    onChangeCurrentRequest: (req: SavedRequest) => void;
    onUpdateRequests: (requests: SavedRequest[]) => void;
    savedRequestGroups?: RequestGroup[];
    onUpdateGroups?: (groups: RequestGroup[]) => void;
}

const RequestSidebar: React.FC<RequestSidebarProps> = ({
    width, onResizeStart,
    savedRequests, activeRequestId, currentRequest,
    onSelectRequest, onNewRequest, onDeleteRequest, onChangeCurrentRequest, onUpdateRequests,
    savedRequestGroups = [], onUpdateGroups
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const prevCountRef = useRef(savedRequests.length);

    // DnD State
    const [draggedRequestId, setDraggedRequestId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null); // Request ID or Group ID being hovered
    const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | 'center' | null>(null); // center = into group

    useEffect(() => {
        if (savedRequests.length > prevCountRef.current) {
            if (activeRequestId) setEditingId(activeRequestId);
        }
        prevCountRef.current = savedRequests.length;
    }, [savedRequests.length, activeRequestId]);

    const getMethodColor = (m: string) => {
        switch (m) {
            case 'GET': return 'text-blue-400';
            case 'POST': return 'text-green-400';
            case 'DELETE': return 'text-red-400';
            case 'PUT': return 'text-orange-400';
            default: return 'text-slate-400';
        }
    };

    const handleCreateGroup = () => {
        if (!onUpdateGroups) return;
        const newGroup: RequestGroup = {
            id: crypto.randomUUID(),
            name: 'New Group',
            collapsed: false
        };
        onUpdateGroups([...savedRequestGroups, newGroup]);
        setEditingGroupId(newGroup.id);
    };

    const handleDeleteGroup = (e: React.MouseEvent, group: RequestGroup) => {
        e.stopPropagation();
        if (!onUpdateGroups) return;

        const children = savedRequests.filter(r => r.groupId === group.id);
        if (children.length > 0) {
            if (!window.confirm(`Group "${group.name}" has ${children.length} requests. Are you sure you want to delete it? The requests will not be deleted but will become unassigned.`)) {
                return;
            }
        }

        onUpdateGroups(savedRequestGroups.filter(g => g.id !== group.id));
    };

    const toggleGroup = (group: RequestGroup) => {
        if (!onUpdateGroups) return;
        const updated = savedRequestGroups.map(g => g.id === group.id ? { ...g, collapsed: !g.collapsed } : g);
        onUpdateGroups(updated);
    };

    // --- DnD Handlers ---

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedRequestId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedRequestId(null);
        setDragOverId(null);
        setDragOverPosition(null);
    };

    const handleDragOverItem = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedRequestId || draggedRequestId === targetId) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const pos = e.clientY < midY ? 'top' : 'bottom';

        setDragOverId(targetId);
        setDragOverPosition(pos);
    };

    const handleDragOverGroup = (e: React.DragEvent, groupId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedRequestId) return;

        // If hovering group header, we mean "Drop into group"
        setDragOverId(groupId);
        setDragOverPosition('center');
    };

    const handleDrop = (e: React.DragEvent, targetId: string, isGroup: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedRequestId || !onUpdateRequests) return;

        const sourceIndex = savedRequests.findIndex(r => r.id === draggedRequestId);
        if (sourceIndex === -1) return;

        const newRequests = [...savedRequests];
        const [movedItem] = newRequests.splice(sourceIndex, 1);

        if (isGroup) {
            // Drop INTO group
            movedItem.groupId = targetId;
            newRequests.push(movedItem);
        } else {
            // Drop Relative to Item
            // Target might be source (handled above), or logic adjusted for splicing
            // Safe bet: Find target in `newRequests` (array sans dragged item).
            const adjustedTargetIndex = newRequests.findIndex(r => r.id === targetId);

            if (adjustedTargetIndex !== -1) {
                const targetItem = newRequests[adjustedTargetIndex];

                // Inherit group ID of target
                movedItem.groupId = targetItem.groupId;

                if (dragOverPosition === 'top') {
                    newRequests.splice(adjustedTargetIndex, 0, movedItem);
                } else {
                    newRequests.splice(adjustedTargetIndex + 1, 0, movedItem);
                }
            } else {
                newRequests.push(movedItem);
            }
        }

        onUpdateRequests(newRequests);
        handleDragEnd();
    };

    const renderRequestItem = (req: SavedRequest) => {
        const isDragging = draggedRequestId === req.id;
        const isOver = dragOverId === req.id;

        return (
            <div
                key={req.id}
                draggable
                onDragStart={(e) => handleDragStart(e, req.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOverItem(e, req.id)}
                onDrop={(e) => handleDrop(e, req.id, false)}
                onClick={() => onSelectRequest(req.id)}
                onDoubleClick={() => setEditingId(req.id)}
                className={`group/item flex items-center justify-between p-2 pl-3 rounded-lg cursor-pointer transition-all border relative ml-4 ${activeRequestId === req.id
                    ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-transparent hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                    } ${isDragging ? 'opacity-30' : ''}`}
            >
                {/* Child Line Connector (Tree UI) */}
                {req.groupId && (
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-3 h-px bg-slate-300 dark:bg-slate-700/50" />
                )}
                {req.groupId && (
                    <div className="absolute -left-4 top-0 bottom-1/2 w-px bg-slate-300 dark:bg-slate-700/50" />
                )}

                {/* Drop Indicators */}
                {isOver && dragOverPosition === 'top' && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 z-50 pointer-events-none" />
                )}
                {isOver && dragOverPosition === 'bottom' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 z-50 pointer-events-none" />
                )}

                <div className="flex items-center gap-2 overflow-hidden flex-1 pointer-events-none">
                    <span className={`text-[10px] font-bold w-8 shrink-0 ${getMethodColor(req.method)}`}>{req.method}</span>
                    {editingId === req.id && activeRequestId === req.id ? (
                        <input
                            autoFocus
                            type="text"
                            value={currentRequest.name}
                            onChange={(e) => onChangeCurrentRequest({ ...currentRequest, name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingId(null);
                            }}
                            className="flex-1 bg-slate-100 dark:bg-slate-800 text-sm font-medium px-2 py-0.5 rounded border border-indigo-500/30 focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-indigo-300 pointer-events-auto"
                        />
                    ) : (
                        <span className="text-sm font-medium truncate">{req.name || 'Untitled'}</span>
                    )}
                </div>
                <button
                    onClick={(e) => onDeleteRequest(e, req.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:text-red-500 dark:hover:text-red-400 transition-opacity pointer-events-auto"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        );
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0 relative group/sidebar" style={{ width }}>
            {/* Resize Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 bg-transparent hover:bg-indigo-500/50 cursor-col-resize z-50 transition-all"
                onMouseDown={onResizeStart}
            />

            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0 h-11 dashed-header title-drag pl-4 bg-white/30 dark:bg-white/5 backdrop-blur-sm">
                <span className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <List size={14} className="text-slate-500 dark:text-slate-400" /> Collections
                </span>
                <div className="flex items-center gap-1 no-drag">
                    <button onClick={handleCreateGroup} className="p-1.5 hover:bg-white/20 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="New Group">
                        <FolderPlus size={16} />
                    </button>
                    <button onClick={() => onNewRequest()} className="p-1.5 hover:bg-white/20 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="New Request">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div
                className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    // Drop on background -> Move to Root
                    e.preventDefault();
                    if (!draggedRequestId || dragOverId || !onUpdateRequests) return;

                    const sourceIndex = savedRequests.findIndex(r => r.id === draggedRequestId);
                    if (sourceIndex === -1) return;

                    const newRequests = [...savedRequests];
                    const [movedItem] = newRequests.splice(sourceIndex, 1);
                    movedItem.groupId = undefined; // Root
                    newRequests.push(movedItem);
                    onUpdateRequests(newRequests);
                    handleDragEnd();
                }}
            >
                {/* Groups */}
                {savedRequestGroups.map(group => {
                    const groupRequests = savedRequests.filter(r => r.groupId === group.id);
                    const isGroupOver = dragOverId === group.id && dragOverPosition === 'center';

                    return (
                        <div key={group.id} className={`mb-1 border rounded-xl overflow-hidden transition-colors ${isGroupOver ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-transparent bg-white/40 dark:bg-white/5'}`}>
                            <div
                                className={`flex items-center justify-between p-2 cursor-pointer hover:bg-white/20 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 group/header ${group.collapsed ? '' : 'border-b border-slate-200 dark:border-white/5'}`}
                                onClick={() => toggleGroup(group)}
                                onDragOver={(e) => handleDragOverGroup(e, group.id)}
                                onDrop={(e) => handleDrop(e, group.id, true)}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-slate-500">
                                        {group.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    </span>
                                    <span className="text-slate-500 group-hover:text-amber-500/80 transition-colors">
                                        {group.collapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
                                    </span>

                                    {editingGroupId === group.id ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={group.name}
                                            onChange={(e) => {
                                                if (onUpdateGroups) {
                                                    const updated = savedRequestGroups.map(g => g.id === group.id ? { ...g, name: e.target.value } : g);
                                                    onUpdateGroups(updated);
                                                }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={() => setEditingGroupId(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') setEditingGroupId(null);
                                            }}
                                            className="flex-1 bg-slate-100 dark:bg-slate-800 text-sm font-bold px-2 py-0.5 rounded border border-indigo-500/30 focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-indigo-300"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold truncate flex-1" onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); }}>
                                            {group.name}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center opacity-0 group-hover/header:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNewRequest(group.id); }}
                                        className="p-1 hover:text-indigo-500 dark:hover:text-indigo-400 text-slate-400 dark:text-slate-500 mr-1"
                                        title="Add Request"
                                    >
                                        <Plus size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteGroup(e, group)}
                                        className="p-1 hover:text-red-500 dark:hover:text-red-400 text-slate-400 dark:text-slate-500"
                                        title="Delete Group"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {!group.collapsed && (
                                <div className="p-1 space-y-0.5 bg-slate-50/30 dark:bg-black/20">
                                    {groupRequests.map(renderRequestItem)}
                                    {groupRequests.length === 0 && (
                                        <div className="pl-8 py-2 text-xs text-slate-400 dark:text-slate-600 italic">Empty group</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Unassigned Requests */}
                <div className="space-y-0.5 pt-1">
                    {savedRequests
                        .filter(r => !r.groupId || !savedRequestGroups.find(g => g.id === r.groupId))
                        .map(renderRequestItem)}
                </div>
            </div>
        </div>
    );
};

export default RequestSidebar;
