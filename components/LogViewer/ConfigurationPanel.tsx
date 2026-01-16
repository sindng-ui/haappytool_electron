import React from 'react';
import * as Lucide from 'lucide-react';
import { useLogContext } from './LogContext';
import { Button } from '../ui/Button';
import { ConfigHeader } from './ConfigSections/ConfigHeader';
import { HappyComboSection } from './ConfigSections/HappyComboSection';
import { BlockListSection } from './ConfigSections/BlockListSection';
import { HighlightSection } from './ConfigSections/HighlightSection';
import { LogSettingsSection } from './ConfigSections/LogSettingsSection';

import { ViewSettingsSection } from './ConfigSections/ViewSettingsSection';

const { ChevronLeft, ChevronRight } = Lucide;

const ConfigurationPanel: React.FC = () => {
    const {
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, handleConfigResizeStart,
        currentConfig, updateCurrentRule,
        groupedRoots, collapsedRoots, setCollapsedRoots, handleToggleRoot,
        sendTizenCommand,
        logViewPreferences, updateLogViewPreferences,
        isLogging, setIsLogging, connectionMode
    } = useLogContext();

    const onToggle = () => setIsPanelOpen(!isPanelOpen);

    const onToggleRootCollapse = (root: string) => {
        setCollapsedRoots(prev => {
            const next = new Set(prev);
            if (next.has(root)) next.delete(root);
            else next.add(root);
            return next;
        });
    };
    const defaultLogCommand = 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &';

    const handleToggleLogging = () => {
        if (isLogging) {
            // Stop Logging
            // 1. Send Ctrl+C
            sendTizenCommand('\x03');

            // 2. Kill dlogutil explicitly after a short delay
            setTimeout(() => {
                sendTizenCommand('pkill dlogutil\n');
            }, 300);
            setIsLogging(false);
        } else {
            // Start Logging
            if (!currentConfig) return;
            // 1. Kill existing dlogutil
            sendTizenCommand('pkill dlogutil\n');

            // 2. Refresh tags and build command
            const cmdTemplate = currentConfig.logCommand ?? defaultLogCommand;
            const tags = (currentConfig.logTags || []).join(' ');
            const finalCmd = cmdTemplate.replace(/\$\(TAGS\)/g, tags);

            // Execute
            sendTizenCommand(finalCmd + '\n');
            setIsLogging(true);
        }
    };

    if (!currentConfig) {
        return (
            <div className="border-r border-slate-800 bg-slate-950 p-6 flex items-center justify-center text-slate-500 flex-col h-full shrink-0" style={{ width: isPanelOpen ? configPanelWidth : undefined }}>
                Select or Create a Rule
            </div>
        );
    }

    return (
        <div
            className={`${isPanelOpen ? '' : 'w-12'} glass-morphism flex flex-col h-full shadow-2xl z-20 custom-scrollbar relative shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]`}
            style={{ width: isPanelOpen ? configPanelWidth : undefined }}
        >
            {isPanelOpen && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1 hover:bg-indigo-500/50 cursor-col-resize z-50 transition-colors"
                    onMouseDown={handleConfigResizeStart}
                />
            )}

            <div className="absolute top-[18px] right-[-14px] z-50">
                <Button
                    variant="secondary"
                    className="w-7 h-8 rounded-full bg-indigo-600 border border-indigo-400/30 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40 flex items-center justify-center transition-all active:scale-95 focus:scale-100 ring-0 hover:scale-110"
                    onClick={onToggle}
                >
                    {isPanelOpen ? <ChevronLeft size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
                </Button>
            </div>
            {isPanelOpen ? (
                <div className="p-6 overflow-y-auto h-full custom-scrollbar pb-20 space-y-6">
                    <ConfigHeader
                        name={currentConfig.name}
                        onUpdateName={(name) => updateCurrentRule({ name })}
                    />

                    <div className="card-gradient p-1">
                        <HappyComboSection
                            currentConfig={currentConfig}
                            updateCurrentRule={updateCurrentRule}
                            groupedRoots={groupedRoots}
                            collapsedRoots={collapsedRoots}
                            onToggleRootCollapse={onToggleRootCollapse}
                            handleToggleRoot={handleToggleRoot}
                            happyCombosCaseSensitive={currentConfig.happyCombosCaseSensitive || false}
                        />
                    </div>

                    <div className="card-gradient p-1">
                        <BlockListSection
                            currentConfig={currentConfig}
                            updateCurrentRule={updateCurrentRule}
                            blockListCaseSensitive={currentConfig.blockListCaseSensitive || false}
                        />
                    </div>

                    <div className="card-gradient p-1">
                        <HighlightSection
                            currentConfig={currentConfig}
                            updateCurrentRule={updateCurrentRule}
                            colorHighlightsCaseSensitive={currentConfig.colorHighlightsCaseSensitive || false}
                        />
                    </div>

                    <div className="card-gradient p-1">
                        <LogSettingsSection
                            currentConfig={currentConfig}
                            updateCurrentRule={updateCurrentRule}
                            isLogging={isLogging}
                            onToggleLogging={handleToggleLogging}
                            connectionMode={connectionMode}
                        />
                    </div>

                    <div className="card-gradient p-4">
                        <ViewSettingsSection
                            preferences={logViewPreferences}
                            onUpdate={updateLogViewPreferences}
                        />
                    </div>

                </div>
            ) : (
                <div className="h-full flex flex-col items-center pt-24 gap-4 cursor-pointer hover:bg-white/5 transition-colors group" onClick={onToggle}>
                    <div className="vertical-text text-slate-500 font-bold tracking-[0.2em] text-[10px] uppercase transform rotate-180 opacity-60 group-hover:text-indigo-400 group-hover:opacity-100 transition-all whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                        Configuration
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfigurationPanel;
