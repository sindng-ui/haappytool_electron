import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignState, SignStep, SoFileItem } from './types';
import Step1_SourceUpload from './Step1_SourceUpload';
import Step2_3_FileList from './Step2_3_FileList';
import Step4_Repackage from './Step4_Repackage';
import Step5_FinalDownload from './Step5_FinalDownload';
import { useToast } from '../../contexts/ToastContext';
// 🐧 형님, ?worker 문법을 쓰면 Vite가 개발 모드에서도 Rollup을 돌려서 엄청 느려집니다. 
// 그래서 Native ESM 방식을 써서 esbuild의 속도를 그대로 챙기겠습니다!
const NupkgWorkerFactory = () => new Worker(new URL('./workers/nupkg.worker.ts', import.meta.url), { type: 'module' });


const NupkgSigner: React.FC = () => {
    const { addToast } = useToast();
    const [state, setState] = useState<SignState>({
        originalFile: null,
        soFiles: [],
        currentStep: 1,
        finalNupkgBlob: null,
        error: null,
        isProcessing: false,
        progress: 0,
        isFinalized: false
    });

    const resetState = () => {
        setState({
            originalFile: null,
            soFiles: [],
            currentStep: 1,
            finalNupkgBlob: null,
            error: null,
            isProcessing: false,
            progress: 0,
            isFinalized: false
        });
    };

    const handleFileSelect = async (file: File) => {
        setState(prev => ({ ...prev, isProcessing: true, error: null }));
        addToast("Loading nupkg in background...", "info");
        
        const worker = NupkgWorkerFactory();
        const requestId = Date.now().toString();

        worker.onmessage = (e) => {
            const { type, payload, requestId: respId } = e.data;
            if (respId !== requestId) return;

            if (type === 'EXTRACT_SO_COMPLETE') {
                const soItems = payload;
                if (soItems.length === 0) {
                    addToast("No .so files found in runtimes/ folder.", "warning");
                }

                setState(prev => ({
                    ...prev,
                    originalFile: file,
                    soFiles: soItems,
                    currentStep: 2,
                    isProcessing: false,
                }));
                addToast("Nupkg loaded successfully!", "success");
                worker.terminate();
            } else if (type === 'ERROR') {
                console.error(payload);
                setState(prev => ({ ...prev, isProcessing: false, error: "Failed to load nupkg file." }));
                addToast("Failed to load nupkg file: " + payload, "error");
                worker.terminate();
            }
        };

        worker.postMessage({ type: 'EXTRACT_SO', payload: { file }, requestId });
    };

    const toggleSoChecked = (path: string) => {
        setState(prev => ({
            ...prev,
            soFiles: prev.soFiles.map(item => 
                item.path === path ? { ...item, checked: !item.checked } : item
            )
        }));
    };

    const handleSignedUpload = async (path: string, file: File) => {
        if (!file) {
            // Remove signed version
            setState(prev => ({
                ...prev,
                soFiles: prev.soFiles.map(item => 
                    item.path === path ? { ...item, signedBlob: undefined, isSigned: false } : item
                )
            }));
            return;
        }

        // 🐧 형님 가라사대: 파일명에 꼬리표가 있으면 알아서 자리를 찾아가게 하거라!
        const fileName = file.name;
        let targets = [path];
        
        if (fileName.includes('_')) {
            const prefix = fileName.split('_')[0];
            // soFiles 중 path에 이 prefix가 포함된 녀석들을 모두 찾음 (아키텍처/버전 폴더명 매칭)
            const matchedPaths = state.soFiles
                .filter(item => item.path.includes(`/${prefix}/`) || item.path.includes(`/${prefix}_`))
                .map(item => item.path);
            
            if (matchedPaths.length > 0) {
                targets = matchedPaths;
                console.log(`[Smart Matching] Identified ${targets.length} targets for prefix: ${prefix}`);
            }
        }

        let isSigned = false;
        try {
            // Check signature (-535 bytes from end for 'g==:UEP')
            const start = Math.max(0, file.size - 535);
            const slice = file.slice(start);
            const text = await slice.text();
            if (text.includes('g==:UEP')) {
                isSigned = true;
            }
        } catch (e) {
            console.error("Signature check error", e);
        }

        setState(prev => ({
            ...prev,
            soFiles: prev.soFiles.map(item => 
                targets.includes(item.path) ? { ...item, signedBlob: file, isSigned } : item
            )
        }));
        
        const displayPath = targets.length > 1 ? `${targets.length} locations (Smart Match)` : fileName;
        if (isSigned) {
            addToast(`Valid signed version assigned to ${displayPath}`, "success");
        } else {
            addToast(`Warning: No signature found in ${fileName}`, "warning");
        }
    };

    const handleAutoSign = async () => {
        const targets = state.soFiles.filter(f => f.checked && !f.isSigned);
        if (targets.length === 0) {
            addToast("No unsigned files selected for auto-sign.", "warning");
            return;
        }

        addToast(`Starting auto-sign for ${targets.length} files...`, "info");
        
        // 🐧 형님 가라사대: 한 번에 하나씩 차근차근 서명 서버를 조집니다!
        for (const fileItem of targets) {
            try {
                // 1. 진행 상태 표시
                setState(prev => ({
                    ...prev,
                    soFiles: prev.soFiles.map(f => 
                        f.path === fileItem.path ? { ...f, isSigning: true } : f
                    )
                }));

                // 2. Blob을 파일로 임시 저장 (Main process가 읽을 수 있도록)
                const arrayBuffer = await fileItem.originalBlob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const tempPath = `temp_sign_${Date.now()}_${fileItem.basename}`;
                
                // 앱의 임시 폴더 경로 가져오기
                const appPath = await (window as any).electronAPI.getAppPath();
                const fullTempPath = `${appPath}/${tempPath}`;

                // base64로 변환하여 전달 (saveFileDirect가 base64 지원함)
                const base64Data = btoa(
                    uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                
                await (window as any).electronAPI.saveFileDirect({ 
                    data: base64Data, 
                    filePath: fullTempPath,
                    isBase64: true 
                });

                // 3. 자동 서명 호출 (CDP 마법 가동)
                const signedBuffer = await (window as any).electronAPI.autoSignSoFile(fullTempPath);

                if (signedBuffer) {
                    const signedBlob = new Blob([signedBuffer], { type: 'application/octet-stream' });
                    
                    // 서명 유효성 재검증 (g==:UEP 체크)
                    const text = await signedBlob.slice(Math.max(0, signedBlob.size - 535)).text();
                    const isSignedResult = text.includes('g==:UEP');

                    setState(prev => ({
                        ...prev,
                        soFiles: prev.soFiles.map(f => 
                            f.path === fileItem.path 
                                ? { ...f, signedBlob, isSigned: isSignedResult, isSigning: false } 
                                : f
                        )
                    }));
                } else {
                    throw new Error("Failed to receive signed buffer");
                }

                // 🐧 임시 파일은 굳이 안 지워도 main.cjs에서 프로세스 종료시 어느정도 정리되겠지만, 
                // 여기서는 다음 파일로 넘어가기 전에 성공 알림!
                addToast(`Successfully signed: ${fileItem.basename}`, "success");

            } catch (err: any) {
                console.error(`[AutoSign Error] ${fileItem.path}:`, err);
                addToast(`Failed to sign ${fileItem.basename}: ${err.message}`, "error");
                setState(prev => ({
                    ...prev,
                    soFiles: prev.soFiles.map(f => 
                        f.path === fileItem.path ? { ...f, isSigning: false } : f
                    )
                }));
            }
        }
    };

    const startRepackaging = async () => {
        setState(prev => ({ ...prev, currentStep: 4, isProcessing: true, progress: 0 }));
    };

    const finishRepackaging = (blob: Blob) => {
        setState(prev => ({
            ...prev,
            finalNupkgBlob: blob,
            currentStep: 5,
            isProcessing: false,
            progress: 100,
        }));
        addToast("Repackaging complete!", "success");
    };


    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
            {/* Header - Optimized for Dragging */}
            <header 
                className="flex items-center justify-between px-6 py-4 pr-[140px] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none"
                style={{ WebkitAppRegion: 'drag' } as any}
            >
                <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20 text-white cursor-default">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m12.892 7.781l1.499 4.497a1 1 0 01-1.211 1.296l-3.97-1.323a1 1 0 00-.638 0l-3.97 1.323a1 1 0 01-1.211-1.296l1.498-4.497m1.288-1.288a5.238 5.238 0 117.408 0l-1.288 1.288a3.415 3.415 0 10-4.832 0l-1.288-1.288z" />
                        </svg>
                    </div>
                    <div className="cursor-default">
                        <h1 className="text-xl font-bold tracking-tight">Nupkg Signer</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium" data-testid="step-badge">
                            Step {state.currentStep === 4 ? 3 : (state.currentStep === 5 ? 4 : state.currentStep)} / 4
                        </p>
                    </div>
                </div>
                {/* Empty space here is draggable */}
            </header>

            {/* Dedicated Step Bar - Clearly Visible, Move content-wise */}
            <div className="bg-slate-50 dark:bg-slate-950/50 py-6 border-b border-slate-200 dark:border-slate-800 shadow-sm relative z-0">
                <div className="max-w-4xl mx-auto flex items-center justify-center">
                    {[1, 2, 4, 5].map((step, idx) => {
                        const stepNum = step === 4 ? 3 : (step === 5 ? 4 : step);
                        const label = ["Source Upload", "Sign SO Files", "Repackaging", "Final Download"][stepNum - 1];
                        const isActive = (state.currentStep === step || (step === 2 && state.currentStep === 3)) && !(step === 5 && state.isFinalized);
                        const isCompleted = state.currentStep > step || (step === 5 && state.isFinalized);

                        return (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center group relative px-8">
                                    <div className={`
                                        flex items-center justify-center w-12 h-12 rounded-2xl text-base font-bold transition-all duration-300 relative z-10
                                        ${isActive 
                                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
                                            : isCompleted 
                                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                                : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800'
                                        }
                                    `}>
                                        {isCompleted ? (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span>{stepNum}</span>
                                        )}
                                        
                                        {/* Simplified Pulse - No layoutId movement */}
                                        {isActive && (
                                            <motion.div 
                                                className="absolute -inset-1.5 rounded-2xl border-2 border-indigo-500/50"
                                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.7, 0.3] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            />
                                        )}
                                    </div>
                                    <div className="absolute top-16 flex flex-col items-center">
                                        <span className={`
                                            whitespace-nowrap text-[11px] font-bold uppercase tracking-wider transition-colors duration-300
                                            ${isActive ? 'text-indigo-600 dark:text-indigo-400' : isCompleted ? 'text-emerald-500' : 'text-slate-400'}
                                        `}>
                                            {label}
                                        </span>
                                        {isActive && (
                                            <motion.div 
                                                layoutId="activeDot"
                                                className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1"
                                            />
                                        )}
                                    </div>
                                </div>
                                
                                {stepNum < 4 && (
                                    <div className="flex-1 max-w-[80px] h-1 relative mx-[-16px]">
                                        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 rounded-full" />
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: isCompleted ? "100%" : "0%" }}
                                            className="absolute inset-0 bg-emerald-500 rounded-full"
                                            transition={{ duration: 0.4 }}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-auto p-8 flex flex-col items-center justify-start pt-16">
                <AnimatePresence mode="wait">
                    {state.currentStep === 1 && (
                        <motion.div 
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-3xl"
                        >
                            <Step1_SourceUpload onFileSelect={handleFileSelect} isProcessing={state.isProcessing} />
                        </motion.div>
                    )}

                    {(state.currentStep === 2 || state.currentStep === 3) && (
                        <motion.div 
                            key="step2"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full h-full flex flex-col"
                        >
                            <Step2_3_FileList 
                                soFiles={state.soFiles}
                                onToggleChecked={toggleSoChecked}
                                onSignedUpload={handleSignedUpload}
                                onProcess={startRepackaging}
                                onAutoSign={handleAutoSign}
                                onBack={resetState}
                            />
                        </motion.div>
                    )}

                    {state.currentStep === 4 && (
                        <motion.div 
                            key="step4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full max-w-xl text-center"
                        >
                            <Step4_Repackage 
                                state={state}
                                onComplete={finishRepackaging}
                                onError={(msg) => setState(prev => ({ ...prev, error: msg, currentStep: 2 }))}
                            />
                        </motion.div>
                    )}

                    {state.currentStep === 5 && (
                        <motion.div 
                            key="step5"
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-2xl"
                        >
                            <Step5_FinalDownload 
                                originalName={state.originalFile?.name || 'package.nupkg'}
                                blob={state.finalNupkgBlob!}
                                onReset={resetState}
                                onSuccess={() => setState(prev => ({ ...prev, isFinalized: true }))}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Error Overlay */}
            <AnimatePresence>
                {state.error && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 right-6 max-w-md p-4 bg-red-500 text-white rounded-xl shadow-2xl flex items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{state.error}</span>
                        </div>
                        <button onClick={() => setState(prev => ({ ...prev, error: null }))} className="hover:bg-red-600 p-1 rounded transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NupkgSigner;
