
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '../../contexts/ToastContext';

const {
    Search, RefreshCw, Star, Trash2, Play, Square,
    Box, Info, ExternalLink, Filter, LayoutGrid, List
} = Lucide;

interface AppItem {
    pkgId: string;
    name: string;
    version?: string;
    status: string;
}

interface TizenAppManagerProps {
    deviceId: string;
    sdbPath?: string;
    isActive?: boolean;
}

const TizenAppManager: React.FC<TizenAppManagerProps> = ({ deviceId, sdbPath, isActive = false }) => {
    const [apps, setApps] = useState<AppItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');  // For immediate UI update
    const [filter, setFilter] = useState('');  // Debounced value for filtering
    const [socket, setSocket] = useState<Socket | null>(null);
    const { addToast } = useToast();

    const [favorites, setFavorites] = useState<string[]>(() => {
        const saved = localStorage.getItem('tizen_favorite_apps');
        return saved ? JSON.parse(saved) : [];
    });

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        localStorage.setItem('tizen_favorite_apps', JSON.stringify(favorites));
    }, [favorites]);

    // Debounce filter input (300ms delay)
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilter(inputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    useEffect(() => {
        if (!isActive) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        if (socket) return;

        const newSocket = io('http://127.0.0.1:3003');

        newSocket.on('list_tizen_apps_result', (data) => {
            setIsLoading(false);
            if (data.success) {
                setApps(data.apps);
                addToast(`Loaded ${data.apps.length} applications`, 'success');
            } else {
                addToast(`Failed to list apps: ${data.error}`, 'error');
            }
        });

        newSocket.on('operation_result', (data) => {
            if (data.target === 'tizen_app') {
                if (data.success) {
                    addToast(`${data.op.toUpperCase()} successful for ${data.pkgId}`, 'success');
                    if (data.op === 'uninstall') {
                        setApps(prev => prev.filter(a => a.pkgId !== data.pkgId));
                    }
                } else {
                    addToast(`${data.op.toUpperCase()} failed: ${data.error}`, 'error');
                }
            }
        });

        setSocket(newSocket);
        return () => { newSocket.disconnect(); };
    }, [addToast, isActive]);

    const refreshApps = useCallback(() => {
        if (socket) {
            setIsLoading(true);
            socket.emit('list_tizen_apps', { deviceId, sdbPath });
        }
    }, [socket, deviceId, sdbPath]);

    useEffect(() => {
        refreshApps();
    }, [refreshApps]);

    const toggleFavorite = (pkgId: string) => {
        setFavorites(prev =>
            prev.includes(pkgId) ? prev.filter(id => id !== pkgId) : [...prev, pkgId]
        );
    };

    const handleAppAction = (pkgId: string, action: 'launch' | 'terminate' | 'uninstall') => {
        if (!socket) return;
        if (action === 'uninstall' && !confirm(`Are you sure you want to uninstall ${pkgId}?`)) return;

        socket.emit(`${action}_tizen_app`, { deviceId, pkgId, sdbPath });
    };

    const filteredApps = useMemo(() => apps.filter(app =>
        app.name.toLowerCase().includes(filter.toLowerCase()) ||
        app.pkgId.toLowerCase().includes(filter.toLowerCase())
    ).sort((a, b) => {
        const aFav = favorites.includes(a.pkgId);
        const bFav = favorites.includes(b.pkgId);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.name.localeCompare(b.name);
    }), [apps, filter, favorites]);

    const favoriteApps = useMemo(() => apps.filter(app => favorites.includes(app.pkgId)), [apps, favorites]);

    return (
        <div className="flex flex-col h-full bg-slate-950 animate-in fade-in duration-500">
            {/* Toolbar */}
            <div className="p-4 bg-slate-900/50 border-b border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-800 rounded-lg px-3 py-1.5 border border-white/5 w-64 focus-within:border-indigo-500/50 transition-all">
                        <Search size={14} className="text-slate-500 mr-2" />
                        <input
                            placeholder="Filter apps by name or ID..."
                            className="bg-transparent border-none outline-none text-xs w-full text-slate-200"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={refreshApps}
                        disabled={isLoading}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-all border border-white/5 disabled:opacity-50"
                        title="Refresh App List"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-white/5">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Favorites Sidebar */}
                <div className="w-64 bg-slate-900 border-r border-white/5 flex flex-col">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Star size={12} className="text-amber-500 fill-amber-500" />
                            Favorites
                        </span>
                        <span className="bg-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                            {favoriteApps.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {favoriteApps.length === 0 ? (
                            <div className="p-4 text-center text-slate-600 italic text-[10px]">
                                No starred apps yet.
                            </div>
                        ) : (
                            favoriteApps.map(app => (
                                <div
                                    key={app.pkgId}
                                    className="group p-2 bg-slate-800/50 hover:bg-indigo-500/10 border border-white/5 rounded-lg transition-all cursor-pointer"
                                    onClick={() => setFilter(app.name)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-500/20 rounded-md text-indigo-400">
                                            <Box size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-200 truncate">{app.pkgId}</div>
                                            {app.version && <div className="text-[8px] text-slate-600 mt-0.5">v{app.version}</div>}
                                        </div>
                                    </div>
                                    <div className="hidden group-hover:flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                                        <button onClick={(e) => { e.stopPropagation(); handleAppAction(app.pkgId, 'launch'); }} className="text-emerald-400 hover:text-emerald-300 transition-colors"><Play size={10} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleAppAction(app.pkgId, 'terminate'); }} className="text-red-400 hover:text-red-300 transition-colors"><Square size={10} /></button>
                                        <div className="flex-1" />
                                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(app.pkgId); }} className="text-amber-500"><Star size={10} fill="currentColor" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950/50">
                    {filteredApps.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                            <Box size={48} />
                            <div className="text-sm italic">No applications found matching your criteria.</div>
                        </div>
                    ) : (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredApps.map(app => (
                                    <AppCard
                                        key={app.pkgId}
                                        app={app}
                                        isFav={favorites.includes(app.pkgId)}
                                        onToggleFav={() => toggleFavorite(app.pkgId)}
                                        onAction={(action) => handleAppAction(app.pkgId, action)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2 max-w-4xl mx-auto">
                                {filteredApps.map(app => (
                                    <AppRow
                                        key={app.pkgId}
                                        app={app}
                                        isFav={favorites.includes(app.pkgId)}
                                        onToggleFav={() => toggleFavorite(app.pkgId)}
                                        onAction={(action) => handleAppAction(app.pkgId, action)}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

const AppCard = React.memo(({ app, isFav, onToggleFav, onAction }: any) => (
    <div className={`group relative bg-slate-900 border ${isFav ? 'border-amber-500/30' : 'border-white/5'} rounded-xl p-4 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-xl overflow-hidden`}>
        {isFav && <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/10 flex items-center justify-center rounded-bl-xl"><Star size={12} className="text-amber-500 fill-amber-500" /></div>}

        <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl ${isFav ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-400'} group-hover:scale-110 transition-transform duration-300`}>
                <Box size={24} />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate mb-0.5 group-hover:text-indigo-400 transition-colors">{app.pkgId}</h3>
                <p className="text-[10px] text-slate-500 font-mono truncate">{app.version ? `v${app.version}` : app.status}</p>
                <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${app.status === 'installed' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">{app.status}</span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-white/5">
            <button
                onClick={() => onAction('launch')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg text-[10px] font-bold transition-all"
            >
                <Play size={12} /> Run
            </button>
            <button
                onClick={() => onAction('terminate')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold transition-all"
            >
                <Square size={12} /> Stop
            </button>
            <div className="flex gap-1">
                <button onClick={onToggleFav} className={`p-1.5 rounded-lg border border-white/5 ${isFav ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' : 'bg-slate-800 text-slate-500 hover:text-amber-500'} transition-all`}>
                    <Star size={12} fill={isFav ? "currentColor" : "none"} />
                </button>
                <button onClick={() => onAction('uninstall')} className="p-1.5 rounded-lg border border-white/5 bg-slate-800 text-slate-500 hover:bg-red-500 hover:text-white transition-all">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    </div>
));

const AppRow = React.memo(({ app, isFav, onToggleFav, onAction }: any) => (
    <div className={`group flex items-center gap-4 bg-slate-900 border ${isFav ? 'border-amber-500/20' : 'border-white/5'} rounded-xl p-3 hover:bg-slate-800 transition-all`}>
        <button onClick={onToggleFav} className={`${isFav ? 'text-amber-500' : 'text-slate-700 hover:text-amber-500'} transition-colors pl-1`}>
            <Star size={16} fill={isFav ? "currentColor" : "none"} />
        </button>
        <div className={`p-2 rounded-lg ${isFav ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
            <Box size={20} />
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-bold text-white truncate">{app.pkgId}</h3>
                {app.version && <span className="text-[10px] text-slate-600">v{app.version}</span>}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => onAction('launch')} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all" title="Launch"><Play size={16} /></button>
            <button onClick={() => onAction('terminate')} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Terminate"><Square size={16} /></button>
            <button onClick={() => onAction('uninstall')} className="p-2 text-slate-500 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Uninstall"><Trash2 size={16} /></button>
        </div>
    </div>
));

export default TizenAppManager;
