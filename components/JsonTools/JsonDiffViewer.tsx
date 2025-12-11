import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Lucide from 'lucide-react';

const { ArrowRightLeft, GitCompare } = Lucide;

const JsonDiffViewer: React.FC = () => {
    const [leftJson, setLeftJson] = useState('');
    const [rightJson, setRightJson] = useState('');
    const [diffResult, setDiffResult] = useState<{ leftLines: string[], rightLines: string[] } | null>(null);
    const [diffError, setDiffError] = useState<string | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
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
        const container = scrollContainerRef.current;
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
                // Color based on type? But it's a side-by-side diff.
                // Let's use a bright yellow/orange to indicate "Change Here"
                ctx.fillStyle = '#fab005'; // Orange-ish
                // Enforce a minimum height of 2px for visibility
                const h = Math.max(lineHeight, 2);
                const y = i * lineHeight;

                // If it's pure addition (no left) maybe green, deletion (no right) red?
                // But structure usually preserves strict lines in this naive diff.
                // Let's stick to simple "Difference" color.
                ctx.fillRect(4, y, canvas.width - 8, h);
            }
        }

    }, [diffResult]); // Re-draw when diff changes. Ideally also on resize.

    const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = minimapRef.current;
        const container = scrollContainerRef.current;
        if (!canvas || !container || !diffResult) return;

        const rect = canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const ratio = y / canvas.height;

        // Scroll logic: ratio * totalScrollHeight
        // However, we want to center the view on that line if possible? 
        // Simple scroll to top position:
        container.scrollTo({
            top: ratio * container.scrollHeight,
            behavior: 'auto'
        });
    };

    const maxLines = diffResult ? Math.max(diffResult.leftLines.length, diffResult.rightLines.length) : 0;

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Inputs */}
            <div className="h-1/3 flex gap-4 min-h-[150px]">
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Original JSON</label>
                    <textarea
                        className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-3 font-mono text-xs text-slate-400 focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                        value={leftJson}
                        onChange={(e) => setLeftJson(e.target.value)}
                        placeholder='{"a": 1}'
                        spellCheck={false}
                    />
                </div>
                <div className="flex items-center justify-center">
                    <button
                        onClick={handleCompare}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-900/50 transition-transform hover:scale-110 active:scale-95"
                        title="Compare"
                    >
                        <ArrowRightLeft size={24} />
                    </button>
                </div>
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Modified JSON</label>
                    <textarea
                        className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-3 font-mono text-xs text-slate-400 focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                        value={rightJson}
                        onChange={(e) => setRightJson(e.target.value)}
                        placeholder='{"a": 2}'
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Diff Output */}
            <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comparison Result</span>
                        {diffResult && (
                            <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${getDiffCount() > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {getDiffCount()} Lines Different
                            </span>
                        )}
                    </div>
                    {diffError && <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded">{diffError}</span>}
                </div>

                <div className="flex-1 min-h-0 flex relative">
                    {/* Main Scroll Area */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar p-2 scroll-smooth">
                        {diffResult ? (
                            <div className="flex font-mono text-xs min-h-full">
                                {/* Left Result */}
                                <div className="flex-1 border-r border-slate-800 pr-2">
                                    {Array.from({ length: maxLines }).map((_, i) => {
                                        const line = diffResult.leftLines[i] || '';
                                        const rightLine = diffResult.rightLines[i] || ''; // Safe access
                                        const isDiff = line !== rightLine;
                                        return (
                                            <div key={i} className={`flex px-2 hover:bg-white/5 transition-colors ${isDiff ? 'bg-red-500/10' : ''}`}>
                                                <span className={`w-8 select-none text-right mr-4 shrink-0 ${isDiff ? 'text-red-400 font-bold' : 'text-slate-600'}`}>{i + 1}</span>
                                                <span className={`whitespace-pre-wrap break-all ${isDiff ? 'text-red-300' : 'text-slate-400'}`}>{line || <span className="opacity-20 italic">empty</span>}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Right Result */}
                                <div className="flex-1 pl-2">
                                    {Array.from({ length: maxLines }).map((_, i) => {
                                        const line = diffResult.rightLines[i] || '';
                                        const leftLine = diffResult.leftLines[i] || '';
                                        const isDiff = line !== leftLine;
                                        return (
                                            <div key={i} className={`flex px-2 hover:bg-white/5 transition-colors ${isDiff ? 'bg-green-500/10' : ''}`}>
                                                <span className={`w-8 select-none text-right mr-4 shrink-0 ${isDiff ? 'text-green-400 font-bold' : 'text-slate-600'}`}>{i + 1}</span>
                                                <span className={`whitespace-pre-wrap break-all ${isDiff ? 'text-green-300' : 'text-slate-400'}`}>{line || <span className="opacity-20 italic">empty</span>}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-700 flex-col gap-2">
                                <GitCompare size={32} opacity={0.5} />
                                <p>Enter JSON logs and click compare</p>
                            </div>
                        )}
                    </div>

                    {/* Minimap Sidebar (Only visible if diff result exists) */}
                    {diffResult && (
                        <div className="w-[40px] border-l border-slate-800 bg-slate-950 flex flex-col items-center py-2 shrink-0 z-10">
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
