import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse, SavedRequest } from '../types';
import RequestSidebar from './PostTool/RequestSidebar';
import RequestEditor from './PostTool/RequestEditor';
import ResponseViewer from './PostTool/ResponseViewer';

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface PostToolProps {
    savedRequests: SavedRequest[];
    onUpdateRequests: (requests: SavedRequest[]) => void;
}

const PostTool: React.FC<PostToolProps> = ({ savedRequests, onUpdateRequests }) => {
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<PerfResponse | null>(null);

    const [currentRequest, setCurrentRequest] = useState<SavedRequest>({
        id: 'temp', name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: ''
    });

    useEffect(() => {
        if (activeRequestId) {
            const req = savedRequests.find(r => r.id === activeRequestId);
            if (req) {
                setCurrentRequest(JSON.parse(JSON.stringify(req)));
                setResponse(null);
            }
        }
    }, [activeRequestId]);

    useEffect(() => {
        if (activeRequestId && activeRequestId !== 'temp') {
            const updated = savedRequests.map(r => r.id === activeRequestId ? currentRequest : r);
            onUpdateRequests(updated);
        }
    }, [currentRequest]);

    const handleNewRequest = () => {
        const newId = generateUUID();
        const newReq: SavedRequest = {
            id: newId, name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: ''
        };
        onUpdateRequests([...savedRequests, newReq]);
        setActiveRequestId(newId);
        setCurrentRequest(newReq);
        setResponse(null);
    };

    const handleDeleteRequest = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const updated = savedRequests.filter(r => r.id !== id);
        onUpdateRequests(updated);
        if (activeRequestId === id) {
            if (updated.length > 0) setActiveRequestId(updated[0].id);
            else {
                setActiveRequestId(null);
                setCurrentRequest({ id: 'temp', name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: '' });
            }
        }
    };

    const handleSend = async () => {
        setLoading(true);
        setResponse(null);
        const startTime = performance.now();
        try {
            const headers: Record<string, string> = {};
            currentRequest.headers.forEach(h => { if (h.key.trim()) headers[h.key] = h.value; });
            const options: RequestInit = { method: currentRequest.method, headers };
            if (['POST', 'PUT', 'PATCH'].includes(currentRequest.method) && currentRequest.body) options.body = currentRequest.body;

            const res = await fetch(currentRequest.url, options);
            const endTime = performance.now();
            const contentType = res.headers.get("content-type");
            let data;
            if (contentType && contentType.indexOf("application/json") !== -1) data = await res.json().catch(() => ({ error: 'Could not parse JSON' }));
            else data = await res.text();

            const resHeaders: Record<string, string> = {};
            res.headers.forEach((val, key) => { resHeaders[key] = val; });

            setResponse({
                status: res.status, statusText: res.statusText, headers: resHeaders, data, timeTaken: Math.round(endTime - startTime),
            });
        } catch (error: any) {
            setResponse({
                status: 0, statusText: 'Network Error', headers: {}, data: { message: error.message }, timeTaken: 0
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Title Bar - Draggable Area */}
            <div className="h-16 w-full flex-shrink-0 title-drag z-50 flex items-center gap-3 pl-4 pr-36" style={{ backgroundColor: '#0f172a', borderBottom: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Lucide.Send size={16} /></div>
                <span className="font-bold text-sm text-slate-300 no-drag">POST Tool</span>
            </div>

            <div className="flex-1 flex min-h-0 bg-slate-950">
                <RequestSidebar
                    savedRequests={savedRequests}
                    activeRequestId={activeRequestId}
                    currentRequest={currentRequest}
                    onSelectRequest={setActiveRequestId}
                    onNewRequest={handleNewRequest}
                    onDeleteRequest={handleDeleteRequest}
                    onChangeCurrentRequest={setCurrentRequest}
                />
                <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
                    <RequestEditor
                        currentRequest={currentRequest}
                        onChangeCurrentRequest={setCurrentRequest}
                        onSend={handleSend}
                        loading={loading}
                    />
                    <ResponseViewer response={response} />
                </div>
            </div>
        </div>
    );
};

export default PostTool;
