import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { useLogContext } from './LogContext';


const { Plus, Trash2, Save, Upload, FileDown, Maximize, Columns, Sparkles } = Lucide;

const TopBar: React.FC = () => {
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
        searchInputRef
    } = useLogContext();

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
        if (!content) return alert('No logs to copy.');
        try {
            await navigator.clipboard.writeText(content);
            alert('Logs copied to clipboard!');
        } catch (e) { alert('Failed to copy.'); }
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
        if (!content) return alert('No logs to save.');

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
        <div className="backdrop-blur-sm border-b p-4 flex items-center justify-between shrink-0 h-16 z-20 title-drag relative" style={{ backgroundColor: '#0f172a', borderBottomColor: 'rgba(99, 102, 241, 0.3)' }}>
            {/* Left Section: Mission & Rules */}
            <div className="flex items-center gap-6 no-drag">
                <div className="flex items-center space-x-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20"><Sparkles size={18} className="text-indigo-400" /></div>
                    <select className="border-none bg-transparent font-bold text-slate-200 text-lg focus:outline-none cursor-pointer hover:text-indigo-400 transition-colors [&>option]:bg-slate-900" value={selectedRuleId || ''} onChange={(e) => onSelectRule(e.target.value)}>
                        {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div className="h-6 w-px bg-slate-700"></div>
                <div className="flex items-center space-x-2">
                    <button onClick={onCreateRule} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-full flex items-center text-sm font-medium shadow-lg shadow-indigo-900/50 transition-all hover:scale-105" title="New Rule"><Plus size={16} className="mr-1" /> Create</button>
                    {selectedRuleId && (
                        <>
                            <button onClick={onDeleteRule} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 size={18} /></button>
                            <div className="w-px h-4 bg-slate-700 mx-1"></div>
                            <button onClick={onExportSettings} className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-full transition-colors" title="Export Settings"><Save size={18} /></button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-full transition-colors" title="Import Settings"><Upload size={18} /></button>
                        </>
                    )}
                </div>
            </div>

            {/* Right Section: Layout, Tools */}
            <div className="flex items-center gap-3 no-drag mr-36">
                {/* File Init - Removed as per request */}

                {tizenSocket ? (
                    <button onClick={handleTizenDisconnect} className="flex items-center gap-2 px-3 py-1.5 bg-red-950/30 rounded-lg border border-red-500/30 hover:bg-red-900/50 transition-colors text-red-400 hover:text-red-300">
                        <Lucide.Unplug size={14} />
                        <span className="text-sm font-medium">Disconnect</span>
                    </button>
                ) : (
                    <button onClick={onConnectTizen} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors text-indigo-400 hover:text-indigo-300">
                        <Lucide.Tv size={14} />
                        <span className="text-sm font-medium">Connect</span>
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
                                    findText(val, e.shiftKey ? 'prev' : 'next', 'left');
                                    // If Dual View, maybe search Right too? 
                                    if (isDualView) findText(val, e.shiftKey ? 'prev' : 'next', 'right');
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
