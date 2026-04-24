import React, { useState, useEffect, useCallback } from 'react';
import { ReleaseItem, getTagColor } from '../types';
import { X, Calendar, Tag, Box, Plus, Check, FileText } from 'lucide-react';

interface AddReleaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: any) => void;
    existingYears: number[];
    initialData?: ReleaseItem | null;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AddReleaseModal: React.FC<AddReleaseModalProps> = ({
    isOpen, onClose, onSave, existingYears, initialData, showToast,
}) => {
    const [years, setYears] = useState<number[]>([]);
    const [releaseName, setReleaseName] = useState('');
    const [version, setVersion] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [note, setNote] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [yearInput, setYearInput] = useState('');
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setYears(initialData.years);
                setReleaseName(initialData.releaseName);
                setVersion(initialData.version);
                setReleaseDate(new Date(initialData.releaseDate).toISOString().split('T')[0]);
                setNote(initialData.note);
                setTags(initialData.tags || []);
            } else {
                const y = new Date().getFullYear();
                setYears([y]);
                setReleaseName('');
                setVersion('');
                setReleaseDate(new Date().toISOString().split('T')[0]);
                setNote('');
                setTags([]);
            }
            setYearInput('');
            setTagInput('');
        }
    }, [isOpen, initialData]);

    const handleAddYear = useCallback((s: string) => {
        const y = parseInt(s);
        if (!isNaN(y) && !years.includes(y) && y > 1990 && y < 2100) {
            setYears(prev => [...prev, y].sort((a, b) => b - a));
            setYearInput('');
        }
    }, [years]);

    const removeYear = useCallback((y: number) => setYears(prev => prev.filter(n => n !== y)), []);

    const handleAddTag = useCallback((t: string) => {
        const trimmed = t.trim();
        if (trimmed && !tags.includes(trimmed)) setTags(prev => [...prev, trimmed]);
        setTagInput('');
    }, [tags]);

    const removeTag = useCallback((t: string) => setTags(prev => prev.filter(x => x !== t)), []);

    const PRESET_TAGS = ['Release', 'Hotfix', 'OTN', 'OSU'];

    const handleSave = () => {
        if (!years.length || !releaseName || !version || !releaseDate) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        onSave({
            id: initialData?.id || `rel_${Date.now()}`,
            years, releaseName, version,
            releaseDate: new Date(releaseDate).getTime(),
            note, tags,
        });
        onClose();
    };

    if (!isOpen) return null;

    const curYear = new Date().getFullYear();
    const presetYears = Array.from(new Set([curYear + 1, curYear, curYear - 1, curYear - 2, ...existingYears]))
        .sort((a, b) => b - a).slice(0, 8);

    return (
        <div
            style={{ position: 'fixed', inset: 0, top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px 16px' }}
        >
            {/* Modal Container: matches View Modal width and layout */}
            <div
                className="bg-[#0f172a] border-2 border-slate-800 rounded-[32px] shadow-2xl w-full max-w-5xl flex flex-col relative"
                style={{ maxHeight: 'calc(100vh - 40px)', minHeight: 'min(900px, calc(100vh - 40px))' }}
            >
                {/* ── 1. Header (fixed) ── */}
                <div className="shrink-0 px-6 py-5 border-b border-slate-800 bg-[#161e2e] rounded-t-[30px]">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg">
                                <Plus className="text-white" size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight uppercase">
                                    {initialData ? 'Update Release' : 'New Release Node'}
                                </h2>
                                <p className="text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase mt-0.5">Project Timeline Architect</p>
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

                {/* ── 2. Body (flex-1, min-h-0) ── */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#0f172a]">

                    {/* 2a. Info Grid + Tags */}
                    <div className="shrink-0 px-6 py-5 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Operational Years */}
                            <div className="bg-[#161e2e] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 focus-within:border-indigo-500/60 transition-all shadow-sm">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-slate-700/50 shrink-0 h-fit">
                                        <Calendar className="text-indigo-400" size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Operational Years</div>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                            {years.map(y => (
                                                <span key={y} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/15 text-indigo-300 text-[11px] font-black rounded-lg border border-indigo-500/25 uppercase tracking-wider shadow-sm">
                                                    {y}
                                                    <button onClick={() => removeYear(y)} className="hover:text-rose-400 transition-colors">
                                                        <X size={12} strokeWidth={3} />
                                                    </button>
                                                </span>
                                            ))}
                                            <input
                                                type="number"
                                                value={yearInput}
                                                onChange={e => setYearInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddYear(yearInput)}
                                                placeholder="Enter year..."
                                                className="bg-transparent text-[13px] text-white font-bold outline-none w-24 placeholder:text-slate-600"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {presetYears.map(y => (
                                                <button key={y} type="button" onClick={() => handleAddYear(y.toString())}
                                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase transition-all border shadow-sm ${years.includes(y)
                                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'}`}>
                                                    {y}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deployment Name */}
                            <div className="bg-[#161e2e] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 focus-within:border-indigo-500/60 transition-all shadow-sm">
                                <div className="flex items-center gap-4 h-full">
                                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-slate-700/50 shrink-0">
                                        <Tag className="text-emerald-400" size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Deployment Name</div>
                                        <input
                                            type="text"
                                            value={releaseName}
                                            onChange={e => setReleaseName(e.target.value)}
                                            placeholder="e.g. 25R1"
                                            className="w-full bg-transparent text-base text-white font-bold outline-none placeholder:text-slate-600 truncate"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Version ID */}
                            <div className="bg-[#161e2e] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 focus-within:border-indigo-500/60 transition-all shadow-sm">
                                <div className="flex items-center gap-4 h-full">
                                    <div className="p-3 bg-amber-500/10 rounded-xl border border-slate-700/50 shrink-0">
                                        <Box className="text-amber-400" size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Version ID</div>
                                        <input
                                            type="text"
                                            value={version}
                                            onChange={e => setVersion(e.target.value)}
                                            placeholder="e.g. 5.0.328"
                                            className="w-full bg-transparent text-base text-white font-bold outline-none placeholder:text-slate-600 truncate"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Release Date */}
                            <div className="bg-[#161e2e] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 focus-within:border-indigo-500/60 transition-all shadow-sm">
                                <div className="flex items-center gap-4 h-full">
                                    <div className="p-3 bg-rose-500/10 rounded-xl border border-slate-700/50 shrink-0">
                                        <Calendar className="text-rose-400" size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Release Date</div>
                                        <input
                                            type="date"
                                            value={releaseDate}
                                            onChange={e => setReleaseDate(e.target.value)}
                                            className="w-full bg-transparent text-base text-white font-bold outline-none"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tags Section */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Quick Context (Tags)</h3>
                                <div className="h-px flex-1 bg-slate-800"></div>
                            </div>
                            <div className="bg-[#161e2e] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 focus-within:border-indigo-500/60 transition-all shadow-sm flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    {tags.map(tag => (
                                        <span key={tag}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black text-white uppercase tracking-wider shadow-sm"
                                            style={{ backgroundColor: getTagColor(tag) }}>
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="hover:opacity-70">
                                                <X size={12} strokeWidth={3} />
                                            </button>
                                        </span>
                                    ))}
                                    <input type="text" value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddTag(tagInput)}
                                        placeholder="Add tag..."
                                        className="bg-transparent text-[13px] text-white font-bold outline-none flex-1 min-w-[100px] placeholder:text-slate-600"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_TAGS.map(t => (
                                        <button key={t} type="button" onClick={() => handleAddTag(t)} disabled={tags.includes(t)}
                                            className={`px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all border shadow-sm ${tags.includes(t)
                                                ? 'opacity-25 cursor-not-allowed bg-slate-700 border-slate-600 text-slate-400'
                                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* 2b. Internal Documentation */}
                    <div className="flex-1 flex flex-col min-h-0 border-t border-slate-800">
                        <div className="shrink-0 px-6 py-3 flex justify-between items-center bg-[#161e2e]/60 border-b border-slate-800/50">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Internal Documentation</h3>
                        </div>
                        <div className="flex-1 overflow-hidden p-6 flex flex-col">
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Enter technical notes, change details, release context..."
                                className="flex-1 w-full text-[14px] text-slate-300 font-medium outline-none resize-none custom-scrollbar placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#1a2333] border border-slate-800 rounded-2xl p-5 transition-all leading-relaxed shadow-sm whitespace-pre-wrap"
                                style={{ backgroundColor: '#161e2e', colorScheme: 'dark', wordBreak: 'break-all' }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── 3. Footer ── */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-800 flex justify-between items-center bg-[#161e2e] rounded-b-[30px]">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all font-black text-[10px] tracking-widest uppercase border border-slate-700 active:scale-95"
                    >
                        Abort
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-black text-[10px] tracking-widest uppercase shadow-lg active:scale-95 border border-indigo-400/20 flex items-center gap-2"
                    >
                        <Check size={14} strokeWidth={3} />
                        {initialData ? 'Update Release' : 'Publish Node'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddReleaseModal;
