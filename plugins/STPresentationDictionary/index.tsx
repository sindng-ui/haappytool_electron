import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { 
    BookOpen, Search, Plus, Trash2, Clipboard, ChevronRight, 
    AlertCircle, BookMarked
} from 'lucide-react';

import { STAppPreview } from './components/STAppPreview';
import { PresentationDetail } from './components/PresentationDetail';
import { ImportDialog } from './components/ImportDialog';
import { CategoryFilter } from './components/CategoryFilter';

const STPresentationDictionary: React.FC = () => {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [presentations, setPresentations] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<any>(null);
    const [selectedMeta, setSelectedMeta] = useState<any>(null);

    // Search and filters
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'all' | 'name'>('all');
    const [selectedCats, setSelectedCats] = useState<string[]>([]);
    const [selectedCapability, setSelectedCapability] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Dialog & Sniffer
    const [clipboardJson, setClipboardJson] = useState('');
    const [clipboardPreviewName, setClipboardPreviewName] = useState('');
    const [showSnifferBanner, setShowSnifferBanner] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    useEffect(() => {
        const socket = io('http://127.0.0.1:3003');
        socketRef.current = socket;

        socket.on('connect', () => { setConnected(true); socket.emit('st_presentation_init'); });
        socket.on('disconnect', () => setConnected(false));
        socket.on('st_presentation_initialized', () => socket.emit('st_presentation_list'));

        socket.on('st_presentation_list_result', (res: any) => {
            if (res.success) {
                setPresentations(res.list || []);
                setCategories(res.categories || []);
            }
        });

        socket.on('st_presentation_save_result', (res: any) => {
            if (res.success) {
                setPresentations(res.list || []);
                alert('Device Presentation successfully registered, Hyungnim!');
                if (res.meta) handleSelectPresentation(res.meta);
            } else {
                alert(`Import Failed: ${res.message}`);
            }
        });

        socket.on('st_presentation_delete_result', (res: any) => {
            if (res.success) {
                setPresentations(res.list || []);
                setSelectedDetail(null);
                setSelectedMeta(null);
                alert('Deleted successfully.');
            }
        });

        socket.on('st_presentation_search_result', (res: any) => {
            setIsSearching(false);
            if (res.success) setPresentations(res.results || []);
        });

        socket.on('st_presentation_get_detail_result', (res: any) => {
            if (res.success) setSelectedDetail(res.detail);
        });

        socket.on('st_presentation_update_categories_list_result', (res: any) => {
            if (res.success) setCategories(res.categories || []);
        });

        socket.on('st_presentation_update_category_result', (res: any) => {
            if (res.success) setPresentations(res.list || []);
        });

        return () => { socket.disconnect(); };
    }, []);

    // Clipboard Sniffer
    const checkClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text || text.trim() === clipboardJson) return;

            if (text.includes('"presentationId"') && text.includes('"manufacturerName"')) {
                try {
                    const parsed = JSON.parse(text);
                    if (parsed.presentationId && parsed.manufacturerName) {
                        setClipboardJson(text);
                        setClipboardPreviewName(parsed.presentationId);
                        setShowSnifferBanner(true);
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }, [clipboardJson]);

    useEffect(() => {
        const interval = setInterval(checkClipboard, 3000);
        window.addEventListener('focus', checkClipboard);
        return () => { clearInterval(interval); window.removeEventListener('focus', checkClipboard); };
    }, [checkClipboard]);

    const handleQuickImport = () => {
        if (!socketRef.current || !clipboardJson) return;
        const alias = prompt('Hyungnim, please set a Custom Alias for this device:', clipboardPreviewName);
        if (alias === null) return;

        socketRef.current.emit('st_presentation_save', {
            jsonText: clipboardJson,
            customName: alias || clipboardPreviewName,
            categories: []
        });
        setShowSnifferBanner(false);
        setClipboardJson('');
    };

    const handleToggleCategory = (cat: string) => {
        setSelectedCats(prev => {
            const next = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat];
            triggerSearch(searchQuery, next, selectedCapability);
            return next;
        });
    };

    const triggerSearch = (query: string, cats: string[], cap: string) => {
        if (!socketRef.current) return;
        setIsSearching(true);
        socketRef.current.emit('st_presentation_search', { query, searchType, categories: cats, capability: cap });
    };

    useEffect(() => {
        const delay = setTimeout(() => { triggerSearch(searchQuery, selectedCats, selectedCapability); }, 300);
        return () => clearTimeout(delay);
    }, [searchQuery, searchType, selectedCapability]);

    const handleSelectPresentation = (meta: any) => {
        if (!socketRef.current) return;
        setSelectedMeta(meta);
        setSelectedDetail(null);
        socketRef.current.emit('st_presentation_get_detail', { fileName: meta.fileName });
    };

    const handleDeleteItem = (e: React.MouseEvent, meta: any) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${meta.customName}"?`)) {
            if (!socketRef.current) return;
            socketRef.current.emit('st_presentation_delete', { presentationId: meta.presentationId, fileName: meta.fileName });
        }
    };

    const handleQuickAssignCategory = (meta: any, cat: string) => {
        if (!socketRef.current) return;
        const currentCats = meta.categories || [];
        const updatedCats = currentCats.includes(cat) ? currentCats.filter((c: string) => c !== cat) : [...currentCats, cat];
        socketRef.current.emit('st_presentation_update_category', { presentationId: meta.presentationId, categories: updatedCats });
    };

    const handleUpdateCategoriesList = (newList: string[]) => {
        if (!socketRef.current) return;
        socketRef.current.emit('st_presentation_update_categories_list', { categoriesList: newList });
    };

    const handleSaveFromImport = (jsonText: string, customName: string, selectedCats: string[]) => {
        if (!socketRef.current) return;
        socketRef.current.emit('st_presentation_save', { jsonText, customName, categories: selectedCats });
    };

    const uniqueCapabilitiesList = useMemo(() => {
        const set = new Set<string>();
        presentations.forEach(p => {
            if (Array.isArray(p.capabilities)) p.capabilities.forEach((c: string) => set.add(c));
        });
        return Array.from(set).sort();
    }, [presentations]);

    return (
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden select-none h-full max-h-screen">
            
            {/* Header switcher clearance header (h-16, pl-16) to avoid App Hub button overlap */}
            <div className="h-16 flex items-center justify-between pl-16 pr-6 border-b border-slate-900 bg-slate-950 shrink-0 select-none title-drag">
                <div className="flex items-center gap-4 no-drag">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        <h1 className="text-sm font-black tracking-tight text-white uppercase leading-none">SmartThings Presentation Dictionary</h1>
                    </div>
                    <span className="w-[1px] h-4 bg-slate-800" />
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-600/25 active:scale-95 transition-all flex items-center gap-1 shrink-0 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Import Device
                    </button>
                </div>

                <div className="flex items-center gap-4 no-drag">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className={connected ? 'text-green-400' : 'text-red-500'}>
                            {connected ? 'SOCKET ONLINE' : 'SOCKET OFFLINE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Clipboard sniffer banner */}
            {showSnifferBanner && (
                <div className="mx-6 mt-4 bg-indigo-950/80 border border-indigo-800 text-indigo-100 rounded-2xl p-4 flex items-center justify-between shadow-xl animate-fade-in">
                    <div className="flex items-center gap-3">
                        <Clipboard className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
                        <div>
                            <h4 className="text-xs font-bold text-slate-100">SmartThings JSON detected in Clipboard!</h4>
                            <p className="text-[10px] text-indigo-300 mt-0.5 font-mono">ID: {clipboardPreviewName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleQuickImport} className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-md active:scale-95">
                            Quick Import
                        </button>
                        <button onClick={() => setShowSnifferBanner(false)} className="text-indigo-300 hover:text-indigo-100 text-[10px] px-2 py-1.5 font-bold">
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Content Two-Column Master-Detail Layout */}
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0 p-6">
                
                {/* Left Master Pane */}
                <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-hidden h-full">
                    
                    {/* Advanced Search Panel */}
                    <div className="bg-slate-900/60 border border-slate-800/85 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
                        <div className="relative">
                            <Search 
                                style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)' }}
                                className="absolute w-4 h-4 text-slate-400 pointer-events-none" 
                            />
                            <input 
                                type="text"
                                placeholder="Search by name, manufacturer, ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: '2.75rem' }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/35 transition-all font-semibold shadow-inner"
                            />
                        </div>

                        <div className="flex gap-2 justify-between items-center text-xs">
                            <div className="flex gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                                <button
                                    onClick={() => setSearchType('all')}
                                    className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${
                                        searchType === 'all' 
                                            ? 'bg-slate-900 text-indigo-400 shadow-sm' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Full Text
                                </button>
                                <button
                                    onClick={() => setSearchType('name')}
                                    className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${
                                        searchType === 'name' 
                                            ? 'bg-slate-900 text-indigo-400 shadow-sm' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Name Only
                                </button>
                            </div>

                            <select
                                value={selectedCapability}
                                onChange={(e) => setSelectedCapability(e.target.value)}
                                style={{ backgroundColor: '#090d16', color: '#f1f5f9', colorScheme: 'dark' }}
                                className="border border-slate-800 text-slate-200 font-bold px-3 py-1 rounded-xl text-[10px] focus:outline-none focus:border-indigo-500 transition-all max-w-[140px]"
                            >
                                <option value="">All Capabilities</option>
                                {uniqueCapabilitiesList.map(cap => (
                                    <option key={cap} value={cap}>{cap}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Category Filter Panel */}
                    <CategoryFilter 
                        categories={categories}
                        selectedCategories={selectedCats}
                        onToggleCategory={handleToggleCategory}
                        onUpdateCategoriesList={handleUpdateCategoriesList}
                    />

                    {/* Device List */}
                    <div className="flex-1 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 overflow-y-auto custom-scrollbar shadow-inner">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Devices ({presentations.length})</span>
                            {isSearching && <span className="text-[10px] text-indigo-400 font-bold animate-pulse">Searching...</span>}
                        </div>

                        {presentations.length > 0 ? (
                            <div className="space-y-2">
                                {presentations.map((item) => {
                                    const isSelected = selectedMeta?.presentationId === item.presentationId;
                                    return (
                                        <div 
                                            key={item.presentationId}
                                            onClick={() => handleSelectPresentation(item)}
                                            className={`p-3 border rounded-2xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 flex justify-between items-center group relative overflow-hidden ${
                                                isSelected 
                                                    ? 'bg-indigo-950/30 border-indigo-600 shadow-md' 
                                                    : 'bg-slate-950/65 border-slate-850 hover:border-slate-800'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="text-xs font-black text-slate-100 tracking-tight leading-snug truncate">
                                                    {item.customName}
                                                </h4>
                                                <p className="text-[9px] text-slate-400 font-medium tracking-tight mt-0.5 truncate font-mono">
                                                    ID: {item.presentationId}
                                                </p>
                                                
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                                                        {item.capabilities?.length || 0} Caps
                                                    </span>
                                                    {item.categories && item.categories.map((cat: string) => (
                                                        <span key={cat} className="bg-indigo-950/40 border border-indigo-900/60 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <select
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        if (e.target.value) {
                                                            handleQuickAssignCategory(item, e.target.value);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[8px] focus:outline-none cursor-pointer font-bold"
                                                >
                                                    <option value="">Category</option>
                                                    {categories.map(cat => (
                                                        <option key={cat} value={cat}>
                                                            {item.categories?.includes(cat) ? `✓ ${cat}` : `+ ${cat}`}
                                                        </option>
                                                    ))}
                                                </select>

                                                <button 
                                                    onClick={(e) => handleDeleteItem(e, item)}
                                                    className="text-slate-500 hover:text-rose-450 p-1 rounded-lg hover:bg-slate-900 transition-all active:scale-90"
                                                    title="Delete device"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {isSelected && (
                                                <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
                                <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                                <p className="text-xs font-bold text-slate-400">No Data Available</p>
                                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                                    Copy a valid JSON to trigger clipboard importer, or click Import Device!
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Detail Pane */}
                <div className="flex-1 flex gap-6 overflow-hidden h-full">
                    {selectedDetail ? (
                        <>
                            <div className="w-[340px] shrink-0 h-full overflow-y-auto custom-scrollbar">
                                <STAppPreview 
                                    presentation={selectedDetail}
                                    customName={selectedMeta?.customName}
                                />
                            </div>
                            <div className="flex-1 h-full overflow-hidden">
                                <PresentationDetail presentation={selectedDetail} />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 text-slate-550">
                            <BookMarked className="w-16 h-16 text-slate-700 mb-3 animate-pulse" />
                            <h3 className="text-sm font-bold text-slate-300">SmartThings Presentation Dictionary</h3>
                            <p className="text-xs text-slate-500 mt-1.5 text-center max-w-[280px] leading-relaxed">
                                Select a device from the left panel to begin schema analytics and mobile UI simulation.
                            </p>
                        </div>
                    )}
                </div>

            </div>

            <ImportDialog 
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                categories={categories}
                onSave={handleSaveFromImport}
            />

        </div>
    );
};

export default STPresentationDictionary;
