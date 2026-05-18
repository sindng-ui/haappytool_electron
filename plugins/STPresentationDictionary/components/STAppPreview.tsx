import React, { useState } from 'react';
import { Smartphone, Zap, Sliders, Play, ToggleLeft, ToggleRight } from 'lucide-react';

interface STAppPreviewProps {
    presentation: any;
    customName?: string;
}

/**
 * SmartThings App UI Preview Simulator
 * Generates an interactive, premium mobile device card & details view simulator 
 * based on the SmartThings Device Presentation schema.
 */
export const STAppPreview: React.FC<STAppPreviewProps> = ({ presentation, customName }) => {
    const [mockStates, setMockStates] = useState<Record<string, any>>({
        switch: 'off',
        playbackStatus: 'pause',
        volume: 25,
        audioMute: 'unmuted',
        airConditionerMode: 'cool',
        thermostatCoolingSetpoint: 22,
        demandResponseLoadControlState: 'normal',
    });

    const [activeTab, setActiveTab] = useState<'dashboard' | 'detail'>('detail');

    if (!presentation) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 text-slate-400">
                <Smartphone className="w-12 h-12 text-slate-650 mb-3 animate-pulse" />
                <p className="text-sm font-bold text-slate-300">No Device Selected</p>
                <p className="text-xs text-slate-500 mt-1 text-center">Select an item from the dictionary list to activate simulator!</p>
            </div>
        );
    }

    const { presentationId, manufacturerName, dashboard, detailView } = presentation;
    const displayName = customName || presentationId || 'Unknown Device';

    // State Toggles
    const toggleState = (capability: string, values: string[] = ['on', 'off']) => {
        setMockStates(prev => {
            const current = prev[capability] || values[1];
            const next = current === values[0] ? values[1] : values[0];
            return { ...prev, [capability]: next };
        });
    };

    // Render capability UI card
    const renderCapabilityCard = (item: any, idx: number) => {
        const cap = item.capability || '';
        const component = item.component || 'main';

        // 1. Switch
        if (cap.toLowerCase() === 'switch') {
            const isOn = mockStates.switch === 'on';
            return (
                <div key={`${cap}-${idx}`} className="bg-slate-950/70 border border-slate-800/70 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-slate-700/70 transition-all duration-300">
                    <div>
                        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Capability: Switch</div>
                        <div className="text-sm font-extrabold text-slate-200">Power Controller (Switch)</div>
                        <div className="text-xs text-slate-400 mt-1 font-semibold">Status: <span className={isOn ? "text-emerald-400 font-black" : "text-slate-500 font-black"}>{isOn ? 'ON' : 'OFF'}</span></div>
                    </div>
                    <button 
                        onClick={() => toggleState('switch', ['on', 'off'])}
                        className="text-slate-350 hover:text-indigo-400 focus:outline-none transition-transform active:scale-95"
                    >
                        {isOn ? (
                            <ToggleRight className="w-12 h-12 text-emerald-400" />
                        ) : (
                            <ToggleLeft className="w-12 h-12 text-slate-700" />
                        )}
                    </button>
                </div>
            );
        }

        // 2. Volume / Slider
        if (cap.toLowerCase().includes('volume') || cap.toLowerCase().includes('level') || cap.toLowerCase().includes('setpoint')) {
            const val = mockStates[cap] || 20;
            return (
                <div key={`${cap}-${idx}`} className="bg-slate-950/70 border border-slate-800/70 rounded-2xl p-4 shadow-lg hover:border-slate-700/70 transition-all duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Capability: {cap}</div>
                            <div className="text-sm font-extrabold text-slate-200">{cap.replace(/([A-Z])/g, ' $1').trim()}</div>
                        </div>
                        <span className="bg-indigo-950 border border-indigo-850/80 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                            {val}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={val}
                        onChange={(e) => setMockStates(prev => ({ ...prev, [cap]: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono font-bold">
                        <span>Min: 0</span>
                        <span>Max: 100</span>
                    </div>
                </div>
            );
        }

        // 3. Audio Mute
        if (cap.toLowerCase() === 'audiomute') {
            const isMuted = mockStates.audioMute === 'muted';
            return (
                <div key={`${cap}-${idx}`} className="bg-slate-950/70 border border-slate-800/70 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-slate-700/70 transition-all duration-300">
                    <div>
                        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Capability: AudioMute</div>
                        <div className="text-sm font-extrabold text-slate-200">Audio Mute</div>
                    </div>
                    <button 
                        onClick={() => toggleState('audioMute', ['muted', 'unmuted'])}
                        className={`px-4 py-1.5 rounded-xl border text-xs font-bold tracking-wide transition-all active:scale-95 ${
                            isMuted 
                                ? 'bg-rose-950 border-rose-900/60 text-rose-300 hover:bg-rose-900' 
                                : 'bg-indigo-950 border-indigo-900/60 text-indigo-300 hover:bg-indigo-900'
                        }`}
                    >
                        {isMuted ? 'Muted' : 'Unmuted'}
                    </button>
                </div>
            );
        }

        // Default Capability Card
        return (
            <div key={`${cap}-${idx}`} className="bg-slate-950/70 border border-slate-800/70 rounded-2xl p-4 shadow-lg hover:border-slate-700/70 transition-all duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Capability: {cap}</div>
                        <div className="text-sm font-extrabold text-slate-200">{cap.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Component: <span className="font-mono">{component}</span></div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 font-bold">
                        <Sliders className="w-3.5 h-3.5 text-indigo-450" />
                        Standard UI
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center">
            {/* Smartphone shell frame */}
            <div className="relative w-[340px] h-[650px] bg-slate-950 border-[6px] border-slate-800 rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
                {/* Speaker/Camera Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center">
                    <div className="w-12 h-1 bg-slate-950 rounded-full mb-1"></div>
                    <div className="w-2.5 h-2.5 bg-slate-950 rounded-full ml-3 mb-1"></div>
                </div>

                {/* Status Bar */}
                <div className="h-8 pt-2 px-6 flex justify-between items-center text-[10px] font-bold text-slate-400 z-40 bg-slate-950 select-none">
                    <span>12:30</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px]">5G</span>
                        <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex">
                            <div className="w-3/4 h-full bg-slate-400 rounded-2xs"></div>
                        </div>
                    </div>
                </div>

                {/* App Content */}
                <div className="flex-1 bg-slate-900 overflow-y-auto px-4 pb-6 pt-2 flex flex-col custom-scrollbar">
                    {/* Device Header */}
                    <div className="mb-4 mt-2">
                        <div className="text-slate-500 text-[10px] font-extrabold tracking-wide uppercase">SmartThings Control</div>
                        <h3 className="text-base font-black text-slate-100 tracking-tight leading-snug truncate mt-0.5">{displayName}</h3>
                        <p className="text-[9px] text-indigo-400 font-mono font-bold tracking-tighter truncate mt-0.5">{manufacturerName}</p>
                    </div>

                    {/* Dashboard vs Detail tabs */}
                    <div className="bg-slate-950 p-0.5 rounded-xl flex mb-4 border border-slate-800/40 select-none">
                        <button 
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                                activeTab === 'dashboard' 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Dashboard Tile
                        </button>
                        <button 
                            onClick={() => setActiveTab('detail')}
                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                                activeTab === 'detail' 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Detail View
                        </button>
                    </div>

                    {/* Tab contents */}
                    {activeTab === 'dashboard' ? (
                        /* Dashboard Tile Preview */
                        <div className="flex-1 flex flex-col items-center justify-center py-6">
                            <div className="text-center mb-6">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Home Dashboard Card</p>
                            </div>

                            {/* SmartThings Tile Mock */}
                            <div className="w-[180px] h-[140px] bg-slate-950 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all duration-300 relative group">
                                <div className="flex justify-between items-start">
                                    <div className="w-10 h-10 bg-indigo-950/80 border border-indigo-800/40 rounded-2xl flex items-center justify-center text-indigo-400">
                                        <Zap className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <button 
                                        onClick={() => toggleState('switch', ['on', 'off'])}
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                            mockStates.switch === 'on' 
                                                ? 'bg-indigo-500 text-white' 
                                                : 'bg-slate-800 text-slate-500 hover:text-slate-350'
                                        }`}
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                
                                <div>
                                    <h4 className="text-xs font-extrabold text-slate-200 truncate leading-none">{displayName}</h4>
                                    <p className="text-[10px] text-slate-450 font-bold tracking-tight mt-1">
                                        Status: <span className={mockStates.switch === 'on' ? "text-emerald-400 font-black" : "text-slate-500 font-black"}>{mockStates.switch === 'on' ? 'ON' : 'OFF'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Details View Preview */
                        <div className="space-y-3 flex-1">
                            {Array.isArray(detailView) && detailView.length > 0 ? (
                                detailView.map((item: any, idx: number) => renderCapabilityCard(item, idx))
                            ) : (
                                <div className="text-center py-10 bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 text-slate-500 text-xs font-bold">
                                    DetailView schema is empty.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom Navigation Indicator Bar inside screen */}
                    <div className="mt-auto pt-6 flex justify-center">
                        <div className="w-32 h-1 bg-slate-800 rounded-full"></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-4 text-center">
                <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-950/40 border border-indigo-850/60 px-3 py-1 rounded-full font-bold">
                    <Smartphone className="w-3.5 h-3.5" />
                    ST Mobile App UI Simulator
                </span>
            </div>
        </div>
    );
};
