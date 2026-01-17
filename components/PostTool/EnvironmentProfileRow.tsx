import React from 'react';
import { Edit2, Copy, Trash2, Check } from 'lucide-react';
import { EnvironmentProfile } from '../../types';

interface EnvironmentProfileRowProps {
    profile: EnvironmentProfile;
    isSelected: boolean;
    isEditing: boolean;
    tempName: string;
    onSelect: (id: string) => void;
    onStartEdit: (profile: EnvironmentProfile, e: React.MouseEvent) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onSaveName: () => void;
    setTempName: (name: string) => void;
}

export const EnvironmentProfileRow = React.memo((props: EnvironmentProfileRowProps) => {
    const { profile, isSelected, isEditing, tempName, onSelect, onStartEdit, onDuplicate, onDelete, onSaveName, setTempName } = props;

    return (
        <div
            onClick={() => onSelect(profile.id)}
            className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected
                ? 'bg-indigo-500 text-white shadow-md'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400'
                }`}
        >
            {isEditing ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSaveName()}
                        autoFocus
                        className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-1 py-0.5 rounded text-sm border-none focus:ring-1 focus:ring-indigo-300 outline-none"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={onSaveName}
                    />
                </div>
            ) : (
                <span className="truncate text-sm font-medium flex-1">{profile.name}</span>
            )}

            <div className={`flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                {!isEditing && (
                    <button onClick={(e) => onStartEdit(profile, e)} className={`p-1 rounded ${isSelected ? 'hover:bg-indigo-400' : 'hover:text-indigo-500'}`}>
                        <Edit2 size={12} />
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(profile.id); }} className={`p-1 rounded ${isSelected ? 'hover:bg-indigo-400' : 'hover:text-indigo-500'}`} title="Duplicate">
                    <Copy size={12} />
                </button>
                <button onClick={(e) => onDelete(profile.id, e)} className={`p-1 rounded ${isSelected ? 'hover:bg-red-500/50' : 'hover:text-red-500'}`}>
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
});

EnvironmentProfileRow.displayName = 'EnvironmentProfileRow';
