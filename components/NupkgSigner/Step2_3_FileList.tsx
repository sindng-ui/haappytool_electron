import React, { useState } from 'react';
import { SoFileItem } from './types';
import { Download, Upload, Trash2, ArrowLeft, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    soFiles: SoFileItem[];
    onToggleChecked: (path: string) => void;
    onSignedUpload: (path: string, file: File) => void;
    onProcess: () => void;
    onBack: () => void;
}

const Step2_3_FileList: React.FC<Props> = ({ soFiles, onToggleChecked, onSignedUpload, onProcess, onBack }) => {
    const checkedCount = soFiles.filter(f => f.checked).length;
    const signedCount = soFiles.filter(f => f.checked && f.signedBlob).length;

    const downloadBlob = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-500 transition-colors"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Upload</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                        <span className="text-slate-500 mr-2">Status:</span>
                        <span className="font-bold text-indigo-500">{signedCount} / {checkedCount} Signed</span>
                    </div>
                    <button 
                        onClick={onProcess}
                        disabled={checkedCount === 0}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${
                            checkedCount > 0 
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95' 
                                : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <Zap size={18} />
                        <span>Build Nupkg</span>
                    </button>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-3 bg-slate-100 dark:bg-slate-900 rounded-t-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500">
                <div className="w-6"></div>
                <div>Runtime .so Path</div>
                <div className="w-32 text-center">Original</div>
                <div className="w-48 text-center">Signed Version</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto border-x border-b border-slate-200 dark:border-slate-800 rounded-b-2xl bg-white dark:bg-slate-950/50">
                {soFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <AlertCircle size={48} className="mb-4 opacity-20" />
                        <p>No .so files detected in this package.</p>
                    </div>
                ) : (
                    soFiles.map((file) => (
                        <div 
                            key={file.path}
                            className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 items-center transition-colors ${
                                !file.checked ? 'bg-slate-50/50 dark:bg-slate-900/30 opacity-60' : 'hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5'
                            }`}
                        >
                            {/* Checkbox */}
                            <button 
                                onClick={() => onToggleChecked(file.path)}
                                className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${
                                    file.checked 
                                        ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm' 
                                        : 'border-slate-300 dark:border-slate-700'
                                }`}
                            >
                                {file.checked && <span className="text-[10px] font-bold">✓</span>}
                            </button>

                            {/* Path */}
                            <div className="flex flex-col min-w-0">
                                <span className={`text-sm font-medium truncate ${file.checked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                                    {file.basename}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate font-mono">
                                    {file.path}
                                </span>
                                {!file.checked && (
                                    <span className="text-[10px] text-red-400 font-bold mt-1 tracking-tight uppercase">
                                        Excluding file & architecture folder
                                    </span>
                                )}
                            </div>

                            {/* Download Original */}
                            <div className="w-32 flex justify-center">
                                <button 
                                    onClick={() => downloadBlob(file.originalBlob, file.basename)}
                                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    title="Download Original"
                                >
                                    <Download size={16} />
                                </button>
                            </div>

                            {/* Signed Upload */}
                            <div className="w-48 flex items-center justify-center">
                                {file.checked ? (
                                    file.signedBlob ? (
                                        <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 w-full group overflow-hidden relative">
                                            <CheckCircle2 size={14} className="flex-shrink-0" />
                                            <span className="text-xs font-bold truncate flex-1 leading-none">{file.signedBlob instanceof File ? (file.signedBlob as File).name : 'Signed SO'}</span>
                                            <button 
                                                onClick={() => onSignedUpload(file.path, undefined as any)}
                                                className="absolute inset-0 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="w-full cursor-pointer group">
                                            <div className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/5 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-500/30 transition-all text-xs font-bold uppercase tracking-tighter">
                                                <Upload size={12} />
                                                <span>Upload Signed</span>
                                            </div>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept=".so"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) onSignedUpload(file.path, f);
                                                }}
                                            />
                                        </label>
                                    )
                                ) : (
                                    <div className="w-full h-8 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center opacity-30 select-none">
                                        <span className="text-[10px] font-bold text-slate-500">DISABLED</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 flex items-center gap-3 text-xs text-slate-400 px-2 italic">
                <AlertCircle size={14} />
                <p>Nupkg build will automatically use signed versions where available. Unchecked architectures will be completely removed.</p>
            </div>
        </div>
    );
};

export default Step2_3_FileList;
