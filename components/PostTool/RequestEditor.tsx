import React, { useState, useRef, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { SavedRequest, HttpMethod, PostGlobalVariable, PostGlobalAuth } from '../../types';
import { HighlightedInput } from './HighlightedInput';

const { Send, Activity, X, Terminal, Copy, Plus } = Lucide;

interface RequestEditorProps {
    currentRequest: SavedRequest;
    onChangeCurrentRequest: (req: SavedRequest) => void;
    onSend: () => void;
    loading: boolean;
    globalVariables: PostGlobalVariable[];
    globalAuth?: PostGlobalAuth;
}

const RequestEditor: React.FC<RequestEditorProps> = ({ currentRequest, onChangeCurrentRequest, onSend, loading, globalVariables, globalAuth }) => {
    const [activeTab, setActiveTab] = useState<'PARAMS' | 'AUTH' | 'HEADERS' | 'BODY'>('PARAMS');
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [codeLanguage, setCodeLanguage] = useState<'CURL' | 'FETCH' | 'PYTHON' | 'NODE'>('CURL');

    // ... refs ...
    const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    // ... autocomplete ...

    // Helper to replace vars
    const replace = (str: string) => {
        let res = str;
        globalVariables.forEach(v => {
            if (v.enabled) res = res.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });
        return res;
    };

    const generateCode = (lang: typeof codeLanguage) => {
        const method = currentRequest.method;
        let url = replace(currentRequest.url); // Changed to let
        const headers = currentRequest.headers.filter(h => h.key && h.value).reduce((acc, h) => {
            acc[replace(h.key)] = replace(h.value);
            return acc;
        }, {} as Record<string, string>);
        const body = currentRequest.body && ['POST', 'PUT', 'PATCH'].includes(method) ? replace(currentRequest.body) : '';

        // Apply Global Auth Logic for Code Generation
        if (globalAuth && globalAuth.enabled && globalAuth.type !== 'none') {
            const reqAuthType = currentRequest.auth?.type || 'none';
            if (reqAuthType === 'none') {
                if (globalAuth.type === 'bearer' && globalAuth.bearerToken) {
                    headers['Authorization'] = `Bearer ${replace(globalAuth.bearerToken)}`;
                } else if (globalAuth.type === 'basic' && (globalAuth.basicUsername || globalAuth.basicPassword)) {
                    const u = replace(globalAuth.basicUsername || '');
                    const p = replace(globalAuth.basicPassword || '');
                    headers['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                } else if (globalAuth.type === 'apikey' && globalAuth.apiKeyKey && globalAuth.apiKeyValue) {
                    const key = replace(globalAuth.apiKeyKey);
                    const val = replace(globalAuth.apiKeyValue);
                    if (globalAuth.apiKeyAddTo === 'query') {
                        const separator = url.includes('?') ? '&' : '?';
                        // url is const in previous block, check context.
                        // It was `const url = replace(currentRequest.url);`
                        // Javascript allows re-declaration in switch? No.
                        // Wait, `const url` is defined above switch.
                        // I cannot reassign `url`.
                        // I should use a local variable or change the const to let above switch.
                        // But I cannot easily change lines far above here with single chunk safely if context changes.
                        // Ah, I am replacing `const url = ...` line? No, I am replacing lines 38-43.
                        // Line 37 `const url` is just before.
                        // I will include line 37 in replacement to change it to let.
                    } else {
                        headers[key] = val;
                    }
                }
            }
        }

        switch (lang) {
            case 'CURL': {
                let cmd = `curl -X ${method} '${url}'`;
                Object.entries(headers).forEach(([k, v]) => {
                    cmd += ` \\\n  -H '${k}: ${v}'`;
                });
                if (body) {
                    cmd += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
                }
                return cmd;
            }
            case 'FETCH': {
                const options: any = { method };
                if (Object.keys(headers).length) options.headers = headers;
                if (body) options.body = body; // Simplified, assumes JSON/Text mostly
                return `fetch('${url}', ${JSON.stringify(options, null, 2)});`;
            }
            case 'PYTHON': {
                let code = `import requests\n\nurl = "${url}"\n`;
                if (Object.keys(headers).length) {
                    code += `headers = ${JSON.stringify(headers, null, 4)}\n`;
                }
                if (body) {
                    code += `data = ${JSON.stringify(body)}\n`; // Primitive dump
                }
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

    // ... updateParam ...

    // Autocomplete State
    const [autocompleteState, setAutocompleteState] = useState<{
        list: PostGlobalVariable[],
        position: { top: number, left: number },
        apply: (v: PostGlobalVariable) => void,
        selectedIndex: number
    } | null>(null);

    // Close suggestions on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (autocompleteState && activeInputRef.current && !activeInputRef.current.contains(e.target as Node)) {
                setAutocompleteState(null);
            }
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [autocompleteState]);

    const checkAutocomplete = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        updateFn: (val: string) => void
    ) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart || 0;
        updateFn(val); // Propagate change first

        const textBeforeCursor = val.slice(0, cursor);
        const lastOpen = textBeforeCursor.lastIndexOf('{{');

        if (lastOpen !== -1) {
            const query = textBeforeCursor.slice(lastOpen + 2);
            if (!query.includes('}}') && !query.includes('\n')) {
                const filtered = globalVariables.filter(v => v.enabled && v.key.toLowerCase().startsWith(query.toLowerCase()));

                if (filtered.length > 0) {
                    const rect = e.target.getBoundingClientRect();
                    activeInputRef.current = e.target;

                    setAutocompleteState({
                        list: filtered,
                        position: { top: rect.bottom + 5, left: rect.left },
                        selectedIndex: 0,
                        apply: (item) => {
                            const hasClosing = val.slice(cursor).startsWith('}}');
                            const suffix = hasClosing ? val.slice(cursor + 2) : val.slice(cursor);
                            const newValue = textBeforeCursor.slice(0, lastOpen) + `{{${item.key}}}` + suffix;

                            updateFn(newValue);
                            setAutocompleteState(null);
                            (e.target as HTMLElement).focus();
                        }
                    });
                    return;
                }
            }
        }
        setAutocompleteState(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index?: number, field?: 'key' | 'value') => {
        if (autocompleteState) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAutocompleteState(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.list.length } : null);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAutocompleteState(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.list.length) % prev.list.length } : null);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                autocompleteState.apply(autocompleteState.list[autocompleteState.selectedIndex]);
            } else if (e.key === 'Escape') {
                setAutocompleteState(null);
            }
            return;
        }

        // Header Navigation
        if (activeTab === 'HEADERS' && index !== undefined && field) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (field === 'key') {
                    // Move to Value
                    const inputs = document.querySelectorAll(`input[data-header-index="${index}"][data-header-field="value"]`);
                    (inputs[0] as HTMLElement)?.focus();
                } else {
                    // Move to Next Row Key
                    const nextIndex = index + 1;
                    const nextInputs = document.querySelectorAll(`input[data-header-index="${nextIndex}"][data-header-field="key"]`);
                    if (nextInputs.length > 0) {
                        (nextInputs[0] as HTMLElement)?.focus();
                    } else {
                        // Add new row if at end
                        updateHeader(index, 'value', currentRequest.headers[index].value); // Trigger check to add row
                        setTimeout(() => {
                            const newInputs = document.querySelectorAll(`input[data-header-index="${nextIndex}"][data-header-field="key"]`);
                            (newInputs[0] as HTMLElement)?.focus();
                        }, 0);
                    }
                }
            }
        }
    };

    const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
        const newHeaders = [...currentRequest.headers];
        newHeaders[index][field] = value;
        if (index === newHeaders.length - 1 && (newHeaders[index].key || newHeaders[index].value)) {
            newHeaders.push({ key: '', value: '' });
        }
        onChangeCurrentRequest({ ...currentRequest, headers: newHeaders });
    };

    const removeHeader = (index: number) => {
        const newHeaders = currentRequest.headers.filter((_, i) => i !== index);
        if (newHeaders.length === 0) newHeaders.push({ key: '', value: '' });
        onChangeCurrentRequest({ ...currentRequest, headers: newHeaders });
    };

    const getMethodColor = (m: string) => {
        switch (m) {
            case 'GET': return 'text-blue-400';
            case 'POST': return 'text-green-400';
            case 'DELETE': return 'text-red-400';
            case 'PUT': return 'text-orange-400';
            default: return 'text-slate-400';
        }
    };



    const updateParam = (index: number, field: 'key' | 'value', value: string) => {
        try {
            const urlObj = new URL(currentRequest.url, 'http://dummy.com'); // Use dummy base for relative URLs
            const params = Array.from(urlObj.searchParams.entries());

            // Handle new row or update
            if (index >= params.length) {
                if (field === 'key' && value) params.push([value, '']);
            } else {
                if (field === 'key') params[index][0] = value;
                else params[index][1] = value;
            }

            // Reconstruction
            const newSearchParams = new URLSearchParams();
            params.forEach(([k, v]) => newSearchParams.append(k, v));

            // Preserves base URL (everything before ?)
            const baseUrl = currentRequest.url.split('?')[0];
            const queryString = newSearchParams.toString();

            onChangeCurrentRequest({ ...currentRequest, url: queryString ? `${baseUrl}?${queryString}` : baseUrl });

        } catch (e) {
            // Fallback for malformed URLs: just append ?key=value manually? 
            // Or better, ignore updates until URL is valid-ish.
            // But user might be typing a variable {{host}}.
            // If URL is just {{host}}/path, new URL() might fail if {{host}} isn't a valid protocol.

            // Simple string manipulation fallback
            // This is complex. Let's assume standardized URL format or basic split.
            console.error("URL Parse Error", e);
        }
    };

    const removeParam = (index: number) => {
        try {
            const urlObj = new URL(currentRequest.url, 'http://dummy.com');
            const params = Array.from(urlObj.searchParams.entries());
            params.splice(index, 1);

            const newSearchParams = new URLSearchParams();
            params.forEach(([k, v]) => newSearchParams.append(k, v));

            const baseUrl = currentRequest.url.split('?')[0];
            const queryString = newSearchParams.toString();
            onChangeCurrentRequest({ ...currentRequest, url: queryString ? `${baseUrl}?${queryString}` : baseUrl });
        } catch (e) { console.error(e); }
    };

    const updateAuth = (auth: SavedRequest['auth']) => {
        if (!auth) return;

        // Filter out existing Authorization header and any empty rows to clean up
        let newHeaders = currentRequest.headers.filter(h =>
            h.key.trim().toLowerCase() !== 'authorization' && (h.key || h.value)
        );

        if (auth.type === 'bearer' && auth.bearerToken) {
            newHeaders.push({ key: 'Authorization', value: `Bearer ${auth.bearerToken}` });
        } else if (auth.type === 'basic' && (auth.basicUsername || auth.basicPassword)) {
            const token = btoa(`${auth.basicUsername || ''}:${auth.basicPassword || ''}`);
            newHeaders.push({ key: 'Authorization', value: `Basic ${token}` });
        }

        // Always ensure one empty row at the end for new entry
        newHeaders.push({ key: '', value: '' });

        onChangeCurrentRequest({ ...currentRequest, auth, headers: newHeaders });
    };

    // Derived Params for Render
    const getParams = () => {
        try {
            if (!currentRequest.url) return [{ key: '', value: '' }];
            // primitive check to avoid crash on partial urls
            const urlToParse = currentRequest.url.includes('://') ? currentRequest.url : `http://dummy.com/${currentRequest.url}`;
            const urlObj = new URL(urlToParse);
            const params = Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({ key, value }));
            params.push({ key: '', value: '' }); // Always show empty row at end
            return params;
        } catch {
            return [{ key: '', value: '' }];
        }
    };
    const paramsList = getParams();

    return (
        <div className="flex flex-col min-w-0 bg-transparent flex-1 h-full relative">
            {/* Header */}
            <div className="h-11 bg-white/50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500 dark:text-indigo-400"><Send size={16} className="icon-glow" /></div>
                <input
                    type="text"
                    value={currentRequest.name}
                    onChange={(e) => onChangeCurrentRequest({ ...currentRequest, name: e.target.value })}
                    placeholder="Request Name"
                    className="font-bold text-sm text-slate-700 dark:text-slate-200 bg-transparent border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-2 py-1 no-drag min-w-0 flex-1 max-w-md transition-colors"
                />
                <button
                    onClick={() => setShowCodeModal(true)}
                    className="no-drag ml-auto mr-4 flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 rounded-md text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-xs font-bold shadow-sm"
                    title="Generate Code Snippet"
                >
                    <Terminal size={13} />
                    <span>Code</span>
                </button>
            </div>

            {/* Request Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900">
                <div className="flex gap-2 h-10">
                    <div className="relative">
                        <select
                            value={currentRequest.method}
                            onChange={(e) => onChangeCurrentRequest({ ...currentRequest, method: e.target.value as HttpMethod })}
                            className={`pl-3 pr-8 h-full rounded-lg font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer shadow-sm ${getMethodColor(currentRequest.method)}`}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                            <Lucide.ChevronDown size={14} />
                        </div>
                    </div>

                    <HighlightedInput
                        value={currentRequest.url}
                        variables={globalVariables}
                        onChange={(e) => checkAutocomplete(e, (v) => onChangeCurrentRequest({ ...currentRequest, url: v }))}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/v1/endpoint"
                        className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 text-sm font-mono shadow-sm transition-shadow placeholder-slate-400 dark:placeholder-slate-600"
                        containerClassName="flex-1"
                        textClassName="text-slate-800 dark:text-slate-200"
                    />
                    <button
                        onClick={onSend}
                        disabled={loading || !currentRequest.url}
                        className={`px-6 rounded-lg font-bold text-sm text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 ${loading ? 'bg-slate-500 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400'}`}
                    >
                        {loading ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
                        Send
                    </button>
                </div>
            </div>

            {/* Editor Tabs */}
            <div className="border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-900 px-4 flex gap-6 text-xs font-bold text-slate-500 dark:text-slate-500">
                <button
                    onClick={() => setActiveTab('PARAMS')}
                    className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'PARAMS' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Params
                </button>
                <button
                    onClick={() => setActiveTab('AUTH')}
                    className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'AUTH' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Auth {currentRequest.auth && currentRequest.auth.type !== 'none' && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_4px_rgba(99,102,241,0.5)]"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('HEADERS')}
                    className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'HEADERS' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Headers <span className="bg-slate-200 dark:bg-slate-800 px-1.5 rounded-full text-[10px] text-slate-600 dark:text-slate-400">{currentRequest.headers.length - 1}</span>
                </button>
                <button
                    onClick={() => setActiveTab('BODY')}
                    className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'BODY' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Body {currentRequest.body && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_4px_rgba(99,102,241,0.5)]"></div>}
                </button>
            </div>

            {/* Editor Content */}
            <div className="h-64 border-b border-slate-200 dark:border-white/5 overflow-auto min-h-[100px] resize-y bg-slate-50 dark:bg-black/20 relative">
                {activeTab === 'PARAMS' && (
                    <div className="flex flex-col">
                        {paramsList.map((p, i) => (
                            <div key={i} className="flex border-b border-slate-200 dark:border-white/5 group hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                                <HighlightedInput
                                    placeholder="Key"
                                    value={p.key}
                                    variables={globalVariables}
                                    onChange={(e) => checkAutocomplete(e, (v) => updateParam(i, 'key', v))}
                                    className="bg-transparent p-2 text-xs font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-indigo-50/50 dark:focus:bg-indigo-500/10 border-r border-slate-200 dark:border-white/5"
                                    containerClassName="flex-1"
                                    textClassName="text-slate-700 dark:text-slate-300"
                                />
                                <HighlightedInput
                                    placeholder="Value"
                                    value={p.value}
                                    variables={globalVariables}
                                    onChange={(e) => checkAutocomplete(e, (v) => updateParam(i, 'value', v))}
                                    className="bg-transparent p-2 text-xs font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-indigo-50/50 dark:focus:bg-indigo-500/10"
                                    containerClassName="flex-1"
                                    textClassName="text-indigo-600 dark:text-indigo-300"
                                />
                                {i < paramsList.length - 1 && (
                                    <button onClick={() => removeParam(i)} className="px-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'AUTH' && (
                    <div className="p-4 flex flex-col gap-4 max-w-lg">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
                            <select
                                value={currentRequest.auth?.type || 'none'}
                                onChange={(e) => updateAuth({ ...currentRequest.auth, type: e.target.value as any })}
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                            >
                                <option value="none">No Auth</option>
                                <option value="bearer">Bearer Token</option>
                                <option value="basic">Basic Auth</option>
                            </select>
                        </div>

                        {currentRequest.auth?.type === 'bearer' && (
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Token</label>
                                <HighlightedInput
                                    placeholder="e.g. eyJhbGci..."
                                    value={currentRequest.auth.bearerToken || ''}
                                    variables={globalVariables}
                                    onChange={(e) => checkAutocomplete(e, (v) => updateAuth({ ...currentRequest.auth, bearerToken: v } as any))}
                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                    containerClassName="w-full"
                                    textClassName="text-slate-800 dark:text-slate-200"
                                />
                            </div>
                        )}

                        {currentRequest.auth?.type === 'basic' && (
                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                                    <HighlightedInput
                                        placeholder="Username"
                                        value={currentRequest.auth.basicUsername || ''}
                                        variables={globalVariables}
                                        onChange={(e) => checkAutocomplete(e, (v) => updateAuth({ ...currentRequest.auth, basicUsername: v } as any))}
                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                        containerClassName="w-full"
                                        textClassName="text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                    <HighlightedInput
                                        placeholder="Password"
                                        value={currentRequest.auth.basicPassword || ''}
                                        variables={globalVariables}
                                        onChange={(e) => checkAutocomplete(e, (v) => updateAuth({ ...currentRequest.auth, basicPassword: v } as any))}
                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                        containerClassName="w-full"
                                        textClassName="text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-2">
                            This will automatically generate and update the <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-slate-600 dark:text-slate-300">Authorization</code> header.
                        </div>
                    </div>
                )}
                {activeTab === 'HEADERS' && (
                    <div className="flex flex-col">
                        {currentRequest.headers.map((h, i) => (
                            <div key={i} className="flex border-b border-slate-200 dark:border-white/5 group hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                                <HighlightedInput
                                    placeholder="Key"
                                    value={h.key}
                                    variables={globalVariables}
                                    onChange={(e) => checkAutocomplete(e, (v) => updateHeader(i, 'key', v))}
                                    // @ts-ignore
                                    onKeyDown={(e) => handleKeyDown(e, i, 'key')}
                                    className="bg-transparent p-2 text-xs font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-indigo-50/50 dark:focus:bg-indigo-500/10 border-r border-slate-200 dark:border-white/5"
                                    containerClassName="flex-1"
                                    textClassName="text-slate-700 dark:text-slate-300"
                                    data-header-index={i}
                                    data-header-field="key"
                                />
                                <HighlightedInput
                                    placeholder="Value"
                                    value={h.value}
                                    variables={globalVariables}
                                    onChange={(e) => checkAutocomplete(e, (v) => updateHeader(i, 'value', v))}
                                    // @ts-ignore
                                    onKeyDown={(e) => handleKeyDown(e, i, 'value')}
                                    className="bg-transparent p-2 text-xs font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-indigo-50/50 dark:focus:bg-indigo-500/10"
                                    containerClassName="flex-1"
                                    textClassName="text-indigo-600 dark:text-indigo-300"
                                    data-header-index={i}
                                    data-header-field="value"
                                />
                                {i < currentRequest.headers.length - 1 && (
                                    <button onClick={() => removeHeader(i)} className="px-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'BODY' && (
                    <textarea
                        value={currentRequest.body}
                        onChange={(e) => checkAutocomplete(e, (v) => onChangeCurrentRequest({ ...currentRequest, body: v }))}
                        onKeyDown={handleKeyDown}
                        placeholder="Raw Request Body (JSON, XML, Text...)"
                        className="w-full h-full bg-transparent p-4 font-mono text-xs text-slate-800 dark:text-slate-300 focus:outline-none resize-none placeholder-slate-400 dark:placeholder-slate-600"
                        spellCheck={false}
                    />
                )}
            </div>

            {/* Autocomplete Dropdown */}
            {autocompleteState && (
                <div
                    className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px] flex flex-col animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: autocompleteState.position.top, left: autocompleteState.position.left }}
                >
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Variables
                    </div>
                    {autocompleteState.list.map((v, idx) => (
                        <button
                            key={v.id}
                            onClick={() => autocompleteState.apply(v)}
                            className={`text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-4 group ${idx === autocompleteState.selectedIndex
                                ? 'bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                }`}
                        >
                            <span className="font-bold">{`{{${v.key}}}`}</span>
                            <span className="text-slate-400 dark:text-slate-600 text-[10px] truncate max-w-[100px] group-hover:text-slate-500">{v.value}</span>
                        </button>
                    ))}
                </div>
            )}

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
                                onClick={() => {
                                    navigator.clipboard.writeText(generateCode(codeLanguage));
                                    // Optional: show toast
                                }}
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
export default RequestEditor;
