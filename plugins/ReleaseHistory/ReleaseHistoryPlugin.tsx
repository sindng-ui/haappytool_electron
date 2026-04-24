import React, { useState, useMemo, useRef, useEffect } from 'react';
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

    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<ReleaseItem | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ReleaseItem | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
                alert('Invalid JSON file format for Release History.');
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
                    alert('Invalid JSON file format.');
                }
            };
            reader.readAsText(jsonFile);
        }
    };

    const exportToPng = async () => {
        if (viewMode !== 'timeline') {
            alert('PNG Export is only supported in Timeline View mode.');
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
            alert('Failed to export PNG.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div 
            className="flex flex-col h-full bg-slate-900 text-slate-200"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Toolbar */}
            <div 
                className="flex-none px-4 py-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between gap-4"
                style={{ WebkitAppRegion: 'drag' } as any}
            >
                {/* Left Side: Search & Actions */}
                <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <div className="w-80 relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search release, version, year..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-full pl-12 pr-4 py-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:bg-slate-950 outline-none transition-all placeholder:text-slate-600"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                setEditingItem(null);
                                setIsAddModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center font-medium shadow-lg shadow-indigo-500/20 text-xs"
                        >
                            <Plus size={14} className="mr-1" />
                            Add Release
                        </button>
                        
                        <div className="h-6 w-px bg-slate-700 mx-1" />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Import JSON"
                        >
                            <Upload size={16} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImportFile} 
                            accept=".json" 
                            className="hidden" 
                        />

                        <button
                            onClick={() => exportToJson(items, yearConfigs)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Export JSON"
                        >
                            <Download size={16} />
                        </button>

                        <button
                            onClick={() => {
                                exportToMarkdown(filteredItems);
                                alert('Markdown copied to clipboard!');
                            }}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Copy as Markdown"
                        >
                            <FileText size={16} />
                        </button>

                        <button
                            onClick={exportToPng}
                            disabled={viewMode !== 'timeline' || isExporting}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode !== 'timeline' ? 'text-slate-600 bg-slate-800/50 cursor-not-allowed' : 'text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700'}`}
                            title="Export Timeline as PNG"
                        >
                            <ImageIcon size={16} />
                        </button>
                    </div>
                </div>

                {/* Right Side: View Toggles (With margin for Window Controls) */}
                <div className="flex-1" />
                <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag', marginRight: '220px' } as any}>
                    <div className="flex bg-slate-900/80 rounded-lg p-1 border border-slate-700 shadow-inner">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <LayoutList size={14} className="mr-1.5" />
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center ${viewMode === 'timeline' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <CalendarRange size={14} className="mr-1.5" />
                            Timeline
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

            {/* Modals */}
            <ReleaseDetailModal 
                item={selectedItem} 
                onClose={() => setSelectedItem(null)} 
                onDelete={handleDeleteItem}
                onEdit={handleEditItem}
            />
            
            <AddReleaseModal 
                isOpen={isAddModalOpen} 
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                }} 
                onSave={handleSaveRelease}
                existingYears={existingYears}
                initialData={editingItem}
            />
        </div>
    );
};

export default ReleaseHistoryPlugin;
