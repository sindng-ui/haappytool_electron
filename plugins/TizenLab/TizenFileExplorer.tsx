
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const {
    Folder, File, ChevronRight, RefreshCw, ArrowLeftRight, Download, Upload,
    Home, Search, HardDrive, Trash2, ArrowLeft, Star, X, Monitor,
    MoreVertical, Edit3, Plus, ExternalLink, Terminal, Check, Eye, Copy
} = Lucide;

import { useToast } from '../../contexts/ToastContext';

interface FileItem {
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
    permissions?: string;
    owner?: string;
}

interface TizenFileExplorerProps {
    deviceId: string;
}

const FileTable = ({
    files,
    currentPath,
    setPath,
    onTransfer,
    onDropTransfer,
    transferIcon: Icon,
    isLoading,
    error,
    title,
    sideIcon: SideIcon,
    formatSize,
    bookmarks,
    toggleBookmark,
    selectedFiles,
    toggleSelection,
    onOperation,
    addToast
}: any) => {
    const [filter, setFilter] = useState('');
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [tempPath, setTempPath] = useState(currentPath);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: any } | null>(null);
    const lastToastRef = useRef<{ message: string, time: number } | null>(null);
    const lastTabRequestRef = useRef<number>(0);
    const paneRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, file: any) => {
        e.preventDefault();
        let x = e.clientX;
        let y = e.clientY;

        // Prevent menu from going off-screen (Right/Bottom)
        const menuWidth = 160;
        const menuHeight = 240;
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 20;

        setContextMenu({ x, y, file });
    };

    useEffect(() => {
        setTempPath(currentPath);
    }, [currentPath]);

    const filtered = useMemo(() => files.filter((f: any) => f.name.toLowerCase().includes(filter.toLowerCase())), [files, filter]);
    const isWin = currentPath.includes('\\') || /^[A-Z]:/i.test(currentPath);
    const separator = isWin ? '\\' : '/';

    const pathParts = useMemo(() => currentPath.split(/[\\/]/).filter(Boolean), [currentPath]);
    const breadcrumbs = useMemo(() => pathParts.map((p, i) => {
        let pth = pathParts.slice(0, i + 1).join(separator);
        if (!isWin) pth = '/' + pth;
        // If it's a Windows drive like C:, ensure it has a trailing backslash
        if (isWin && pth.length === 2 && pth.endsWith(':')) pth += '\\';
        return { name: p, path: pth };
    }), [pathParts, isWin, separator]);

    const goToParent = () => {
        if (isLoading || pathParts.length === 0) return;
        const parts = [...pathParts];
        parts.pop();
        let newPath = parts.join(separator);
        if (!isWin) newPath = '/' + newPath;
        if (isWin && parts.length === 1 && /^[A-Z]:$/i.test(parts[0])) newPath += '\\';
        setPath(newPath || (isWin ? 'C:\\' : '/'));
    };

    const quickLinks = isWin
        ? ['C:\\', 'D:\\', `C:\\Users\\${(window as any).process?.env?.USERNAME || 'User'}\\Downloads`]
        : ['/', '/home/owner', '/tmp', '/var/log'];

    const isBookmarked = bookmarks?.includes(currentPath);

    return (
        <div
            className="flex-1 flex flex-col min-w-0 bg-slate-900/30 border-r border-white/5 relative"
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
                e.preventDefault();
                const fileName = e.dataTransfer.getData('text/plain')?.trim();
                if (fileName && onDropTransfer) {
                    onDropTransfer({ name: fileName, type: 'file' });
                }
            }}
            tabIndex={0}
            ref={paneRef}
            onKeyDown={(e) => {
                // 1. Delete Key
                if (e.key === 'Delete' && selectedFiles.length > 0) {
                    const confirmMsg = selectedFiles.length === 1
                        ? `Are you sure you want to delete ${selectedFiles[0]}?`
                        : `Are you sure you want to delete ${selectedFiles.length} items?`;

                    if (confirm(confirmMsg)) {
                        selectedFiles.forEach((name: string) => {
                            onOperation('delete', { file: { name } });
                        });
                        onOperation('select_batch', { names: [], clear: true });
                    }
                }

                // 2. Ctrl+C (Copy)
                if (e.ctrlKey && e.key === 'c' && selectedFiles.length > 0) {
                    onOperation('clipboard_copy', { names: selectedFiles });
                }

                // 3. Ctrl+V (Paste)
                if (e.ctrlKey && e.key === 'v') {
                    onOperation('clipboard_paste', {});
                }
            }}
        >
            {/* 1. Header with Title and Search */}
            <div className="p-3 bg-slate-900/80 border-b border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <SideIcon size={16} className="text-indigo-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{title}</span>
                    <button
                        onClick={() => !isLoading && setPath(currentPath)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
                <div className="flex-1 flex items-center bg-slate-800 rounded-lg px-2 py-0.5 border border-white/5">
                    <Search size={12} className="text-slate-500 mr-2" />
                    <input
                        placeholder="Search..."
                        className="bg-transparent border-none outline-none text-[10px] w-full text-slate-200"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                    {filter && (
                        <button onClick={() => setFilter('')} className="text-slate-500 hover:text-white">
                            <X size={10} />
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Quick Access Bar */}
            <div className="px-2 py-1 bg-slate-950/50 border-b border-white/5 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {isWin && (
                    <select
                        className="bg-slate-800 text-[9px] font-bold text-indigo-400 border-none outline-none rounded px-1 py-0.5 mr-1"
                        value={currentPath.split(':')[0].toUpperCase() + ':'}
                        onChange={(e) => !isLoading && setPath(e.target.value + '\\')}
                    >
                        {['C:', 'D:', 'E:', 'F:'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                )}
                {quickLinks.map(link => (
                    <button
                        key={link}
                        onClick={() => !isLoading && setPath(link)}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all flex-shrink-0 ${currentPath.startsWith(link) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                        {link.length > 10 ? link.split(/[\\/]/).pop() : link}
                    </button>
                ))}
                <div className="flex-1" />
                <button
                    onClick={() => {
                        const allNames = files.filter((f: any) => f.type === 'file').map((f: any) => f.name);
                        const allSelected = allNames.every((n: any) => selectedFiles.includes(n));
                        if (allSelected) {
                            allNames.forEach((n: any) => toggleSelection(n)); // This logic is wrong if implemented like this, let's pass a batch function
                            onOperation('select_batch', { names: [], clear: true });
                        } else {
                            onOperation('select_batch', { names: allNames });
                        }
                    }}
                    className={`p-1 rounded transition-colors ${files.filter((f: any) => f.type === 'file').every((f: any) => selectedFiles.includes(f.name)) ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-white'}`}
                    title="Select All Files"
                >
                    <Check size={12} />
                </button>
                <button
                    onClick={() => {
                        const name = prompt('Enter new folder name:');
                        if (name) onOperation('mkdir', { name });
                    }}
                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-emerald-400 transition-colors"
                    title="New Folder"
                >
                    <Plus size={12} />
                </button>
                {selectedFiles.length > 0 && (
                    <button
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete ${selectedFiles.length} item(s)?`)) {
                                selectedFiles.forEach((name: string) => onOperation('delete', { file: { name } }));
                                onOperation('select_batch', { names: [], clear: true });
                            }
                        }}
                        className="p-1 hover:bg-red-500/20 rounded text-red-500 transition-colors"
                        title="Delete Selected"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            {/* 3. Address / Breadcrumb Bar (Bookmark Integrated) */}
            <div className="px-3 py-1.5 bg-slate-900 border-b border-white/5 min-h-[32px] flex items-center gap-2">
                {!isEditingPath ? (
                    <div
                        className="flex-1 flex items-center gap-1 text-[11px] font-mono text-indigo-400 overflow-x-auto no-scrollbar cursor-text"
                        onClick={() => { setIsEditingPath(true); setTempPath(currentPath); }}
                    >
                        <button onClick={(e) => { e.stopPropagation(); !isLoading && setPath(isWin ? 'C:\\' : '/'); }} className="hover:text-white transition-colors">
                            <Home size={12} />
                        </button>
                        {breadcrumbs.length > 0 && <ChevronRight size={10} className="text-slate-700" />}
                        {breadcrumbs.map((bc, i) => (
                            <React.Fragment key={i}>
                                <button
                                    className="hover:text-white transition-colors whitespace-nowrap"
                                    onClick={(e) => { e.stopPropagation(); !isLoading && setPath(bc.path); }}
                                >
                                    {bc.name}
                                </button>
                                {i < breadcrumbs.length - 1 && <ChevronRight size={10} className="text-slate-700" />}
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <input
                        autoFocus
                        className="flex-1 bg-slate-800 border border-indigo-500/50 rounded px-2 py-0.5 text-[11px] font-mono text-white outline-none"
                        value={tempPath}
                        onChange={(e) => setTempPath(e.target.value)}
                        onBlur={() => {
                            // Delay blur slightly to allow click on completion if needed, though here we use Tab
                            setTimeout(() => setIsEditingPath(false), 200);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (!isLoading) setPath(tempPath);
                                setIsEditingPath(false);
                            }
                            if (e.key === 'Escape') setIsEditingPath(false);
                            if (e.key === 'Tab') {
                                e.preventDefault();

                                const now = Date.now();
                                if (now - lastTabRequestRef.current < 200) return;
                                lastTabRequestRef.current = now;

                                onOperation('complete', {
                                    path: tempPath, callback: (matches: string[], dir: string) => {
                                        if (!matches || matches.length === 0) {
                                            if (addToast) addToast('No matching files found', 'warning');
                                            return;
                                        }

                                        // 1. Calculate Longest Common Prefix (LCP)
                                        let lcp = matches[0];
                                        for (let i = 1; i < matches.length; i++) {
                                            let j = 0;
                                            while (j < lcp.length && j < matches[i].length && lcp[j].toLowerCase() === matches[i][j].toLowerCase()) {
                                                j++;
                                            }
                                            lcp = lcp.substring(0, j);
                                        }

                                        // 2. Prepare for completion
                                        const lastSep = tempPath.lastIndexOf(separator);
                                        const prefixPath = lastSep === -1 ? "" : tempPath.substring(0, lastSep + 1);
                                        const currentFrag = lastSep === -1 ? tempPath : tempPath.substring(lastSep + 1);

                                        // 3. Complete if possible
                                        if (lcp.length > currentFrag.length) {
                                            setTempPath(prefixPath + lcp);
                                        } else if (matches.length === 1) {
                                            setTempPath(prefixPath + matches[0]);
                                        }

                                        // 4. Show matches in toast if multiple (with duplicate check)
                                        if (matches.length > 1) {
                                            const msg = `Matches: ${matches.slice(0, 8).join(', ')}${matches.length > 8 ? '...' : ''}`;
                                            if (!lastToastRef.current || lastToastRef.current.message !== msg || Date.now() - lastToastRef.current.time > 2000) {
                                                if (addToast) addToast(msg, 'info');
                                                lastToastRef.current = { message: msg, time: Date.now() };
                                            }
                                        }
                                    }
                                });
                            }
                        }}
                    />
                )}
                {/* Integrated Bookmark Star */}
                {toggleBookmark && (
                    <button
                        onClick={toggleBookmark}
                        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${isBookmarked ? 'bg-amber-500/10 text-amber-500' : 'hover:bg-slate-800 text-slate-500'}`}
                        title="Bookmark Current Path"
                    >
                        <Star size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                    </button>
                )}
            </div>

            {/* 4. Table Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {error ? (
                    <div className="p-8 text-center text-red-500 text-[11px] h-full flex flex-col items-center justify-center gap-3">
                        <Trash2 size={24} className="opacity-20" />
                        {error}
                        <button onClick={() => setPath(currentPath)} className="text-indigo-400 underline">Retry</button>
                    </div>
                ) : (
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-slate-950 border-b border-white/10 z-20">
                            <tr className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">
                                <th className="px-3 py-2 border-b border-white/10">Name</th>
                                <th className="px-3 py-2 border-b border-white/10 text-right">Size</th>
                                <th className="px-3 py-2 border-b border-white/10 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] font-mono">
                            {pathParts.length > 0 && (
                                <tr
                                    className="hover:bg-white/5 cursor-pointer text-indigo-400 font-bold outline-none focus:bg-white/10"
                                    tabIndex={0}
                                    onClick={goToParent}
                                    onKeyDown={(e) => e.key === 'Enter' && goToParent()}
                                >
                                    <td className="px-3 py-2 flex items-center gap-2">
                                        <ArrowLeft size={14} />
                                        <span>[..]</span>
                                    </td>
                                    <td className="px-3 py-2 text-right opacity-30">UP</td>
                                    <td className="px-3 py-2"></td>
                                </tr>
                            )}

                            {filtered.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={3} className="px-3 py-8 text-center text-slate-500 italic">
                                        {filter ? 'No files match your search' : 'This folder is empty'}
                                    </td>
                                </tr>
                            )}

                            {filtered.map((file: any, i: number) => {
                                const isSelected = selectedFiles?.includes(file.name);
                                return (
                                    <tr
                                        key={i}
                                        tabIndex={0}
                                        className={`group hover:bg-indigo-500/10 transition-colors cursor-pointer border-b border-white/5 outline-none focus:bg-indigo-500/20 ${file.type === 'directory' ? 'text-slate-200' : 'text-slate-400'} ${isSelected ? 'bg-indigo-500/20' : ''}`}
                                        draggable={file.type === 'file'}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', file.name);
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                                toggleSelection(file.name);
                                            } else {
                                                toggleSelection(file.name);
                                            }
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, file)}
                                        onDoubleClick={() => {
                                            if (isLoading) return;
                                            if (file.type === 'directory') {
                                                setPath(
                                                    currentPath.endsWith('\\') || currentPath.endsWith('/')
                                                        ? currentPath + file.name
                                                        : currentPath + (currentPath.includes('\\') ? '\\' : '/') + file.name
                                                );
                                            } else if (file.type === 'file' && title === 'Tizen Device') {
                                                if (file.name.endsWith('.tpk')) {
                                                    onOperation('install', { file });
                                                } else {
                                                    onOperation('read', { file });
                                                }
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (isLoading) return;
                                                if (file.type === 'directory') {
                                                    setPath(
                                                        currentPath.endsWith('\\') || currentPath.endsWith('/')
                                                            ? currentPath + file.name
                                                            : currentPath + (currentPath.includes('\\') ? '\\' : '/') + file.name
                                                    );
                                                } else if (file.type === 'file' && title === 'Tizen Device') {
                                                    if (file.name.endsWith('.tpk')) {
                                                        onOperation('install', { file });
                                                    } else {
                                                        onOperation('read', { file });
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <td className="px-3 py-1.5 flex items-center gap-2">
                                            <div
                                                className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'}`}
                                                onClick={(e) => { e.stopPropagation(); toggleSelection(file.name); }}
                                            >
                                                {isSelected && <Check size={8} className="text-white" />}
                                            </div>
                                            {file.type === 'directory' ?
                                                <Folder size={14} className="text-indigo-400 fill-indigo-400/10 shrink-0" /> :
                                                <File size={14} className="text-slate-500 shrink-0" />}
                                            <span className="truncate group-hover:text-indigo-300">{file.name}</span>
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-slate-500 text-[10px]">
                                            {file.type === 'file' ? formatSize(file.size) : 'DIR'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {file.type === 'file' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onTransfer(file); }}
                                                        className="p-1 hover:bg-indigo-500 rounded text-indigo-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Icon size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e as any, file); }}
                                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreVertical size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {isLoading && (
                <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center pointer-events-none z-30">
                    <RefreshCw size={24} className="animate-spin text-indigo-500" />
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[140px] overflow-hidden"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 border-b border-white/5 bg-slate-950/50">
                        <span className="text-[10px] font-bold text-slate-400 truncate block">{contextMenu.file.name}</span>
                    </div>
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-indigo-500 hover:text-white transition-colors"
                        onClick={() => { onTransfer(contextMenu.file); setContextMenu(null); }}
                    >
                        <Icon size={12} /> {title === 'Local PC' ? 'Push to Tizen' : 'Pull to PC'}
                    </button>
                    {title === 'Tizen Device' && contextMenu.file.name.endsWith('.tpk') && (
                        <button
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                            onClick={() => { onOperation('install', { file: contextMenu.file }); setContextMenu(null); }}
                        >
                            <Download size={12} /> Install TPK
                        </button>
                    )}
                    {title === 'Tizen Device' && contextMenu.file.type === 'file' && (
                        <button
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                            onClick={() => { onOperation('read', { file: contextMenu.file }); setContextMenu(null); }}
                        >
                            <Eye size={12} /> View Content
                        </button>
                    )}
                    {title === 'Local PC' && (
                        <button
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-indigo-500 hover:text-white transition-colors"
                            onClick={() => { onOperation('open', { file: contextMenu.file }); setContextMenu(null); }}
                        >
                            <ExternalLink size={12} /> Open in Explorer
                        </button>
                    )}
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-indigo-500 hover:text-white transition-colors"
                        onClick={() => {
                            const newName = prompt('Rename to:', contextMenu.file.name);
                            if (newName && newName !== contextMenu.file.name) {
                                onOperation('rename', { file: contextMenu.file, newName });
                            }
                            setContextMenu(null);
                        }}
                    >
                        <Edit3 size={12} /> Rename
                    </button>
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete ${contextMenu.file.name}?`)) {
                                onOperation('delete', { file: contextMenu.file });
                            }
                            setContextMenu(null);
                        }}
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
};

const TizenFileExplorer: React.FC<TizenFileExplorerProps> = ({ deviceId }) => {
    const [tizenPath, setTizenPath] = useState(() => localStorage.getItem('tizen_last_path') || '/home/owner');
    const [tizenFiles, setTizenFiles] = useState<FileItem[]>([]);
    const [tizenLoading, setTizenLoading] = useState(false);
    const [tizenError, setTizenError] = useState<string | null>(null);

    const [localPath, setLocalPath] = useState(() => localStorage.getItem('local_last_path') || 'C:\\');
    const [localFiles, setLocalFiles] = useState<FileItem[]>([]);
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const [socket, setSocket] = useState<Socket | null>(null);
    const [bookmarks, setBookmarks] = useState<string[]>(() => {
        const saved = localStorage.getItem('tizen_explorer_bookmarks');
        return saved ? JSON.parse(saved) : ['/home/owner', '/tmp'];
    });

    const [tizenSelected, setTizenSelected] = useState<string[]>([]);
    const [localSelected, setLocalSelected] = useState<string[]>([]);

    const [viewingFile, setViewingFile] = useState<{ name: string, content: string } | null>(null);
    const [clipboard, setClipboard] = useState<{ names: string[], sourcePath: string, target: 'tizen' | 'local' } | null>(null);
    const completionCallbackRef = useRef<((matches: string[], dir: string) => void) | null>(null);

    const { addToast } = useToast();

    useEffect(() => { localStorage.setItem('tizen_last_path', tizenPath); }, [tizenPath]);
    useEffect(() => { localStorage.setItem('local_last_path', localPath); }, [localPath]);
    useEffect(() => { localStorage.setItem('tizen_explorer_bookmarks', JSON.stringify(bookmarks)); }, [bookmarks]);

    useEffect(() => {
        const newSocket = io('http://127.0.0.1:3003');
        newSocket.on('list_tizen_files_result', (data) => {
            setTizenLoading(false);
            if (data.success) { setTizenFiles(sortFiles(data.files)); setTizenError(null); }
            else { setTizenError(data.error); }
        });
        newSocket.on('list_local_files_result', (data) => {
            setLocalLoading(false);
            if (data.success) { setLocalFiles(sortFiles(data.files)); setLocalPath(data.path); setLocalError(null); }
            else { setLocalError(data.error); }
        });
        newSocket.on('pull_tizen_file_result', (data) => {
            if (data.success) {
                refreshLocalFiles();
                addToast(`Downloaded: ${data.remotePath.split('/').pop()}`, 'success');
            } else {
                addToast(`Pull Error: ${data.error}`, 'error');
            }
        });
        newSocket.on('push_tizen_file_result', (data) => {
            if (data.success) {
                refreshTizenFiles();
                addToast(`Uploaded: ${data.localPath.split(/[\\/]/).pop()}`, 'success');
            } else {
                addToast(`Push Error: ${data.error}`, 'error');
            }
        });
        newSocket.on('operation_result', (data) => {
            if (data.success) {
                if (data.op === 'install') {
                    addToast(`Installation finished!`, 'success');
                    console.log('[TizenExplorer] Install output:', data.output);
                } else {
                    addToast(`${data.op.toUpperCase()} successful`, 'success');
                }
                if (data.target === 'tizen') refreshTizenFiles();
                else refreshLocalFiles();
            } else {
                addToast(`${data.op.toUpperCase()} failed: ${data.error}`, 'error');
            }
        });

        newSocket.on('read_tizen_file_result', (data) => {
            if (data.success) {
                setViewingFile({ name: data.path.split('/').pop(), content: data.content });
            } else {
                addToast(`Read Error: ${data.error}`, 'error');
            }
        });

        newSocket.on('complete_tizen_path_result', (data) => {
            if (completionCallbackRef.current) {
                if (data.success) {
                    completionCallbackRef.current(data.matches, data.dir);
                } else {
                    addToast(`Tizen path completion failed: ${data.error || 'Unknown error'}`, 'error');
                }
                completionCallbackRef.current = null;
            }
        });

        newSocket.on('complete_local_path_result', (data) => {
            if (completionCallbackRef.current) {
                if (data.success) {
                    completionCallbackRef.current(data.matches, data.dir);
                } else {
                    addToast(`Local path completion failed: ${data.error || 'Unknown error'}`, 'error');
                }
                completionCallbackRef.current = null;
            }
        });

        setSocket(newSocket);
        return () => { newSocket.disconnect(); };
    }, [addToast]);

    const sortFiles = (files: FileItem[]) => [...files].sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1);

    const refreshTizenFiles = useCallback(() => { if (socket) { setTizenLoading(true); socket.emit('list_tizen_files', { deviceId, path: tizenPath }); } }, [socket, deviceId, tizenPath]);
    const refreshLocalFiles = useCallback(() => { if (socket) { setLocalLoading(true); socket.emit('list_local_files', { path: localPath }); } }, [socket, localPath]);

    useEffect(() => { refreshTizenFiles(); }, [tizenPath, deviceId, socket]);
    useEffect(() => { refreshLocalFiles(); }, [localPath, socket]);

    useEffect(() => {
        console.log('[TizenExplorer] Local Path:', localPath);
        console.log('[TizenExplorer] Local Files Count:', localFiles.length);
        if (localError) console.error('[TizenExplorer] Local Error:', localError);
    }, [localPath, localFiles, localError]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };

    const handleTransfer = (file: FileItem | FileItem[], direction: 'pull' | 'push') => {
        if (!socket) return;
        const filesToTransfer = Array.isArray(file) ? file : [file];

        filesToTransfer.forEach(f => {
            const separator = localPath.includes('\\') ? '\\' : '/';
            const localFull = localPath.endsWith(separator)
                ? localPath + f.name
                : localPath + (localPath.includes(':') && localPath.length === 2 ? '\\' : separator) + f.name;
            const tizenFull = tizenPath.endsWith('/') ? tizenPath + f.name : tizenPath + '/' + f.name;

            if (direction === 'pull') socket.emit('pull_tizen_file', { deviceId, remotePath: tizenFull, localPath: localFull });
            else socket.emit('push_tizen_file', { deviceId, localPath: localFull, remotePath: tizenFull });
        });

        // Clear selection after transfer
        if (direction === 'pull') setTizenSelected([]);
        else setLocalSelected([]);
    };

    const handleOperation = (op: string, data: any, target: 'tizen' | 'local') => {
        if (!socket) return;
        if (op === 'select_batch') {
            if (target === 'tizen') setTizenSelected(data.clear ? [] : data.names);
            else setLocalSelected(data.clear ? [] : data.names);
            return;
        }

        if (target === 'tizen') {
            const pathPrefix = tizenPath + (tizenPath.endsWith('/') ? '' : '/');
            if (op === 'delete') socket.emit('delete_tizen_path', { deviceId, path: pathPrefix + data.file.name });
            if (op === 'rename') socket.emit('rename_tizen_path', { deviceId, oldPath: pathPrefix + data.file.name, newPath: pathPrefix + data.newName });
            if (op === 'mkdir') socket.emit('mkdir_tizen_path', { deviceId, path: pathPrefix + data.name });
            if (op === 'install') {
                addToast(`Installing ${data.file.name}...`, 'info');
                socket.emit('install_tizen_tpk', { deviceId, path: pathPrefix + data.file.name });
            }
            if (op === 'read') {
                socket.emit('read_tizen_file', { deviceId, path: pathPrefix + data.file.name });
            }
            if (op === 'complete') {
                completionCallbackRef.current = data.callback;
                socket.emit('complete_tizen_path', { deviceId, path: data.path });
            }
        } else {
            const sep = localPath.includes('\\') ? '\\' : '/';
            const pathPrefix = localPath + (localPath.endsWith(sep) ? '' : sep);
            if (op === 'delete') socket.emit('delete_local_path', { path: pathPrefix + data.file.name });
            if (op === 'rename') socket.emit('rename_local_path', { oldPath: pathPrefix + data.file.name, newPath: pathPrefix + data.newName });
            if (op === 'mkdir') socket.emit('mkdir_local_path', { path: pathPrefix + data.name });
            if (op === 'open') socket.emit('open_local_path', { path: pathPrefix + data.file.name });
            if (op === 'complete') {
                completionCallbackRef.current = data.callback;
                socket.emit('complete_local_path', { path: data.path });
            }
        }

        if (op === 'clipboard_copy') {
            setClipboard({ names: data.names, sourcePath: target === 'tizen' ? tizenPath : localPath, target });
            addToast(`Copied ${data.names.length} items to clipboard`, 'info');
        }

        if (op === 'clipboard_paste') {
            if (!clipboard) {
                addToast('Nothing to paste', 'warning');
                return;
            }

            const isSameTarget = clipboard.target === target;
            const currentDestPath = target === 'tizen' ? tizenPath : localPath;
            const srcNames = clipboard.names;

            srcNames.forEach(name => {
                const srcFull = clipboard.sourcePath + (clipboard.sourcePath.endsWith(clipboard.target === 'local' && localPath.includes('\\') ? '\\' : '/') ? '' : (clipboard.target === 'local' && localPath.includes('\\') ? '\\' : '/')) + name;

                if (isSameTarget) {
                    // Pane 내부 복사 (같은 target 내 복사)
                    const extIndex = name.lastIndexOf('.');
                    const namePart = extIndex === -1 ? name : name.substring(0, extIndex);
                    const extPart = extIndex === -1 ? '' : name.substring(extIndex);
                    const destName = `${namePart}_copy${extPart}`;
                    const destFull = currentDestPath + (currentDestPath.endsWith(target === 'local' && localPath.includes('\\') ? '\\' : '/') ? '' : (target === 'local' && localPath.includes('\\') ? '\\' : '/')) + destName;

                    if (target === 'tizen') socket.emit('copy_tizen_path', { deviceId, srcPath: srcFull, destPath: destFull });
                    else socket.emit('copy_local_path', { srcPath: srcFull, destPath: destFull });
                } else {
                    // Pane 간 복사 (Transfer)
                    const targetFile = { name, type: 'file' } as FileItem;
                    if (target === 'tizen') {
                        // Local -> Tizen (Push)
                        socket.emit('push_tizen_file', { deviceId, localPath: srcFull, remotePath: currentDestPath + (currentDestPath.endsWith('/') ? '' : '/') + name });
                    } else {
                        // Tizen -> Local (Pull)
                        const sep = localPath.includes('\\') ? '\\' : '/';
                        socket.emit('pull_tizen_file', { deviceId, remotePath: srcFull, localPath: currentDestPath + (currentDestPath.endsWith(sep) ? '' : sep) + name });
                    }
                }
            });
        }
    };

    const toggleBookmark = (pathToToggle: string) => {
        if (bookmarks.includes(pathToToggle)) {
            setBookmarks(bookmarks.filter(b => b !== pathToToggle));
        } else {
            setBookmarks([...bookmarks, pathToToggle]);
        }
    };

    return (
        <div className="flex h-full bg-slate-950 overflow-hidden relative">
            {/* Sidebar (Favorites) */}
            <div className="w-48 bg-slate-900 border-r border-white/5 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                    Favorites
                    <Star size={12} className="text-slate-600" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {bookmarks.map((b, i) => (
                        <div key={i} className={`group flex items-center justify-between px-2 py-1.5 rounded transition-all cursor-pointer text-xs ${tizenPath === b ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 hover:bg-slate-800'}`} onClick={() => !tizenLoading && setTizenPath(b)}>
                            <span className="truncate">{b.split(/[\\/]/).pop() || '/'}</span>
                            <X size={10} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400" onClick={(e) => { e.stopPropagation(); toggleBookmark(b); }} />
                        </div>
                    ))}
                </div>
                <div className="p-2 border-t border-white/5">
                    <button
                        onClick={() => toggleBookmark(tizenPath)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-all font-bold"
                    >
                        <Star size={12} fill={bookmarks.includes(tizenPath) ? "currentColor" : "none"} />
                        {bookmarks.includes(tizenPath) ? "Remove Path" : "Add Tizen Path"}
                    </button>
                </div>
            </div>

            {/* Main Dual-Pane */}
            <div className="flex-1 flex min-w-0">
                <FileTable
                    title="Tizen Device"
                    sideIcon={Monitor}
                    files={tizenFiles}
                    currentPath={tizenPath}
                    setPath={setTizenPath}
                    onTransfer={(f: any) => handleTransfer(f, 'pull')} // Send: Tizen -> PC
                    onDropTransfer={(f: any) => handleTransfer(f, 'push')} // Receive: PC -> Tizen
                    transferIcon={Download}
                    isLoading={tizenLoading}
                    error={tizenError}
                    formatSize={formatSize}
                    bookmarks={bookmarks}
                    toggleBookmark={() => toggleBookmark(tizenPath)}
                    selectedFiles={tizenSelected}
                    toggleSelection={(name: string) => setTizenSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])}
                    onOperation={(op: string, data: any) => handleOperation(op, data, 'tizen')}
                    addToast={addToast}
                />

                <div className="w-[1px] bg-indigo-500/20 relative z-10">
                    <div
                        className="absolute top-1/2 -translate-y-1/2 -left-2.5 p-1 bg-slate-800 rounded-full text-indigo-400 border border-indigo-500/20 shadow-lg cursor-pointer hover:bg-indigo-500 hover:text-white transition-all z-20"
                        title="Transfer Selected"
                        onClick={() => {
                            if (tizenSelected.length > 0) {
                                const files = tizenFiles.filter(f => tizenSelected.includes(f.name));
                                handleTransfer(files, 'pull');
                            } else if (localSelected.length > 0) {
                                const files = localFiles.filter(f => localSelected.includes(f.name));
                                handleTransfer(files, 'push');
                            }
                        }}
                    >
                        <ArrowLeftRight size={14} className={(tizenSelected.length > 0 || localSelected.length > 0) ? "animate-pulse" : ""} />
                    </div>
                </div>

                <FileTable
                    title="Local PC"
                    sideIcon={HardDrive}
                    files={localFiles}
                    currentPath={localPath}
                    setPath={setLocalPath}
                    onTransfer={(f: any) => handleTransfer(f, 'push')} // Send: PC -> Tizen
                    onDropTransfer={(f: any) => handleTransfer(f, 'pull')} // Receive: Tizen -> PC
                    transferIcon={Upload}
                    isLoading={localLoading}
                    error={localError}
                    formatSize={formatSize}
                    selectedFiles={localSelected}
                    toggleSelection={(name: string) => setLocalSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])}
                    onOperation={(op: string, data: any) => handleOperation(op, data, 'local')}
                    addToast={addToast}
                />
            </div>

            {/* File Viewer Modal */}
            {viewingFile && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                    onKeyDown={(e) => {
                        if (e.ctrlKey && e.key === 'a') {
                            e.preventDefault();
                            const range = document.createRange();
                            const selection = window.getSelection();
                            const pre = document.getElementById('view-content-pre');
                            if (pre && selection) {
                                range.selectNodeContents(pre);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }
                        }
                    }}
                >
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-[90vw] max-w-6xl h-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in-center duration-300">
                        <div className="px-6 py-4 bg-slate-950/50 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                    <File size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-none">{viewingFile.name}</h3>
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Tizen File Content</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(viewingFile.content);
                                        addToast('Copied to clipboard', 'success');
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-[11px] font-bold transition-all border border-indigo-500/20"
                                >
                                    <Copy size={14} /> Copy
                                </button>
                                <button
                                    onClick={() => setViewingFile(null)}
                                    className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-950/30 custom-scrollbar">
                            <pre
                                id="view-content-pre"
                                className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed selection:bg-indigo-500/30 outline-none"
                                tabIndex={0}
                            >
                                {viewingFile.content || "Empty file."}
                            </pre>
                        </div>
                        <div className="px-6 py-3 bg-slate-900 border-t border-white/5 flex justify-end">
                            <button
                                onClick={() => setViewingFile(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-white/5"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TizenFileExplorer;
