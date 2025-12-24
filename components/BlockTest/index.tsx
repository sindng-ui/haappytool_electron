import React, { useState } from 'react';
import { useBlockTest } from './hooks/useBlockTest';
import BlockManager from './components/BlockManager';
import PipelineEditor from './components/PipelineEditor';
import PipelineRunner from './components/PipelineRunner';
import * as Lucide from 'lucide-react';
import { Pipeline } from './types';

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

    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

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
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
            {/* Left Sidebar: Block Manager */}
            <BlockManager
                blocks={blocks}
                onAddBlock={addBlock}
                onUpdateBlock={updateBlock}
                onDeleteBlock={deleteBlock}
            />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Pipeline Selector Bar */}
                <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-2 pr-40 flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 text-slate-500">
                        <Lucide.Workflow size={18} />
                        <span className="font-bold text-sm">Pipelines</span>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                        {pipelines.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedPipelineId(p.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm whitespace-nowrap border transition-all
                                    ${selectedPipelineId === p.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium'
                                        : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                <span>{p.name}</span>
                                {selectedPipelineId === p.id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deletePipeline(p.id); setSelectedPipelineId(null); }}
                                        className="p-0.5 hover:text-red-500 rounded-full"
                                    >
                                        <Lucide.X size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleCreatePipeline}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-sm transition-colors whitespace-nowrap"
                    >
                        <Lucide.Plus size={14} />
                        <span>New Pipeline</span>
                    </button>
                </div>

                {/* Editor or Empty State */}
                {editingPipeline ? (
                    <PipelineEditor
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
    );
};

export default BlockTest;
