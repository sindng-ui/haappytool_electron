import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { STSpecialRequest, STDiscoveryData, STNodeType, STDevice, PostGlobalVariable, EnvironmentProfile, PostGlobalAuth } from '../../types';
import SpecialRequestCard from './SpecialRequestCard';
import SmartThingsTreeView from './SmartThingsTreeView';
import CapabilityInspector from './CapabilityInspector';
import { STDeviceStatusSummary } from './useSmartThingsDiscover';

export interface SmartThingsExplorerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    specialRequests: STSpecialRequest[];
    onUpdateSpecialRequests: (reqs: STSpecialRequest[]) => void;
    onLoadRequest: (req: STSpecialRequest) => void;
    isDiscovering: boolean;
    onDiscover: () => void;
    onLoadMockData?: () => void;
    discoveryData: STDiscoveryData | null;
    discoveryError: string | null;
    onSelectNode: (raw: any | null, type?: STNodeType, id?: string) => void;
    selectedNodeRaw: any | null;
    deviceStatusMap?: Record<string, STDeviceStatusSummary>;
    onFetchDeviceStatus?: (deviceId: string) => void;
    globalVariables: PostGlobalVariable[];
    envProfiles: EnvironmentProfile[];
    globalAuth?: PostGlobalAuth | null;
}

const DRAWER_WIDTH_KEY = 'posttool_st_drawer_width';
const DEFAULT_DRAWER_WIDTH = 460;

const SmartThingsExplorerDrawer: React.FC<SmartThingsExplorerDrawerProps> = ({
    isOpen,
    onClose,
    specialRequests,
    onUpdateSpecialRequests,
    onLoadRequest,
    isDiscovering,
    onDiscover,
    onLoadMockData,
    discoveryData,
    discoveryError,
    onSelectNode,
    selectedNodeRaw,
    deviceStatusMap,
    onFetchDeviceStatus,
    globalVariables,
    envProfiles,
    globalAuth,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [drawerWidth, setDrawerWidth] = useState(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            const saved = localStorage.getItem(DRAWER_WIDTH_KEY);
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 340 && parsed <= 850) {
                    return parsed;
                }
            }
        }
        return DEFAULT_DRAWER_WIDTH;
    });
    const [isResizing, setIsResizing] = useState(false);

    if (!isOpen) return null;

    const handleUpdateCard = (updatedReq: STSpecialRequest) => {
        onUpdateSpecialRequests(
            specialRequests.map((r) => (r.id === updatedReq.id ? updatedReq : r)),
        );
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = drawerWidth;

        let currentWidth = startWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = startX - moveEvent.clientX; // Resizing from left edge of right panel
            const newWidth = Math.min(Math.max(startWidth + deltaX, 340), 850);
            currentWidth = newWidth;
            setDrawerWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(DRAWER_WIDTH_KEY, String(currentWidth));
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const selectedDevice: STDevice | null = selectedNodeRaw?.deviceId
        ? {
              deviceId: selectedNodeRaw.deviceId,
              locationId: selectedNodeRaw.locationId || '',
              label: selectedNodeRaw.label || selectedNodeRaw.name || 'Device',
              raw: selectedNodeRaw,
          }
        : null;

    return (
        <div
            data-testid="st-explorer-drawer"
            style={{ width: drawerWidth }}
            className="h-full bg-slate-900/95 backdrop-blur-md border-l border-slate-700/60 flex flex-col shadow-2xl z-30 relative shrink-0 transition-all duration-150"
        >
            {/* Left Resize Handle */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 hover:w-2 bg-transparent hover:bg-indigo-500/50 cursor-col-resize z-40 transition-all ${
                    isResizing ? 'bg-indigo-500/50 w-2' : ''
                }`}
                onMouseDown={handleResizeStart}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/60 bg-slate-950/60">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                        <Lucide.Zap size={14} />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            SmartThings Explorer
                            {isDiscovering && (
                                <Lucide.Loader2 size={11} className="animate-spin text-indigo-400" />
                            )}
                        </h3>
                        <p className="text-[9px] text-slate-400">Location · Room · Device Hierarchy</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Close Explorer"
                >
                    <Lucide.X size={15} />
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3 custom-scrollbar">
                {/* Top Action Bar in Drawer */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <button
                        data-testid="st-drawer-discover-btn"
                        onClick={onDiscover}
                        disabled={isDiscovering}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-bold text-xs transition-all ${
                            isDiscovering
                                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow'
                        }`}
                    >
                        {isDiscovering ? (
                            <Lucide.Loader2 size={13} className="animate-spin" />
                        ) : (
                            <Lucide.RefreshCw size={12} />
                        )}
                        <span>Refresh Discover</span>
                    </button>

                    {onLoadMockData && (
                        <button
                            data-testid="st-drawer-mock-btn"
                            onClick={onLoadMockData}
                            className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
                            title="Reload mock data"
                        >
                            <Lucide.FlaskConical size={12} />
                            <span>Mock</span>
                        </button>
                    )}
                </div>

                {/* Search Filter */}
                <div className="relative">
                    <input
                        data-testid="st-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter devices or types..."
                        className="w-full text-xs bg-slate-950 border border-slate-700/60 rounded-lg pl-7 pr-7 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/50"
                    />
                    <Lucide.Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                        >
                            <Lucide.X size={12} />
                        </button>
                    )}
                </div>

                {/* Discovery Error */}
                {discoveryError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        <Lucide.AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <span>{discoveryError}</span>
                    </div>
                )}

                {/* Tree View */}
                {discoveryData && (
                    <div className="pt-1 border-t border-slate-800">
                        <SmartThingsTreeView
                            data={discoveryData}
                            onSelectNode={(raw, type, id) => onSelectNode(raw, type, id)}
                            selectedNodeId={selectedNodeRaw?.deviceId || selectedNodeRaw?.roomId || selectedNodeRaw?.locationId}
                            deviceStatusMap={deviceStatusMap}
                            onFetchDeviceStatus={onFetchDeviceStatus}
                            searchQuery={searchQuery}
                        />
                    </div>
                )}

                {/* Capability Inspector Panel */}
                {selectedDevice && (
                    <div className="pt-2 border-t border-slate-800">
                        <CapabilityInspector
                            device={selectedDevice}
                            globalVariables={globalVariables}
                            envProfiles={envProfiles}
                            globalAuth={globalAuth}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(SmartThingsExplorerDrawer);
