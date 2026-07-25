import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse, SavedRequest, RequestGroup, PostGlobalVariable, EnvironmentProfile } from '../types';
import RequestSidebar from './PostTool/RequestSidebar';
import RequestEditor from './PostTool/RequestEditor';
import ResponseViewer from './PostTool/ResponseViewer';
import EnvironmentModal from './PostTool/EnvironmentModal';
import GlobalAuthModal from './PostTool/GlobalAuthModal';
import EnvironmentDropdown from './PostTool/EnvironmentDropdown';
import CodeSnippetModal from './PostTool/CodeSnippetModal';
import usePostToolResize from './PostTool/usePostToolResize';
import { PostGlobalAuth } from '../types';
import { ConfirmDialog } from './ui/CommonDialogs';

const { Shield, ShieldCheck, Terminal } = Lucide;


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
        postGlobalVariables: globalVariables, // Active variables
        setPostGlobalVariables: onUpdateGlobalVariables, // Update active
        envProfiles, // All profiles
        setEnvProfiles,
        activeEnvId,
        setActiveEnvId,
        postGlobalAuth: globalAuth,
        setPostGlobalAuth: onUpdateGlobalAuth,
        requestHistory,
        setRequestHistory
    } = useHappyTool();
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [dialogConfig, setDialogConfig] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [responseCache, setResponseCache] = useState<Map<string, PerfResponse>>(new Map());
    // Derived response for current view
    const response = activeRequestId ? responseCache.get(activeRequestId) || null : null;

    const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [showEnvDropdown, setShowEnvDropdown] = useState(false); // Dropdown state

    const [currentRequest, setCurrentRequest] = useState<SavedRequest>({
        id: 'temp', name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: ''
    });

    const [showCodeModal, setShowCodeModal] = useState(false);

    // Sidebar & Response Resizing Hook
    const {
        sidebarWidth,
        responseHeight,
        isResizingResponse,
        handleResizeStart,
        handleResponseResizeStart
    } = usePostToolResize();

    // ✅ Performance: Debounce request updates to avoid excessive re-renders during typing
    useEffect(() => {
        if (!activeRequestId || activeRequestId === 'temp') return;

        const timer = setTimeout(() => {
            const updated = savedRequests.map(r =>
                r.id === activeRequestId ? currentRequest : r
            );
            onUpdateRequests(updated);
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [currentRequest, activeRequestId]); // ✅ Removed savedRequests, onUpdateRequests to prevent infinite loop

    const handleNewRequest = (groupId?: string) => {
        const newId = generateUUID();
        const newReq: SavedRequest = {
            id: newId, name: 'New Request', method: 'GET', url: '',
            headers: [{ key: 'Authorization', value: 'Bearer ' }, { key: 'Accept', value: 'application/json' }, { key: '', value: '' }],
            body: '', groupId
        };
        onUpdateRequests([...savedRequests, newReq]);
        setActiveRequestId(newId);
        setCurrentRequest(newReq);
    };

    const handleDuplicateRequest = (e: React.MouseEvent, req: SavedRequest) => {
        e.stopPropagation();
        const newId = generateUUID();
        const newReq: SavedRequest = { ...req, id: newId, name: `${req.name} Copy`, groupId: req.groupId };
        onUpdateRequests([...savedRequests, newReq]);
        setActiveRequestId(newId);
        setCurrentRequest(newReq);
    };

    const handleDeleteRequest = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        
        setDialogConfig({
            title: 'Delete Request',
            description: 'Are you sure you want to delete this request?',
            confirmLabel: 'Delete',
            isDanger: true,
            onConfirm: () => {
                const newRequests = savedRequests.filter(r => r.id !== id);
                onUpdateRequests(newRequests);
                // Remove from cache
                setResponseCache(prev => {
                    const next = new Map(prev);
                    next.delete(id);
                    return next;
                });

                if (activeRequestId === id) {
                    setActiveRequestId(null);
                    setCurrentRequest({ id: 'temp', name: 'New Request', method: 'GET', url: '', headers: [{ key: '', value: '' }], body: '' });
                }
            }
        });
    };

    const replaceVariables = (str: string) => {
        let res = str;
        res = res.replace(/{{uuid}}/g, generateUUID());
        res = res.replace(/{{timestamp}}/g, Date.now().toString());

        if (envProfiles) {
            envProfiles.forEach(profile => {
                profile.variables.forEach(v => {
                    if (v.enabled) {
                        const pattern = `{{${profile.name}.${v.key}}}`;
                        res = res.split(pattern).join(v.value);
                    }
                });
            });
        }

        globalVariables.forEach(v => {
            if (v.enabled) res = res.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });

        return res;
    };

    const handleSend = async () => {
        setLoading(true);
        try {
            let finalUrl = replaceVariables(currentRequest.url);

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

            // Auth Injection
            const reqAuth = currentRequest.auth;
            if (reqAuth && reqAuth.type !== 'none') {
                if (reqAuth.type === 'bearer' && reqAuth.bearerToken) {
                    finalHeaders['Authorization'] = `Bearer ${replaceVariables(reqAuth.bearerToken)}`;
                } else if (reqAuth.type === 'basic' && (reqAuth.basicUsername || reqAuth.basicPassword)) {
                    const u = replaceVariables(reqAuth.basicUsername || '');
                    const p = replaceVariables(reqAuth.basicPassword || '');
                    finalHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                }
            } else if (globalAuth && globalAuth.enabled && globalAuth.type !== 'none') {
                if (globalAuth.type === 'bearer' && globalAuth.bearerToken) {
                    finalHeaders['Authorization'] = `Bearer ${replaceVariables(globalAuth.bearerToken)}`;
                } else if (globalAuth.type === 'basic' && (globalAuth.basicUsername || globalAuth.basicPassword)) {
                    const u = replaceVariables(globalAuth.basicUsername || '');
                    const p = replaceVariables(globalAuth.basicPassword || '');
                    finalHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                } else if (globalAuth.type === 'apikey' && globalAuth.apiKeyKey && globalAuth.apiKeyValue && globalAuth.apiKeyAddTo !== 'query') {
                    finalHeaders[replaceVariables(globalAuth.apiKeyKey)] = replaceVariables(globalAuth.apiKeyValue);
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
            let newResponse: PerfResponse;

            if (window.electronAPI && window.electronAPI.proxyRequest) {
                // Use Electron Proxy (Bypass CORS)
                const res = await window.electronAPI.proxyRequest({
                    method: currentRequest.method,
                    url: finalUrl,
                    headers: finalHeaders,
                    body: ['GET', 'HEAD'].includes(currentRequest.method) ? undefined : finalBody
                });

                if (res.error) {
                    const endTime = performance.now();
                    newResponse = {
                        status: 0,
                        statusText: 'Network / Proxy Error',
                        headers: {},
                        data: res.message || 'Proxy Request Failed',
                        timeTaken: endTime - startTime
                    };
                } else {
                    const endTime = performance.now();
                    newResponse = {
                        status: res.status,
                        statusText: res.statusText,
                        headers: res.headers || {},
                        data: res.data,
                        timeTaken: endTime - startTime
                    };
                }
            } else {
                // Browser Fetch (Subject to CORS)
                const res = await fetch(finalUrl, {
                    method: currentRequest.method,
                    headers: finalHeaders,
                    body: ['GET', 'HEAD'].includes(currentRequest.method) ? undefined : finalBody
                });
                const endTime = performance.now();

                let data;
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    try {
                        data = await res.json();
                    } catch {
                        data = await res.text();
                    }
                } else {
                    data = await res.text();
                }

                newResponse = {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers.entries()),
                    data,
                    timeTaken: endTime - startTime
                };
            }

            // ✅ Performance: Improved LRU cache update
            setResponseCache(prev => {
                // Delete and re-insert to maintain LRU order
                if (activeRequestId && prev.has(activeRequestId)) {
                    prev.delete(activeRequestId);
                }

                // Add new/updated response (becomes most recent)
                const next = new Map(prev);
                if (activeRequestId) {
                    next.set(activeRequestId, newResponse);

                    // LRU Limit: 10 (evict oldest)
                    if (next.size > 10) {
                        const firstKey = next.keys().next().value;
                        if (firstKey) next.delete(firstKey);
                    }
                }
                return next;
            });

        } catch (error: any) {
            const errorResponse = {
                status: 0,
                statusText: 'Error',
                headers: {},
                data: error.message,
                timeTaken: 0
            };
            setResponseCache(prev => {
                const next = new Map(prev);
                if (activeRequestId) next.set(activeRequestId, errorResponse);
                return next;
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
            // No need to clear response, it will be derived from cache
        }
    };



    return (
        <div className="flex flex-col h-full bg-[#0b0f19] overflow-hidden transition-colors duration-300">
            {/* Consistent System Header */}
            <div className="h-16 shrink-0 title-drag pl-16 pr-36 flex items-center justify-between border-b border-indigo-500/30 bg-[#0f172a]">
                {/* Brand Area */}
                <div className="flex items-center gap-3 no-drag">
                    <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400"><Lucide.Send size={14} className="icon-glow" /></div>
                    <span className="font-bold text-xs text-slate-200">Post Tool</span>
                </div>

                {/* Actions Area */}
                <div className="flex items-center gap-1 no-drag mr-40">
                    {/* Environment Modal */}
                    {onUpdateGlobalVariables && (
                        <EnvironmentModal
                            isOpen={isEnvModalOpen}
                            onClose={() => setIsEnvModalOpen(false)}
                            variables={globalVariables}
                            onUpdateVariables={onUpdateGlobalVariables}
                        />
                    )}

                    {/* Environment Switcher */}
                    <EnvironmentDropdown
                        showEnvDropdown={showEnvDropdown}
                        setShowEnvDropdown={setShowEnvDropdown}
                        envProfiles={envProfiles}
                        activeEnvId={activeEnvId || ''}
                        setActiveEnvId={setActiveEnvId}
                        onOpenManageModal={() => setIsEnvModalOpen(true)}
                    />

                    <div className="w-px h-8 bg-white/5 mx-2" />

                    {/* Global Auth Button */}
                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${globalAuth?.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/20'
                            : 'bg-transparent border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
                            }`}
                        title="Configure Global Auth"
                    >
                        <div className="relative">
                            {globalAuth?.enabled ? <ShieldCheck size={16} /> : <Shield size={16} />}
                            {globalAuth?.enabled && <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
                        </div>
                        <span className="text-xs font-bold hidden sm:inline">Auth</span>
                    </button>

                    {/* Code Button */}
                    <button
                        onClick={() => setShowCodeModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/5"
                        title="Generate Code Snippet"
                    >
                        <Terminal size={16} />
                        <span className="text-xs font-bold hidden lg:inline">Code</span>
                    </button>
                </div>
            </div>

            <div className="flex w-full h-full bg-[#0b0f19] text-slate-100 font-sans">
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
                            // Response will be derived from cache (no cached response = null)
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
                                envProfiles={envProfiles} // Pass all profiles
                                activeEnvId={activeEnvId}
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

            {/* Code Snippet Modal */}
            <CodeSnippetModal
                isOpen={showCodeModal}
                onClose={() => setShowCodeModal(false)}
                currentRequest={currentRequest}
                envProfiles={envProfiles}
                globalVariables={globalVariables}
                globalAuth={globalAuth}
            />
            
            {dialogConfig && (
                <ConfirmDialog 
                    isOpen={true}
                    onClose={() => setDialogConfig(null)}
                    title={dialogConfig.title}
                    description={dialogConfig.description}
                    confirmLabel={dialogConfig.confirmLabel}
                    isDanger={dialogConfig.isDanger}
                    onConfirm={dialogConfig.onConfirm}
                />
            )}
        </div>
    );
};

export default PostTool;
