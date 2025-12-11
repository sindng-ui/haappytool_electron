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
            className={`group flex items-center text-xs font-mono whitespace-pre hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer select-text ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''} ${hasBookmark ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
            onClick={() => onClick && onClick(index)}
            onDoubleClick={() => onDoubleClick && onDoubleClick(index)}
        >
            {/* Sticky Bookmark Column */}
            <div className="sticky left-0 z-10 w-[20px] h-full shrink-0 flex items-center justify-center border-r border-slate-300 dark:border-slate-800">
                {/* Background Blocker (matches pane bg) */}
                <div className="absolute inset-0 bg-slate-100 dark:bg-slate-950" />
                {/* State Overlay (matches row state) */}
                <div className={`absolute inset-0 group-hover:bg-slate-200 dark:group-hover:bg-slate-800 transition-colors ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''} ${hasBookmark ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`} />

                <div className="relative z-10">
                    {hasBookmark && <span className="text-yellow-600 dark:text-yellow-500 font-bold text-[10px]">★</span>}
                </div>
            </div>

            {/* Item Index # */}
            {!isRawMode && (
                <div className="min-w-[70px] w-[70px] shrink-0 text-right pr-2 text-slate-500 dark:text-slate-500 select-none border-r border-slate-300 dark:border-slate-800 mr-2 flex items-center justify-end">
                    #{index + 1}
                </div>
            )}

            {/* Line Number */}
            <div className={`min-w-[70px] w-[70px] shrink-0 text-right pr-3 select-none flex justify-end gap-1 items-center ${hasBookmark ? 'text-yellow-600 dark:text-yellow-500 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>
                {isLoading ? '' : data.lineNum}
            </div>

            {/* Content */}
            <div className={`min-w-0 flex-1 px-2 ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                {isLoading ? 'Loading...' : (isRawMode ? data?.content : <HighlightRenderer text={data?.content || ''} highlights={highlights} caseSensitive={highlightCaseSensitive} />)}
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
