import React, { useState, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { useLogContext } from './LogContext';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

const {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, PanelLeftClose, PanelLeft, Zap, Folder, FolderOpen, X, Plus,
    ShieldAlert, Highlighter, Palette
} = Lucide;

const HIGHLIGHT_COLORS = [
    { label: 'Yellow', value: 'bg-yellow-200' },
    { label: 'Red', value: 'bg-red-200' },
    { label: 'Green', value: 'bg-green-200' },
    { label: 'Blue', value: 'bg-blue-200' },
    { label: 'Purple', value: 'bg-purple-200' },
    { label: 'Orange', value: 'bg-orange-200' },
    { label: 'Light Red', value: 'bg-red-100' },
];

const ConfigurationPanel: React.FC = () => {
    const {
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, handleConfigResizeStart,
        currentConfig, updateCurrentRule,
        groupedRoots, collapsedRoots, setCollapsedRoots, handleToggleRoot
    } = useLogContext();

    const [editingTag, setEditingTag] = useState<{ groupIdx: number, termIdx: number, value: string, isActive: boolean } | null>(null);
    const [newHighlightWord, setNewHighlightWord] = useState('');
    const [newHighlightColor, setNewHighlightColor] = useState('');
    const highlightInputRef = useRef<HTMLInputElement>(null);

    const isHexColor = (color: string) => /^#[0-9A-F]{6}$/i.test(color);
    const onToggle = () => setIsPanelOpen(!isPanelOpen);

    const onToggleRootCollapse = (root: string) => {
        setCollapsedRoots(prev => {
            const next = new Set(prev);
            if (next.has(root)) next.delete(root);
            else next.add(root);
            return next;
        });
    };

    if (!currentConfig) {
        return (
            <div className="w-[500px] bg-slate-900 border-r border-slate-800 p-6 flex items-center justify-center text-slate-500">
                Select or Create a Rule
            </div>
        );
    }

    return (
        <div
            className={`${isPanelOpen ? '' : 'w-12'} bg-gradient-to-br from-slate-900 to-slate-950 border-r border-slate-800 flex flex-col h-full shadow-2xl z-20 custom-scrollbar relative shrink-0`}
            style={{ width: isPanelOpen ? configPanelWidth : undefined }}
        >
            {isPanelOpen && (
                <div
                    className="absolute top-0 bottom-0 -right-1 w-2 cursor-col-resize z-50 hover:bg-indigo-500/20 transition-colors"
                    onMouseDown={handleConfigResizeStart}
                />
            )}

            <div className="absolute top-[18px] right-[-10px] z-50">
                <Button
                    variant="secondary"
                    className="w-8 h-8 rounded-full p-0 bg-indigo-600 border-2 border-indigo-400 hover:bg-indigo-500 shadow-xl flex items-center justify-center transition-transform hover:scale-110"
                    onClick={onToggle}
                >
                    {isPanelOpen ? <PanelLeftClose size={20} className="text-white" /> : <PanelLeft size={20} className="text-white" />}
                </Button>
            </div>
            {isPanelOpen ? (
                <div className="p-6 overflow-y-auto h-full">
                    <div className="mb-6">
                        <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Mission Name</label>
                        <input className="w-full bg-slate-800/50 rounded-xl px-2 py-1 text-2xl font-black text-slate-200 focus:outline-none border-b-2 border-transparent focus:border-indigo-500 placeholder-slate-600 transition-all" value={currentConfig.name} onChange={(e) => updateCurrentRule({ name: e.target.value })} placeholder="Untitled Rule" />
                    </div>
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4"><label className="text-sm font-bold text-slate-300 flex items-center gap-2"><Zap size={16} className="text-yellow-500 fill-yellow-500" /> Happy Combos</label></div>
                        <div className="space-y-4">
                            {groupedRoots.map(({ root, isRootEnabled, items }, rootIdx) => (
                                <div key={rootIdx} className={`bg-slate-800/40 rounded-2xl p-4 border flex flex-col gap-2 relative group transition-colors ${isRootEnabled ? 'border-slate-700/50' : 'border-slate-800 opacity-60'}`}>
                                    <IconButton
                                        variant="delete"
                                        size="sm"
                                        icon={<X size={14} />}
                                        tooltip="Delete Group"
                                        onClick={() => {
                                            const newIncludes = currentConfig.includeGroups.filter(g => (g[0] || '').trim() !== root);
                                            const newDisabled = (currentConfig.disabledGroups || []).filter(g => (g[0] || '').trim() !== root);
                                            updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
                                        }}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 z-20"
                                    />

                                    <div className="flex items-center gap-2 relative z-10 self-start">
                                        <input type="checkbox" checked={isRootEnabled} onChange={(e) => handleToggleRoot(root, e.target.checked)} className="accent-indigo-500 w-4 h-4 cursor-pointer" />
                                        <IconButton
                                            onClick={() => onToggleRootCollapse(root)}
                                            icon={collapsedRoots.has(root) ? <Folder size={14} /> : <FolderOpen size={14} />}
                                            className={`rounded transition-colors ${isRootEnabled ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/30' : 'text-slate-500 hover:text-slate-400 hover:bg-slate-700'} ${collapsedRoots.has(root) ? 'bg-transparent' : 'bg-indigo-600/20'}`}
                                            size="sm"
                                        />

                                        {editingTag?.groupIdx === -1 && editingTag?.value === root ? (
                                            <input autoFocus className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg text-sm font-bold border border-indigo-500/40 min-w-[80px] outline-none" value={newHighlightWord} onChange={(e) => setNewHighlightWord(e.target.value)}
                                                onBlur={() => {
                                                    if (!newHighlightWord.trim()) { setEditingTag(null); return; }
                                                    const newIncludes = currentConfig.includeGroups.map(g => (g[0] || '').trim() === root ? [newHighlightWord, ...g.slice(1)] : g);
                                                    const newDisabled = (currentConfig.disabledGroups || []).map(g => (g[0] || '').trim() === root ? [newHighlightWord, ...g.slice(1)] : g);
                                                    updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
                                                    setEditingTag(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const newRootName = newHighlightWord.trim();
                                                        if (newRootName && newRootName !== root) {
                                                            const newIncludes = currentConfig.includeGroups.map(g => (g[0] || '').trim() === root ? [newRootName, ...g.slice(1)] : g);
                                                            const newDisabled = (currentConfig.disabledGroups || []).map(g => (g[0] || '').trim() === root ? [newRootName, ...g.slice(1)] : g);
                                                            updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
                                                        }
                                                        setEditingTag(null);
                                                    }
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        const el = document.querySelector(`input[data-root-idx="${rootIdx}"][data-branch-idx="0"]`) as HTMLInputElement;
                                                        el?.focus();
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <span
                                                data-root-idx={rootIdx}
                                                data-is-root="true"
                                                onClick={(e) => { e.stopPropagation(); setNewHighlightWord(root); setEditingTag({ groupIdx: -1, termIdx: -1, value: root, isActive: true }); }}
                                                className={`font-bold text-sm cursor-pointer border border-transparent hover:border-indigo-500/50 rounded px-2 py-1 transition-all ${isRootEnabled ? 'text-indigo-200' : 'text-slate-500 line-through'}`}>
                                                {root || '(Root Tag)'}
                                            </span>
                                        )}
                                    </div>

                                    {!collapsedRoots.has(root) && (
                                        <div className="relative pl-6 ml-2.5 flex flex-col gap-2 mt-1">
                                            <div className="absolute left-0 top-[-8px] bottom-4 w-px bg-slate-600"></div>
                                            {items.map((item, itemIdx) => {
                                                const branchTags = item.group.slice(1);
                                                return (
                                                    <div key={itemIdx} className="relative flex flex-col gap-0.5">
                                                        <div className="absolute -left-6 top-[13px] w-6 h-px">
                                                            <div className="absolute right-0 bottom-0 w-4 h-4 border-l border-b border-slate-600 rounded-bl-xl translate-y-1/2"></div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1 pl-1">
                                                            {branchTags.map((term, tIdx) => {
                                                                const isEditing = editingTag?.groupIdx === item.originalIdx && editingTag?.termIdx === tIdx + 1 && editingTag.isActive === item.active;

                                                                return (
                                                                    <React.Fragment key={tIdx}>
                                                                        {tIdx > 0 && <div className="h-0.5 w-1 bg-indigo-500/50 rounded-full"></div>}
                                                                        {isEditing ? (
                                                                            <input autoFocus className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs font-medium border border-indigo-500 w-20 outline-none" value={editingTag.value} onChange={(e) => setEditingTag({ ...editingTag, value: e.target.value })}
                                                                                onBlur={() => {
                                                                                    const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                                                    const newGroups = [...sourceArray];
                                                                                    if (editingTag.value.trim()) newGroups[item.originalIdx] = [...newGroups[item.originalIdx]];
                                                                                    if (editingTag.value.trim()) newGroups[item.originalIdx][tIdx + 1] = editingTag.value.trim();
                                                                                    else newGroups[item.originalIdx] = newGroups[item.originalIdx].filter((_, i) => i !== tIdx + 1);

                                                                                    if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                    else updateCurrentRule({ disabledGroups: newGroups });
                                                                                    setEditingTag(null);
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        if (tIdx === branchTags.length - 1) {
                                                                                            const el = document.querySelector(`input[data-root-idx="${rootIdx}"][data-branch-idx="${itemIdx}"]`) as HTMLInputElement;
                                                                                            el?.focus();
                                                                                        } else {
                                                                                            e.currentTarget.blur();
                                                                                        }
                                                                                    }
                                                                                    if (e.key === 'Backspace' && !editingTag.value) {
                                                                                        e.preventDefault();
                                                                                        const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);

                                                                                        if (tIdx === 0) {
                                                                                            // Delete entire branch
                                                                                            const isLastBranch = items.length === 1;
                                                                                            if (isLastBranch) {
                                                                                                // Don't remove, just reset to root only
                                                                                                const newGroups = [...sourceArray];
                                                                                                newGroups[item.originalIdx] = [root];
                                                                                                if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                                else updateCurrentRule({ disabledGroups: newGroups });
                                                                                            } else {
                                                                                                const newGroups = sourceArray.filter((_, i) => i !== item.originalIdx);
                                                                                                if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                                else updateCurrentRule({ disabledGroups: newGroups });
                                                                                            }

                                                                                            // Focus logic
                                                                                            if (itemIdx > 0) {
                                                                                                const prevItem = items[itemIdx - 1];
                                                                                                const prevBranchTags = prevItem.group.slice(1);
                                                                                                if (prevBranchTags.length > 0) {
                                                                                                    setEditingTag({
                                                                                                        groupIdx: prevItem.originalIdx,
                                                                                                        termIdx: prevBranchTags.length,
                                                                                                        value: prevBranchTags[prevBranchTags.length - 1],
                                                                                                        isActive: prevItem.active
                                                                                                    });
                                                                                                } else {
                                                                                                    setEditingTag(null);
                                                                                                }
                                                                                            } else {
                                                                                                // No previous branch -> Focus Root
                                                                                                setNewHighlightWord(root);
                                                                                                setEditingTag({
                                                                                                    groupIdx: -1,
                                                                                                    termIdx: -1,
                                                                                                    value: root,
                                                                                                    isActive: true
                                                                                                });
                                                                                            }
                                                                                        } else {
                                                                                            // Normal delete tag (tIdx > 0)
                                                                                            const newGroups = [...sourceArray];
                                                                                            newGroups[item.originalIdx] = newGroups[item.originalIdx].filter((_, i) => i !== tIdx + 1);

                                                                                            if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                            else updateCurrentRule({ disabledGroups: newGroups });

                                                                                            setEditingTag({
                                                                                                groupIdx: item.originalIdx,
                                                                                                termIdx: tIdx,
                                                                                                value: branchTags[tIdx - 1],
                                                                                                isActive: item.active
                                                                                            });
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            />
                                                                        ) : (
                                                                            <div onClick={(e) => { e.stopPropagation(); setEditingTag({ groupIdx: item.originalIdx, termIdx: tIdx + 1, value: term, isActive: item.active }); }} className={`flex items-center bg-slate-900 px-2 py-1 rounded text-xs border cursor-pointer transition-colors ${item.active ? 'text-slate-300 border-slate-700 hover:border-indigo-500' : 'text-slate-600 border-slate-800'}`}>
                                                                                <span className={!item.active ? 'line-through' : ''}>{term}</span>
                                                                                <IconButton
                                                                                    variant="ghost"
                                                                                    size="xs"
                                                                                    icon={<X size={10} />}
                                                                                    className="ml-1 hover:text-red-400"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                                                        const newGroups = [...sourceArray];
                                                                                        newGroups[item.originalIdx] = newGroups[item.originalIdx].filter((_, i) => i !== tIdx + 1);

                                                                                        if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                        else updateCurrentRule({ disabledGroups: newGroups });
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </React.Fragment>
                                                                )
                                                            })}
                                                            <input className="w-16 bg-transparent text-xs text-slate-500 placeholder-slate-600 focus:text-slate-200 focus:outline-none border-b border-transparent focus:border-indigo-500 transition-all py-1" placeholder="+ tag"
                                                                data-root-idx={rootIdx}
                                                                data-branch-idx={itemIdx}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Backspace' && !e.currentTarget.value) {
                                                                        e.preventDefault();
                                                                        const branchTags = item.group.slice(1);
                                                                        if (branchTags.length > 0) {
                                                                            setEditingTag({
                                                                                groupIdx: item.originalIdx,
                                                                                termIdx: branchTags.length, // last tag
                                                                                value: branchTags[branchTags.length - 1],
                                                                                isActive: item.active
                                                                            });
                                                                        } else {
                                                                            // Branch empty, delete branch
                                                                            const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                                            const isLastBranch = items.length === 1;

                                                                            if (isLastBranch) {
                                                                                const newGroups = [...sourceArray];
                                                                                newGroups[item.originalIdx] = [root];
                                                                                if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                else updateCurrentRule({ disabledGroups: newGroups });
                                                                            } else {
                                                                                const newGroups = sourceArray.filter((_, i) => i !== item.originalIdx);
                                                                                if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                                else updateCurrentRule({ disabledGroups: newGroups });
                                                                            }

                                                                            // Navigate to previous
                                                                            if (itemIdx > 0) {
                                                                                const prevItem = items[itemIdx - 1];
                                                                                const prevBranchTags = prevItem.group.slice(1);
                                                                                if (prevBranchTags.length > 0) {
                                                                                    setEditingTag({
                                                                                        groupIdx: prevItem.originalIdx,
                                                                                        termIdx: prevBranchTags.length,
                                                                                        value: prevBranchTags[prevBranchTags.length - 1],
                                                                                        isActive: prevItem.active
                                                                                    });
                                                                                } else {
                                                                                    setTimeout(() => {
                                                                                        const el = document.querySelector(`input[data-root-idx="${rootIdx}"][data-branch-idx="${itemIdx - 1}"]`) as HTMLInputElement;
                                                                                        el?.focus();
                                                                                    }, 50);
                                                                                }
                                                                            } else {
                                                                                // No previous branch -> Focus Root
                                                                                setNewHighlightWord(root);
                                                                                setEditingTag({
                                                                                    groupIdx: -1,
                                                                                    termIdx: -1,
                                                                                    value: root,
                                                                                    isActive: true
                                                                                });
                                                                            }
                                                                        }
                                                                    }
                                                                    if (e.key === 'ArrowUp') {
                                                                        e.preventDefault();
                                                                        const targetBranchIdx = itemIdx - 1;
                                                                        if (targetBranchIdx >= 0) {
                                                                            const el = document.querySelector(`input[data-root-idx="${rootIdx}"][data-branch-idx="${targetBranchIdx}"]`) as HTMLInputElement;
                                                                            el?.focus();
                                                                        } else {
                                                                            const rootEl = document.querySelector(`span[data-root-idx="${rootIdx}"][data-is-root="true"]`) as HTMLElement;
                                                                            rootEl?.click();
                                                                        }
                                                                    }
                                                                    if (e.key === 'ArrowDown') {
                                                                        e.preventDefault();
                                                                        const targetBranchIdx = itemIdx + 1;
                                                                        if (targetBranchIdx < items.length) {
                                                                            const el = document.querySelector(`input[data-root-idx="${rootIdx}"][data-branch-idx="${targetBranchIdx}"]`) as HTMLInputElement;
                                                                            el?.focus();
                                                                        } else {
                                                                            // Create new branch
                                                                            updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [root]] });
                                                                            setTimeout(() => {
                                                                                const el = document.querySelector(`input[data-root-idx="${rootIdx}"][data-branch-idx="${targetBranchIdx}"]`) as HTMLInputElement;
                                                                                el?.focus();
                                                                            }, 100);
                                                                        }
                                                                    }
                                                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                                        const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                                        const newGroups = [...sourceArray];
                                                                        const cleanGroup = newGroups[item.originalIdx].filter(t => t !== '');
                                                                        newGroups[item.originalIdx] = [...cleanGroup, e.currentTarget.value.trim()];

                                                                        if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                        else updateCurrentRule({ disabledGroups: newGroups });

                                                                        e.currentTarget.value = '';
                                                                    }
                                                                }}
                                                            />
                                                            <IconButton
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={<X size={12} />}
                                                                className="ml-auto hover:text-red-400 hover:bg-slate-700"
                                                                title="Remove Branch"
                                                                onClick={() => {
                                                                    const sourceArray = item.active ? currentConfig.includeGroups : (currentConfig.disabledGroups || []);
                                                                    const isLastBranch = items.length === 1;

                                                                    if (isLastBranch) {
                                                                        const newGroups = [...sourceArray];
                                                                        newGroups[item.originalIdx] = [root];
                                                                        if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                        else updateCurrentRule({ disabledGroups: newGroups });
                                                                    } else {
                                                                        const newGroups = sourceArray.filter((_, i) => i !== item.originalIdx);
                                                                        if (item.active) updateCurrentRule({ includeGroups: newGroups });
                                                                        else updateCurrentRule({ disabledGroups: newGroups });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-[13px] w-6 h-px">
                                                    <div className="absolute right-0 bottom-0 w-4 h-4 border-l border-b border-slate-600 rounded-bl-xl translate-y-1/2"></div>
                                                </div>
                                                <div className="pl-2">
                                                    <Button variant="outline" size="sm" icon={<Plus size={12} />} onClick={() => updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [root]] })}>
                                                        Add Branch
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <Button variant="outline" className="w-full py-3 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 hover:bg-slate-800 hover:border-slate-600 hover:text-indigo-400 hover:scale-100" icon={<Plus size={18} />} onClick={() => {
                                let newRootName = 'NewRoot';
                                let counter = 1;
                                const existingRoots = new Set(groupedRoots.map(g => g.root));
                                while (existingRoots.has(newRootName)) {
                                    newRootName = `NewRoot (${counter})`;
                                    counter++;
                                }
                                updateCurrentRule({ includeGroups: [...currentConfig.includeGroups, [newRootName]] });
                            }}>New Combo Tree</Button>
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><ShieldAlert size={16} className="text-red-500" /> Block List</label>
                        <div className="bg-red-900/10 rounded-2xl p-4 border border-red-900/20 border-dashed relative">
                            <div className="flex flex-wrap gap-2">
                                {currentConfig.excludes.map((exc, idx) => (exc.trim() !== '' ? (<div key={idx} className="flex items-center bg-red-500/10 text-red-300 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-500/20 shadow-sm"> <span>{exc}</span>
                                    <IconButton variant="ghost" size="xs" icon={<X size={12} />} className="ml-2 text-red-400/50 hover:text-red-300" onClick={() => updateCurrentRule({ excludes: currentConfig.excludes.filter((_, i) => i !== idx) })} />
                                </div>) : null))}
                                <input className="bg-slate-700 text-sm text-slate-200 placeholder-slate-400 focus:bg-slate-600 focus:outline-none py-1.5 px-3 rounded-lg border border-slate-700/50 focus:border-red-500/50 transition-colors min-w-[120px]" placeholder="+ block word..." onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { updateCurrentRule({ excludes: [...currentConfig.excludes.filter(t => t !== ''), e.currentTarget.value.trim()] }); e.currentTarget.value = ''; } }} />
                            </div>
                        </div>
                    </div>
                    <div className="mt-8">
                        <label className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Highlighter size={16} className="text-pink-400" /> Color Highlights</label>
                        <div className="bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-700 mb-2">
                            <div className="flex flex-col gap-2 mb-4">
                                <div className="flex gap-1 flex-wrap">
                                    {HIGHLIGHT_COLORS.map(c => (<button key={c.value} onClick={() => { setNewHighlightColor(c.value); highlightInputRef.current?.focus(); }} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${c.value} ${newHighlightColor === c.value ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80'}`} title={c.label} />))}
                                    <label className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center overflow-hidden bg-slate-700 relative ${isHexColor(newHighlightColor) ? 'border-white scale-110 shadow-md' : 'border-slate-500 opacity-80'}`} title="Custom Color"> {isHexColor(newHighlightColor) && (<div className="absolute inset-0" style={{ backgroundColor: newHighlightColor }}></div>)} <Palette size={12} className={`relative z-10 ${isHexColor(newHighlightColor) ? 'text-white drop-shadow-md' : 'text-slate-400'}`} /> <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={isHexColor(newHighlightColor) ? newHighlightColor : '#000000'} onChange={(e) => { setNewHighlightColor(e.target.value); highlightInputRef.current?.focus(); }} /> </label>
                                </div>
                                <input ref={highlightInputRef} className="w-full bg-slate-700 text-sm text-slate-200 placeholder-slate-400 focus:bg-slate-600 focus:outline-none py-1.5 px-3 rounded-lg border border-slate-700/50 focus:border-pink-500 transition-colors" placeholder="Word to color..." value={newHighlightWord} onChange={(e) => setNewHighlightWord(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newHighlightWord.trim()) { const h = { id: crypto.randomUUID(), keyword: newHighlightWord.trim(), color: newHighlightColor || HIGHLIGHT_COLORS[0].value }; updateCurrentRule({ highlights: [...(currentConfig.highlights || []), h] }); setNewHighlightWord(''); } }} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(currentConfig.highlights || []).map((h, i) => {
                                    const isHex = isHexColor(h.color); return (<div key={h.id} style={isHex ? { backgroundColor: h.color } : undefined} className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold text-slate-900 border border-black/10 ${!isHex ? h.color : ''}`}> {h.keyword} {i < 5 && <span className="text-[9px] opacity-50 ml-1">(#{i + 1})</span>}
                                        <IconButton variant="ghost" size="xs" icon={<X size={12} />} className="text-slate-800/50 hover:text-black" onClick={() => updateCurrentRule({ highlights: (currentConfig.highlights || []).filter(item => item.id !== h.id) })} />
                                    </div>);
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center pt-16 gap-4">
                    <div className="vertical-text text-slate-500 font-bold tracking-widest text-xs uppercase transform -rotate-180" style={{ writingMode: 'vertical-rl' }}>Configuration</div>
                </div>
            )
            }
        </div >
    );
};

export default ConfigurationPanel;
