import React, { useEffect } from 'react';
import { SignState } from './types';
import { motion } from 'framer-motion';
import { Loader2, ShieldAlert } from 'lucide-react';
import NupkgWorker from './workers/nupkg.worker?worker';

interface Props {
    state: SignState;
    onComplete: (blob: Blob) => void;
    onError: (msg: string) => void;
}

const Step4_Repackage: React.FC<Props> = ({ state, onComplete, onError }) => {
    useEffect(() => {
        const run = async () => {
            if (!state.originalFile) {
                onError("No original package found.");
                return;
            }

            const worker = new NupkgWorker();
            const requestId = Date.now().toString();

            worker.onmessage = (e) => {
                const { type, payload, requestId: respId } = e.data;
                if (respId !== requestId) return;

                if (type === 'REPACKAGE_COMPLETE') {
                    onComplete(payload);
                    worker.terminate();
                } else if (type === 'ERROR') {
                    console.error(payload);
                    onError("Repackaging failed: " + payload);
                    worker.terminate();
                }
            };

            worker.postMessage({ 
                type: 'REPACKAGE', 
                payload: { 
                    originalZipData: state.originalFile, 
                    soFiles: state.soFiles 
                }, 
                requestId 
            });
        };

        run();
    }, []); // Run once on mount

    return (
        <div className="flex flex-col items-center py-10">
            <div className="relative mb-8">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-500 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={32} className="text-indigo-500 animate-spin" />
                </div>
            </div>

            <h2 className="text-2xl font-bold mb-2">Repackaging Nupkg...</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
                Swapping signed files and removing excluded architectures. This may take a moment.
            </p>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2 overflow-hidden max-w-sm">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "90%" }}
                    transition={{ duration: 10, ease: "easeOut" }}
                    className="h-full bg-indigo-500"
                />
            </div>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Processing Binaries</span>
            
            <div className="mt-12 flex items-center gap-2 text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-500/20 text-xs">
                <ShieldAlert size={14} />
                <span>Do not close this tab during process</span>
            </div>
        </div>
    );
};

export default Step4_Repackage;
