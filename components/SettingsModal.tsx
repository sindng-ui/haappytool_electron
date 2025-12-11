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
        <div className="fixed inset-0 w-screen h-screen z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden transition-colors duration-300 transform scale-100">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
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
                    <div className="w-48 bg-slate-100 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'general' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            <Type size={16} /> General
                        </button>
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'shortcuts' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            <Keyboard size={16} /> Shortcuts
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'about' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            <Info size={16} /> About
                        </button>
                        <button
                            onClick={() => setActiveTab('guide')}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'guide' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            <BookOpen size={16} /> User Guide
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">

                        {/* General Tab */}
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Moon size={18} /> Appearance</h3>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => { /* setTheme('dark') */ }}
                                            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'dark' ? 'border-indigo-500 bg-slate-800 text-white' : 'border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400 opacity-50 cursor-not-allowed'}`}
                                            title="Theme switching is disabled"
                                        >
                                            <Moon size={24} />
                                            <span className="font-medium">Dark Mode</span>
                                        </button>
                                        <button
                                            onClick={() => { /* setTheme('light') */ }}
                                            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'light' ? 'border-indigo-500 bg-white text-slate-900' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 opacity-50 cursor-not-allowed'}`}
                                            title="Theme switching is disabled"
                                        >
                                            <Sun size={24} />
                                            <span className="font-medium">Light Mode</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Type size={18} /> UI Zoom</h3>
                                    <div className="flex items-center gap-4 bg-slate-200 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-300 dark:border-slate-700">
                                        <button onClick={() => handleZoomChange(zoom - 0.1)} className="p-2 hover:bg-slate-300 dark:hover:bg-slate-700 rounded">-</button>
                                        <div className="flex-1">
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="2.0"
                                                step="0.1"
                                                value={zoom}
                                                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                                                className="w-full accent-indigo-500 h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                        <button onClick={() => handleZoomChange(zoom + 0.1)} className="p-2 hover:bg-slate-300 dark:hover:bg-slate-700 rounded">+</button>
                                        <span className="font-mono w-16 text-center">{Math.round(zoom * 100)}%</span>
                                        <button onClick={() => handleZoomChange(1.0)} className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1" title="Reset Zoom"><RotateCcw size={12} /> Reset</button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Use Ctrl + Shift + +/- to zoom quickly.</p>
                                </div>
                            </div>
                        )}

                        {/* Shortcuts Tab */}
                        {activeTab === 'shortcuts' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Keyboard size={18} /> Keyboard Shortcuts</h3>
                                <div className="space-y-2">
                                    {[
                                        { action: "Zoom In", keys: ["Ctrl", "Shift", "+"] },
                                        { action: "Zoom Out", keys: ["Ctrl", "Shift", "-"] },
                                        { action: "Reset Zoom", keys: ["Ctrl", "0"] },
                                        { action: "Next Bookmark", keys: ["F4"] },
                                        { action: "Prev Bookmark", keys: ["F3"] },
                                        { action: "Sync Scroll", keys: ["Shift", "Scroll"] },
                                        { action: "Scroll Page", keys: ["PageUp", "PageDown"] },
                                        { action: "Focus Left Pane", keys: ["Ctrl", "←"] },
                                        { action: "Focus Right Pane", keys: ["Ctrl", "→"] },
                                        { action: "Create Rule", keys: ["Context Menu"] },
                                        { action: "Delete Tag/Branch", keys: ["Backspace"] },
                                        { action: "Next Tag Input", keys: ["Enter"] },
                                        { action: "Navigate Branches", keys: ["↑", "↓"] },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-200 dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700/50">
                                            <span className="font-medium">{item.action}</span>
                                            <div className="flex gap-1">
                                                {item.keys.map((k, kIdx) => (
                                                    <span key={kIdx} className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-xs font-mono border border-slate-300 dark:border-slate-600 shadow-sm min-w-[24px] text-center">{k}</span>
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
                            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 py-10">
                                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl mx-auto shadow-2xl flex items-center justify-center transform rotate-3">
                                    <span className="text-4xl font-black text-white">H</span>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">HappyTool</h1>
                                    <p className="text-slate-500 font-mono mt-2">v0.4.0 (Beta)</p>
                                </div>
                                <div className="p-6 bg-slate-200 dark:bg-slate-800/50 rounded-2xl border border-slate-300 dark:border-slate-700 text-sm leading-relaxed max-w-sm mx-auto">
                                    <p>
                                        The ultimate log analysis tool for Tizen developers.
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                                        © 2025 Samsung Electronics Co., Ltd. All rights reserved.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* User Guide Tab */}
                        {activeTab === 'guide' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl mx-auto shadow-xl flex items-center justify-center mb-4">
                                        <BookOpen size={32} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">HappyTool 사용 가이드</h3>
                                    <p className="text-slate-600 dark:text-slate-400">모든 기능을 자세히 알아보세요</p>
                                </div>

                                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-xl">📊</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">Log Extractor</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">로그 파일에서 원하는 내용만 빠르게 찾아내는 강력한 분석 도구</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-xl">🚀</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">POST Tool</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">REST API를 간편하게 테스트하는 도구</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-xl">🔧</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">JSON Tools</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">JSON 데이터를 쉽게 다루는 도구</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-xl">📦</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">TPK Extractor</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">Tizen RPM 패키지에서 TPK 파일 추출</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    if (window.electronAPI?.getAppPath && window.electronAPI?.openExternal) {
                                                        // Get the app directory path
                                                        const appPath = await window.electronAPI.getAppPath();
                                                        // Construct the file:// URL to USER_GUIDE.md
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
                                            className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                                        >
                                            <BookOpen size={20} />
                                            전체 사용자 가이드 열기
                                        </button>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3">
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
