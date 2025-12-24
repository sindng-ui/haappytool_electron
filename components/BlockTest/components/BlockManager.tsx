import React, { useState } from 'react';
import { CommandBlock } from '../types';
import * as Lucide from 'lucide-react';

interface BlockManagerProps {
    blocks: CommandBlock[];
    onAddBlock: (block: CommandBlock) => void;
    onUpdateBlock: (block: CommandBlock) => void;
    onDeleteBlock: (id: string) => void;
}

const BlockManager: React.FC<BlockManagerProps> = ({ blocks, onAddBlock, onUpdateBlock, onDeleteBlock }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingBlock, setEditingBlock] = useState<CommandBlock | null>(null);

    const [isPredefinedOpen, setPredefinedOpen] = useState(true);
    const [isCustomOpen, setCustomOpen] = useState(true);

    // Form state
    const [name, setName] = useState('');
    const [commands, setCommands] = useState('');

    const handleEdit = (block: CommandBlock) => {
        // if (block.type === 'predefined') return; // Allow editing predefined
        setEditingBlock(block);
        setName(block.name);
        setCommands(block.commands.join('\n'));
        setIsEditing(true);
    };

    const handleCreate = () => {
        setEditingBlock(null);
        setName('');
        setCommands('');
        setIsEditing(true);
    };

    const handleSave = () => {
        const cmdList = commands.split('\n').filter(line => line.trim() !== '');

        if (editingBlock) {
            onUpdateBlock({
                ...editingBlock,
                name,
                commands: cmdList
            });
        } else {
            onAddBlock({
                id: `block_${Date.now()}`,
                name,
                commands: cmdList,
                type: 'custom'
            });
        }
        setIsEditing(false);
    };

    // Close on Escape
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isEditing && e.key === 'Escape') {
                setIsEditing(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditing]);

    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-80">
            {/* ... Header ... */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-slate-200">Blocks</h2>
                <button
                    onClick={handleCreate}
                    className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                >
                    <Lucide.Plus size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">

                <div>
                    <div
                        className="flex items-center gap-1 cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2 px-2 select-none"
                        onClick={() => setPredefinedOpen(!isPredefinedOpen)}
                    >
                        {isPredefinedOpen ? <Lucide.ChevronDown size={14} /> : <Lucide.ChevronRight size={14} />}
                        <span className="text-xs font-semibold uppercase">Predefined</span>
                    </div>

                    {isPredefinedOpen && (
                        <div className="space-y-2">
                            {blocks.filter(b => b.type === 'predefined').map(block => (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add_block', blockId: block.id }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="group p-2 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-grab hover:border-indigo-400 opacity-80"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-medium">{block.name}</span>
                                            <div className="text-xs text-slate-500 truncate">{block.commands.length} cmds</div>
                                        </div>
                                        <div className="hidden group-hover:flex gap-2">
                                            <button onClick={() => handleEdit(block)} className="p-2 text-slate-500 hover:text-indigo-500 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-full transition-all">
                                                <Lucide.Edit2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div
                        className="flex items-center gap-1 cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2 px-2 mt-4 select-none"
                        onClick={() => setCustomOpen(!isCustomOpen)}
                    >
                        {isCustomOpen ? <Lucide.ChevronDown size={14} /> : <Lucide.ChevronRight size={14} />}
                        <span className="text-xs font-semibold uppercase">Custom</span>
                    </div>

                    {isCustomOpen && (
                        <div className="space-y-2">
                            {blocks.filter(b => b.type === 'custom').map(block => (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add_block', blockId: block.id }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="group p-2 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 hover:border-indigo-500 transition-colors relative cursor-grab"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-medium text-slate-800 dark:text-slate-200">{block.name}</span>
                                            <div className="text-xs text-slate-500">{block.commands.length} cmds</div>
                                        </div>
                                        <div className="hidden group-hover:flex gap-2">
                                            <button onClick={() => handleEdit(block)} className="p-2 text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
                                                <Lucide.Edit2 size={18} />
                                            </button>
                                            <button onClick={() => onDeleteBlock(block.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all">
                                                <Lucide.Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {blocks.filter(b => b.type === 'custom').length === 0 && (
                                <div className="text-center text-slate-400 py-4 text-sm">No custom blocks</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-96 shadow-xl border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200">
                            {editingBlock ? 'Edit Block' : 'New Block'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Enter block name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Commands (one per line)</label>
                                <textarea
                                    value={commands}
                                    onChange={e => setCommands(e.target.value)}
                                    className="w-full h-32 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="sdb shell input keyevent 66&#10;adb shell input tap 100 100"
                                />
                                <p className="text-xs text-slate-500 mt-1">Directly type adb/sdb commands.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!name}
                                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlockManager;
