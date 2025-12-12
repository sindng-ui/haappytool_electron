import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogHighlight } from '../types';
import { HighlightRenderer } from './LogViewer/HighlightRenderer';

interface BookmarksModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestLines: (indices: number[]) => Promise<{ lineNum: number, content: string, formattedLineIndex: number }[]>;
    bookmarks: Set<number>;
    onJump: (index: number) => void;
    highlights?: LogHighlight[];
    caseSensitive?: boolean;
    title?: string;
    onClearAll?: () => void;
    onDeleteBookmark?: (index: number) => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
    isOpen, onClose, requestLines, bookmarks, onJump, highlights, caseSensitive, title = "Bookmarks",
    onClearAll, onDeleteBookmark
}) => {
    const [lines, setLines] = useState<{ lineNum: number, content: string, formattedLineIndex: number }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && bookmarks.size > 0) {
            setIsLoading(true);
            const indices = Array.from(bookmarks).sort((a, b) => a - b);
            requestLines(indices).then(fetched => {
                setLines(fetched || []);
                setIsLoading(false);
            });
        } else {
            setLines([]);
        }
    }, [isOpen, bookmarks, requestLines]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 w-[800px] h-[600px] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="h-12 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-slate-50 dark:bg-slate-950/50">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="text-yellow-500">★</span>
                        {title}
                        <span className="text-xs font-normal text-slate-400 ml-2">({bookmarks.size} lines)</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {onClearAll && bookmarks.size > 0 && (
                            <button
                                onClick={onClearAll}
                                className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded transition-colors flex items-center gap-1"
                                title="Clear all bookmarks"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Clear All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            Loading bookmarks...
                        </div>
                    ) : lines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <span className="text-2xl opacity-50">★</span>
                            <p>No bookmarks found.</p>
                            <p className="text-sm opacity-70">Double-click the line number column to bookmark lines.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lines.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        onJump(item.formattedLineIndex);
                                        onClose();
                                    }}
                                    className="group flex hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                >
                                    {/* Line Number */}
                                    <div className="w-16 shrink-0 py-2 px-3 text-right font-mono text-xs text-slate-400 border-r border-slate-100 dark:border-slate-800 group-hover:text-yellow-600 dark:group-hover:text-yellow-500">
                                        {item.lineNum}
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 py-1 px-3 font-mono text-xs text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap overflow-hidden">
                                        <HighlightRenderer text={item.content} highlights={highlights} caseSensitive={caseSensitive} />
                                    </div>
                                    {/* Delete Action */}
                                    {onDeleteBookmark && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteBookmark(item.formattedLineIndex);
                                            }}
                                            className="w-8 shrink-0 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove bookmark"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-10 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-4 flex items-center justify-end text-xs text-slate-500 gap-4">
                    <div>
                        Click a line to jump to it
                    </div>
                    <button onClick={onClose} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
