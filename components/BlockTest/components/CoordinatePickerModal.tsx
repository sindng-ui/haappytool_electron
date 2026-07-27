import React, { useState, useRef, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { getSavedSdbDeviceId } from '../utils/sdbCommandHelper';

interface CoordinatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (x: number, y: number) => void;
    initialX?: number;
    initialY?: number;
    onCaptureScreen: (deviceId?: string) => Promise<{ success: boolean; url?: string; message?: string }>;
}

export const CoordinatePickerModal: React.FC<CoordinatePickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    initialX = 0,
    initialY = 0,
    onCaptureScreen,
}) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Natural dimensions of the loaded image
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    // Hover state (mouse coords relative to original image size)
    const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
    const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Selected coords on the original image
    const [selectedCoords, setSelectedCoords] = useState<{ x: number; y: number }>({ x: initialX, y: initialY });

    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedCoords({ x: initialX, y: initialY });
            setStatusMessage(null);
        }
    }, [isOpen, initialX, initialY]);

    if (!isOpen) return null;

    const handleCapture = async () => {
        setIsCapturing(true);
        setStatusMessage('Capturing screen from Tizen device via SDB...');
        try {
            const deviceId = getSavedSdbDeviceId() || undefined;
            const res = await onCaptureScreen(deviceId);
            if (res.success && res.url) {
                // Add timestamp query to prevent browser caching
                setImageUrl(`${res.url}?t=${Date.now()}`);
                setStatusMessage('Screen captured successfully!');
            } else {
                setStatusMessage(`Capture failed: ${res.message || 'Unknown error'}`);
            }
        } catch (e: any) {
            setStatusMessage(`Capture error: ${e.message}`);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                if (dataUrl) {
                    setImageUrl(dataUrl);
                    setStatusMessage(`Loaded image: ${file.name}`);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const url = URL.createObjectURL(blob);
                    setImageUrl(url);
                    setStatusMessage('Pasted image from clipboard!');
                    return;
                }
            }
            setStatusMessage('No image found in clipboard.');
        } catch (err: any) {
            setStatusMessage('Clipboard access denied or unsupported.');
        }
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
        const img = imgRef.current;
        if (!img || naturalSize.width === 0 || naturalSize.height === 0) return;

        const rect = img.getBoundingClientRect();
        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;

        // Ratio calculation
        const scaleX = naturalSize.width / rect.width;
        const scaleY = naturalSize.height / rect.height;

        const realX = Math.min(naturalSize.width, Math.max(0, Math.round(displayX * scaleX)));
        const realY = Math.min(naturalSize.height, Math.max(0, Math.round(displayY * scaleY)));

        setHoverCoords({ x: realX, y: realY });
        setMouseOffset({ x: displayX, y: displayY });
    };

    const handleMouseLeave = () => {
        setHoverCoords(null);
    };

    const handleClickImage = (e: React.MouseEvent<HTMLImageElement>) => {
        const img = imgRef.current;
        if (!img || naturalSize.width === 0 || naturalSize.height === 0) return;

        const rect = img.getBoundingClientRect();
        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;

        const scaleX = naturalSize.width / rect.width;
        const scaleY = naturalSize.height / rect.height;

        const realX = Math.min(naturalSize.width, Math.max(0, Math.round(displayX * scaleX)));
        const realY = Math.min(naturalSize.height, Math.max(0, Math.round(displayY * scaleY)));

        setSelectedCoords({ x: realX, y: realY });
    };

    const handleApply = () => {
        onSelect(selectedCoords.x, selectedCoords.y);
        onClose();
    };

    // Calculate display position of selected point for pin marker rendering
    let pinDisplayPos: { x: number; y: number } | null = null;
    if (imgRef.current && naturalSize.width > 0 && naturalSize.height > 0) {
        const rect = imgRef.current.getBoundingClientRect();
        pinDisplayPos = {
            x: (selectedCoords.x / naturalSize.width) * rect.width,
            y: (selectedCoords.y / naturalSize.height) * rect.height,
        };
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 title-drag">
            <div className="relative flex flex-col w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden no-drag">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/60 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
                            <Lucide.Crosshair size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                                Touch Coordinate Picker
                                {naturalSize.width > 0 && (
                                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                                        {naturalSize.width} × {naturalSize.height} px
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-400">Click on the screen image to pick target X, Y coordinates</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Capture Button */}
                        <button
                            onClick={handleCapture}
                            disabled={isCapturing}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950 active:scale-95"
                        >
                            <Lucide.Camera size={14} className={isCapturing ? 'animate-spin' : ''} />
                            <span>{isCapturing ? 'Capturing...' : 'Capture Screen (SDB)'}</span>
                        </button>

                        {/* Paste Clipboard */}
                        <button
                            onClick={handlePasteFromClipboard}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
                            title="Paste image from clipboard"
                        >
                            <Lucide.Clipboard size={14} />
                            <span>Paste</span>
                        </button>

                        {/* File Upload */}
                        <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95">
                            <Lucide.Upload size={14} />
                            <span>Upload</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>

                        {/* Close */}
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                            <Lucide.X size={18} />
                        </button>
                    </div>
                </div>

                {/* Status Bar */}
                {statusMessage && (
                    <div className="px-4 py-1.5 bg-slate-950 text-xs font-mono text-cyan-300 border-b border-slate-800 flex items-center gap-2">
                        <Lucide.Info size={12} className="text-cyan-400 shrink-0" />
                        <span className="truncate">{statusMessage}</span>
                    </div>
                )}

                {/* Main View Area */}
                <div ref={containerRef} className="relative flex-1 bg-slate-950 overflow-auto p-4 flex items-center justify-center select-none">
                    {imageUrl ? (
                        <div className="relative inline-block border border-slate-800 rounded-lg overflow-hidden shadow-xl">
                            <img
                                ref={imgRef}
                                src={imageUrl}
                                alt="Screen preview"
                                onLoad={handleImageLoad}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                onClick={handleClickImage}
                                className="max-w-full max-h-[68vh] object-contain cursor-crosshair block"
                            />

                            {/* Crosshair Lines & Hover Tooltip */}
                            {hoverCoords && (
                                <>
                                    {/* Horizontal Line */}
                                    <div
                                        className="absolute left-0 right-0 border-t border-cyan-400/60 pointer-events-none"
                                        style={{ top: `${mouseOffset.y}px` }}
                                    />
                                    {/* Vertical Line */}
                                    <div
                                        className="absolute top-0 bottom-0 border-l border-cyan-400/60 pointer-events-none"
                                        style={{ left: `${mouseOffset.x}px` }}
                                    />
                                    {/* Tooltip */}
                                    <div
                                        className="absolute pointer-events-none bg-slate-900/90 text-cyan-300 text-[11px] font-mono font-bold px-2 py-1 rounded shadow-lg border border-cyan-500/40 z-20 whitespace-nowrap"
                                        style={{
                                            left: `${mouseOffset.x + 12}px`,
                                            top: `${mouseOffset.y + 12}px`,
                                        }}
                                    >
                                        X: {hoverCoords.x}, Y: {hoverCoords.y}
                                    </div>
                                </>
                            )}

                            {/* Selected Point Marker */}
                            {pinDisplayPos && (
                                <div
                                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                                    style={{ left: `${pinDisplayPos.x}px`, top: `${pinDisplayPos.y}px` }}
                                >
                                    <div className="relative flex items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-cyan-400 opacity-75"></span>
                                        <div className="w-4 h-4 bg-cyan-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                                            <div className="w-1 h-1 bg-slate-950 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 p-12 text-center max-w-md">
                            <div className="p-4 bg-slate-900 rounded-full border border-slate-800 mb-4 text-cyan-400">
                                <Lucide.Crosshair size={36} />
                            </div>
                            <h4 className="font-bold text-slate-200 text-sm mb-1">No Screen Capture Loaded</h4>
                            <p className="text-xs text-slate-400 mb-6">
                                Click <strong className="text-cyan-400 font-semibold">Capture Screen</strong> to take a screenshot from your SDB connected Tizen device, or upload an image.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCapture}
                                    disabled={isCapturing}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-cyan-950 flex items-center gap-2 active:scale-95"
                                >
                                    <Lucide.Camera size={16} />
                                    <span>Capture Screen</span>
                                </button>
                                <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg cursor-pointer transition-all flex items-center gap-2 active:scale-95">
                                    <Lucide.Upload size={16} />
                                    <span>Upload Image</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-950/80 border-t border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400 font-medium">Selected Coordinate:</span>
                            <div className="flex items-center gap-1.5 bg-slate-900 border border-cyan-500/30 rounded px-2.5 py-1">
                                <span className="font-mono text-cyan-400 text-xs font-bold">
                                    X = {selectedCoords.x}, Y = {selectedCoords.y}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-950 active:scale-95"
                        >
                            <Lucide.Check size={16} />
                            <span>Apply Coordinates</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
