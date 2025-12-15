import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { PostGlobalVariable } from '../../types';

interface EnvironmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    variables: PostGlobalVariable[];
    onUpdateVariables: (vars: PostGlobalVariable[]) => void;
}

const EnvironmentModal: React.FC<EnvironmentModalProps> = ({ isOpen, onClose, variables, onUpdateVariables }) => {
    const [localVariables, setLocalVariables] = useState<PostGlobalVariable[]>([]);

    useEffect(() => {
        if (isOpen) {
            setLocalVariables(variables || []);
        }
    }, [isOpen, variables]);

    if (!isOpen) return null;

    const handleSave = () => {
        onUpdateVariables(localVariables);
        onClose();
    };

    const handleAddVariable = () => {
        const newVar: PostGlobalVariable = {
            id: crypto.randomUUID(),
            key: '',
            value: '',
            enabled: true
        };
        setLocalVariables([...localVariables, newVar]);
    };

    const handleDeleteVariable = (id: string) => {
        setLocalVariables(localVariables.filter(v => v.id !== id));
    };

    const handleChange = (id: string, field: keyof PostGlobalVariable, value: string | boolean) => {
        setLocalVariables(localVariables.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Global Environment Variables</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase px-2 mb-2">
                            <div className="w-8">On</div>
                            <div className="flex-1">Variable</div>
                            <div className="flex-1">Value</div>
                            <div className="w-8"></div>
                        </div>

                        {localVariables.map(variable => (
                            <div key={variable.id} className="flex items-center gap-2 group">
                                <div className="w-8 flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={variable.enabled}
                                        onChange={(e) => handleChange(variable.id, 'enabled', e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={variable.key}
                                        onChange={(e) => handleChange(variable.id, 'key', e.target.value)}
                                        placeholder="Variable Name"
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded px-2 py-1 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={variable.value}
                                        onChange={(e) => handleChange(variable.id, 'value', e.target.value)}
                                        placeholder="Value"
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded px-2 py-1 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
                                    />
                                </div>
                                <div className="w-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDeleteVariable(variable.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                        title="Delete Variable"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {localVariables.length === 0 && (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                No global variables defined.
                            </div>
                        )}

                        <button
                            onClick={handleAddVariable}
                            className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 mt-2 px-2"
                        >
                            <Plus size={14} /> Add Variable
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/25"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EnvironmentModal;
