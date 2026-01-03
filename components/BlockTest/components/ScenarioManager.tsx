import React, { useState } from 'react';
import { Scenario } from '../types';
import * as Lucide from 'lucide-react';
import { THEME } from '../theme';

interface ScenarioManagerProps {
    scenarios: Scenario[];
    onAddScenario: (scenario: Scenario) => void;
    onUpdateScenario: (scenario: Scenario) => void;
    onDeleteScenario: (id: string) => void;
    selectedScenarioId: string | null;
    onSelectScenario: (id: string) => void;
}

const ScenarioManager: React.FC<ScenarioManagerProps> = ({
    scenarios,
    onAddScenario,
    onUpdateScenario,
    onDeleteScenario,
    selectedScenarioId,
    onSelectScenario
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
    const [name, setName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredScenarios = scenarios.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleCreate = () => {
        setEditingScenario(null);
        setName('');
        setIsEditing(true);
    };

    const handleEdit = (scenario: Scenario, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingScenario(scenario);
        setName(scenario.name);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!name.trim()) return;

        if (editingScenario) {
            onUpdateScenario({
                ...editingScenario,
                name
            });
        } else {
            onAddScenario({
                id: `scenario_${Date.now()}`,
                name,
                steps: []
            });
        }
        setIsEditing(false);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this scenario?')) {
            onDeleteScenario(id);
            if (selectedScenarioId === id) {
                onSelectScenario('');
            }
        }
    };

    return (
        <div className={`flex flex-col h-full w-72 ${THEME.sidebar.container}`}>
            {/* Header */}
            <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center backdrop-blur-sm ${THEME.sidebar.header}`}>
                <h2 className={`font-bold ${THEME.sidebar.text}`}>Scenarios</h2>
                <button
                    onClick={handleCreate}
                    className="p-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                    <Lucide.Plus size={18} />
                </button>
            </div>

            {/* Search Bar */}
            <div className={`px-4 py-2.5 ${THEME.sidebar.search.container}`}>
                <div className="relative group">
                    <Lucide.Search className="absolute left-2.5 top-2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                    <input
                        type="text"
                        placeholder="Search scenarios..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all shadow-sm ${THEME.sidebar.search.input}`}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {filteredScenarios.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-sm flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg mx-2">
                        <Lucide.Film size={24} className="opacity-20" />
                        <span>No scenarios found</span>
                    </div>
                ) : (
                    filteredScenarios.map(scenario => (
                        <div
                            key={scenario.id}
                            onClick={() => onSelectScenario(scenario.id)}
                            className={`group p-3 rounded-lg border transition-all cursor-pointer shadow-sm hover:shadow-md backdrop-blur-sm
                                ${selectedScenarioId === scenario.id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20'
                                    : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600'
                                }
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-1.5 rounded-md ${selectedScenarioId === scenario.id ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Lucide.Film size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`font-bold text-sm truncate ${selectedScenarioId === scenario.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {scenario.name}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate mt-0.5">
                                            {scenario.steps.length} pipelines
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden group-hover:flex gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg pl-1 shrink-0 ml-2">
                                    <button onClick={(e) => handleEdit(scenario, e)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all">
                                        <Lucide.Edit2 size={16} />
                                    </button>
                                    <button onClick={(e) => handleDelete(scenario.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all">
                                        <Lucide.Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-96 shadow-2xl border border-slate-200 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200">
                            {editingScenario ? 'Edit Scenario' : 'New Scenario'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Enter scenario name"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!name.trim()}
                                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScenarioManager;
