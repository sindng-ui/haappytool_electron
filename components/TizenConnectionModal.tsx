import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, Server, Terminal, RefreshCw, Wifi, Usb, ShieldAlert, Info } from 'lucide-react';
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
    tags?: string[]; // Optional tags for substitution
}

const TizenConnectionModal: React.FC<TizenConnectionModalProps> = memo(({
    isOpen, onClose, onStreamStart,
    isConnected: isExternalConnected,
    onDisconnect: onExternalDisconnect,
    currentConnectionInfo,
    isQuickConnect,
    logCommand,
    tags
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

    // SDB Path
    const [sdbPath, setSdbPath] = useState(() => localStorage.getItem('tizen_sdb_path') || '');

    // SDB State
    const [sdbDevices, setSdbDevices] = useState<{ id: string, type: string }[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem('lastSdbDeviceId') || '');
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => { localStorage.setItem('lastSdbDeviceId', selectedDeviceId); }, [selectedDeviceId]);
    const [debugMode, setDebugMode] = useState(false);

    // Persist Save to File preference
    const [saveToFile, setSaveToFile] = useState(() => localStorage.getItem('tizen_auto_save_logs') === 'true');
    useEffect(() => {
        localStorage.setItem('tizen_auto_save_logs', String(saveToFile));
    }, [saveToFile]);

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
            setStatus('Connection timed out (12s). Please try again.');
            setError('Request timed out (12s). Please check your connection.');
        }, 12000);
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
            // Reset transient state
            setIsConnecting(false);
            setError('');
            setStatus('');
            setIsScanning(false);

            isHandedOver.current = false;
            newSocket = io('http://127.0.0.1:3003');

            newSocket.on('connect', () => {
                console.log('[TizenModal] ✓ Socket connected to server');
                setStatus('Connected to Local Log Server');
                setError('');

                // Quick Connect Logic
                if (isQuickConnect && !isHandedOver.current) {
                    console.log('[TizenModal] Quick Connect mode active');
                    setStatus('Initiating Quick Connect...');
                    setIsConnecting(true); // Ensure connecting state
                    startTimeout(); // Start timeout timer for auto-connect
                    // Add small delay to ensure socket is ready and listeners active
                    setTimeout(() => {
                        console.log('[QuickConnect] Mode:', mode);
                        if (mode === 'ssh') {
                            console.log('[QuickConnect] Emitting connect_ssh with params:', {
                                host: sshHost,
                                port: parseInt(sshPort),
                                username: sshUser,
                                passwordProvided: !!sshPassword,
                                debug: debugMode,
                                saveToFile: saveToFile,
                                tags: tags || []
                            });
                            newSocket?.emit('connect_ssh', {
                                host: sshHost,
                                port: parseInt(sshPort),
                                username: sshUser,
                                password: sshPassword,
                                debug: debugMode,
                                saveToFile: saveToFile,
                                command: logCommand,
                                tags: tags || []
                            });
                        } else if (mode === 'sdb') {
                            console.log('[QuickConnect] Emitting connect_sdb with params:', {
                                deviceId: selectedDeviceId || 'auto-detect',
                                debug: debugMode,
                                saveToFile: saveToFile,
                                command: logCommand || 'default',
                                tags: tags || []
                            });
                            // For SDB, we need to check if device is available? Or just try?
                            // Try connecting to last used device or auto-detect
                            newSocket?.emit('connect_sdb', {
                                deviceId: selectedDeviceId || undefined,  // ✅ Convert empty string to undefined for proper auto-detect
                                debug: debugMode,
                                saveToFile: saveToFile,
                                command: logCommand,
                                tags: tags || [],
                                sdbPath
                            });
                        } else {
                            console.warn('[QuickConnect] Unknown mode, closing modal');
                            // If mock or unknown, just open normally
                            onClose(); // Failed/Cancelled
                        }
                    }, 500);
                }
            });

            newSocket.on('connect_error', (err) => {
                console.error('[TizenModal] ✗ Socket connection error:', err);
                setError('Failed to connect to Local Log Server. Is it running? (node server)');
                setStatus('Server Offline');
            });

            newSocket.on('sdb_devices', (devices) => {
                setSdbDevices(devices);
                setIsScanning(false);
                if (devices.length > 0 && !selectedDeviceId) setSelectedDeviceId(devices[0].id);
            });

            newSocket.on('ssh_status', (data) => {
                console.log('[TizenModal] SSH status received:', data);
                clearConnectionTimeout();
                setStatus(data.message);
                if (data.status === 'connected') {
                    console.log('[TizenModal] SSH connected successfully');
                    // Prevent duplicate stream start for SSH if already handled
                    if (mode === 'ssh' && isHandedOver.current) {
                        console.warn('[TizenModal] SSH already handed over, ignoring duplicate');
                        return;
                    }

                    setIsConnected(true);
                    setMode('ssh');
                    isHandedOver.current = true;
                    console.log('[TizenModal] Handing over to stream, closing modal');
                    onStreamStart(newSocket!, `SSH:${sshHost}`, 'ssh', saveToFile);
                    onClose();
                } else if (data.status === 'disconnected') {
                    console.log('[TizenModal] SSH disconnected');
                    setIsConnected(false);
                }
                setIsConnecting(false);
            });

            newSocket.on('ssh_error', (data) => {
                console.error('[TizenModal] SSH error received:', data);
                clearConnectionTimeout();
                setError(data.message);
                setIsConnecting(false);
            });

            newSocket.on('sdb_status', (data) => {
                console.log('[TizenModal] SDB status received:', data);
                clearConnectionTimeout();
                setStatus(data.message);
                if (data.status === 'connected') {
                    console.log('[TizenModal] SDB connected successfully');
                    setIsConnected(true);
                    setMode('sdb');
                    isHandedOver.current = true;
                    console.log('[TizenModal] Handing over to stream, closing modal');
                    onStreamStart(newSocket!, `SDB:${selectedDeviceId || 'Default'}`, 'sdb', saveToFile);
                    onClose();
                } else if (data.status === 'reconnecting') {
                    // ✅ Keep connecting state during auto-recovery
                    console.log('[TizenModal] SDB auto-reconnecting:', data.message);
                    setIsConnecting(true);
                    setError(''); // Clear previous errors
                } else if (data.status === 'disconnected') {
                    console.log('[TizenModal] SDB disconnected');
                    setIsConnected(false);
                    setIsConnecting(false);
                }
                // Don't set isConnecting to false if reconnecting
                if (data.status !== 'reconnecting') {
                    setIsConnecting(false);
                }
            });

            newSocket.on('sdb_error', (data) => {
                console.error('[TizenModal] SDB error received:', data);
                clearConnectionTimeout();
                let msg = data.message;
                // Check for common 'command not found' patterns for sdb
                if (msg && (msg.includes('spawn sdb ENOENT') || msg.includes('is not recognized') || msg.includes('command not found'))) {
                    console.error('[TizenModal] SDB not found in PATH');
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

    const refreshDeviceList = useCallback(() => {
        if (socket) {
            // Keep scanning true until list returns
            setSdbDevices([]);
            socket.emit('list_sdb_devices', { sdbPath });
        }
    }, [socket, sdbPath]);

    const handleScanSdb = useCallback(() => {
        if (socket) {
            setIsScanning(true);
            setStatus('Connecting to 192.168.250.250...');
            setError('');
            startTimeout();
            socket.emit('connect_sdb_remote', { ip: '192.168.250.250', sdbPath });
        }
    }, [socket, sdbPath]);

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

    const handleConnect = useCallback(() => {
        console.log('[TizenModal] ========== Manual Connect Initiated ==========');
        console.log('[TizenModal] Mode:', mode);

        if (!socket) {
            console.error('[TizenModal] No socket available');
            return;
        }

        setError('');
        setIsConnecting(true);
        startTimeout();

        // Persist mode
        localStorage.setItem('lastConnectionMode', mode);

        if (mode === 'test') {
            console.log('[TizenModal] Test mode - starting simulated stream');
            socket.emit('start_scroll_stream');
            setIsConnected(true);
            isHandedOver.current = true;
            onStreamStart(socket, 'TEST:Simulated Stream', 'test', false); // Test mode doesn't save to file yet
            onClose();
            return;
        }

        if (mode === 'ssh') {
            console.log('[TizenModal] SSH - waiting for server connection confirmation');
            socket.emit('connect_ssh', {
                host: sshHost,
                port: parseInt(sshPort),
                username: sshUser,
                password: sshPassword,
                debug: debugMode,
                saveToFile: saveToFile,
                command: logCommand,
                tags: tags || []
            });
        } else {
            console.log('[TizenModal] Emitting connect_sdb with params:', {
                deviceId: selectedDeviceId || 'auto-detect',
                debug: debugMode,
                saveToFile: saveToFile,
                command: logCommand || 'default'
            });
            socket.emit('connect_sdb', {
                deviceId: selectedDeviceId || undefined,  // ✅ Convert empty string to undefined for proper auto-detect
                debug: debugMode,
                saveToFile: saveToFile,
                command: logCommand,
                tags: tags || [],
                sdbPath
            });
        }
    }, [socket, mode, sshHost, sshPort, sshUser, sshPassword, debugMode, saveToFile, logCommand, tags, sdbPath, selectedDeviceId, onStreamStart, onClose]);

    const handleDisconnect = useCallback(() => {
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
    }, [socket, mode]);

    if (!isOpen) return null;

    // Use external props if available, otherwise local state
    const effectiveIsConnected = isExternalConnected ?? isConnected;
    const effectiveStatus = isExternalConnected ? 'Connected' : status;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 transition-all ${effectiveIsConnected ? 'h-[380px]' : 'h-[580px]'}`}>
                <div className="bg-slate-950 p-5 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Server size={18} className="text-indigo-500" /> Tizen Connection
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                    {/* Quick Connect Overlay */}
                    {isQuickConnect && !error && isConnecting && (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                            <div className="relative">
                                <RefreshCw size={56} className="text-indigo-500 animate-spin" />
                                <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full" />
                            </div>
                            <div className="text-xl font-bold text-slate-200">Starting Stream</div>
                            <div className="text-sm text-indigo-400/80 font-mono italic">{status}</div>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Mode Selection - Sleek Tabs */}
                    {!effectiveIsConnected && !isQuickConnect && (
                        <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800 shrink-0">
                            {[
                                { id: 'sdb', label: 'SDB', icon: Usb },
                                { id: 'ssh', label: 'SSH', icon: Wifi },
                                { id: 'test', label: 'Simulate', icon: RefreshCw }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setMode(tab.id as any)}
                                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 ${mode === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {!effectiveIsConnected && (
                        <div className="flex-1 flex flex-col space-y-4">
                            <div className="space-y-4">
                                {/* SDB Form */}
                                {mode === 'sdb' && !isQuickConnect && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Select Device</label>
                                            <button onClick={handleScanSdb} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase">
                                                <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} /> Rescan
                                            </button>
                                        </div>
                                        <select
                                            className="w-full bg-slate-800 text-slate-200 p-3 rounded-xl border border-slate-700 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer text-sm"
                                            value={selectedDeviceId}
                                            onKeyDown={e => e.stopPropagation()}
                                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                                        >
                                            <option value="">Auto-detect (Recommended)</option>
                                            {sdbDevices.map(d => (
                                                <option key={d.id} value={d.id}>{d.id} ({d.type})</option>
                                            ))}
                                        </select>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                                                SDB Executable Path
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 placeholder-slate-800 focus:border-indigo-500/50 transition-all outline-none"
                                                    placeholder="C:\tizen-studio\tools\sdb.exe"
                                                    value={sdbPath}
                                                    onKeyDown={e => e.stopPropagation()}
                                                    onChange={(e) => {
                                                        setSdbPath(e.target.value);
                                                        localStorage.setItem('tizen_sdb_path', e.target.value);
                                                    }}
                                                />
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-indigo-500 group-focus-within:w-2/3 transition-all duration-300 opacity-50" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SSH Form */}
                                {mode === 'ssh' && !isQuickConnect && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Host IP</label>
                                                <div className="relative group">
                                                    <input
                                                        className="w-full bg-slate-950 text-slate-200 p-2.5 rounded-xl border border-slate-800 focus:border-indigo-500/50 focus:outline-none transition-all font-mono text-xs"
                                                        value={sshHost}
                                                        onChange={e => setSshHost(e.target.value)}
                                                        onKeyDown={e => e.stopPropagation()}
                                                        placeholder="192.168.1.xxx"
                                                    />
                                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-indigo-500 group-focus-within:w-2/3 transition-all duration-300 opacity-50" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Port</label>
                                                <div className="relative group">
                                                    <input
                                                        className="w-full bg-slate-950 text-slate-200 p-2.5 rounded-xl border border-slate-800 focus:border-indigo-500/50 focus:outline-none transition-all font-mono text-center text-xs"
                                                        value={sshPort}
                                                        onChange={e => setSshPort(e.target.value)}
                                                        onKeyDown={e => e.stopPropagation()}
                                                        placeholder="22"
                                                    />
                                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-indigo-500 group-focus-within:w-2/3 transition-all duration-300 opacity-50" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Username</label>
                                                <div className="relative group">
                                                    <input
                                                        className="w-full bg-slate-950 text-slate-200 p-2.5 rounded-xl border border-slate-800 focus:border-indigo-500/50 focus:outline-none transition-all font-mono text-xs"
                                                        value={sshUser}
                                                        onChange={e => setSshUser(e.target.value)}
                                                        onKeyDown={e => e.stopPropagation()}
                                                    />
                                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-indigo-500 group-focus-within:w-2/3 transition-all duration-300 opacity-50" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Password</label>
                                                <div className="relative group">
                                                    <input
                                                        type="password"
                                                        className="w-full bg-slate-950 text-slate-200 p-2.5 rounded-xl border border-slate-800 focus:border-indigo-500/50 focus:outline-none transition-all font-mono text-xs"
                                                        value={sshPassword}
                                                        onChange={e => setSshPassword(e.target.value)}
                                                        onKeyDown={e => e.stopPropagation()}
                                                        placeholder="••••••••"
                                                    />
                                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-indigo-500 group-focus-within:w-2/3 transition-all duration-300 opacity-50" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Test Simulation Form */}
                                {mode === 'test' && !isQuickConnect && (
                                    <div className="p-6 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700 text-center space-y-2">
                                        <div className="inline-flex p-2 bg-indigo-500/10 rounded-full">
                                            <RefreshCw size={20} className="text-indigo-400" />
                                        </div>
                                        <h3 className="text-slate-200 font-bold text-sm">Simulation Mode</h3>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            로컬 서버로부터 가상의 로그 스트림(초당 10라인)을 생성합니다.
                                        </p>
                                    </div>
                                )}

                                {/* Options */}
                                <div className="flex flex-col gap-2.5">
                                    <label className="flex items-center gap-2.5 text-[11px] font-bold text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors uppercase tracking-tight">
                                        <input
                                            type="checkbox"
                                            checked={debugMode}
                                            onKeyDown={e => e.stopPropagation()}
                                            onChange={e => setDebugMode(e.target.checked)}
                                            className="accent-indigo-500 w-3.5 h-3.5 rounded border-slate-700 bg-slate-800"
                                        />
                                        <span>Debug Mode (Server Save)</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 text-[11px] font-bold text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors uppercase tracking-tight">
                                        <input
                                            type="checkbox"
                                            checked={saveToFile}
                                            onKeyDown={e => e.stopPropagation()}
                                            onChange={e => setSaveToFile(e.target.checked)}
                                            className="accent-indigo-500 w-3.5 h-3.5 rounded border-slate-700 bg-slate-800"
                                        />
                                        <span>Auto Save to Local File</span>
                                    </label>
                                </div>
                            </div>

                            {/* Status Area - Compact */}
                            <div className="h-[60px] bg-slate-950/80 rounded-2xl px-5 flex flex-col items-center justify-center border border-slate-800 relative overflow-hidden group shrink-0">
                                {error ? (
                                    <div className="text-red-400 text-[10px] flex items-start gap-3 relative z-10 w-full">
                                        <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
                                        <span className="whitespace-pre-line text-left leading-tight">{error}</span>
                                    </div>
                                ) : (
                                    <span className={`text-indigo-400 text-[11px] font-mono flex items-center gap-3 relative z-10 ${effectiveStatus ? 'animate-pulse' : ''}`}>
                                        <Terminal size={12} /> {effectiveStatus || "TIZEN ENGINE READY"}
                                    </span>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none opacity-20" />
                            </div>
                        </div>
                    )}

                    {/* Connected State View */}
                    {effectiveIsConnected && (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                            <div className="bg-indigo-950/20 border border-indigo-500/20 p-6 rounded-2xl text-center w-full max-w-[340px] shadow-inner shadow-indigo-500/5">
                                <div className="flex justify-center mb-3">
                                    <div className="p-3 bg-indigo-500/10 rounded-full">
                                        <Wifi size={28} className="text-indigo-500 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-indigo-400 text-xs font-bold mb-2 uppercase tracking-widest">
                                    Active Log Stream
                                </h3>
                                <p className="text-[12px] text-slate-400 font-mono bg-slate-950/50 px-4 py-2 rounded-xl border border-slate-800">
                                    {currentConnectionInfo || (mode === 'ssh' ? `SSH: ${sshHost}` : `SDB: ${selectedDeviceId || 'Device'}`)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Main Button */}
                    <div className="shrink-0">
                        <button
                            onClick={effectiveIsConnected ? (onExternalDisconnect || handleDisconnect) : handleConnect}
                            disabled={isConnecting}
                            className={`w-full py-3.5 text-sm font-extrabold rounded-2xl shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${effectiveIsConnected ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40'}`}
                        >
                            {effectiveIsConnected ? (isConnecting ? 'DISCONNECTING...' : 'DISCONNECT SESSION') : (isConnecting ? 'CONNECT & START STREAM' : 'CONNECT & START STREAM')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TizenConnectionModal;
