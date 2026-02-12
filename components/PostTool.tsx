import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { PerfResponse, SavedRequest, RequestGroup, PostGlobalVariable, EnvironmentProfile } from '../types';
import RequestSidebar from './PostTool/RequestSidebar';
import RequestEditor from './PostTool/RequestEditor';
import ResponseViewer from './PostTool/ResponseViewer';
import EnvironmentModal from './PostTool/EnvironmentModal';
import GlobalAuthModal from './PostTool/GlobalAuthModal'; // Added
import { PostGlobalAuth } from '../types';

const { Send, Shield, ShieldCheck, ShieldAlert, ChevronDown, Check, Terminal, Copy, X } = Lucide;


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
    const [codeLanguage, setCodeLanguage] = useState<'CURL' | 'FETCH' | 'PYTHON' | 'NODE'>('CURL');

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

    // Sync ref for sidebar width to avoid re-binding listeners
    const sidebarWidthRef = useRef(sidebarWidth);
    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
        responseHeightRef.current = responseHeight; // Ensure this is also synced if not already
    }, [sidebarWidth, responseHeight]);

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
                localStorage.setItem('postToolSidebarWidth', sidebarWidthRef.current.toString());
                document.body.style.cursor = 'default';
            }
            if (isResizingResponse) {
                setIsResizingResponse(false);
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
    }, [isResizingResponse]); // Removed sidebarWidth dependency, isResizingResponse triggers mode change so re-bind is acceptable or use Ref for that too


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
        // Do not clear response cache
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
        // Do not clear response cache
    };

    const handleDeleteRequest = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this request?')) {
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
    };

    // Variable Replacement Logic
    const replaceVariables = (str: string) => {
        let res = str;

        // 1. UUID & Timestamp (Special Vars)
        res = res.replace(/{{uuid}}/g, generateUUID());
        res = res.replace(/{{timestamp}}/g, Date.now().toString());

        // 2. Cross-Profile Reference: {{ProfileName.Key}}
        // We iterate all profiles to find matches
        if (envProfiles) {
            envProfiles.forEach(profile => {
                profile.variables.forEach(v => {
                    if (v.enabled) {
                        // Case-insensitive match for Profile Name? No, strict is better for now.
                        // But commonly vars are distinct.
                        // Let's support {{ProfileName.Key}}
                        const pattern = `{{${profile.name}.${v.key}}}`;
                        // Simple replaceAll equivalent
                        res = res.split(pattern).join(v.value);
                    }
                });
            });
        }

        // 3. Active Profile Variables: {{Key}} (Legacy/Default)
        // This takes precedence if collision? No, active profile is usually implicit.
        // If I write {{Token}}, it looks in Active Profile.
        globalVariables.forEach(v => {
            if (v.enabled) res = res.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });

        return res;
    };

    const handleSend = async () => {
        setLoading(true);
        // Don't clear response immediately for cache, but maybe clear FOR CURRENT VIEW?
        // Actually typical UX is show loading over old response or clear. 
        // Let's clear current ID from cache to show loading state if we want strict loading.
        // But better UX: Keep old response visible until simplified loading spinner overlays?
        // For now, let's just clear specific cache entry effectively by setting it to null or handling loading state in UI.
        // We already have 'loading' state which overlays/disables button. We can just keep old response until new one arrives.

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
                    throw new Error(res.message || 'Proxy Request Failed');
                }

                const endTime = performance.now();
                newResponse = {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                    data: res.data,
                    timeTaken: endTime - startTime
                };
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

    const replaceVars = (str: string) => {
        let res = str;
        // Cross-Profile Reference
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
        // Active Profile
        globalVariables.forEach(v => {
            if (v.enabled) res = res.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });
        return res;
    };

    const generateCode = (lang: typeof codeLanguage) => {
        const method = currentRequest.method;
        let url = replaceVars(currentRequest.url);
        const headers = currentRequest.headers.filter(h => h.key && h.value).reduce((acc, h) => {
            acc[replaceVars(h.key)] = replaceVars(h.value);
            return acc;
        }, {} as Record<string, string>);
        const body = currentRequest.body && ['POST', 'PUT', 'PATCH'].includes(method) ? replaceVars(currentRequest.body) : '';

        // Apply Request Auth
        const reqAuth = currentRequest.auth;
        if (reqAuth && reqAuth.type !== 'none') {
            if (reqAuth.type === 'bearer' && reqAuth.bearerToken) {
                headers['Authorization'] = `Bearer ${replaceVars(reqAuth.bearerToken)}`;
            } else if (reqAuth.type === 'basic' && (reqAuth.basicUsername || reqAuth.basicPassword)) {
                const u = replaceVars(reqAuth.basicUsername || '');
                const p = replaceVars(reqAuth.basicPassword || '');
                headers['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
            }
        }

        // Apply Global Auth Fallback
        if ((!reqAuth || reqAuth.type === 'none') && globalAuth && globalAuth.enabled && globalAuth.type !== 'none') {
            if (globalAuth.type === 'bearer' && globalAuth.bearerToken) {
                headers['Authorization'] = `Bearer ${replaceVars(globalAuth.bearerToken)}`;
            } else if (globalAuth.type === 'basic' && (globalAuth.basicUsername || globalAuth.basicPassword)) {
                const u = replaceVars(globalAuth.basicUsername || '');
                const p = replaceVars(globalAuth.basicPassword || '');
                headers['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
            } else if (globalAuth.type === 'apikey' && globalAuth.apiKeyKey && globalAuth.apiKeyValue) {
                const key = replaceVars(globalAuth.apiKeyKey);
                const val = replaceVars(globalAuth.apiKeyValue);
                if (globalAuth.apiKeyAddTo === 'query') {
                    const separator = url.includes('?') ? '&' : '?';
                    url += `${separator}${key}=${encodeURIComponent(val)}`;
                } else {
                    headers[key] = val;
                }
            }
        }

        switch (lang) {
            case 'CURL': {
                let cmd = `curl -X ${method} '${url}'`;
                Object.entries(headers).forEach(([k, v]) => { cmd += ` \\\n  -H '${k}: ${v}'`; });
                if (body) cmd += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
                return cmd;
            }
            case 'FETCH': {
                const options: any = { method };
                if (Object.keys(headers).length) options.headers = headers;
                if (body) options.body = body;
                return `fetch('${url}', ${JSON.stringify(options, null, 2)})`;
            }
            case 'PYTHON': {
                let code = `import requests\n\nurl = "${url}"\n`;
                if (Object.keys(headers).length) code += `headers = ${JSON.stringify(headers, null, 4)}\n`;
                if (body) code += `data = ${JSON.stringify(body)}\n`;
                code += `response = requests.${method.toLowerCase()}(url${Object.keys(headers).length ? ', headers=headers' : ''}${body ? ', data=data' : ''})\n`;
                code += `print(response.text)`;
                return code;
            }
            case 'NODE': {
                return `const axios = require('axios');\n\nconst options = {\n  method: '${method}',\n  url: '${url}',\n  headers: ${JSON.stringify(headers, null, 2)}${body ? `,\n  data: ${JSON.stringify(body)}` : ''}\n};\n\naxios.request(options).then(function (response) {\n  console.log(response.data);\n}).catch(function (error) {\n  console.error(error);\n});`;
            }
            default: return '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0b0f19] overflow-hidden transition-colors duration-300">
            {/* Consistent System Header */}
            <div className="h-9 shrink-0 title-drag pl-4 pr-36 flex items-center justify-between border-b border-indigo-500/30 bg-[#0f172a]">
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
                    <div className="relative">
                        <button
                            onClick={() => setShowEnvDropdown(!showEnvDropdown)}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/30 transition-all group min-w-[180px] justify-between"
                            title="Switch Active Environment"
                        >
                            <div className="flex flex-col items-start">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-indigo-400 transition-colors">Environment</span>
                                <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">
                                    {envProfiles?.find(p => p.id === activeEnvId)?.name || 'Default'}
                                </span>
                            </div>
                            <ChevronDown size={14} className={`text-slate-500 group-hover:text-slate-300 transition-transform ${showEnvDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showEnvDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowEnvDropdown(false)}></div>
                                <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl z-50 py-1 flex flex-col overflow-hidden ring-1 ring-black/50">
                                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/30">Select Environment</div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                                        {envProfiles?.map(profile => (
                                            <button
                                                key={profile.id}
                                                onClick={() => {
                                                    setActiveEnvId && setActiveEnvId(profile.id);
                                                    setShowEnvDropdown(false);
                                                }}
                                                className={`w-full px-3 py-2 text-xs font-medium text-left flex items-center justify-between rounded-lg transition-colors ${activeEnvId === profile.id
                                                    ? 'bg-indigo-500/10 text-indigo-400'
                                                    : 'text-slate-300 hover:bg-white/5'
                                                    }`}
                                            >
                                                <span className="truncate">{profile.name}</span>
                                                {activeEnvId === profile.id && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-px bg-white/5 my-1"></div>
                                    <div className="p-1">
                                        <button
                                            onClick={() => {
                                                setIsEnvModalOpen(true);
                                                setShowEnvDropdown(false);
                                            }}
                                            className="w-full px-3 py-2 text-xs font-bold text-slate-400 hover:text-indigo-400 hover:bg-white/5 text-left transition-colors rounded-lg flex items-center gap-2"
                                        >
                                            <Lucide.Settings size={14} /> Manage Environments...
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

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
            {showCodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCodeModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-white/10 m-4 overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <Terminal size={16} /> Code Snippet
                                </h3>
                                <select
                                    value={codeLanguage}
                                    onChange={(e) => setCodeLanguage(e.target.value as any)}
                                    className="text-xs bg-white dark:bg-slate-800 border-none rounded py-1 pl-2 pr-8 font-medium focus:ring-1 focus:ring-indigo-500 shadow-sm"
                                >
                                    <option value="CURL">cURL</option>
                                    <option value="FETCH">JavaScript (Fetch)</option>
                                    <option value="PYTHON">Python (Requests)</option>
                                    <option value="NODE">Node.js (Axios)</option>
                                </select>
                            </div>
                            <button onClick={() => setShowCodeModal(false)}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-0 bg-slate-900 overflow-auto flex-1 custom-scrollbar relative group">
                            <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all p-4 selection:bg-indigo-500/30">
                                {generateCode(codeLanguage)}
                            </pre>
                            <button
                                onClick={() => navigator.clipboard.writeText(generateCode(codeLanguage))}
                                className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-white/5 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <button
                                onClick={() => { navigator.clipboard.writeText(generateCode(codeLanguage)); setShowCodeModal(false); }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"
                            >
                                <Copy size={14} /> Copy & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostTool;
