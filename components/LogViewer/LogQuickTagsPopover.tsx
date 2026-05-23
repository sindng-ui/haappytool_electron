/**
 * LogQuickTagsPopover.tsx
 * TopBar에서 Log Tags & Start/Stop Logging을 팝오버로 빠르게 제어 🐧⚡
 * - 로깅 상태 (🔴 REC / ⬛ Stopped) 표시
 * - 태그 칩 목록 인라인 확인
 * - 팝오버 내에서 태그 추가/삭제 + Start/Stop 토글
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
    Tag, Play, Square, X, Plus, Terminal
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

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                ref={btnRef}
                onClick={() => setIsOpen(p => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-bold ${
                    isLogging
                        ? 'bg-red-950/40 border-red-500/40 text-red-300 hover:bg-red-900/50 hover:border-red-400/60'
                        : isOpen
                            ? 'bg-slate-700/80 border-indigo-500/40 text-indigo-300'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 hover:bg-slate-700/60'
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
                        <span className="text-red-300 font-black tracking-wide">REC</span>
                    </>
                ) : (
                    <Tag size={13} />
                )}
                {/* Tag count badge */}
                {tags.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isLogging ? 'bg-red-900/60 text-red-200' : 'bg-indigo-900/60 text-indigo-200'
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
                        w-[480px] bg-slate-900 border border-slate-700/60
                        rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.7)]
                        overflow-hidden
                    "
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-slate-800/80 flex items-center gap-2.5">
                        <Terminal size={15} className="text-indigo-400" />
                        <span className="text-sm font-bold text-slate-200 flex-1">Log Tags</span>
                        {/* Status */}
                        {isLogging ? (
                            <span className="flex items-center gap-1.5 text-xs font-black text-red-300">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                                LOGGING
                            </span>
                        ) : (
                            <span className="text-xs text-slate-600 font-bold">IDLE</span>
                        )}
                    </div>

                    {/* Tags area */}
                    <div className="px-5 py-4">
                        <div
                            className="
                                min-h-[96px] w-full rounded-2xl border border-slate-700/50 bg-slate-950/50
                                p-3 flex flex-wrap gap-2 items-start cursor-text
                                focus-within:border-indigo-500/50 transition-all
                            "
                            onClick={() => inputRef.current?.focus()}
                        >
                            {tags.map((tag, i) => (
                                <span
                                    key={`${tag}-${i}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-indigo-500/50 bg-indigo-900/50 text-indigo-100 text-xs font-mono font-semibold transition-all hover:bg-indigo-900/70"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onMouseDown={e => { e.preventDefault(); removeTag(i); }}
                                        className="opacity-50 hover:opacity-100 transition-opacity"
                                        tabIndex={-1}
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                            <input
                                ref={inputRef}
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={tags.length === 0 ? '+ add tag (Enter)' : ''}
                                className="flex-1 min-w-[120px] bg-transparent text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none py-1"
                                spellCheck={false}
                            />
                        </div>
                        {tagInput.trim() && (
                            <button
                                onClick={addTag}
                                className="mt-2.5 flex items-center gap-1 text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors"
                            >
                                <Plus size={12} /> Add "{tagInput.trim()}"
                            </button>
                        )}
                    </div>

                    {/* Start / Stop button */}
                    <div className="px-5 pb-5">
                        <button
                            onClick={handleToggleLogging}
                            disabled={!canLog && !hasEverConnected}
                            className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-bold transition-all border ${
                                isLogging
                                    ? 'bg-slate-700/50 hover:bg-red-500/80 text-slate-300 hover:text-white border-slate-600 hover:border-red-400'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={!canLog && !hasEverConnected ? 'Connect to a device first' : ''}
                        >
                            {isLogging ? <Square size={15} /> : <Play size={15} />}
                            {isLogging ? 'Stop Logging' : 'Start Logging'}
                        </button>
                        {!canLog && hasEverConnected && (
                            <p className="text-xs text-amber-400/70 text-center mt-2.5">
                                Device disconnected — click to reconnect
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

LogQuickTagsPopover.displayName = 'LogQuickTagsPopover';
export default LogQuickTagsPopover;
