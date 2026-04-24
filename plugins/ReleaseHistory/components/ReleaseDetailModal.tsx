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
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ReleaseDetailModal: React.FC<ReleaseDetailModalProps> = ({ item, onClose, onDelete, onEdit, showToast }) => {
    if (!item) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px 16px' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Modal Container: 고정 flex 구조 - 뷰포트 높이를 절대 초과하지 않음 */}
            <div
                className="bg-[#0f172a] border-2 border-slate-800 rounded-[32px] shadow-2xl w-full max-w-5xl flex flex-col relative"
                style={{ maxHeight: 'calc(100vh - 40px)' }}
            >
                {/* ── 1. Header (fixed, shrink-0) ── */}
                <div className="shrink-0 px-6 py-5 border-b border-slate-800 bg-[#161e2e] rounded-t-[30px]">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg">
                                <Package className="text-white" size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight uppercase">
                                    Release Information
                                </h2>
                                <p className="text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase mt-0.5">Version Control Node</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 active:scale-95"
                        >
                            <X size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* ── 2. Body (flex-1, min-h-0 → 내부에서만 팽창) ── */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#0f172a]">

                    {/* 2a. Info Grid + Tags (shrink-0 → 고정 크기) */}
                    <div className="shrink-0 px-6 py-5 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Target Years', value: item.years.join(', '), icon: Calendar, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                                { label: 'Release Name', value: item.releaseName, icon: Tag, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                { label: 'Version', value: item.version, icon: Box, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                                { label: 'Release Date', value: new Date(item.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), icon: Calendar, color: 'text-rose-400', bg: 'bg-rose-500/10' }
                            ].map((info, idx) => (
                                <div key={idx} className="bg-[#161e2e] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 ${info.bg} rounded-xl border border-slate-700/50 shrink-0`}>
                                            <info.icon className={info.color} size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{info.label}</div>
                                            <div className="font-bold text-white text-base tracking-tight truncate">{info.value}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tags Section */}
                        {item.tags && item.tags.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Assigned Tags</h3>
                                    <div className="h-px flex-1 bg-slate-800"></div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {item.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="px-4 py-1.5 rounded-lg text-[10px] font-black text-white uppercase tracking-wider shadow-md"
                                            style={{ backgroundColor: getTagColor(tag) }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2b. Internal Documentation (flex-1 + overflow-y-auto → 이 부분만 스크롤) */}
                    <div className="flex-1 flex flex-col min-h-0 border-t border-slate-800">
                        {/* 문서 섹션 헤더 (고정) */}
                        <div className="shrink-0 px-6 py-3 flex justify-between items-center bg-[#161e2e]/60 border-b border-slate-800/50">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Internal Documentation</h3>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(item.note || '');
                                    showToast('Documentation copied to clipboard', 'success');
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest border border-slate-700 active:scale-95"
                            >
                                Copy Text
                            </button>
                        </div>

                        {/* 문서 내용 (overflow-y-auto → 스크롤 핵심) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="prose prose-invert max-w-none bg-[#161e2e] p-5 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed font-medium whitespace-pre-wrap break-words">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {item.note || '*No notes available.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 3. Footer (fixed, shrink-0) ── */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-800 flex justify-between items-center bg-[#161e2e] rounded-b-[30px]">
                    <button
                        onClick={() => {
                            if (window.confirm('Delete this release?')) {
                                onDelete(item.id);
                                onClose();
                            }
                        }}
                        className="px-5 py-2.5 bg-rose-900/30 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all font-black text-[10px] tracking-widest uppercase border border-rose-500/20 active:scale-95"
                    >
                        Delete
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={() => onEdit(item)}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all font-black text-[10px] tracking-widest uppercase border border-slate-700 active:scale-95 flex items-center gap-2"
                        >
                            <Edit2 size={13} strokeWidth={3} />
                            Edit Release
                        </button>
                        <button
                            onClick={onClose}
                            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-black text-[10px] tracking-widest uppercase shadow-lg active:scale-95 border border-indigo-400/20"
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
