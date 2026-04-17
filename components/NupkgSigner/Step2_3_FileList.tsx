import React, { useState } from 'react';
import { SoFileItem } from './types';
import { Download, Upload, Trash2, ArrowLeft, Zap, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    soFiles: SoFileItem[];
    onToggleChecked: (path: string) => void;
    onSignedUpload: (path: string, file: File) => void;
    onProcess: () => void;
    onBack: () => void;
}

const Step2_3_FileList: React.FC<Props> = ({ soFiles, onToggleChecked, onSignedUpload, onProcess, onBack }) => {
    const [dragOverPath, setDragOverPath] = useState<string | null>(null);
    const checkedCount = soFiles.filter(f => f.checked).length;
    const signedCount = soFiles.filter(f => f.checked && f.signedBlob).length;

    // 🐧 형님 가라사대: 다운로드할 때 아키텍처 폴더명을 꼬리표로 붙여서 저장합니다!
    const getTaggedName = (item: SoFileItem) => {
        const parts = item.path.split('/');
        // path 예시: runtimes/tizen-4.0.0-armel/native/libnative.so
        // 두 번째 세그먼트(아키텍처/버전 정보)를 추출
        const prefix = parts.length > 1 ? parts[1] : 'signed';
        return `${prefix}_${item.basename}`;
    };

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
                    <span className="font-bold">Back to Upload</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm shadow-sm flex items-center gap-3">
                        <span className="text-slate-500">Summary:</span>
                        <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-indigo-500">{signedCount}</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-700 dark:text-slate-300">{checkedCount}</span>
                            <span className="ml-1">Ready</span>
                        </div>
                    </div>
                    <button 
                        onClick={onProcess}
                        disabled={checkedCount === 0}
                        className={`flex items-center gap-2 px-8 py-2.5 rounded-2xl font-bold transition-all ${
                            checkedCount > 0 
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                        }`}
                    >
                        <Zap size={18} />
                        <span>Build Nupkg</span>
                    </button>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_auto_240px_auto] gap-4 px-8 py-4 bg-slate-100 dark:bg-slate-900 rounded-t-3xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                <div className="w-8"></div>
                <div>Runtime .so Path</div>
                <div className="w-24 text-center">Original</div>
                <div className="w-[240px] text-center">Signed Version (Drop Here)</div>
                <div className="w-12 text-center">Status</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto border-x border-b border-slate-200 dark:border-slate-800 rounded-b-3xl bg-white dark:bg-slate-950/20 scrollbar-hide">
                {soFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                            <AlertCircle size={64} className="mb-4 opacity-10" />
                        </motion.div>
                        <p className="font-bold">No .so files detected in this package.</p>
                    </div>
                ) : (
                    soFiles.map((file) => (
                        <div 
                            key={file.path}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if(file.checked) setDragOverPath(file.path); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(null); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverPath(null);
                                if (file.checked && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                    // 🐧 형님 가라사대: 여러 개 던져도 다 받아먹어라!
                                    Array.from(e.dataTransfer.files).forEach(f => {
                                        onSignedUpload(file.path, f);
                                    });
                                }
                            }}
                            className={`grid grid-cols-[auto_1fr_auto_240px_auto] gap-4 px-8 py-5 border-b border-slate-100 dark:border-slate-900 items-center transition-all duration-300 relative group ${
                                !file.checked 
                                    ? 'bg-slate-50/30 dark:bg-slate-900/10 opacity-40' 
                                    : dragOverPath === file.path
                                        ? 'bg-indigo-600/10 scale-[1.005] z-10'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                            }`}
                        >
                            {/* Drag Indicator Overlay */}
                            <AnimatePresence>
                                {dragOverPath === file.path && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-x-0 inset-y-[-1px] border-2 border-indigo-500 rounded-lg pointer-events-none z-20 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                    />
                                )}
                            </AnimatePresence>

                            {/* Checkbox */}
                            <button 
                                onClick={() => onToggleChecked(file.path)}
                                className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center ${
                                    file.checked 
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                }`}
                            >
                                {file.checked && <CheckCircle2 size={16} />}
                            </button>

                            {/* Path */}
                            <div className="flex flex-col min-w-0 pointer-events-none">
                                <span className={`text-sm font-bold truncate ${file.checked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                                    {file.basename}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 truncate font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {file.path}
                                    </span>
                                </div>
                            </div>

                            {/* Download Original */}
                            <div className="w-24 flex justify-center">
                                <button 
                                    onClick={() => downloadBlob(file.originalBlob, getTaggedName(file))}
                                    className={`p-2.5 rounded-xl transition-all ${
                                        file.checked 
                                            ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-500 hover:shadow-lg shadow-sm'
                                            : 'bg-transparent text-slate-300 cursor-not-allowed'
                                    }`}
                                    title="Download with Smart Tag"
                                    disabled={!file.checked}
                                >
                                    <Download size={18} />
                                </button>
                            </div>

                            {/* Signed Upload Drop Target - 🐧 형님 가라사대: 여기가 넓어야 한다! */}
                            <div className="w-[240px] flex items-center justify-center h-full">
                                {file.checked ? (
                                    <div className="relative w-full h-14 group/drop">
                                        {file.signedBlob ? (
                                            <div className={`flex items-center gap-3 px-4 h-full rounded-2xl border-2 transition-all overflow-hidden relative ${
                                                file.isSigned 
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                                            }`}>
                                                <div className="flex-shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
                                                    {file.isSigned ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Signed Result</span>
                                                    <span className="text-xs font-bold truncate tracking-tight">{file.signedBlob instanceof File ? (file.signedBlob as File).name : 'Signed Artifact'}</span>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => onSignedUpload(file.path, undefined as any)}
                                                    className="absolute inset-0 bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover/drop:opacity-100 transition-all duration-200 hover:bg-rose-700"
                                                >
                                                    <Trash2 size={20} className="mr-2" />
                                                    <span className="font-bold">Remove</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <label className={`w-full h-full flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                                                dragOverPath === file.path 
                                                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-600'
                                                    : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-400 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5'
                                            }`}>
                                                <Upload size={18} className={dragOverPath === file.path ? 'animate-bounce' : ''} />
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Drop .so Here</span>
                                                    <span className="text-[9px] opacity-70">or click to browse</span>
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
                                        }
                                    </div>
                                ) : (
                                    <div className="w-full h-14 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-center opacity-30 select-none grayscale">
                                        <span className="text-[10px] font-black tracking-[0.2em] text-slate-500">EXCLUDED</span>
                                    </div>
                                )}
                            </div>

                            {/* Status Indicator - 🐧 형님 가라사대: 우측에 확실하게 보여라! */}
                            <div className="w-12 flex justify-center">
                                {file.checked && file.signedBlob && (
                                    <motion.div 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className={`transition-colors ${file.isSigned ? 'text-emerald-500' : 'text-rose-500'}`}
                                    >
                                        {file.isSigned ? (
                                            <div className="relative">
                                                <CheckCircle2 size={28} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                                <motion.div 
                                                    className="absolute -inset-1 rounded-full border-2 border-emerald-500/20"
                                                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                />
                                            </div>
                                        ) : (
                                            <XCircle size={28} className="drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                <AlertCircle size={14} className="text-indigo-500 flex-shrink-0" />
                <p>
                    <span className="font-bold text-indigo-500">Magic Match Tip:</span> 
                    Download original files with <span className="font-bold underline italic">Smart Tags</span>. 
                    If you drop tagged files anywhere in the list, they will automatically find their target architecture!
                </p>
            </div>
        </div>
    );
};

export default Step2_3_FileList;
