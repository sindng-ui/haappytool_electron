import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Keyboard, Info, Type, RotateCcw, BookOpen, Puzzle, Terminal, ExternalLink, Copy, Folder, Bot, Eye, EyeOff, Save, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { useToast } from '../contexts/ToastContext';
import { ALL_PLUGINS } from '../plugins/registry';
import { useHappyTool } from '../contexts/HappyToolContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStartLineIndex: number; // Placeholder for info if needed
    enabledPlugins: string[];
    setEnabledPlugins: (plugins: string[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, enabledPlugins, setEnabledPlugins }) => {
    const { addToast } = useToast();
    const { defaultOutputFolder, setDefaultOutputFolder } = useHappyTool();
    const [activeTab, setActiveTab] = useState<'general' | 'plugins' | 'shortcuts' | 'cli' | 'guide' | 'ai_agent' | 'about'>('general');
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    });
    const [zoom, setZoom] = useState(1);

    // AI Agent Settings
    const [agentConfig, setAgentConfig] = useState({
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4',
        maxIterations: 10,
        timeoutMs: 60000,
    });
    const [showApiKey, setShowApiKey] = useState(false);
    const [isTestingAgent, setIsTestingAgent] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem('happytool_agent_config');
        if (raw) {
            try { setAgentConfig(prev => ({ ...prev, ...JSON.parse(raw) })); } catch (e) {}
        }
    }, []);

    const handleSaveAgentConfig = () => {
        localStorage.setItem('happytool_agent_config', JSON.stringify(agentConfig));
        addToast('AI Agent 설정이 저장되었습니다.', 'success');
    };

    const handleTestAgentConnection = async () => {
        setIsTestingAgent(true);
        try {
            const { testAgentConnection } = require('../plugins/LogAnalysisAgent/services/agentApiService');
            const success = await testAgentConnection(agentConfig);
            if (success) addToast('API 연결 성공!', 'success');
        } catch (err: any) {
            addToast(`연결 실패: ${err.message}`, 'error');
        } finally {
            setIsTestingAgent(false);
        }
    };

    // Apply theme (Force Dark Mode always as per request)
    useEffect(() => {
        document.documentElement.classList.add('dark');
        // Prevent light mode application even if selected
        if (theme === 'light') {
            // Optional: force state back to dark if desired, logic below just ensures visual dark mode
            // setTheme('dark'); 
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Sync Zoom
    useEffect(() => {
        if (isOpen && window.electronAPI?.getZoomFactor) {
            setZoom(window.electronAPI.getZoomFactor());
        }
    }, [isOpen]);

    const handleZoomChange = (val: number) => {
        const newZoom = Math.min(Math.max(0.5, val), 3.0);
        setZoom(newZoom);
        window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(newZoom);
    };

    const togglePlugin = (pluginId: string) => {
        if (enabledPlugins.includes(pluginId)) {
            setEnabledPlugins(enabledPlugins.filter(id => id !== pluginId));
        } else {
            setEnabledPlugins([...enabledPlugins, pluginId]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 w-screen h-screen z-[100000] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Settings
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-48 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-white/5 p-2 flex flex-col gap-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'general' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Type size={16} /> General
                        </button>
                        <button
                            onClick={() => setActiveTab('plugins')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'plugins' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Puzzle size={16} /> Plugins
                        </button>
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'shortcuts' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Keyboard size={16} /> Shortcuts
                        </button>
                        <button
                            onClick={() => setActiveTab('cli')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'cli' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Terminal size={16} /> Headless CLI
                        </button>
                        <button
                            onClick={() => setActiveTab('guide')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'guide' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <BookOpen size={16} /> User Guide
                        </button>
                        <button
                            onClick={() => setActiveTab('ai_agent')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'ai_agent' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Bot size={16} /> AI Agent
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'about' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Info size={16} /> About
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 custom-scrollbar">

                        {/* General Tab */}
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Moon size={18} /> Appearance</h3>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => { /* setTheme('dark') */ }}
                                            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'dark' ? 'border-indigo-500 bg-slate-800 text-white shadow-lg shadow-indigo-500/20' : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 opacity-50 cursor-not-allowed'}`}
                                            title="Theme switching is disabled"
                                        >
                                            <Moon size={24} />
                                            <span className="font-medium">Dark Mode</span>
                                        </button>
                                        <button
                                            onClick={() => { /* setTheme('light') */ }}
                                            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'light' ? 'border-indigo-500 bg-white text-slate-900 shadow-lg' : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 opacity-50 cursor-not-allowed'}`}
                                            title="Theme switching is disabled"
                                        >
                                            <Sun size={24} />
                                            <span className="font-medium">Light Mode</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Type size={18} /> UI Zoom</h3>
                                    <div className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                        <button onClick={() => handleZoomChange(zoom - 0.1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-300">-</button>
                                        <div className="flex-1">
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="2.0"
                                                step="0.1"
                                                value={zoom}
                                                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                            />
                                        </div>
                                        <button onClick={() => handleZoomChange(zoom + 0.1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-300">+</button>
                                        <span className="font-mono w-16 text-center text-slate-700 dark:text-slate-300 font-bold">{Math.round(zoom * 100)}%</span>
                                        <button onClick={() => handleZoomChange(1.0)} className="text-xs text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors ml-2" title="Reset Zoom"><RotateCcw size={12} /> Reset</button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 ml-1">Use Ctrl + Shift + +/- to zoom quickly.</p>
                                </div>

                            </div>
                        )}

                        {/* Plugins Tab */}
                        {activeTab === 'plugins' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Puzzle size={18} /> Manage Plugins</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                    Enable or disable plugins to customize your sidebar. Disabled plugins will be moved to the "Lab" section.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {ALL_PLUGINS.map(plugin => {
                                        const isEnabled = enabledPlugins.includes(plugin.id);
                                        const Icon = plugin.icon;
                                        return (
                                            <div key={plugin.id}
                                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isEnabled
                                                    ? 'bg-white dark:bg-slate-800/60 border-indigo-500/30'
                                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                                        <Icon size={20} />
                                                    </div>
                                                    <div>
                                                        <div className={`font-semibold ${isEnabled ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-500'}`}>{plugin.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{plugin.id}</div>
                                                    </div>
                                                </div>
                                                <div onClick={() => togglePlugin(plugin.id)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${isEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* CLI Tab */}
                        {activeTab === 'cli' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                        <Terminal size={18} className="text-indigo-500" /> CLI Settings & Guide
                                    </h3>
                                    <button
                                        onClick={async () => {
                                            if (window.electronAPI?.openExternal && window.electronAPI?.getAppPath) {
                                                const appPath = await window.electronAPI.getAppPath();
                                                // 패키징 환경과 개발 환경 모두 대응 가능한 경로 조합
                                                const guidePath = appPath.includes('resources')
                                                    ? `${appPath}/important/cli_user_guide.md`
                                                    : `${appPath}/important/cli_user_guide.md`;

                                                // 절대 경로를 그대로 전달 (openExternal이 인지하도록 처리)
                                                window.electronAPI.openExternal(guidePath);
                                            }
                                        }}
                                        className="text-[10px] items-center gap-1 font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase flex"
                                    >
                                        <ExternalLink size={10} /> Open Full Guide
                                    </button>
                                </div>

                                {/* Configuration */}
                                <div className="bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                            <Folder size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Default Output Folder</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Used for saving logs/files unless --output is specified.</p>
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={defaultOutputFolder || ''}
                                            onChange={(e) => setDefaultOutputFolder(e.target.value)}
                                            placeholder="e.g. C:\HappyTool_Outputs (Leave blank for current dir)"
                                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                        />
                                    </div>
                                </div>

                                {/* CLI Usage Guide */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-400 flex items-center gap-2 px-1">
                                        🚀 Quick Commands
                                    </h4>

                                    <div className="grid grid-cols-1 gap-4">
                                        {/* Command Card: Log Extractor */}
                                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden group/card hover:border-indigo-500/20 transition-all">
                                            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">📡</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Log Extractor</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('.\\HappyTool.exe cli log-extractor -f "FilterName" -i "test.log"');
                                                        addToast('Command copied to clipboard', 'info');
                                                    }}
                                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">거대 로그 파일을 백그라운드 필터링 및 내보내기</p>
                                                <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-indigo-400/90 leading-relaxed border border-white/5">
                                                    .\HappyTool.exe cli log-extractor -f "Filter" -i "path"
                                                </div>
                                            </div>
                                        </div>

                                        {/* Command Card: BlockTest */}
                                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden group/card hover:border-indigo-500/20 transition-all">
                                            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">🤖</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">BlockTest</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('.\\HappyTool.exe cli block-test --scenario "Sanity Check"');
                                                        addToast('Command copied to clipboard', 'info');
                                                    }}
                                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">시나리오/파이프라인 자동화 봇 실행</p>
                                                <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-indigo-400/90 leading-relaxed border border-white/5">
                                                    .\HappyTool.exe cli block-test --scenario "Name"
                                                </div>
                                            </div>
                                        </div>

                                        {/* Command Card: Analyze Diff */}
                                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden group/card hover:border-indigo-500/20 transition-all">
                                            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">📊</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Analyze Diff</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('.\\HappyTool.exe cli analyze-diff -f "Step" -l "old.log" -r "new.log" -o "diff.json"');
                                                        addToast('Command copied to clipboard', 'info');
                                                    }}
                                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">두 로그 파일의 성능 차이 및 신규 로그 분석 (JSON 추출)</p>
                                                <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-indigo-400/90 leading-relaxed border border-white/5">
                                                    .\HappyTool.exe cli analyze-diff -f "Mission" -l "left.log" -r "right.log" -o "diff.json"
                                                </div>
                                            </div>
                                        </div>

                                        {/* Command Card: NetTraffic */}
                                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden group/card hover:border-indigo-500/20 transition-all">
                                            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">🌐</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">NetTraffic</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText('.\\HappyTool.exe cli nettraffic -i "traffic.log" -o "analysis.json"');
                                                            addToast('NetTraffic Single-mode command copied', 'info');
                                                        }}
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-[10px] font-bold"
                                                    >
                                                        Single <Copy size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText('.\\HappyTool.exe cli nettraffic -f "Step" -l "old.log" -r "new.log" -o "diff.json"');
                                                            addToast('NetTraffic Compare-mode command copied', 'info');
                                                        }}
                                                        className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-[10px] font-bold"
                                                    >
                                                        Compare <Copy size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">네트워크 트래픽(Endpoint/UA) 분석 및 비교 결과 추출</p>
                                                <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-indigo-400/90 leading-relaxed border border-white/5">
                                                    .\HappyTool.exe cli nettraffic -l "left" -r "right" -o "res.json"
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advanced Tip Block */}
                                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 mt-6 group">
                                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-[11px] uppercase tracking-widest mb-2">
                                            <Info size={12} /> Advanced Technical Tip
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            HappyTool CLI는 내부적으로 **Hidden BrowserWindow**를 호출하여 구동됩니다.
                                            덕분에 터미널 환경에서도 **WASM(WebAssembly)** 엔진과 **SharedArrayBuffer**의 고성능 멀티스레딩 필터링을 완벽하게 지원합니다.
                                            IndexedDB에 저장된 GUI 필터 목록을 그대로 공유하여 쓰기 때문에 별도의 동기화가 필요 없습니다! 🐧💎
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Shortcuts Tab */}
                        {activeTab === 'shortcuts' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Keyboard size={18} /> Keyboard Shortcuts</h3>

                                {/* Shortcut Groups */}
                                {[
                                    {
                                        title: '🌐 Global',
                                        description: 'Shortcuts available globally',
                                        items: [
                                            { action: 'Open Settings', keys: ['Ctrl', ','] },
                                            { action: 'Command Palette', keys: ['Ctrl', 'K'] },
                                            { action: 'Command Palette (Alt)', keys: ['Ctrl', 'P'] },
                                            { action: 'Zoom In', keys: ['Ctrl', 'Shift', '+'] },
                                            { action: 'Zoom Out', keys: ['Ctrl', 'Shift', '-'] },
                                            { action: 'Reset Zoom', keys: ['Ctrl', '0'] },
                                        ],
                                    },
                                    {
                                        title: '📊 Log Extractor',
                                        description: 'Shortcuts for Log Extractor',
                                        items: [
                                            { action: 'New Tab', keys: ['Ctrl', 'T'] },
                                            { action: 'Close Tab', keys: ['Ctrl', 'W'] },
                                            { action: 'Next Tab', keys: ['Ctrl', 'Tab'] },
                                            { action: 'Previous Tab', keys: ['Ctrl', 'Shift', 'Tab'] },
                                            { action: 'Find', keys: ['Ctrl', 'F'] },
                                            { action: 'Go to Line', keys: ['Ctrl', 'G'] },
                                            { action: 'Open Log Archive', keys: ['Ctrl', 'Shift', 'A'] },
                                            { action: 'View Bookmarks', keys: ['Ctrl', 'B'] },
                                            { action: 'Toggle Bookmark', keys: ['Space'] },
                                            { action: 'Next Bookmark', keys: ['F4'] },
                                            { action: 'Previous Bookmark', keys: ['F3'] },
                                            { action: 'Go to Highlight #N', keys: ['Ctrl', '1~5'] },
                                            { action: 'Toggle Settings Panel', keys: ['Ctrl', '`'] },
                                            { action: 'Increase Font Size', keys: ['Ctrl', ']'] },
                                            { action: 'Decrease Font Size', keys: ['Ctrl', '['] },
                                            { action: 'Clear Logs (Real-time)', keys: ['Ctrl', 'Shift', 'X'] },
                                            { action: 'Copy Selected Log', keys: ['Ctrl', 'C'] },
                                            { action: 'Page Navigation', keys: ['PageUp', 'PageDown'] },
                                            { action: 'Sync Scroll', keys: ['Shift', 'Scroll'] },
                                        ],
                                    },
                                ].map((group, groupIdx) => (
                                    <div key={groupIdx} className="bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
                                        {/* Group Header */}
                                        <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/5">
                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{group.title}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{group.description}</p>
                                        </div>
                                        {/* Group Items */}
                                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                                            {group.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">{item.action}</span>
                                                    <div className="flex gap-1">
                                                        {item.keys.map((k, kIdx) => (
                                                            <span key={kIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-xs font-mono border border-slate-200 dark:border-slate-600/50 shadow-sm min-w-[24px] text-center text-slate-600 dark:text-slate-300">{k}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <p className="text-xs text-slate-500 mt-2 text-center">Shortcuts for other plugins may be added in the future.</p>
                            </div>
                        )}

                        {/* AI Agent Tab */}
                        {activeTab === 'ai_agent' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                        <Bot size={18} className="text-indigo-500" /> Log Analysis Agent Settings
                                    </h3>
                                    <button
                                        onClick={handleSaveAgentConfig}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-500/20 transition-all"
                                    >
                                        <Save size={16} /> Save Config
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    원격 LLM(예: GPT-4, Claude)과 통신하기 위한 API 설정을 구성합니다. 설정은 암호화되지 않은 형태로 localStorage에 저장됩니다. (공용 PC 주의)
                                </p>

                                <div className="bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 p-6 space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 gap-1 flex items-center">
                                            LLM API Endpoint URL
                                        </label>
                                        <input
                                            type="text"
                                            value={agentConfig.endpoint}
                                            onChange={e => setAgentConfig({ ...agentConfig, endpoint: e.target.value })}
                                            placeholder="https://api.openai.com/v1/chat/completions"
                                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 gap-1 flex items-center">
                                            API Key
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showApiKey ? "text" : "password"}
                                                value={agentConfig.apiKey}
                                                onChange={e => setAgentConfig({ ...agentConfig, apiKey: e.target.value })}
                                                placeholder="sk-..."
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                                            >
                                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Model Name
                                            </label>
                                            <input
                                                type="text"
                                                value={agentConfig.model}
                                                onChange={e => setAgentConfig({ ...agentConfig, model: e.target.value })}
                                                placeholder="gpt-4"
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Max Iterations (Loops)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="range"
                                                    min="3" max="20" step="1"
                                                    value={agentConfig.maxIterations}
                                                    onChange={e => setAgentConfig({ ...agentConfig, maxIterations: parseInt(e.target.value, 10) })}
                                                    className="flex-1 accent-indigo-500 cursor-pointer"
                                                />
                                                <span className="font-mono text-sm w-8 text-center bg-slate-800 rounded px-1 py-0.5">{agentConfig.maxIterations}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-700/50 flex items-center justify-between">
                                        <p className="text-xs text-slate-500">* API 연동 후 설정은 브라우저 스토리지에 유지됩니다.</p>
                                        <button
                                            onClick={handleTestAgentConnection}
                                            disabled={isTestingAgent || !agentConfig.apiKey || !agentConfig.endpoint}
                                            className="flex items-center gap-2 px-3 py-1.5 border border-slate-600 hover:border-indigo-400 rounded-lg text-xs font-bold text-slate-300 hover:text-indigo-400 transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw size={14} className={isTestingAgent ? "animate-spin" : ""} />
                                            {isTestingAgent ? "Testing..." : "Connection Test"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* About Tab */}
                        {activeTab === 'about' && (
                            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform py-10">
                                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] mx-auto shadow-2xl shadow-indigo-500/20 flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <span className="text-5xl font-black text-white">H</span>
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-gradient-x">HappyTool</h1>
                                    <p className="text-slate-500 dark:text-slate-400 font-mono mt-2 text-sm bg-slate-100 dark:bg-slate-800/50 inline-block px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">v{__APP_VERSION__} (Beta)</p>
                                </div>
                                <div className="p-8 bg-white dark:bg-slate-800/30 rounded-3xl border border-slate-200 dark:border-white/5 text-sm leading-relaxed max-w-sm mx-auto shadow-xl">
                                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                                        The ultimate integrated development tool.
                                        Designed for speed, clarity, and productivity.
                                    </p>
                                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5 text-xs text-slate-400 dark:text-slate-500">
                                        © 2025 Samsung Electronics Co., Ltd. <br />All rights reserved.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* User Guide Tab */}
                        {activeTab === 'guide' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl mx-auto shadow-xl shadow-indigo-500/20 flex items-center justify-center mb-4 icon-glow">
                                        <BookOpen size={32} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">HappyTool 사용 가이드</h3>
                                    <p className="text-slate-600 dark:text-slate-400">모든 기능을 자세히 알아보세요</p>
                                </div>

                                <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-white/5 shadow-xl">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50">
                                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-500">
                                                <span className="text-2xl">📊</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">Log Extractor</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">로그 파일에서 원하는 내용만 빠르게 찾아내는 강력한 분석 도구</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50">
                                            <div className="w-12 h-12 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-green-500">
                                                <span className="text-2xl">🚀</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">POST Tool</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">REST API를 간편하게 테스트하는 도구</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50">
                                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-500">
                                                <span className="text-2xl">⚖️</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">Analyze Diff</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">두 로그 파일 간의 소요 시간 차이 및 신규 이벤트를 정밀 분석</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50">
                                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-orange-500">
                                                <span className="text-2xl">📦</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">TPK Extractor</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Tizen RPM 패키지에서 TPK 파일 추출</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    if (window.electronAPI?.getAppPath && window.electronAPI?.openExternal) {
                                                        const appPath = await window.electronAPI.getAppPath();
                                                        const guidePath = 'file:///' + appPath.replace(/\\/g, '/') + '/USER_GUIDE.md';
                                                        console.log('Opening guide at:', guidePath);
                                                        await window.electronAPI.openExternal(guidePath);
                                                        await window.electronAPI.openExternal(guidePath);
                                                    } else {
                                                        addToast('현재 환경에서는 지원되지 않는 기능입니다.', 'error');
                                                    }
                                                } catch (error) {
                                                    console.error('Failed to open guide:', error);
                                                    addToast('가이드를 열 수 없습니다.', 'error');
                                                }
                                            }}
                                            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-[1.02] flex items-center justify-center gap-3 border-2 border-transparent"
                                        >
                                            <BookOpen size={20} />
                                            전체 사용자 가이드 열기
                                        </button>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3 font-medium">
                                            브라우저에서 상세한 사용 가이드를 확인하세요
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
