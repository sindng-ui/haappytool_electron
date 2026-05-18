import React, { useState, useRef } from 'react';
import { X, UploadCloud, Clipboard, Check, AlertCircle } from 'lucide-react';

interface ImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    categories: string[];
    onSave: (jsonText: string, customName: string, selectedCats: string[]) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, categories, onSave }) => {
    const [jsonText, setJsonText] = useState('');
    const [customName, setCustomName] = useState('');
    const [selectedCats, setSelectedCats] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const toggleCategory = (cat: string) => {
        setSelectedCats(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handlePasteClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setJsonText(text);
            setErrorMsg('');
            try {
                const parsed = JSON.parse(text);
                if (parsed.presentationId) {
                    setCustomName(parsed.presentationId);
                }
            } catch (e) {}
        } catch (err) {
            setErrorMsg('Failed to access clipboard or retrieve text contents.');
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const processFile = (file: File) => {
        if (file && file.type === "application/json" || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const resultText = event.target?.result as string;
                setJsonText(resultText);
                setErrorMsg('');
                try {
                    const parsed = JSON.parse(resultText);
                    if (parsed.presentationId) {
                        setCustomName(parsed.presentationId);
                    }
                } catch (e) {}
            };
            reader.readAsText(file);
        } else {
            setErrorMsg('Only .json files are allowed.');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleSubmit = () => {
        if (!jsonText.trim()) {
            setErrorMsg('Please input JSON data or drag-and-drop a file!');
            return;
        }

        try {
            const parsed = JSON.parse(jsonText);
            if (!parsed.presentationId || !parsed.manufacturerName) {
                setErrorMsg('Invalid format. Missing required "presentationId" or "manufacturerName" properties.');
                return;
            }
            setErrorMsg('');
            onSave(jsonText, customName, selectedCats);
            setJsonText('');
            setCustomName('');
            setSelectedCats([]);
            onClose();
        } catch (e: any) {
            setErrorMsg(`Malformed JSON schema: ${e.message}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800/80">
                    <h3 className="text-base font-extrabold text-slate-200 flex items-center gap-2">
                        <UploadCloud className="w-5 h-5 text-indigo-400" />
                        Import Device Presentation
                    </h3>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                    
                    {errorMsg && (
                        <div className="bg-rose-950/60 border border-rose-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-300 text-xs font-bold shadow-md">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-450 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase block mb-1.5">
                                Device Custom Alias (Name)
                            </label>
                            <input 
                                type="text"
                                placeholder="e.g. Living Room TV, Bedroom Smart Switch"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase block mb-1.5">
                                Assign Categories
                            </label>
                            <div className="flex flex-wrap gap-1 max-h-[84px] overflow-y-auto custom-scrollbar p-1.5 border border-slate-800 rounded-xl bg-slate-950/60">
                                {categories.map(cat => {
                                    const isSelected = selectedCats.includes(cat);
                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => toggleCategory(cat)}
                                            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border transition-all ${
                                                isSelected 
                                                    ? 'bg-indigo-950/80 border-indigo-750 text-indigo-300' 
                                                    : 'bg-slate-900 border-slate-850 text-slate-400 hover:border-slate-800'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase">
                                Device Presentation JSON Data
                            </label>
                            <button
                                onClick={handlePasteClipboard}
                                className="text-[10px] font-black text-indigo-400 hover:text-indigo-350 flex items-center gap-1 uppercase"
                            >
                                <Clipboard className="w-3.5 h-3.5" />
                                Paste from Clipboard
                            </button>
                        </div>

                        <div 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-2xl p-1 transition-all min-h-[180px] flex flex-col ${
                                dragActive 
                                    ? 'border-indigo-500 bg-indigo-950/10' 
                                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/30'
                            }`}
                        >
                            <textarea
                                value={jsonText}
                                onChange={(e) => {
                                    setJsonText(e.target.value);
                                    setErrorMsg('');
                                }}
                                placeholder="Paste JSON schema here, or drag-and-drop a .json file!"
                                className="w-full flex-1 min-h-[140px] bg-transparent text-slate-200 p-4 font-mono text-xs focus:outline-none resize-none leading-relaxed font-bold"
                            />

                            {!jsonText && (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4"
                                >
                                    <UploadCloud className="w-8 h-8 text-slate-500 mb-2" />
                                    <span className="text-xs text-slate-400 font-bold">Drag and drop a .json file here, or click to browse</span>
                                    <span className="text-[10px] text-slate-550 mt-1 font-mono font-bold">Drag & Drop .json or click</span>
                                </div>
                            )}

                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden" 
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-end gap-3 select-none">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        className="px-5 py-2 bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 rounded-xl text-xs font-black text-white shadow-lg shadow-indigo-600/25 active:scale-95 transition-all flex items-center gap-1.5 uppercase"
                    >
                        <Check className="w-4 h-4" />
                        Add to Dictionary
                    </button>
                </div>

            </div>
        </div>
    );
};
