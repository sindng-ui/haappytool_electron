/**
 * LogQuickTagsPopover.tsx
 * TopBar에서 Log Tags & Start/Stop Logging을 팝오버로 빠르게 제어 🐧⚡
 * - 로깅 상태 (🔴 REC / ⬛ Stopped) 표시
 * - 태그 칩 목록 인라인 확인
 * - 팝오버 내에서 태그 추가/삭제 + Start/Stop 토글
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
    Tag, Play, Square, X, Plus, Terminal, Eye, SlidersHorizontal
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
    const [tagInput, setTagInput] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const tags: string[] = currentConfig?.logTags || [];

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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 text-[11px] font-black shadow-md hover:scale-[1.04] active:scale-[0.96] ${isLogging
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
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border transition-all ${isLogging 
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
                    className="
                        absolute top-full mt-2 right-0 z-[200]
                        w-[820px] bg-[#0b0f1e] border border-indigo-500/20
                        rounded-2xl shadow-[0_20px_50px_rgba(99,102,241,0.18)]
                        overflow-hidden flex flex-col transition-all duration-300
                    "
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-[#141b36] flex items-center gap-2.5 bg-[#05070e]/40">
                        <Terminal size={15} className="text-cyan-400 animate-pulse" />
                        <span className="text-sm font-black bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent flex-1">
                            Log Control Center
                        </span>
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
                        {/* Left Column: Tags & Logging Control (w-[500px]) */}
                        <div className="w-[500px] p-5 flex flex-col justify-between space-y-4">
                            <div>
                                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-black block mb-2">
                                    Target Log Tags
                                </span>
                                <div
                                    className="
                                        min-h-[120px] w-full rounded-xl border border-indigo-500/10 bg-[#05070e]/60
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
                                        className="mt-2 flex items-center gap-1 text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors font-bold"
                                    >
                                        <Plus size={11} /> Add "{tagInput.trim()}"
                                    </button>
                                )}

                                {/* Live Command Preview */}
                                {(() => {
                                    const defaultCmd = 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &';
                                    const cmd = currentConfig?.logCommand ?? defaultCmd;
                                    const tagStr = tags.join(' ').trim();
                                    const finalCmd = cmd.replace(/\$\(TAGS\)/g, tagStr || '[No Tags]');
                                    return (
                                        <div className="mt-4 p-3.5 rounded-xl border border-indigo-500/10 bg-[#03050a] space-y-2 shadow-inner">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-[#4d5b94] uppercase tracking-widest font-black">
                                                    ⚡ Live Command Preview
                                                </span>
                                                <span className="text-[8px] text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                                                    COMMAND
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-mono text-indigo-300/80 break-all select-all leading-relaxed p-1 hover:text-indigo-200 transition-colors cursor-pointer">
                                                {finalCmd}
                                            </div>
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
                                    <p className="text-[10px] text-amber-400/70 text-center mt-1.5 font-bold animate-pulse">
                                        Disconnected — click to reconnect
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Right Column: View Settings (w-[320px]) */}
                        <div className="w-[320px] p-5 space-y-4 bg-[#070a14]/60">
                            <div className="flex items-center gap-2 pb-2 border-b border-[#141b36]">
                                <Eye size={14} className="text-cyan-400 animate-pulse" />
                                <span className="text-xs font-black text-slate-300 tracking-wide">Quick View Settings</span>
                            </div>

                            {/* Show Line Numbers Toggle (iOS Style) */}
                            <div className="flex items-center justify-between bg-[#141b36]/30 px-3 py-2.5 rounded-xl border border-indigo-500/10 hover:border-indigo-500/20 transition-all duration-300">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-200 font-extrabold">Line Numbers</span>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Index & Line Num</span>
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

                            {/* Opacity Control */}
                            <div className="space-y-2 p-3 rounded-xl border border-indigo-500/10 bg-[#141b36]/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-slate-300 font-extrabold">Log Level Colors</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-slate-500 uppercase">Opacity</span>
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
                                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black block">
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
