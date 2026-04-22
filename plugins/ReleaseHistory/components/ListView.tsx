import React, { useMemo, useState } from 'react';
import { ReleaseItem } from '../types';
import { ChevronDown, ChevronRight, Package, Box } from 'lucide-react';

interface ListViewProps {
    items: ReleaseItem[];
    onItemClick: (item: ReleaseItem) => void;
}

const ListView: React.FC<ListViewProps> = ({ items, onItemClick }) => {
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

    // Group items by productName -> appName
    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, ReleaseItem[]>> = {};
        items.forEach(item => {
            if (!groups[item.productName]) {
                groups[item.productName] = {};
            }
            if (!groups[item.productName][item.releaseName]) {
                groups[item.productName][item.releaseName] = [];
            }
            groups[item.productName][item.releaseName].push(item);
        });

        // Sort items by date descending inside groups
        Object.keys(groups).forEach(prod => {
            Object.keys(groups[prod]).forEach(app => {
                groups[prod][app].sort((a, b) => b.releaseDate - a.releaseDate);
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
            <div className="flex-1 flex items-center justify-center text-slate-500">
                No release history found. Add some or import JSON.
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-4 space-y-4">
            {Object.keys(groupedData).sort().map(prodName => {
                const isExpanded = expandedProducts[prodName] !== false; // Default expanded
                const apps = groupedData[prodName];

                return (
                    <div key={prodName} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                        {/* Product Header */}
                        <div 
                            className="bg-slate-700 p-3 flex items-center cursor-pointer hover:bg-slate-600 transition-colors"
                            onClick={() => toggleProduct(prodName)}
                        >
                            {isExpanded ? <ChevronDown size={18} className="mr-2" /> : <ChevronRight size={18} className="mr-2" />}
                            <Package size={20} className="mr-2 text-indigo-400" />
                            <h3 className="text-lg font-semibold text-slate-100">{prodName}</h3>
                            <span className="ml-auto text-sm text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                                {Object.values(apps).flat().length} items
                            </span>
                        </div>

                        {/* Releases List */}
                        {isExpanded && (
                            <div className="p-3 space-y-4 bg-slate-800/50">
                                {Object.keys(apps).sort().map(releaseName => (
                                    <div key={releaseName} className="ml-6">
                                        <div className="flex items-center mb-2">
                                            <Box size={16} className="mr-2 text-emerald-400" />
                                            <h4 className="font-medium text-slate-200">{releaseName}</h4>
                                        </div>
                                        <div className="ml-6 grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                            {apps[releaseName].map(item => (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => onItemClick(item)}
                                                    className="bg-slate-700 p-3 rounded-md cursor-pointer hover:bg-slate-600 hover:ring-1 hover:ring-indigo-500 transition-all flex flex-col"
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-slate-100">{item.version}</span>
                                                        <span className="text-xs text-slate-400">
                                                            {new Date(item.releaseDate).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-300 line-clamp-2">
                                                        {item.note || 'No notes provided.'}
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
