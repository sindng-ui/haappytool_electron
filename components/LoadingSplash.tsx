import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface LoadingSplashProps {
    onLoadingComplete?: () => void;
}

const LoadingSplash: React.FC<LoadingSplashProps> = ({ onLoadingComplete }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Initializing...');
    const [isComplete, setIsComplete] = useState(false);
    const startTimeRef = React.useRef<number>(Date.now());
    const MIN_DISPLAY_TIME = 2000; // 최소 3초 표시

    useEffect(() => {
        console.log('[LoadingSplash] Component mounted');
        console.log('[LoadingSplash] window.electronAPI exists:', !!window.electronAPI);

        // Electron이 아닌 웹 환경에서는 바로 완료 처리
        if (!window.electronAPI) {
            setProgress(100);
            setStatus('Ready!');
            setIsComplete(true);
            setTimeout(() => onLoadingComplete?.(), 500);
            return;
        }

        // 로딩 진행률 업데이트
        const handleProgress = (...args: any[]) => {
            console.log('[LoadingSplash] handleProgress called with:', args);
            const data = args[0] || args[1]; // Try both positions
            if (data && typeof data === 'object') {
                setProgress(data.progress);
                setStatus(data.status);
            }
        };

        // 로그 메시지 수신
        const handleLog = (...args: any[]) => {
            console.log('[LoadingSplash] handleLog called with:', args);
            const message = args[0] || args[1]; // Try both positions
            if (typeof message === 'string') {
                setLogs(prev => [...prev.slice(-29), message]); // 최근 30개 유지
            }
        };

        // 로딩 완료
        const handleComplete = () => {
            console.log('[LoadingSplash] handleComplete called');
            setProgress(100);
            setStatus('Ready!');

            // 최소 표시 시간 확인
            const elapsedTime = Date.now() - startTimeRef.current;
            const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsedTime);

            // 최소 시간이 지나지 않았으면 대기
            setTimeout(() => {
                setIsComplete(true);

                // 페이드 아웃 후 콜백 호출
                setTimeout(() => {
                    onLoadingComplete?.();
                }, 800);
            }, remainingTime);
        };

        console.log('[LoadingSplash] Registering event listeners');
        window.electronAPI.on('loading-progress', handleProgress);
        window.electronAPI.on('loading-log', handleLog);
        window.electronAPI.on('loading-complete', handleComplete);

        // ESC 키로 스킵 (개발 모드만)
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && process.env.NODE_ENV === 'development') {
                handleComplete();
            }
        };
        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.electronAPI.off('loading-progress', handleProgress);
            window.electronAPI.off('loading-log', handleLog);
            window.electronAPI.off('loading-complete', handleComplete);
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [onLoadingComplete]);

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
                            <p className="text-slate-400 text-sm mt-3">v0.9.8</p>
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
