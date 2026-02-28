import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, RefreshCw, AlertTriangle, Play } from 'lucide-react';
import { useLogContext } from './LogContext';

export const SpamAnalyzerModal: React.FC = () => {
    const {
        isSpamAnalyzerOpen,
        setIsSpamAnalyzerOpen,
        isAnalyzingSpam,
        spamResultsLeft,
        requestSpamAnalysisLeft,
        leftFilteredCount,
        jumpToGlobalLine,
        findText
    } = useLogContext();

    // The user requested NO background processing until UI is entered.
    // So we map the triggering to when the modal opens.
    useEffect(() => {
        if (isSpamAnalyzerOpen && spamResultsLeft.length === 0 && !isAnalyzingSpam) {
            // Optional auto-start on first open: requestSpamAnalysisLeft();
            // Let's make it manual to give full control, or auto-run since opening implies intent to analyze.
            // Let's auto-run when opened if there are no results yet.
            requestSpamAnalysisLeft();
        }
    }, [isSpamAnalyzerOpen, spamResultsLeft.length, isAnalyzingSpam, requestSpamAnalysisLeft]);

    if (!isSpamAnalyzerOpen) return null;

    const totalSpamCount = spamResultsLeft.reduce((sum, item) => sum + item.count, 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col w-full max-w-4xl h-[85vh] bg-[#0f172a] rounded-2xl shadow-2xl overflow-hidden border border-indigo-500/30"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <Activity className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-200 leading-tight">Spam Analyzer</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Top repeated patterns in {leftFilteredCount.toLocaleString()} current logs</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => requestSpamAnalysisLeft()}
                                disabled={isAnalyzingSpam || leftFilteredCount === 0}
                                className="px-3 py-1.5 rounded bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${isAnalyzingSpam ? 'animate-spin' : ''}`} />
                                {isAnalyzingSpam ? 'Analyzing...' : 'Re-Analyze'}
                            </button>
                            <button
                                onClick={() => setIsSpamAnalyzerOpen(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {isAnalyzingSpam ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Activity className="w-12 h-12 text-indigo-500/50 mb-4 animate-pulse" />
                                <p className="text-lg font-medium text-slate-400">Analyzing patterns...</p>
                                <p className="text-sm mt-2">Grouping millions of lines, hang tight!</p>
                            </div>
                        ) : spamResultsLeft.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <AlertTriangle className="w-12 h-12 text-slate-600 mb-4" />
                                <p className="text-lg font-medium text-slate-400">No repeated logs found</p>
                                <p className="text-sm mt-2 max-w-md text-center">There isn't enough repetitive data, or the current filter hides them.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {spamResultsLeft.map((item, idx) => {
                                    const percentage = totalSpamCount > 0 ? ((item.count / leftFilteredCount) * 100).toFixed(1) : '0.0';
                                    const barWidth = totalSpamCount > 0 ? ((item.count / spamResultsLeft[0].count) * 100) : 0;

                                    return (
                                        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/30 transition-colors group">
                                            <div className="p-4 flex gap-4">
                                                {/* Rank & Count */}
                                                <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-slate-800 pr-4">
                                                    <span className="text-xs font-bold text-slate-600 mb-1">#{idx + 1}</span>
                                                    <span className="text-lg font-black text-rose-400">{item.count.toLocaleString()}</span>
                                                    <span className="text-[10px] text-slate-500 mt-1">{percentage}%</span>
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-emerald-400 truncate max-w-[40%]">
                                                            {item.fileName}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-indigo-900/40 text-xs font-mono text-indigo-300 truncate max-w-[50%]">
                                                            {item.functionName}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-mono text-slate-300 truncate opacity-80" title={item.lineContent}>
                                                        {item.lineContent}
                                                    </p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setIsSpamAnalyzerOpen(false);
                                                            // Search for the signature in the logs.
                                                            // If we have filename and functionname, we can use them to find the logs.
                                                            const searchTarget = item.fileName !== 'Unknown File' ? `${item.fileName}` : item.lineContent.substring(0, 30);
                                                            findText(searchTarget, 'next', 'left', undefined, false, false);
                                                        }}
                                                        className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
                                                        title="Find occurrences in logs"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Visual Bar Indicator */}
                                            <div className="w-full h-1 bg-slate-950">
                                                <div
                                                    className="h-full bg-gradient-to-r from-rose-500 to-indigo-500"
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
