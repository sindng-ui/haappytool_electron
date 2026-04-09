import React from 'react';
import { useEverythingSearch, EverythingResultItem } from './hooks/useEverythingSearch';
import * as Lucide from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';

const EverythingSearch: React.FC = () => {
    const { query, setQuery, results, loading, error, connected, openFile } = useEverythingSearch();

    const getFileIcon = (item: EverythingResultItem) => {
        if (item.type === 'folder') return <Lucide.Folder className="text-amber-400" size={18} />;
        
        const ext = item.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'exe': case 'msi': return <Lucide.AppWindow className="text-blue-400" size={18} />;
            case 'txt': case 'md': case 'log': return <Lucide.FileText className="text-slate-400" size={18} />;
            case 'jpg': case 'png': case 'gif': case 'svg': return <Lucide.Image className="text-pink-400" size={18} />;
            case 'pdf': return <Lucide.FileText className="text-red-400" size={18} />;
            case 'zip': case '7z': case 'rar': return <Lucide.Archive className="text-orange-400" size={18} />;
            default: return <Lucide.File className="text-slate-500" size={18} />;
        }
    };

    const formatSize = (bytes: string) => {
        const b = parseInt(bytes);
        if (isNaN(b)) return '';
        if (b === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
            {/* Header / Search Bar */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20 text-white">
                            <Lucide.Search size={20} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Everything Search</h1>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <span className="opacity-60">{connected ? 'Local Engine Connected' : 'Disconnected'}</span>
                    </div>
                </div>

                <div className="relative group">
                    <Lucide.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="전체 경로 또는 파일 이름으로 검색... (Everything 기반)"
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        autoFocus
                    />
                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Lucide.Loader2 className="animate-spin text-indigo-500" size={20} />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                    {error ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                        >
                            <div className="p-4 bg-red-500/10 text-red-500 rounded-full mb-4">
                                <Lucide.AlertCircle size={48} />
                            </div>
                            <h2 className="text-lg font-semibold mb-2">엔진 연결 오류</h2>
                            <p className="text-slate-500 max-w-md">{error}</p>
                            <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-left">
                                <p className="font-bold mb-2">📌 해결 방법:</p>
                                <ul className="list-disc list-inside space-y-1 opacity-80">
                                    <li>Everything 앱이 실행 중인지 확인하세요.</li>
                                    <li>[도구] - [설정] - [HTTP 서버]에서 서버를 활성화하세요.</li>
                                    <li>기본 포트(8080)를 사용 중인지 확인하세요.</li>
                                </ul>
                            </div>
                        </motion.div>
                    ) : results.items.length === 0 && query ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 flex flex-col items-center justify-center text-slate-500"
                        >
                            <Lucide.SearchX size={48} className="mb-4 opacity-20" />
                            <p>검색 결과가 없습니다.</p>
                        </motion.div>
                    ) : results.items.length === 0 && !query ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 flex flex-col items-center justify-center text-slate-500"
                        >
                            <Lucide.Zap size={48} className="mb-4 text-indigo-500 opacity-20" />
                            <p>검색어를 입력하여 번개처럼 빠른 검색을 경험하세요!</p>
                        </motion.div>
                    ) : (
                        <div className="h-full">
                            <div className="flex items-center px-6 py-2 bg-slate-100/50 dark:bg-slate-800/50 text-[10px] uppercase tracking-wider font-bold opacity-50 border-b border-slate-200 dark:border-slate-800">
                                <span className="flex-1">Name / Path</span>
                                <span className="w-24 text-right">Size</span>
                                <span className="w-40 text-right">Date Modified</span>
                            </div>
                            <Virtuoso
                                data={results.items}
                                totalCount={results.items.length}
                                itemContent={(index, item) => (
                                    <div 
                                        key={`${item.fullPath}-${index}`}
                                        className="flex items-center px-6 py-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 cursor-pointer transition-colors group"
                                        onDoubleClick={() => openFile(item.fullPath)}
                                    >
                                        <div className="flex-1 flex items-center gap-3 min-w-0">
                                            <div className="flex-shrink-0">
                                                {getFileIcon(item)}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium truncate group-hover:text-indigo-500 transition-colors">
                                                    {item.name}
                                                </span>
                                                <span className="text-[10px] opacity-40 truncate">
                                                    {item.path}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-24 text-right text-xs opacity-60 tabular-nums">
                                            {item.type === 'file' ? formatSize(item.size) : '--'}
                                        </div>
                                        <div className="w-40 text-right text-xs opacity-60 tabular-nums">
                                            {item.dateModified}
                                        </div>
                                    </div>
                                )}
                            />
                            <div className="absolute bottom-4 right-6 px-3 py-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-full text-[10px] font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2">
                                TOP {results.items.length} OF {results.total.toLocaleString()} RESULTS
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default EverythingSearch;
