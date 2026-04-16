import React, { useEffect } from 'react';
import { SignState } from './types';
import JSZip from 'jszip';
import { motion } from 'framer-motion';
import { Loader2, ShieldAlert } from 'lucide-react';

interface Props {
    state: SignState;
    onComplete: (blob: Blob) => void;
    onError: (msg: string) => void;
}

const Step4_Repackage: React.FC<Props> = ({ state, onComplete, onError }) => {
    useEffect(() => {
        const run = async () => {
            try {
                if (!state.originalZip || !state.originalFile) {
                    onError("No original package found.");
                    return;
                }

                const newZip = new JSZip();
                const entries = state.originalZip.files;
                
                // Identify folders to exclude (RID folders for unchecked SOs)
                const excludedFolders = new Set<string>();
                state.soFiles.forEach(so => {
                    if (!so.checked) {
                        // Path pattern: runtimes/[RID]/native/[something].so
                        // We extract the part up to the RID
                        const parts = so.path.split('/');
                        if (parts[0] === 'runtimes' && parts.length >= 3) {
                            const ridFolder = `runtimes/${parts[1]}/`;
                            excludedFolders.add(ridFolder);
                        } else {
                            // Fallback to just the file path if structure is weird
                            excludedFolders.add(so.path);
                        }
                    }
                });

                // SO File map for fast lookup
                const soMap = new Map<string, Blob>();
                state.soFiles.forEach(so => {
                    if (so.checked) {
                        soMap.set(so.path, so.signedBlob || so.originalBlob);
                    }
                });

                const totalEntries = Object.keys(entries).length;
                let processed = 0;

                for (const [path, entry] of Object.entries(entries)) {
                    // Check if this path should be excluded
                    let shouldExclude = false;
                    for (const excludedPath of excludedFolders) {
                        if (path.startsWith(excludedPath)) {
                            shouldExclude = true;
                            break;
                        }
                    }

                    if (shouldExclude) {
                        processed++;
                        continue;
                    }

                    if (soMap.has(path)) {
                        // Replace with signed/original blob
                        newZip.file(path, soMap.get(path)!);
                    } else {
                        // Copy as-is
                        const content = await entry.async('blob');
                        newZip.file(path, content);
                    }
                    
                    processed++;
                    // We don't have a progress report in this loop because JSZip.generateAsync has its own
                }

                // Generate new ZIP
                const finalBlob = await newZip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                }, (metadata) => {
                    // This is where real progress comes from
                    // But we've already done the extraction part which is usually faster
                });

                onComplete(finalBlob);
            } catch (err: any) {
                console.error(err);
                onError("Error during repackaging: " + err.message);
            }
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
