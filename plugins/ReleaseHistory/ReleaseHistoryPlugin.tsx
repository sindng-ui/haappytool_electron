import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PluginContext } from '../types';
import { ReleaseItem, ViewMode, YearConfig, ReleaseHistoryData } from './types';
import ListView from './components/ListView';
import TimelineGraphView from './components/TimelineGraphView';
import ReleaseDetailModal from './components/ReleaseDetailModal';
import AddReleaseModal from './components/AddReleaseModal';
import { exportToJson, importFromJson, exportToMarkdown, downloadDataUri } from './utils/ExportImportUtils';
import { Search, Plus, Download, Upload, Image as ImageIcon, FileText, LayoutList, CalendarRange } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

interface ReleaseHistoryPluginProps {
    context: PluginContext;
}

const STORAGE_KEY = 'happytool_release_history';

const ReleaseHistoryPlugin: React.FC<ReleaseHistoryPluginProps> = ({ context }) => {
    const [items, setItems] = useState<ReleaseItem[]>([]);
    const [yearConfigs, setYearConfigs] = useState<Record<number, YearConfig>>({});

    // Load and Migrate data
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                let loadedItems: any[] = [];
                let loadedConfigs: Record<number, YearConfig> = {};

                if (Array.isArray(parsed)) {
                    loadedItems = parsed;
                } else if (parsed.items) {
                    loadedItems = parsed.items;
                    loadedConfigs = parsed.yearConfigs || {};
                }

                const migratedItems: ReleaseItem[] = loadedItems.map((item: any) => {
                    const releaseName = item.releaseName || item.appName || 'Unknown';
                    let years = item.years;
                    if (!years) {
                        // Migration from productName
                        if (item.productName && /^\d{4}$/.test(item.productName)) {
                            years = [parseInt(item.productName)];
                        } else {
                            // Fallback to year of releaseDate
                            years = [new Date(item.releaseDate).getFullYear()];
                        }
                    }
                    return { ...item, releaseName, years };
                });

                setItems(migratedItems);
                setYearConfigs(loadedConfigs);
            } catch (e) {
                console.error('Failed to parse stored release history', e);
            }
        }
    }, []);

    const [viewMode, setViewMode] = useState<ViewMode>('timeline');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<ReleaseItem | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ReleaseItem | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
    };

    // Auto-hide toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Save to local storage whenever items or configs change
    useEffect(() => {
        if (items.length > 0 || Object.keys(yearConfigs).length > 0) {
            const data: ReleaseHistoryData = { items, yearConfigs };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
    }, [items, yearConfigs]);

    // Filtering logic (Memoized for performance)
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const q = searchQuery.toLowerCase();
        return items.filter(item => 
            item.releaseName.toLowerCase().includes(q) ||
            item.years.some(y => y.toString().includes(q)) ||
            item.version.toLowerCase().includes(q) ||
            item.note.toLowerCase().includes(q)
        );
    }, [items, searchQuery]);

    const existingYears = useMemo(() => {
        const years = new Set<number>();
        items.forEach(i => i.years.forEach(y => years.add(y)));
        return Array.from(years).sort((a, b) => b - a);
    }, [items]);

    const handleSaveRelease = (newItemData: Omit<ReleaseItem, 'id'>) => {
        if (editingItem) {
            // Update existing
            setItems(prev => prev.map(item => 
                item.id === editingItem.id ? { ...newItemData, id: item.id } : item
            ));
            setEditingItem(null);
        } else {
            // Add new
            const item: ReleaseItem = {
                ...newItemData,
                id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            setItems(prev => [...prev, item]);
        }
        setIsAddModalOpen(false);
    };

    const handleDeleteItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
        setSelectedItem(null);
    };

    const handleEditItem = (item: ReleaseItem) => {
        setEditingItem(item);
        setSelectedItem(null); // Close detail modal
        setIsAddModalOpen(true); // Open add modal in edit mode
    };

    const handleUpdateYearConfig = (config: YearConfig) => {
        setYearConfigs(prev => ({
            ...prev,
            [config.year]: config
        }));
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const parsed = importFromJson(content);
            if (parsed) {
                setItems(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = parsed.filter(p => !existingIds.has(p.id));
                    return [...prev, ...newItems];
                });
            } else {
                showToast('Invalid JSON file format for Release History.', 'error');
            }
        };
        reader.readAsText(file);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = Array.from(e.dataTransfer.files);
        const jsonFile = files.find(f => f.name.endsWith('.json'));
        if (jsonFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                const parsed = importFromJson(content);
                if (parsed) {
                    setItems(prev => {
                        const existingIds = new Set(prev.map(i => i.id));
                        const newItems = parsed.filter(p => !existingIds.has(p.id));
                        return [...prev, ...newItems];
                    });
                } else {
                    showToast('Invalid JSON file format.', 'error');
                }
            };
            reader.readAsText(jsonFile);
        }
    };

    const exportToPng = async () => {
        if (viewMode !== 'timeline') {
            showToast('PNG Export is only supported in Timeline View mode.', 'info');
            return;
        }

        const node = document.getElementById('timeline-export-container');
        if (!node) return;

        try {
            setIsExporting(true);
            const dataUrl = await htmlToImage.toPng(node, { 
                backgroundColor: '#0f172a', // slate-900
                pixelRatio: 2 // High resolution
            });
            downloadDataUri(dataUrl, 'release_history_timeline.png');
        } catch (error) {
            console.error('Error exporting PNG:', error);
            showToast('Failed to export PNG.', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div 
            className="flex flex-col h-full bg-[#020617] text-slate-200 selection:bg-indigo-500/30"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <style>
                {`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(0.8) brightness(1.5) contrast(1.2);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                input[type="date"]::-webkit-calendar-picker-indicator:hover {
                    filter: invert(1) brightness(2);
                    background: rgba(255,255,255,0.1);
                }
                `}
            </style>
            {/* Premium Header / Toolbar */}
            <div 
                className="flex-none px-6 py-3 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-[60] flex items-center justify-between gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
                style={{ WebkitAppRegion: 'drag' } as any}
            >
                {/* Left Side: Actions & Search */}
                <div className="flex items-center space-x-2 flex-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setIsAddModalOpen(true);
                        }}
                        className="h-10 px-5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl transition-all flex items-center font-black text-xs shadow-xl shadow-indigo-500/20 active:scale-95 group border border-white/5"
                    >
                        <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform duration-300" />
                        ADD RELEASE
                    </button>

                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
                            title="Import Data"
                        >
                            <Upload size={16} />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />

                        <button
                            onClick={() => exportToJson(items, yearConfigs)}
                            className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
                            title="Export Data"
                        >
                            <Download size={16} />
                        </button>

                        <button
                            onClick={exportToPng}
                            disabled={viewMode !== 'timeline' || isExporting}
                            className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all border border-white/5 ${viewMode !== 'timeline' ? 'text-slate-700 bg-transparent opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}`}
                            title="Save as Image"
                        >
                            {isExporting ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={16} />}
                        </button>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    <div className="w-80 relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full bg-slate-950/40 border border-white/5 rounded-xl pl-12 pr-4 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 focus:bg-slate-950/80 outline-none transition-all placeholder:text-slate-700"
                        />
                    </div>
                </div>

                {/* Right Side: View Toggles (With margin for Window Controls) */}
                <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag', marginRight: '220px' } as any}>
                    <div className="flex bg-slate-950/50 rounded-xl p-1 border border-white/5 shadow-inner">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <LayoutList size={14} className="mr-2" />
                            LIST
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center ${viewMode === 'timeline' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <CalendarRange size={14} className="mr-2" />
                            TIMELINE
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {viewMode === 'list' ? (
                <ListView items={filteredItems} onItemClick={setSelectedItem} />
            ) : (
                <TimelineGraphView 
                    items={filteredItems} 
                    onItemClick={setSelectedItem} 
                    yearConfigs={yearConfigs}
                    onUpdateYearConfig={handleUpdateYearConfig}
                />
            )}

            {/* Modals: Rendered at root level to avoid stacking issues, using high z-index */}
            <div className="relative">
                {selectedItem && (
                    <ReleaseDetailModal 
                        item={selectedItem} 
                        onClose={() => setSelectedItem(null)} 
                        onDelete={handleDeleteItem}
                        onEdit={handleEditItem}
                        showToast={showToast}
                    />
                )}
                
                <AddReleaseModal 
                    isOpen={isAddModalOpen} 
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingItem(null);
                    }} 
                    onSave={handleSaveRelease}
                    existingYears={existingYears}
                    initialData={editingItem}
                    showToast={showToast}
                />
            </div>

            {/* Premium Toast Notification */}
            {toast && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className={`
                        px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border flex items-center gap-4 min-w-[300px]
                        ${toast.type === 'error' ? 'bg-rose-950 border-rose-500/50 text-rose-200' : 
                          toast.type === 'info' ? 'bg-indigo-950 border-indigo-500/50 text-indigo-200' : 
                          'bg-emerald-950 border-emerald-500/50 text-emerald-200'}
                    `}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                            toast.type === 'error' ? 'bg-rose-500' : 
                            toast.type === 'info' ? 'bg-indigo-500' : 
                            'bg-emerald-500'
                        }`} />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReleaseHistoryPlugin;
