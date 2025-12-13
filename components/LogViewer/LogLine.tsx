import React from 'react';
import { LogHighlight } from '../../types';
import { HighlightRenderer } from './HighlightRenderer';

interface LogLineProps {
    index: number;
    style: React.CSSProperties;
    data?: { lineNum: number, content: string };
    isActive: boolean;
    hasBookmark: boolean;
    isRawMode?: boolean;
    highlights?: LogHighlight[];
    highlightCaseSensitive?: boolean;
    onClick?: (index: number) => void;
    onDoubleClick?: (index: number) => void;
}

export const LogLine = React.memo(({ index, style, data, isActive, hasBookmark, isRawMode = false, highlights, highlightCaseSensitive = false, onClick, onDoubleClick }: LogLineProps) => {
    const isLoading = !data;

    return (
        <div
            style={style}
            className={`group flex items-center text-xs font-mono whitespace-pre cursor-pointer select-text transition-colors duration-75
                ${isActive
                    ? 'bg-indigo-500/10 dark:bg-indigo-500/20 font-medium'
                    : hasBookmark
                        ? 'bg-yellow-50/50 dark:bg-yellow-500/10 hover:bg-slate-200/50 dark:hover:bg-indigo-500/5'
                        : 'hover:bg-slate-200/50 dark:hover:bg-indigo-500/5'
                }`}
            onClick={() => onClick && onClick(index)}
            onDoubleClick={() => onDoubleClick && onDoubleClick(index)}
        >
            {/* Sticky Bookmark Column */}
            <div className="sticky left-0 z-10 w-[20px] h-full shrink-0 flex items-center justify-center border-r border-slate-200 dark:border-white/5">
                {/* Background Blocker (matches pane bg but opaque for scrolling content underneath) */}
                <div className="absolute inset-0 bg-slate-50 dark:bg-[#020617]" />

                {/* State Overlay (matches row state) */}
                <div className={`absolute inset-0 transition-colors 
                    ${isActive
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/20'
                        : hasBookmark
                            ? 'bg-yellow-50/50 dark:bg-yellow-500/10 group-hover:bg-slate-200/50 dark:group-hover:bg-indigo-500/5'
                            : 'group-hover:bg-slate-200/50 dark:group-hover:bg-indigo-500/5'
                    }`}
                />

                {/* Left Active Indicator */}
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}

                <div className="relative z-10">
                    {hasBookmark && <span className="text-yellow-600 dark:text-yellow-400 font-bold text-[10px] icon-glow">★</span>}
                </div>
            </div>

            {/* Item Index # */}
            {!isRawMode && (
                <div className="min-w-[70px] w-[70px] shrink-0 text-right pr-2 text-slate-400 dark:text-slate-600 select-none border-r border-slate-200 dark:border-white/5 mr-2 flex items-center justify-end font-mono text-[11px]">
                    #{index + 1}
                </div>
            )}

            {/* Line Number */}
            <div className={`min-w-[90px] w-[90px] shrink-0 text-right pr-3 select-none flex justify-end gap-1 items-center font-mono text-[11px] 
                ${hasBookmark ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>
                {isLoading ? '' : data?.lineNum}
            </div>

            {/* Content */}
            <div className={`min-w-0 flex-1 px-2 ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                {isLoading ? (
                    <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse mt-1" />
                ) : (
                    isRawMode ? data?.content : <HighlightRenderer text={data?.content || ''} highlights={highlights} caseSensitive={highlightCaseSensitive} />
                )}
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.index === next.index &&
        prev.style.top === next.style.top &&
        prev.isActive === next.isActive &&
        prev.hasBookmark === next.hasBookmark &&
        prev.data === next.data &&
        prev.isRawMode === next.isRawMode &&
        prev.highlights === next.highlights &&
        prev.highlightCaseSensitive === next.highlightCaseSensitive;
});
