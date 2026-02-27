import React from 'react';
import { Zap, Split, Archive, Bookmark, Copy, Download, BarChart3 } from 'lucide-react';

interface LogViewerToolbarProps {
    isRawMode?: boolean;
    workerReady: boolean;
    placeholderText: string;
    fileName?: string;
    onArchiveSave?: () => void;
    isArchiveSaveEnabled?: boolean;
    onShowBookmarks?: () => void;
    bookmarksSize: number;
    onCopy?: () => void;
    onSave?: () => void;
    onAnalyzePerformance?: () => void;
    perfAnalysisResult?: any;
    isAnalyzingPerformance?: boolean;
}

export const LogViewerToolbar: React.FC<LogViewerToolbarProps> = ({
    isRawMode = false,
    workerReady,
    placeholderText,
    fileName,
    onArchiveSave,
    isArchiveSaveEnabled = false,
    onShowBookmarks,
    bookmarksSize,
    onCopy,
    onSave,
    onAnalyzePerformance,
    perfAnalysisResult,
    isAnalyzingPerformance = false
}) => {
    if (isRawMode) return null;

    return (
        <div
            className={`h-11 border-b border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0 z-50 relative group/toolbar px-3 
            ${isRawMode ? 'bg-transparent' : 'bg-white/50 dark:bg-slate-950/50'}`}
            style={{ WebkitAppRegion: 'no-drag' } as any}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-1.5 rounded-lg shadow-sm transition-all duration-300 ${workerReady ? (isRawMode ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 icon-glow') : 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500'}`}>
                    {isRawMode ? <Split size={14} /> : <Zap size={14} />}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate max-w-[300px] tracking-tight">
                        {workerReady ? (isRawMode ? 'Raw View' : (placeholderText.includes('Drag') ? placeholderText : placeholderText.replace('Processing...', '').replace('Drop a log file to start', 'No file loaded'))) : (fileName ? 'Processing...' : 'Empty')}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1 transition-opacity duration-200">
                {workerReady && !isRawMode && onArchiveSave && (
                    <button
                        onClick={onArchiveSave}
                        disabled={!isArchiveSaveEnabled}
                        className={`p-1.5 rounded-lg transition-colors ${isArchiveSaveEnabled
                            ? 'hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400'
                            : 'text-slate-600/30 dark:text-slate-600/30 cursor-not-allowed'
                            }`}
                        title={isArchiveSaveEnabled ? 'Save to Archive (30MB 이하)' : '로그 사이즈가 30MB를 초과하여 아카이브 저장 불가'}
                    >
                        <Archive size={14} />
                    </button>
                )}
                {workerReady && !isRawMode && onShowBookmarks && (
                    <button onClick={onShowBookmarks} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors" title="View Bookmarks">
                        <Bookmark size={14} fill={bookmarksSize > 0 ? "currentColor" : "none"} />
                    </button>
                )}
                {workerReady && !isRawMode && onCopy && (
                    <button onClick={onCopy} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Copy Filtered Logs">
                        <Copy size={14} />
                    </button>
                )}
                {workerReady && !isRawMode && onSave && (
                    <button onClick={onSave} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors" title="Save Filtered Logs">
                        <Download size={14} />
                    </button>
                )}

                {workerReady && !isRawMode && onAnalyzePerformance && (
                    <button
                        onClick={onAnalyzePerformance}
                        className={`p-1.5 rounded-lg transition-colors ${perfAnalysisResult || isAnalyzingPerformance ? 'bg-indigo-500/10 text-indigo-500' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                        title="Analyze Performance (Flame Map)"
                    >
                        <BarChart3 size={14} className={isAnalyzingPerformance ? 'animate-pulse' : ''} />
                    </button>
                )}
            </div>
        </div>
    );
};
