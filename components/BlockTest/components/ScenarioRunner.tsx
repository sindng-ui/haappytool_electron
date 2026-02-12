import React from 'react';
import { Scenario, Pipeline, CommandBlock, ExecutionStats } from '../types';
import * as Lucide from 'lucide-react';
import PipelineRunner from './PipelineRunner';
import { THEME } from '../theme';

interface ScenarioRunnerProps {
    scenario: Scenario;
    pipelines: Pipeline[];
    blocks: CommandBlock[];
    logs: string[];
    activePipelineId: string | null;
    activePipelineItemId: string | null;
    executionStats: ExecutionStats; // Current pipeline stats
    scenarioStats: Record<string, { status: 'pending' | 'running' | 'success' | 'failed', error?: string }>;
    completedStepCount: number;
    isRunning: boolean;
    onStop: () => void;
    onClose: () => void;
    reportUrl?: string | null;
}

const ScenarioRunner: React.FC<ScenarioRunnerProps> = ({
    scenario,
    pipelines,
    blocks,
    logs,
    activePipelineId,
    activePipelineItemId,
    executionStats,
    scenarioStats,
    completedStepCount,
    isRunning,
    onStop,
    onClose,
    reportUrl
}) => {
    // Determine active pipeline data
    const activePipeline = pipelines.find(p => p.id === activePipelineId);

    // Calculate Scenario Progress
    const totalSteps = scenario.steps.filter(s => s.enabled).length;
    const currentStepIndex = scenario.steps.filter(s => s.enabled).findIndex(s => activePipelineId && s.pipelineId === activePipelineId);
    // Rough progress: completed steps + pending steps
    const completedSteps = scenario.steps.filter(s => s.enabled && scenarioStats[s.id]?.status === 'success').length;
    const progress = Math.min(100, (completedSteps / (totalSteps || 1)) * 100);

    return (
        <div className={`flex flex-col h-full bg-slate-100 dark:bg-slate-900 ${THEME.runner.container}`}>
            {/* Scenario Header */}
            <div className={`shrink-0 h-14 pl-4 pr-36 title-drag flex items-center justify-between bg-[#0f172a] border-b border-slate-700 shadow-md z-20`}>
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <Lucide.ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Lucide.Film size={16} className="text-indigo-400" />
                            <h2 className="text-sm font-bold text-slate-200">{scenario.name}</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 bg-indigo-500`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <span>{completedSteps}/{totalSteps} pipelines</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isRunning && reportUrl && (
                        <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors no-drag"
                        >
                            <Lucide.FileText size={14} />
                            View Report
                        </a>
                    )}
                    {isRunning ? (
                        <button
                            onClick={onStop}
                            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow transition-all active:scale-95 no-drag"
                        >
                            <Lucide.Square size={12} fill="currentColor" />
                            STOP SCENARIO
                        </button>
                    ) : (
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <Lucide.CheckCircle2 size={14} />
                            Completed
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Steps List */}
                <div className="w-80 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
                    <div className="p-3 font-bold text-xs uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        Execution Steps
                    </div>
                    <div className="p-2 space-y-1">
                        {scenario.steps.map((step, index) => {
                            if (!step.enabled) return null;
                            const pipeline = pipelines.find(p => p.id === step.pipelineId);
                            const status = scenarioStats[step.id]?.status || 'pending';
                            const isActive = step.pipelineId === activePipelineId && status === 'running';

                            return (
                                <div
                                    key={step.id}
                                    className={`p-3 rounded-lg border flex items-center gap-3 transition-all
                                        ${isActive
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/30'
                                            : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                                        }
                                        ${status === 'pending' ? 'opacity-60' : 'opacity-100'}
                                    `}
                                >
                                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0
                                        ${status === 'running' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600' :
                                            status === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                                                status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-500' :
                                                    'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }
                                    `}>
                                        {status === 'running' ? <Lucide.Loader2 size={14} className="animate-spin" /> :
                                            status === 'success' ? <Lucide.Check size={14} /> :
                                                status === 'failed' ? <Lucide.X size={14} /> :
                                                    <span className="text-xs font-bold">{index + 1}</span>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {pipeline?.name || 'Unknown Pipeline'}
                                        </div>
                                        {scenarioStats[step.id]?.error && (
                                            <div className="text-xs text-red-500 truncate mt-0.5">
                                                {scenarioStats[step.id].error}
                                            </div>
                                        )}
                                    </div>
                                    {isActive && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Pipeline Runner */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
                    {activePipeline ? (
                        <div className="absolute inset-0">
                            <PipelineRunner
                                pipeline={activePipeline}
                                blocks={blocks}
                                logs={logs}
                                activeItemId={activePipelineItemId}
                                stats={executionStats}
                                completedCount={completedStepCount}
                                isRunning={scenarioStats[scenario.steps.find(s => s.pipelineId === activePipelineId)?.id!]?.status === 'running'}
                                onStop={onStop} // Stops entire scenario
                                onClose={() => { }} // No close from inside, only top header closes
                                embedded={true}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            {isRunning ? (
                                <>
                                    <Lucide.Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
                                    <p>Preparing pipeline...</p>
                                </>
                            ) : (
                                <>
                                    <Lucide.CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Scenario Execution Finished</h3>
                                    <div className="flex gap-4 mt-6">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-emerald-500">
                                                {Object.values(scenarioStats).filter(s => s.status === 'success').length}
                                            </div>
                                            <div className="text-xs uppercase text-slate-500">Success</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-red-500">
                                                {Object.values(scenarioStats).filter(s => s.status === 'failed').length}
                                            </div>
                                            <div className="text-xs uppercase text-slate-500">Failed</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScenarioRunner;
