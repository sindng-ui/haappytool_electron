import { useState, useCallback, useRef, useEffect } from 'react';
import { LogMetadata } from '../types';
import SplitAnalysisWorker from '../workers/SplitAnalysis.worker.ts?worker';

export interface SplitAnalysisResult {
    key: string;
    fileName: string;
    functionName: string;
    preview: string;

    leftCount: number;
    rightCount: number;
    countDiff: number;

    leftAvgDelta: number;
    rightAvgDelta: number;
    deltaDiff: number;

    isNewError: boolean;
    isError: boolean;
    isWarn: boolean;

    prevFileName?: string;
    prevFunctionName?: string;
    prevPreview?: string;

    leftUniqueTids: number;
    rightUniqueTids: number;

    leftLineNum: number;
    rightLineNum: number;
    leftPrevLineNum: number;
    rightPrevLineNum: number;
    leftOrigLineNum: number;
    rightOrigLineNum: number;
    leftPrevOrigLineNum: number;
    rightPrevOrigLineNum: number;

    leftCodeLineNum?: string | null;      // ✅ NEW: 로그 내부 코드 라인 번호
    rightCodeLineNum?: string | null;     // ✅ NEW: 로그 내부 코드 라인 번호
    leftPrevCodeLineNum?: string | null;  // ✅ NEW
    rightPrevCodeLineNum?: string | null; // ✅ NEW
}

export const useSplitAnalysis = (
    leftWorkerRef: React.MutableRefObject<Worker | null>,
    rightWorkerRef: React.MutableRefObject<Worker | null>,
    isDualView: boolean
) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisResults, setAnalysisResults] = useState<SplitAnalysisResult[] | null>(null);
    const analyzerWorkerRef = useRef<Worker | null>(null);
    const isCancelledRef = useRef(false);

    const initWorker = useCallback(() => {
        if (analyzerWorkerRef.current) {
            analyzerWorkerRef.current.terminate();
        }
        try {
            analyzerWorkerRef.current = new SplitAnalysisWorker();
            analyzerWorkerRef.current.onmessage = (e: MessageEvent) => {
                const { type, payload } = e.data;
                if (type === 'STATUS_UPDATE') {
                    // Final comparison phase: 90% -> 100%
                    const comparisonProgress = payload.progress || 0;
                    setAnalysisProgress(90 + Math.floor(comparisonProgress * 0.1));
                } else if (type === 'SPLIT_ANALYSIS_COMPLETE') {
                    console.log(`[useSplitAnalysis] Analysis complete received. Result count: ${payload.results?.length}`);
                    setAnalysisResults(payload.results);
                    setIsAnalyzing(false);
                    setAnalysisProgress(100);
                }
            };
        } catch (err) {
            console.error('[useSplitAnalysis] Failed to instantiate worker:', err);
        }
    }, []);

    // Initialize Analyzer Worker
    useEffect(() => {
        initWorker();
        return () => {
            analyzerWorkerRef.current?.terminate();
        };
    }, [initWorker]);

    const performAnalysis = useCallback(async () => {
        console.log('[useSplitAnalysis] performAnalysis called', { isDualView, leftWorker: !!leftWorkerRef.current, rightWorker: !!rightWorkerRef.current, analyzer: !!analyzerWorkerRef.current });
        if (!isDualView || !leftWorkerRef.current || !rightWorkerRef.current || !analyzerWorkerRef.current) {
            console.warn('[useSplitAnalysis] Cannot perform analysis: Guard condition failed.');
            return;
        }

        setIsAnalyzing(true);
        setAnalysisProgress(0);
        setAnalysisResults(null);
        isCancelledRef.current = false;

        let leftProgress = 0;
        let rightProgress = 0;

        const updateMetadataProgress = () => {
            // Metadata extraction phase: 0% -> 90%
            const avgMetadataProgress = (leftProgress + rightProgress) / 2;
            setAnalysisProgress(Math.floor(avgMetadataProgress * 0.9));
        };

        try {
            const fetchMetrics = (worker: Worker, side: 'left' | 'right') => {
                return new Promise<any>((resolve) => {
                    const reqId = Math.random().toString(36).substring(7);
                    const listener = (e: MessageEvent) => {
                        if (isCancelledRef.current) {
                            worker.removeEventListener('message', listener);
                            return;
                        }

                        if (e.data.type === 'STATUS_UPDATE') {
                            if (side === 'left') leftProgress = e.data.payload.progress || 0;
                            else rightProgress = e.data.payload.progress || 0;
                            updateMetadataProgress();
                        } else if (e.data.type === 'ANALYSIS_METRICS_RESULT' && e.data.requestId === reqId) {
                            worker.removeEventListener('message', listener);
                            if (side === 'left') leftProgress = 100;
                            else rightProgress = 100;
                            updateMetadataProgress();
                            resolve(e.data.payload.metrics);
                        }
                    };
                    console.log(`[useSplitAnalysis] fetchMetrics started for side: ${side}, requestId: ${reqId}`);
                    worker.addEventListener('message', listener);
                    worker.postMessage({ type: 'GET_ANALYSIS_METRICS', payload: { side }, requestId: reqId });
                });
            };

            // Fetch both simultaneously! (Parallel for 1GB+ files performance) 🐧⚡
            const [leftMetrics, rightMetrics] = await Promise.all([
                fetchMetrics(leftWorkerRef.current, 'left'),
                fetchMetrics(rightWorkerRef.current, 'right')
            ]);

            if (isCancelledRef.current) return;

            setAnalysisProgress(90);

            // Send to Analyzer Worker
            analyzerWorkerRef.current?.postMessage({
                leftMetrics,
                rightMetrics
            });

        } catch (err) {
            if (!isCancelledRef.current) {
                console.error('[useSplitAnalysis] Failed to fetch metadata or analyze.', err);
                setIsAnalyzing(false);
                setAnalysisProgress(0);
            }
        }
    }, [isDualView, leftWorkerRef, rightWorkerRef]);

    const closeAnalysis = useCallback(() => {
        isCancelledRef.current = true;
        setAnalysisResults(null);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        // Terminate worker immediately to free resources
        if (analyzerWorkerRef.current) {
            analyzerWorkerRef.current.terminate();
            analyzerWorkerRef.current = null;
        }
        // Re-init for next potential analysis
        initWorker();
    }, [initWorker]);

    return {
        isAnalyzing,
        analysisProgress,
        analysisResults,
        performAnalysis,
        closeAnalysis
    };
};
