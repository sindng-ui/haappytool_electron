import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Plus, X, Edit2, Trash2, Zap, Terminal, Command, GripVertical } from 'lucide-react';

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

// 🐧🎯 독립된 드래그 핸들과 렌더링을 담당하는 개별 카드 컴포넌트
const DraggableCommandItem = ({
    c,
    handleExecute,
    setHoveredCmd,
    setHoverPos,
    handleEdit,
    handleDelete,
    renderTokensToHtml
}: {
    c: QuickCommand,
    handleExecute: (cmd: string) => void,
    setHoveredCmd: (cmd: string | null) => void,
    setHoverPos: (pos: { top: number, left: number } | null) => void,
    handleEdit: (c: QuickCommand, e: React.MouseEvent) => void,
    handleDelete: (id: string, e: React.MouseEvent) => void,
    renderTokensToHtml: (cmd: string) => string
}) => {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={c}
            dragListener={false} // 🐧 카드 전체가 아닌 핸들로만 드래그되도록 제한
            dragControls={dragControls}
            className="group relative flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 hover:bg-indigo-600/10 border border-slate-800/50 hover:border-indigo-500/30 transition-colors duration-300 select-none"
            onMouseEnter={(e) => {
                setHoveredCmd(c.cmd);
                const rect = e.currentTarget.getBoundingClientRect();
                setHoverPos({ top: rect.top, left: rect.right + 20 });
            }}
            onMouseLeave={() => {
                setHoveredCmd(null);
                setHoverPos(null);
            }}
        >
            {/* 🐧 전용 드래그 핸들 */}
            <div
                className="flex items-center justify-center p-2 mr-2 cursor-grab active:cursor-grabbing text-slate-600 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <GripVertical size={16} />
            </div>

            <div
                className="flex flex-col min-w-0 pr-4 flex-1 cursor-pointer"
                onClick={() => handleExecute(c.cmd)}
            >
                <span className="text-xs font-bold text-slate-200 truncate group-hover:text-white flex items-center gap-2">
                    {c.name}
                </span>
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
        </Reorder.Item>
    );
};

// 🐧 특수 토큰 전역 정의
export const QUICK_COMMAND_SPECIAL_TOKENS: Record<string, { label: string, color: string, value: string }> = {
    '[[ENTER]]': { label: 'ENTER', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', value: '\\n' },
    '[[ESC]]': { label: 'ESC', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', value: '\\x1b' },
    '[[CTRL_C]]': { label: 'CTRL+C', color: 'bg-red-500/20 text-red-400 border-red-500/30', value: '\\x03' },
    '[[TAB]]': { label: 'TAB', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', value: '\\t' },
    '[[CLIPBOARD]]': { label: 'CLIPBOARD', color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30', value: '' }, // 특수 처리
};

// 🐧 글로벌 단축키(Alt+1~9) 연동을 위한 공용 실행 함수
export const executeQuickCommand = async (rawCmd: string, sendCommand: (cmd: string) => void) => {
    if (!rawCmd) return;
    
    let processedCmd = rawCmd;
    
    // 1. CLIPBOARD 매크로 치환
    if (processedCmd.includes('[[CLIPBOARD]]')) {
        try {
            const text = await navigator.clipboard.readText();
            processedCmd = processedCmd.split('[[CLIPBOARD]]').join(text);
        } catch (e) {
            console.error('[QuickCommand] Failed to read clipboard', e);
        }
    }
    
    // 2. PROMPT 매크로 치환
    const promptMatches = processedCmd.match(/\[\[PROMPT:([^\]]+)\]\]/g);
    if (promptMatches) {
        for (const match of promptMatches) {
            const promptMsg = match.replace('[[PROMPT:', '').replace(']]', '');
            const userInput = window.prompt(promptMsg);
            if (userInput === null) return; // 사용자가 취소하면 전체 실행 중단
            processedCmd = processedCmd.replace(match, userInput);
        }
    }
    
    // 3. DELAY 매크로에 따른 순차 실행
    const parts = processedCmd.split(/(\[\[DELAY:\d+\]\])/);
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('[[DELAY:') && part.endsWith(']]')) {
            const delayMs = parseInt(part.replace('[[DELAY:', '').replace(']]', ''), 10);
            if (!isNaN(delayMs)) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        } else if (part.length > 0) {
            let finalCmd = part;
            Object.entries(QUICK_COMMAND_SPECIAL_TOKENS).forEach(([token, info]) => {
                if (token !== '[[CLIPBOARD]]') { // 클립보드는 이미 처리됨
                    finalCmd = finalCmd.split(token).join(info.value);
                }
            });
            if (finalCmd) {
                sendCommand(finalCmd);
            }
        }
    }
};

export const QuickCommandSection: React.FC<QuickCommandSectionProps> = ({ onExecute, onSpecialKey, isConnected }) => {
    const [commands, setCommands] = useState<QuickCommand[]>(() => {
        const saved = localStorage.getItem('quickCommands');
        // 🐧 스마트 매크로가 반영된 실무 최적화 기본값!
        const defaults = [
            { id: 'ps', name: 'ps', cmd: 'ps -efc | grep -Ei "smartthingsapp|smartthings-client|vd-sc-client" [[ENTER]]' },
            { id: 'pkgcmd', name: 'pkgcmd', cmd: 'pkgcmd -l | grep -Ei "smartthingsapp|smartthings-client|iotwidget|aov-dashboard|stpreview" [[ENTER]]' },
            { id: 'kill_clip', name: 'kill (clipboard)', cmd: 'kill -9 [[CLIPBOARD]] [[ENTER]]' },
            { id: 'launch_prompt', name: 'launch app (prompt)', cmd: 'launch_app [[PROMPT:패키지명 입력]] [[ENTER]]' },
            { id: 'uninstall', name: 'uninstall', cmd: 'pkgcmd -un [[PROMPT:패키지명 입력]] [[ENTER]]' }
        ];

        if (!saved) return defaults;

        const parsed = JSON.parse(saved);
        // 🐧 형님! 예전 버전(Log Clear 등)을 쓰고 계신 경우에만 최신 기본값으로 업데이트 해드립니다.
        // 형님이 직접 다 지우셔서 빈 목록([])이 된 경우에는 그대로 빈 상태를 유지합니다.
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

    // 🐧🎯 순서 변경 시 저장 로직
    const handleReorder = (newOrder: QuickCommand[]) => {
        setCommands(newOrder);
        localStorage.setItem('quickCommands', JSON.stringify(newOrder));
    };

    // 🐧 토큰을 칩으로 렌더링하는 함수 (스마트 매크로 추가)
    const renderTokensToHtml = (cmd: string) => {
        if (!cmd) return '';
        let html = cmd
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 1. 기본 정적 토큰 변환
        Object.entries(QUICK_COMMAND_SPECIAL_TOKENS).forEach(([token, info]) => {
            const escapedToken = token.replace(/[[\]]/g, '\\$&');
            const chipHtml = `<span contenteditable="false" class="inline-flex items-center px-2 py-0.5 rounded-md border ${info.color} text-[10px] font-black mx-0.5 cursor-default select-none shadow-sm align-middle" data-token="${token}">${info.label}</span>`;
            html = html.replace(new RegExp(escapedToken, 'g'), chipHtml);
        });

        // 2. PROMPT 동적 토큰 변환
        html = html.replace(/\[\[PROMPT:([^\]]+)\]\]/g, (match, msg) => {
            return `<span contenteditable="false" class="inline-flex items-center px-2 py-0.5 rounded-md border bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] font-black mx-0.5 cursor-default select-none shadow-sm align-middle" data-token="${match}">PROMPT:${msg}</span>`;
        });

        // 3. DELAY 동적 토큰 변환
        html = html.replace(/\[\[DELAY:(\d+)\]\]/g, (match, ms) => {
            return `<span contenteditable="false" class="inline-flex items-center px-2 py-0.5 rounded-md border bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] font-black mx-0.5 cursor-default select-none shadow-sm align-middle" data-token="${match}">DELAY:${ms}ms</span>`;
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
            // 🐧 형님! 삭제되는 순간 프리뷰 잔상도 깔끔하게 지워줍니다.
            setHoveredCmd(null);
            setHoverPos(null);
        }
    };

    const handleEdit = (cmd: QuickCommand, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditData(cmd);
        setIsEditing(true);
    };

    const handleExecute = (cmd: string) => {
        if (!isConnected) return;
        executeQuickCommand(cmd, onExecute);
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
                        className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-400/50 transition-all active:scale-95"
                        title="Add Command"
                    >
                        <Plus size={12} className="text-indigo-400 group-hover:rotate-90 transition-transform duration-300" />
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">New</span>
                    </button>
                </div>

                <Reorder.Group
                    axis="y"
                    values={commands}
                    onReorder={handleReorder}
                    className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar pb-10"
                >
                    {commands.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                            <Terminal size={32} />
                            <span className="text-xs font-medium">No commands saved.</span>
                        </div>
                    )}
                    {commands.map((c) => (
                        <DraggableCommandItem
                            key={c.id}
                            c={c}
                            handleExecute={handleExecute}
                            setHoveredCmd={setHoveredCmd}
                            setHoverPos={setHoverPos}
                            handleEdit={handleEdit}
                            handleDelete={handleDelete}
                            renderTokensToHtml={renderTokensToHtml}
                        />
                    ))}
                </Reorder.Group>
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
                            {/* 🐧 GPU 최적화: 무거운 다중 레이어 그림자 제거 */}
                            <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl p-8 shadow-xl min-w-[550px] max-w-[900px]">
                                <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                        <Terminal size={18} className="text-indigo-400" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mt-1">Quick Preview</span>
                                        {/* 🐧 GPU 최적화: glow 효과(shadow) 제거 */}
                                        <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-md inline-flex items-center w-fit">
                                            🖱️ Click card to execute
                                        </span>
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

            {/* 🐧 Edit Overlay (GPU 최적화: blur 제거) */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-slate-950 z-[100] p-6 flex flex-col space-y-6 overflow-y-auto custom-scrollbar"
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
                                    {Object.entries(QUICK_COMMAND_SPECIAL_TOKENS).map(([token, info]) => (
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
                                // 🐧 GPU 최적화: 컬러 섀도우 제거 및 transition-colors로 변경
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-black transition-colors active:scale-[0.98]"
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
