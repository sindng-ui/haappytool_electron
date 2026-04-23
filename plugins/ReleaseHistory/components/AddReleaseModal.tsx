import React, { useState, useEffect } from 'react';
import { ReleaseItem, TAG_COLORS, getTagColor } from '../types';
import { X, Save, Calendar, Package, Tag, Info, Plus } from 'lucide-react';

interface AddReleaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Omit<ReleaseItem, 'id'>) => void;
    existingProducts: string[];
    initialData?: ReleaseItem | null;
}

const PRESET_TAGS = Object.keys(TAG_COLORS);

const AddReleaseModal: React.FC<AddReleaseModalProps> = ({ isOpen, onClose, onSave, existingProducts, initialData }) => {
    const [productName, setProductName] = useState('');
    const [releaseName, setReleaseName] = useState('');
    const [version, setVersion] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [note, setNote] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (isOpen) {
            setProductName(initialData?.productName || '');
            setReleaseName(initialData?.releaseName || '');
            setVersion(initialData?.version || '');
            setReleaseDate(initialData ? new Date(initialData.releaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setNote(initialData?.note || '');
            setTags(initialData?.tags || []);
            setTagInput('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleAddTag = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!productName || !releaseName || !version || !releaseDate) return;

        onSave({
            productName,
            releaseName,
            version,
            releaseDate: new Date(releaseDate).getTime(),
            note,
            tags
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50">
                    <h2 className="text-lg font-bold text-slate-100">{initialData ? 'Edit Release History' : 'Add Release History'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-auto flex-1 custom-scrollbar space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">
                                <Package size={14} className="mr-1.5 text-emerald-400" />
                                Product Name
                            </label>
                            <input
                                type="text"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g. SmartThings"
                                list="product-list"
                                required
                            />
                            <datalist id="product-list">
                                {existingProducts.map(p => <option key={p} value={p} />)}
                            </datalist>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">
                                <Info size={14} className="mr-1.5 text-blue-400" />
                                Release Name
                            </label>
                            <input
                                type="text"
                                value={releaseName}
                                onChange={(e) => setReleaseName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g. PluginA"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">
                                <Tag size={14} className="mr-1.5 text-amber-400" />
                                Version
                            </label>
                            <input
                                type="text"
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g. 1.0.0"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">
                                <Calendar size={14} className="mr-1.5 text-rose-400" />
                                Release Date
                            </label>
                            <input
                                type="date"
                                value={releaseDate}
                                onChange={(e) => setReleaseDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                                required
                            />
                        </div>
                    </div>

                    {/* Tag System */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">
                            <Tag size={14} className="mr-1.5 text-indigo-400" />
                            Tags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {tags.map(tag => (
                                <span 
                                    key={tag} 
                                    className="px-2 py-1 rounded flex items-center text-xs font-bold text-white group"
                                    style={{ backgroundColor: getTagColor(tag) }}
                                >
                                    {tag}
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="ml-1.5 hover:text-white/80 transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            {tags.length === 0 && <span className="text-xs text-slate-600 italic">No tags added</span>}
                        </div>
                        
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddTag(tagInput);
                                    }
                                }}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Press Enter to add tag"
                            />
                            <button 
                                type="button"
                                onClick={() => handleAddTag(tagInput)}
                                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {PRESET_TAGS.map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleAddTag(preset)}
                                    disabled={tags.includes(preset)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${tags.includes(preset) ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed' : 'bg-slate-700/30 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'}`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center">
                            <Plus size={14} className="mr-1.5 text-slate-400" />
                            Release Note (Markdown)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={5}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y custom-scrollbar"
                            placeholder="- Fixed bug X&#10;- Added feature Y"
                        />
                    </div>
                </form>

                <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex justify-end space-x-3">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors flex items-center font-medium shadow-lg shadow-indigo-500/20"
                    >
                        <Save size={18} className="mr-2" />
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddReleaseModal;
