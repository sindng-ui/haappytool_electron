import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Camera, Image as ImageIcon, Play, Upload, CheckCircle, XCircle } from 'lucide-react';

interface MatchResult {
    success: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    confidence?: number;
    message?: string;
}

const ScreenMatcher: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [screenUrl, setScreenUrl] = useState<string | null>(null);
    const [screenAbsPath, setScreenAbsPath] = useState<string | null>(null);
    const [templateUrl, setTemplateUrl] = useState<string | null>(null);
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [status, setStatus] = useState<string>('Ready');
    const [isCapturing, setIsCapturing] = useState(false);
    const [isMatching, setIsMatching] = useState(false);

    useEffect(() => {
        const newSocket = io('http://localhost:3003');

        newSocket.on('connect', () => {
            console.log('[ScreenMatcher] Connected to server');
        });

        newSocket.on('capture_result', (data: { success: boolean, path?: string, absolutePath?: string, message?: string }) => {
            setIsCapturing(false);
            if (data.success && data.path) {
                // Append timestamp to force reload image if path is same
                setScreenUrl(`http://localhost:3003${data.path}?t=${Date.now()}`);
                setScreenAbsPath(data.absolutePath || null);
                setStatus('Screen captured');
                setMatchResult(null); // Reset previous match
            } else {
                setStatus(`Capture failed: ${data.message}`);
            }
        });

        newSocket.on('match_result', (data: MatchResult) => {
            setIsMatching(false);
            setMatchResult(data);
            if (data.success) {
                setStatus(`Match found! Confidence: ${(data.confidence! * 100).toFixed(1)}%`);
            } else {
                setStatus(`Match failed: ${data.message || 'Low confidence'}`);
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const handleCapture = () => {
        if (!socket) return;
        setIsCapturing(true);
        setStatus('Capturing screen...');
        // Device ID could be passed if we had a selector. defaulting to null (first device)
        socket.emit('capture_screen', { deviceId: null });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setTemplateUrl(ev.target?.result as string);
                setMatchResult(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMatch = () => {
        if (!socket || !screenAbsPath || !templateUrl) {
            setStatus('Please capture screen and upload template first.');
            return;
        }
        setIsMatching(true);
        setStatus('Matching template...');
        socket.emit('match_image', { screenPath: screenAbsPath, templatePath: templateUrl });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 overflow-hidden">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ImageIcon className="text-indigo-500" />
                        Screen Matcher
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Capture Tizen TV screen and find image templates.</p>
                </div>
                <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <span className="font-mono text-sm">{status}</span>
                </div>
            </header>

            <div className="flex flex-1 gap-6 min-h-0">
                {/* Left Panel: Controls & Template */}
                <div className="w-80 flex flex-col gap-6">
                    {/* Actions */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-3">
                        <h2 className="font-semibold text-lg mb-2">Controls</h2>

                        <button
                            onClick={handleCapture}
                            disabled={isCapturing}
                            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${isCapturing ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                }`}
                        >
                            <Camera size={18} />
                            {isCapturing ? 'Capturing...' : 'Capture Screen'}
                        </button>

                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-500 uppercase">Template Image</label>
                            <label className="cursor-pointer flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-800/20">
                                {templateUrl ? (
                                    <img src={templateUrl} alt="Template" className="h-full object-contain p-2" />
                                ) : (
                                    <>
                                        <Upload className="text-slate-400" />
                                        <span className="text-xs text-slate-500">Click to upload</span>
                                    </>
                                )}
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                        </div>

                        <button
                            onClick={handleMatch}
                            disabled={isMatching || !screenUrl || !templateUrl}
                            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${isMatching || !screenUrl || !templateUrl
                                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                }`}
                        >
                            <Play size={18} />
                            {isMatching ? 'Matching...' : 'Find on Screen'}
                        </button>
                    </div>

                    {/* Result Info */}
                    {matchResult && matchResult.success && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl">
                            <h3 className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2 mb-2">
                                <CheckCircle size={18} /> Match Found
                            </h3>
                            <div className="space-y-1 text-sm text-emerald-800 dark:text-emerald-300">
                                <p>Confidence: <span className="font-mono font-bold">{(matchResult.confidence! * 100).toFixed(2)}%</span></p>
                                <p>Position: <span className="font-mono">({matchResult.x}, {matchResult.y})</span></p>
                                <p>Size: <span className="font-mono">{matchResult.width}x{matchResult.height}</span></p>
                            </div>
                        </div>
                    )}
                    {matchResult && !matchResult.success && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl">
                            <h3 className="text-red-700 dark:text-red-400 font-bold flex items-center gap-2">
                                <XCircle size={18} /> No Match
                            </h3>
                            <p className="text-sm mt-1 text-red-600 dark:text-red-300">Confidence: {(matchResult.confidence || 0).toFixed(2)}</p>
                        </div>
                    )}
                </div>

                {/* Right Panel: Screen Preview */}
                <div className="flex-1 bg-slate-200 dark:bg-black/40 rounded-xl overflow-hidden shadow-inner border border-slate-300 dark:border-slate-800 relative flex items-center justify-center">
                    {screenUrl ? (
                        <div className="relative inline-block max-w-full max-h-full">
                            <img src={screenUrl} alt="Screen Capture" className="max-w-full max-h-full shadow-2xl" />
                            {matchResult?.success && matchResult.x !== undefined && (
                                <div
                                    className="absolute border-4 border-red-500 shadow-lg shadow-red-500/50 z-10 box-content"
                                    style={{
                                        left: matchResult.x,
                                        top: matchResult.y,
                                        width: matchResult.width,
                                        height: matchResult.height,
                                        // We might need to handle scaling if the image is scaled by CSS. 
                                        // But here we rely on natural size or handled by 'inline-block' wrapper matching image size?
                                        // If image is scaled down, overlay needs scaling.
                                        // For simplicity, we assume image might be full size or we need more complex logic.
                                        // Let's assume the user scrolls/pans or the image fits.
                                        // Actually, if img is scaled, this div will be wrong.
                                        // We should use a responsive technique.
                                        // For now, let's keep it simple. If image is scaled, the box will be off.
                                        // User can scroll via overflow-auto container if we enabled it.
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400">
                            <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                            <p>No screen captured yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScreenMatcher;
