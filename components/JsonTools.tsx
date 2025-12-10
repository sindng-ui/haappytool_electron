import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import JsonFormatter from './JsonTools/JsonFormatter';
import JsonDiffViewer from './JsonTools/JsonDiffViewer';

const { Braces, GitCompare } = Lucide;

type Mode = 'FORMATTER' | 'DIFF';

const JsonTools: React.FC = () => {
    const [mode, setMode] = useState<Mode>('FORMATTER');

    return (
        <div className="flex h-full flex-col bg-slate-950">
            {/* System Header */}
            <div className="h-16 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3" style={{ backgroundColor: '#0f172a', borderBottom: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400"><Braces size={16} /></div>
                <span className="font-bold text-sm text-slate-300">JSON Tools</span>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-900/50 border-b border-slate-800 p-3 shrink-0 flex items-center justify-center gap-4">
                <div className="flex items-center bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                    <button
                        onClick={() => setMode('FORMATTER')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'FORMATTER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Braces size={16} /> Formatter & Validator
                    </button>
                    <button
                        onClick={() => setMode('DIFF')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'DIFF' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <GitCompare size={16} /> Diff Viewer
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden p-6 relative">
                {mode === 'FORMATTER' ? <JsonFormatter /> : <JsonDiffViewer />}
            </div>
        </div>
    );
};

export default JsonTools;