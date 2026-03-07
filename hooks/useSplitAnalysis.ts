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
}

export const useSplitAnalysis = (
    leftWorkerRef: React.MutableRefObject<Worker | null>,
    rightWorkerRef: React.MutableRefObject<Worker | null>,
    isDualView: boolean
) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
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
                if (type === 'SPLIT_ANALYSIS_COMPLETE') {
                    setAnalysisResults(payload.results);
                    setIsAnalyzing(false);
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
        if (!isDualView || !leftWorkerRef.current || !rightWorkerRef.current || !analyzerWorkerRef.current) {
            console.warn('[useSplitAnalysis] Cannot perform analysis: Dual view not active or workers missing.');
            return;
        }

        setIsAnalyzing(true);
        setAnalysisResults(null);
        isCancelledRef.current = false;

        try {
            // Fetch Left Metadata
            const leftData = await new Promise<LogMetadata[]>((resolve, reject) => {
                const reqId = Math.random().toString(36).substring(7);
                const listener = (e: MessageEvent) => {
                    if (isCancelledRef.current) {
                        leftWorkerRef.current?.removeEventListener('message', listener);
                        return;
                    }
                    if (e.data.type === 'ALL_METADATA_RESULT' && e.data.requestId === reqId) {
                        leftWorkerRef.current?.removeEventListener('message', listener);
                        resolve(e.data.payload.metadata);
                    }
                };
                leftWorkerRef.current!.addEventListener('message', listener);
                leftWorkerRef.current!.postMessage({ type: 'GET_ALL_METADATA', requestId: reqId });
            });

            if (isCancelledRef.current) return;

            // Fetch Right Metadata
            const rightData = await new Promise<LogMetadata[]>((resolve, reject) => {
                const reqId = Math.random().toString(36).substring(7);
                const listener = (e: MessageEvent) => {
                    if (isCancelledRef.current) {
                        rightWorkerRef.current?.removeEventListener('message', listener);
                        return;
                    }
                    if (e.data.type === 'ALL_METADATA_RESULT' && e.data.requestId === reqId) {
                        rightWorkerRef.current?.removeEventListener('message', listener);
                        resolve(e.data.payload.metadata);
                    }
                };
                rightWorkerRef.current!.addEventListener('message', listener);
                rightWorkerRef.current!.postMessage({ type: 'GET_ALL_METADATA', requestId: reqId });
            });

            if (isCancelledRef.current) return;

            // Send to Analyzer Worker
            analyzerWorkerRef.current?.postMessage({
                leftData,
                rightData
            });

        } catch (err) {
            if (!isCancelledRef.current) {
                console.error('[useSplitAnalysis] Failed to fetch metadata or analyze.', err);
                setIsAnalyzing(false);
            }
        }
    }, [isDualView, leftWorkerRef, rightWorkerRef]);

    const closeAnalysis = useCallback(() => {
        isCancelledRef.current = true;
        setAnalysisResults(null);
        setIsAnalyzing(false);
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
        analysisResults,
        performAnalysis,
        closeAnalysis
    };
};
