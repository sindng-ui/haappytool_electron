import React from 'react';
import { ReleaseItem, getTagColor } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Calendar, Package, Tag, Box, Edit2 } from 'lucide-react';

interface ReleaseDetailModalProps {
    item: ReleaseItem | null;
    onClose: () => void;
    onDelete: (id: string) => void;
    onEdit: (item: ReleaseItem) => void;
}

const ReleaseDetailModal: React.FC<ReleaseDetailModalProps> = ({ item, onClose, onDelete, onEdit }) => {
    if (!item) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center">
                        <Package className="mr-2 text-indigo-400" />
                        Release Details
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-auto flex-1 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600/50 flex items-center">
                            <Box className="text-emerald-400 mr-3" size={20} />
                            <div>
                                <div className="text-xs text-slate-400">Years</div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                    {item.years.map(y => (
                                        <span key={y} className="px-1.5 py-0.5 bg-slate-800 rounded text-xs font-bold text-slate-300 border border-slate-600">
                                            {y}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600/50 flex items-center">
                            <Package className="text-blue-400 mr-3" size={20} />
                            <div>
                                <div className="text-xs text-slate-400">Release Name</div>
                                <div className="font-semibold text-slate-200">{item.releaseName}</div>
                            </div>
                        </div>
                        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600/50 flex items-center">
                            <Tag className="text-amber-400 mr-3" size={20} />
                            <div>
                                <div className="text-xs text-slate-400">Version</div>
                                <div className="font-semibold text-slate-200">{item.version}</div>
                            </div>
                        </div>
                        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600/50 flex items-center">
                            <Calendar className="text-rose-400 mr-3" size={20} />
                            <div>
                                <div className="text-xs text-slate-400">Release Date</div>
                                <div className="font-semibold text-slate-200">{new Date(item.releaseDate).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>

                    {item.tags && item.tags.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {item.tags.map(tag => (
                                    <span 
                                        key={tag} 
                                        className="px-2.5 py-1 rounded text-xs font-bold text-white shadow-lg"
                                        style={{ backgroundColor: getTagColor(tag) }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-4">
                        <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Release Notes</h3>
                        <div className="prose prose-invert max-w-none bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {item.note || '*No notes provided.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 flex justify-between bg-slate-800/80 rounded-b-xl">
                    <button 
                        onClick={() => {
                            if(window.confirm('Are you sure you want to delete this release?')) {
                                onDelete(item.id);
                                onClose();
                            }
                        }} 
                        className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                    >
                        Delete
                    </button>
                    <div className="flex space-x-3">
                        <button 
                            onClick={() => onEdit(item)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-md transition-colors font-medium flex items-center"
                        >
                            <Edit2 size={16} className="mr-2" />
                            Edit
                        </button>
                        <button 
                            onClick={onClose} 
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReleaseDetailModal;
