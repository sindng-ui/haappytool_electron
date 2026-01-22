import React, { useState } from 'react';
import { Code, AlertCircle, Check } from 'lucide-react';
import { parseRxCode, convertToReactFlowNodes } from '../CodeGen/CSharpParser';
import { Node, Edge } from '@xyflow/react';
import { RxNodeData } from '../constants';

interface ImportCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (nodes: Node<RxNodeData>[], edges: Edge[]) => void;
}

const ImportCodeModal: React.FC<ImportCodeModalProps> = ({ isOpen, onClose, onImport }) => {
    const [code, setCode] = useState('');
    const [errors, setErrors] = useState<string[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleParse = async () => {
        if (!code.trim()) {
            setErrors(['Please enter some C# code']);
            return;
        }

        setIsParsing(true);
        setErrors([]);
        setSuccess(false);

        try {
            const parsed = await parseRxCode(code);

            if (parsed.errors && parsed.errors.length > 0) {
                setErrors(parsed.errors);
                setIsParsing(false);
                return;
            }

            if (parsed.nodes.length === 0) {
                setErrors(['No Rx operators found in the code. Make sure to use Observable.* chains.']);
                setIsParsing(false);
                return;
            }

            // Convert to ReactFlow format
            const { nodes, edges } = convertToReactFlowNodes(parsed);

            // Trigger import
            onImport(nodes, edges);
            setSuccess(true);

            // Close after brief success message
            setTimeout(() => {
                onClose();
                setCode('');
                setErrors([]);
                setSuccess(false);
            }, 1000);
        } catch (error: any) {
            setErrors([error.message || 'Unknown error occurred']);
        } finally {
            setIsParsing(false);
        }
    };

    const handleClear = () => {
        setCode('');
        setErrors([]);
        setSuccess(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Code className="text-indigo-400" size={20} />
                        <h3 className="text-lg font-bold text-indigo-400">Import C# Rx Code</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 overflow-y-auto">
                    <div className="mb-3">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Paste your C# Reactive Extensions code:
                        </label>
                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder={`Observable.Interval(TimeSpan.FromMilliseconds(1000))
    .Select(x => x * 2)
    .Where(x => x > 5)
    .Subscribe(x => Console.WriteLine(x));`}
                            className="w-full h-64 px-3 py-2 bg-slate-950 border border-slate-600 rounded text-green-400 font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"
                            spellCheck={false}
                        />
                    </div>

                    {/* Info Box */}
                    <div className="bg-slate-800 border border-slate-700 rounded p-3 mb-3 text-xs text-slate-400">
                        <p className="font-semibold text-slate-300 mb-1">💡 Supported Operators:</p>
                        <p className="leading-relaxed">
                            <strong className="text-emerald-400">Sources:</strong> Interval, Timer, FromEvent, FromAsync, Return, Range, Create<br />
                            <strong className="text-blue-400">Pipes:</strong> Select, Where, Scan, Debounce, Delay, Buffer, Take, Skip, etc.<br />
                            <strong className="text-purple-400">Joins:</strong> Merge, Zip, CombineLatest, Concat, Amb<br />
                            <strong className="text-amber-400">Subjects:</strong> Subject, BehaviorSubject, ReplaySubject, AsyncSubject<br />
                            <strong className="text-rose-400">Sinks:</strong> Subscribe, ToList, ToArray
                        </p>
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-rose-950/30 border border-rose-900/50 rounded p-3 mb-3">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="text-rose-400 flex-shrink-0 mt-0.5" size={16} />
                                <div className="flex-1">
                                    {errors.map((err, i) => (
                                        <p key={i} className="text-sm text-rose-400">{err}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded p-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Check className="text-emerald-400" size={16} />
                                <p className="text-sm text-emerald-400">Nodes imported successfully!</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 flex gap-2 justify-end">
                    <button
                        onClick={handleClear}
                        disabled={isParsing}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded disabled:opacity-50"
                    >
                        Clear
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isParsing}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleParse}
                        disabled={isParsing || !code.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isParsing && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {isParsing ? 'Parsing...' : 'Parse & Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportCodeModal;
