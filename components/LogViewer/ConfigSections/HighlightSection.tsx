import React, { useState, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { LogRule } from '../../../types';

const { Highlighter, Palette, X } = Lucide;

const HIGHLIGHT_COLORS = [
    { label: 'Yellow', value: 'bg-yellow-200' },
    { label: 'Red', value: 'bg-red-200' },
    { label: 'Green', value: 'bg-green-200' },
    { label: 'Blue', value: 'bg-blue-200' },
    { label: 'Purple', value: 'bg-purple-200' },
    { label: 'Orange', value: 'bg-orange-200' },
    { label: 'Light Red', value: 'bg-red-100' },
];

interface HighlightSectionProps {
    currentConfig: LogRule;
    updateCurrentRule: (updates: Partial<LogRule>) => void;
    colorHighlightsCaseSensitive: boolean;
}

export const HighlightSection: React.FC<HighlightSectionProps> = ({ currentConfig, updateCurrentRule, colorHighlightsCaseSensitive }) => {
    const [newHighlightWord, setNewHighlightWord] = useState('');
    const [newHighlightColor, setNewHighlightColor] = useState('');
    const highlightInputRef = useRef<HTMLInputElement>(null);

    const isHexColor = (color: string) => /^#[0-9A-F]{6}$/i.test(color);

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-pink-200 flex items-center gap-2">
                    <Highlighter size={16} className="text-pink-400 icon-glow" />
                    Color Highlights
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-wider">
                    <input type="checkbox" checked={colorHighlightsCaseSensitive} onChange={(e) => updateCurrentRule({ colorHighlightsCaseSensitive: e.target.checked })} className="accent-indigo-500 rounded-sm w-3 h-3" />
                    <span>Case Sensitive</span>
                </label>
            </div>

            <div className="glass rounded-2xl p-4 border border-pink-500/10">
                <div className="flex flex-col gap-3 mb-4">
                    {/* Color Picker */}
                    <div className="flex gap-2 flex-wrap">
                        {HIGHLIGHT_COLORS.map(c => (
                            <button
                                key={c.value}
                                onClick={() => { setNewHighlightColor(c.value); highlightInputRef.current?.focus(); }}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${c.value} ${newHighlightColor === c.value ? 'border-white scale-110 shadow-lg ring-2 ring-indigo-500/50' : 'border-transparent opacity-80'}`}
                                title={c.label}
                            />
                        ))}
                        <label className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center overflow-hidden bg-slate-800 relative ${isHexColor(newHighlightColor) ? 'border-white scale-110 shadow-lg ring-2 ring-indigo-500/50' : 'border-slate-600 opacity-80'}`} title="Custom Color">
                            {isHexColor(newHighlightColor) && (<div className="absolute inset-0" style={{ backgroundColor: newHighlightColor }}></div>)}
                            <Palette size={12} className={`relative z-10 ${isHexColor(newHighlightColor) ? 'text-white drop-shadow-md' : 'text-slate-400'}`} />
                            <input
                                type="color"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                value={isHexColor(newHighlightColor) ? newHighlightColor : '#000000'}
                                onChange={(e) => { setNewHighlightColor(e.target.value); highlightInputRef.current?.focus(); }}
                            />
                        </label>
                    </div>

                    {/* Input */}
                    <input
                        ref={highlightInputRef}
                        className="w-full bg-slate-900/50 text-sm text-slate-200 placeholder-slate-500 focus:bg-slate-800 focus:outline-none py-2 px-3 rounded-xl border border-slate-700/50 focus:border-pink-500/50 transition-colors"
                        placeholder="Type word to highlight..."
                        value={newHighlightWord}
                        onChange={(e) => setNewHighlightWord(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newHighlightWord.trim()) {
                                const h = { id: Math.random().toString(36).substring(7), keyword: newHighlightWord.trim(), color: newHighlightColor || HIGHLIGHT_COLORS[0].value };
                                updateCurrentRule({ highlights: [...(currentConfig.highlights || []), h] });
                                setNewHighlightWord('');
                            }
                        }}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {(currentConfig.highlights || []).map((h, i) => {
                        const isHex = isHexColor(h.color);
                        return (
                            <div
                                key={h.id}
                                style={isHex ? { backgroundColor: h.color } : undefined}
                                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold text-slate-900 border border-black/5 shadow-sm transition-transform hover:scale-105 ${!isHex ? h.color : ''}`}
                            >
                                {h.keyword}
                                {i < 5 && <span className="text-[9px] opacity-50 ml-1 font-mono">(#{i + 1})</span>}
                                <IconButton
                                    variant="ghost"
                                    size="xs"
                                    icon={<X size={12} />}
                                    className="text-slate-800/50 hover:text-black hover:bg-black/10 rounded-full"
                                    onClick={() => updateCurrentRule({ highlights: (currentConfig.highlights || []).filter(item => item.id !== h.id) })}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
