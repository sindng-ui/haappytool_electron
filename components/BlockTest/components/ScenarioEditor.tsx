import React, { useState } from 'react';
import { Scenario, Pipeline } from '../types';
import * as Lucide from 'lucide-react';
import { THEME } from '../theme';

interface ScenarioEditorProps {
    scenario: Scenario;
    pipelines: Pipeline[];
    onChange: (scenario: Scenario) => void;
    onRun: (scenario: Scenario) => void;
    hasResults?: boolean;
    onViewResults?: () => void;
}

const ScenarioEditor: React.FC<ScenarioEditorProps> = ({ scenario, pipelines, onChange, onRun, hasResults, onViewResults }) => {
    // Add Pipeline Modal
    const [isAddModalOpen, setAddModalOpen] = useState(false);

    const handleAddStep = (pipelineId: string) => {
        const newStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            pipelineId,
            enabled: true
        };
        onChange({
            ...scenario,
            steps: [...scenario.steps, newStep]
        });
        setAddModalOpen(false);
    };

    const handleRemoveStep = (index: number) => {
        const newSteps = [...scenario.steps];
        newSteps.splice(index, 1);
        onChange({ ...scenario, steps: newSteps });
    };

    const handleMoveStep = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === scenario.steps.length - 1) return;

        const newSteps = [...scenario.steps];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
        onChange({ ...scenario, steps: newSteps });
    };

    const handleToggleStep = (index: number) => {
        const newSteps = [...scenario.steps];
        newSteps[index] = { ...newSteps[index], enabled: !newSteps[index].enabled };
        onChange({ ...scenario, steps: newSteps });
    };

    const handleNameChange = (name: string) => {
        onChange({ ...scenario, name });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
            {/* Header */}
            <div className={`shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 ${THEME.editor.container}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                        <Lucide.Film size={20} />
                    </div>
                    <div>
                        <input
                            value={scenario.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="font-bold text-lg bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 outline-none transition-colors text-slate-800 dark:text-slate-200 w-64"
                            placeholder="Scenario Name"
                        />
                        <div className="text-xs text-slate-500 mt-0.5">{scenario.steps.length} steps</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {hasResults && onViewResults && (
                        <button
                            onClick={onViewResults}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <Lucide.List size={16} />
                            <span>View Results</span>
                        </button>
                    )}
                    <button
                        onClick={() => onRun(scenario)}
                        disabled={scenario.steps.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-95 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Lucide.Play size={16} />
                        <span className="font-bold">Run Scenario</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                    {scenario.steps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                                <Lucide.ListPlus size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Empty Scenario</h3>
                            <p className="text-slate-500 mt-2 mb-6">Add pipelines to build your test scenario</p>
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                            >
                                <Lucide.Plus size={18} />
                                <span>Add Pipeline</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {scenario.steps.map((step, index) => {
                                const pipeline = pipelines.find(p => p.id === step.pipelineId);
                                return (
                                    <div
                                        key={step.id}
                                        className={`flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border shadow-sm transition-all group
                                            ${step.enabled
                                                ? 'border-slate-200 dark:border-slate-700'
                                                : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-900'
                                            }
                                        `}
                                    >
                                        <div className="flex flex-col gap-1 text-slate-400">
                                            <button
                                                onClick={() => handleMoveStep(index, 'up')}
                                                disabled={index === 0}
                                                className="hover:text-indigo-500 disabled:opacity-30 disabled:hover:text-slate-400"
                                            >
                                                <Lucide.ChevronUp size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleMoveStep(index, 'down')}
                                                disabled={index === scenario.steps.length - 1}
                                                className="hover:text-indigo-500 disabled:opacity-30 disabled:hover:text-slate-400"
                                            >
                                                <Lucide.ChevronDown size={20} />
                                            </button>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0 font-bold text-indigo-500">
                                            {index + 1}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-lg truncate ${step.enabled ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>
                                                    {pipeline?.name || 'Unknown Pipeline'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                    {pipeline?.items?.length || 0} steps
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-400 truncate mt-0.5">
                                                ID: {step.pipelineId}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleToggleStep(index)}
                                                className={`p-2 rounded-lg transition-colors ${step.enabled ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'}`}
                                                title={step.enabled ? 'Disable Step' : 'Enable Step'}
                                            >
                                                {step.enabled ? <Lucide.CheckCircle2 size={18} /> : <Lucide.Circle size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveStep(index)}
                                                className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Remove Step"
                                            >
                                                <Lucide.Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="flex justify-center mt-6">
                                <button
                                    onClick={() => setAddModalOpen(true)}
                                    className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500 text-slate-600 dark:text-slate-300 hover:text-indigo-500 transition-all shadow-sm flex items-center gap-2"
                                >
                                    <Lucide.Plus size={16} />
                                    <span>Add Another Pipeline</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Pipeline Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-96 max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Add Pipeline</h3>
                            <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Lucide.X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                            {pipelines.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleAddStep(p.id)}
                                    className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:shadow-md transition-all group"
                                >
                                    <div className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.items.length} steps</div>
                                </button>
                            ))}
                            {pipelines.length === 0 && (
                                <div className="text-center text-slate-400 py-4">No pipelines available</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScenarioEditor;
