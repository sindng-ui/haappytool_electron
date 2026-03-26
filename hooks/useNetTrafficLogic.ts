import { useState, useRef, useEffect } from 'react';
import { TrafficPattern, TemplateGroup, UAPattern, UAResult } from '../workers/NetTraffic.worker';

export const useNetTrafficLogic = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [singleResult, setSingleResult] = useState<TemplateGroup[]>([]);
  const [leftResult, setLeftResult] = useState<TemplateGroup[]>([]);
  const [rightResult, setRightResult] = useState<TemplateGroup[]>([]);
  
  const [singleUAResult, setSingleUAResult] = useState<UAResult[]>([]);
  const [leftUAResult, setLeftUAResult] = useState<UAResult[]>([]);
  const [rightUAResult, setRightUAResult] = useState<UAResult[]>([]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/NetTraffic.worker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'RESULT_UPDATE') {
        const { target, data, uaData } = payload;
        if (target === 'single') {
            setSingleResult(data);
            setSingleUAResult(uaData || []);
        } else if (target === 'left') {
            setLeftResult(data);
            setLeftUAResult(uaData || []);
        } else if (target === 'right') {
            setRightResult(data);
            setRightUAResult(uaData || []);
        }
        setAnalyzing(false);
      }
    };
    
    workerRef.current = worker;
    
    return () => {
      worker.terminate();
    };
  }, []);

  const analyzeFile = async (file: File, target: 'single' | 'left' | 'right', progressOffset: number = 0, progressRatio: number = 1) => {
    return new Promise<void>(async (resolve) => {
      if (!workerRef.current) return resolve();
      
      const chunkSize = 1024 * 1024 * 10; // 10MB chunks for better performance
      let offset = 0;
      const decoder = new TextDecoder('utf-8');
      
      while (offset < file.size) {
        const slice = file.slice(offset, offset + chunkSize);
        const buffer = await slice.arrayBuffer();
        const text = decoder.decode(buffer, { stream: true });
        
        workerRef.current.postMessage({
           type: 'PROCESS_CHUNK',
           payload: { target, chunk: text }
        });
        
        offset += chunkSize;
        const currentProgress = Math.min(100, Math.round((offset / file.size) * 100));
        setProgress(progressOffset + (currentProgress * progressRatio));
      }
      
      // flush stream
      decoder.decode(); 
      workerRef.current.postMessage({ type: 'STREAM_DONE', payload: { target } });
      resolve();
    });
  };

  const startAnalysis = async (mode: 'single' | 'compare', patterns: TrafficPattern[], uaPattern: UAPattern, singleFile: File | null, leftFile: File | null, rightFile: File | null) => {
    if (!workerRef.current) return;
    
    setAnalyzing(true);
    setProgress(0);
    setSingleResult([]); setLeftResult([]); setRightResult([]);
    setSingleUAResult([]); setLeftUAResult([]); setRightUAResult([]);
    
    workerRef.current.postMessage({ type: 'INIT', payload: { patterns, uaPattern } });
    
    try {
      if (mode === 'single' && singleFile) {
        await analyzeFile(singleFile, 'single', 0, 1);
      } else if (mode === 'compare' && leftFile && rightFile) {
         await analyzeFile(leftFile, 'left', 0, 0.5);
         await analyzeFile(rightFile, 'right', 50, 0.5);
      }
    } catch (err) {
      console.error('Analysis failed', err);
    }
  };

  return {
    analyzing,
    progress,
    singleResult,
    leftResult,
    rightResult,
    singleUAResult,
    leftUAResult,
    rightUAResult,
    startAnalysis
  };
};
