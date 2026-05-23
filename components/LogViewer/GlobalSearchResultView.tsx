/**
 * GlobalSearchResultView.tsx
 * Notepad++ "Find in Open Files" 스타일 결과 뷰어 🐧⚡
 * - 파일별 접기/펴기, Copy to Clipboard
 * - Collapse All / Expand All
 * - 한글 → 영어 전환
 * - 성능: blur 미사용, useMemo 최적화
 */

import React, { useState, useMemo, useCallback } from 'react';
import { LogRule } from '../../types';
import { Copy, ChevronsDownUp, ChevronsUpDown, Check } from 'lucide-react';

interface SearchMatch {
    lineNum: number;
    content: string;
}

export interface TabSearchResult {
    tabId: string;
    tabName: string;
    fileName: string;
    filePath: string;
    pane: 'left' | 'right';
    matches: SearchMatch[];
}

interface GlobalSearchResultViewProps {
    results: TabSearchResult[];
    rule: LogRule | null;
    onJumpToTabLine: (tabId: string, pane: 'left' | 'right', lineNum: number) => void;
    isSearching: boolean;
    onClear?: () => void;
}

/**
 * Notepad++"Find in Open Files" result viewer 🐧⚡
 * No blur, HSL color palette, 60fps accordion motion.
 */
export const GlobalSearchResultView: React.FC<GlobalSearchResultViewProps> = ({
    results,
    rule,
    onJumpToTabLine,
    isSearching,
    onClear
}) => {
    const [collapsedTabs, setCollapsedTabs] = useState<Record<string, boolean>>({});
    /** 복사 피드백: uniqueKey → 타임스탬프 */
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const totalFiles = results.length;
    const filesWithMatches = useMemo(() => results.filter(r => r.matches.length > 0).length, [results]);
    const totalMatches = useMemo(() => results.reduce((sum, r) => sum + r.matches.length, 0), [results]);

    /** 유효 결과만 (매치 > 0) */
    const validResults = useMemo(() => results.filter(r => r.matches.length > 0), [results]);

    const allCollapsed = useMemo(() =>
        validResults.length > 0 && validResults.every(r => collapsedTabs[`${r.tabId}-${r.pane}`]),
        [validResults, collapsedTabs]
    );

    const toggleTabCollapse = useCallback((key: string) => {
        setCollapsedTabs(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const collapseAll = useCallback(() => {
        const next: Record<string, boolean> = {};
        validResults.forEach(r => { next[`${r.tabId}-${r.pane}`] = true; });
        setCollapsedTabs(next);
    }, [validResults]);

    const expandAll = useCallback(() => {
        setCollapsedTabs({});
    }, []);

    // Keywords for highlight
    const keywords = useMemo(() => {
        if (!rule) return [];
        return rule.includeGroups.flat().map(k => k.trim()).filter(k => k !== '');
    }, [rule]);

    const caseSensitive = rule?.happyCombosCaseSensitive ?? false;

    /** Copy file matches to clipboard */
    const handleCopyFile = useCallback((tabRes: TabSearchResult, uniqueKey: string) => {
        const lines = tabRes.matches.map(m => `L${m.lineNum + 1}: ${m.content}`).join('\n');
        const header = `[${tabRes.filePath || tabRes.fileName}] (${tabRes.pane === 'left' ? 'Left' : 'Right'}) — ${tabRes.matches.length} match(es)\n`;
        navigator.clipboard.writeText(header + lines).then(() => {
            setCopiedKey(uniqueKey);
            setTimeout(() => setCopiedKey(null), 1500);
        }).catch(() => {});
    }, []);

    /**
     * Highlight matching keywords in content string.
     */
    const renderHighlightedContent = useCallback((content: string) => {
        if (keywords.length === 0) return <span>{content}</span>;
        const escapedKeywords = keywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const regexStr = `(${escapedKeywords.join('|')})`;
        const regex = new RegExp(regexStr, caseSensitive ? 'g' : 'gi');
        const parts = content.split(regex);
        return (
            <>
                {parts.map((part, index) => {
                    const isMatch = keywords.some(k => {
                        const w1 = caseSensitive ? k : k.toLowerCase();
                        const w2 = caseSensitive ? part : part.toLowerCase();
                        return w1 === w2;
                    });
                    if (isMatch) {
                        return (
                            <mark
                                key={index}
                                className="bg-yellow-500/30 text-yellow-200 border border-yellow-500/50 rounded px-0.5 font-semibold"
                                style={{ textShadow: '0 0 4px rgba(234, 179, 8, 0.4)' }}
                            >
                                {part}
                            </mark>
                        );
                    }
                    return <span key={index}>{part}</span>;
                })}
            </>
        );
    }, [keywords, caseSensitive]);

    if (isSearching) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <div className="flex items-center space-x-3 mb-2">
                    <svg className="animate-spin h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-emerald-400 font-medium">Scanning all open files...</span>
                </div>
                <p className="text-xs text-slate-500 font-mono">Running parallel worker pipeline</p>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                <p className="text-sm font-medium">No results found.</p>
                <p className="text-xs mt-1">Make sure log files are loaded in open tabs.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950/40 border border-slate-800/80 rounded-xl overflow-hidden font-mono text-sm shadow-2xl">
            {/* Header summary — Notepad++ style */}
            <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-slate-300">
                <div className="flex items-center space-x-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-slate-200">Find Results</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800/60">
                        <strong className="text-emerald-400">{totalFiles}</strong> scanned &nbsp;·&nbsp;
                        <strong className="text-emerald-400">{filesWithMatches}</strong> with matches &nbsp;·&nbsp;
                        <strong className="text-yellow-400">{totalMatches}</strong> hits
                    </div>

                    {/* Collapse All / Expand All */}
                    <button
                        onClick={allCollapsed ? expandAll : collapseAll}
                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-indigo-300 border border-transparent hover:border-slate-700/80 transition-all duration-200"
                        title={allCollapsed ? 'Expand All' : 'Collapse All'}
                    >
                        {allCollapsed
                            ? <ChevronsUpDown size={14} />
                            : <ChevronsDownUp size={14} />
                        }
                    </button>

                    {onClear && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-transparent hover:border-slate-700/80 transition-all duration-200"
                            title="Clear results"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Result tree */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {results.map((tabRes) => {
                    const uniqueKey = `${tabRes.tabId}-${tabRes.pane}`;
                    const isCollapsed = collapsedTabs[uniqueKey] ?? false;
                    const matchesCount = tabRes.matches.length;
                    const isCopied = copiedKey === uniqueKey;

                    if (matchesCount === 0) return null;

                    return (
                        <div key={uniqueKey} className="border border-slate-800/40 rounded-lg overflow-hidden bg-slate-900/20">
                            {/* File node header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/20 hover:bg-emerald-950/40 border-b border-emerald-900/30 transition-colors duration-150 group">
                                {/* Left: toggle + file info */}
                                <div
                                    className="flex items-center space-x-2.5 overflow-hidden flex-1 cursor-pointer"
                                    onClick={() => toggleTabCollapse(uniqueKey)}
                                >
                                    <svg
                                        className={`w-3.5 h-3.5 text-emerald-500 transition-transform duration-200 shrink-0 ${isCollapsed ? '-rotate-90' : ''}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-emerald-300 font-medium truncate text-xs" title={tabRes.filePath}>
                                        {tabRes.filePath || tabRes.fileName}
                                    </span>
                                </div>

                                {/* Right: badges + copy button */}
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    <span className="bg-emerald-900/60 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-800/40 font-bold">
                                        {matchesCount} hits
                                    </span>
                                    <span className="text-[10px] text-slate-500 bg-slate-950/60 border border-slate-800/60 px-1.5 py-0.5 rounded">
                                        {tabRes.tabName} ({tabRes.pane === 'left' ? 'L' : 'R'})
                                    </span>
                                    {/* Copy to Clipboard button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyFile(tabRes, uniqueKey); }}
                                        className={`p-1 rounded transition-all duration-150 ${
                                            isCopied
                                                ? 'text-emerald-400 bg-emerald-900/30'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                                        }`}
                                        title="Copy matches to clipboard"
                                    >
                                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </div>

                            {/* Match lines */}
                            {!isCollapsed && (
                                <div className="divide-y divide-slate-900/50 font-mono text-xs max-h-[400px] overflow-y-auto bg-slate-950/10">
                                    {tabRes.matches.map((match) => (
                                        <div
                                            key={match.lineNum}
                                            onClick={() => onJumpToTabLine(tabRes.tabId, tabRes.pane, match.lineNum)}
                                            className="flex items-start py-1.5 px-4 hover:bg-slate-800/35 cursor-pointer group transition-colors duration-100"
                                        >
                                            {/* Line number */}
                                            <span className="w-16 text-right text-rose-400 font-semibold pr-3 border-r border-slate-800/60 select-none flex-shrink-0">
                                                {match.lineNum + 1}
                                            </span>
                                            {/* Line content */}
                                            <span className="pl-4 text-slate-300 whitespace-pre-wrap break-all flex-1 group-hover:text-slate-100 transition-colors">
                                                {renderHighlightedContent(match.content)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
