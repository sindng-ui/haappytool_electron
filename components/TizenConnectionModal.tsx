import React, { useState, useEffect } from 'react';
import { X, Server, Terminal, RefreshCw, Wifi, Usb, ShieldAlert } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface TizenConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStreamStart: (socket: Socket, deviceName: string) => void;
}

const TizenConnectionModal: React.FC<TizenConnectionModalProps> = ({ isOpen, onClose, onStreamStart }) => {
    const [mode, setMode] = useState<'ssh' | 'sdb'>('sdb');
    const [socket, setSocket] = useState<Socket | null>(null);

    // SSH State
    const [sshHost, setSshHost] = useState('');
    const [sshPort, setSshPort] = useState('22');
    const [sshUser, setSshUser] = useState('root');
    const [sshPassword, setSshPassword] = useState('');
    // const [sshKeyPath, setSshKeyPath] = useState(''); // Removed per request

    // SDB State
    const [sdbDevices, setSdbDevices] = useState<{ id: string, type: string }[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    // Connection Status
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (isOpen && !socket) {
            const newSocket = io('http://localhost:3001');

            newSocket.on('connect', () => {
                setStatus('Connected to Local Log Server');
                setError('');
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
                setStatus(data.message);
                if (data.status === 'connected') {
                    setIsConnected(true);
                    onStreamStart(newSocket, `SSH:${sshHost}`);
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                }
                setIsConnecting(false);
            });

            newSocket.on('ssh_error', (data) => {
                setError(data.message);
                setIsConnecting(false);
            });

            newSocket.on('sdb_status', (data) => {
                setStatus(data.message);
                if (data.status === 'connected') {
                    setIsConnected(true);
                    onStreamStart(newSocket, `SDB:${selectedDeviceId || 'Default'}`);
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                }
                setIsConnecting(false);
            });

            newSocket.on('sdb_error', (data) => {
                setError(data.message);
                setIsConnecting(false);
            });

            newSocket.on('debug_log', (msg) => {
                // Should show toast or console log
                console.log('[Server Debug]', msg);
            });

            setSocket(newSocket);
        }

        return () => {
            // Don't disconnect here, we pass the socket to parent
        };
    }, [isOpen]);

    const handleScanSdb = () => {
        if (socket) {
            setIsScanning(true);
            setSdbDevices([]);
            socket.emit('list_sdb_devices');
        }
    };

    // SDB Remote State
    const [sdbRemoteIp, setSdbRemoteIp] = useState('');

    const handleSdbRemoteConnect = () => {
        if (socket && sdbRemoteIp) {
            setStatus(`Connecting to ${sdbRemoteIp}...`);
            socket.emit('connect_sdb_remote', { ip: sdbRemoteIp });
        }
    };

    useEffect(() => {
        if (socket) {
            socket.on('sdb_remote_result', (data) => {
                if (data.success) {
                    setStatus(data.message);
                    handleScanSdb(); // Refresh list automatically
                    setSdbRemoteIp(''); // Clear input
                } else {
                    setError(data.message);
                    setStatus('');
                }
            });
        }
    }, [socket]);

    const handleConnect = () => {
        if (!socket) return;
        setError('');
        setIsConnecting(true);

        if (mode === 'ssh') {
            socket.emit('connect_ssh', {
                host: sshHost,
                port: parseInt(sshPort),
                username: sshUser,
                password: sshPassword,
                debug: debugMode
            });
        } else {
            socket.emit('connect_sdb', { deviceId: selectedDeviceId, debug: debugMode });
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
                    {/* Mode Selection */}
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
                    </div>

                    {/* SDB Form */}
                    {mode === 'sdb' && (
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
                            <div className="pt-4 border-t border-slate-700">
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Remote Connection (IP)</label>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-slate-800 text-slate-200 p-2 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none placeholder-slate-600"
                                        placeholder="192.168.1.xxx"
                                        value={sdbRemoteIp}
                                        onChange={(e) => setSdbRemoteIp(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSdbRemoteConnect()}
                                    />
                                    <button
                                        onClick={handleSdbRemoteConnect}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-sm transition-colors"
                                    >
                                        Connect IP
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SSH Form */}
                    {mode === 'ssh' && (
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

                    {/* Options (Debug) */}
                    <div className="mt-4 flex items-center">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer select-none hover:text-slate-300">
                            <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} className="accent-indigo-500 w-4 h-4 rounded border-slate-700 bg-slate-800" />
                            <span>Enable Debug Mode (Save logs to server)</span>
                        </label>
                    </div>

                    {/* Status Area */}
                    <div className="mt-4 bg-slate-950 rounded-lg p-3 min-h-[60px] flex items-start justify-center text-sm border border-slate-800">
                        {error ? (
                            <div className="text-red-400 flex items-start gap-2">
                                <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                                <span className="whitespace-pre-line text-left">{error}</span>
                            </div>
                        ) : status ? (
                            <span className="text-indigo-400 flex items-center gap-2"><Terminal size={16} /> {status}</span>
                        ) : (
                            <span className="text-slate-600 italic">Ready to connect...</span>
                        )}
                    </div>

                    {!isConnected ? (
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className={`w-full mt-4 py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-900/50 transition-all ${isConnecting ? 'bg-slate-700 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02]'}`}
                        >
                            {isConnecting ? 'Connecting...' : 'Connect & Start Stream'}
                        </button>
                    ) : (
                        <button
                            onClick={handleDisconnect}
                            disabled={isConnecting}
                            className={`w-full mt-4 py-3 rounded-xl font-bold text-white shadow-lg shadow-red-900/50 transition-all ${isConnecting ? 'bg-slate-700 cursor-wait' : 'bg-red-600 hover:bg-red-500 hover:scale-[1.02]'}`}
                        >
                            {isConnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    )}
                    {!socket && <p className="text-center text-xs text-slate-500 mt-2">Connecting to local log server...</p>}
                </div>
            </div>
        </div >
    );
};

export default TizenConnectionModal;
