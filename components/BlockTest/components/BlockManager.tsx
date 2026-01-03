import React, { useState, useRef } from 'react';
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

    // Suggestion State
    const [activeField, setActiveField] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [commands, setCommands] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);

    // Refs for all inputs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const logCommandRef = useRef<HTMLInputElement>(null);
    const logFileNameRef = useRef<HTMLInputElement>(null);
    const stopCommandRef = useRef<HTMLInputElement>(null);

    const SPECIAL_VARS = [
        { label: '$(loop_total)', desc: 'Total loop count' },
        { label: '$(loop_index)', desc: 'Current loop index (1-based)' },
        { label: '$(time_current)', desc: 'Current local time (yyyy-mm-dd...)' },
        { label: '$(time_start)', desc: 'Pipeline start time' },
    ];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSuggestionIndex(prev => (prev + 1) % SPECIAL_VARS.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSuggestionIndex(prev => (prev - 1 + SPECIAL_VARS.length) % SPECIAL_VARS.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            insertVariable(SPECIAL_VARS[suggestionIndex].label);
        }
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        field: 'commands' | 'logCommand' | 'logFileName' | 'stopCommand',
        setter: (val: string) => void
    ) => {
        const val = e.target.value;
        setter(val);
        if (field !== 'commands' && editingBlock) {
            setEditingBlock({ ...editingBlock, [field]: val });
        }

        setActiveField(field);

        // Simple trigger: if last char typed is '$' or we are typing a variable
        const selectionStart = e.target.selectionStart || val.length;
        const textBeforeCursor = val.substring(0, selectionStart);

        if (textBeforeCursor.endsWith('$')) {
            setShowSuggestions(true);
            setSuggestionIndex(0);
        } else if (textBeforeCursor.match(/\$\([a-z_]*$/)) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const insertVariable = (variable: string) => {
        let inputRef: HTMLInputElement | HTMLTextAreaElement | null = null;

        if (activeField === 'commands') inputRef = textareaRef.current;
        else if (activeField === 'logCommand') inputRef = logCommandRef.current;
        else if (activeField === 'logFileName') inputRef = logFileNameRef.current;
        else if (activeField === 'stopCommand') inputRef = stopCommandRef.current;

        if (!inputRef) return;

        const start = inputRef.selectionStart || 0;
        const end = inputRef.selectionEnd || 0;
        const val = inputRef.value;

        // Find where the variable starts (the '$')
        let prefix = val.substring(0, start);
        const match = prefix.match(/\$?(\([a-z_]*)?$/);
        const replaceLength = match ? match[0].length : 0;

        const newVal = val.substring(0, start - replaceLength) + variable + val.substring(end);

        // Update State
        if (activeField === 'commands') setCommands(newVal);
        else if (editingBlock && activeField) {
            setEditingBlock({ ...editingBlock, [activeField]: newVal });
        }

        setShowSuggestions(false);
        setSuggestionIndex(0);

        // Restore focus and cursor
        setTimeout(() => {
            if (inputRef) {
                const newCursorPos = start - replaceLength + variable.length;
                inputRef.focus();
                inputRef.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

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
            if (e.key === 'Escape') {
                if (showSuggestions) {
                    setShowSuggestions(false);
                    e.stopPropagation();
                    return;
                }
                if (isEditing) {
                    setIsEditing(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditing, showSuggestions]);

    return (
        <div className={`flex flex-col h-full w-72 ${THEME.sidebar.container}`}>
            {/* ... Header ... */}
            {/* [LEFT SIDEBAR HEADER BACKGROUND] */}
            <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center backdrop-blur-sm ${THEME.sidebar.header}`}>
                <h2 className={`font-bold ${THEME.sidebar.text}`}>Blocks</h2>
                <button
                    onClick={handleCreate}
                    className="p-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    <Lucide.Plus size={18} />
                </button>
            </div>

            {/* Search Bar */}
            <div className={`px-4 py-2.5 ${THEME.sidebar.search.container}`}>
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
                        <span className={`text-[10px] font-normal ml-auto px-1.5 py-0.25 rounded-full ${THEME.sidebar.category.count}`}>
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
                                        <div className="flex items-center gap-2 min-w-0">
                                            {block.id === 'special_wait_image' ? (
                                                <Lucide.Image size={14} className="text-violet-400 shrink-0" />
                                            ) : block.id === 'special_condition' ? (
                                                <Lucide.Split size={14} className="text-violet-400 shrink-0" />
                                            ) : (
                                                <Lucide.Moon size={14} className="text-violet-400 shrink-0" />
                                            )}
                                            <span className={`font-medium text-sm truncate ${THEME.sidebar.text}`}>{block.name}</span>
                                        </div>
                                        {/* Edit Button for Log Blocks */}
                                        {(block.id === 'special_log_start' || block.id === 'special_log_stop') && (
                                            <div className="hidden group-hover:flex gap-2 shrink-0 ml-2">
                                                <button onClick={() => handleEdit(block)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all">
                                                    <Lucide.Edit2 size={16} />
                                                </button>
                                            </div>
                                        )}
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
                                    className={`group p-0.5 rounded-lg border cursor-grab transition-all shadow-sm hover:shadow-md backdrop-blur-sm ${THEME.sidebar.item.predefined}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Lucide.Package size={14} className="text-indigo-400 shrink-0" />
                                            <div className="min-w-0">
                                                <div className={`font-medium text-sm truncate ${THEME.sidebar.text}`}>{block.name}</div>
                                                <div className="text-xs text-slate-500 truncate mt-0.5">{block.commands.length} cmds</div>
                                            </div>
                                        </div>
                                        <div className="hidden group-hover:flex gap-2 shrink-0 ml-2">
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
                                    className={`group p-0.5 rounded-lg border transition-all relative cursor-grab shadow-sm hover:shadow-md ${THEME.sidebar.item.custom}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Lucide.Terminal size={14} className="text-emerald-500 shrink-0" />
                                            <div className="min-w-0">
                                                <div className={`font-medium text-sm truncate ${THEME.sidebar.text}`}>{block.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5 truncate">{block.commands.length} cmds</div>
                                            </div>
                                        </div>
                                        <div className="hidden group-hover:flex gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg pl-1 shrink-0 ml-2">
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


                {isEditing && (
                    <div className="fixed left-80 top-1/2 -translate-y-1/2 z-50 animate-in slide-in-from-left-4 fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-96 shadow-2xl border border-slate-200 dark:border-slate-700">
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
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {editingBlock?.id === 'special_log_start' || editingBlock?.id === 'special_log_stop' ? 'Details' : 'Commands (one per line)'}
                                        </label>

                                        {editingBlock?.id === 'special_log_start' ? (
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <div className="text-xs text-slate-500 mb-1">Command</div>
                                                    <input
                                                        ref={logCommandRef}
                                                        value={editingBlock.logCommand || ''}
                                                        onChange={e => handleInputChange(e, 'logCommand', (v) => setEditingBlock({ ...editingBlock, logCommand: v }))}
                                                        onKeyDown={handleKeyDown}
                                                        onFocus={() => setActiveField('logCommand')}
                                                        className="w-full text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                        placeholder="e.g. sdb dlog"
                                                    />
                                                    {showSuggestions && activeField === 'logCommand' && (
                                                        <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                                            {SPECIAL_VARS.map((v, idx) => (
                                                                <button
                                                                    key={v.label}
                                                                    onClick={() => insertVariable(v.label)}
                                                                    onMouseMove={() => setSuggestionIndex(idx)}
                                                                    className={`w-full text-left px-3 py-1.5 text-xs flex flex-col gap-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors
                                                                    ${idx === suggestionIndex ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}
                                                                `}
                                                                >
                                                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.label}</span>
                                                                    <span className="text-slate-500">{v.desc}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <div className="text-xs text-slate-500 mb-1">Filename</div>
                                                    <input
                                                        ref={logFileNameRef}
                                                        value={editingBlock.logFileName || ''}
                                                        onChange={e => handleInputChange(e, 'logFileName', (v) => setEditingBlock({ ...editingBlock, logFileName: v }))}
                                                        onKeyDown={handleKeyDown}
                                                        onFocus={() => setActiveField('logFileName')}
                                                        className="w-full text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                        placeholder="e.g. log_$(time_current).txt"
                                                    />
                                                    {showSuggestions && activeField === 'logFileName' && (
                                                        <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                                            {SPECIAL_VARS.map((v, idx) => (
                                                                <button
                                                                    key={v.label}
                                                                    onClick={() => insertVariable(v.label)}
                                                                    onMouseMove={() => setSuggestionIndex(idx)}
                                                                    className={`w-full text-left px-3 py-1.5 text-xs flex flex-col gap-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors
                                                                    ${idx === suggestionIndex ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}
                                                                `}
                                                                >
                                                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.label}</span>
                                                                    <span className="text-slate-500">{v.desc}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : editingBlock?.id === 'special_log_stop' ? (
                                            <div className="relative">
                                                <div className="text-xs text-slate-500 mb-1">Stop Command (Optional)</div>
                                                <input
                                                    ref={stopCommandRef}
                                                    value={editingBlock.stopCommand || ''}
                                                    onChange={e => handleInputChange(e, 'stopCommand', (v) => setEditingBlock({ ...editingBlock, stopCommand: v }))}
                                                    onKeyDown={handleKeyDown}
                                                    onFocus={() => setActiveField('stopCommand')}
                                                    className="w-full text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                    placeholder="e.g. sdb shell killall dlog"
                                                />
                                                {showSuggestions && activeField === 'stopCommand' && (
                                                    <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                                        {SPECIAL_VARS.map((v, idx) => (
                                                            <button
                                                                key={v.label}
                                                                onClick={() => insertVariable(v.label)}
                                                                onMouseMove={() => setSuggestionIndex(idx)}
                                                                className={`w-full text-left px-3 py-1.5 text-xs flex flex-col gap-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors
                                                                ${idx === suggestionIndex ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}
                                                            `}
                                                            >
                                                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.label}</span>
                                                                <span className="text-slate-500">{v.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <textarea
                                                    ref={textareaRef}
                                                    value={commands}
                                                    onChange={e => handleInputChange(e, 'commands', setCommands)}
                                                    onKeyDown={handleKeyDown}
                                                    onFocus={() => setActiveField('commands')}
                                                    className="w-full h-32 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="sdb shell input keyevent 66&#10;adb shell input tap 100 100"
                                                />
                                                {showSuggestions && activeField === 'commands' && (
                                                    <div className="absolute left-2 bottom-full mb-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                                        <div className="text-[10px] uppercase font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-1 border-b dark:border-slate-700">
                                                            Insert Variable
                                                        </div>
                                                        {SPECIAL_VARS.map((v, idx) => (
                                                            <button
                                                                key={v.label}
                                                                onClick={() => insertVariable(v.label)}
                                                                onMouseMove={() => setSuggestionIndex(idx)}
                                                                className={`w-full text-left px-3 py-1.5 text-xs flex flex-col gap-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors
                                                            ${idx === suggestionIndex
                                                                        ? 'bg-indigo-100 dark:bg-indigo-900/50'
                                                                        : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                                                    }
                                                        `}
                                                            >
                                                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.label}</span>
                                                                <span className="text-slate-500">{v.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-500 mt-1">Directly type adb/sdb commands.</p>
                                            </div>
                                        )}
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlockManager;
