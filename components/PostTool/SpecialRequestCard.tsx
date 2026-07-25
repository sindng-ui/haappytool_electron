import React, { useState, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { STSpecialRequest } from '../../types';

// ─── Icon Map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
    MapPin: Lucide.MapPin,
    Home: Lucide.Home,
    Cpu: Lucide.Cpu,
    Globe: Lucide.Globe,
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SpecialRequestCardProps {
    req: STSpecialRequest;
    onLoad: (req: STSpecialRequest) => void;
    onUpdate: (req: STSpecialRequest) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const SpecialRequestCard: React.FC<SpecialRequestCardProps> = ({ req, onLoad, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editUrl, setEditUrl] = useState(req.url);

    const IconComponent = ICON_MAP[req.icon] ?? Lucide.Globe;

    const handleSave = useCallback(() => {
        onUpdate({ ...req, url: editUrl.trim() });
        setIsEditing(false);
    }, [req, editUrl, onUpdate]);

    const handleCancel = useCallback(() => {
        setEditUrl(req.url);
        setIsEditing(false);
    }, [req.url]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
        },
        [handleSave, handleCancel],
    );

    const handleEditClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setEditUrl(req.url);
            setIsEditing(true);
        },
        [req.url],
    );

    return (
        <div
            data-testid={`st-card-${req.id}`}
            className={`group relative rounded-lg border transition-all ${
                isEditing
                    ? 'border-indigo-500/50 bg-indigo-500/5'
                    : 'border-slate-700/50 bg-slate-800/30 hover:border-indigo-500/30 hover:bg-slate-800/50 cursor-pointer'
            }`}
            onClick={isEditing ? undefined : () => onLoad(req)}
        >
            {/* ⚡ Badge */}
            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 leading-none">
                ⚡
            </span>

            <div className="p-2.5">
                {/* Header row */}
                <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 shrink-0">
                        <IconComponent size={12} />
                    </div>
                    <span className="text-xs font-bold text-slate-200 flex-1 truncate">
                        {req.label}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        GET
                    </span>
                    {!isEditing && (
                        <button
                            data-testid={`st-card-edit-${req.id}`}
                            onClick={handleEditClick}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-indigo-400 text-slate-500 transition-all"
                            title="Edit URL"
                        >
                            <Lucide.Pencil size={11} />
                        </button>
                    )}
                </div>

                {/* URL row */}
                {isEditing ? (
                    <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                            autoFocus
                            data-testid={`st-card-url-input-${req.id}`}
                            type="text"
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 text-[10px] font-mono bg-slate-900 border border-indigo-500/40 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            data-testid={`st-card-save-${req.id}`}
                            onClick={handleSave}
                            className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400"
                            title="Save"
                        >
                            <Lucide.Check size={11} />
                        </button>
                        <button
                            data-testid={`st-card-cancel-${req.id}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCancel();
                            }}
                            className="p-1 rounded hover:bg-white/5 text-slate-500"
                            title="Cancel"
                        >
                            <Lucide.X size={11} />
                        </button>
                    </div>
                ) : (
                    <p className="text-[10px] font-mono text-slate-500 truncate" title={req.url}>
                        {req.url}
                    </p>
                )}
            </div>
        </div>
    );
};

export default React.memo(SpecialRequestCard);
