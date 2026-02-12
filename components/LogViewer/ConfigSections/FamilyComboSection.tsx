import React, { useState, useRef, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { LogRule, FamilyCombo } from '../../../types';
import { EditableTag } from './EditableTag';

const { Users, Plus, X, ArrowDown } = Lucide;

interface FamilyComboSectionProps {
    currentConfig: LogRule;
    updateCurrentRule: (updates: Partial<LogRule>) => void;
}

export const FamilyComboSection: React.FC<FamilyComboSectionProps> = ({
    currentConfig,
    updateCurrentRule
}) => {
    // editingTarget: { comboId, field, branchIdx, tagIdx, isActive }
    const [editingTarget, setEditingTarget] = useState<{ comboId: string, field: 'name' | 'start' | 'end' | 'middle', branchIdx?: number, tagIdx?: number, isActive: boolean } | null>(null);

    // Pending focus for new branches
    const [pendingBranchFocus, setPendingBranchFocus] = useState<{ comboId: string, branchIdx: number } | null>(null);

    const familyCombos = currentConfig.familyCombos || [];

    const updateFamily = (newCombos: FamilyCombo[]) => {
        updateCurrentRule({ familyCombos: newCombos });
    };

    const handleUpdateCombo = (comboId: string, updates: Partial<FamilyCombo>) => {
        const newCombos = familyCombos.map(c => c.id === comboId ? { ...c, ...updates } : c);
        updateFamily(newCombos);
    };

    const handleAddTag = (comboId: string, field: 'start' | 'end', tag: string) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        if (field === 'start') {
            handleUpdateCombo(comboId, { startTags: [...combo.startTags, tag] });
        } else {
            handleUpdateCombo(comboId, { endTags: [...combo.endTags, tag] });
        }
    };

    const handleUpdateTag = (comboId: string, field: 'start' | 'end', idx: number, newVal: string) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        if (field === 'start') {
            const newTags = [...combo.startTags];
            if (newVal.trim()) newTags[idx] = newVal.trim();
            else newTags.splice(idx, 1);
            handleUpdateCombo(comboId, { startTags: newTags });
        } else {
            const newTags = [...combo.endTags];
            if (newVal.trim()) newTags[idx] = newVal.trim();
            else newTags.splice(idx, 1);
            handleUpdateCombo(comboId, { endTags: newTags });
        }
    };

    const handleDeleteTag = (comboId: string, field: 'start' | 'end', idx: number) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        if (field === 'start') {
            const newTags = [...combo.startTags];
            newTags.splice(idx, 1);
            handleUpdateCombo(comboId, { startTags: newTags });
        } else {
            const newTags = [...combo.endTags];
            newTags.splice(idx, 1);
            handleUpdateCombo(comboId, { endTags: newTags });
        }
    };

    const handleAddMiddleBranch = (comboId: string) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        const nextIdx = combo.middleTags.length;
        handleUpdateCombo(comboId, { middleTags: [...combo.middleTags, []] });
        setPendingBranchFocus({ comboId, branchIdx: nextIdx });
    };

    const handleAddMiddleTag = (comboId: string, branchIdx: number, tag: string) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        const newMiddle = [...combo.middleTags];
        newMiddle[branchIdx] = [...newMiddle[branchIdx], tag];
        handleUpdateCombo(comboId, { middleTags: newMiddle });
    };

    const handleUpdateMiddleTag = (comboId: string, branchIdx: number, tagIdx: number, newVal: string) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        const newMiddle = [...combo.middleTags];
        const newBranch = [...newMiddle[branchIdx]];

        if (newVal.trim()) newBranch[tagIdx] = newVal.trim();
        else newBranch.splice(tagIdx, 1);

        newMiddle[branchIdx] = newBranch;
        handleUpdateCombo(comboId, { middleTags: newMiddle });
    };

    const handleDeleteMiddleTag = (comboId: string, branchIdx: number, tagIdx: number) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        const newMiddle = [...combo.middleTags];
        const newBranch = [...newMiddle[branchIdx]];
        newBranch.splice(tagIdx, 1);
        newMiddle[branchIdx] = newBranch;
        handleUpdateCombo(comboId, { middleTags: newMiddle });
    };

    const handleDeleteMiddleBranch = (comboId: string, branchIdx: number) => {
        const combo = familyCombos.find(c => c.id === comboId);
        if (!combo) return;

        const newMiddle = [...combo.middleTags];
        newMiddle.splice(branchIdx, 1);
        handleUpdateCombo(comboId, { middleTags: newMiddle });
    };

    return (
        <div className="p-0"> {/* Removed mb-6, allow parent to control spacing */}
            <div className="flex items-center justify-between mb-6">
                <label className="text-sm font-bold text-indigo-100 flex items-center gap-2">
                    <Users size={16} className="text-emerald-400 fill-emerald-400/20 icon-glow" />
                    Family Combos
                </label>
            </div>

            <div className="space-y-3">
                {familyCombos.map((combo) => (
                    <div key={combo.id} className={`glass rounded-xl p-3 transition-all duration-300 relative group border ${combo.enabled ? 'border-emerald-500/20' : 'border-slate-800 opacity-60'}`}>
                        {/* Background Gradient */}
                        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br transition-opacity duration-500 pointer-events-none ${combo.enabled ? 'from-emerald-500/5 to-transparent opacity-100' : 'opacity-0'}`} />

                        {/* Header: Name & Controls */}
                        <div className="flex items-center gap-2 relative z-10 mb-2 border-b border-white/5 pb-1.5">
                            <input
                                type="checkbox"
                                checked={combo.enabled}
                                onChange={(e) => handleUpdateCombo(combo.id, { enabled: e.target.checked })}
                                className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            />

                            {editingTarget?.comboId === combo.id && editingTarget?.field === 'name' ? (
                                <input
                                    autoFocus
                                    className="bg-slate-800 text-emerald-100 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/50 outline-none min-w-[120px]"
                                    defaultValue={combo.name}
                                    onBlur={(e) => {
                                        const newVal = e.target.value.trim() || combo.name;
                                        handleUpdateCombo(combo.id, { name: newVal });
                                        setEditingTarget(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.currentTarget.blur();
                                    }}
                                />
                            ) : (
                                <span
                                    onClick={() => setEditingTarget({ comboId: combo.id, field: 'name', isActive: true })}
                                    className={`font-bold text-xs cursor-pointer hover:text-emerald-300 transition-colors px-2 py-0.5 rounded hover:bg-white/5 ${combo.enabled ? 'text-emerald-100' : 'text-slate-500'}`}
                                >
                                    {combo.name}
                                </span>
                            )}

                            <IconButton
                                variant="ghost"
                                size="xs"
                                icon={<X size={12} />}
                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"
                                onClick={() => {
                                    const newCombos = familyCombos.filter(c => c.id !== combo.id);
                                    updateFamily(newCombos);
                                }}
                            />
                        </div>

                        {/* Body Tree Structure */}
                        <div className="pl-1 space-y-1.5 "> {/* Reduced indentation and spacing */}

                            {/* Start Tags */}
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] uppercase font-bold text-slate-500 w-12 shrink-0 pt-1.5">Start</span>
                                <div className="flex flex-wrap items-center gap-1.5 flex-1 bg-slate-900/30 p-1 rounded-md border border-slate-800/50 border-dashed min-h-[28px]">
                                    {combo.startTags.map((tag, idx) => (
                                        <EditableTag
                                            key={idx}
                                            isEditing={editingTarget?.comboId === combo.id && editingTarget?.field === 'start' && editingTarget?.tagIdx === idx}
                                            value={tag}
                                            isActive={combo.enabled}
                                            isLast={idx === combo.startTags.length - 1}
                                            onStartEdit={() => setEditingTarget({ comboId: combo.id, field: 'start', tagIdx: idx, isActive: combo.enabled })}
                                            onCommit={(val) => {
                                                handleUpdateTag(combo.id, 'start', idx, val);
                                                setEditingTarget(null);
                                            }}
                                            onDelete={() => handleDeleteTag(combo.id, 'start', idx)}
                                            onNavigate={() => { }}
                                        />
                                    ))}
                                    <input
                                        className="bg-transparent text-[10px] text-slate-500 placeholder-slate-700/50 focus:text-emerald-300 focus:placeholder-emerald-500/50 focus:outline-none min-w-[40px] py-0.5 px-1 border border-transparent focus:border-emerald-500/30 rounded transition-all hover:bg-white/5"
                                        placeholder="+ start"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                handleAddTag(combo.id, 'start', e.currentTarget.value.trim());
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Down Arrow Indicator - Aligned with Tags */}
                            <div className="pl-[3.5rem] flex items-center h-4">
                                <div className="w-px h-full bg-slate-800/50 ml-2"></div>
                                <ArrowDown size={10} className="text-slate-700 ml-1" />
                            </div>

                            {/* Middle Branches */}
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] uppercase font-bold text-slate-500 w-12 shrink-0 pt-1.5">Mid</span>
                                <div className="flex-1 space-y-1.5">
                                    {combo.middleTags.map((branch, bIdx) => (
                                        <div key={bIdx} className="flex items-center gap-1.5 group/branch bg-slate-900/30 p-1 rounded-md border border-slate-800/50 border-dashed min-h-[28px]">
                                            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                                {branch.map((tag, tIdx) => (
                                                    <EditableTag
                                                        key={tIdx}
                                                        isEditing={editingTarget?.comboId === combo.id && editingTarget?.field === 'middle' && editingTarget?.branchIdx === bIdx && editingTarget?.tagIdx === tIdx}
                                                        value={tag}
                                                        isActive={combo.enabled}
                                                        isLast={tIdx === branch.length - 1}
                                                        onStartEdit={() => setEditingTarget({ comboId: combo.id, field: 'middle', branchIdx: bIdx, tagIdx: tIdx, isActive: combo.enabled })}
                                                        onCommit={(val) => {
                                                            handleUpdateMiddleTag(combo.id, bIdx, tIdx, val);
                                                            setEditingTarget(null);
                                                        }}
                                                        onDelete={() => handleDeleteMiddleTag(combo.id, bIdx, tIdx)}
                                                        onNavigate={() => { }}
                                                    />
                                                ))}
                                                <input
                                                    ref={(el) => {
                                                        if (pendingBranchFocus?.comboId === combo.id && pendingBranchFocus?.branchIdx === bIdx && el) {
                                                            el.focus();
                                                            setPendingBranchFocus(null);
                                                        }
                                                    }}
                                                    className="bg-transparent text-[10px] text-slate-500 placeholder-slate-700/50 focus:text-indigo-300 focus:placeholder-indigo-500/50 focus:outline-none min-w-[40px] py-0.5 px-1 border border-transparent focus:border-indigo-500/30 rounded transition-all hover:bg-white/5"
                                                    placeholder="+ mid"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                            handleAddMiddleTag(combo.id, bIdx, e.currentTarget.value.trim());
                                                            e.currentTarget.value = '';
                                                        } else if (e.key === 'Backspace' && !e.currentTarget.value && branch.length === 0) {
                                                            // Remove empty branch
                                                            handleDeleteMiddleBranch(combo.id, bIdx);
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <IconButton
                                                variant="ghost"
                                                size="xs"
                                                icon={<X size={10} />}
                                                className="ml-auto opacity-0 group-hover/branch:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
                                                onClick={() => handleDeleteMiddleBranch(combo.id, bIdx)}
                                            />
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleAddMiddleBranch(combo.id)}
                                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-300 flex items-center gap-1 py-1 px-2 rounded hover:bg-indigo-500/10 transition-colors uppercase tracking-wider w-full justify-center border border-dashed border-slate-800"
                                    >
                                        <Plus size={10} /> Add Branch
                                    </button>
                                </div>
                            </div>

                            {/* Down Arrow Indicator */}
                            <div className="pl-[3.5rem] flex items-center h-4">
                                <div className="w-px h-full bg-slate-800/50 ml-2"></div>
                                <ArrowDown size={10} className="text-slate-700 ml-1" />
                            </div>

                            {/* End Tags */}
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] uppercase font-bold text-slate-500 w-12 shrink-0 pt-1.5">End</span>
                                <div className="flex flex-wrap items-center gap-1.5 flex-1 bg-slate-900/30 p-1 rounded-md border border-slate-800/50 border-dashed min-h-[28px]">
                                    {combo.endTags.map((tag, idx) => (
                                        <EditableTag
                                            key={idx}
                                            isEditing={editingTarget?.comboId === combo.id && editingTarget?.field === 'end' && editingTarget?.tagIdx === idx}
                                            value={tag}
                                            isActive={combo.enabled}
                                            isLast={idx === combo.endTags.length - 1}
                                            onStartEdit={() => setEditingTarget({ comboId: combo.id, field: 'end', tagIdx: idx, isActive: combo.enabled })}
                                            onCommit={(val) => {
                                                handleUpdateTag(combo.id, 'end', idx, val);
                                                setEditingTarget(null);
                                            }}
                                            onDelete={() => handleDeleteTag(combo.id, 'end', idx)}
                                            onNavigate={() => { }}
                                        />
                                    ))}
                                    <input
                                        className="bg-transparent text-[10px] text-slate-500 placeholder-slate-700/50 focus:text-emerald-300 focus:placeholder-emerald-500/50 focus:outline-none min-w-[40px] py-0.5 px-1 border border-transparent focus:border-emerald-500/30 rounded transition-all hover:bg-white/5"
                                        placeholder="+ end"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                handleAddTag(combo.id, 'end', e.currentTarget.value.trim());
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>

            <Button
                variant="outline"
                className="w-full mt-3 h-10 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:bg-slate-800 hover:border-emerald-500/50 hover:text-emerald-300 transition-all hover:shadow-lg hover:shadow-emerald-900/10 group text-xs text-center justify-center"
                icon={<Plus size={14} className="group-hover:text-emerald-400 mr-2" />}
                onClick={() => {
                    const newId = Math.random().toString(36).substring(7);
                    updateFamily([
                        ...familyCombos,
                        {
                            id: newId,
                            name: 'New Family',
                            startTags: [],
                            middleTags: [],
                            endTags: [],
                            enabled: true
                        }
                    ]);
                    setEditingTarget({ comboId: newId, field: 'name', isActive: true });
                }}
            >
                Create New Family Combo
            </Button>
        </div>
    );
};
