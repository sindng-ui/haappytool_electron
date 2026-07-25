import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { SavedRequest, EnvironmentProfile, PostGlobalAuth, PostGlobalVariable } from '../../types';

const { Terminal, Copy, X } = Lucide;

interface CodeSnippetModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRequest: SavedRequest;
    envProfiles?: EnvironmentProfile[];
    globalVariables: PostGlobalVariable[];
    globalAuth?: PostGlobalAuth;
}

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({
    isOpen,
    onClose,
    currentRequest,
    envProfiles,
    globalVariables,
    globalAuth
}) => {
    const [codeLanguage, setCodeLanguage] = useState<'CURL' | 'FETCH' | 'PYTHON' | 'NODE'>('CURL');

    if (!isOpen) return null;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 " onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-white/10 m-4 overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/80 shrink-0">
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
                    <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
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
                <div className="p-4 border-t border-slate-200 dark:border-white/5 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/80 shrink-0">
                    <button
                        onClick={() => { navigator.clipboard.writeText(generateCode(codeLanguage)); onClose(); }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"
                    >
                        <Copy size={14} /> Copy & Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CodeSnippetModal;
