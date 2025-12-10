import React from 'react';
import { Bookmark } from 'lucide-react';
import { LogHighlight } from '../../types';
import { HighlightRenderer } from './HighlightRenderer';

interface LogLineProps {
    index: number;
    style: React.CSSProperties;
    data?: { lineNum: number; content: string };
    isActive: boolean;
    hasBookmark: boolean;
    isRawMode: boolean;
    highlights?: LogHighlight[];
    onClick: (index: number) => void;
    onDoubleClick: (index: number) => void;
}

export const LogLine = React.memo(({
    index, style, data, isActive, hasBookmark, isRawMode, highlights, onClick, onDoubleClick
}: LogLineProps) => {
    const isLoading = !data;

    const stickyBgClass = isActive ? 'bg-indigo-200 dark:bg-[#1e1b4b] backdrop-blur-sm' : 'bg-slate-100 dark:bg-[#020617] group-hover:bg-slate-200 dark:group-hover:bg-[#0f172a]';

    return (
        <div
            style={style}
            className={`min-w-full w-max flex items-center pr-4 font-mono text-[13px] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/5 whitespace-pre transition-colors duration-0 cursor-pointer group ${isActive ? 'bg-indigo-200 dark:bg-[#1e1b4b] border-indigo-300 dark:border-indigo-500/50 z-10' :
                'border-transparent hover:bg-slate-200 dark:hover:bg-[#0f172a]'
                }`}
            onClick={() => onClick(index)}
            onDoubleClick={() => onDoubleClick(index)}
        >
            <div className={`h-full flex items-center justify-center w-[30px] shrink-0 sticky left-0 z-20 transition-colors duration-0 ${stickyBgClass}`}>
                {hasBookmark && <Bookmark size={12} className="text-yellow-500 dark:text-yellow-400 fill-yellow-500 dark:fill-yellow-400" />}
            </div>
            {!isRawMode && (
                <span className={`h-full flex items-center justify-end w-[50px] text-slate-500 dark:text-slate-500 select-none text-right pr-3 shrink-0 border-r border-slate-300 dark:border-slate-800 mr-3 font-semibold sticky left-[30px] z-20 transition-colors duration-0 ${stickyBgClass}`}>
                    #{index + 1}
                </span>
            )}
            <span className={`w-[60px] text-slate-500 dark:text-slate-500 select-none text-right pr-4 shrink-0 font-medium ${isRawMode ? 'pl-2' : ''}`}>
                {isLoading ? '...' : data?.lineNum}
            </span>
            <span className={isLoading ? 'text-slate-500 dark:text-slate-600 italic' : ''}>
                {isLoading ? 'Loading...' : (isRawMode ? data?.content : <HighlightRenderer text={data?.content || ''} highlights={highlights} />)}
            </span>
        </div>
    );
});
