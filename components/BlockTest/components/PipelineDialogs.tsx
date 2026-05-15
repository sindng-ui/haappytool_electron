import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { Pipeline } from '../types';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    isDanger?: boolean;
}

const Dialog: React.FC<DialogProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    description, 
    children, 
    confirmLabel, 
    onConfirm,
    isDanger = false
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {isDanger ? <Lucide.AlertTriangle className="text-red-500" size={20} /> : <Lucide.Info className="text-blue-500" size={20} />}
                                {title}
                            </h3>
                            {description && (
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    {description}
                                </p>
                            )}
                            <div className="mt-4">
                                {children}
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all active:scale-95 ${
                                    isDanger 
                                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                                        : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'
                                }`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export const RenamePipelineDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pipeline: Pipeline;
    onRename: (newName: string) => void;
}> = ({ isOpen, onClose, pipeline, onRename }) => {
    const [name, setName] = useState(pipeline.name);

    useEffect(() => {
        if (isOpen) setName(pipeline.name);
    }, [isOpen, pipeline.name]);

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Rename Pipeline"
            description="Enter a new name for this test pipeline."
            confirmLabel="Save Changes"
            onConfirm={() => name.trim() && onRename(name.trim())}
        >
            <input 
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        name.trim() && onRename(name.trim());
                        onClose();
                    }
                }}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Pipeline Name"
            />
        </Dialog>
    );
};

export const DeleteConfirmDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pipelineName: string;
    onConfirm: () => void;
}> = ({ isOpen, onClose, pipelineName, onConfirm }) => {
    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Delete Pipeline"
            description={`Are you sure you want to delete "${pipelineName}"? This action cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={onConfirm}
            isDanger={true}
        />
    );
};
