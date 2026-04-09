import { useState, useEffect, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export interface EverythingResultItem {
    name: string;
    path: string;
    fullPath: string;
    type: 'file' | 'folder';
    size: string;
    dateModified: string;
}

export interface EverythingResults {
    total: number;
    items: EverythingResultItem[];
}

export const useEverythingSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<EverythingResults>({ total: 0, items: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    
    const socketRef = useRef<Socket | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Connect to the local server (assuming same port as current location for simplicity or fixed port 3000)
        const socket = io('http://localhost:3000');
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setError(null);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('everything_results', (data: EverythingResults) => {
            setResults(data);
            setLoading(false);
        });

        socket.on('everything_error', (err: { message: string }) => {
            setError(err.message);
            setLoading(false);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const performSearch = useCallback((searchTerm: string) => {
        if (!socketRef.current || !connected) return;

        if (!searchTerm.trim()) {
            setResults({ total: 0, items: [] });
            return;
        }

        setLoading(true);
        socketRef.current.emit('everything_search', {
            query: searchTerm,
            options: { offset: 0, count: 200 } // Fetch more results for better UX
        });
    }, [connected]);

    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            performSearch(query);
        }, 300); // 300ms debounce

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [query, performSearch]);

    const openFile = (fullPath: string) => {
        if (socketRef.current && connected) {
            socketRef.current.emit('everything_open_file', { fullPath });
        }
    };

    return {
        query,
        setQuery,
        results,
        loading,
        error,
        connected,
        openFile
    };
};
