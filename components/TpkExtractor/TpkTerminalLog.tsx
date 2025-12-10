import React from 'react';
import * as Lucide from 'lucide-react';

const { Cog } = Lucide;

interface TpkTerminalLogProps {
    logs: string[];
    isProcessing: boolean;
}

export const TpkTerminalLog: React.FC<TpkTerminalLogProps> = ({ logs, isProcessing }) => {
    return (
        <div className="bg-black rounded-xl p-6 mb-6 font-mono text-xs flex-1 overflow-auto shadow-inner relative border border-slate-800 lg:min-h-[200px]">
            <div className="absolute top-3 right-4 flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
            </div>
            <div className="space-y-2 mt-2">
                {logs.map((l, i) => (
                    <div key={i} className="text-emerald-500 opacity-0 animate-fade-in" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'forwards' }}>
                        <span className="text-slate-600 mr-2">$</span>
                        {l}
                    </div>
                ))}
                {isProcessing && (
                    <div className="text-orange-500 animate-pulse mt-2 flex items-center gap-2">
                        <Cog size={12} className="animate-spin" /> Processing...
                    </div>
                )}
            </div>
        </div>
    );
};
