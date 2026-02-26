import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { AnalysisResult } from '../../../utils/perfAnalysis';

export interface PerfSegmentDetailProps {
    useCompactDetail: boolean;
    selectedSegmentId: string | null;
    result: AnalysisResult | null;
    setSelectedSegmentId: (id: string | null) => void;
    onViewRawRange?: (originalStart: number, originalEnd: number, filteredIndex?: number) => void;
}

export const PerfSegmentDetail: React.FC<PerfSegmentDetailProps> = ({
    useCompactDetail,
    selectedSegmentId,
    result,
    setSelectedSegmentId,
    onViewRawRange,
}) => {
    return (
        <AnimatePresence>
            {!useCompactDetail && selectedSegmentId && result && (() => {
                const s = result.segments.find(sg => sg.id === selectedSegmentId);
                if (!s) return null;
                const isBottleneck = s.duration >= (result.perfThreshold || 1000);

                return (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="shrink-0 bg-slate-950/80 backdrop-blur-2xl border-t border-white/10 overflow-hidden relative"
                    >
                        <div className="p-3 md:p-4 flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
                            <div className="flex-1 min-w-0 flex items-center gap-4">
                                <div className="flex items-center gap-3 pr-4 border-r border-white/5 shrink-0 h-10">
                                    <div className={`p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-lg`}>
                                        <Lucide.Activity size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-black text-white tracking-tighter leading-none">{s.name}</span>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Segment Name</span>
                                    </div>
                                </div>

                                {/* 2. Execution Path */}
                                <div className="flex-1 flex flex-col gap-1 min-w-0 mx-2 md:mx-4">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Execution Context</span>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={s.id}
                                                initial={{ x: -10, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                exit={{ x: 10, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="flex-1 min-w-0 flex items-center gap-3"
                                            >
                                                <div className="flex-1 min-w-0 flex flex-col items-center">
                                                    <span className="text-[13px] font-black text-indigo-300 truncate tracking-tight text-center w-full" title={s.fileName}>{s.fileName || 'App.cs'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 truncate opacity-80 text-center w-full" title={s.functionName}>{s.functionName || 'OnEvent'}</span>
                                                </div>

                                                {((s.fileName !== s.endFileName) || (s.functionName !== s.endFunctionName)) && (
                                                    <>
                                                        <div className="p-1.5 bg-white/5 rounded-full shrink-0">
                                                            <Lucide.MoveRight size={12} className="text-slate-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col items-center">
                                                            <span className="text-[13px] font-black text-pink-300 truncate tracking-tight text-center w-full" title={s.endFileName}>{s.endFileName || 'App.cs'}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 truncate opacity-80 text-center w-full" title={s.endFunctionName}>{s.endFunctionName || 'OnEvent'}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Metrics & Actions */}
                            <div className="flex items-center gap-6 md:gap-10 shrink-0 border-l border-white/5 pl-6 h-12">
                                <div className="flex flex-col items-center">
                                    <span className={`text-[18px] font-black tracking-tighter leading-none ${isBottleneck ? 'text-rose-400' : 'text-emerald-400'}`}>{s.duration}ms</span>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Duration</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[18px] font-black text-slate-200 tracking-tighter leading-none">#{s.intervalIndex || '0'}</span>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Interval</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onViewRawRange?.(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1)}
                                        className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all hover:scale-105"
                                        title="View Raw Logs"
                                    >
                                        <Lucide.AlignLeft size={18} />
                                    </button>
                                    <button
                                        onClick={() => setSelectedSegmentId(null)}
                                        className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all"
                                        title="Close Detail"
                                    >
                                        <Lucide.X size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            })()}
        </AnimatePresence>
    );
};
