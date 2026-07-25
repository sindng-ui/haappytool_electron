import React, { useState, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { STSpecialRequest, STDiscoveryData, STNodeType } from '../../types';
import SpecialRequestCard from './SpecialRequestCard';
import SmartThingsTreeView from './SmartThingsTreeView';
import { STDeviceStatusSummary } from './useSmartThingsDiscover';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SmartThingsSectionProps {
    specialRequests: STSpecialRequest[];
    onUpdateSpecialRequests: (reqs: STSpecialRequest[]) => void;
    onLoadRequest: (req: STSpecialRequest) => void;
    isDiscovering: boolean;
    onDiscover: () => void;
    discoveryData: STDiscoveryData | null;
    discoveryError: string | null;
    onSelectNode: (raw: any | null) => void;
    selectedNodeRaw: any | null;
    deviceStatusMap?: Record<string, STDeviceStatusSummary>;
    onFetchDeviceStatus?: (deviceId: string) => void;
    /** 4단계에서 SmartThingsTreeView 컴포넌트로 교체될 슬롯 */
    treeViewSlot?: React.ReactNode;
}

// ─── Discovery Summary (placeholder until 4단계 TreeView) ─────────────────────
const DiscoverySummary: React.FC<{ data: STDiscoveryData }> = ({ data }) => (
    <div className="mt-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 space-y-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Lucide.CheckCircle2 size={11} className="text-emerald-400" />
            Discovery Complete
        </div>
        <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
                <Lucide.MapPin size={11} className="text-indigo-400" />
                Locations
            </span>
            <span className="font-bold text-slate-200">{data.locations.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
                <Lucide.Home size={11} className="text-purple-400" />
                Rooms
            </span>
            <span className="font-bold text-slate-200">{data.rooms.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
                <Lucide.Cpu size={11} className="text-cyan-400" />
                Devices
            </span>
            <span className="font-bold text-slate-200">{data.devices.length}</span>
        </div>
        <div className="text-[9px] text-slate-600 pt-1 border-t border-slate-700/40">
            Updated: {new Date(data.fetchedAt).toLocaleTimeString()}
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const SmartThingsSection: React.FC<SmartThingsSectionProps> = ({
    specialRequests,
    onUpdateSpecialRequests,
    onLoadRequest,
    isDiscovering,
    onDiscover,
    discoveryData,
    discoveryError,
    onSelectNode,
    selectedNodeRaw,
    deviceStatusMap,
    onFetchDeviceStatus,
    treeViewSlot,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleUpdateCard = useCallback(
        (updatedReq: STSpecialRequest) => {
            onUpdateSpecialRequests(
                specialRequests.map((r) => (r.id === updatedReq.id ? updatedReq : r)),
            );
        },
        [specialRequests, onUpdateSpecialRequests],
    );

    return (
        <div
            data-testid="st-section"
            className="border-b border-slate-700/40 bg-slate-900/50"
        >
            {/* ── Section Header ── */}
            <button
                data-testid="st-section-toggle"
                onClick={() => setIsCollapsed((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <div className="p-0.5 rounded bg-indigo-500/10 text-indigo-400">
                        <Lucide.Zap size={11} />
                    </div>
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                        SmartThings
                    </span>
                    {isDiscovering && (
                        <span className="flex items-center gap-1 text-[9px] text-indigo-400 animate-pulse">
                            <Lucide.Loader2 size={10} className="animate-spin" />
                            Discovering...
                        </span>
                    )}
                    {!isDiscovering && discoveryData && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            {discoveryData.devices.length} devices
                        </span>
                    )}
                </div>
                <Lucide.ChevronDown
                    size={13}
                    className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90' : ''
                    }`}
                />
            </button>

            {/* ── Collapsed Content ── */}
            {!isCollapsed && (
                <div className="px-2 pb-2 space-y-1.5">
                    {/* Special Request Cards */}
                    <div className="space-y-1.5">
                        {specialRequests.map((req) => (
                            <SpecialRequestCard
                                key={req.id}
                                req={req}
                                onLoad={onLoadRequest}
                                onUpdate={handleUpdateCard}
                            />
                        ))}
                    </div>

                    {/* ── Discover All Button ── */}
                    <button
                        data-testid="st-discover-btn"
                        onClick={onDiscover}
                        disabled={isDiscovering}
                        className={`w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all
                            ${isDiscovering
                                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]'
                            }`}
                    >
                        {isDiscovering ? (
                            <>
                                <Lucide.Loader2 size={15} className="animate-spin" />
                                Discovering...
                            </>
                        ) : (
                            <>
                                <Lucide.Search size={15} />
                                Discover All
                                <span className="text-[10px] opacity-60 font-normal">
                                    Location · Room · Device
                                </span>
                            </>
                        )}
                    </button>

                    {/* ── Search Input Filter (when discovery data exists) ── */}
                    {discoveryData && (
                        <div className="relative mt-1.5">
                            <input
                                data-testid="st-search-input"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter devices or types..."
                                className="w-full text-xs bg-slate-950 border border-slate-700/60 rounded-lg pl-7 pr-7 py-1 text-slate-200 focus:outline-none focus:border-indigo-500/50"
                            />
                            <Lucide.Search size={12} className="absolute left-2.5 top-2 text-slate-500" />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                                >
                                    <Lucide.X size={12} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Error Message ── */}
                    {discoveryError && (
                        <div
                            data-testid="st-discover-error"
                            className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                        >
                            <Lucide.AlertCircle size={13} className="mt-0.5 shrink-0" />
                            <span>{discoveryError}</span>
                        </div>
                    )}

                    {/* ── Tree View Slot ── */}
                    {treeViewSlot ?? (
                        discoveryData && (
                            <SmartThingsTreeView
                                data={discoveryData}
                                onSelectNode={(raw, type, id) => onSelectNode(raw)}
                                selectedNodeId={selectedNodeRaw?.deviceId || selectedNodeRaw?.roomId || selectedNodeRaw?.locationId}
                                deviceStatusMap={deviceStatusMap}
                                onFetchDeviceStatus={onFetchDeviceStatus}
                                searchQuery={searchQuery}
                            />
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(SmartThingsSection);
