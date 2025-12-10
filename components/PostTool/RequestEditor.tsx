import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { SavedRequest, HttpMethod } from '../../types';

const { Send, Activity, X } = Lucide;

interface RequestEditorProps {
    currentRequest: SavedRequest;
    onChangeCurrentRequest: (req: SavedRequest) => void;
    onSend: () => void;
    loading: boolean;
}

const RequestEditor: React.FC<RequestEditorProps> = ({ currentRequest, onChangeCurrentRequest, onSend, loading }) => {
    const [activeTab, setActiveTab] = useState<'PARAMS' | 'HEADERS' | 'BODY'>('HEADERS');

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

    return (
        <div className="flex flex-col min-w-0 bg-slate-950">
            {/* Header */}
            <div className="h-12 bg-slate-900 border-b border-slate-800 shrink-0 title-drag pl-4 pr-36 flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400"><Send size={16} /></div>
                <input
                    type="text"
                    value={currentRequest.name}
                    onChange={(e) => onChangeCurrentRequest({ ...currentRequest, name: e.target.value })}
                    placeholder="Request Name"
                    className="font-bold text-sm text-slate-300 bg-transparent border-b-2 border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-2 py-1 no-drag min-w-0 flex-1 max-w-md"
                />
            </div>

            {/* Request Bar */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex gap-2 h-10">
                    <select
                        value={currentRequest.method}
                        onChange={(e) => onChangeCurrentRequest({ ...currentRequest, method: e.target.value as HttpMethod })}
                        className={`pl-3 pr-8 rounded-lg font-bold bg-slate-950 border border-slate-800 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer ${getMethodColor(currentRequest.method)}`}
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                    </select>
                    <input
                        type="text"
                        value={currentRequest.url}
                        onChange={(e) => onChangeCurrentRequest({ ...currentRequest, url: e.target.value })}
                        placeholder="https://api.example.com/v1/endpoint"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                        onClick={onSend}
                        disabled={loading || !currentRequest.url}
                        className={`px-6 rounded-lg font-bold text-sm text-white flex items-center gap-2 transition-all ${loading ? 'bg-slate-700 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    >
                        {loading ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
                        Send
                    </button>
                </div>
            </div>

            {/* Editor Tabs */}
            <div className="border-b border-slate-800 bg-slate-900/30 px-4 flex gap-6 text-xs font-bold text-slate-500">
                <button
                    onClick={() => setActiveTab('HEADERS')}
                    className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'HEADERS' ? 'border-indigo-500 text-indigo-400' : 'border-transparent hover:text-slate-300'}`}
                >
                    Headers <span className="bg-slate-800 px-1.5 rounded-full text-[10px]">{currentRequest.headers.length - 1}</span>
                </button>
                <button
                    onClick={() => setActiveTab('BODY')}
                    className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'BODY' ? 'border-indigo-500 text-indigo-400' : 'border-transparent hover:text-slate-300'}`}
                >
                    Body {currentRequest.body && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                </button>
            </div>

            {/* Editor Content */}
            <div className="h-64 border-b border-slate-800 overflow-auto min-h-[100px] resize-y">
                {activeTab === 'HEADERS' && (
                    <div className="flex flex-col bg-slate-900/30">
                        {currentRequest.headers.map((h, i) => (
                            <div key={i} className="flex border-b border-slate-800/50 group">
                                <input
                                    type="text"
                                    placeholder="Key"
                                    value={h.key}
                                    onChange={(e) => updateHeader(i, 'key', e.target.value)}
                                    className="flex-1 bg-transparent p-2 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:bg-slate-900/50 border-r border-slate-800/50"
                                />
                                <input
                                    type="text"
                                    placeholder="Value"
                                    value={h.value}
                                    onChange={(e) => updateHeader(i, 'value', e.target.value)}
                                    className="flex-1 bg-transparent p-2 text-xs font-mono text-indigo-300/80 placeholder-slate-600 focus:outline-none focus:bg-slate-900/50"
                                />
                                {i < currentRequest.headers.length - 1 && (
                                    <button onClick={() => removeHeader(i)} className="px-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        onChange={(e) => onChangeCurrentRequest({ ...currentRequest, body: e.target.value })}
                        placeholder="Raw Request Body (JSON, XML, Text...)"
                        className="w-full h-full bg-slate-950/80 p-4 font-mono text-xs text-slate-300 focus:outline-none resize-none"
                        spellCheck={false}
                    />
                )}
            </div>
        </div>
    );
};
export default RequestEditor;
