import React from 'react';
import * as Lucide from 'lucide-react';
import { EnvironmentProfile } from '../../types';

const { ChevronDown, Check, Settings } = Lucide;

interface EnvironmentDropdownProps {
    showEnvDropdown: boolean;
    setShowEnvDropdown: (show: boolean) => void;
    envProfiles?: EnvironmentProfile[];
    activeEnvId: string;
    setActiveEnvId?: (id: string) => void;
    onOpenManageModal: () => void;
}

export const EnvironmentDropdown: React.FC<EnvironmentDropdownProps> = ({
    showEnvDropdown,
    setShowEnvDropdown,
    envProfiles,
    activeEnvId,
    setActiveEnvId,
    onOpenManageModal
}) => {
    return (
        <div className="relative">
            <button
                onClick={() => setShowEnvDropdown(!showEnvDropdown)}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/30 transition-all group min-w-[180px] justify-between"
                title="Switch Active Environment"
            >
                <div className="flex flex-col items-start">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-indigo-400 transition-colors">Environment</span>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">
                        {envProfiles?.find(p => p.id === activeEnvId)?.name || 'Default'}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-slate-500 group-hover:text-slate-300 transition-transform ${showEnvDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showEnvDropdown && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowEnvDropdown(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl z-50 py-1 flex flex-col overflow-hidden ring-1 ring-black/50">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/30">Select Environment</div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                            {envProfiles?.map(profile => (
                                <button
                                    key={profile.id}
                                    onClick={() => {
                                        setActiveEnvId && setActiveEnvId(profile.id);
                                        setShowEnvDropdown(false);
                                    }}
                                    className={`w-full px-3 py-2 text-xs font-medium text-left flex items-center justify-between rounded-lg transition-colors ${activeEnvId === profile.id
                                        ? 'bg-indigo-500/10 text-indigo-400'
                                        : 'text-slate-300 hover:bg-white/5'
                                        }`}
                                >
                                    <span className="truncate">{profile.name}</span>
                                    {activeEnvId === profile.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                        <div className="h-px bg-white/5 my-1"></div>
                        <div className="p-1">
                            <button
                                onClick={() => {
                                    onOpenManageModal();
                                    setShowEnvDropdown(false);
                                }}
                                className="w-full px-3 py-2 text-xs font-bold text-slate-400 hover:text-indigo-400 hover:bg-white/5 text-left transition-colors rounded-lg flex items-center gap-2"
                            >
                                <Settings size={14} /> Manage Environments...
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default EnvironmentDropdown;
