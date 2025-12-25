import React, { useState } from 'react';
import { CommandBlock } from '../types';
import * as Lucide from 'lucide-react';
import { THEME } from '../theme';

interface BlockManagerProps {
    blocks: CommandBlock[];
    onAddBlock: (block: CommandBlock) => void;
    onUpdateBlock: (block: CommandBlock) => void;
    onDeleteBlock: (id: string) => void;
}

const BlockManager: React.FC<BlockManagerProps> = ({ blocks, onAddBlock, onUpdateBlock, onDeleteBlock }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingBlock, setEditingBlock] = useState<CommandBlock | null>(null);

    const [isPredefinedOpen, setPredefinedOpen] = useState(() => localStorage.getItem('blockManager_isPredefinedOpen') !== 'false');
    const [isCustomOpen, setCustomOpen] = useState(() => localStorage.getItem('blockManager_isCustomOpen') !== 'false');
    const [isSpecialOpen, setSpecialOpen] = useState(() => localStorage.getItem('blockManager_isSpecialOpen') !== 'false');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBlocks = blocks.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

    React.useEffect(() => {
        localStorage.setItem('blockManager_isPredefinedOpen', String(isPredefinedOpen));
        localStorage.setItem('blockManager_isCustomOpen', String(isCustomOpen));
        localStorage.setItem('blockManager_isSpecialOpen', String(isSpecialOpen));
    }, [isPredefinedOpen, isCustomOpen, isSpecialOpen]);

    // Auto-expand categories on search
    React.useEffect(() => {
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            const matching = blocks.filter(b => b.name.toLowerCase().includes(lowerTerm));
            if (matching.some(b => b.type === 'special')) setSpecialOpen(true);
            if (matching.some(b => b.type === 'predefined')) setPredefinedOpen(true);
            if (matching.some(b => b.type === 'custom')) setCustomOpen(true);
        }
    }, [searchTerm, blocks]);

    // Form state
    const [name, setName] = useState('');
    const [commands, setCommands] = useState('');

    // ... (handleEdit, handleCreate, handleSave remain same, no need to replace if I target carefully)
    // Actually, I need to replace the render part mostly.

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
        <div className={`flex flex-col h-full w-72 ${THEME.sidebar.container}`}>
            {/* ... Header ... */}
            {/* [LEFT SIDEBAR HEADER BACKGROUND] */}
            <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center backdrop-blur-sm ${THEME.sidebar.header}`}>
                <h2 className={`font-bold ${THEME.sidebar.text}`}>Blocks</h2>
                <button
                    onClick={handleCreate}
                    className="p-2.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    <Lucide.Plus size={18} />
                </button>
            </div>

            {/* Search Bar */}
            <div className={`px-4 py-3 ${THEME.sidebar.search.container}`}>
                <div className="relative group">
                    <Lucide.Search className="absolute left-2.5 top-2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                    <input
                        type="text"
                        placeholder="Search blocks..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all shadow-sm ${THEME.sidebar.search.input}`}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">

                <div className="mb-6">
                    <div
                        className={`flex items-center gap-1 cursor-pointer mb-2 px-2 select-none transition-colors ${THEME.sidebar.category.header}`}
                        onClick={() => setSpecialOpen(!isSpecialOpen)}
                    >
                        <div className={`transition-transform duration-200 ${isSpecialOpen ? 'rotate-0' : '-rotate-90'}`}>
                            <Lucide.ChevronDown size={14} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider">Special</span>
                        <span className={`text-[10px] font-normal ml-auto px-1.5 py-0.5 rounded-full ${THEME.sidebar.category.count}`}>
                            {filteredBlocks.filter(b => b.type === 'special').length}
                        </span>
                    </div>

                    {isSpecialOpen && (
                        <div className="space-y-1">
                            {filteredBlocks.filter(b => b.type === 'special').map(block => (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add_block', blockId: block.id }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className={`group p-2.5 rounded-lg border cursor-grab transition-all shadow-sm hover:shadow-md backdrop-blur-sm ${THEME.sidebar.item.special}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <Lucide.Moon size={14} className="text-violet-400" />
                                            <span className={`font-medium text-sm ${THEME.sidebar.text}`}>{block.name}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div
                        className={`flex items-center gap-1 cursor-pointer mb-2 px-2 select-none transition-colors ${THEME.sidebar.category.header}`}
                        onClick={() => setPredefinedOpen(!isPredefinedOpen)}
                    >
                        <div className={`transition-transform duration-200 ${isPredefinedOpen ? 'rotate-0' : '-rotate-90'}`}>
                            <Lucide.ChevronDown size={14} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider">Predefined</span>
                        <span className={`text-[10px] font-normal ml-auto px-1.5 py-0.5 rounded-full ${THEME.sidebar.category.count}`}>
                            {filteredBlocks.filter(b => b.type === 'predefined').length}
                        </span>
                    </div>

                    {isPredefinedOpen && (
                        <div className="space-y-1">
                            {filteredBlocks.filter(b => b.type === 'predefined').map(block => (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add_block', blockId: block.id }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className={`group p-1.5 rounded-lg border cursor-grab transition-all shadow-sm hover:shadow-md backdrop-blur-sm ${THEME.sidebar.item.predefined}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className={`font-medium text-sm ${THEME.sidebar.text}`}>{block.name}</span>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">{block.commands.length} cmds</div>
                                        </div>
                                        <div className="hidden group-hover:flex gap-2">
                                            <button onClick={() => handleEdit(block)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all">
                                                <Lucide.Edit2 size={16} />
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
                        className={`flex items-center gap-1 cursor-pointer mb-2 px-2 mt-6 select-none transition-colors ${THEME.sidebar.category.header}`}
                        onClick={() => setCustomOpen(!isCustomOpen)}
                    >
                        <div className={`transition-transform duration-200 ${isCustomOpen ? 'rotate-0' : '-rotate-90'}`}>
                            <Lucide.ChevronDown size={14} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider">Custom</span>
                        <span className={`text-[10px] font-normal ml-auto px-1.5 py-0.5 rounded-full ${THEME.sidebar.category.count}`}>
                            {filteredBlocks.filter(b => b.type === 'custom').length}
                        </span>
                    </div>

                    {isCustomOpen && (
                        <div className="space-y-1">
                            {filteredBlocks.filter(b => b.type === 'custom').map(block => (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add_block', blockId: block.id }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className={`group p-1.5 rounded-lg border transition-all relative cursor-grab shadow-sm hover:shadow-md ${THEME.sidebar.item.custom}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className={`font-medium text-sm ${THEME.sidebar.text}`}>{block.name}</span>
                                            <div className="text-xs text-slate-500 mt-0.5">{block.commands.length} cmds</div>
                                        </div>
                                        <div className="hidden group-hover:flex gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg pl-1">
                                            <button onClick={() => handleEdit(block)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all">
                                                <Lucide.Edit2 size={16} />
                                            </button>
                                            <button onClick={() => onDeleteBlock(block.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all">
                                                <Lucide.Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredBlocks.filter(b => b.type === 'custom').length === 0 && (
                                <div className="text-center text-slate-400 py-8 text-sm flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg mx-2">
                                    <Lucide.BoxSelect size={24} className="opacity-20" />
                                    <span>No custom blocks</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-96 shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
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
