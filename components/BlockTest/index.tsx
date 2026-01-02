import React, { useState } from 'react';
import { useBlockTest } from './hooks/useBlockTest';
import BlockManager from './components/BlockManager';
import PipelineEditor from './components/PipelineEditor';
import PipelineRunner from './components/PipelineRunner';
import * as Lucide from 'lucide-react';
import { Pipeline } from './types';
import { THEME } from './theme';

const BlockTest: React.FC = () => {
    const {
        blocks,
        pipelines,
        addBlock,
        updateBlock,
        deleteBlock,
        addPipeline,
        updatePipeline,
        deletePipeline,
        executePipeline,
        stopPipeline,
        closePipelineRunner,
        isRunning,
        executionLogs,
        activePipelineItemId, // This is for highlighting
        currentBlockId,
        activePipelineId, // The ID of the pipeline being run/viewed
        executionStats,
        completedStepCount,
        isRunnerOpen,
        setIsRunnerOpen
    } = useBlockTest();

    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(() => {
        return localStorage.getItem('blockTestLastPipelineId') || null;
    });

    React.useEffect(() => {
        if (selectedPipelineId) {
            localStorage.setItem('blockTestLastPipelineId', selectedPipelineId);
        }
    }, [selectedPipelineId]);

    // The pipeline currently being edited
    const editingPipeline = pipelines.find(p => p.id === selectedPipelineId);

    // The pipeline currently being run/viewed (persists after run)
    const runningPipeline = pipelines.find(p => p.id === activePipelineId);

    const handleCreatePipeline = () => {
        const newPipeline: Pipeline = {
            id: `pipeline_${Date.now()}`,
            name: 'New Test Pipeline',
            items: []
        };
        addPipeline(newPipeline);
        setSelectedPipelineId(newPipeline.id);
    };

    const handleRun = () => {
        if (editingPipeline) {
            executePipeline(editingPipeline);
        }
    };

    // If there is an active "run" session AND the runner view is open
    if (isRunnerOpen && runningPipeline) {
        return (
            <PipelineRunner
                pipeline={runningPipeline}
                blocks={blocks}
                logs={executionLogs}
                activeItemId={activePipelineItemId}
                stats={executionStats}
                completedCount={completedStepCount}
                isRunning={isRunning}
                onStop={stopPipeline}
                onClose={() => setIsRunnerOpen(false)}
            />
        );
    }

    return (
        <div className={`flex flex-col h-full overflow-hidden ${THEME.layout.main}`}>
            {/* System Header (Standard Plugin Header) */}
            <div className={`h-9 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3 ${THEME.header.container}`}>
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Lucide.Workflow size={14} className="icon-glow" />
                </div>
                <span className="font-bold text-xs text-slate-200">Block Test</span>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Sidebar: Block Manager */}
                <BlockManager
                    blocks={blocks}
                    onAddBlock={addBlock}
                    onUpdateBlock={updateBlock}
                    onDeleteBlock={deleteBlock}
                />

                {/* Main Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Pipeline Selector Bar (Sub-Header) */}
                    <div className={`${THEME.subHeader.container} p-2 flex items-center gap-3`}>
                        <div className="flex items-center gap-2 px-2 text-slate-500">
                            <Lucide.Workflow size={18} />
                            <span className="font-bold text-sm">Pipelines</span>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        {/* Dropdown Selector */}
                        <div className="flex-1 max-w-sm relative">
                            <select
                                value={selectedPipelineId || ''}
                                onChange={(e) => setSelectedPipelineId(e.target.value || null)}
                                className={`w-full pl-3 pr-10 py-1.5 rounded-md text-sm border shadow-sm outline-none focus:ring-2 transition-all appearance-none cursor-pointer ${THEME.subHeader.dropdown}`}
                            >
                                <option value="" disabled>Select a pipeline...</option>
                                {pipelines.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <Lucide.ChevronDown size={14} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreatePipeline}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${THEME.header.newPipelineBtn}`}
                            >
                                <Lucide.Plus size={14} />
                                <span>New</span>
                            </button>

                            {selectedPipelineId && (
                                <button
                                    onClick={() => {
                                        if (selectedPipelineId) {
                                            const currentIndex = pipelines.findIndex(p => p.id === selectedPipelineId);
                                            let nextId: string | null = null;

                                            if (pipelines.length > 1) {
                                                if (currentIndex < pipelines.length - 1) {
                                                    nextId = pipelines[currentIndex + 1].id;
                                                } else {
                                                    nextId = pipelines[currentIndex - 1].id;
                                                }
                                            }

                                            deletePipeline(selectedPipelineId);
                                            setSelectedPipelineId(nextId);
                                        }
                                    }}
                                    className={`p-1.5 rounded transition-colors ${THEME.subHeader.deleteBtn}`}
                                    title="Delete Current Pipeline"
                                >
                                    <Lucide.Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Editor or Empty State */}
                    {editingPipeline ? (
                        <PipelineEditor
                            key={editingPipeline.id}
                            pipeline={editingPipeline}
                            blocks={blocks}
                            onChange={updatePipeline}
                            onRun={handleRun}
                            hasResults={!!runningPipeline}
                            onViewResults={() => setIsRunnerOpen(true)}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                                <Lucide.Workflow size={32} />
                            </div>
                            <p className="font-medium">No Pipeline Selected</p>
                            <p className="text-sm mt-1">Select a pipeline above or create a new one to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlockTest;
