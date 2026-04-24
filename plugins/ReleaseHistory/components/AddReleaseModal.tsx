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

// ── Section Label — matches View modal label style ──
const SectionLabel = React.memo(({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
    <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className={color} strokeWidth={2.5} />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">{label}</span>
    </div>
));

// ── Preview Card ──
const PreviewCard = React.memo(({ releaseName, version, releaseDate, tags }: any) => (
    <div className="w-full bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <span className="text-[11px] font-black text-slate-400 truncate max-w-[130px] tracking-widest uppercase">
                {releaseName || 'UNNAMED'}
            </span>
            <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                {releaseDate
                    ? new Date(releaseDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
                    : '--/--'}
            </span>
        </div>
        <div className="flex items-center gap-3.5">
            <div className="w-1.5 h-10 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600 shrink-0" />
            <span className="text-4xl font-black text-white tracking-tighter leading-none">
                {version ? (version.startsWith('v') ? version : `v${version}`) : 'v0.0.0'}
            </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
            {(tags.length > 0 ? tags : ['TAG']).map((t: string) => (
                <span key={t}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-black text-white uppercase tracking-wider"
                    style={{ backgroundColor: getTagColor(t) }}>
                    {t}
                </span>
            ))}
        </div>
    </div>
));

// ── Shared input style ──
const fieldStyle: React.CSSProperties = { backgroundColor: '#161e2e', colorScheme: 'dark' };
const fieldCls = "w-full text-[14px] text-white font-medium outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#1a2333] border border-slate-800 rounded-2xl px-6 py-4 shadow-sm";

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
        <div style={{
            position: 'fixed', inset: 0, width: '100vw', height: '100vh',
            zIndex: 9999, backgroundColor: '#020817',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px',
        }}>
            {/* Modal container — matches View modal tokens */}
            <div
                className="bg-[#0f172a] border-2 border-slate-800 rounded-[32px] shadow-2xl w-full flex overflow-hidden"
                style={{ height: 'calc(100vh - 16px)', maxWidth: 'min(1280px, calc(100vw - 16px))' }}
            >
                {/* ══ LEFT: Form ══ */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Header */}
                    <div className="shrink-0 flex items-center justify-between px-9 py-7 border-b border-slate-800 bg-[#161e2e] rounded-tl-[30px]">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 flex items-center justify-center bg-indigo-600 rounded-2xl shadow-lg shrink-0">
                                <Plus className="text-white" size={22} strokeWidth={3} />
                            </div>
                            <div className="leading-none">
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">
                                    {initialData ? 'Update Release' : 'New Release Node'}
                                </h2>
                                <p className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase mt-1.5">
                                    Project Timeline Architect
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 active:scale-95 shrink-0"
                        >
                            <X size={17} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Form body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a1120]">
                        <div className="flex flex-col min-h-full px-10 py-10 gap-8">

                            {/* ─ Target Years ─ */}
                            <div>
                                <SectionLabel icon={Calendar} label="Operational Years" color="text-indigo-400" />
                                <div
                                    className="flex flex-wrap items-center gap-2.5 px-5 py-4 border border-slate-800 rounded-2xl focus-within:border-indigo-500/60 transition-all shadow-sm min-h-[64px]"
                                    style={{ backgroundColor: '#161e2e' }}
                                >
                                    {years.map(y => (
                                        <span key={y} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/15 text-indigo-300 text-[12px] font-black rounded-xl border border-indigo-500/25 uppercase tracking-wider shadow-sm">
                                            {y}
                                            <button onClick={() => removeYear(y)} className="hover:text-rose-400 transition-colors">
                                                <X size={13} strokeWidth={3} />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        type="number"
                                        value={yearInput}
                                        onChange={e => setYearInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddYear(yearInput)}
                                        placeholder="Enter year..."
                                        className="bg-transparent text-[14px] text-white font-medium outline-none w-32 placeholder:text-slate-600"
                                    />
                                </div>
                                {/* Preset buttons */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {presetYears.map(y => (
                                        <button key={y} type="button" onClick={() => handleAddYear(y.toString())}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all border ${years.includes(y)
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                                                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700'}`}>
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ─ Name & Version ─ */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <SectionLabel icon={Tag} label="Deployment Name" color="text-emerald-400" />
                                    <input type="text" value={releaseName}
                                        onChange={e => setReleaseName(e.target.value)}
                                        placeholder="e.g. 25R1"
                                        className={fieldCls} style={fieldStyle} />
                                </div>
                                <div>
                                    <SectionLabel icon={Box} label="Version ID" color="text-amber-400" />
                                    <input type="text" value={version}
                                        onChange={e => setVersion(e.target.value)}
                                        placeholder="e.g. 5.0.328"
                                        className={fieldCls} style={fieldStyle} />
                                </div>
                            </div>

                            {/* ─ Date & Tags ─ */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <SectionLabel icon={Calendar} label="Release Date" color="text-rose-400" />
                                    <input type="date" value={releaseDate}
                                        onChange={e => setReleaseDate(e.target.value)}
                                        className={fieldCls} style={fieldStyle} />
                                </div>
                                <div>
                                    <SectionLabel icon={Tag} label="Quick Context" color="text-indigo-400" />
                                    <div
                                        className="flex flex-wrap items-center gap-2.5 px-5 py-4 border border-slate-800 rounded-2xl focus-within:border-indigo-500/60 transition-all shadow-sm min-h-[64px]"
                                        style={{ backgroundColor: '#161e2e' }}
                                    >
                                        {tags.map(tag => (
                                            <span key={tag}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black text-white uppercase tracking-wider shadow-sm"
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
                                            className="bg-transparent text-[14px] text-white font-medium outline-none flex-1 min-w-[100px] placeholder:text-slate-600"
                                        />
                                    </div>
                                    {/* Preset tags */}
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {PRESET_TAGS.map(t => (
                                            <button key={t} type="button" onClick={() => handleAddTag(t)} disabled={tags.includes(t)}
                                                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${tags.includes(t)
                                                    ? 'opacity-25 cursor-not-allowed bg-slate-700 border-slate-600 text-slate-400'
                                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'}`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ─ Internal Documentation ─ */}
                            <div className="flex flex-col flex-1 min-h-[250px]">
                                <SectionLabel icon={FileText} label="Internal Documentation" color="text-slate-400" />
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Enter technical notes, change details, release context..."
                                    className="flex-1 w-full text-[14px] text-white font-medium outline-none resize-none custom-scrollbar placeholder:text-slate-600 focus:border-indigo-500/60 focus:bg-[#1a2333] border border-slate-800 rounded-2xl px-6 py-5 transition-all leading-relaxed shadow-sm"
                                    style={{ backgroundColor: '#161e2e', colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══ RIGHT: Preview Sidebar ══ */}
                <div className="w-[360px] shrink-0 flex flex-col border-l border-slate-800 bg-[#0f172a]">

                    {/* Sidebar header */}
                    <div className="shrink-0 px-7 py-7 border-b border-slate-800 bg-[#161e2e] rounded-tr-[30px]">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Deployment Preview</p>
                    </div>

                    {/* Preview card + stats */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-7 py-7 flex flex-col gap-6">
                        <PreviewCard
                            releaseName={releaseName}
                            version={version}
                            releaseDate={releaseDate}
                            tags={tags}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-[#161e2e] rounded-2xl border border-slate-800 text-center hover:border-slate-700 transition-all">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Target Scope</p>
                                <p className="text-3xl font-black text-white tracking-tighter">{years.length}</p>
                            </div>
                            <div className="p-5 bg-[#161e2e] rounded-2xl border border-slate-800 text-center hover:border-slate-700 transition-all">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Context Nodes</p>
                                <p className="text-3xl font-black text-white tracking-tighter">{tags.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="shrink-0 px-7 py-7 border-t border-slate-800 bg-[#161e2e] space-y-3 rounded-br-[30px]">
                        <button
                            onClick={handleSave}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 border border-indigo-400/20"
                        >
                            <Check size={16} strokeWidth={3} />
                            <span className="tracking-widest uppercase text-[12px]">
                                {initialData ? 'Update' : 'Publish Node'}
                            </span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-black py-3.5 rounded-xl transition-all border border-slate-700 text-[10px] tracking-widest uppercase"
                        >
                            Abort
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddReleaseModal;
