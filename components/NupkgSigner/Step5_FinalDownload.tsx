import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, CheckCircle, RefreshCcw, FileArchive, ShieldCheck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Props {
    originalName: string;
    blob: Blob;
    onReset: () => void;
    onSuccess: () => void;
}

const Step5_FinalDownload: React.FC<Props> = ({ originalName, blob, onReset, onSuccess }) => {
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const targetName = originalName.replace(/\.nupkg$/, '') + '_signed.nupkg';

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Using standard electronAPI exposed via preload.cjs
            const result = await (window as any).electronAPI.saveBinaryFile(uint8Array, targetName);

            if (result.status === 'success') {
                setIsSaved(true);
                onSuccess(); // 🐧 형님 가라사대: 성공했다고 상단바에 알려라!
                addToast("File saved successfully!", "success");
            } else if (result.status === 'canceled') {
                addToast("Save canceled", "warning");
            } else {
                addToast(result.error || "Failed to save file", "error");
            }
        } catch (err: any) {
            console.error(err);
            addToast("Error saving file: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center py-6">
            {/* Success Animation */}
            <div className="relative mb-8 pt-10">
                <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 relative z-10"
                >
                    <CheckCircle size={64} />
                </motion.div>
                
                {/* Success Particles */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0, x: 0, y: 0 }}
                        animate={{ 
                            scale: [0, 1, 0], 
                            x: Math.cos(i * 60 * Math.PI / 180) * 80,
                            y: Math.sin(i * 60 * Math.PI / 180) * 80 
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                        className="absolute top-1/2 left-1/2 w-3 h-3 bg-emerald-400 rounded-full"
                    />
                ))}
            </div>

            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent mb-2">Ready to Download!</h2>
                <p className="text-slate-500 dark:text-slate-400">Your signed package is prepared and verified.</p>
            </div>

            {/* File Info Card */}
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl mb-10 flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                    <FileArchive size={32} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate mb-1">{targetName}</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-md font-bold uppercase tracking-wider">Signed</span>
                        <span className="text-xs text-slate-400">{(blob.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                </div>
                <div className="text-emerald-500">
                    <ShieldCheck size={24} />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-white transition-all shadow-xl ${
                        isSaved 
                            ? 'bg-emerald-500 shadow-emerald-500/30' 
                            : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]'
                    } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isSaving ? (
                        <RefreshCcw size={20} className="animate-spin" />
                    ) : (
                        <Download size={20} />
                    )}
                    <span>{isSaved ? 'Save Again' : 'Download Signed Nupkg'}</span>
                </button>

                <button 
                    onClick={onReset}
                    className="px-8 py-4 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
                >
                    Start New Scan
                </button>
            </div>
            
            {isSaved && (
                <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-sm text-emerald-500 font-medium flex items-center gap-2"
                >
                    <CheckCircle size={14} /> File saved successfully to your disk!
                </motion.p>
            )}
        </div>
    );
};

export default Step5_FinalDownload;
