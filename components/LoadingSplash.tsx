import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import packageJson from '../package.json';

interface LoadingSplashProps {
    onLoadingComplete?: () => void;
    waitForPlugins?: boolean;
}

const LoadingSplash: React.FC<LoadingSplashProps> = ({ onLoadingComplete, waitForPlugins = false }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Initializing...');
    const [isComplete, setIsComplete] = useState(false);
    const [isBackendComplete, setIsBackendComplete] = useState(false); // New state
    const startTimeRef = React.useRef<number>(Date.now());
    const MIN_DISPLAY_TIME = 1500; // 최소 1.5초 표시
    const completeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Watch for both completions
    useEffect(() => {
        // Web Environment Override
        if (!window.electronAPI) {
            setProgress(100);
            setStatus('Ready!');
            setIsComplete(true);
            setTimeout(() => onLoadingComplete?.(), 500);
            return;
        }

        // If backend is done, but plugins are not
        if (isBackendComplete && waitForPlugins) {
            setStatus('Loading plugins...');
            setProgress(98); // Hold at 98%
        }

        // Check if fully complete
        const safeToClose = isBackendComplete && !waitForPlugins;

        if (safeToClose && !isComplete && !completeTimeoutRef.current) {
            console.log('[LoadingSplash] All systems ready. Initiating closing sequence.');
            setProgress(100);
            setStatus('Ready!');

            // Enforce minimum display time
            const elapsedTime = Date.now() - startTimeRef.current;
            const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsedTime);

            completeTimeoutRef.current = setTimeout(() => {
                setIsComplete(true);
                // Call callback after fade out
                setTimeout(() => {
                    onLoadingComplete?.();
                }, 800);
            }, remainingTime);
        }
    }, [isBackendComplete, waitForPlugins, isComplete, onLoadingComplete]);

    useEffect(() => {
        console.log('[LoadingSplash] Component mounted');

        // ... existing log/progress handlers ...
        const handleProgress = (...args: any[]) => {
            const data = args[0] || args[1];
            if (data && typeof data === 'object') {
                setProgress(data.progress);
                setStatus(data.status);
            }
        };

        const handleLog = (...args: any[]) => {
            const message = args[0] || args[1];
            if (typeof message === 'string') {
                setLogs(prev => [...prev.slice(-29), message]);
            }
        };

        // Backend signals it is done
        const handleBackendComplete = () => {
            console.log('[LoadingSplash] Backend reported complete.');
            setIsBackendComplete(true);
            // Note: We don't close here anymore, the useEffect above handles it
        };

        if (window.electronAPI) {
            window.electronAPI.on('loading-progress', handleProgress);
            window.electronAPI.on('loading-log', handleLog);
            window.electronAPI.on('loading-complete', handleBackendComplete);
        } else {
            console.warn('[LoadingSplash] electronAPI not found. Running in browser mode?');
            // Timer to fake completion in browser/dev mode if not in Electron
            setTimeout(() => {
                setIsBackendComplete(true);
            }, 2000);
        }

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && process.env.NODE_ENV === 'development') {
                setIsBackendComplete(true); // Force backend complete
                // Note: waitForPlugins might still block it, which is good
            }
        };
        window.addEventListener('keydown', handleKeyPress);

        // Safety timeout: if backend doesn't signal completion within 5s, force complete
        // This prevents infinite waiting in case of unexpected issues
        const safetyTimeout = setTimeout(() => {
            console.warn('[LoadingSplash] Backend timeout - forcing completion');
            setIsBackendComplete(true);
        }, 5000);

        return () => {
            if (window.electronAPI) {
                window.electronAPI.off('loading-progress', handleProgress);
                window.electronAPI.off('loading-log', handleLog);
                window.electronAPI.off('loading-complete', handleBackendComplete);
            }
            window.removeEventListener('keydown', handleKeyPress);
            if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
            clearTimeout(safetyTimeout);
        };
    }, []); // Run once to attach listeners

    return (
        <div
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-700 ${isComplete ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
        >
            {/* 전체 화면 커맨드 라인 로그 (배경) */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="w-full h-full p-8 font-mono text-8xl text-green-400/40 space-y-2 overflow-auto">
                    {logs.length === 0 ? (
                        <>
                            <div className="animate-pulse">&gt; Waiting for system initialization...</div>
                            <div>&gt;</div>
                        </>
                    ) : (
                        logs.map((log, index) => (
                            <div
                                key={index}
                                className="animate-fade-in"
                                style={{
                                    animationDelay: `${index * 50}ms`,
                                    animationFillMode: 'forwards'
                                }}
                            >
                                <span className="text-green-500">&gt;</span> {log}
                            </div>
                        ))
                    )}
                    <div className="text-green-500 animate-pulse">&gt;</div>
                </div>
            </div>

            {/* 중앙 오버레이 (로고 + 프로그레스) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* 반투명 배경 */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-transparent"></div>

                {/* 메인 콘텐츠 */}
                <div className="relative z-10 flex flex-col items-center space-y-8 px-8">
                    {/* 로고 및 앱 이름 */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-40 rounded-full animate-pulse-slow"></div>
                            <Activity size={80} className="relative text-blue-400 animate-float" strokeWidth={1.5} />
                        </div>

                        <div className="text-center">
                            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-shift">
                                HappyTool
                            </h1>
                            <p className="text-slate-400 text-sm mt-3">v{packageJson.version}</p>
                        </div>
                    </div>

                    {/* 로딩 상태 및 진행률 */}
                    <div className="w-[500px] space-y-4">
                        <div className="flex items-center justify-between text-base">
                            <span className="text-slate-200 animate-pulse font-medium">{status}</span>
                            <span className="text-slate-400 font-mono text-sm">{Math.round(progress)}%</span>
                        </div>

                        {/* 프로그레스 바 */}
                        <div className="relative h-3 bg-slate-800/80 rounded-full overflow-hidden shadow-2xl border border-slate-700/50">
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out animate-shimmer"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    {/* 힌트 텍스트 */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="text-slate-600 text-xs italic mt-8">
                            Press ESC to skip
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoadingSplash;
