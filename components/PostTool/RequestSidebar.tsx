import React from 'react';
import * as Lucide from 'lucide-react';
import { SavedRequest } from '../../types';

const { List, Plus, Trash2 } = Lucide;

interface RequestSidebarProps {
    savedRequests: SavedRequest[];
    activeRequestId: string | null;
    currentRequest: SavedRequest; // For binding name input when active
    onSelectRequest: (id: string) => void;
    onNewRequest: () => void;
    onDeleteRequest: (e: React.MouseEvent, id: string) => void;
    onChangeCurrentRequest: (req: SavedRequest) => void;
}

const RequestSidebar: React.FC<RequestSidebarProps> = ({
    savedRequests, activeRequestId, currentRequest,
    onSelectRequest, onNewRequest, onDeleteRequest, onChangeCurrentRequest
}) => {
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const prevCountRef = React.useRef(savedRequests.length);

    React.useEffect(() => {
        if (savedRequests.length > prevCountRef.current) {
            // New item added, enter edit mode for it (assuming it's set as active)
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

    return (
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 h-12 dashed-header title-drag pl-4">
                <span className="font-bold text-sm text-slate-300 flex items-center gap-2">
                    <List size={14} /> Collections
                </span>
                <button onClick={onNewRequest} className="p-1.5 hover:bg-slate-800 rounded-lg text-indigo-400 transition-colors no-drag">
                    <Plus size={16} />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {savedRequests.map(req => (
                    <div
                        key={req.id}
                        onClick={() => onSelectRequest(req.id)}
                        onDoubleClick={() => setEditingId(req.id)}
                        className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${activeRequestId === req.id
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-300'
                            : 'border-transparent hover:bg-slate-800 text-slate-400'
                            }`}
                    >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
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
                                        if (e.key === 'Enter') {
                                            setEditingId(null);
                                        }
                                    }}
                                    className="flex-1 bg-slate-800 text-sm font-medium px-2 py-0.5 rounded border border-indigo-500/30 focus:outline-none focus:border-indigo-500 text-indigo-300"
                                />
                            ) : (
                                <span className="text-sm font-medium truncate">{req.name || 'Untitled'}</span>
                            )}
                        </div>
                        <button
                            onClick={(e) => onDeleteRequest(e, req.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                {savedRequests.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-xs">
                        No requests saved
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestSidebar;
