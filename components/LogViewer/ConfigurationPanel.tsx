import React from 'react';
import * as Lucide from 'lucide-react';
import { useLogContext } from './LogContext';
import { Button } from '../ui/Button';
import { ConfigHeader } from './ConfigSections/ConfigHeader';
import { HappyComboSection } from './ConfigSections/HappyComboSection';
import { BlockListSection } from './ConfigSections/BlockListSection';
import { HighlightSection } from './ConfigSections/HighlightSection';
import { LogSettingsSection } from './ConfigSections/LogSettingsSection';

const { ChevronLeft, ChevronRight } = Lucide;

const ConfigurationPanel: React.FC = () => {
    const {
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, handleConfigResizeStart,
        currentConfig, updateCurrentRule,
        groupedRoots, collapsedRoots, setCollapsedRoots, handleToggleRoot,
        sendTizenCommand
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
    const defaultLogCommand = 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS)';

    const handleStartLogging = () => {
        if (!currentConfig) return;
        const cmdTemplate = currentConfig.logCommand ?? defaultLogCommand;
        const tags = (currentConfig.logTags || []).join(' ');
        const finalCmd = cmdTemplate.replace(/\$\(TAGS\)/g, tags);
        sendTizenCommand(finalCmd + '\n');
    };

    const handleStopLogging = () => {
        sendTizenCommand('\x03'); // Ctrl+C
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
            className={`${isPanelOpen ? '' : 'w-12'} bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-xl z-20 custom-scrollbar relative shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]`}
            style={{ width: isPanelOpen ? configPanelWidth : undefined }}
        >
            {isPanelOpen && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-indigo-500/50 cursor-col-resize z-50 transition-colors"
                    onMouseDown={handleConfigResizeStart}
                />
            )}

            <div className="absolute top-[18px] right-[-10px] z-50">
                <Button
                    variant="secondary"
                    className="w-6 h-10 rounded-r-xl p-0 bg-indigo-600 border-y border-r border-indigo-400/50 hover:bg-indigo-500 shadow-xl flex items-center justify-center transition-all active:scale-95 focus:scale-100 ring-0"
                    onClick={onToggle}
                >
                    {isPanelOpen ? <ChevronLeft size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
                </Button>
            </div>
            {isPanelOpen ? (
                <div className="p-6 overflow-y-auto h-full custom-scrollbar pb-20">
                    <ConfigHeader
                        name={currentConfig.name}
                        onUpdateName={(name) => updateCurrentRule({ name })}
                    />

                    <HappyComboSection
                        currentConfig={currentConfig}
                        updateCurrentRule={updateCurrentRule}
                        groupedRoots={groupedRoots}
                        collapsedRoots={collapsedRoots}
                        onToggleRootCollapse={onToggleRootCollapse}
                        handleToggleRoot={handleToggleRoot}
                        happyCombosCaseSensitive={currentConfig.happyCombosCaseSensitive || false}
                    />

                    <BlockListSection
                        currentConfig={currentConfig}
                        updateCurrentRule={updateCurrentRule}
                        blockListCaseSensitive={currentConfig.blockListCaseSensitive || false}
                    />

                    <HighlightSection
                        currentConfig={currentConfig}
                        updateCurrentRule={updateCurrentRule}
                        colorHighlightsCaseSensitive={currentConfig.colorHighlightsCaseSensitive || false}
                    />

                    <LogSettingsSection
                        currentConfig={currentConfig}
                        updateCurrentRule={updateCurrentRule}
                        handleStartLogging={handleStartLogging}
                        handleStopLogging={handleStopLogging}
                    />

                </div>
            ) : (
                <div className="h-full flex flex-col items-center pt-24 gap-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={onToggle}>
                    <div className="vertical-text text-slate-500 font-bold tracking-[0.2em] text-[10px] uppercase transform rotate-180 opacity-60 hover:opacity-100 transition-opacity whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                        Configuration
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfigurationPanel;
