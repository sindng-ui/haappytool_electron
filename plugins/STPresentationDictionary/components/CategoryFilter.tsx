import React, { useState } from 'react';
import { Tag, Plus, X, Edit3, Check } from 'lucide-react';

interface CategoryFilterProps {
    categories: string[];
    selectedCategories: string[];
    onToggleCategory: (cat: string) => void;
    onUpdateCategoriesList: (newList: string[]) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
    categories,
    selectedCategories,
    onToggleCategory,
    onUpdateCategoriesList
}) => {
    const [newCatName, setNewCatName] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [showMgmt, setShowMgmt] = useState(false);

    const handleAddCategory = () => {
        const val = newCatName.trim();
        if (!val) return;
        if (categories.includes(val)) {
            alert('This category name already exists.');
            return;
        }
        const updated = [...categories, val];
        onUpdateCategoriesList(updated);
        setNewCatName('');
    };

    const handleDeleteCategory = (cat: string) => {
        if (confirm(`Are you sure you want to delete the "${cat}" category?\nDevices assigned to this category will keep their properties, but this category option will be removed from filters.`)) {
            const updated = categories.filter(c => c !== cat);
            onUpdateCategoriesList(updated);
        }
    };

    const handleStartEdit = (idx: number, currentVal: string) => {
        setEditingIndex(idx);
        setEditValue(currentVal);
    };

    const handleSaveEdit = (idx: number) => {
        const val = editValue.trim();
        if (!val) return;
        if (categories.includes(val) && categories[idx] !== val) {
            alert('This category name already exists.');
            return;
        }
        const updated = [...categories];
        updated[idx] = val;
        onUpdateCategoriesList(updated);
        setEditingIndex(null);
        setEditValue('');
    };

    return (
        <div className="bg-slate-900/60 border border-slate-850/40 rounded-2xl p-4 shadow-xl select-none">
            <div className="flex justify-between items-center mb-3.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Device Categories
                </span>
                <button 
                    onClick={() => setShowMgmt(!showMgmt)}
                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-350 transition-colors uppercase"
                >
                    {showMgmt ? 'Back to Filters' : 'Manage Categories'}
                </button>
            </div>

            {!showMgmt ? (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            if (selectedCategories.length > 0) {
                                selectedCategories.forEach(c => onToggleCategory(c));
                            }
                        }}
                        className={`text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl transition-all tracking-wide ${
                            selectedCategories.length === 0 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-650/20 active:scale-95' 
                                : 'bg-slate-950/80 text-slate-400 hover:bg-indigo-950/50 hover:text-indigo-300'
                        }`}
                    >
                        All Devices
                    </button>
                    {categories.map(cat => {
                        const isSelected = selectedCategories.includes(cat);
                        return (
                            <button
                                key={cat}
                                onClick={() => onToggleCategory(cat)}
                                className={`text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl transition-all tracking-wide ${
                                    isSelected 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-650/20 active:scale-95' 
                                        : 'bg-slate-950/80 text-slate-400 hover:bg-indigo-950/50 hover:text-indigo-300'
                                }`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New category name..."
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                        />
                        <button
                            onClick={handleAddCategory}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-indigo-600/20 uppercase"
                        >
                            <Plus className="w-3.5 h-3.5 font-black" />
                            Add
                        </button>
                    </div>

                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                        {categories.map((cat, idx) => {
                            const isEditing = editingIndex === idx;
                            return (
                                <div key={cat} className="flex justify-between items-center bg-slate-950/60 border border-slate-850/60 rounded-xl px-3 py-1.5 text-xs hover:border-slate-800 transition-all">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(idx); }}
                                            className="bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white font-bold focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="text-slate-200 font-extrabold text-[11px]">{cat}</span>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                        {isEditing ? (
                                            <button 
                                                onClick={() => handleSaveEdit(idx)}
                                                className="text-emerald-400 hover:text-emerald-300 p-0.5 transition-colors"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleStartEdit(idx, cat)}
                                                className="text-slate-500 hover:text-indigo-400 p-0.5 transition-colors"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDeleteCategory(cat)}
                                            className="text-slate-500 hover:text-rose-405 p-0.5 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
