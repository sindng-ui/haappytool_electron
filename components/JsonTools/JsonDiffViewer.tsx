import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

const { ArrowRightLeft, GitCompare } = Lucide;

const JsonDiffViewer: React.FC = () => {
    const [leftJson, setLeftJson] = useState('');
    const [rightJson, setRightJson] = useState('');
    const [diffResult, setDiffResult] = useState<{ leftLines: string[], rightLines: string[] } | null>(null);
    const [diffError, setDiffError] = useState<string | null>(null);

    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null); // For height measurement if needed
    const minimapRef = useRef<HTMLCanvasElement>(null);

    const handleCompare = () => {
        setDiffError(null);
        setDiffResult(null);

        try {
            let leftObj, rightObj;
            try { leftObj = JSON.parse(leftJson); } catch (e) { throw new Error("Left JSON is invalid"); }
            try { rightObj = JSON.parse(rightJson); } catch (e) { throw new Error("Right JSON is invalid"); }

            const leftStr = JSON.stringify(leftObj, null, 2);
            const rightStr = JSON.stringify(rightObj, null, 2);

            const leftLines = leftStr.split('\n');
            const rightLines = rightStr.split('\n');

            setDiffResult({ leftLines, rightLines });

        } catch (e: any) {
            setDiffError(e.message);
        }
    };

    const getDiffCount = useCallback(() => {
        if (!diffResult) return 0;
        const max = Math.max(diffResult.leftLines.length, diffResult.rightLines.length);
        let count = 0;
        for (let i = 0; i < max; i++) {
            const l = diffResult.leftLines[i] || '';
            const r = diffResult.rightLines[i] || '';
            if (l !== r) count++;
        }
        return count;
    }, [diffResult]);

    // Draw Minimap
    useEffect(() => {
        const canvas = minimapRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !diffResult) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to match container height (visual height)
        const { clientHeight } = container;
        canvas.height = clientHeight;
        canvas.width = 30; // Fixed width

        const maxLines = Math.max(diffResult.leftLines.length, diffResult.rightLines.length);
        if (maxLines === 0) return;

        const lineHeight = canvas.height / maxLines;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        ctx.fillStyle = '#0f172a'; // slate-950
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw diffs
        for (let i = 0; i < maxLines; i++) {
            const l = diffResult.leftLines[i] || '';
            const r = diffResult.rightLines[i] || '';

            if (l !== r) {
                // Draw a marker
                ctx.fillStyle = '#fab005'; // Orange-ish
                // Enforce a minimum height of 2px for visibility
                const h = Math.max(lineHeight, 2);
                const y = i * lineHeight;
                ctx.fillRect(4, y, canvas.width - 8, h);
            }
        }

    }, [diffResult]); // Re-draw when diff changes. Ideally also on resize.

    const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = minimapRef.current;
        if (!canvas || !diffResult || !virtuosoRef.current) return;

        const rect = canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const ratio = y / canvas.height;

        const max = Math.max(diffResult.leftLines.length, diffResult.rightLines.length);
        virtuosoRef.current.scrollToIndex({
            index: Math.floor(ratio * max),
            align: 'center',
            behavior: 'auto'
        });
    };

    const maxLines = diffResult ? Math.max(diffResult.leftLines.length, diffResult.rightLines.length) : 0;

    const Row = (index: number) => {
        if (!diffResult) return null;
        const lineLeft = diffResult.leftLines[index] || '';
        const lineRight = diffResult.rightLines[index] || '';
        const isDiff = lineLeft !== lineRight;

        return (
            <div className="flex font-mono text-xs w-full">
                {/* Left Side */}
                <div className={`flex-1 flex px-2 border-r border-slate-200 dark:border-white/5 transition-colors py-0.5 ${isDiff ? 'bg-red-500/10 dark:bg-red-500/20' : 'hover:bg-indigo-50/50 dark:hover:bg-white/5'}`}>
                    <span className={`w-8 select-none text-right mr-4 shrink-0 ${isDiff ? 'text-red-500 dark:text-red-400 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>{index + 1}</span>
                    <span className={`whitespace-pre-wrap break-all ${isDiff ? 'text-red-600 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}>
                        {lineLeft || <span className="opacity-30 italic">empty</span>}
                    </span>
                </div>

                {/* Right Side */}
                <div className={`flex-1 flex px-2 pl-4 transition-colors py-0.5 ${isDiff ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 'hover:bg-indigo-50/50 dark:hover:bg-white/5'}`}>
                    <span className={`w-8 select-none text-right mr-4 shrink-0 ${isDiff ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>{index + 1}</span>
                    <span className={`whitespace-pre-wrap break-all ${isDiff ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                        {lineRight || <span className="opacity-30 italic">empty</span>}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Inputs */}
            <div className="h-1/3 flex gap-4 min-h-[150px] shrink-0">
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Original JSON</label>
                    <textarea
                        className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 p-3 font-mono text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar shadow-sm focus:shadow-md transition-shadow placeholder-slate-400 dark:placeholder-slate-600"
                        value={leftJson}
                        onChange={(e) => setLeftJson(e.target.value)}
                        placeholder='{"a": 1}'
                        spellCheck={false}
                    />
                </div>
                <div className="flex items-center justify-center">
                    <button
                        onClick={handleCompare}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 active:scale-95 border-4 border-slate-100 dark:border-slate-800"
                        title="Compare"
                    >
                        <ArrowRightLeft size={24} />
                    </button>
                </div>
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Modified JSON</label>
                    <textarea
                        className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 p-3 font-mono text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar shadow-sm focus:shadow-md transition-shadow placeholder-slate-400 dark:placeholder-slate-600"
                        value={rightJson}
                        onChange={(e) => setRightJson(e.target.value)}
                        placeholder='{"a": 2}'
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Diff Output */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col shadow-sm">
                <div className="bg-slate-100 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-white/5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comparison Result</span>
                        {diffResult && (
                            <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${getDiffCount() > 0 ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                                {getDiffCount()} Lines Different
                            </span>
                        )}
                    </div>
                    {diffError && <span className="text-xs text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-500/10 px-2 py-1 rounded">{diffError}</span>}
                </div>

                <div className="flex-1 min-h-0 flex relative" ref={containerRef}>
                    {/* Main Scroll Area */}
                    <div className="flex-1 h-full bg-slate-50 dark:bg-black/20">
                        {diffResult ? (
                            <Virtuoso
                                ref={virtuosoRef}
                                style={{ height: '100%', width: '100%' }}
                                totalCount={maxLines}
                                itemContent={Row}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600 flex-col gap-3">
                                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5">
                                    <GitCompare size={32} className="opacity-50" />
                                </div>
                                <p className="font-medium opacity-70">Enter JSON logs above to compare</p>
                            </div>
                        )}
                    </div>

                    {/* Minimap Sidebar (Only visible if diff result exists) */}
                    {diffResult && (
                        <div className="w-[40px] border-l border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-950 flex flex-col items-center py-2 shrink-0 z-10">
                            <canvas
                                ref={minimapRef}
                                className="w-[30px] h-full cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                                onClick={handleMinimapClick}
                                title="Click to minimize map location"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JsonDiffViewer;
