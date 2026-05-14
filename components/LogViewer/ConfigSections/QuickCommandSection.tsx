import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, Zap, Terminal, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuickCommand {
    id: string;
    name: string;
    cmd: string;
}

interface QuickCommandSectionProps {
    onExecute: (cmd: string) => void;
    onSpecialKey?: (key: 'ctrl_p' | 'ctrl_p_twice' | 'ctrl_p_thrice') => void;
    isConnected: boolean;
}

export const QuickCommandSection: React.FC<QuickCommandSectionProps> = ({ onExecute, onSpecialKey, isConnected }) => {
    const [commands, setCommands] = useState<QuickCommand[]>(() => {
        const saved = localStorage.getItem('quickCommands');
        return saved ? JSON.parse(saved) : [
            { id: '1', name: 'Log Clear', cmd: 'dlogutil -c' },
            { id: '2', name: 'Process List', cmd: 'ps -ef' },
            { id: '3', name: 'Restart App', cmd: 'app_control restart' }
        ];
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<{ id?: string, name: string, cmd: string }>({ name: '', cmd: '' });

    useEffect(() => {
        localStorage.setItem('quickCommands', JSON.stringify(commands));
    }, [commands]);

    const handleSave = () => {
        if (!editData.name || !editData.cmd) return;
        if (editData.id) {
            setCommands(prev => prev.map(c => c.id === editData.id ? { ...c, name: editData.name, cmd: editData.cmd } : c));
        } else {
            setCommands(prev => [...prev, { id: Math.random().toString(36).substring(7), name: editData.name, cmd: editData.cmd }]);
        }
        setIsEditing(false);
        setEditData({ name: '', cmd: '' });
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('삭제하시겠습니까?')) {
            setCommands(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleEdit = (cmd: QuickCommand, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditData(cmd);
        setIsEditing(true);
    };

    return (
        <div className="flex flex-col h-full space-y-6 relative">
            {/* 🐧 Special Serial Keys (System Actions) */}
            {onSpecialKey && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Command size={14} className="text-indigo-400" />
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">System Actions</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => onSpecialKey('ctrl_p')}
                            className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 transition-all active:scale-95 group"
                        >
                            <span className="text-[10px] font-black uppercase group-hover:text-emerald-300">Break</span>
                            <span className="text-[8px] opacity-50 font-mono">Ctrl P</span>
                        </button>
                        <button
                            onClick={() => onSpecialKey('ctrl_p_twice')}
                            className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 transition-all active:scale-95 group"
                        >
                            <span className="text-[10px] font-black uppercase group-hover:text-indigo-300">Unlock</span>
                            <span className="text-[8px] opacity-50 font-mono">Ctrl P P</span>
                        </button>
                        <button
                            onClick={() => onSpecialKey('ctrl_p_thrice')}
                            className="flex flex-col items-center justify-center p-3 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-400 transition-all active:scale-95 group"
                        >
                            <span className="text-[10px] font-black uppercase group-hover:text-purple-300">Re-Act</span>
                            <span className="text-[8px] opacity-50 font-mono">Ctrl P P P</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 🐧 Custom User Commands */}
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-400" />
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">User Commands</h3>
                    </div>
                    <button
                        onClick={() => { setIsEditing(true); setEditData({ name: '', cmd: '' }); }}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors"
                        title="Add Command"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar pb-10">
                    {commands.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                            <Terminal size={32} />
                            <span className="text-xs font-medium">No commands saved.</span>
                        </div>
                    )}
                    {commands.map((c) => (
                        <div
                            key={c.id}
                            onClick={() => onExecute(c.cmd)}
                            className="group relative flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 hover:bg-indigo-600/10 border border-slate-800/50 hover:border-indigo-500/30 cursor-pointer transition-all duration-300"
                        >
                            <div className="flex flex-col min-w-0 pr-4">
                                <span className="text-xs font-bold text-slate-200 truncate group-hover:text-white">{c.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono truncate group-hover:text-indigo-400/80 mt-1">{c.cmd}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                <button onClick={(e) => handleEdit(c, e)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-400">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={(e) => handleDelete(c.id, e)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-red-400">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 🐧 Edit Overlay */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        className="absolute inset-[-20px] bg-slate-950/80 z-50 p-8 flex flex-col space-y-6"
                    >
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider">{editData.id ? 'Edit Command' : 'New Command'}</h4>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Friendly Name</label>
                                <input
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    value={editData.name}
                                    onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. My Quick Log Clear"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shell Command</label>
                                    <span className="text-[9px] text-indigo-400/60 italic">Use \n for Enter</span>
                                </div>
                                <textarea
                                    id="cmd-textarea"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none h-32 resize-none font-mono transition-all"
                                    value={editData.cmd}
                                    onChange={e => setEditData(prev => ({ ...prev, cmd: e.target.value }))}
                                    placeholder="e.g. dlogutil -c\n"
                                />

                                {/* 🐧 Quick Insert Buttons */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {[
                                        { label: 'ENTER', value: '\\n', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                                        { label: 'ESC', value: '\\x1b', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                                        { label: 'CTRL+C', value: '\\x03', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                                        { label: 'TAB', value: '\\t', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                                    ].map(btn => (
                                        <button
                                            key={btn.label}
                                            onClick={() => {
                                                const el = document.getElementById('cmd-textarea') as HTMLTextAreaElement;
                                                if (el) {
                                                    const start = el.selectionStart;
                                                    const end = el.selectionEnd;
                                                    const text = editData.cmd;
                                                    const before = text.substring(0, start);
                                                    const after = text.substring(end, text.length);
                                                    setEditData(prev => ({ ...prev, cmd: before + btn.value + after }));
                                                    // Refocus after state update (using timeout to let react render)
                                                    setTimeout(() => {
                                                        el.focus();
                                                        el.setSelectionRange(start + btn.value.length, start + btn.value.length);
                                                    }, 0);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-xl border text-[9px] font-black transition-all hover:scale-105 active:scale-95 ${btn.color}`}
                                        >
                                            +{btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleSave}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-indigo-900/40 active:scale-[0.98]"
                            >
                                SAVE COMMAND
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
