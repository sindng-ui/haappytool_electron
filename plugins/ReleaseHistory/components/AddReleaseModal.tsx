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

// View 모달과 동일한 라벨 스타일
const FormLabel = React.memo(({ icon: Icon, label, colorClass, bgClass }: { icon: any, label: string, colorClass: string, bgClass: string }) => (
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
        <div className={`p-1.5 ${bgClass} rounded-lg border border-slate-700/50`}>
            <Icon size={13} className={colorClass} />
        </div>
        {label}
    </label>
));

// View 모달의 프리뷰 카드 - View 모달 카드 스타일 참고
const PreviewCard = React.memo(({ releaseName, version, releaseDate, tags }: any) => (
    <div className="w-full bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 truncate max-w-[140px] tracking-tight uppercase">{releaseName || 'UNNAMED'}</span>
            <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                {releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '--/--'}
            </span>
        </div>
        <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600" />
            <span className="text-3xl font-black text-white tracking-tighter leading-none">
                {version ? (version.startsWith('v') ? version : `v${version}`) : 'v0.0.0'}
            </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
            {(tags.length > 0 ? tags : ['TAG']).map((t: string) => (
                <span key={t} className="px-2.5 py-1 rounded-md text-[9px] font-black text-white uppercase tracking-wider" style={{ backgroundColor: getTagColor(t) }}>
                    {t}
                </span>
            ))}
        </div>
    </div>
));

// View 모달과 동일한 input 스타일 - #161e2e 배경
const inputStyle: React.CSSProperties = {
    backgroundColor: '#161e2e',
    colorScheme: 'dark',
};

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

    const currentYear = new Date().getFullYear();
    const presetYears = Array.from(new Set([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, ...existingYears]))
        .sort((a, b) => b - a).slice(0, 8);

    // View 모달과 동일한 공통 input 클래스
    const inputCls = "w-full text-sm text-white font-bold outline-none transition-all placeholder:text-slate-700 focus:border-indigo-500/50 border border-slate-800 rounded-2xl px-5 py-3.5";

    return (
        <div style={{ position: 'fixed', inset: 0, top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            {/* View 모달과 동일한 컨테이너 스타일: bg-[#0f172a], border-2 border-slate-800, rounded-[32px] */}
            <div className="bg-[#0f172a] border-2 border-slate-800 rounded-[32px] shadow-2xl w-full max-w-5xl flex overflow-hidden relative" style={{ maxHeight: 'calc(100vh - 40px)', flexShrink: 0 }}>

                {/* ── 왼쪽: 폼 영역 ── */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* 폼 헤더 - View 모달의 헤더와 동일한 스타일 */}
                    <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-slate-800 bg-[#161e2e]">
                        <div className="flex items-center gap-5">
                            <div className="p-3.5 bg-indigo-600 rounded-2xl shadow-lg">
                                <Plus className="text-white" size={22} strokeWidth={3} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight uppercase leading-none">
                                    {initialData ? 'Update Release' : 'New Release Node'}
                                </h2>
                                <p className="text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase mt-1">Project Timeline Architect</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 active:scale-95">
                            <X size={18} strokeWidth={3} />
                        </button>
                    </div>

                    {/* 폼 바디 (스크롤 영역) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0f172a]">
                        <div className="px-8 py-6 space-y-6">

                            {/* Target Years */}
                            <div>
                                <FormLabel icon={Calendar} label="Operational Years" colorClass="text-indigo-400" bgClass="bg-indigo-500/10" />
                                <div
                                    className="flex flex-wrap gap-2 p-4 border border-slate-800 rounded-2xl focus-within:border-indigo-500/50 transition-all"
                                    style={{ backgroundColor: '#161e2e' }}
                                >
                                    {years.map(year => (
                                        <span key={year} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-500/10 text-indigo-300 text-[11px] font-black rounded-lg border border-indigo-500/20">
                                            {year}
                                            <button onClick={() => removeYear(year)} className="hover:text-rose-400 transition-colors"><X size={11} strokeWidth={3} /></button>
                                        </span>
                                    ))}
                                    <input
                                        type="number"
                                        value={yearInput}
                                        onChange={(e) => setYearInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddYear(yearInput)}
                                        placeholder="연도 입력..."
                                        className="bg-transparent text-sm text-white font-bold outline-none w-24 placeholder:text-slate-700"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {presetYears.map(y => (
                                        <button key={y} type="button" onClick={() => handleAddYear(y.toString())}
                                            className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all border ${years.includes(y)
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                                : 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'}`}>
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Name & Version */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <FormLabel icon={Tag} label="Deployment Name" colorClass="text-emerald-400" bgClass="bg-emerald-500/10" />
                                    <input type="text" value={releaseName} onChange={(e) => setReleaseName(e.target.value)}
                                        placeholder="e.g. 25R1" className={inputCls} style={inputStyle} />
                                </div>
                                <div>
                                    <FormLabel icon={Box} label="Version ID" colorClass="text-amber-400" bgClass="bg-amber-500/10" />
                                    <input type="text" value={version} onChange={(e) => setVersion(e.target.value)}
                                        placeholder="v5.0.328" className={inputCls} style={inputStyle} />
                                </div>
                            </div>

                            {/* Date & Tags */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <FormLabel icon={Calendar} label="Release Date" colorClass="text-rose-400" bgClass="bg-rose-500/10" />
                                    <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)}
                                        className={inputCls} style={inputStyle} />
                                </div>
                                <div>
                                    <FormLabel icon={Tag} label="Quick Context (Tags)" colorClass="text-indigo-400" bgClass="bg-indigo-500/10" />
                                    <div
                                        className="flex flex-wrap gap-1.5 p-3 border border-slate-800 rounded-2xl min-h-[50px] focus-within:border-indigo-500/50 transition-all"
                                        style={{ backgroundColor: '#161e2e' }}
                                    >
                                        {tags.map(tag => (
                                            <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-tight shadow-sm" style={{ backgroundColor: getTagColor(tag) }}>
                                                {tag}
                                                <button onClick={() => removeTag(tag)} className="hover:opacity-70"><X size={9} strokeWidth={4} /></button>
                                            </span>
                                        ))}
                                        <input type="text" value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
                                            placeholder="태그 추가..."
                                            className="bg-transparent text-xs text-white font-bold outline-none flex-1 min-w-[80px] placeholder:text-slate-700 ml-1"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {PRESET_TAGS.map(t => (
                                            <button key={t} type="button" onClick={() => handleAddTag(t)}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${tags.includes(t)
                                                    ? 'opacity-30 cursor-not-allowed bg-slate-700 border-slate-600 text-slate-400'
                                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'}`}
                                                disabled={tags.includes(t)}
                                            >{t}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Internal Documentation */}
                            <div>
                                <FormLabel icon={Check} label="Internal Documentation" colorClass="text-slate-400" bgClass="bg-slate-500/10" />
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="기술적 내용, 변경 사항 등을 입력하세요..."
                                    rows={6}
                                    className="w-full text-sm text-white font-medium outline-none transition-all resize-none custom-scrollbar placeholder:text-slate-700 focus:border-indigo-500/50 border border-slate-800 rounded-2xl px-5 py-4"
                                    style={{ backgroundColor: '#161e2e', colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 오른쪽: 프리뷰 사이드바 - View 모달의 bg-[#161e2e] 섹션과 유사한 스타일 ── */}
                <div className="w-[300px] shrink-0 flex flex-col border-l border-slate-800 bg-[#0c1220]">

                    {/* 사이드바 헤더 */}
                    <div className="shrink-0 px-6 py-5 border-b border-slate-800 bg-[#161e2e]">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Deployment Preview</p>
                    </div>

                    {/* 프리뷰 카드 + 통계 */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-5">
                        <PreviewCard releaseName={releaseName} version={version} releaseDate={releaseDate} tags={tags} />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[#161e2e] rounded-2xl border border-slate-800 text-center hover:border-slate-700 transition-all">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Target Scope</p>
                                <p className="text-2xl font-black text-white tracking-tighter">{years.length}</p>
                            </div>
                            <div className="p-4 bg-[#161e2e] rounded-2xl border border-slate-800 text-center hover:border-slate-700 transition-all">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Context Nodes</p>
                                <p className="text-2xl font-black text-white tracking-tighter">{tags.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* 액션 버튼 - View 모달 푸터와 동일한 스타일 */}
                    <div className="shrink-0 px-6 py-5 border-t border-slate-800 bg-[#161e2e] space-y-3">
                        <button onClick={handleSave}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-indigo-400/20">
                            <Check size={16} strokeWidth={3} />
                            <span className="tracking-widest uppercase text-xs">{initialData ? 'Update' : 'Publish Node'}</span>
                        </button>
                        <button onClick={onClose}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-black py-3 rounded-xl transition-all border border-slate-700 text-[10px] tracking-widest uppercase">
                            Abort
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddReleaseModal;
