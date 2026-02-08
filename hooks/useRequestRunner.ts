import { useCallback } from 'react';
import { SavedRequest, PerfResponse, PostGlobalVariable, PostGlobalAuth, EnvironmentProfile } from '../types';
import { generateUUID } from '../utils/uuid'; // We might need to create this or move it

export interface RequestRunnerOptions {
    savedRequests: SavedRequest[];
    envProfiles: EnvironmentProfile[];
    activeEnvId: string;
    globalAuth: PostGlobalAuth;
    globalVariables: PostGlobalVariable[];
    window: Window & { electronAPI?: any }; // Typing for window
}

export const useRequestRunner = () => {

    const replaceVariables = useCallback((str: string, options: RequestRunnerOptions) => {
        let res = str;

        // 1. UUID & Timestamp (Special Vars)
        res = res.replace(/{{uuid}}/g, generateUUID()); // Assuming we have this
        res = res.replace(/{{timestamp}}/g, Date.now().toString());

        // 2. Cross-Profile Reference: {{ProfileName.Key}}
        if (options.envProfiles) {
            options.envProfiles.forEach(profile => {
                profile.variables.forEach(v => {
                    if (v.enabled) {
                        const pattern = `{{${profile.name}.${v.key}}}`;
                        res = res.split(pattern).join(v.value);
                    }
                });
            });
        }

        // 3. Active Profile Variables
        options.globalVariables.forEach(v => {
            if (v.enabled) res = res.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });

        return res;
    }, []);

    const executeRequest = useCallback(async (request: SavedRequest, options: RequestRunnerOptions, runtimeVars?: Record<string, string>): Promise<PerfResponse> => {
        const { globalAuth, window: win } = options;

        try {
            // Runtime variable injection (e.g. {{locationId}} from EasyPost)
            let tempUrl = request.url;
            if (runtimeVars) {
                Object.entries(runtimeVars).forEach(([key, val]) => {
                    tempUrl = tempUrl.replace(new RegExp(`{{${key}}}`, 'g'), val);
                });
            }

            let finalUrl = replaceVariables(tempUrl, options);

            // Apply Global Auth Query Params Logic
            if (globalAuth && globalAuth.enabled && globalAuth.type === 'apikey' && globalAuth.apiKeyAddTo === 'query' && globalAuth.apiKeyKey && globalAuth.apiKeyValue) {
                const reqAuthType = request.auth?.type || 'none';
                if (reqAuthType === 'none') {
                    const key = replaceVariables(globalAuth.apiKeyKey, options);
                    const val = replaceVariables(globalAuth.apiKeyValue, options);
                    const separator = finalUrl.includes('?') ? '&' : '?';
                    finalUrl += `${separator}${key}=${encodeURIComponent(val)}`;
                }
            }

            const finalHeaders = request.headers.reduce((acc, h) => {
                if (h.key) acc[replaceVariables(h.key, options)] = replaceVariables(h.value, options);
                return acc;
            }, {} as any);

            let finalBody = request.body ? replaceVariables(request.body, options) : undefined;
            // Runtime vars in body too?
            if (runtimeVars && finalBody) {
                Object.entries(runtimeVars).forEach(([key, val]) => {
                    finalBody = finalBody!.replace(new RegExp(`{{${key}}}`, 'g'), val);
                });
            }


            // --- Request Auth Injection ---
            const reqAuth = request.auth;
            if (reqAuth && reqAuth.type !== 'none') {
                if (reqAuth.type === 'bearer' && reqAuth.bearerToken) {
                    finalHeaders['Authorization'] = `Bearer ${replaceVariables(reqAuth.bearerToken, options)}`;
                } else if (reqAuth.type === 'basic' && (reqAuth.basicUsername || reqAuth.basicPassword)) {
                    const u = replaceVariables(reqAuth.basicUsername || '', options);
                    const p = replaceVariables(reqAuth.basicPassword || '', options);
                    finalHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                }
            }

            // --- Global Auth Injection ---
            if ((!reqAuth || reqAuth.type === 'none') && globalAuth && globalAuth.enabled && globalAuth.type !== 'none') {
                if (globalAuth.type === 'bearer' && globalAuth.bearerToken) {
                    finalHeaders['Authorization'] = `Bearer ${replaceVariables(globalAuth.bearerToken, options)}`;
                } else if (globalAuth.type === 'basic' && (globalAuth.basicUsername || globalAuth.basicPassword)) {
                    const u = replaceVariables(globalAuth.basicUsername || '', options);
                    const p = replaceVariables(globalAuth.basicPassword || '', options);
                    finalHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
                } else if (globalAuth.type === 'apikey' && globalAuth.apiKeyKey && globalAuth.apiKeyValue) {
                    const key = replaceVariables(globalAuth.apiKeyKey, options);
                    const val = replaceVariables(globalAuth.apiKeyValue, options);
                    if (globalAuth.apiKeyAddTo !== 'query') {
                        finalHeaders[key] = val;
                    }
                }
            }

            const startTime = performance.now();

            if (win.electronAPI && win.electronAPI.proxyRequest) {
                // Use Electron Proxy
                const res = await win.electronAPI.proxyRequest({
                    method: request.method,
                    url: finalUrl,
                    headers: finalHeaders,
                    body: ['GET', 'HEAD'].includes(request.method) ? undefined : finalBody
                });

                if (res.error) {
                    throw new Error(res.message || 'Proxy Request Failed');
                }

                const endTime = performance.now();
                return {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                    data: res.data,
                    timeTaken: endTime - startTime
                };
            } else {
                // Browser Fetch
                const res = await fetch(finalUrl, {
                    method: request.method,
                    headers: finalHeaders,
                    body: ['GET', 'HEAD'].includes(request.method) ? undefined : finalBody
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

                return {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers.entries()),
                    data,
                    timeTaken: endTime - startTime
                };
            }

        } catch (error: any) {
            return {
                status: 0,
                statusText: 'Error',
                headers: {},
                data: error.message,
                timeTaken: 0
            };
        }
    }, [replaceVariables]);

    return { executeRequest, replaceVariables };
};
