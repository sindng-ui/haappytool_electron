import React, { useState, useCallback } from 'react';
import { LogRule, AppSettings } from '../types';
import LogSession from './LogSession';
import { LogProvider } from './LogViewer/LogContext';
import { Plus, X, FileText } from 'lucide-react';


interface Tab {
    id: string;
    title: string;
    initialFile: File | null;
}

interface LogExtractorProps {
    rules: LogRule[];
    onUpdateRules: (rules: LogRule[]) => void;
    onExportSettings: () => void;
    onImportSettings: (settings: AppSettings) => void;
}

const LogExtractor: React.FC<LogExtractorProps> = (props) => {
    // Start with one empty tab
    const [tabs, setTabs] = useState<Tab[]>([{ id: 'tab-1', title: 'New Log 1', initialFile: null }]);
    const [activeTabId, setActiveTabId] = useState<string>('tab-1');
    const [tabCounter, setTabCounter] = useState(2);

    const handleAddTab = useCallback((file: File | null = null) => {
        const newTabId = `tab-${tabCounter}`;
        const newTitle = file ? file.name : `New Log ${tabCounter}`;

        setTabs(prev => [...prev, { id: newTabId, title: newTitle, initialFile: file }]);
        setActiveTabId(newTabId);
        setTabCounter(prev => prev + 1);
    }, [tabCounter]);

    const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();

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
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                const currentIndex = tabs.findIndex(t => t.id === activeTabId);
                const nextIndex = (currentIndex + 1) % tabs.length;
                setActiveTabId(tabs[nextIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tabs, activeTabId]);

    // Tab Bar Component
    const renderTabBar = () => (
        <div
            className="h-9 flex items-center bg-slate-950/90 border-b border-indigo-500/30 select-none pl-1 gap-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleGlobalDrop}
        >
            <div className="flex-1 flex overflow-x-auto no-scrollbar items-end h-full px-2 gap-1">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`
                                group relative flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] h-[34px] 
                                text-xs font-medium cursor-pointer transition-all rounded-t-lg border-t border-l border-r
                                ${isActive
                                    ? 'bg-slate-900 border-indigo-500/50 text-indigo-300 z-10'
                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900 hover:text-slate-300 border-b border-b-indigo-500/30'
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
                        </div>
                    );
                })}

                <button
                    onClick={() => handleAddTab(null)}
                    className="h-[28px] w-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors ml-1 mb-0.5"
                    title="New Tab"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-full flex-col font-sans overflow-hidden bg-slate-950">


            <div className="flex-1 overflow-hidden relative">
                {tabs.map((tab) => (
                    <LogProvider key={tab.id} {...props} initialFile={tab.initialFile}>
                        <SessionWrapper
                            isActive={tab.id === activeTabId}
                            onTitleChange={(newTitle) => {
                                setTabs(current => current.map(t => t.id === tab.id ? { ...t, title: newTitle } : t));
                            }}
                            headerElement={renderTabBar()}
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
    onTitleChange: (title: string) => void;
    headerElement: React.ReactNode;
}> = ({ isActive, onTitleChange, headerElement }) => {
    return <LogSession isActive={isActive} onTitleChange={onTitleChange} headerElement={headerElement} />;
};

export default LogExtractor;
