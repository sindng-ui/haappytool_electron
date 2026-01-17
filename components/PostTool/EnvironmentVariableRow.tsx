import React from 'react';
import { Trash2 } from 'lucide-react';
import { PostGlobalVariable } from '../../types';

interface EnvironmentVariableRowProps {
    variable: PostGlobalVariable;
    onChange: (id: string, field: keyof PostGlobalVariable, value: string | boolean) => void;
    onDelete: (id: string) => void;
}

export const EnvironmentVariableRow = React.memo(({ variable, onChange, onDelete }: EnvironmentVariableRowProps) => {
    return (
        <div className="flex items-center gap-4 group">
            <div className="w-8 flex justify-center">
                <input
                    type="checkbox"
                    checked={variable.enabled}
                    onChange={(e) => onChange(variable.id, 'enabled', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
            </div>
            <div className="flex-1">
                <input
                    type="text"
                    value={variable.key}
                    onChange={(e) => onChange(variable.id, 'key', e.target.value)}
                    placeholder="Key"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono transition-shadow shadow-sm"
                />
            </div>
            <div className="flex-1">
                <input
                    type="text"
                    value={variable.value}
                    onChange={(e) => onChange(variable.id, 'value', e.target.value)}
                    placeholder="Value"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300 focus:ring-1 focus:ring-indigo-500 font-mono transition-shadow shadow-sm"
                />
            </div>
            <div className="w-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onDelete(variable.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
});

EnvironmentVariableRow.displayName = 'EnvironmentVariableRow';
