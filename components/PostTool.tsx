import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse, SavedRequest, RequestGroup, PostGlobalVariable } from '../types';
import RequestSidebar from './PostTool/RequestSidebar';
import RequestEditor from './PostTool/RequestEditor';
import ResponseViewer from './PostTool/ResponseViewer';
import EnvironmentModal from './PostTool/EnvironmentModal';

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

import { useHappyTool } from '../contexts/HappyToolContext';
// ... imports

// ... generateUUID

const PostTool: React.FC = () => {
    const {
        savedRequests,
        setSavedRequests: onUpdateRequests,
        savedRequestGroups,
        setSavedRequestGroups: onUpdateGroups,
        postGlobalVariables: globalVariables,
        setPostGlobalVariables: onUpdateGlobalVariables
    } = useHappyTool();
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<PerfResponse | null>(null);
    const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);

    const [currentRequest, setCurrentRequest] = useState<SavedRequest>({
        id: 'temp', name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: ''
    });

    // Sidebar Resizing
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('postToolSidebarWidth');
        return saved ? parseInt(saved, 10) : 256;
    });
    const isResizing = React.useRef(false);

    // Response Resizing
    const [responseHeight, setResponseHeight] = useState(300);
    const [isResizingResponse, setIsResizingResponse] = useState(false);

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isResizing.current) {
                const newWidth = Math.max(200, Math.min(600, e.clientX - 80)); // 80 is sidebar offset
                setSidebarWidth(newWidth);
                return;
            }
            if (isResizingResponse) {
                const newHeight = Math.max(100, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY));
                setResponseHeight(newHeight);
            }
        };

        const handleGlobalMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                localStorage.setItem('postToolSidebarWidth', sidebarWidth.toString());
                document.body.style.cursor = 'default';
            }
            if (isResizingResponse) {
                setIsResizingResponse(false);
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [sidebarWidth, isResizingResponse]);

    const handleResizeStart = () => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
    };

    const handleResponseResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingResponse(true);
        document.body.style.cursor = 'row-resize';
    };

    const handleMouseMove = () => { };
    const handleMouseUp = () => { };

    useEffect(() => {
        if (activeRequestId && activeRequestId !== 'temp') {
            const updated = savedRequests.map(r => r.id === activeRequestId ? currentRequest : r);
            onUpdateRequests(updated);
        }
    }, [currentRequest]);

    const handleNewRequest = (groupId?: string) => {
        const newId = generateUUID();
        const newReq: SavedRequest = {
            id: newId,
            name: 'New Request',
            method: 'GET',
            url: '',
            headers: [
                { key: 'Authorization', value: 'Bearer ' },
                { key: 'Accept', value: 'application/json' },
                { key: '', value: '' }
            ],
            body: '',
            groupId: groupId
        };
        onUpdateRequests([...savedRequests, newReq]);
        setActiveRequestId(newId);
        setCurrentRequest(newReq);
        setResponse(null);
    };

    const handleDuplicateRequest = (e: React.MouseEvent, req: SavedRequest) => {
        e.stopPropagation();
        const newId = generateUUID();
        const newReq: SavedRequest = {
            ...req,
            id: newId,
            name: `${req.name} Copy`,
            groupId: req.groupId // Keep same group
        };
        onUpdateRequests([...savedRequests, newReq]);
        setActiveRequestId(newId);
        setCurrentRequest(newReq);
        setResponse(null);
    };

    const handleDeleteRequest = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this request?')) {
            const newRequests = savedRequests.filter(r => r.id !== id);
            onUpdateRequests(newRequests);
            if (activeRequestId === id) {
                setActiveRequestId(null);
                setCurrentRequest({ id: 'temp', name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: '' });
                setResponse(null);
            }
        }
    };

    const replaceVariables = (str: string) => {
        let result = str;
        globalVariables.forEach(v => {
            if (v.enabled) {
                result = result.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
            }
        });
        return result;
    };

    const handleSend = async () => {
        setLoading(true);
        setResponse(null);
        try {
            const finalUrl = replaceVariables(currentRequest.url);
            const finalHeaders = currentRequest.headers.reduce((acc, h) => {
                if (h.key) acc[replaceVariables(h.key)] = replaceVariables(h.value);
                return acc;
            }, {} as any);
            const finalBody = currentRequest.body ? replaceVariables(currentRequest.body) : undefined;

            const startTime = performance.now();
            const res = await fetch(finalUrl, {
                method: currentRequest.method,
                headers: finalHeaders,
                body: ['GET', 'HEAD'].includes(currentRequest.method) ? undefined : finalBody
            });
            const endTime = performance.now();

            let data;
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await res.json();
            } else {
                data = await res.text();
            }

            setResponse({
                status: res.status,
                statusText: res.statusText,
                headers: Object.fromEntries(res.headers.entries()),
                data,
                timeTaken: endTime - startTime
            });
        } catch (error: any) {
            setResponse({
                status: 0,
                statusText: 'Error',
                headers: {},
                data: error.message,
                timeTaken: 0
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRequest = (id: string) => {
        const req = savedRequests.find(r => r.id === id);
        if (req) {
            setActiveRequestId(id);
            setCurrentRequest(req);
            setResponse(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* Title Bar - Draggable Area */}
            <div className="h-9 w-full flex-shrink-0 title-drag z-20 flex items-center gap-3 pl-4 pr-36 border-b border-indigo-500/30 bg-slate-900">
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Lucide.Send size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200 no-drag">Post Tool</span>
            </div>

            <div className="flex w-full h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
                <div className="flex-1 flex min-w-0 relative">
                    <RequestSidebar
                        width={sidebarWidth}
                        onResizeStart={handleResizeStart}
                        savedRequests={savedRequests}
                        activeRequestId={activeRequestId}
                        currentRequest={currentRequest}
                        onSelectRequest={handleSelectRequest}
                        onNewRequest={handleNewRequest}
                        onDeleteRequest={handleDeleteRequest}
                        onDuplicateRequest={handleDuplicateRequest}
                        onChangeCurrentRequest={setCurrentRequest}
                        onUpdateRequests={onUpdateRequests}
                        savedRequestGroups={savedRequestGroups}
                        onUpdateGroups={onUpdateGroups}
                        onOpenSettings={() => setIsEnvModalOpen(true)}
                    />

                    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 z-0 relative">
                        {/* Request Editor Area (Flex 1 to take remaining space) */}
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            <RequestEditor
                                currentRequest={currentRequest}
                                onChangeCurrentRequest={setCurrentRequest}
                                onSend={handleSend}
                                loading={loading}
                                globalVariables={globalVariables}
                            />
                        </div>

                        {/* Resize Handle */}
                        <div
                            className={`h-1 hover:h-1.5 cursor-row-resize bg-slate-200 dark:bg-white/5 hover:bg-indigo-500/50 transition-all z-20 flex items-center justify-center shrink-0 ${isResizingResponse ? 'bg-indigo-500/50 h-1.5' : ''}`}
                            onMouseDown={handleResponseResizeStart}
                        >
                            <div className="w-8 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                        </div>

                        {/* Response Panel */}
                        <div style={{ height: responseHeight }} className="flex flex-col min-h-0 border-t border-slate-200 dark:border-white/5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                            <div className="h-10 border-b border-slate-200 dark:border-white/5 flex items-center px-4 bg-slate-50 dark:bg-slate-900 shrink-0">
                                <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Response</span>
                                <div className="ml-auto flex items-center gap-2">
                                    {response && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${response.status >= 200 && response.status < 300 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {response.status} {response.statusText}
                                        </span>
                                    )}
                                    {response && (
                                        <span className="text-xs text-slate-400 font-mono">
                                            {response.timeTaken.toFixed(0)}ms
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ResponseViewer response={response} />
                        </div>
                    </div>
                </div>

                {/* Environment Modal */}
                {onUpdateGlobalVariables && (
                    <EnvironmentModal
                        isOpen={isEnvModalOpen}
                        onClose={() => setIsEnvModalOpen(false)}
                        variables={globalVariables}
                        onUpdateVariables={onUpdateGlobalVariables}
                    />
                )}
            </div>
        </div>
    );
};

export default PostTool;
