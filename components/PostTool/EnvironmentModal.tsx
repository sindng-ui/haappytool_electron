import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Edit2, Check, Copy } from 'lucide-react';
import { PostGlobalVariable, EnvironmentProfile } from '../../types';
import { useHappyTool } from '../../contexts/HappyToolContext';
import { EnvironmentVariableRow } from './EnvironmentVariableRow';
import { EnvironmentProfileRow } from './EnvironmentProfileRow';

interface EnvironmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Legacy props are essentially ignored or used for sync, but we use Context for profiles now
    variables?: PostGlobalVariable[];
    onUpdateVariables?: (vars: PostGlobalVariable[]) => void;
}

const EnvironmentModal: React.FC<EnvironmentModalProps> = ({ isOpen, onClose }) => {
    const { envProfiles, setEnvProfiles, activeEnvId, setActiveEnvId } = useHappyTool();

    // Local state for editing to avoid constant context updates (performance/UX)
    // Actually, updating context directly is fine for this scale, but let's try to keep it local until save?
    // User expects auto-save-like behavior usually, but a Modal often implies "Save" button.
    // Let's stick to "Save" model for safety.

    const [localProfiles, setLocalProfiles] = useState<EnvironmentProfile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocalProfiles(JSON.parse(JSON.stringify(envProfiles))); // Deep copy
            setSelectedProfileId(activeEnvId);
        }
    }, [isOpen, envProfiles, activeEnvId]);

    const handleSave = () => {
        setEnvProfiles(localProfiles);
        setActiveEnvId(selectedProfileId);
        onClose();
    };

    const activeProfile = localProfiles.find(p => p.id === selectedProfileId);

    // Profile Actions
    const handleAddProfile = () => {
        const newProfile: EnvironmentProfile = {
            id: crypto.randomUUID(),
            name: 'New Environment',
            variables: []
        };
        setLocalProfiles([...localProfiles, newProfile]);
        setSelectedProfileId(newProfile.id);
        setEditingNameId(newProfile.id);
        setTempName(newProfile.name);
    };

    const handleDuplicateProfile = useCallback((id: string) => {
        setLocalProfiles(prev => {
            const profile = prev.find(p => p.id === id);
            if (profile) {
                const newProfile = {
                    ...JSON.parse(JSON.stringify(profile)),
                    id: crypto.randomUUID(),
                    name: `${profile.name} (Copy)`
                };
                // Update selected profile to the new one
                setSelectedProfileId(newProfile.id);
                return [...prev, newProfile];
            }
            return prev;
        });
    }, []);

    const handleDeleteProfile = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setLocalProfiles(prev => {
            if (prev.length <= 1) {
                alert("Cannot delete the last profile.");
                return prev;
            }
            const newProfiles = prev.filter(p => p.id !== id);
            // If the deleted profile was selected, select the first available profile
            if (selectedProfileId === id) {
                setSelectedProfileId(newProfiles[0].id);
            }
            return newProfiles;
        });
    }, [selectedProfileId]);

    // Revert to simpler stable handlers where possible
    const onStartEdit = useCallback((profile: EnvironmentProfile, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingNameId(profile.id);
        setTempName(profile.name);
    }, []);

    const onSaveName = useCallback(() => {
        if (editingNameId) {
            setLocalProfiles(prev => prev.map(p => p.id === editingNameId ? { ...p, name: tempName } : p));
            setEditingNameId(null);
        }
    }, [editingNameId, tempName]);

    // Variable Actions (on activeProfile)
    // Removed updateActiveVariables helper as it captured closure state. Direct functional updates used below.

    const handleAddVariable = useCallback(() => {
        setLocalProfiles(prev => prev.map(p => {
            if (p.id === selectedProfileId) {
                const newVar: PostGlobalVariable = {
                    id: crypto.randomUUID(),
                    key: '',
                    value: '',
                    enabled: true
                };
                return { ...p, variables: [...p.variables, newVar] };
            }
            return p;
        }));
    }, [selectedProfileId]); // Only changes when profile selection changes

    const handleDeleteVariable = useCallback((id: string) => {
        setLocalProfiles(prev => prev.map(p => {
            if (p.id === selectedProfileId) {
                return { ...p, variables: p.variables.filter(v => v.id !== id) };
            }
            return p;
        }));
    }, [selectedProfileId]);

    const handleChangeVariable = useCallback((id: string, field: keyof PostGlobalVariable, value: string | boolean) => {
        setLocalProfiles(prev => prev.map(p => {
            if (p.id === selectedProfileId) {
                return {
                    ...p,
                    variables: p.variables.map(v => v.id === id ? { ...v, [field]: value } : v)
                };
            }
            return p;
        }));
    }, [selectedProfileId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-[900px] h-[600px] flex overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Sidebar: Profiles */}
                <div className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                        <h2 className="font-bold text-slate-700 dark:text-slate-300">Environments</h2>
                        <button onClick={handleAddProfile} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-500 transition-colors">
                            <Plus size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {localProfiles.map(profile => (
                            <EnvironmentProfileRow
                                key={profile.id}
                                profile={profile}
                                isSelected={selectedProfileId === profile.id}
                                isEditing={editingNameId === profile.id}
                                tempName={tempName}
                                onSelect={setSelectedProfileId}
                                onStartEdit={onStartEdit}
                                onDuplicate={handleDuplicateProfile}
                                onDelete={handleDeleteProfile}
                                onSaveName={onSaveName}
                                setTempName={setTempName}
                            />
                        ))}
                    </div>
                </div>

                {/* Main: Variables */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                    <div className="h-14 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 bg-white dark:bg-slate-900">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Profile</span>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                {activeProfile?.name}
                                {selectedProfileId === activeEnvId && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/20">CURRENTLY ACTIVE</span>}
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {activeProfile ? (
                            <div className="space-y-1">
                                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                                    <div className="w-8 text-center">On</div>
                                    <div className="flex-1">Variable</div>
                                    <div className="flex-1">Value</div>
                                    <div className="w-8"></div>
                                </div>

                                {activeProfile.variables.map(variable => (
                                    <EnvironmentVariableRow
                                        key={variable.id}
                                        variable={variable}
                                        onChange={handleChangeVariable}
                                        onDelete={handleDeleteVariable}
                                    />
                                ))}

                                {activeProfile.variables.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        <p className="text-slate-500 text-sm">No variables defined in this environment.</p>
                                    </div>
                                )}

                                <button
                                    onClick={handleAddVariable}
                                    className="flex items-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-600 mt-4 px-2 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors w-fit"
                                >
                                    <Plus size={16} /> Add Variable
                                </button>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                Select a profile to edit variables
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/30 hover:scale-105"
                        >
                            Save Changes & Activate "{localProfiles.find(p => p.id === selectedProfileId)?.name}"
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnvironmentModal;
