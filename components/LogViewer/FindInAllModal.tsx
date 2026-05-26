/**
 * FindInAllModal.tsx
 * Ctrl+Shift+F — premium full-width search modal 🐧⚡
 * - Large, premium dark UI (no blur)
 * - Tag-chip keyword input (Enter / comma to add)
 * - Recent search history (no tooltip hover scrollbar)
 * - Block list open by default
 */

import React, {
    useState, useEffect, useCallback, useRef, memo, KeyboardEvent
} from 'react';
import {
    X, Search, History, ChevronDown, ChevronRight,
    RotateCcw, Clock, Plus, Tag, ShieldOff
} from 'lucide-react';
import {
    FindInAllRule, FindInAllHistoryItem,
    useFindInAllHistory, buildHistoryLabel
} from '../../hooks/useFindInAllHistory';

interface FindInAllModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSearch: (rule: FindInAllRule) => void;
    isSearching: boolean;
    lastSearchRule: FindInAllRule | null;
    targetTabId?: string;       // 🐧⚡ 추가: 현재 탭 전용 검색 모드인 경우의 탭 ID
    targetTabTitle?: string;    // 🐧⚡ 추가: 현재 탭의 타이틀
}

// ─────────────────────────────────────────────────────────────
// TagInput: Enter/comma → add chip, Backspace → remove last
// ─────────────────────────────────────────────────────────────
interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    accentColor?: 'emerald' | 'rose';
    autoFocus?: boolean;
}

// ── Happy Combo chip: matches HappyComboSection root tag style exactly
const TAG_COLORS_EMERALD = 'bg-indigo-900/50 border-indigo-500/50 text-indigo-100 hover:border-indigo-400/70 hover:bg-indigo-900/70';
// ── Block List chip: rose variant, same light weight feel
const TAG_COLORS_ROSE    = 'bg-rose-950/60 border-rose-700/50 text-rose-100 hover:border-rose-500/70 hover:bg-rose-950/80';

const TagInput: React.FC<TagInputProps> = memo(({ tags, onChange, placeholder, accentColor = 'emerald', autoFocus }) => {
    const [inputVal, setInputVal] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const tagColorClass  = accentColor === 'emerald' ? TAG_COLORS_EMERALD : TAG_COLORS_ROSE;
    const focusRingClass = accentColor === 'emerald'
        ? 'focus-within:border-indigo-500/50 focus-within:shadow-[0_0_0_2px_rgba(99,102,241,0.10)]'
        : 'focus-within:border-rose-500/50 focus-within:shadow-[0_0_0_2px_rgba(244,63,94,0.10)]';

    const addTag = useCallback((raw: string) => {
        const words = raw.split(/[,\n]+/).map(w => w.trim()).filter(w => w.length > 0);
        if (words.length === 0) return;
        const unique = Array.from(new Set([...tags, ...words]));
        if (unique.length !== tags.length) onChange(unique);
    }, [tags, onChange]);

    const removeTag = useCallback((idx: number) => {
        onChange(tags.filter((_, i) => i !== idx));
    }, [tags, onChange]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputVal);
            setInputVal('');
        } else if (e.key === 'Backspace' && inputVal === '' && tags.length > 0) {
            onChange(tags.slice(0, -1));
        }
    }, [inputVal, addTag, onChange, tags]);

    const handleBlur = useCallback(() => {
        if (inputVal.trim()) {
            addTag(inputVal);
            setInputVal('');
        }
    }, [inputVal, addTag]);

    // click anywhere in box → focus input
    const handleBoxClick = useCallback(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (autoFocus) {
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [autoFocus]);

    return (
        <div
            ref={containerRef}
            onClick={handleBoxClick}
            className={`
                min-h-[56px] w-full rounded-xl border border-slate-700/50 bg-slate-950/50
                p-2 flex flex-wrap gap-1.5 items-start cursor-text
                transition-all duration-200 ${focusRingClass}
            `}
        >
            {tags.map((tag, i) => (
                <span
                    key={`${tag}-${i}`}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-xs font-mono font-semibold transition-all duration-150 select-none ${tagColorClass}`}
                >
                    {tag}
                    <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); removeTag(i); }}
                        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity rounded"
                        tabIndex={-1}
                    >
                        <X size={10} />
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={tags.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[120px] bg-transparent text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none py-0.5"
                spellCheck={false}
            />
        </div>
    );
});
TagInput.displayName = 'TagInput';

// ─────────────────────────────────────────────────────────────
// History row (no tooltip)
// ─────────────────────────────────────────────────────────────
interface HistoryRowProps {
    item: FindInAllHistoryItem;
    onLoad: (item: FindInAllHistoryItem) => void;
}

const HistoryRow: React.FC<HistoryRowProps> = memo(({ item, onLoad }) => {
    const timeStr = new Date(item.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });
    const keywords = item.rule.includeKeywords;
    const excludes = item.rule.excludeKeywords;

    return (
        <button
            onClick={() => onLoad(item)}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/70 transition-colors group"
        >
            <RotateCcw size={11} className="text-slate-600 group-hover:text-indigo-400 shrink-0 transition-colors" />

            {/* keyword chips preview */}
            <div className="flex-1 flex items-center gap-1 overflow-hidden">
                {keywords.slice(0, 4).map((kw, i) => (
                    <span
                        key={i}
                        className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-[10px] font-mono truncate max-w-[100px]"
                    >
                        {kw}
                    </span>
                ))}
                {keywords.length > 4 && (
                    <span className="text-[10px] text-slate-500">+{keywords.length - 4}</span>
                )}
                {excludes.length > 0 && (
                    <span className="ml-1 text-[10px] text-rose-400/60">
                        -{excludes.length} excl.
                    </span>
                )}
            </div>

            <span className="text-[10px] text-slate-600 shrink-0 flex items-center gap-1">
                <Clock size={9} />
                {timeStr}
            </span>
        </button>
    );
});
HistoryRow.displayName = 'HistoryRow';

// ─────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────
interface SectionHeaderProps {
    isOpen: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
    title: string;
    badge?: React.ReactNode;
    accentColor?: 'default' | 'emerald' | 'rose';
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ isOpen, onToggle, icon, title, badge, accentColor = 'default' }) => {
    const accentMap = {
        default: 'text-slate-400 hover:text-slate-200',
        emerald: 'text-indigo-400/80 hover:text-indigo-300',
        rose: 'text-rose-400/80 hover:text-rose-300',
    };
    return (
        <button
            onClick={onToggle}
            className={`w-full flex items-center gap-2 px-5 py-3 text-xs font-bold hover:bg-white/[0.03] transition-colors ${accentMap[accentColor]}`}
        >
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {icon}
            <span>{title}</span>
            {badge}
        </button>
    );
};

// ─────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────
const FindInAllModal: React.FC<FindInAllModalProps> = memo(({
    isOpen, onClose, onSearch, isSearching, lastSearchRule, targetTabId, targetTabTitle
}) => {
    const { history } = useFindInAllHistory();

    const [includeTags, setIncludeTags] = useState<string[]>([]);
    const [excludeTags, setExcludeTags] = useState<string[]>([]);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [blockListCaseSensitive, setBlockListCaseSensitive] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isIncludeOpen, setIsIncludeOpen] = useState(true);
    const [isExcludeOpen, setIsExcludeOpen] = useState(true); // open by default

    // Restore last rule when modal opens
    useEffect(() => {
        if (!isOpen) return;
        const source = lastSearchRule ?? (history.length > 0 ? history[0].rule : null);
        if (source) {
            setIncludeTags(source.includeKeywords);
            setExcludeTags(source.excludeKeywords);
            setCaseSensitive(source.caseSensitive);
            setBlockListCaseSensitive(source.blockListCaseSensitive);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Esc to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [isOpen, onClose]);

    const handleSearch = useCallback(() => {
        const rule: FindInAllRule = {
            includeKeywords: includeTags,
            excludeKeywords: excludeTags,
            caseSensitive,
            blockListCaseSensitive,
            targetTabId, // 🐧⚡ 스코프 전달!
        };
        onSearch(rule);
    }, [includeTags, excludeTags, caseSensitive, blockListCaseSensitive, onSearch, targetTabId]);

    const handleLoadHistory = useCallback((item: FindInAllHistoryItem) => {
        setIncludeTags(item.rule.includeKeywords);
        setExcludeTags(item.rule.excludeKeywords);
        setCaseSensitive(item.rule.caseSensitive);
        setBlockListCaseSensitive(item.rule.blockListCaseSensitive);
    }, []);

    // Ctrl+Enter in modal → search
    const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    }, [handleSearch]);

    if (!isOpen) return null;

    const canSearch = includeTags.length > 0;

    return (
        <div
            className="fixed inset-0 z-[150] flex items-start justify-center pt-[8vh]"
            style={{ background: 'rgba(0,0,0,0.72)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="
                    w-full max-w-[700px] mx-4
                    bg-slate-900 border border-slate-700/50
                    rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]
                    flex flex-col overflow-hidden
                    max-h-[88vh]
                "
                onKeyDown={handleModalKeyDown}
            >
                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/25">
                            <Search size={17} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                                {targetTabId ? `Find in Tab: ${targetTabTitle}` : 'Find in All Open Files'}
                            </h2>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                {targetTabId ? 'Search within the active log tab only' : 'Search across all loaded log tabs simultaneously'}
                            </p>
                        </div>
                        <kbd className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 ml-1">
                            {targetTabId ? 'Ctrl+F' : 'Ctrl+Shift+F'}
                        </kbd>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>

                    {/* Recent Searches */}
                    {history.length > 0 && (
                        <div className="border-b border-slate-800/60">
                            <SectionHeader
                                isOpen={isHistoryOpen}
                                onToggle={() => setIsHistoryOpen(p => !p)}
                                icon={<History size={13} />}
                                title={`Recent Searches`}
                                badge={
                                    <span className="ml-1 text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-700">
                                        {history.length}
                                    </span>
                                }
                            />
                            {isHistoryOpen && (
                                <div className="pb-2 px-3">
                                    {history.map(item => (
                                        <HistoryRow key={item.id} item={item} onLoad={handleLoadHistory} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Happy Combo */}
                    <div className="border-b border-slate-800/60">
                        <SectionHeader
                            isOpen={isIncludeOpen}
                            onToggle={() => setIsIncludeOpen(p => !p)}
                            icon={<Tag size={13} />}
                            title="Happy Combo"
                            badge={
                                includeTags.length > 0 && (
                                    <span className="ml-1 text-[10px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-800/50">
                                        {includeTags.length}
                                    </span>
                                )
                            }
                            accentColor="emerald"
                        />
                        {isIncludeOpen && (
                            <div className="px-5 pb-4">
                                <TagInput
                                    tags={includeTags}
                                    onChange={setIncludeTags}
                                    placeholder="Type keyword + Enter or comma to add..."
                                    accentColor="emerald"
                                    autoFocus
                                />
                                <div className="flex items-center gap-2 mt-2">
                                    <button
                                        onClick={() => setCaseSensitive(p => !p)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                            caseSensitive
                                                ? 'bg-indigo-900/60 border-indigo-500/60 text-indigo-200'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        Aa&nbsp;Case
                                    </button>
                                    <span className="text-[10px] text-slate-600">
                                        {includeTags.length} keyword{includeTags.length !== 1 ? 's' : ''}
                                        {includeTags.length > 0 && (
                                            <button
                                                onClick={() => setIncludeTags([])}
                                                className="ml-2 text-indigo-400/50 hover:text-indigo-300 transition-colors"
                                            >
                                                clear all
                                            </button>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Block List */}
                    <div>
                        <SectionHeader
                            isOpen={isExcludeOpen}
                            onToggle={() => setIsExcludeOpen(p => !p)}
                            icon={<ShieldOff size={13} />}
                            title="Block List"
                            badge={
                                excludeTags.length > 0 && (
                                    <span className="ml-1 text-[10px] bg-rose-900/50 text-rose-300 px-1.5 py-0.5 rounded-full border border-rose-800/50">
                                        {excludeTags.length}
                                    </span>
                                )
                            }
                            accentColor="rose"
                        />
                        {isExcludeOpen && (
                            <div className="px-5 pb-4">
                                <TagInput
                                    tags={excludeTags}
                                    onChange={setExcludeTags}
                                    placeholder="Type keyword + Enter or comma to exclude..."
                                    accentColor="rose"
                                />
                                <div className="flex items-center gap-2 mt-2">
                                    <button
                                        onClick={() => setBlockListCaseSensitive(p => !p)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                            blockListCaseSensitive
                                                ? 'bg-rose-900/60 border-rose-500/60 text-rose-300'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        Aa&nbsp;Case
                                    </button>
                                    <span className="text-[10px] text-slate-600">
                                        {excludeTags.length} keyword{excludeTags.length !== 1 ? 's' : ''}
                                        {excludeTags.length > 0 && (
                                            <button
                                                onClick={() => setExcludeTags([])}
                                                className="ml-2 text-rose-400/50 hover:text-rose-300 transition-colors"
                                            >
                                                clear all
                                            </button>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-3 shrink-0">
                    {/* Shortcut hints */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 flex-1 flex-wrap">
                        <span className="flex items-center gap-1">
                            <kbd className="bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700">Enter</kbd>
                            <span>add tag</span>
                        </span>
                        <span className="text-slate-700">·</span>
                        <span className="flex items-center gap-1">
                            <kbd className="bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700">Ctrl+Enter</kbd>
                            <span>search</span>
                        </span>
                        <span className="text-slate-700">·</span>
                        <span className="flex items-center gap-1">
                            <kbd className="bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700">Esc</kbd>
                            <span>close</span>
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleSearch}
                        disabled={isSearching || !canSearch}
                        className="
                            flex items-center gap-2 px-6 py-2 text-xs font-bold
                            bg-gradient-to-r from-indigo-600 to-violet-600
                            hover:from-indigo-500 hover:to-violet-500
                            disabled:opacity-40 disabled:cursor-not-allowed
                            text-white rounded-xl
                            shadow-lg shadow-indigo-900/40
                            transition-all active:scale-95
                        "
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
                                <span>{targetTabId ? 'Search Tab' : 'Search All'}</span>
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
