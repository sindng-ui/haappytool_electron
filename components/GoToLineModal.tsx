import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';

interface GoToLineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGo: (lineNum: number, pane: 'left' | 'right') => void;
    isDualView: boolean;
    leftTotalLines: number;
    rightTotalLines: number;
    leftFileName?: string;
    rightFileName?: string;
}

const GoToLineModal: React.FC<GoToLineModalProps> = ({
    isOpen, onClose, onGo, isDualView,
    leftTotalLines, rightTotalLines,
    leftFileName, rightFileName
}) => {
    const [lineInput, setLineInput] = useState('');
    const [selectedPane, setSelectedPane] = useState<'left' | 'right'>('left');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setLineInput('');
            // Default to left unless right was last active? For now default left.
            setSelectedPane('left');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleSubmit = () => {
        const line = parseInt(lineInput, 10);
        const maxLines = selectedPane === 'left' ? leftTotalLines : rightTotalLines;

        if (isNaN(line)) {
            // Shake or error? Just ignore for now
            return;
        }

        // Allow 1-based index input, clamp effectively happens in logic or we check here
        // Logic usually handles 0-based, but UI is 1-based.
        // Let's pass the 1-based number to parent, parent converts if needed, 
        // OR standard is jumpToGlobalLine takes 0-based index.
        // So we assume user types "100" -> they mean line 100.
        // We calculate index = 99.

        // Actually jumpToGlobalLine takes index.
        const targetIndex = Math.max(0, Math.min(maxLines - 1, line - 1));

        onGo(targetIndex, selectedPane);
        onClose();
    };

    if (!isOpen) return null;

    const maxLines = selectedPane === 'left' ? leftTotalLines : rightTotalLines;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 w-[400px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Go to Line</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <Lucide.X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {isDualView && (
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
                            <button
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${selectedPane === 'left' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setSelectedPane('left')}
                            >
                                Left Pane
                            </button>
                            <button
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${selectedPane === 'right' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setSelectedPane('right')}
                            >
                                Right Pane
                            </button>
                        </div>
                    )}

                    <div>
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="number"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-2xl font-mono text-center text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Line #"
                                value={lineInput}
                                onChange={e => setLineInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                min={1}
                                max={maxLines}
                            />
                        </div>
                        <div className="text-center mt-2 text-xs text-slate-400">
                            Range: 1 - {maxLines.toLocaleString()}
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={!lineInput}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Go
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GoToLineModal;
