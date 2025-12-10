import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

const { ArrowRightLeft, GitCompare } = Lucide;

const JsonDiffViewer: React.FC = () => {
    const [leftJson, setLeftJson] = useState('');
    const [rightJson, setRightJson] = useState('');
    const [diffResult, setDiffResult] = useState<{ leftLines: string[], rightLines: string[] } | null>(null);
    const [diffError, setDiffError] = useState<string | null>(null);

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

    const getDiffCount = () => {
        if (!diffResult) return 0;
        return diffResult.leftLines.reduce((count, line, i) => {
            return line !== diffResult.rightLines[i] ? count + 1 : count;
        }, 0);
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Inputs */}
            <div className="h-1/3 flex gap-4 min-h-[150px]">
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Original JSON</label>
                    <textarea
                        className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-3 font-mono text-xs text-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                        value={leftJson}
                        onChange={(e) => setLeftJson(e.target.value)}
                        placeholder='{"a": 1}'
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
                        className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-3 font-mono text-xs text-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                        value={rightJson}
                        onChange={(e) => setRightJson(e.target.value)}
                        placeholder='{"a": 2}'
                    />
                </div>
            </div>

            {/* Diff Output */}
            <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comparison Result</span>
                        {diffResult && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDiffCount() > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {getDiffCount()} Lines Different
                            </span>
                        )}
                    </div>
                    {diffError && <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded">{diffError}</span>}
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar p-2">
                    {diffResult ? (
                        <div className="flex font-mono text-xs">
                            {/* Left Result */}
                            <div className="flex-1 border-r border-slate-800 pr-2">
                                {diffResult.leftLines.map((line, i) => {
                                    const rightLine = diffResult.rightLines[i];
                                    const isDiff = line !== rightLine;
                                    return (
                                        <div key={i} className={`flex px-2 ${isDiff ? 'bg-red-500/10' : ''}`}>
                                            <span className={`w-8 select-none text-right mr-4 ${isDiff ? 'text-red-400 font-bold' : 'text-slate-600'}`}>{i + 1}</span>
                                            <span className={`whitespace-pre-wrap break-all ${isDiff ? 'text-red-300' : 'text-slate-400'}`}>{line}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Right Result */}
                            <div className="flex-1 pl-2">
                                {diffResult.rightLines.map((line, i) => {
                                    const leftLine = diffResult.leftLines[i];
                                    const isDiff = line !== leftLine;
                                    return (
                                        <div key={i} className={`flex px-2 ${isDiff ? 'bg-green-500/10' : ''}`}>
                                            <span className={`w-8 select-none text-right mr-4 ${isDiff ? 'text-green-400 font-bold' : 'text-slate-600'}`}>{i + 1}</span>
                                            <span className={`whitespace-pre-wrap break-all ${isDiff ? 'text-green-300' : 'text-slate-400'}`}>{line}</span>
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
            </div>
        </div>
    );
};

export default JsonDiffViewer;
