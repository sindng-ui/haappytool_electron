import React, { useState, useEffect } from 'react';
import { X, Server, Terminal, RefreshCw, Wifi, Usb, ShieldAlert } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface TizenConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStreamStart: (socket: any, deviceName: string, mode: 'sdb' | 'ssh' | 'test', saveToFile: boolean) => void;
    isConnected?: boolean;
    onDisconnect?: () => void;
    currentConnectionInfo?: string | null;
    isQuickConnect?: boolean; // New prop
    logCommand?: string; // New prop for custom SDB command
}

const TizenConnectionModal: React.FC<TizenConnectionModalProps> = ({
    isOpen, onClose, onStreamStart,
    isConnected: isExternalConnected,
    onDisconnect: onExternalDisconnect,
    currentConnectionInfo,
    isQuickConnect,
    logCommand
}) => {
    // Persist last used mode
    const [mode, setMode] = useState<'ssh' | 'sdb' | 'test'>(() => (localStorage.getItem('lastConnectionMode') as any) || 'sdb');
    const [socket, setSocket] = useState<Socket | null>(null);

    // ... (lines 26-98 unchanged)

    // SSH State
    const [sshHost, setSshHost] = useState(() => localStorage.getItem('sshHost') || '');
    const [sshPort, setSshPort] = useState(() => localStorage.getItem('sshPort') || '22');
    const [sshUser, setSshUser] = useState(() => localStorage.getItem('sshUser') || 'root');
    const [sshPassword, setSshPassword] = useState(() => localStorage.getItem('sshPassword') || '');
    // const [sshKeyPath, setSshKeyPath] = useState(''); // Removed per request

    // Persist SSH Settings
    useEffect(() => { localStorage.setItem('sshHost', sshHost); }, [sshHost]);
    useEffect(() => { localStorage.setItem('sshPort', sshPort); }, [sshPort]);
    useEffect(() => { localStorage.setItem('sshUser', sshUser); }, [sshUser]);
    useEffect(() => { localStorage.setItem('sshPassword', sshPassword); }, [sshPassword]);
    // SDB State
    const [sdbDevices, setSdbDevices] = useState<{ id: string, type: string }[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem('lastSdbDeviceId') || '');
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => { localStorage.setItem('lastSdbDeviceId', selectedDeviceId); }, [selectedDeviceId]);
    const [debugMode, setDebugMode] = useState(false);
    const [saveToFile, setSaveToFile] = useState(false);

    // Connection Status
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const isHandedOver = React.useRef(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const startTimeout = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsConnecting(false);
            setIsScanning(false);
            setStatus('Connection timed out (15s). Please try again.');
            setError('Request timed out. Please check your connection.');
        }, 15000);
    };

    const clearConnectionTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    useEffect(() => {
        let newSocket: Socket | null = null;

        if (isOpen) {
            isHandedOver.current = false;
            newSocket = io('http://127.0.0.1:3003');

            newSocket.on('connect', () => {
                setStatus('Connected to Local Log Server');
                setError('');

                // Quick Connect Logic
                if (isQuickConnect && !isHandedOver.current) {
                    setStatus('Initiating Quick Connect...');
                    // Add small delay to ensure socket is ready and listeners active
                    setTimeout(() => {
                        console.log('[QuickConnect] Mode:', mode);
                        if (mode === 'ssh') {
                            newSocket?.emit('connect_ssh', {
                                host: sshHost,
                                port: parseInt(sshPort),
                                username: sshUser,
                                password: sshPassword,
                                debug: debugMode,
                                saveToFile: saveToFile
                            });
                        } else if (mode === 'sdb') {
                            // For SDB, we need to check if device is available? Or just try?
                            // Try connecting to last used device or auto-detect
                            newSocket?.emit('connect_sdb', {
                                deviceId: selectedDeviceId,
                                debug: debugMode,
                                saveToFile: saveToFile,
                                command: logCommand
                            });
                        } else {
                            // If mock or unknown, just open normally
                            onClose(); // Failed/Cancelled
                        }
                    }, 500);
                }
            });

            newSocket.on('connect_error', () => {
                setError('Failed to connect to Local Log Server. Is it running? (node server)');
                setStatus('Server Offline');
            });

            newSocket.on('sdb_devices', (devices) => {
                setSdbDevices(devices);
                setIsScanning(false);
                if (devices.length > 0 && !selectedDeviceId) setSelectedDeviceId(devices[0].id);
            });

            newSocket.on('ssh_status', (data) => {
                clearConnectionTimeout();
                setStatus(data.message);
                if (data.status === 'connected') {
                    // Prevent duplicate stream start for SSH if already handled
                    if (mode === 'ssh' && isHandedOver.current) return;

                    setIsConnected(true);
                    setMode('ssh');
                    isHandedOver.current = true;
                    onStreamStart(newSocket!, `SSH:${sshHost}`, 'ssh', saveToFile);
                    onClose();
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                }
                setIsConnecting(false);
            });

            newSocket.on('ssh_error', (data) => {
                clearConnectionTimeout();
                setError(data.message);
                setIsConnecting(false);
            });

            newSocket.on('sdb_status', (data) => {
                clearConnectionTimeout();
                setStatus(data.message);
                if (data.status === 'connected') {
                    setIsConnected(true);
                    setMode('sdb');
                    isHandedOver.current = true;
                    onStreamStart(newSocket!, `SDB:${selectedDeviceId || 'Default'}`, 'sdb', saveToFile);
                    onClose();
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                }
                setIsConnecting(false);
            });

            newSocket.on('sdb_error', (data) => {
                clearConnectionTimeout();
                let msg = data.message;
                // Check for common 'command not found' patterns for sdb
                if (msg && (msg.includes('spawn sdb ENOENT') || msg.includes('is not recognized') || msg.includes('command not found'))) {
                    msg = "SDB command not found. Please add 'sdb' to your system PATH.";
                }
                setError(msg);
                setIsConnecting(false);
            });

            newSocket.on('debug_log', (msg) => {
                // Should show toast or console log
                console.log('[Server Debug]', msg);
            });

            setSocket(newSocket);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (newSocket) {
                if (!isHandedOver.current) {
                    newSocket.disconnect();
                }
                setSocket(null);
            }
        };
    }, [isOpen]);

    const refreshDeviceList = () => {
        if (socket) {
            // Keep scanning true until list returns
            setSdbDevices([]);
            socket.emit('list_sdb_devices');
        }
    };

    const handleScanSdb = () => {
        if (socket) {
            setIsScanning(true);
            setStatus('Connecting to 192.168.250.250...');
            setError('');
            startTimeout();
            socket.emit('connect_sdb_remote', { ip: '192.168.250.250' });
        }
    };

    useEffect(() => {
        if (socket) {
            socket.on('sdb_remote_result', (data) => {
                clearConnectionTimeout();
                if (data.success) {
                    setStatus(data.message);
                } else {
                    // Even if remote connect fails, we simply report it but continue to list local devices
                    setStatus(`Remote: ${data.message}`);
                }
                // Always refresh list after connection attempt
                refreshDeviceList();
            });
        }
    }, [socket]);

    const handleConnect = () => {
        if (!socket) return;
        setError('');
        setIsConnecting(true);
        startTimeout();

        // Persist mode
        localStorage.setItem('lastConnectionMode', mode);

        if (mode === 'test') {
            socket.emit('start_scroll_stream');
            setIsConnected(true);
            isHandedOver.current = true;
            onStreamStart(socket, 'TEST:Simulated Stream', 'test', false); // Test mode doesn't save to file yet
            onClose();
            return;
        }

        if (mode === 'ssh') {
            socket.emit('connect_ssh', {
                host: sshHost,
                port: parseInt(sshPort),
                username: sshUser,
                password: sshPassword,
                debug: debugMode,
                saveToFile: saveToFile
            });
            // Immediate Handover for SSH to support interactive prompts in main view
            setIsConnected(true);
            isHandedOver.current = true;
            onStreamStart(socket, `SSH:${sshHost}`, 'ssh', saveToFile);
            onClose();
        } else {
            socket.emit('connect_sdb', {
                deviceId: selectedDeviceId,
                debug: debugMode,
                saveToFile: saveToFile,
                command: logCommand
            });
        }
    };

    const handleDisconnect = () => {
        if (!socket) return;
        setIsConnecting(true);

        if (mode === 'ssh') {
            socket.emit('disconnect_ssh');
        } else {
            socket.emit('disconnect_sdb');
        }

        setIsConnected(false);
        setIsConnecting(false);
        setStatus('Disconnected');
    };

    if (!isOpen) return null;

    // Use external props if available, otherwise local state
    const effectiveIsConnected = isExternalConnected ?? isConnected;
    const effectiveStatus = isExternalConnected ? 'Connected' : status;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl w-[500px] overflow-hidden">
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                        <Server size={20} /> Tizen Log Connection
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6">
                    {/* Quick Connect Overlay */}
                    {isQuickConnect && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <RefreshCw size={48} className="text-indigo-500 animate-spin" />
                            <div className="text-lg font-bold text-slate-200">Connecting...</div>
                            <div className="text-sm text-slate-400">{status}</div>
                        </div>
                    )}

                    {/* Mode Selection - Hide if Quick Connect */}
                    {!effectiveIsConnected && !isQuickConnect && (
                        <div className="flex gap-4 mb-6">
                            <button
                                onClick={() => setMode('sdb')}
                                className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${mode === 'sdb' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                            >
                                <Usb size={24} />
                                <span className="font-bold">SDB (USB/Bridge)</span>
                            </button>
                            <button
                                onClick={() => setMode('ssh')}
                                className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${mode === 'ssh' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                            >
                                <Wifi size={24} />
                                <span className="font-bold">SSH (Network)</span>
                            </button>
                            <button
                                onClick={() => setMode('test')}
                                className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${mode === 'test' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                            >
                                <RefreshCw size={24} />
                                <span className="font-bold">Simulate</span>
                            </button>
                        </div>
                    )}

                    {/* SDB Form */}
                    {mode === 'sdb' && !effectiveIsConnected && !isQuickConnect && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-bold text-slate-400 uppercase">Device</label>
                                <button onClick={handleScanSdb} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                    <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} /> Scan
                                </button>
                            </div>
                            <select
                                className="w-full bg-slate-800 text-slate-200 p-3 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                                value={selectedDeviceId}
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                            >
                                <option value="">Auto-detect (First Device)</option>
                                {sdbDevices.map(d => (
                                    <option key={d.id} value={d.id}>{d.id} ({d.type})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* SSH Form */}
                    {mode === 'ssh' && !effectiveIsConnected && !isQuickConnect && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Host IP</label>
                                    <input className="w-full bg-slate-800 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="192.168.1.x" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Port</label>
                                    <input className="w-full bg-slate-800 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none" value={sshPort} onChange={e => setSshPort(e.target.value)} placeholder="22" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">User</label>
                                    <input className="w-full bg-slate-800 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none" value={sshUser} onChange={e => setSshUser(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Password</label>
                                    <input type="password" className="w-full bg-slate-800 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none" value={sshPassword} onChange={e => setSshPassword(e.target.value)} placeholder="Optional" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Test Simulation Form */}
                    {mode === 'test' && !effectiveIsConnected && !isQuickConnect && (
                        <div className="p-4 bg-slate-800/50 rounded-xl border border-dashed border-slate-700 text-center">
                            <h3 className="text-indigo-300 font-bold mb-2">Test Infinite Scroll</h3>
                            <p className="text-xs text-slate-400 mb-4">
                                Connects to the local server and generates 10 lines of simulated logs per second to test performance and auto-scroll behavior.
                            </p>
                        </div>
                    )}

                    {/* Options (Debug) - Hide if connected */}
                    {!effectiveIsConnected && (
                        <div className="mt-4 flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer select-none hover:text-slate-300">
                                <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} className="accent-indigo-500 w-4 h-4 rounded border-slate-700 bg-slate-800" />
                                <span>Enable Debug Mode (Save logs to server)</span>
                            </label>
                            {/* New checkbox for saveToFile */}
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer select-none hover:text-slate-300">
                                <input type="checkbox" checked={saveToFile} onChange={e => setSaveToFile(e.target.checked)} className="accent-indigo-500 w-4 h-4 rounded border-slate-700 bg-slate-800" />
                                <span>Automatically save logs to file (TIMESTAMP.txt)</span>
                            </label>
                        </div>
                    )}

                    {/* Status Area */}
                    {!effectiveIsConnected && (
                        <div className="mt-4 bg-slate-950 rounded-lg p-3 min-h-[60px] flex items-start justify-center text-sm border border-slate-800">
                            {error ? (
                                <div className="text-red-400 flex items-start gap-2">
                                    <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                                    <span className="whitespace-pre-line text-left">{error}</span>
                                </div>
                            ) : effectiveStatus ? (
                                <span className="text-indigo-400 flex items-center gap-2"><Terminal size={16} /> {effectiveStatus}</span>
                            ) : (
                                <span className="text-slate-600 italic">Ready to connect...</span>
                            )}
                        </div>
                    )}

                    {effectiveIsConnected ? (
                        <>
                            <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl mb-4 text-center">
                                <h3 className="text-emerald-400 font-bold mb-1 flex items-center justify-center gap-2">
                                    <Wifi size={20} />
                                    Current Status: Connected
                                </h3>
                                <p className="text-sm text-slate-400 font-mono bg-slate-900/50 p-2 rounded mt-2 inline-block">
                                    {currentConnectionInfo || (mode === 'ssh' ? `SSH: ${sshHost}` : `SDB: ${selectedDeviceId || 'Device'}`)}
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    if (onExternalDisconnect) {
                                        onExternalDisconnect();
                                        onClose(); // Close modal after disconnect
                                    } else {
                                        handleDisconnect();
                                    }
                                }}
                                disabled={isConnecting}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-red-900/50 transition-all ${isConnecting ? 'bg-slate-700 cursor-wait' : 'bg-red-600 hover:bg-red-500 hover:scale-[1.02]'}`}
                            >
                                {isConnecting ? 'Disconnecting...' : 'Disconnect Current Session'}
                            </button>
                            <p className="text-xs text-center text-slate-500 mt-4">
                                To connect to a different device, please disconnect first.
                            </p>
                        </>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className={`w-full mt-4 py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-900/50 transition-all ${isConnecting ? 'bg-slate-700 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02]'}`}
                        >
                            {isConnecting ? 'Connecting...' : 'Connect & Start Stream'}
                        </button>
                    )}
                    {!socket && !effectiveIsConnected && <p className="text-center text-xs text-slate-500 mt-2">Connecting to local log server...</p>}
                </div>
            </div>
        </div >
    );
};

export default TizenConnectionModal;
