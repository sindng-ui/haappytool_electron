import React, { useMemo, useState } from 'react';
import { ReleaseItem, getTagColor } from '../types';
import { ChevronDown, ChevronRight, Package, Box } from 'lucide-react';

interface ListViewProps {
    items: ReleaseItem[];
    onItemClick: (item: ReleaseItem) => void;
}

const ListView: React.FC<ListViewProps> = ({ items, onItemClick }) => {
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

    // Group items by year -> releaseName
    const groupedData = useMemo(() => {
        const groups: Record<number, Record<string, ReleaseItem[]>> = {};
        items.forEach(item => {
            item.years.forEach(year => {
                if (!groups[year]) {
                    groups[year] = {};
                }
                if (!groups[year][item.releaseName]) {
                    groups[year][item.releaseName] = [];
                }
                groups[year][item.releaseName].push(item);
            });
        });

        // Sort items by date descending inside groups
        Object.keys(groups).forEach(yearStr => {
            const year = parseInt(yearStr);
            Object.keys(groups[year]).forEach(app => {
                groups[year][app].sort((a, b) => b.releaseDate - a.releaseDate);
            });
        });

        return groups;
    }, [items]);

    const toggleProduct = (prodName: string) => {
        setExpandedProducts(prev => ({
            ...prev,
            [prodName]: !prev[prodName]
        }));
    };

    if (items.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4 animate-in fade-in zoom-in duration-500">
                <div className="p-6 bg-slate-900/50 rounded-[40px] border border-white/5 shadow-2xl">
                    <Box size={48} className="opacity-20 mb-2" />
                </div>
                <p className="font-black text-sm tracking-widest uppercase opacity-40">No release history found</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-8 space-y-10 custom-scrollbar bg-[#020617]">
            {Object.keys(groupedData).sort((a, b) => parseInt(b) - parseInt(a)).map(yearStr => {
                const year = parseInt(yearStr);
                const isExpanded = expandedProducts[yearStr] !== false; 
                const apps = groupedData[year];

                return (
                    <div key={yearStr} className="group/year animate-in slide-in-from-bottom-4 duration-500">
                        {/* Year Header */}
                        <div 
                            className="flex items-center gap-4 mb-6 cursor-pointer group/header"
                            onClick={() => toggleProduct(yearStr)}
                        >
                            <div className="relative flex items-center gap-4">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-hover/header:opacity-40 transition-opacity" />
                                <div className="relative px-6 py-2 bg-slate-900 border border-white/10 rounded-2xl flex items-center gap-3">
                                    <h3 className="text-2xl font-black text-white tracking-tighter">{year}</h3>
                                    <div className="w-1 h-4 bg-indigo-500/30 rounded-full" />
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                        {Object.values(apps).flat().length} Records
                                    </span>
                                </div>
                                <div className={`p-2 rounded-xl border border-white/5 bg-slate-950/50 text-slate-500 transition-all duration-300 group-hover/header:bg-indigo-500/20 group-hover/header:text-indigo-400 ${isExpanded ? '' : '-rotate-90 scale-90 opacity-50'}`}>
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                        </div>

                        {/* Releases List */}
                        {isExpanded && (
                            <div className="grid gap-10">
                                {Object.keys(apps).sort().map(releaseName => (
                                    <div key={releaseName} className="relative pl-8 border-l border-white/5 ml-12">
                                        {/* Product Indicator */}
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-800 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
                                        
                                        <div className="flex items-center gap-2 mb-4 group/prod">
                                            <Package size={14} className="text-emerald-500/50 group-hover/prod:text-emerald-400 transition-colors" />
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{releaseName}</h4>
                                        </div>

                                        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {apps[releaseName].map(item => (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => onItemClick(item)}
                                                    className="relative group/card bg-slate-900/40 backdrop-blur-sm border border-white/5 p-5 rounded-[24px] cursor-pointer hover:bg-slate-800/60 hover:border-indigo-500/30 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden"
                                                >
                                                    {/* Card Glow Effect */}
                                                    <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 to-purple-600/10 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                    
                                                    <div className="relative z-10">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-lg font-black text-white tracking-tighter group-hover/card:text-indigo-300 transition-colors">
                                                                    {item.version.startsWith('v') ? item.version : `v${item.version}`}
                                                                </span>
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                                                                    {new Date(item.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            <div className="p-1.5 bg-slate-950/50 rounded-lg border border-white/5 opacity-0 group-hover/card:opacity-100 transition-all transform translate-x-2 group-hover/card:translate-x-0">
                                                                <ChevronRight size={14} className="text-indigo-400" />
                                                            </div>
                                                        </div>
                                                        
                                                        {item.tags && item.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                                {item.tags.map(tag => (
                                                                    <span 
                                                                        key={tag} 
                                                                        className="px-2 py-0.5 rounded-md text-[8px] font-black text-white uppercase tracking-tighter shadow-lg border border-white/10"
                                                                        style={{ backgroundColor: getTagColor(tag) }}
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed group-hover:text-slate-300 transition-colors">
                                                            {item.note || 'No detailed notes provided.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ListView;
