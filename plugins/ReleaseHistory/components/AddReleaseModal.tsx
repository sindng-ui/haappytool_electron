import React, { useState, useEffect, useCallback } from 'react';
import { ReleaseItem, getTagColor } from '../types';
import { X, Calendar, Tag, Box, Plus, Check } from 'lucide-react';

interface AddReleaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: any) => void;
    existingYears: number[];
    initialData?: ReleaseItem | null;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// Optimized Internal Components to prevent unnecessary re-renders
const FormLabel = React.memo(({ icon: Icon, label, colorClass }: { icon: any, label: string, colorClass: string }) => (
    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-3">
        <div className={`p-1.5 ${colorClass} rounded-lg`}>
            <Icon size={18} className="shadow-lg" /> 
        </div>
        {label}
    </label>
));

const PreviewCard = React.memo(({ releaseName, version, releaseDate, tags }: any) => (
    <div className="transform transition-all duration-700 ease-out hover:scale-105 group perspective-1000">
        <div className="w-[300px] bg-[#111827]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/5 flex flex-col gap-6 group-hover:ring-indigo-500/40 transition-all duration-500 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="flex justify-between items-center relative z-10">
                <span className="text-xs font-black text-white/40 truncate max-w-[140px] tracking-tight uppercase">{releaseName || 'UNNAMED'}</span>
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20 shadow-inner">
                    {releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '04. 24.'}
                </span>
            </div>

            <div className="flex items-center gap-4 relative z-10">
                <div className="w-2 h-10 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                <span className="text-4xl font-black text-white tracking-tighter leading-none">
                    {version ? (version.startsWith('v') ? version : `v${version}`) : 'v0.0.0'}
                </span>
            </div>
            
            <div className="flex flex-wrap gap-2 relative z-10">
                {(tags.length > 0 ? tags : ['TAG']).map((t: string) => (
                    <span key={t} className="px-3 py-1 rounded-lg text-[9px] font-black text-white leading-none uppercase tracking-[0.15em] shadow-2xl border border-white/10" style={{ backgroundColor: getTagColor(t) }}>
                        {t}
                    </span>
                ))}
            </div>
        </div>
    </div>
));

const AddReleaseModal: React.FC<AddReleaseModalProps> = ({ isOpen, onClose, onSave, existingYears, initialData, showToast }) => {
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
                const currentYear = new Date().getFullYear();
                setYears([currentYear]);
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

    const handleAddYear = useCallback((yearStr: string) => {
        const year = parseInt(yearStr);
        if (!isNaN(year) && !years.includes(year) && year > 1990 && year < 2100) {
            setYears(prev => [...prev, year].sort((a, b) => b - a));
            setYearInput('');
        }
    }, [years]);

    const removeYear = useCallback((year: number) => {
        setYears(prev => prev.filter(y => y !== year));
    }, []);

    const handleAddTag = useCallback((tagToAdd: string) => {
        const trimmed = tagToAdd.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags(prev => [...prev, trimmed]);
        }
        setTagInput('');
    }, [tags]);

    const removeTag = useCallback((tagToRemove: string) => {
        setTags(prev => prev.filter(t => t !== tagToRemove));
    }, []);

    const PRESET_TAGS = ['Release', 'Hotfix', 'OTN', 'OSU'];

    const handleSave = () => {
        if (years.length === 0 || !releaseName || !version || !releaseDate) {
            showToast('Please fill in all required fields (Years, Name, Version, Date)', 'error');
            return;
        }
        onSave({
            id: initialData?.id || `rel_${Date.now()}`,
            years,
            releaseName,
            version,
            releaseDate: new Date(releaseDate).getTime(),
            note,
            tags
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#02040a]/95 animate-in fade-in duration-300">
            {/* Modal Container: Solid & Professional */}
            <div className="bg-[#0f172a] border-2 border-slate-800 rounded-[32px] shadow-2xl w-full max-w-6xl flex h-[85vh] overflow-hidden relative transition-all will-change-transform">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-6 right-6 z-[110] p-3 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 shadow-md">
                    <X size={20} strokeWidth={3} />
                </button>

                {/* Left Side: Solid Form Area */}
                <div className="flex-1 p-12 overflow-y-auto custom-scrollbar border-r border-slate-800 bg-[#0f172a]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg">
                            <Plus className="text-white" size={28} strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                                {initialData ? 'Update Release' : 'New Release Node'}
                            </h2>
                            <p className="text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase mt-1">Project Timeline Architect</p>
                        </div>
                    </div>

                    <div className="space-y-10">
                        {/* Target Years */}
                        <div className="space-y-4">
                            <FormLabel icon={Calendar} label="Operational Years" colorClass="bg-indigo-500/10 text-indigo-400" />
                            <div className="flex flex-wrap gap-2.5 p-5 bg-[#161e2e] rounded-2xl border border-slate-800 focus-within:border-indigo-500/50 transition-all shadow-inner">
                                {years.map(year => (
                                    <span key={year} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-300 text-[10px] font-black rounded-lg border border-indigo-500/20">
                                        {year}
                                        <button onClick={() => removeYear(year)} className="hover:text-rose-400 transition-colors"><X size={12} strokeWidth={4} /></button>
                                    </span>
                                ))}
                                <input 
                                    type="number" 
                                    value={yearInput} 
                                    onChange={(e) => setYearInput(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddYear(yearInput)} 
                                    placeholder="Type year..." 
                                    className="bg-transparent text-sm text-white font-bold outline-none w-24 placeholder:text-slate-700" 
                                />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const presets = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
                                    const combined = Array.from(new Set([...presets, ...existingYears])).sort((a, b) => b - a).slice(0, 8);
                                    return combined.map(y => (
                                        <button key={y} type="button" onClick={() => handleAddYear(y.toString())} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all border ${years.includes(y) ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'}`}>{y}</button>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* Name & Version Grid */}
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <FormLabel icon={Tag} label="Deployment Name" colorClass="bg-emerald-500/10 text-emerald-400" />
                                <input type="text" value={releaseName} onChange={(e) => setReleaseName(e.target.value)} placeholder="e.g. 25R1" className="w-full bg-[#161e2e] border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-bold focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-700" />
                            </div>
                            <div className="space-y-4">
                                <FormLabel icon={Box} label="Version ID" colorClass="bg-amber-500/10 text-amber-400" />
                                <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v5.0.328" className="w-full bg-[#161e2e] border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-bold focus:border-amber-500/50 outline-none transition-all placeholder:text-slate-700" />
                            </div>
                        </div>

                        {/* Date & Tags Grid */}
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <FormLabel icon={Calendar} label="Release Date" colorClass="bg-rose-500/10 text-rose-400" />
                                <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="w-full bg-[#161e2e] border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-bold focus:border-rose-500/50 outline-none transition-all [color-scheme:dark]" />
                            </div>
                            <div className="space-y-4">
                                <FormLabel icon={Tag} label="Quick Context" colorClass="bg-indigo-500/10 text-indigo-400" />
                                <div className="flex flex-wrap gap-2 p-4 bg-[#161e2e] rounded-2xl border border-slate-800 min-h-[56px] focus-within:border-indigo-500/50 transition-all">
                                    {tags.map(tag => (
                                        <span key={tag} className="flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-tight shadow-sm" style={{ backgroundColor: getTagColor(tag) }}>
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="hover:scale-110"><X size={10} strokeWidth={4} /></button>
                                        </span>
                                    ))}
                                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)} placeholder="Add context..." className="bg-transparent text-xs text-white font-bold outline-none flex-1 min-w-[100px] placeholder:text-slate-700 ml-2" />
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {PRESET_TAGS.map(t => (
                                        <button key={t} type="button" onClick={() => handleAddTag(t)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${tags.includes(t) ? 'bg-slate-700 border-slate-600 text-slate-500 opacity-40' : 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Technical Notes: Optimized Input */}
                        <div className="space-y-4">
                            <FormLabel icon={Check} label="Internal Documentation" colorClass="bg-slate-500/10 text-slate-400" />
                            <textarea 
                                value={note} 
                                onChange={(e) => setNote(e.target.value)} 
                                placeholder="Capture technical significance..." 
                                rows={6} 
                                className="w-full bg-[#161e2e] border border-slate-800 rounded-3xl px-8 py-6 text-sm text-white font-medium focus:border-indigo-500/50 outline-none transition-all resize-none custom-scrollbar placeholder:text-slate-700 will-change-contents" 
                            />
                        </div>
                    </div>
                </div>

                {/* Right Side: Command Preview Sidebar */}
                <div className="w-[400px] bg-[#020617] p-12 flex flex-col justify-between shrink-0 border-l border-slate-800">
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex-1 flex flex-col items-center justify-center gap-10">
                            <div className="text-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block">Deployment Preview</span>
                                <div className="h-px w-16 bg-slate-800 mx-auto" />
                            </div>

                            <PreviewCard releaseName={releaseName} version={version} releaseDate={releaseDate} tags={tags} />

                            <div className="w-full mt-8 grid grid-cols-2 gap-4 px-4">
                                <div className="p-5 bg-[#161e2e] rounded-2xl border border-slate-800 text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Target Scope</p>
                                    <p className="text-xl font-black text-white tracking-tighter">{years.length}</p>
                                </div>
                                <div className="p-5 bg-[#161e2e] rounded-2xl border border-slate-800 text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Context Nodes</p>
                                    <p className="text-xl font-black text-white tracking-tighter">{tags.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 space-y-4">
                            <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 border border-indigo-400/20">
                                <Check size={20} strokeWidth={4} />
                                <span className="tracking-widest uppercase text-sm">Publish Node</span>
                            </button>
                            <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-black py-4 rounded-2xl transition-all border border-slate-700 text-[10px] tracking-widest uppercase">Abort</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddReleaseModal;
