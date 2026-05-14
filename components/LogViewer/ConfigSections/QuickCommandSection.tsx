import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
        // 🐧 형님! 실무에서 자주 쓰시는 Tizen 전용 명령어로 기본 세트를 교체했습니다!
        const defaults = [
            { id: 'ps', name: 'ps', cmd: 'ps -efc | grep -Ei "smartthingsapp|smartthings-client|vd-sc-client" [[ENTER]]' },
            { id: 'pkgcmd', name: 'pkgcmd', cmd: 'pkgcmd -l | grep -Ei "smartthingsapp|smartthings-client|iotwidget|aov-dashboard|stpreview" [[ENTER]]' },
            { id: 'home_owner', name: '/home/owner', cmd: 'cd /home/owner/apps/com.samsung.tv.SmartThingsApp [[ENTER]]' },
            { id: 'launch_viewer', name: 'launch appinfoviewer', cmd: 'launch_app com.samsung.tv.appinfoviewer [[ENTER]]' },
            { id: 'launch_factory', name: 'launch factory menu', cmd: 'launch_app org.tizen.factory [[ENTER]]' }
        ];

        if (!saved) return defaults;

        // 만약 기존에 구버전 기본값(Log Clear 등)만 있다면 새 기본값으로 교체해드리는 센스! 🐧✨
        const parsed = JSON.parse(saved);
        if (parsed.length === 3 && parsed[0].name === 'Log Clear') {
            return defaults;
        }

        return parsed;
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<{ id?: string, name: string, cmd: string }>({ name: '', cmd: '' });
    const [hoveredCmd, setHoveredCmd] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState<{ top: number, left: number } | null>(null);
    const editorRef = React.useRef<HTMLDivElement>(null);

    // 🐧 특수 토큰 정의
    const SPECIAL_TOKENS: Record<string, { label: string, color: string, value: string }> = {
        '[[ENTER]]': { label: 'ENTER', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', value: '\\n' },
        '[[ESC]]': { label: 'ESC', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', value: '\\x1b' },
        '[[CTRL_C]]': { label: 'CTRL+C', color: 'bg-red-500/20 text-red-400 border-red-500/30', value: '\\x03' },
        '[[TAB]]': { label: 'TAB', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', value: '\\t' },
    };

    // 🐧 토큰을 칩으로 렌더링하는 함수
    const renderTokensToHtml = (cmd: string) => {
        if (!cmd) return '';
        let html = cmd
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        Object.entries(SPECIAL_TOKENS).forEach(([token, info]) => {
            const escapedToken = token.replace(/[[\]]/g, '\\$&');
            const chipHtml = `<span contenteditable="false" class="inline-flex items-center px-2 py-0.5 rounded-md border ${info.color} text-[10px] font-black mx-0.5 cursor-default select-none shadow-sm align-middle" data-token="${token}">${info.label}</span>`;
            html = html.replace(new RegExp(escapedToken, 'g'), chipHtml);
        });
        return html;
    };

    // 🐧 HTML에서 토큰 문자열로 변환
    const htmlToTokens = (html: string | null | undefined) => {
        if (!html) return '';
        try {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const chips = temp.querySelectorAll('[data-token]');
            chips.forEach(chip => {
                const token = chip.getAttribute('data-token');
                if (token) chip.replaceWith(token);
            });
            return temp.innerText || temp.textContent || '';
        } catch (e) {
            console.error('[QuickCommand] htmlToTokens error:', e);
            return '';
        }
    };

    // 🐧 에디터가 열릴 때 초기 내용 채우기
    useEffect(() => {
        if (isEditing && editorRef.current) {
            const currentHtml = editorRef.current.innerHTML;
            const targetHtml = renderTokensToHtml(editData.cmd);
            if (currentHtml !== targetHtml) {
                editorRef.current.innerHTML = targetHtml;
            }
            // 포커스 및 커서 끝으로 이동
            setTimeout(() => {
                const el = editorRef.current;
                if (el) {
                    el.focus();
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(el);
                    range.collapse(false);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                }
            }, 50);
        }
    }, [isEditing]);

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

    const handleExecute = (cmd: string) => {
        let finalCmd = cmd;
        Object.entries(SPECIAL_TOKENS).forEach(([token, info]) => {
            finalCmd = finalCmd.split(token).join(info.value);
        });
        onExecute(finalCmd);
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
                            onClick={() => handleExecute(c.cmd)}
                            onMouseEnter={(e) => {
                                setHoveredCmd(c.cmd);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverPos({ top: rect.top, left: rect.right + 20 });
                            }}
                            onMouseLeave={() => {
                                setHoveredCmd(null);
                                setHoverPos(null);
                            }}
                            className="group relative flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 hover:bg-indigo-600/10 border border-slate-800/50 hover:border-indigo-500/30 cursor-pointer transition-all duration-300"
                        >
                            <div className="flex flex-col min-w-0 pr-4 flex-1">
                                <span className="text-xs font-bold text-slate-200 truncate group-hover:text-white">{c.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono truncate mt-1 flex items-center flex-wrap gap-1">
                                    {c.cmd.includes('[[') ? (
                                        <div dangerouslySetInnerHTML={{ __html: renderTokensToHtml(c.cmd) }} className="flex items-center gap-1 scale-90 origin-left" />
                                    ) : c.cmd}
                                </span>
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

            {/* 🐧🎯 글로벌 전문 프리뷰 HUD (마우스 오버한 카드 우측에 밀착 렌더링) */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {hoveredCmd && hoverPos && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="fixed z-[99999] pointer-events-none"
                            style={{
                                top: hoverPos.top,
                                left: hoverPos.left
                            }}
                        >
                            <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-8 shadow-[0_20px_100px_rgba(0,0,0,0.7)] min-w-[550px] max-w-[900px]">
                                <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                        <Terminal size={18} className="text-indigo-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Quick Preview</span>
                                        <span className="text-[9px] text-slate-500 italic">Floating next to active command</span>
                                    </div>
                                </div>
                                <div className="text-xl text-white font-mono leading-relaxed break-all whitespace-pre-wrap">
                                    {hoveredCmd.includes('[[') ? (
                                        <div dangerouslySetInnerHTML={{ __html: renderTokensToHtml(hoveredCmd) }} className="flex items-center flex-wrap gap-2.5" />
                                    ) : hoveredCmd}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

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
                                    <span className="text-[9px] text-indigo-400/60 italic">Chips are treated as single entities</span>
                                </div>

                                {/* 🐧🎯 Tokenized Editor */}
                                <div
                                    ref={editorRef}
                                    contentEditable
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none h-32 overflow-y-auto font-mono transition-all custom-scrollbar whitespace-pre-wrap break-all"
                                    onBlur={(e) => {
                                        const html = e.currentTarget?.innerHTML;
                                        setEditData(prev => ({ ...prev, cmd: htmlToTokens(html) }));
                                    }}
                                    onInput={(e) => {
                                        const html = e.currentTarget?.innerHTML;
                                        const tokens = htmlToTokens(html);
                                        if (tokens !== editData.cmd) {
                                            setEditData(prev => ({ ...prev, cmd: tokens }));
                                        }
                                    }}
                                />

                                {/* 🐧 Quick Insert Buttons */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {Object.entries(SPECIAL_TOKENS).map(([token, info]) => (
                                        <button
                                            key={token}
                                            onClick={() => {
                                                const el = editorRef.current;
                                                if (el) {
                                                    const currentCmd = htmlToTokens(el.innerHTML);
                                                    const newCmd = currentCmd + token;
                                                    setEditData(prev => ({ ...prev, cmd: newCmd }));

                                                    // 🐧 칩 삽입 후 수동으로 HTML 업데이트 및 포커스 유지
                                                    el.innerHTML = renderTokensToHtml(newCmd);

                                                    setTimeout(() => {
                                                        const freshEl = editorRef.current;
                                                        if (freshEl) {
                                                            freshEl.focus();
                                                            const range = document.createRange();
                                                            const sel = window.getSelection();
                                                            range.selectNodeContents(freshEl);
                                                            range.collapse(false);
                                                            sel?.removeAllRanges();
                                                            sel?.addRange(range);
                                                        }
                                                    }, 0);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-xl border text-[9px] font-black transition-all hover:scale-105 active:scale-95 ${info.color}`}
                                        >
                                            +{info.label}
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
