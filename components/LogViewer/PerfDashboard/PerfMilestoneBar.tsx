import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';

interface Milestone {
    time: number;
    label: string;
    color: string;
}

interface PerfMilestoneBarProps {
    milestones: Milestone[];
    viewStart: number;
    viewDuration: number;
    width: number;
    onMilestoneClick: (time: number) => void;
}

export const PerfMilestoneBar: React.FC<PerfMilestoneBarProps> = ({
    milestones,
    viewStart,
    viewDuration,
    width,
    onMilestoneClick
}) => {
    const visibleMilestones = useMemo(() => {
        const viewEnd = viewStart + viewDuration;
        return milestones.filter(m => m.time >= viewStart && m.time <= viewEnd);
    }, [milestones, viewStart, viewDuration]);

    if (milestones.length === 0) return null;

    return (
        <div className="absolute top-[-8px] left-0 right-0 h-4 pointer-events-none z-[120] overflow-visible">
            <AnimatePresence>
                {visibleMilestones.map((m, idx) => {
                    const left = ((m.time - viewStart) / viewDuration) * 100;

                    return (
                        <motion.div
                            key={`${m.time}-${m.label}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute bottom-0 flex flex-col items-center group pointer-events-auto"
                            style={{ left: `${left}%` }}
                        >
                            {/* Marker Flag */}
                            <div 
                                className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] drop-shadow-sm" 
                                style={{ borderTopColor: m.color }}
                            />
                            
                            {/* Tooltip on Hover - Now showing BELOW the flag to prevent clipping at the top */}
                            <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="bg-slate-900 border border-white/10 px-2.5 py-1.5 rounded-lg shadow-2xl flex flex-col gap-0.5 min-w-[120px]">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                                        <span className="text-[10px] font-black text-white whitespace-nowrap uppercase tracking-wider">
                                            Milestone
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-300 leading-tight">
                                        {m.label}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-500 font-bold">
                                        {m.time.toLocaleString()} ms
                                    </span>
                                </div>
                            </div>

                            {/* Glow effect on hover */}
                            <div 
                                className="absolute top-[8px] w-[2px] h-[400px] opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-b"
                                style={{ 
                                    backgroundImage: `linear-gradient(to bottom, ${m.color}, transparent)`
                                }}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
