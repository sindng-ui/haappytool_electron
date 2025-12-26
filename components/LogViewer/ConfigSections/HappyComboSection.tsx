import React, { useState, useRef, useEffect, memo } from 'react';
import * as Lucide from 'lucide-react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { LogRule } from '../../../types';

const { Zap, X, Folder, FolderOpen, Plus } = Lucide;

interface HappyComboSectionProps {
    currentConfig: LogRule;
    updateCurrentRule: (updates: Partial<LogRule>) => void;
    groupedRoots: { root: string; isRootEnabled: boolean; items: { group: string[]; active: boolean; originalIdx: number, id?: string }[] }[];
    collapsedRoots: Set<string>;
    onToggleRootCollapse: (root: string) => void;
    handleToggleRoot: (root: string, enabled: boolean) => void;
    happyCombosCaseSensitive: boolean;
}

// Helper to check if a specific tag is being edited
const isTagEditing = (target: { groupIdx: number, termIdx: number, isActive: boolean } | null, originalIdx: number, termIdx: number, isActive: boolean) => {
    return !!(target && target.groupIdx === originalIdx && target.termIdx === termIdx && target.isActive === isActive);
};

// Component for a single editable tag
const EditableTag = memo(({
    isEditing,
    value,
    isActive,
    onStartEdit,
    onCommit,
    onDelete,
    onNavigate,
    termIdx,
    isLast,
    rootIdx,
    branchIdx
}: {
    isEditing: boolean;
    value: string;
    isActive: boolean;
    onStartEdit: () => void;
    onCommit: (newVal: string) => void;
    onDelete: () => void;
    onNavigate: (key: string, empty: boolean) => void;
    termIdx: number;
    isLast: boolean;
    rootIdx: number;
    branchIdx: number;
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs font-medium border border-indigo-500 w-24 outline-none shadow-lg z-50 absolute-input"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => onCommit(localValue)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onCommit(localValue);
                        if (isLast) onNavigate('NextInput', false); // Special handling to jump to + tag
                    } else if (e.key === 'Escape') {
                        onCommit(value); // Revert
                    } else if (e.key === 'Backspace') {
                        if (!localValue) {
                            e.preventDefault();
                            onDelete();
                        } else if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                            // Jump to previous item if at start
                            e.preventDefault();
                            onCommit(localValue);
                            onNavigate('Backspace', false);
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        onCommit(localValue);
                        onNavigate('Up', false);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        onCommit(localValue);
                        onNavigate('Down', false);
                    } else if (e.key === 'ArrowLeft') {
                        if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                            e.preventDefault();
                            onCommit(localValue);
                            onNavigate('Left', false);
                        }
                    } else if (e.key === 'ArrowRight') {
                        if (e.currentTarget.selectionStart === localValue.length) {
                            e.preventDefault();
                            onCommit(localValue);
                            onNavigate('Right', false);
                        }
                    }
                }}
            />
        );
    }

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            className={`flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isActive
                ? 'bg-slate-800/80 text-emerald-300 border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800 shadow-sm'
                : 'bg-slate-900/50 text-slate-500 border-slate-800 opacity-70'
                }`}
        >
            <span>{value}</span>
            <IconButton
                variant="ghost"
                size="xs"
                icon={<X size={10} />}
                className={`ml-1.5 -mr-1 ${isActive ? 'text-slate-500 hover:text-red-400' : 'text-slate-700'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
            />
        </div>
    );
});

export const HappyComboSection: React.FC<HappyComboSectionProps> = ({
    currentConfig,
    updateCurrentRule,
    groupedRoots,
    collapsedRoots,
    onToggleRootCollapse,
    handleToggleRoot,
    happyCombosCaseSensitive
}) => {
    // editingTarget only stores COORDINATES. Value is local to EditableTag.
    const [editingTarget, setEditingTarget] = useState<{ groupIdx: number, termIdx: number, isActive: boolean, value?: string } | null>(null);
    const [newRootName, setNewRootName] = useState('');
    const [isCreatingRoot, setIsCreatingRoot] = useState(false);

    // Ref to handle auto-focus on new branch creation
    const pendingBranchFocus = useRef<{ rootIdx: number, branchIdx: number } | null>(null);
    // Ref to handle auto-focus on new root creation
    const pendingRootFocus = useRef<string | null>(null);

    useEffect(() => {
        if (pendingBranchFocus.current) {
            const { rootIdx, branchIdx } = pendingBranchFocus.current;
            const input = document.querySelector(`input[data-add-tag="${rootIdx}-${branchIdx}"]`) as HTMLInputElement;
            if (input) {
                input.focus();
                pendingBranchFocus.current = null;
            }
        }

        if (pendingRootFocus.current) {
            // Find the root that matches the name
            if (groupedRoots.some(g => g.root === pendingRootFocus.current)) {
                setEditingTarget({ groupIdx: -1, termIdx: -1, isActive: true, value: pendingRootFocus.current });
                pendingRootFocus.current = null;
            }
        }
    }, [groupedRoots]);

    // Helper to update groups
    const handleUpdateGroup = (originalIdx: number, newGroup: string[], isActive: boolean, id?: string) => {
        if (currentConfig.happyGroups) {
            // New Logic
            const newHappyGroups = [...currentConfig.happyGroups];
            const targetIndex = id ? newHappyGroups.findIndex(g => g.id === id) : originalIdx;

            if (targetIndex > -1) {
                newHappyGroups[targetIndex] = { ...newHappyGroups[targetIndex], tags: newGroup };
                updateCurrentRule({ happyGroups: newHappyGroups });
            }
        } else {
            // Legacy Logic
            const sourceArray = isActive ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
            const newGroups = [...sourceArray];
            newGroups[originalIdx] = newGroup;

            if (isActive) updateCurrentRule({ includeGroups: newGroups });
            else updateCurrentRule({ disabledGroups: newGroups });
        }
    };

    const handleDeleteRoot = (root: string) => {
        if (currentConfig.happyGroups) {
            const newHappyGroups = currentConfig.happyGroups.filter(h => (h.tags[0] || '').trim() !== root);
            updateCurrentRule({ happyGroups: newHappyGroups });
        } else {
            const newIncludes = currentConfig.includeGroups.filter(g => (g[0] || '').trim() !== root);
            const newDisabled = (currentConfig.disabledGroups || []).filter(g => (g[0] || '').trim() !== root);
            updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
        }
    };

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-indigo-100 flex items-center gap-2">
                    <Zap size={16} className="text-yellow-400 fill-yellow-400 icon-glow" />
                    Happy Combos
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-wider">
                    <input type="checkbox" checked={happyCombosCaseSensitive ?? false} onChange={(e) => updateCurrentRule({ happyCombosCaseSensitive: e.target.checked })} className="accent-indigo-500 rounded-sm w-3 h-3" />
                    <span>Case Sensitive</span>
                </label>
            </div>

            <div className="space-y-4">
                {groupedRoots.map(({ root, isRootEnabled, items }, rootIdx) => (
                    <div key={rootIdx} className={`glass rounded-2xl p-4 transition-all duration-300 relative group border ${isRootEnabled ? 'border-indigo-500/10' : 'border-slate-800 opacity-60'}`}>
                        {/* Background Gradient for Root */}
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br transition-opacity duration-500 pointer-events-none ${isRootEnabled ? 'from-indigo-500/5 to-transparent opacity-100' : 'opacity-0'}`} />

                        {/* Root Header */}
                        <div className="flex items-center gap-3 relative z-10 mb-2">
                            <input type="checkbox" checked={isRootEnabled} onChange={(e) => handleToggleRoot(root, e.target.checked)} className="accent-indigo-500 w-4 h-4 cursor-pointer" />

                            <IconButton
                                onClick={() => onToggleRootCollapse(root)}
                                icon={collapsedRoots.has(root) ? <Folder size={14} /> : <FolderOpen size={14} />}
                                className={`rounded-lg transition-colors ${isRootEnabled ? 'text-indigo-300 hover:bg-indigo-500/20' : 'text-slate-500 hover:bg-slate-800'} ${!collapsedRoots.has(root) && isRootEnabled ? 'bg-indigo-500/10' : ''}`}
                                size="sm"
                            />

                            {/* Root Name Editing */}
                            {editingTarget?.groupIdx === -1 && editingTarget?.value === root ? (
                                <input
                                    autoFocus
                                    className="bg-indigo-900/50 text-indigo-100 px-3 py-1 rounded-lg text-sm font-bold border border-indigo-500/50 outline-none shadow-lg min-w-[120px]"
                                    defaultValue={root}
                                    onBlur={(e) => {
                                        const newVal = e.target.value.trim();
                                        if (newVal && newVal !== root) {
                                            if (currentConfig.happyGroups) {
                                                const newHappyGroups = currentConfig.happyGroups.map(h => {
                                                    if ((h.tags[0] || '').trim() === root) {
                                                        return { ...h, tags: [newVal, ...h.tags.slice(1)] };
                                                    }
                                                    return h;
                                                });
                                                updateCurrentRule({ happyGroups: newHappyGroups });
                                            } else {
                                                const newIncludes = currentConfig.includeGroups.map(g => (g[0] || '').trim() === root ? [newVal, ...g.slice(1)] : g);
                                                const newDisabled = (currentConfig.disabledGroups || []).map(g => (g[0] || '').trim() === root ? [newVal, ...g.slice(1)] : g);
                                                updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
                                            }
                                        }
                                        setEditingTarget(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.currentTarget.blur();
                                        else if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            if (items.length > 0) {
                                                if (items[0].group.length > 1) {
                                                    // Focus first tag of first branch
                                                    setEditingTarget({ groupIdx: items[0].originalIdx, termIdx: 1, isActive: items[0].active });
                                                } else {
                                                    // Focus +tag of first branch
                                                    const input = document.querySelector(`input[data-add-tag="${rootIdx}-0"]`) as HTMLInputElement;
                                                    input?.focus();
                                                }
                                            }
                                        }
                                    }}
                                />
                            ) : (
                                <span
                                    onClick={() => setEditingTarget({ groupIdx: -1, termIdx: -1, isActive: true, value: root } as any)}
                                    className={`font-bold text-sm cursor-pointer hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-white/5 ${isRootEnabled ? 'text-indigo-100' : 'text-slate-500'}`}
                                >
                                    {root}
                                </span>
                            )}

                            <IconButton
                                variant="ghost"
                                size="sm"
                                icon={<X size={14} />}
                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"
                                onClick={() => handleDeleteRoot(root)}
                            />
                        </div>

                        {/* Branches */}
                        {!collapsedRoots.has(root) && (
                            <div className="relative pl-7 space-y-3 mt-3">
                                <div className="absolute left-[11px] top-0 bottom-4 w-px bg-slate-800" />

                                {items.map((item, itemIdx) => {
                                    const branchTags = item.group.slice(1);

                                    return (
                                        <div key={item.originalIdx} className="relative group/branch flex items-center">
                                            {/* Branch Line */}
                                            <div className="absolute -left-4 top-[14px] w-4 h-px bg-slate-800" />

                                            <div className="flex flex-wrap items-center gap-2 flex-1">
                                                {branchTags.map((term, tIdx) => (
                                                    <React.Fragment key={tIdx}>
                                                        {tIdx > 0 && <div className="w-1 h-1 bg-slate-700 rounded-full mx-0.5" />}
                                                        <EditableTag
                                                            isEditing={isTagEditing(editingTarget, item.originalIdx, tIdx + 1, item.active)}
                                                            value={term}
                                                            isActive={item.active}
                                                            isLast={tIdx === branchTags.length - 1}
                                                            termIdx={tIdx}
                                                            rootIdx={rootIdx}
                                                            branchIdx={itemIdx}
                                                            onStartEdit={() => setEditingTarget({ groupIdx: item.originalIdx, termIdx: tIdx + 1, isActive: item.active })}
                                                            onCommit={(newVal) => {
                                                                const newGroup = [...item.group];
                                                                if (newVal.trim()) newGroup[tIdx + 1] = newVal.trim();
                                                                else newGroup.splice(tIdx + 1, 1); // Delete if empty
                                                                handleUpdateGroup(item.originalIdx, newGroup, item.active, item.id);
                                                                setEditingTarget(null);
                                                            }}
                                                            onDelete={() => {
                                                                const newGroup = [...item.group];
                                                                newGroup.splice(tIdx + 1, 1);
                                                                handleUpdateGroup(item.originalIdx, newGroup, item.active, item.id);
                                                            }}
                                                            onNavigate={(key) => {
                                                                // Handle Input Focus (Next/Add Tag)
                                                                if (key === 'NextInput' || key === 'Right') {
                                                                    if (tIdx < branchTags.length - 1 && key === 'Right') {
                                                                        // Go to next tag
                                                                        setEditingTarget({ groupIdx: item.originalIdx, termIdx: tIdx + 2, isActive: item.active });
                                                                    } else {
                                                                        // Go to input
                                                                        const input = document.querySelector(`input[data-add-tag="${rootIdx}-${itemIdx}"]`) as HTMLInputElement;
                                                                        input?.focus();
                                                                    }
                                                                } else if (key === 'Left' || key === 'Backspace') {
                                                                    if (tIdx > 0) {
                                                                        setEditingTarget({ groupIdx: item.originalIdx, termIdx: tIdx, isActive: item.active });
                                                                    }
                                                                } else if (key === 'Up') {
                                                                    if (itemIdx > 0) {
                                                                        const targetItem = items[itemIdx - 1];
                                                                        // Try to maintain column index
                                                                        const targetLen = targetItem.group.length - 1;
                                                                        const targetTermIdx = Math.min(tIdx, targetLen - 1);

                                                                        if (targetTermIdx >= 0) {
                                                                            setEditingTarget({ groupIdx: targetItem.originalIdx, termIdx: targetTermIdx + 1, isActive: targetItem.active });
                                                                        } else {
                                                                            // If target branch has no tags (just root), focus its add-tag logic? 
                                                                            // Or if we are at index 0 and target has none...
                                                                            // Let's just focus the input if no tags match
                                                                            const input = document.querySelector(`input[data-add-tag="${rootIdx}-${itemIdx - 1}"]`) as HTMLInputElement;
                                                                            input?.focus();
                                                                        }
                                                                    } else {
                                                                        // Focus Root
                                                                        setEditingTarget({ groupIdx: -1, termIdx: -1, isActive: true, value: root });
                                                                    }
                                                                } else if (key === 'Down') {
                                                                    if (itemIdx < items.length - 1) {
                                                                        const targetItem = items[itemIdx + 1];
                                                                        const targetLen = targetItem.group.length - 1;
                                                                        const targetTermIdx = Math.min(tIdx, targetLen - 1);

                                                                        if (targetTermIdx >= 0) {
                                                                            setEditingTarget({ groupIdx: targetItem.originalIdx, termIdx: targetTermIdx + 1, isActive: targetItem.active });
                                                                        } else {
                                                                            const input = document.querySelector(`input[data-add-tag="${rootIdx}-${itemIdx + 1}"]`) as HTMLInputElement;
                                                                            input?.focus();
                                                                        }
                                                                    } else {
                                                                        // Create Branch
                                                                        if (currentConfig.happyGroups) {
                                                                            const newId = Math.random().toString(36).substring(7);
                                                                            updateCurrentRule({ happyGroups: [...currentConfig.happyGroups, { id: newId, tags: [root], enabled: true }] });
                                                                        } else {
                                                                            updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [root]] });
                                                                        }
                                                                        setTimeout(() => {
                                                                            const input = document.querySelector(`input[data-add-tag="${rootIdx}-${items.length}"]`) as HTMLInputElement;
                                                                            input?.focus();
                                                                        }, 50);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </React.Fragment>
                                                ))}

                                                {/* Add Tag Input */}
                                                <input
                                                    className="bg-transparent text-[11px] text-slate-500 placeholder-slate-600 focus:text-indigo-300 focus:placeholder-indigo-500/50 focus:outline-none min-w-[60px] py-1 px-2 border border-transparent focus:border-indigo-500/30 rounded-lg transition-all hover:bg-white/5"
                                                    placeholder="+ tag"
                                                    data-add-tag={`${rootIdx}-${itemIdx}`}
                                                    onBlur={(e) => { e.currentTarget.value = ''; }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                            const newGroup = [...item.group, e.currentTarget.value.trim()];
                                                            handleUpdateGroup(item.originalIdx, newGroup, item.active, item.id);
                                                            e.currentTarget.value = '';
                                                        } else if (e.key === 'Backspace' && !e.currentTarget.value) {
                                                            // Backspace empty input
                                                            if (branchTags.length > 0) {
                                                                e.preventDefault();
                                                                setEditingTarget({ groupIdx: item.originalIdx, termIdx: branchTags.length, isActive: item.active });
                                                            } else if (items.length > 1) {
                                                                // Delete Branch if empty and not the only one
                                                                e.preventDefault();
                                                                if (currentConfig.happyGroups && item.id) {
                                                                    const newHappy = currentConfig.happyGroups.filter(h => h.id !== item.id);
                                                                    updateCurrentRule({ happyGroups: newHappy });
                                                                } else {
                                                                    const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                                    const newGroups = sourceArray.filter((_, i) => i !== item.originalIdx);
                                                                    if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                    else updateCurrentRule({ disabledGroups: newGroups });
                                                                }

                                                                // Focus Previous
                                                                if (itemIdx > 0) {
                                                                    setTimeout(() => {
                                                                        const prevInput = document.querySelector(`input[data-add-tag="${rootIdx}-${itemIdx - 1}"]`) as HTMLInputElement;
                                                                        prevInput?.focus();
                                                                    }, 50);
                                                                }
                                                            }
                                                        } else if (e.key === 'ArrowDown') {
                                                            if (itemIdx < items.length - 1) {
                                                                // Focus next branch add-tag
                                                                const nextInput = document.querySelector(`input[data-add-tag="${rootIdx}-${itemIdx + 1}"]`) as HTMLInputElement;
                                                                if (nextInput) nextInput.focus();
                                                            } else {
                                                                // Create Branch
                                                                if (currentConfig.happyGroups) {
                                                                    const newId = Math.random().toString(36).substring(7);
                                                                    updateCurrentRule({ happyGroups: [...currentConfig.happyGroups, { id: newId, tags: [root], enabled: true }] });
                                                                } else {
                                                                    updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [root]] });
                                                                }
                                                                setTimeout(() => {
                                                                    const input = document.querySelector(`input[data-add-tag="${rootIdx}-${items.length}"]`) as HTMLInputElement;
                                                                    input?.focus();
                                                                }, 50);
                                                            }
                                                        } else if (e.key === 'ArrowUp') {
                                                            if (itemIdx > 0) {
                                                                const prevInput = document.querySelector(`input[data-add-tag="${rootIdx}-${itemIdx - 1}"]`) as HTMLInputElement;
                                                                if (prevInput) prevInput.focus();
                                                            } else {
                                                                // Focus Root
                                                                setEditingTarget({ groupIdx: -1, termIdx: -1, isActive: true, value: root });
                                                            }
                                                        } else if (e.key === 'ArrowLeft') {
                                                            if (!e.currentTarget.value || e.currentTarget.selectionStart === 0) {
                                                                if (branchTags.length > 0) {
                                                                    e.preventDefault();
                                                                    setEditingTarget({ groupIdx: item.originalIdx, termIdx: branchTags.length, isActive: item.active });
                                                                }
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <IconButton
                                                variant="ghost"
                                                size="xs"
                                                icon={<X size={12} />}
                                                className="ml-auto opacity-0 group-hover/branch:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
                                                title="Remove Branch"
                                                onClick={() => {
                                                    if (items.length === 1) {
                                                        // If last branch, reset to root only
                                                        const newGroup = [root];
                                                        handleUpdateGroup(item.originalIdx, newGroup, item.active, item.id);
                                                    } else {
                                                        // Remove completely
                                                        if (currentConfig.happyGroups && item.id) {
                                                            const newHappy = currentConfig.happyGroups.filter(h => h.id !== item.id);
                                                            updateCurrentRule({ happyGroups: newHappy });
                                                        } else {
                                                            const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                            const newGroups = sourceArray.filter((_, i) => i !== item.originalIdx);
                                                            if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                            else updateCurrentRule({ disabledGroups: newGroups });
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    );
                                })}

                                <div className="relative pl-4 pt-1">
                                    <div className="absolute left-[11px] top-4 w-4 h-px bg-slate-800" />
                                    <button
                                        onClick={() => {
                                            if (currentConfig.happyGroups) {
                                                const newId = Math.random().toString(36).substring(7);
                                                updateCurrentRule({ happyGroups: [...currentConfig.happyGroups, { id: newId, tags: [root], enabled: true }] });
                                            } else {
                                                updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [root]] });
                                            }
                                            pendingBranchFocus.current = { rootIdx, branchIdx: items.length };
                                        }}
                                        className="text-[10px] font-bold text-indigo-400/70 hover:text-indigo-300 flex items-center gap-1 py-1 px-2 rounded hover:bg-indigo-500/10 transition-colors uppercase tracking-wider"
                                    >
                                        <Plus size={10} /> Add Branch
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button
                variant="outline"
                className="w-full mt-4 py-3 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:bg-slate-800 hover:border-indigo-500/50 hover:text-indigo-300 transition-all hover:shadow-lg hover:shadow-indigo-900/10 group"
                icon={<Plus size={16} className="group-hover:text-indigo-400" />}
                onClick={() => {
                    let newName = 'NewRoot';
                    let counter = 1;
                    const existing = new Set(groupedRoots.map(g => g.root));
                    while (existing.has(newName)) { newName = `NewRoot (${counter++})`; }

                    if (currentConfig.happyGroups) {
                        const newId = Math.random().toString(36).substring(7);
                        updateCurrentRule({ happyGroups: [...currentConfig.happyGroups, { id: newId, tags: [newName], enabled: true }] });
                    } else {
                        updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [newName]] });
                    }
                    pendingRootFocus.current = newName;
                }}
            >
                Create New Combo Group
            </Button>
        </div>
    );
};
