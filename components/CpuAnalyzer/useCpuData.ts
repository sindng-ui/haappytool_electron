
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const URL = 'http://localhost:3003';

export interface ProcessData {
    pid: string;
    user: string;
    cpu: number;
    name: string;
}

export interface ThreadData {
    tid: string;
    user: string;
    cpu: number;
    name: string;
    stack?: string;
}

export interface CpuDataPoint {
    timestamp: number;
    total: number;
    processes: ProcessData[];
}

export interface MemoryDataPoint {
    timestamp: number;
    pss: number;
    gemrss: number;
    swap: number;
    gpu: number;
}

export const useCpuData = (deviceId: string) => {
    const [status, setStatus] = useState<string>('disconnected');
    const [data, setData] = useState<CpuDataPoint[]>([]);
    const [memoryData, setMemoryData] = useState<MemoryDataPoint[]>([]);
    const [processList, setProcessList] = useState<ProcessData[]>([]);
    const [threads, setThreads] = useState<ThreadData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [memoryStatus, setMemoryStatus] = useState<string>('idle');
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket = io(URL);
        socketRef.current = socket;

        console.log('Attempting to connect to CPU Socket at ' + URL);

        socket.on('connect', () => {
            console.log('CPU Socket connected with ID:', socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error('CPU Socket Connection Error:', err);
            setError('Connection Error: ' + err.message);
        });

        socket.on('cpu_status', (msg) => {
            console.log('Received cpu_status:', msg);
            setStatus(msg.message);
        });

        socket.on('cpu_error', (msg) => {
            console.error('Received cpu_error:', msg);
            setError(msg.message);
        });

        socket.on('cpu_data', (newData: CpuDataPoint) => {
            // console.log('Received cpu_data:', newData); // Too verbose
            setData(prev => {
                const updated = [...prev, newData];
                if (updated.length > 60) updated.shift(); // Keep last 60 seconds
                return updated;
            });
            setProcessList(newData.processes);
        });

        // Memory Events
        socket.on('memory_data', (newData: MemoryDataPoint) => {
            console.log('Received memory_data:', newData);
            setMemoryData(prev => {
                const updated = [...prev, newData];
                if (updated.length > 60) updated.shift();
                return updated;
            });
        });

        socket.on('memory_status', (msg) => {
            console.log('Received memory_status:', msg);
            setMemoryStatus(msg.message);
        });

        socket.on('memory_error', (msg) => {
            setError(msg.message);
        });


        socket.on('thread_data', (msg: { pid: string, threads: ThreadData[] }) => {
            console.log('Received thread_data:', msg);
            setThreads(msg.threads);
        });

        socket.on('call_stack_data', (msg: { pid: string, tid: string, stack: string }) => {
            console.log('Received stack for TID ' + msg.tid);
            setThreads(prev => prev.map(t =>
                t.tid === msg.tid ? { ...t, stack: msg.stack } : t
            ));
        });

        return () => {
            console.log('Disconnecting CPU Socket');
            socket.disconnect();
        };
    }, []);

    const startMonitoring = () => {
        if (socketRef.current) {
            console.log('Emitting start_cpu_monitoring for device:', deviceId);
            setData([]); // Clear old data
            socketRef.current.emit('start_cpu_monitoring', { deviceId });
        } else {
            console.error('Socket not initialized, cannot start monitoring');
        }
    };

    const stopMonitoring = () => {
        if (socketRef.current) {
            socketRef.current.emit('stop_cpu_monitoring');
        }
    };

    const startMemoryMonitoring = (appName: string, interval: number) => {
        if (socketRef.current) {
            setMemoryData([]);
            socketRef.current.emit('start_memory_monitoring', { deviceId, appName, interval });
        }
    };

    const stopMemoryMonitoring = () => {
        if (socketRef.current) {
            socketRef.current.emit('stop_memory_monitoring');
        }
    };

    const startThreadMonitoring = (pid: string) => {
        if (socketRef.current) {
            setThreads([]); // Clear old threads
            socketRef.current.emit('start_thread_monitoring', { deviceId, pid });
        }
    };

    const stopThreadMonitoring = () => {
        if (socketRef.current) {
            socketRef.current.emit('stop_thread_monitoring');
            setThreads([]);
        }
    };

    const getCallStack = (pid: string, tid: string) => {
        if (socketRef.current) {
            socketRef.current.emit('get_call_stack', { deviceId, pid, tid });
        }
    };

    return {
        status,
        data,
        memoryData,
        memoryStatus,
        processList,
        threads,
        error,
        startMonitoring,
        stopMonitoring,
        startMemoryMonitoring,
        stopMemoryMonitoring,
        startThreadMonitoring,
        stopThreadMonitoring,
        getCallStack
    };
};
