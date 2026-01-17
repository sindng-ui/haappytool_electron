import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { PostGlobalAuth, PostGlobalVariable } from '../../types';
import { HighlightedInput } from './HighlightedInput';

const { X, Shield, ShieldCheck, ShieldAlert, Key, User, Lock, ToggleLeft, ToggleRight, Info } = Lucide;

interface GlobalAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    auth: PostGlobalAuth;
    onChange: (auth: PostGlobalAuth) => void;
    variables: PostGlobalVariable[];
}

const GlobalAuthModal: React.FC<GlobalAuthModalProps> = ({ isOpen, onClose, auth, onChange, variables }) => {
    if (!isOpen) return null;

    const [localAuth, setLocalAuth] = useState<PostGlobalAuth>({ ...auth });

    useEffect(() => {
        setLocalAuth({ ...auth });
    }, [auth]);

    // Autocomplete State
    const activeInputRef = React.useRef<HTMLInputElement | null>(null);
    const [autocompleteState, setAutocompleteState] = useState<{
        list: (PostGlobalVariable & { label: string, note?: string })[],
        position: { top: number, left: number },
        apply: (v: PostGlobalVariable & { label: string }) => void,
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
        e: React.ChangeEvent<HTMLInputElement>,
        updateFn: (val: string) => void
    ) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart || 0;
        updateFn(val);

        const textBeforeCursor = val.slice(0, cursor);
        const lastOpen = textBeforeCursor.lastIndexOf('{{');

        if (lastOpen !== -1) {
            const query = textBeforeCursor.slice(lastOpen + 2);
            if (!query.includes('}}') && !query.includes('\n')) {
                // Filter Variables (Using simple active variables mostly, assuming Global Auth uses active)
                // TODO: Cross-profile support? For now just use passed `variables`.
                const filtered = variables
                    .filter(v => v.enabled && v.key.toLowerCase().startsWith(query.toLowerCase()))
                    .map(v => ({ ...v, label: v.key, note: 'Active' }));

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
                            const newValue = textBeforeCursor.slice(0, lastOpen) + `{{${item.label}}}` + suffix;

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
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
        }
    };

    const handleSave = () => {
        onChange(localAuth);
        onClose();
    };

    const updateField = (field: keyof PostGlobalAuth, value: any) => {
        setLocalAuth(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${localAuth.enabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                            {localAuth.enabled ? <ShieldCheck size={20} /> : <Shield size={20} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">Global Auth Helper</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Apply credentials to all requests</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-6">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable Global Auth</span>
                        <button
                            onClick={() => updateField('enabled', !localAuth.enabled)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${localAuth.enabled
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                }`}
                        >
                            {localAuth.enabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                    </div>

                    <div className={`flex flex-col gap-4 transition-opacity duration-200 ${localAuth.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        {/* Auth Type */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auth Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['none', 'bearer', 'basic', 'apikey'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => updateField('type', type)}
                                        className={`px-3 py-2 rounded-lg border text-xs font-bold capitalize transition-all ${localAuth.type === type
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                                            }`}
                                    >
                                        {type === 'apikey' ? 'API Key' : type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 min-h-[120px]">
                            {localAuth.type === 'none' && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center gap-2">
                                    <Shield size={24} className="opacity-20" />
                                    <span className="text-xs">No global authentication selected.</span>
                                </div>
                            )}

                            {localAuth.type === 'bearer' && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Token</label>
                                    <HighlightedInput
                                        value={localAuth.bearerToken || ''}
                                        onChange={(e) => checkAutocomplete(e, (v) => updateField('bearerToken', v))}
                                        onKeyDown={handleKeyDown}
                                        variables={variables}
                                        placeholder="Bearer Token (e.g. {{token}})"
                                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                        containerClassName="w-full"
                                        textClassName="text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            )}

                            {localAuth.type === 'basic' && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                                        <HighlightedInput
                                            value={localAuth.basicUsername || ''}
                                            onChange={(e) => checkAutocomplete(e, (v) => updateField('basicUsername', v))}
                                            onKeyDown={handleKeyDown}
                                            variables={variables}
                                            placeholder="Username"
                                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                            containerClassName="w-full"
                                            textClassName="text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                        <HighlightedInput
                                            value={localAuth.basicPassword || ''}
                                            onChange={(e) => checkAutocomplete(e, (v) => updateField('basicPassword', v))}
                                            onKeyDown={handleKeyDown}
                                            variables={variables}
                                            placeholder="Password"
                                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                            containerClassName="w-full"
                                            textClassName="text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                </div>
                            )}

                            {localAuth.type === 'apikey' && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Key</label>
                                        <HighlightedInput
                                            value={localAuth.apiKeyKey || ''}
                                            onChange={(e) => checkAutocomplete(e, (v) => updateField('apiKeyKey', v))}
                                            onKeyDown={handleKeyDown}
                                            variables={variables}
                                            placeholder="Key (e.g. x-api-key)"
                                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                            containerClassName="w-full"
                                            textClassName="text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Value</label>
                                        <HighlightedInput
                                            value={localAuth.apiKeyValue || ''}
                                            onChange={(e) => checkAutocomplete(e, (v) => updateField('apiKeyValue', v))}
                                            onKeyDown={handleKeyDown}
                                            variables={variables}
                                            placeholder="Value"
                                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:border-indigo-500 w-full"
                                            containerClassName="w-full"
                                            textClassName="text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add To</label>
                                        <div className="flex bg-slate-100 dark:bg-slate-900 rounded-md p-1 border border-slate-200 dark:border-slate-700 w-fit">
                                            <button
                                                onClick={() => updateField('apiKeyAddTo', 'header')}
                                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${localAuth.apiKeyAddTo === 'header' || !localAuth.apiKeyAddTo ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                            >
                                                Header
                                            </button>
                                            <button
                                                onClick={() => updateField('apiKeyAddTo', 'query')}
                                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${localAuth.apiKeyAddTo === 'query' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                            >
                                                Query Params
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hint */}
                    <div className="flex gap-2 items-start py-2 px-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                        <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-snug">
                            When enabled, these credentials will be injected into <strong>every request</strong> unless the request defines its own Auth (other than "None").
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105">
                        Save Configuration
                    </button>
                </div>
            </div>

            {/* Autocomplete Dropdown (Portal or Absolute over content? Portal is safer for modal z-index) */}
            {autocompleteState && (
                <div
                    className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px] flex flex-col animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: autocompleteState.position.top, left: autocompleteState.position.left }}
                    onClick={(e) => e.stopPropagation()}
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
                            <span className="font-bold">{`{{${v.label}}}`}</span>
                            <span className="text-slate-400 dark:text-slate-600 text-[10px] truncate max-w-[100px] group-hover:text-slate-500">
                                {v.note === 'Active' ? v.value : `${v.note} • ${v.value}`}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GlobalAuthModal;
