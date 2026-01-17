import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse, SavedRequest, RequestGroup, PostGlobalVariable } from '../types';
import RequestSidebar from './PostTool/RequestSidebar';
import RequestEditor from './PostTool/RequestEditor';
import ResponseViewer from './PostTool/ResponseViewer';
import EnvironmentModal from './PostTool/EnvironmentModal';
import GlobalAuthModal from './PostTool/GlobalAuthModal'; // Added
import { PostGlobalAuth } from '../types';

const { Send, Shield, ShieldCheck, ShieldAlert } = Lucide; // Use these icons


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
        setPostGlobalVariables: onUpdateGlobalVariables,
        postGlobalAuth: globalAuth, // From Context
        setPostGlobalAuth: onUpdateGlobalAuth,
        requestHistory,
        setRequestHistory
    } = useHappyTool();
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<PerfResponse | null>(null);
    const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); // Auth Modal State

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
    const [responseHeight, setResponseHeight] = useState(() => {
        const saved = localStorage.getItem('postToolResponseHeight');
        return saved ? parseInt(saved, 10) : 300;
    });
    const responseHeightRef = React.useRef(responseHeight);
    const [isResizingResponse, setIsResizingResponse] = useState(false);

    // Sync ref
    useEffect(() => {
        responseHeightRef.current = responseHeight;
    }, [responseHeight]);

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
                // Use ref to get latest height without re-binding effect
                localStorage.setItem('postToolResponseHeight', responseHeightRef.current.toString());
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [sidebarWidth, isResizingResponse]); // No dependency on responseHeight needed now for saving

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
            let finalUrl = replaceVariables(currentRequest.url); // Changed to let

            // Apply Global Auth Query Params Logic
            if (globalAuth && globalAuth.enabled && globalAuth.type === 'apikey' && globalAuth.apiKeyAddTo === 'query' && globalAuth.apiKeyKey && globalAuth.apiKeyValue) {
                const reqAuthType = currentRequest.auth?.type || 'none';
                if (reqAuthType === 'none') {
                    const key = replaceVariables(globalAuth.apiKeyKey);
                    const val = replaceVariables(globalAuth.apiKeyValue);
                    const separator = finalUrl.includes('?') ? '&' : '?';
                    finalUrl += `${separator}${key}=${encodeURIComponent(val)}`;
                }
            }

            const finalHeaders = currentRequest.headers.reduce((acc, h) => {
                if (h.key) acc[replaceVariables(h.key)] = replaceVariables(h.value);
                return acc;
            }, {} as any);
            let finalBody = currentRequest.body ? replaceVariables(currentRequest.body) : undefined;

            // --- Request Auth Injection ---
            const reqAuth = currentRequest.auth;
            if (reqAuth && reqAuth.type !== 'none') {
                if (reqAuth.type === 'bearer' && reqAuth.bearerToken) {
                    finalHeaders['Authorization'] = `Bearer ${replaceVariables(reqAuth.bearerToken)}`;
                } else if (reqAuth.type === 'basic' && (reqAuth.basicUsername || reqAuth.basicPassword)) {
                    const u = replaceVariables(reqAuth.basicUsername || '');
                    const p = replaceVariables(reqAuth.basicPassword || '');
                    finalHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                }
            }

            // --- Global Auth Injection ---
            // Only apply if Request Auth is None
            if ((!reqAuth || reqAuth.type === 'none') && globalAuth && globalAuth.enabled && globalAuth.type !== 'none') {
                // ... existing global auth logic ...
                if (globalAuth.type === 'bearer' && globalAuth.bearerToken) {
                    finalHeaders['Authorization'] = `Bearer ${replaceVariables(globalAuth.bearerToken)}`;
                } else if (globalAuth.type === 'basic' && (globalAuth.basicUsername || globalAuth.basicPassword)) {
                    const u = replaceVariables(globalAuth.basicUsername || '');
                    const p = replaceVariables(globalAuth.basicPassword || '');
                    finalHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                } else if (globalAuth.type === 'apikey' && globalAuth.apiKeyKey && globalAuth.apiKeyValue) {
                    const key = replaceVariables(globalAuth.apiKeyKey);
                    const val = replaceVariables(globalAuth.apiKeyValue);
                    if (globalAuth.apiKeyAddTo === 'query') {
                        // Already handled above
                    } else {
                        finalHeaders[key] = val;
                    }
                }
            }

            // Add to History
            if (setRequestHistory) {
                const historyItem: any = { // Cast to avoid TS issues until import fixed if needed, but RequestHistoryItem is in types
                    ...currentRequest,
                    executedAt: Date.now()
                };
                setRequestHistory(prev => [historyItem, ...prev].slice(0, 50));
            }

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
                <span className="font-bold text-xs text-slate-200 no-drag mr-4">Post Tool</span>

                {/* Global Auth Button */}
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className={`no-drag flex items-center gap-2 px-2 py-1 rounded-md text-xs font-bold transition-all border ${globalAuth?.enabled
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                        }`}
                    title="Configure Global Auth"
                >
                    {globalAuth?.enabled ? <ShieldCheck size={12} /> : <Shield size={12} />}
                    <span className="hidden sm:inline">Auth Helper</span>
                    {globalAuth?.enabled && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
                </button>
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
                        requestHistory={requestHistory}
                        onSelectHistory={(item) => {
                            setActiveRequestId(null);
                            setCurrentRequest({ ...item, id: generateUUID() }); // Clone as new
                            setResponse(null);
                        }}
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
                                globalAuth={globalAuth} // Pass globalAuth
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

                {/* Global Auth Modal */}
                {onUpdateGlobalAuth && globalAuth && (
                    <GlobalAuthModal
                        isOpen={isAuthModalOpen}
                        onClose={() => setIsAuthModalOpen(false)}
                        auth={globalAuth}
                        onChange={onUpdateGlobalAuth}
                        variables={globalVariables}
                    />
                )}
            </div>
        </div>
    );
};

export default PostTool;
