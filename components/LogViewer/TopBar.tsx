import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { useLogContext } from './LogContext';
import { useToast } from '../../contexts/ToastContext';


const { Plus, Trash2, Maximize, Columns, Sparkles } = Lucide;

const TopBar: React.FC = () => {
    const { addToast } = useToast();
    const {
        rules, selectedRuleId, setSelectedRuleId,
        handleCreateRule, handleDeleteRule, onExportSettings,
        fileInputRef, logFileInputRef,
        leftFileName, leftIndexingProgress,
        isDualView, setIsDualView, toggleDualView,
        handleImportFile, handleLogFileSelect,
        setIsTizenModalOpen,
        requestLeftLines, requestRightLines,
        leftFilteredCount, rightFilteredCount,
        tizenSocket, handleTizenDisconnect, findText,
        searchInputRef,
        isTizenQuickConnect, setIsTizenQuickConnect // Added
    } = useLogContext();

    // Quick Connect Handler
    const onQuickConnect = () => {
        setIsTizenQuickConnect(true);
        setIsTizenModalOpen(true);
    };

    const onSelectRule = setSelectedRuleId;
    const onCreateRule = handleCreateRule;
    const onDeleteRule = handleDeleteRule;
    const onImportFile = handleImportFile;
    const onLogFileSelect = handleLogFileSelect;
    const onConnectTizen = () => setIsTizenModalOpen(true);

    const handleCopyLogs = async () => {
        let content = '';
        if (leftFilteredCount > 0) {
            const lines = await requestLeftLines(0, leftFilteredCount);
            content += `--- LEFT PANE (${lines.length} lines) ---\n`;
            content += lines.map(l => l.content).join('\n');
        }
        if (isDualView && rightFilteredCount > 0) {
            const lines = await requestRightLines(0, rightFilteredCount);
            content += `\n--- RIGHT PANE (${lines.length} lines) ---\n`;
            content += lines.map(l => l.content).join('\n');
        }
        if (!content) {
            console.log('[TopBar] No content to copy, showing warning toast');
            return addToast('No logs to copy.', 'warning');
        }
        try {
            await navigator.clipboard.writeText(content);
            addToast('Logs copied to clipboard!', 'success');
        } catch (e) { addToast('Failed to copy.', 'error'); }
    };

    const handleSaveLogs = async () => {
        let content = '';
        if (leftFilteredCount > 0) {
            const lines = await requestLeftLines(0, leftFilteredCount);
            content += `--- LEFT PANE (${lines.length} lines) ---\n`;
            content += lines.map(l => l.content).join('\n');
        }
        if (isDualView && rightFilteredCount > 0) {
            const lines = await requestRightLines(0, rightFilteredCount);
            content += `\n--- RIGHT PANE (${lines.length} lines) ---\n`;
            content += lines.map(l => l.content).join('\n');
        }

        if (!content) return addToast('No logs to save.', 'warning');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `filtered_logs_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="backdrop-blur-sm border-b p-4 pr-[200px] flex items-center justify-between shrink-0 h-16 z-50 title-drag relative" style={{ backgroundColor: '#0f172a', borderBottomColor: 'rgba(99, 102, 241, 0.3)' }}>
            {/* Left Section: Mission & Rules */}
            <div className="flex items-center gap-6 no-drag">
                <div className="flex items-center space-x-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20"><Sparkles size={18} className="text-indigo-400" /></div>
                    <select className="border-none bg-transparent font-bold text-slate-200 text-lg focus:outline-none cursor-pointer hover:text-indigo-400 transition-colors [&>option]:bg-slate-900 w-64 truncate" value={selectedRuleId || ''} onChange={(e) => onSelectRule(e.target.value)}>
                        {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div className="h-6 w-px bg-slate-700"></div>
                <div className="flex items-center space-x-2">
                    <button onClick={onCreateRule} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-full flex items-center text-sm font-medium shadow-lg shadow-indigo-900/50 transition-all hover:scale-105" title="New Rule"><Plus size={16} className="mr-1" /> Create</button>
                    {selectedRuleId && (
                        <>
                            <button onClick={onDeleteRule} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 size={18} /></button>
                        </>
                    )}
                </div>
            </div>

            {/* Right Section: Layout, Tools */}
            <div className="flex items-center gap-3 no-drag">
                {/* File Init - Removed as per request */}

                <button
                    onClick={onConnectTizen}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${tizenSocket
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300'
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
                        }`}
                >
                    <Lucide.Link size={14} />
                    <span className="text-sm font-medium">Connection</span>
                    {tizenSocket && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1"></div>}
                </button>

                {/* Quick Connect (Bolt) */}
                {!tizenSocket && (
                    <button
                        onClick={onQuickConnect}
                        className="p-1.5 rounded-lg bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700 hover:text-yellow-300 border transition-all shadow-sm"
                        title="Quick Connect (Last Used)"
                    >
                        <Lucide.Zap size={14} fill="currentColor" />
                    </button>
                )}

                <div className="w-px h-6 bg-slate-700 mx-1"></div>

                {/* Find Bar */}
                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 h-9 px-2">
                    <Lucide.Search size={14} className="text-slate-500 mr-2" />
                    <input
                        ref={searchInputRef}
                        className="bg-transparent border-none text-xs text-slate-300 w-32 focus:outline-none placeholder-slate-600 font-mono"
                        placeholder="Find in logs..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value;
                                if (val.trim()) {
                                    // Default to Left pane for now
                                    findText(val, e.shiftKey ? 'prev' : 'next', 'left', undefined, false, true);
                                    // If Dual View, maybe search Right too? 
                                    if (isDualView) findText(val, e.shiftKey ? 'prev' : 'next', 'right', undefined, false, true);
                                }
                            }
                        }}
                    />
                </div>

                <div className="w-px h-6 bg-slate-700 mx-1"></div>

                {/* Layout Toggle */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button onClick={() => isDualView && toggleDualView()} className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-all ${!isDualView ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Maximize size={14} /> Single</button>
                    <button onClick={() => !isDualView && toggleDualView()} className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-all ${isDualView ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Columns size={14} /> Split</button>
                </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onImportFile} />
            <input type="file" ref={logFileInputRef} className="hidden" onChange={onLogFileSelect} />


        </div>
    );
};

export default TopBar;
