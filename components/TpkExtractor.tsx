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
        reset
    } = useTpkExtractorLogic();

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            {/* Title Bar - Draggable Area */}
            <div className="h-16 w-full flex-shrink-0 title-drag z-50 flex items-center gap-3 pl-4 pr-36" style={{ backgroundColor: '#0f172a', borderBottom: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 no-drag"><Archive size={16} /></div>
                <span className="font-bold text-sm text-slate-300 no-drag">TPK Extractor</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl w-full bg-slate-900 rounded-3xl shadow-xl border border-slate-800 overflow-hidden flex flex-col relative no-drag">

                    {/* Header */}
                    <div className="p-8 border-b border-slate-800 bg-gradient-to-r from-orange-900/10 to-slate-900">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-slate-800 rounded-2xl shadow-sm text-orange-500 border border-slate-700">
                                <Archive size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-200">RPM to TPK Converter</h2>
                                <p className="text-slate-500 text-sm">Unlocks internal TPK packages from installers</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 min-h-[400px] flex flex-col">
                        {status === 'IDLE' && (
                            <TpkDropZone
                                dragActive={dragActive}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            />
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