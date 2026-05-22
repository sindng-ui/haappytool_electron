/**
 * FindInAllModal.tsx
 * Ctrl+Shift+F 로 여는 전체 찾기 모달 🐧⚡
 * - 독립 룰 (Global Mission과 완전 무관)
 * - 히스토리: 최근 10개, 마우스 호버 시 미리보기, 클릭 시 불러오기
 * - 해피콤보: 줄바꿈/콤마 구분 입력 (단순화)
 * - 블럭리스트: 줄바꿈/콤마 구분 입력
 * - Ctrl+Enter 바로 검색 / Esc 닫기
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { X, Search, History, ChevronDown, ChevronRight, RotateCcw, Clock } from 'lucide-react';
import { FindInAllRule, FindInAllHistoryItem, useFindInAllHistory, buildHistoryLabel } from '../../hooks/useFindInAllHistory';

interface FindInAllModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSearch: (rule: FindInAllRule) => void;
    isSearching: boolean;
    lastSearchRule: FindInAllRule | null;
}

/** 키워드 문자열 → 배열 파싱 (줄바꿈/콤마 구분) */
function parseKeywords(raw: string): string[] {
    return raw
        .split(/[\n,]/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
}

/** 배열 → 표시용 문자열 (줄바꿈 구분) */
function joinKeywords(keywords: string[]): string {
    return keywords.join('\n');
}

/** 툴팁용 히스토리 미리보기 카드 */
const HistoryTooltip: React.FC<{ item: FindInAllHistoryItem }> = memo(({ item }) => {
    const date = new Date(item.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

    return (
        <div
            className="absolute left-full top-0 ml-2 z-[200] min-w-[260px] max-w-[340px] pointer-events-none"
            style={{ transform: 'translateY(-20%)' }}
        >
            <div className="bg-slate-800 border border-slate-600/80 rounded-xl shadow-2xl p-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400 mb-2 pb-1.5 border-b border-slate-700">
                    <Clock size={11} />
                    <span>{dateStr}</span>
                </div>
                {item.rule.includeKeywords.length > 0 && (
                    <div className="mb-2">
                        <div className="text-emerald-400 font-semibold mb-1">🔍 해피콤보</div>
                        <div className="space-y-0.5 max-h-[80px] overflow-hidden">
                            {item.rule.includeKeywords.slice(0, 5).map((kw, i) => (
                                <div key={i} className="text-slate-300 bg-emerald-950/40 rounded px-1.5 py-0.5 truncate">
                                    {kw}
                                </div>
                            ))}
                            {item.rule.includeKeywords.length > 5 && (
                                <div className="text-slate-500 text-[10px]">+{item.rule.includeKeywords.length - 5} more...</div>
                            )}
                        </div>
                    </div>
                )}
                {item.rule.excludeKeywords.length > 0 && (
                    <div>
                        <div className="text-rose-400 font-semibold mb-1">🚫 블럭리스트</div>
                        <div className="space-y-0.5 max-h-[50px] overflow-hidden">
                            {item.rule.excludeKeywords.slice(0, 3).map((kw, i) => (
                                <div key={i} className="text-slate-300 bg-rose-950/40 rounded px-1.5 py-0.5 truncate">
                                    {kw}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {/* 화살표 */}
            <div
                className="absolute top-5 -left-1.5 w-3 h-3 bg-slate-800 border-l border-b border-slate-600/80 rotate-45"
                style={{ transform: 'translateY(-50%) rotate(45deg)' }}
            />
        </div>
    );
});
HistoryTooltip.displayName = 'HistoryTooltip';

const FindInAllModal: React.FC<FindInAllModalProps> = memo(({
    isOpen,
    onClose,
    onSearch,
    isSearching,
    lastSearchRule,
}) => {
    const { history } = useFindInAllHistory();

    const [includeText, setIncludeText] = useState('');
    const [excludeText, setExcludeText] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [blockListCaseSensitive, setBlockListCaseSensitive] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isIncludeOpen, setIsIncludeOpen] = useState(true);
    const [isExcludeOpen, setIsExcludeOpen] = useState(false);
    const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null);

    const includeRef = useRef<HTMLTextAreaElement>(null);

    // 모달 열릴 때 마지막 룰 복원
    useEffect(() => {
        if (isOpen && lastSearchRule) {
            setIncludeText(joinKeywords(lastSearchRule.includeKeywords));
            setExcludeText(joinKeywords(lastSearchRule.excludeKeywords));
            setCaseSensitive(lastSearchRule.caseSensitive);
            setBlockListCaseSensitive(lastSearchRule.blockListCaseSensitive);
        } else if (isOpen) {
            // 히스토리가 있으면 가장 최근 것 로드
            if (history.length > 0) {
                const last = history[0];
                setIncludeText(joinKeywords(last.rule.includeKeywords));
                setExcludeText(joinKeywords(last.rule.excludeKeywords));
                setCaseSensitive(last.rule.caseSensitive);
                setBlockListCaseSensitive(last.rule.blockListCaseSensitive);
            }
        }
    }, [isOpen]);

    // 모달 열리면 포커스
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => includeRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Esc 닫기
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [isOpen, onClose]);

    const handleSearch = useCallback(() => {
        const rule: FindInAllRule = {
            includeKeywords: parseKeywords(includeText),
            excludeKeywords: parseKeywords(excludeText),
            caseSensitive,
            blockListCaseSensitive,
        };
        onSearch(rule);
    }, [includeText, excludeText, caseSensitive, blockListCaseSensitive, onSearch]);

    const handleLoadHistory = useCallback((item: FindInAllHistoryItem) => {
        setIncludeText(joinKeywords(item.rule.includeKeywords));
        setExcludeText(joinKeywords(item.rule.excludeKeywords));
        setCaseSensitive(item.rule.caseSensitive);
        setBlockListCaseSensitive(item.rule.blockListCaseSensitive);
        setHoveredHistoryId(null);
        includeRef.current?.focus();
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    }, [handleSearch]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[150] flex items-start justify-center pt-[12vh]"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-[520px] flex flex-col overflow-hidden max-h-[80vh]"
                onKeyDown={handleKeyDown}
            >
                {/* ── 헤더 ── */}
                <div className="bg-slate-950/80 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <Search size={15} className="text-indigo-400" />
                        </div>
                        <h2 className="text-sm font-bold text-slate-200 tracking-wide">Find in All Open Files</h2>
                        <kbd className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">Ctrl+Shift+F</kbd>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* ── 히스토리 섹션 ── */}
                    {history.length > 0 && (
                        <div className="border-b border-slate-800/60">
                            <button
                                onClick={() => setIsHistoryOpen(p => !p)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                            >
                                {isHistoryOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                <History size={13} />
                                <span>Recent Searches ({history.length})</span>
                            </button>

                            {isHistoryOpen && (
                                <div className="pb-2 px-2">
                                    {history.map(item => (
                                        <div
                                            key={item.id}
                                            className="relative"
                                            onMouseEnter={() => setHoveredHistoryId(item.id)}
                                            onMouseLeave={() => setHoveredHistoryId(null)}
                                        >
                                            <button
                                                onClick={() => handleLoadHistory(item)}
                                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors group"
                                            >
                                                <RotateCcw size={11} className="text-slate-600 group-hover:text-indigo-400 shrink-0 transition-colors" />
                                                <span className="text-[11px] text-slate-300 truncate flex-1 font-mono">
                                                    {item.label}
                                                </span>
                                                <span className="text-[9px] text-slate-600 shrink-0">
                                                    {new Date(item.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </button>

                                            {/* 호버 미리보기 툴팁 */}
                                            {hoveredHistoryId === item.id && (
                                                <HistoryTooltip item={item} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── 해피콤보 섹션 ── */}
                    <div className="border-b border-slate-800/60">
                        <button
                            onClick={() => setIsIncludeOpen(p => !p)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                        >
                            {isIncludeOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <span className="text-emerald-400">✦</span>
                            <span>Happy Combo (Include Keywords)</span>
                        </button>

                        {isIncludeOpen && (
                            <div className="px-4 pb-3">
                                <textarea
                                    ref={includeRef}
                                    value={includeText}
                                    onChange={e => setIncludeText(e.target.value)}
                                    placeholder={'키워드를 입력하세요 (줄바꿈 or 콤마로 구분)\n예:\nonCreate\nonResume\nonPause'}
                                    className="w-full bg-slate-950/60 border border-slate-700/60 focus:border-emerald-500/50 rounded-xl text-xs text-slate-200 placeholder-slate-600 font-mono resize-none focus:outline-none p-3 transition-colors"
                                    rows={4}
                                    spellCheck={false}
                                />
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <button
                                        onClick={() => setCaseSensitive(p => !p)}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${caseSensitive
                                            ? 'bg-emerald-900/50 border-emerald-500/50 text-emerald-300'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        Aa Case
                                    </button>
                                    <span className="text-[10px] text-slate-600 ml-1">
                                        {parseKeywords(includeText).length} keywords
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 블럭리스트 섹션 ── */}
                    <div className="border-b border-slate-800/60">
                        <button
                            onClick={() => setIsExcludeOpen(p => !p)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                        >
                            {isExcludeOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <span className="text-rose-400">✕</span>
                            <span>Block List (Exclude Keywords)</span>
                            {parseKeywords(excludeText).length > 0 && (
                                <span className="ml-auto text-[10px] bg-rose-900/40 text-rose-300 px-1.5 py-0.5 rounded-full border border-rose-800/40">
                                    {parseKeywords(excludeText).length}
                                </span>
                            )}
                        </button>

                        {isExcludeOpen && (
                            <div className="px-4 pb-3">
                                <textarea
                                    value={excludeText}
                                    onChange={e => setExcludeText(e.target.value)}
                                    placeholder={'제외할 키워드 (줄바꿈 or 콤마로 구분)'}
                                    className="w-full bg-slate-950/60 border border-slate-700/60 focus:border-rose-500/50 rounded-xl text-xs text-slate-200 placeholder-slate-600 font-mono resize-none focus:outline-none p-3 transition-colors"
                                    rows={3}
                                    spellCheck={false}
                                />
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <button
                                        onClick={() => setBlockListCaseSensitive(p => !p)}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${blockListCaseSensitive
                                            ? 'bg-rose-900/50 border-rose-500/50 text-rose-300'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        Aa Case
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 푸터 ── */}
                <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 flex items-center gap-3 shrink-0">
                    {/* 단축키 힌트 */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 flex-1">
                        <kbd className="bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700">Ctrl+Enter</kbd>
                        <span>Search</span>
                        <kbd className="bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700 ml-1">Esc</kbd>
                        <span>Close</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching || parseKeywords(includeText).length === 0}
                        className="flex items-center gap-2 px-5 py-1.5 text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-indigo-900/30 transition-all active:scale-95"
                    >
                        {isSearching ? (
                            <>
                                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span>Searching...</span>
                            </>
                        ) : (
                            <>
                                <Search size={13} />
                                <span>Search All</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

FindInAllModal.displayName = 'FindInAllModal';
export default FindInAllModal;
