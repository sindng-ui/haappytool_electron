/**
 * LogQuickTagsPopover.tsx
 * TopBar에서 Log Tags & Start/Stop Logging을 팝오버로 빠르게 제어 🐧⚡
 * - 로깅 상태 (🔴 REC / ⬛ Stopped) 표시
 * - 태그 칩 목록 인라인 확인
 * - 팝오버 내에서 태그 추가/삭제 + Start/Stop 토글
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
    Tag, Play, Square, X, Plus, Terminal, Eye, SlidersHorizontal, Trash2, Save
} from 'lucide-react';
import { useLogContext } from './LogContext';

const LogQuickTagsPopover: React.FC = memo(() => {
    const {
        currentConfig,
        updateCurrentRule,
        isLogging,
        setIsLogging,
        connectionMode,
        hasEverConnected,
        setIsTizenQuickConnect,
        setIsTizenModalOpen,
        sendTizenCommand,
        logViewPreferences,
        updateLogViewPreferences,
    } = useLogContext() as any;

    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // Popover expandable width control 🐧⚡
    const [isEditingCommand, setIsEditingCommand] = useState(false); // Command edit mode toggle 🐧🛠️
    const [commandEditValue, setCommandEditValue] = useState(''); // Temp command template edited value

    // Smart Tag Presets States 🐧🏷️
    const [customPresets, setCustomPresets] = useState<{ name: string, tags: string[] }[]>(() => {
        try {
            const saved = localStorage.getItem('happytool_tag_presets');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [newPresetName, setNewPresetName] = useState('');
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [selectedPresetName, setSelectedPresetName] = useState(''); // Selected preset state for dropdown 🐧✨

    const [tagInput, setTagInput] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const tags: string[] = currentConfig?.logTags || [];

    // Save custom presets to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('happytool_tag_presets', JSON.stringify(customPresets));
        } catch (e) {
            console.error('Failed to save tag presets', e);
        }
    }, [customPresets]);

    // Apply selected tag preset 🐧⚡
    const handleApplyPreset = useCallback((presetTags: string[]) => {
        if (updateCurrentRule) {
            updateCurrentRule({ logTags: presetTags });
        }
    }, [updateCurrentRule]);

    // Track current tags to auto-match dropdown preset 🐧✨
    useEffect(() => {
        const matched = customPresets.find(p =>
            p.tags.length === tags.length &&
            p.tags.every(t => tags.includes(t)) &&
            tags.every(t => p.tags.includes(t))
        );
        if (matched) {
            setSelectedPresetName(matched.name);
        } else {
            setSelectedPresetName('');
        }
    }, [tags, customPresets]);

    // Handle dropdown select preset 🐧✨
    const handleSelectPreset = useCallback((presetName: string) => {
        setSelectedPresetName(presetName);
        if (!presetName) return;

        const custom = customPresets.find(p => p.name === presetName);
        if (custom) {
            handleApplyPreset(custom.tags);
        }
    }, [customPresets, handleApplyPreset]);

    // Save current tags as a custom preset
    const handleSavePreset = useCallback(() => {
        const name = newPresetName.trim();
        if (!name) return;
        const currentTags = currentConfig?.logTags || [];
        if (currentTags.length === 0) return;

        // Prevent duplicate names
        if (customPresets.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            return;
        }

        setCustomPresets(prev => [...prev, { name, tags: currentTags }]);
        setNewPresetName('');
        setIsSavingPreset(false);
    }, [newPresetName, currentConfig, customPresets]);

    // Delete custom preset
    const handleDeletePreset = useCallback((nameToDelete: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCustomPresets(prev => prev.filter(p => p.name !== nameToDelete));
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Auto focus input when popover opens
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 60);
    }, [isOpen]);

    const addTag = useCallback(() => {
        const val = tagInput.trim();
        if (!val || !updateCurrentRule) return;
        const current = currentConfig?.logTags || [];
        if (!current.includes(val)) {
            updateCurrentRule({ logTags: [...current, val] });
        }
        setTagInput('');
    }, [tagInput, currentConfig, updateCurrentRule]);

    const removeTag = useCallback((idx: number) => {
        if (!updateCurrentRule) return;
        const current = currentConfig?.logTags || [];
        updateCurrentRule({ logTags: current.filter((_: string, i: number) => i !== idx) });
    }, [currentConfig, updateCurrentRule]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); addTag(); }
        else if (e.key === 'Escape') setIsOpen(false);
        else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    }, [addTag, tagInput, tags, removeTag]);

    const handleToggleLogging = useCallback(() => {
        if (!setIsLogging || !currentConfig) return;
        if (isLogging) {
            // Stop
            setIsLogging(false);
            if (sendTizenCommand) sendTizenCommand('\x03'); // SIGINT
        } else {
            // Start - check connection
            if (!connectionMode && hasEverConnected) {
                setIsTizenQuickConnect?.(true);
                setIsTizenModalOpen?.(true);
                return;
            }
            if (!connectionMode) return;
            // Build and send log command
            const defaultCmd = 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &';
            const cmd = currentConfig.logCommand ?? defaultCmd;
            const tagStr = tags.join(' ').trim();
            const finalCmd = cmd.replace(/\$\(TAGS\)/g, tagStr);
            if (sendTizenCommand) sendTizenCommand(finalCmd + '\n');
            setIsLogging(true);
        }
    }, [isLogging, setIsLogging, currentConfig, connectionMode, hasEverConnected,
        setIsTizenQuickConnect, setIsTizenModalOpen, sendTizenCommand, tags]);

    const canLog = !!connectionMode;

    const preferences = logViewPreferences || {
        showLineNumbers: true,
        logLevelOpacity: 20,
        levelStyles: []
    };

    const levels = ['V', 'D', 'I', 'W', 'E'];

    const handleLevelToggle = useCallback((level: string) => {
        if (!logViewPreferences || !updateLogViewPreferences) return;
        const newStyles = (logViewPreferences.levelStyles || []).map((s: any) =>
            s.level === level ? { ...s, enabled: !s.enabled } : s
        );
        updateLogViewPreferences({ levelStyles: newStyles });
    }, [logViewPreferences, updateLogViewPreferences]);

    const handleColorChange = useCallback((level: string, color: string) => {
        if (!logViewPreferences || !updateLogViewPreferences) return;
        const newStyles = (logViewPreferences.levelStyles || []).map((s: any) =>
            s.level === level ? { ...s, color } : s
        );
        updateLogViewPreferences({ levelStyles: newStyles });
    }, [logViewPreferences, updateLogViewPreferences]);

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                ref={btnRef}
                onClick={() => setIsOpen(p => !p)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 text-xs font-black shadow-md hover:scale-[1.04] active:scale-[0.96] ${isLogging
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-rose-500/80 text-white hover:from-red-500 hover:to-rose-500 hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                    : isOpen
                        ? 'bg-[#161f42] border-indigo-400 text-indigo-200 shadow-[0_0_18px_rgba(99,102,241,0.4)]'
                        : 'bg-gradient-to-r from-slate-900 via-[#131a35] to-slate-900 border-indigo-500/20 text-slate-300 hover:text-indigo-300 hover:border-indigo-400/80 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                    }`}
                title="Log Tags & Logging Control"
            >
                {isLogging ? (
                    <>
                        {/* 🔴 REC dot */}
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="text-white font-black tracking-wide">REC</span>
                    </>
                ) : (
                    <SlidersHorizontal size={13} className="text-indigo-400" />
                )}

                <span className="tracking-tight uppercase">Log Center</span>

                {/* Tag count badge */}
                {tags.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-xs font-black border transition-all ${isLogging
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                        }`}>
                        {tags.length}
                    </span>
                )}
            </button>

            {/* Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    style={{ width: isExpanded ? '880px' : '560px' }}
                    className="
                        absolute top-full mt-2 right-0 z-[200]
                        bg-[#0b0f1e] border border-indigo-500/20
                        rounded-2xl shadow-[0_20px_50px_rgba(99,102,241,0.18)]
                        overflow-hidden flex flex-col transition-[width,transform] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                    "
                >
                    {/* Header */}
                    <div className="px-5 py-3 border-b border-[#141b36] flex items-center gap-2.5 bg-[#05070e]/40">
                        <Terminal size={15} className="text-cyan-400 animate-pulse" />
                        <span className="text-sm font-black bg-gradient-to-r from-[#00f2fe] via-cyan-400 to-[#0072ff] bg-clip-text text-transparent flex-1 filter drop-shadow-[0_0_8px_rgba(0,242,254,0.3)]">
                            Log Control Center
                        </span>

                        {/* Expand Settings Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setIsExpanded(p => !p)}
                            className={`
                                flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-black tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]
                                ${isExpanded
                                    ? 'bg-[#1a2342] border-indigo-400 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                                    : 'bg-[#0f1424] border-indigo-500/20 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50'
                                }
                            `}
                        >
                            <Eye size={13} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-cyan-400' : ''}`} />
                            <span>{isExpanded ? 'Hide Settings ⬅️' : 'Quick Settings ⚙️'}</span>
                        </button>

                        <span className="w-px h-3 bg-[#141b36]/60 mx-1" />

                        {/* Status */}
                        {isLogging ? (
                            <span className="flex items-center gap-1.5 text-xs font-black text-rose-400">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                                LOGGING
                            </span>
                        ) : (
                            <span className="text-xs text-slate-500 font-extrabold tracking-wider">IDLE</span>
                        )}
                    </div>

                    {/* 2-Column Split View */}
                    <div className="flex divide-x divide-[#141b36]/60">
                        {/* Left Column: Tags & Logging Control (w-[560px]) */}
                        <div className="w-[560px] p-5 flex flex-col space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-cyan-400 uppercase tracking-widest font-black">
                                        Target Log Tags
                                    </span>

                                    {/* Presets 드롭다운 🐧🏷️ */}
                                    <div className="flex items-center gap-1.5 py-0.5 pr-0.5">
                                        <select
                                            value={selectedPresetName}
                                            onChange={(e) => handleSelectPreset(e.target.value)}
                                            className="bg-[#101530] text-slate-300 text-[12px] font-black rounded-lg border border-indigo-500/20 focus:ring-1 focus:ring-indigo-500 focus:outline-none p-1.5 cursor-pointer max-w-[170px]"
                                        >
                                            <option value="">Select Preset...</option>
                                            {customPresets.map((p) => (
                                                <option key={p.name} value={p.name}>{p.name}</option>
                                            ))}
                                        </select>

                                        {/* 프리셋 선택 시 삭제 쓰레기통 버튼 노출 */}
                                        {!!selectedPresetName && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    handleDeletePreset(selectedPresetName, e);
                                                    setSelectedPresetName('');
                                                }}
                                                className="p-1.5 rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:text-red-300 hover:border-red-400/50 transition-all duration-200 active:scale-90 shrink-0"
                                                title="Delete Custom Preset"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}

                                        {/* Save Preset Mini Button */}
                                        {tags.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsSavingPreset(p => !p)}
                                                className={`
                                                    p-1.5 rounded-lg border transition-all duration-200 hover:scale-[1.1] active:scale-[0.9] shrink-0
                                                    ${isSavingPreset
                                                        ? 'bg-indigo-950 border-indigo-400 text-indigo-300'
                                                        : 'bg-[#101530] border-indigo-500/20 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50'
                                                    }
                                                `}
                                                title="Save Current Tags as Preset"
                                            >
                                                <Save size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Custom Preset Save Mini Dialog */}
                                {isSavingPreset && (
                                    <div className="flex items-center gap-1.5 p-2 mb-2 rounded-xl border border-indigo-500/20 bg-[#0d1224] animate-fadeIn">
                                        <input
                                            type="text"
                                            value={newPresetName}
                                            onChange={e => setNewPresetName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { e.preventDefault(); handleSavePreset(); }
                                                else if (e.key === 'Escape') setIsSavingPreset(false);
                                            }}
                                            placeholder="Enter Preset Name..."
                                            className="flex-1 bg-[#05070e] text-xs text-slate-200 rounded-md border border-indigo-500/20 focus:ring-1 focus:ring-indigo-500 focus:outline-none px-2 py-1 font-bold font-sans"
                                            maxLength={15}
                                            spellCheck={false}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSavePreset}
                                            disabled={!newPresetName.trim()}
                                            className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                                        >
                                            SAVE
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsSavingPreset(false)}
                                            className="px-2 py-1 bg-[#141b36] hover:bg-[#1f2952] text-slate-400 hover:text-slate-200 text-xs font-black rounded-md transition-all shrink-0"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                )}
                                <div
                                    className="
                                        min-h-[96px] w-full rounded-xl border border-indigo-500/10 bg-[#05070e]/60
                                        p-2.5 flex flex-wrap gap-1.5 items-start cursor-text
                                        focus-within:border-indigo-500/40 focus-within:shadow-[0_0_12px_rgba(99,102,241,0.15)] 
                                        transition-all duration-300 overflow-y-auto max-h-[130px]
                                    "
                                    onClick={() => inputRef.current?.focus()}
                                >
                                    {tags.map((tag, i) => (
                                        <span
                                            key={`${tag}-${i}`}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-[#181335]/60 text-indigo-200 text-xs font-mono font-bold transition-all hover:from-indigo-900/70 hover:to-[#221a4d]/70 hover:border-indigo-400/50 shadow-sm hover:scale-[1.02]"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                                                onClick={e => { e.preventDefault(); e.stopPropagation(); removeTag(i); }}
                                                className="opacity-55 hover:opacity-100 transition-opacity text-indigo-400 hover:text-indigo-200"
                                                tabIndex={-1}
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        ref={inputRef}
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={tags.length === 0 ? '+ add tags (Enter)' : ''}
                                        className="flex-1 min-w-[100px] bg-transparent text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none py-0.5"
                                        spellCheck={false}
                                    />
                                </div>
                                {tagInput.trim() && (
                                    <button
                                        onClick={addTag}
                                        className="mt-2 flex items-center gap-1 text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors font-bold"
                                    >
                                        <Plus size={13} /> Add "{tagInput.trim()}"
                                    </button>
                                )}

                                {/* Live Command Preview */}
                                {(() => {
                                    const defaultCmd = 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &';
                                    const cmd = currentConfig?.logCommand ?? defaultCmd;
                                    const tagStr = tags.join(' ').trim();
                                    const finalCmd = cmd.replace(/\$\(TAGS\)/g, tagStr || '[No Tags]');

                                    const handleStartEdit = () => {
                                        setCommandEditValue(cmd);
                                        setIsEditingCommand(true);
                                    };

                                    const handleSaveEdit = () => {
                                        if (updateCurrentRule) {
                                            updateCurrentRule({ logCommand: commandEditValue });
                                        }
                                        setIsEditingCommand(false);
                                    };

                                    return (
                                        <div className="mt-4 p-3.5 rounded-xl border border-indigo-500/10 bg-[#03050a] space-y-2 shadow-inner">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-[#4d5b94] uppercase tracking-widest font-black">
                                                    ⚡ Live Command Preview
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {isEditingCommand ? (
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveEdit}
                                                            className="text-[12px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black hover:bg-emerald-500/35 hover:text-white transition-all shadow-[0_0_8px_rgba(16,185,129,0.2)] hover:scale-[1.03] active:scale-[0.97]"
                                                        >
                                                            SAVE 💾
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={handleStartEdit}
                                                            className="text-[12px] bg-[#141b36] text-slate-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-black hover:border-indigo-400 hover:text-indigo-200 transition-all hover:scale-[1.03] active:scale-[0.97]"
                                                        >
                                                            EDIT ✏️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {isEditingCommand ? (
                                                <div className="space-y-1.5">
                                                    <textarea
                                                        value={commandEditValue}
                                                        onChange={e => setCommandEditValue(e.target.value)}
                                                        className="w-full min-h-[60px] max-h-[100px] p-2 bg-[#090d1a] border border-indigo-500/30 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all placeholder-slate-700 resize-y"
                                                        spellCheck={false}
                                                    />
                                                    <p className="text-xs text-cyan-400/70 font-bold leading-normal">
                                                        * <span className="text-[#00f2fe]">$(TAGS)</span> placeholder will be replaced with selected tags.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="text-xs font-mono text-indigo-300/80 break-all select-all leading-relaxed p-1 hover:text-indigo-200 transition-colors cursor-pointer">
                                                    {finalCmd}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Start / Stop button */}
                            <div className="pt-3 border-t border-[#141b36]/60">
                                <button
                                    onClick={handleToggleLogging}
                                    disabled={!canLog && !hasEverConnected}
                                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-extrabold transition-all duration-300 border shadow-md active:scale-[0.98] ${isLogging
                                        ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white border-rose-500/50 shadow-[0_4px_12px_rgba(220,38,38,0.2)]'
                                        : 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 border-emerald-400/40 shadow-[0_4px_16px_rgba(16,185,129,0.25)]'
                                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                                    title={!canLog && !hasEverConnected ? 'Connect to a device first' : ''}
                                >
                                    {isLogging ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                    {isLogging ? 'Stop Logging' : 'Start Logging'}
                                </button>
                                {!canLog && hasEverConnected && (
                                    <p className="text-xs text-amber-400/70 text-center mt-1.5 font-bold animate-pulse">
                                        Disconnected — click to reconnect
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Right Column: View Settings (w-[320px]) */}
                        <div
                            className={`
                                bg-[#070a14]/60 flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] space-y-4
                                ${isExpanded
                                    ? 'opacity-100 translate-x-0 visible'
                                    : 'opacity-0 translate-x-4 invisible pointer-events-none'
                                }
                            `}
                            style={{
                                width: isExpanded ? '320px' : '0px',
                                padding: isExpanded ? '20px' : '0px',
                                maxHeight: isExpanded ? 'none' : '0px',
                                overflow: 'hidden'
                            }}
                        >
                            <div className="flex items-center gap-2 pb-2 border-b border-[#141b36] min-w-[280px]">
                                <Eye size={14} className="text-cyan-400 animate-pulse" />
                                <span className="text-xs font-black text-slate-300 tracking-wide">Quick View Settings</span>
                            </div>

                            {/* Font Family & Size Control */}
                            <div className="space-y-2 p-3 rounded-xl border border-indigo-500/10 bg-[#141b36]/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-300 font-extrabold">Font Settings</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Family & Size</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={preferences.fontFamily || 'Consolas, monospace'}
                                        onChange={(e) => updateLogViewPreferences?.({ fontFamily: e.target.value })}
                                        className="flex-1 bg-[#101530] text-slate-200 text-xs rounded-lg border border-indigo-500/20 focus:ring-1 focus:ring-indigo-500 focus:outline-none p-1.5 cursor-pointer"
                                    >
                                        <option value="Consolas, monospace">Consolas</option>
                                        <option value="'Courier New', monospace">Courier</option>
                                        <option value="'Lucida Console', monospace">Lucida</option>
                                        <option value="'Roboto Mono', monospace">Roboto</option>
                                        <option value="monospace">Mono</option>
                                    </select>
                                    <input
                                        type="number"
                                        min="8"
                                        max="24"
                                        value={preferences.fontSize || 12}
                                        onChange={(e) => {
                                            const newSize = parseInt(e.target.value, 10);
                                            const newRowHeight = Math.ceil(newSize * 1.5);
                                            updateLogViewPreferences?.({
                                                fontSize: newSize,
                                                rowHeight: newRowHeight
                                            });
                                        }}
                                        className="w-14 bg-[#101530] text-slate-200 text-xs rounded-lg border border-indigo-500/20 focus:ring-1 focus:ring-indigo-500 focus:outline-none p-1.5 text-center font-mono"
                                        title="Font Size (px)"
                                    />
                                </div>
                            </div>

                            {/* Line Spacing Control */}
                            <div className="space-y-2 p-3 rounded-xl border border-indigo-500/10 bg-[#141b36]/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-300 font-extrabold">Line Spacing</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-500 uppercase">Height</span>
                                        <span className="text-xs text-cyan-400 font-mono font-bold">{preferences.rowHeight}px</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="12"
                                    max="60"
                                    value={preferences.rowHeight}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val >= 10 && val <= 100) {
                                            updateLogViewPreferences?.({ rowHeight: val });
                                        }
                                    }}
                                    className="w-full h-1 bg-indigo-950 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                                />
                            </div>

                            {/* Show Line Numbers Toggle (iOS Style) */}
                            <div className="flex items-center justify-between bg-[#141b36]/30 px-3 py-2.5 rounded-xl border border-indigo-500/10 hover:border-indigo-500/20 transition-all duration-300">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-200 font-extrabold">Line Numbers</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Index & Line Num</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        id="popover-toggle-line-numbers"
                                        type="checkbox"
                                        checked={preferences.showLineNumbers !== false}
                                        onChange={(e) => updateLogViewPreferences?.({ showLineNumbers: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-[#1f294d] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                                </label>
                            </div>

                            {/* Bypass Filters Toggle (iOS Style) 🐧⚡ */}
                            <div className="flex items-center justify-between bg-[#141b36]/30 px-3 py-2.5 rounded-xl border border-indigo-500/10 hover:border-indigo-500/20 transition-all duration-300">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-200 font-extrabold">Bypass Filters</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Show Shell/Raw Text Always</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        id="popover-toggle-bypass-filters"
                                        type="checkbox"
                                        checked={currentConfig?.showRawLogLines !== false}
                                        onChange={(e) => updateCurrentRule?.({ showRawLogLines: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-[#1f294d] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-emerald-500 peer-checked:to-teal-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                                </label>
                            </div>

                            {/* Opacity Control */}
                            <div className="space-y-2 p-3 rounded-xl border border-indigo-500/10 bg-[#141b36]/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-300 font-extrabold">Log Level Colors</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-500 uppercase">Opacity</span>
                                        <span className="text-xs text-cyan-400 font-mono font-bold">{(preferences.logLevelOpacity ?? 20)}%</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    value={preferences.logLevelOpacity ?? 20}
                                    onChange={(e) => updateLogViewPreferences?.({ logLevelOpacity: parseInt(e.target.value, 10) })}
                                    className="w-full h-1 bg-indigo-950 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                                />
                            </div>

                            {/* Log Level Toggles */}
                            <div className="space-y-2">
                                <span className="text-xs text-slate-500 uppercase tracking-widest font-black block">
                                    Level Filters & Colors
                                </span>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {levels.map(level => {
                                        const style = (preferences.levelStyles || []).find((s: any) => s.level === level) || { level, color: '#000000', enabled: false };
                                        return (
                                            <div
                                                key={level}
                                                className="flex items-center justify-between bg-[#141b36]/20 px-3 py-2 rounded-xl border border-indigo-500/10 hover:bg-[#141b36]/40 hover:border-indigo-500/20 transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={style.enabled}
                                                            onChange={() => handleLevelToggle(level)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-7 h-4 bg-[#1f294d] rounded-full peer peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                    </label>
                                                    <span className={`text-xs font-black font-mono transition-colors ${style.enabled ? 'text-indigo-300' : 'text-slate-500'}`}>
                                                        {level}
                                                    </span>
                                                </div>
                                                <input
                                                    type="color"
                                                    value={style.color}
                                                    disabled={!style.enabled}
                                                    onChange={(e) => handleColorChange(level, e.target.value)}
                                                    className={`w-5 h-5 rounded cursor-pointer border border-[#1e295d]/30 bg-transparent p-0 transition-all hover:scale-110 active:scale-95 ${style.enabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}
                                                    title={style.enabled ? 'Change Color' : 'Enable first'}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

LogQuickTagsPopover.displayName = 'LogQuickTagsPopover';
export default LogQuickTagsPopover;
