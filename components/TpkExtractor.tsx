import React from 'react';
import * as Lucide from 'lucide-react';
import { useTpkExtractorLogic } from '../hooks/useTpkExtractorLogic';
import { TpkDropZone } from './TpkExtractor/TpkDropZone';
import { TpkProgressStepper } from './TpkExtractor/TpkProgressStepper';
import { TpkTerminalLog } from './TpkExtractor/TpkTerminalLog';
import { TpkResultAction } from './TpkExtractor/TpkResultAction';

const { Archive } = Lucide;

const TpkExtractor: React.FC = () => {
    const {
        status,
        resultPath,
        logs,
        progressStep,
        dragActive,
        handleDrag,
        handleDrop,
        handleDownload,
        reset,
        processUrl
    } = useTpkExtractorLogic();

    const [urlInput, setUrlInput] = React.useState('');

    const handleUrlSubmit = () => {
        if (urlInput.trim()) {
            processUrl(urlInput.trim());
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* Title Bar - Draggable Area */}
            <div className="h-9 w-full flex-shrink-0 title-drag z-20 flex items-center gap-3 pl-4 pr-36 border-b border-indigo-500/30 bg-slate-900">
                <div className="p-1 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Archive size={14} className="icon-glow" /></div>
                <span className="font-bold text-xs text-slate-200 no-drag">TPK Extractor</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col relative no-drag transition-colors">

                    {/* Header */}
                    <div className="p-8 border-b border-slate-200 dark:border-white/5 bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/10 dark:to-slate-900/40">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-orange-500 border border-slate-200 dark:border-slate-700">
                                <Archive size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">RPM to TPK Converter</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Unlocks internal TPK packages from installers</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 min-h-[400px] flex flex-col bg-slate-50/30 dark:bg-transparent">
                        {status === 'IDLE' && (
                            <>
                                <TpkDropZone
                                    dragActive={dragActive}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                />

                                <div className="mt-6 flex flex-col items-center w-full max-w-lg mx-auto">
                                    <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">OR Extract from URL</div>
                                    <div className="flex w-full gap-2">
                                        <input
                                            type="text"
                                            value={urlInput}
                                            onChange={(e) => setUrlInput(e.target.value)}
                                            placeholder="Enter Page URL containing .rpm link..."
                                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
                                            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                        />
                                        <button
                                            onClick={handleUrlSubmit}
                                            disabled={!urlInput.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                                        >
                                            Extract
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {(status === 'PROCESSING' || status === 'COMPLETED' || status === 'ERROR') && (
                            <div className="flex-1 flex flex-col">
                                <TpkProgressStepper currentStep={progressStep} />

                                <TpkTerminalLog
                                    logs={logs}
                                    isProcessing={status === 'PROCESSING'}
                                />

                                {(status === 'COMPLETED' || status === 'ERROR') && (
                                    <TpkResultAction
                                        status={status}
                                        resultPath={resultPath}
                                        onDownload={handleDownload}
                                        onReset={reset}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
};

export default TpkExtractor;