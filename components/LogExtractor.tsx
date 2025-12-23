import React, { useState, useCallback, useEffect } from 'react';
import { LogRule, AppSettings } from '../types';
import LogSession from './LogSession';
import { LogProvider } from './LogViewer/LogContext';
import { Plus, X, FileText } from 'lucide-react';


interface Tab {
    id: string;
    title: string;
    initialFile: File | null;
    filePath?: string;
}

import { useHappyTool } from '../contexts/HappyToolContext';

interface Tab {
    id: string;
    title: string;
    initialFile: File | null;
    filePath?: string;
}

const LogExtractor: React.FC = () => {
    const {
        logRules: rules,
        setLogRules: onUpdateRules,
        handleExportSettings: onExportSettings,
        handleImportSettings: onImportSettings
    } = useHappyTool();
    // Shared state for configuration panel width
    const [configPanelWidth, setConfigPanelWidth] = useState(() => {
        try {
            const saved = localStorage.getItem('configPanelWidth');
            if (!saved) return 320;
            const parsed = parseFloat(saved);
            return Number.isFinite(parsed) && parsed > 100 ? parsed : 320;
        } catch (e) {
            return 320;
        }
    });

    useEffect(() => {
        localStorage.setItem('configPanelWidth', configPanelWidth.toString());
    }, [configPanelWidth]);

    // Default initial state (do not load validation files)
    const [tabs, setTabs] = useState<Tab[]>(() => {
        try {
            const saved = localStorage.getItem('openTabs');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        initialFile: null, // File object cannot be restored, but filePath can
                        filePath: t.filePath
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to load tabs', e);
        }
        return [{ id: 'tab-1', title: 'New Log 1', initialFile: null }];
    });

    const [activeTabId, setActiveTabId] = useState<string>(() => {
        const saved = localStorage.getItem('activeTabId');
        return saved || 'tab-1';
    });

    // Determine next tab counter based on existing IDs
    const [tabCounter, setTabCounter] = useState(() => {
        const saved = localStorage.getItem('openTabs');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const maxId = parsed.reduce((max: number, t: any) => {
                        const match = t.id.match(/^tab-(\d+)$/);
                        if (match) {
                            return Math.max(max, parseInt(match[1], 10));
                        }
                        return max;
                    }, 1);
                    return maxId + 1;
                }
            } catch { }
        }
        return 2;
    });

    useEffect(() => {
        const safeTabs = tabs.map(t => ({ id: t.id, title: t.title, filePath: t.filePath }));
        localStorage.setItem('openTabs', JSON.stringify(safeTabs));
        localStorage.setItem('activeTabId', activeTabId);
    }, [tabs, activeTabId]);

    const handleAddTab = useCallback((file: File | null = null) => {
        const newTabId = `tab-${tabCounter}`;
        const newTitle = file ? file.name : `New Log ${tabCounter}`;
        const filePath = file && 'path' in file ? (file as any).path : undefined;

        setTabs(prev => [...prev, { id: newTabId, title: newTitle, initialFile: file, filePath }]);
        setActiveTabId(newTabId);
        setTabCounter(prev => prev + 1);
    }, [tabCounter]);

    const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();

        // Cleanup storage
        localStorage.removeItem(`tabState_${tabId}`);

        if (tabs.length === 1) {
            setTabs([{ id: `tab-${tabCounter}`, title: `New Log ${tabCounter}`, initialFile: null }]);
            setActiveTabId(`tab-${tabCounter}`);
            setTabCounter(prev => prev + 1);
            return;
        }

        const tabIndex = tabs.findIndex(t => t.id === tabId);
        const newTabs = tabs.filter(t => t.id !== tabId);

        setTabs(newTabs);

        if (tabId === activeTabId) {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            setActiveTabId(newTabs[newActiveIndex].id);
        }
    }, [tabs, activeTabId, tabCounter]);

    const handleGlobalDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            handleAddTab(file);
        }
    }, [handleAddTab]);

    // Keyboard Navigation for Tabs
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl+Tab (Next Tab)
            // Note: Shift+Ctrl+Tab for previous tab is also standard, implementing both for completeness
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                const currentIndex = tabs.findIndex(t => t.id === activeTabId);
                if (currentIndex === -1) return;

                let nextIndex;
                if (e.shiftKey) {
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                } else {
                    nextIndex = (currentIndex + 1) % tabs.length;
                }

                setActiveTabId(tabs[nextIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tabs, activeTabId]);

    // Memoize the header element to prevent re-renders of SessionWrapper
    const headerElement = React.useMemo(() => (
        <div
            className="h-9 flex items-center bg-slate-950 border-b border-indigo-500/30 select-none pl-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleGlobalDrop}
        >
            <div className="flex-1 flex overflow-x-auto items-end h-full px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {tabs.map((tab, idx) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`
                                group relative flex items-center gap-2 px-4 py-1.5 min-w-[120px] max-w-[200px] h-[34px] 
                                text-xs font-medium cursor-pointer transition-all rounded-t-lg border-t border-l border-r shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.5)]
                                ${idx > 0 ? '-ml-3' : ''}
                                ${isActive
                                    ? 'bg-slate-900 border-indigo-500/50 text-indigo-300 z-20 shadow-lg'
                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900 hover:text-slate-300 border-b-indigo-500/30 z-10 hover:z-15'
                                }
                            `}
                            title={tab.title}
                        >
                            <FileText size={12} className={isActive ? 'text-indigo-400' : 'opacity-50'} />
                            <span className="truncate flex-1">{tab.title}</span>
                            <button
                                onClick={(e) => handleCloseTab(e, tab.id)}
                                className={`
                                    opacity-0 group-hover:opacity-100 p-0.5 rounded-md transition-all
                                    ${isActive ? 'hover:bg-indigo-500/20 text-indigo-400' : 'hover:bg-slate-600 text-slate-400'}
                                `}
                            >
                                <X size={12} />
                            </button>

                            {isActive && (
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full" />
                            )}
                            {/* Bottom border hider for active tab */}
                            {isActive && (
                                <div className="absolute -bottom-[1px] left-0 right-0 h-[1px] bg-slate-900 z-30" />
                            )}
                        </div>
                    );
                })}

                <button
                    onClick={() => handleAddTab(null)}
                    className="h-[28px] w-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors ml-1 mb-0.5 z-0"
                    title="New Tab"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    ), [tabs, activeTabId, handleAddTab, handleCloseTab, handleGlobalDrop]);

    const handleTitleChange = useCallback((tabId: string, newTitle: string) => {
        setTabs(current => current.map(t => t.id === tabId ? { ...t, title: newTitle } : t));
    }, []);

    return (
        <div className="flex h-full flex-col font-sans overflow-hidden bg-slate-950">
            <div className="flex-1 overflow-hidden relative">
                {tabs.map((tab) => (
                    <LogProvider
                        key={tab.id}
                        rules={rules}
                        onUpdateRules={onUpdateRules}
                        onExportSettings={onExportSettings}
                        onImportSettings={onImportSettings}
                        configPanelWidth={configPanelWidth}
                        setConfigPanelWidth={setConfigPanelWidth}
                        tabId={tab.id}
                        initialFilePath={tab.filePath}
                        onFileChange={(newPath) => {
                            setTabs(current => current.map(t => t.id === tab.id ? { ...t, filePath: newPath } : t));
                        }}
                        isActive={tab.id === activeTabId}
                    >
                        <SessionWrapper
                            isActive={tab.id === activeTabId}
                            title={tab.title}
                            tabId={tab.id}
                            onTitleChange={handleTitleChange}
                            headerElement={headerElement}
                        />
                    </LogProvider>
                ))}
            </div>
        </div>
    );
};

// Wrapper to properly pass props
const SessionWrapper: React.FC<{
    isActive: boolean;
    title: string;
    onTitleChange: (id: string, title: string) => void;
    tabId: string;
    headerElement: React.ReactNode;
}> = React.memo(({ isActive, title, onTitleChange, tabId, headerElement }) => {
    // We create a stable callback for this specific session instance
    const handleTitleChange = useCallback((newTitle: string) => {
        onTitleChange(tabId, newTitle);
    }, [onTitleChange, tabId]);

    return <LogSession isActive={isActive} currentTitle={title} onTitleChange={handleTitleChange} headerElement={headerElement} />;
});

export default LogExtractor;
