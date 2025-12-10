import React from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse } from '../../types';

const { Clock, Activity } = Lucide;

interface ResponseViewerProps {
    response: PerfResponse | null;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Response</span>
                {response && (
                    <div className="flex items-center gap-4 text-xs font-mono">
                        <span className={response.status >= 200 && response.status < 300 ? "text-green-400" : "text-red-400"}>
                            Status: {response.status} {response.statusText}
                        </span>
                        <span className="text-slate-400 flex items-center gap-1">
                            <Clock size={12} /> {response.timeTaken}ms
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {response ? (
                    <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all">
                        {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
                    </pre>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                        <Activity size={32} />
                        <p className="text-sm font-medium">Ready to send</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResponseViewer;
