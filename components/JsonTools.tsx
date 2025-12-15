import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import JsonFormatter from './JsonTools/JsonFormatter';
import JsonDiffViewer from './JsonTools/JsonDiffViewer';

const { Braces, GitCompare } = Lucide;

type Mode = 'FORMATTER' | 'DIFF';

const JsonTools: React.FC = () => {
    const [mode, setMode] = useState<Mode>('FORMATTER');

    return (
        <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 border-b border-indigo-500/30 bg-slate-900">
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400"><Braces size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200">JSON Tools</span>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 p-3 shrink-0 flex items-center justify-center gap-4">
                <div className="flex items-center bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner">
                    <button
                        onClick={() => setMode('FORMATTER')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'FORMATTER' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Braces size={16} /> Formatter & Validator
                    </button>
                    <button
                        onClick={() => setMode('DIFF')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'DIFF' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <GitCompare size={16} /> Diff Viewer
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden p-6 relative bg-slate-50 dark:bg-slate-900/50">
                <div className={mode === 'FORMATTER' ? 'h-full w-full' : 'hidden'}>
                    <JsonFormatter />
                </div>
                <div className={mode === 'DIFF' ? 'h-full w-full' : 'hidden'}>
                    <JsonDiffViewer />
                </div>
            </div>
        </div>
    );
};

export default JsonTools;