import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { LogRule } from '../../../types';

const { ShieldAlert, X } = Lucide;

interface BlockListSectionProps {
    currentConfig: LogRule;
    updateCurrentRule: (updates: Partial<LogRule>) => void;
    blockListCaseSensitive: boolean;
}

export const BlockListSection: React.FC<BlockListSectionProps> = ({ currentConfig, updateCurrentRule, blockListCaseSensitive }) => {
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-red-200 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-500 icon-glow" />
                    Block List
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-wider">
                    <input type="checkbox" checked={blockListCaseSensitive} onChange={(e) => updateCurrentRule({ blockListCaseSensitive: e.target.checked })} className="accent-indigo-500 rounded-sm w-3 h-3" />
                    <span>Case Sensitive</span>
                </label>
            </div>

            <div className="glass rounded-2xl p-4 border border-red-500/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                <div className="flex flex-wrap gap-2 relative z-10">
                    {currentConfig.excludes.map((exc, idx) => (
                        exc.trim() !== '' ? (
                            <div key={idx} className="flex items-center bg-red-500/10 text-red-200 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-500/20 shadow-sm transition-transform hover:scale-105">
                                <span>{exc}</span>
                                <IconButton
                                    variant="ghost"
                                    size="xs"
                                    icon={<X size={12} />}
                                    className="ml-2 text-red-400/50 hover:text-red-300 hover:bg-red-500/20 rounded-full"
                                    onClick={() => updateCurrentRule({ excludes: currentConfig.excludes.filter((_, i) => i !== idx) })}
                                />
                            </div>
                        ) : null
                    ))}

                    <input
                        className="bg-transparent text-sm text-slate-300 placeholder-slate-500/50 focus:text-red-100 focus:placeholder-red-400/50 transition-colors py-1.5 px-3 rounded-lg border border-transparent focus:border-red-500/30 focus:outline-none min-w-[120px] hover:bg-white/5"
                        placeholder="+ block word..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                updateCurrentRule({ excludes: [...currentConfig.excludes.filter(t => t !== ''), e.currentTarget.value.trim()] });
                                e.currentTarget.value = '';
                            } else if (e.key === 'Backspace' && !e.currentTarget.value) {
                                const activeExcludes = currentConfig.excludes.filter(t => t !== '');
                                if (activeExcludes.length > 0) {
                                    updateCurrentRule({ excludes: activeExcludes.slice(0, -1) });
                                }
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
