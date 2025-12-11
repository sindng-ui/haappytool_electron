import React from 'react';
import * as Lucide from 'lucide-react';
import { TpkStatus } from '../../hooks/useTpkExtractorLogic';

const { CheckCircle, AlertCircle, FileDown, ArrowRight } = Lucide;

interface TpkResultActionProps {
    status: TpkStatus;
    resultPath: string;
    onDownload: () => void;
    onReset: () => void;
}

export const TpkResultAction: React.FC<TpkResultActionProps> = ({ status, resultPath, onDownload, onReset }) => {
    return (
        <>
            {status === 'COMPLETED' && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center justify-between animate-fade-in-up">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/20 p-2 rounded-full text-green-500">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-green-400">Extraction Successful</p>
                            <p className="text-xs text-green-500/70 font-medium opacity-80">{resultPath}</p>
                        </div>
                    </div>
                    <button
                        onClick={onDownload}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg shadow-green-900/40 text-sm font-bold flex items-center gap-2 transition-all hover:scale-105"
                    >
                        <FileDown size={18} /> Save TPK
                    </button>
                </div>
            )}

            {status === 'ERROR' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-500" />
                    <span className="text-red-400 font-bold">Extraction Failed. Corrupted Header.</span>
                </div>
            )}

            <button
                onClick={onReset}
                className="mt-6 self-center px-5 py-2.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border border-slate-700 shadow-sm"
            >
                <ArrowRight size={14} /> Process another file
            </button>
        </>
    );
};
