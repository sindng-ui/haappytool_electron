import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Keyboard, Info, Type, RotateCcw, BookOpen } from 'lucide-react';
import { Button } from './ui/Button';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStartLineIndex: number; // Placeholder for info if needed
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'shortcuts' | 'about' | 'guide'>('general');
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    });
    const [zoom, setZoom] = useState(1);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 w-screen h-screen z-[100000] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden transition-colors duration-300 transform scale-100 animate-slide-up">
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
                            onClick={() => setActiveTab('shortcuts')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'shortcuts' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Keyboard size={16} /> Shortcuts
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'about' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <Info size={16} /> About
                        </button>
                        <button
                            onClick={() => setActiveTab('guide')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none ${activeTab === 'guide' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                        >
                            <BookOpen size={16} /> User Guide
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
                                    <div className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
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

                        {/* Shortcuts Tab */}
                        {activeTab === 'shortcuts' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Keyboard size={18} /> Keyboard Shortcuts</h3>
                                <div className="space-y-2">
                                    {[
                                        { action: "Zoom In", keys: ["Ctrl", "Shift", "+"] },
                                        { action: "Zoom Out", keys: ["Ctrl", "Shift", "-"] },
                                        { action: "Reset Zoom", keys: ["Ctrl", "0"] },
                                        { action: "View Bookmarks", keys: ["Ctrl", "B"] },
                                        { action: "Next Bookmark", keys: ["F4"] },
                                        { action: "Prev Bookmark", keys: ["F3"] },
                                        { action: "Sync Scroll", keys: ["Shift", "Scroll"] },
                                        { action: "Scroll Page", keys: ["PageUp", "PageDown"] },
                                        { action: "Focus Left Pane", keys: ["Ctrl", "←"] },
                                        { action: "Focus Right Pane", keys: ["Ctrl", "→"] },
                                        { action: "Jump Highlight 1-5", keys: ["Ctrl", "1-5"] },
                                        { action: "Create Rule", keys: ["Context Menu"] },
                                        { action: "Delete Tag/Branch", keys: ["Backspace"] },
                                        { action: "Next Tag Input", keys: ["Enter"] },
                                        { action: "Navigate Branches", keys: ["↑", "↓"] },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.action}</span>
                                            <div className="flex gap-1">
                                                {item.keys.map((k, kIdx) => (
                                                    <span key={kIdx} className="px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded text-xs font-mono border border-slate-200 dark:border-slate-600/50 shadow-sm min-w-[24px] text-center text-slate-600 dark:text-slate-300">{k}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-4 text-center">Custom key binding is coming soon...</p>
                            </div>
                        )}

                        {/* About Tab */}
                        {activeTab === 'about' && (
                            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 will-change-transform py-10">
                                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] mx-auto shadow-2xl shadow-indigo-500/20 flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <span className="text-5xl font-black text-white">U</span>
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-gradient-x">UFTool</h1>
                                    <p className="text-slate-500 dark:text-slate-400 font-mono mt-2 text-sm bg-slate-100 dark:bg-slate-800/50 inline-block px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">v{__APP_VERSION__} (Beta)</p>
                                </div>
                                <div className="p-8 bg-white dark:bg-slate-800/30 rounded-3xl border border-slate-200 dark:border-white/5 text-sm leading-relaxed max-w-sm mx-auto shadow-xl backdrop-blur-sm">
                                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                                        The ultimate log analysis tool for Tizen developers.
                                        Designed for speed and clarity.
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
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">UFTool 사용 가이드</h3>
                                    <p className="text-slate-600 dark:text-slate-400">모든 기능을 자세히 알아보세요</p>
                                </div>

                                <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-white/5 shadow-xl backdrop-blur-sm">
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
                                                <span className="text-2xl">🔧</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">JSON Tools</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">JSON 데이터를 쉽게 다루는 도구</p>
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
                                                    } else {
                                                        alert('현재 환경에서는 지원되지 않는 기능입니다.');
                                                    }
                                                } catch (error) {
                                                    console.error('Failed to open guide:', error);
                                                    alert('가이드를 열 수 없습니다.');
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
