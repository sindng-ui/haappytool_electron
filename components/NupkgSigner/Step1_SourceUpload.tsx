import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Upload, File as FileIcon } from 'lucide-react';

interface Step1Props {
    onFileSelect: (file: File) => void;
    isProcessing: boolean;
}

const Step1_SourceUpload: React.FC<Step1Props> = ({ onFileSelect, isProcessing }) => {
    const [isDragging, setIsDragging] = useState(false);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.nupkg') || file.name.endsWith('.zip'))) {
            onFileSelect(file);
        }
    }, [onFileSelect]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelect(file);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Upload Original Nupkg</h2>
                <p className="text-slate-500 dark:text-slate-400">Select the NuGet package file you want to sign</p>
            </div>

            <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`relative group w-full aspect-video md:aspect-[16/6] rounded-3xl border-3 border-dashed transition-all duration-500 flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden ${
                    isDragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 scale-[1.02]' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600'
                } ${isProcessing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                onClick={() => document.getElementById('nupkg-input')?.click()}
            >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                    <Package size={120} />
                </div>
                
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        <span className="text-indigo-500 font-bold animate-pulse">Analyzing Package...</span>
                    </div>
                ) : (
                    <>
                        <motion.div 
                            initial={{ scale: 1 }}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="p-5 bg-indigo-500 rounded-2xl text-white shadow-xl shadow-indigo-500/30 mb-6"
                        >
                            <Upload size={32} />
                        </motion.div>
                        
                        <div className="text-center z-10">
                            <h3 className="text-xl font-bold mb-1">Drag & Drop .nupkg file here</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-balance">or click to browse your computer</p>
                            
                            <div className="flex flex-wrap justify-center gap-4">
                                <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                                    <FileIcon size={14} className="text-indigo-500" /> .nupkg
                                </span>
                                <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                                    <FileIcon size={14} className="text-indigo-500" /> runtimes/**/*.so
                                </span>
                            </div>
                        </div>
                    </>
                )}

                <input 
                    id="nupkg-input"
                    type="file" 
                    className="hidden" 
                    accept=".nupkg,.zip"
                    onChange={handleFileInput}
                />
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full opacity-60">
                {[
                    { title: "Smart Extraction", desc: "Automatically finds all .so files in runtime folders" },
                    { title: "Selective Signing", desc: "Choose which libraries to sign or exclude" },
                    { title: "Safe Repackaging", desc: "Preserves original structure and metadata" }
                ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                        <h4 className="text-sm font-bold mb-1 italic">Step {i+1}</h4>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Step1_SourceUpload;
