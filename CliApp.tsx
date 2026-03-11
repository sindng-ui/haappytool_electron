import React, { useEffect, useState } from 'react';
import { db } from './utils/db'; // Dexie database
import { useBlockTest } from './components/BlockTest/hooks/useBlockTest';

const CliBlockTestWrapper: React.FC<{
    payload: any,
    stdout: (msg: string) => void,
    stderr: (msg: string) => void,
    exit: (code: number) => void
}> = ({ payload, stdout, stderr, exit }) => {
    const { scenarioName, pipelineName } = payload;
    const blockTest = useBlockTest(true, (msg) => stdout(`[BlockTest] ${msg}`));
    const [started, setStarted] = useState(false);

    useEffect(() => {
        if (started) return;

        // Give it some time to load JSON files from socket and initialize
        const timer = setTimeout(async () => {
            stdout('[CLI BlockTest] Initializing execution...');
            setStarted(true);

            if (scenarioName) {
                const scenario = blockTest.scenarios.find(s => s.name === scenarioName);
                if (!scenario) {
                    stderr(`[Error] Scenario "${scenarioName}" not found.`);
                    return exit(1);
                }
                stdout(`[BlockTest] Found Scenario: "${scenarioName}"`);
                try {
                    await blockTest.executeScenario(scenario);
                    stdout(`[BlockTest] Successfully completed scenario.`);
                    setTimeout(() => exit(0), 1000); // Give time for logs
                } catch (e: any) {
                    stderr(`[Error] Scenario execution failed: ${e.message}`);
                    setTimeout(() => exit(1), 1000);
                }
            } else if (pipelineName) {
                const pipeline = blockTest.pipelines.find(p => p.name === pipelineName);
                if (!pipeline) {
                    stderr(`[Error] Pipeline "${pipelineName}" not found.`);
                    return exit(1);
                }
                stdout(`[BlockTest] Found Pipeline: "${pipelineName}"`);
                try {
                    await blockTest.executePipeline(pipeline);
                    stdout(`[BlockTest] Successfully completed pipeline.`);
                    setTimeout(() => exit(0), 1000);
                } catch (e: any) {
                    stderr(`[Error] Pipeline execution failed: ${e.message}`);
                    setTimeout(() => exit(1), 1000);
                }
            } else {
                stderr(`[Error] No scenario or pipeline specified.`);
                exit(1);
            }
        }, 3000); // 3 seconds to wait for socket load

        return () => clearTimeout(timer);
    }, [blockTest.scenarios, blockTest.pipelines, blockTest.executePipeline, blockTest.executeScenario, scenarioName, pipelineName, started, stdout, stderr, exit]);

    return null;
};

export const CliApp: React.FC = () => {
    const [status, setStatus] = useState('Initializing CLI Mode...');
    const [blockTestPayload, setBlockTestPayload] = useState<any>(null);

    useEffect(() => {
        if (!window.electronAPI || !window.electronAPI.onCliCommand) {
            console.error('[CLI] Electron API or onCliCommand is missing');
            return;
        }

        const logOut = (msg: string) => {
            window.electronAPI.cliStdout(msg + '\n');
        };

        const logErr = (msg: string) => {
            window.electronAPI.cliStderr(msg + '\n');
        };

        const exit = (code: number = 0) => {
            window.electronAPI.cliExit(code);
        };

        const unsubscribe = window.electronAPI.onCliCommand(async (data: any) => {
            try {
                const { command, payload } = data;
                setStatus(`Executing CLI Command: ${command}`);

                if (command === 'log-extractor') {
                    await handleLogExtractor(payload, logOut, logErr);
                    exit(0);
                } else if (command === 'block-test') {
                    setBlockTestPayload(payload);
                    return; // exit() will be called internally by CliBlockTestWrapper
                } else if (command === 'json-tool') {
                    await handleJsonTool(payload, logOut, logErr);
                    exit(0);
                } else if (command === 'post-tool') {
                    await handlePostTool(payload, logOut, logErr);
                    exit(0);
                } else if (command === 'tpk-extractor') {
                    await handleTpkExtractor(payload, logOut, logErr);
                    exit(0);
                } else if (command === 'analyze-diff') {
                    await handleAnalyzeDiff(payload, logOut, logErr);
                    exit(0);
                } else {
                    logErr(`Unknown CLI command: ${command}`);
                    exit(1);
                }
            } catch (error: any) {
                logErr(`[CLI Error] ${error.message}`);
                exit(1);
            }
        });

        // Tell main we are ready
        window.electronAPI.cliReady();
        window.electronAPI.cliStdout('CLI Renderer Ready...\n');

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const handleLogExtractor = async (payload: any, stdout: (msg: string) => void, stderr: (msg: string) => void) => {
        const { filterName, inputPath, outputPath, cwd } = payload;

        let settings: any = null;

        // ✅ CLI 모드에서 Chromium 데이터베이스 잠금으로 인해 localStorage를 못 읽을 경우 대비 🐧📁
        if (window.electronAPI?.getCliSettings) {
            settings = await window.electronAPI.getCliSettings();
        }

        // 파일에서 못 읽었으면 localStorage 시도 (환경에 따라 다를 수 있음)
        if (!settings) {
            const settingsStr = localStorage.getItem('devtool_suite_settings');
            if (settingsStr) {
                settings = JSON.parse(settingsStr);
            }
        }

        if (!settings) {
            throw new Error('No HappyTool settings found. Please run the GUI first to save your filters.');
        }

        const logRules = settings.logRules || [];
        const defaultOutputFolder = settings.defaultOutputFolder || '';

        const matches = logRules.filter((r: any) => r.name === filterName);
        if (matches.length === 0) {
            stderr(`[Error] Filter (Mission) named "${filterName}" does not exist.`);
            return;
        } else if (matches.length > 1) {
            stderr(`[Error] Found ${matches.length} filters named "${filterName}". Please rename them in GUI to be unique.`);
            return;
        }

        const rule = matches[0];
        stdout(`[Log Extractor] Found Filter: "${rule.name}"`);
        stdout(`[Log Extractor] Input: ${inputPath}`);

        // Import utilities dynamically to avoid top-level issues
        const { assembleIncludeGroups } = await import('./utils/filterGroupUtils');
        const LogProcessorWorker = (await import('./workers/LogProcessor.worker.ts?worker')).default;

        const worker = new LogProcessorWorker();
        let totalLines = 0;
        let filteredCount = 0;
        let isFiltering = false;

        return new Promise<void>(async (resolve, reject) => {
            const finalOutputPath = outputPath || (defaultOutputFolder
                ? `${defaultOutputFolder}\\extracted_${Date.now()}.txt`
                : `${cwd}\\extracted_${Date.now()}.txt`);

            worker.onmessage = async (e: MessageEvent) => {
                const { type, payload, requestId } = e.data;

                if (type === 'STATUS_UPDATE' && payload.progress !== undefined) {
                    const statusText = payload.status === 'filtering' ? 'Filtering' : 'Indexing';
                    const progress = Math.round(payload.progress);
                    if (progress % 20 === 0 || progress === 100) {
                        stdout(`[Log Extractor] ${statusText}... ${progress}%`);
                    }
                } else if (type === 'INDEX_COMPLETE') {
                    totalLines = payload.totalLines;
                    stdout(`[Log Extractor] Indexing Complete. Total Lines: ${totalLines.toLocaleString()}`);

                    isFiltering = true;
                    const refinedGroups = assembleIncludeGroups(rule);
                    stdout(`[Log Extractor] Starting Filter Engine...`);
                    worker.postMessage({
                        type: 'FILTER_LOGS',
                        payload: { ...rule, includeGroups: refinedGroups, quickFilter: 'none' }
                    });
                } else if (type === 'FILTER_COMPLETE') {
                    console.log('[DEBUG] FILTER_COMPLETE received:', payload);
                    filteredCount = payload.matchCount !== undefined ? payload.matchCount : payload.count;

                    if (filteredCount === undefined) {
                        stderr(`[Error] FILTER_COMPLETE payload is missing both matchCount and count: ${JSON.stringify(payload)}`);
                        filteredCount = 0;
                    }

                    stdout(`[Log Extractor] Filtering Complete. Match count: ${filteredCount.toLocaleString()}`);

                    if (filteredCount === 0) {
                        stdout(`[Log Extractor] 0 matches found. No file created.`);
                        worker.terminate();
                        resolve();
                        return;
                    }

                    stdout(`[Log Extractor] Preparing export...`);
                    worker.postMessage({ type: 'GET_FULL_TEXT', requestId: 'cli-export' });
                } else if (type === 'FULL_TEXT_DATA' && requestId === 'cli-export') {
                    let content = '';
                    if (payload.buffer) {
                        const decoder = new TextDecoder();
                        content = decoder.decode(payload.buffer);
                    } else {
                        content = payload.text || '';
                    }

                    stdout(`[Log Extractor] Writing to ${finalOutputPath}...`);

                    // ✅ CLI 모드: 다이얼로그 없이 지정 경로에 직접 저장! 🐧🎯
                    const encoder = new TextEncoder();
                    const uint8 = encoder.encode(content);
                    const result = await window.electronAPI!.saveFileDirect(uint8, finalOutputPath);

                    if (result && result.status === 'success') {
                        stdout(`[Success] Extracted logs saved to: ${result.filePath}`);
                    } else {
                        stderr(`[Error] Failed to save file: ${result?.error || 'Unknown error'}`);
                        worker.terminate();
                        reject(new Error(result?.error || 'Failed to save file'));
                        return;
                    }

                    worker.terminate();
                    resolve();
                } else if (type === 'ERROR') {
                    stderr(`[Worker Error] ${payload}`);
                    worker.terminate();
                    reject(new Error(payload));
                } else if (type === 'RPC_REQUEST') {
                    const { method, args } = payload;
                    if (method === 'readFileSegment') {
                        try {
                            const result = await window.electronAPI!.readFileSegment(args);
                            worker.postMessage({ type: 'RPC_RESPONSE', requestId, payload: result });
                        } catch (err: any) {
                            worker.postMessage({ type: 'RPC_ERROR', requestId, payload: { error: err.message } });
                        }
                    } else {
                        worker.postMessage({ type: 'RPC_ERROR', requestId, payload: { error: `Unknown method ${method}` } });
                    }
                }
            };

            worker.onerror = (e) => {
                stderr(`[Worker Fatal Error] ${e.message}`);
                worker.terminate();
                reject(new Error(e.message));
            };

            try {
                const size = await window.electronAPI!.getFileSize(inputPath);
                stdout(`[Log Extractor] File Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
                worker.postMessage({
                    type: 'INIT_LOCAL_FILE_STREAM',
                    payload: { path: inputPath, size }
                });
            } catch (error: any) {
                stderr(`[Error] Failed to initialize file read: ${error.message}`);
                worker.terminate();
                reject(error);
            }
        });
    };

    const handleJsonTool = async (payload: any, stdout: (msg: string) => void, stderr: (msg: string) => void) => {
        const { inputPath, outputPath, cwd } = payload;
        try {
            stdout(`[Json Tool] Reading from ${inputPath}`);
            const content = await window.electronAPI!.readFile(inputPath);
            const parsed = JSON.parse(content);
            const beautified = JSON.stringify(parsed, null, 4);

            const defaultName = inputPath.split(/[/\\]/).pop()?.replace('.json', '_beautified.json') || `beautified_${Date.now()}.json`;
            const finalOutputPath = outputPath || `${cwd}\\${defaultName}`;
            stdout(`[Json Tool] Writing to ${finalOutputPath}...`);

            const encoder = new TextEncoder();
            const uint8 = encoder.encode(beautified);
            const result = await window.electronAPI!.saveFileDirect(uint8, finalOutputPath);

            if (result && result.status === 'success') {
                stdout(`[Success] JSON saved to: ${result.filePath}`);
            } else {
                throw new Error(result?.error || 'Failed to save JSON');
            }
        } catch (e: any) {
            stderr(`[Error] json-tool failed: ${e.message}`);
            throw e;
        }
    };

    const handlePostTool = async (payload: any, stdout: (msg: string) => void, stderr: (msg: string) => void) => {
        const { requestName, cwd } = payload;
        try {
            let settings: any = window.electronAPI?.getCliSettings ? await window.electronAPI.getCliSettings() : null;
            if (!settings) {
                const settingsStr = localStorage.getItem('devtool_suite_settings');
                if (settingsStr) settings = JSON.parse(settingsStr);
            }
            if (!settings || !settings.savedRequests) {
                throw new Error('No HappyTool settings/requests found. Please run GUI first.');
            }

            const req = settings.savedRequests.find((r: any) => r.name === requestName);
            if (!req) {
                throw new Error(`Request named "${requestName}" not found.`);
            }

            stdout(`[Post Tool] Found Request: ${req.name}`);
            stdout(`[Post Tool] Executing ${req.method} ${req.url}`);

            const startTime = performance.now();
            const finalHeaders = req.headers.reduce((acc: any, h: any) => {
                if (h.key) acc[h.key] = h.value;
                return acc;
            }, {});

            const res = await window.electronAPI!.proxyRequest({
                method: req.method,
                url: req.url,
                headers: finalHeaders,
                body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body
            });

            const timeTaken = performance.now() - startTime;

            if (res.error) {
                stderr(`[Error] Request failed: ${res.message}`);
            } else {
                stdout(`[Post Tool] Response: ${res.status} ${res.statusText} (${timeTaken.toFixed(0)}ms)`);
                const dataPreview = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
                stdout(`[Post Tool] Data preview:\n${dataPreview.substring(0, 1500)}${dataPreview.length > 1500 ? '...' : ''}`);
            }
        } catch (e: any) {
            stderr(`[Error] Request execution failed: ${e.message}`);
            throw e;
        }
    };

    const handleTpkExtractor = async (payload: any, stdout: (msg: string) => void, stderr: (msg: string) => void) => {
        const { input, outputPath, cwd } = payload;
        try {
            stdout(`[TPK Extractor] Analyzing input: ${input}`);
            let fileBuffer: any; // Using any to handle Uint8Array/Buffer from IPC
            let finalName = 'extracted.tpk';

            if (input.startsWith('http://') || input.startsWith('https://')) {
                // Fetch directly from URL if it's an RPM URL
                stdout(`[TPK Extractor] Downloading from URL...`);
                fileBuffer = await window.electronAPI!.fetchUrl(input, 'buffer');
                finalName = input.split('/').pop()?.replace('.rpm', '.tpk') || 'extracted.tpk';
            } else {
                const size = await window.electronAPI!.getFileSize(input);
                fileBuffer = await window.electronAPI!.readFileSegment({ path: input, start: 0, end: size });
                finalName = input.split(/[/\\]/).pop()?.replace('.rpm', '.tpk') || 'extracted.tpk';
            }

            const file = new File([fileBuffer], "input.rpm", { type: 'application/x-rpm' });

            const { extractTpkFromRpm } = await import('./utils/rpmParser');
            const result = await extractTpkFromRpm(file, (msg) => stdout(`[TPK Extractor] ${msg}`));

            const finalOutputPath = outputPath || `${cwd}\\${result.name || finalName}`;
            stdout(`[TPK Extractor] Saving to ${finalOutputPath}...`);

            const arrayBuffer = await (new Blob([result.data as BlobPart])).arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // `saveFileDirect` in preload expects (data, filePath)
            const saveRes = await window.electronAPI!.saveFileDirect(uint8Array, finalOutputPath);
            if (saveRes && saveRes.status === 'success') {
                stdout(`[Success] TPK saved to: ${saveRes.filePath}`);
            } else {
                throw new Error(saveRes?.error || 'Failed to save TPK');
            }
        } catch (e: any) {
            stderr(`[Error] TPK Extraction failed: ${e.message}`);
            throw e;
        }
    };

    const handleAnalyzeDiff = async (payload: any, stdout: (msg: string) => void, stderr: (msg: string) => void) => {
        const { filterName, leftPath, rightPath, outputPath, cwd } = payload;

        stdout(`[Analyze Diff] Starting analysis...`);
        stdout(`[Analyze Diff] Filter: ${filterName}`);
        stdout(`[Analyze Diff] Left: ${leftPath}`);
        stdout(`[Analyze Diff] Right: ${rightPath}`);

        // 1. Load Settings
        let settings: any = window.electronAPI?.getCliSettings ? await window.electronAPI.getCliSettings() : null;
        if (!settings) {
            const settingsStr = localStorage.getItem('devtool_suite_settings');
            if (settingsStr) settings = JSON.parse(settingsStr);
        }
        if (!settings) throw new Error('No settings found. Run GUI first.');

        const rule = settings.logRules?.find((r: any) => r.name === filterName);
        if (!rule) throw new Error(`Filter "${filterName}" not found.`);

        const { assembleIncludeGroups } = await import('./utils/filterGroupUtils');
        const LogProcessorWorker = (await import('./workers/LogProcessor.worker.ts?worker')).default;
        const SplitAnalysisWorker = (await import('./workers/SplitAnalysis.worker.ts?worker')).default;

        const leftWorker = new LogProcessorWorker();
        const rightWorker = new LogProcessorWorker();

        const filterLog = (worker: Worker, path: string, side: string) => {
            return new Promise<void>(async (resolve, reject) => {
                worker.onmessage = (e) => {
                    const { type, payload } = e.data;
                    if (type === 'STATUS_UPDATE' && payload.progress !== undefined) {
                        if (payload.progress % 25 === 0 || payload.progress === 100) {
                            stdout(`[Analyze Diff][${side}] Filtering... ${Math.round(payload.progress)}%`);
                        }
                    } else if (type === 'INDEX_COMPLETE') {
                        worker.postMessage({
                            type: 'FILTER_LOGS',
                            payload: { ...rule, includeGroups: assembleIncludeGroups(rule), quickFilter: 'none' }
                        });
                    } else if (type === 'FILTER_COMPLETE') {
                        stdout(`[Analyze Diff][${side}] Filtering Complete. Matches: ${payload.matchCount}`);
                        resolve();
                    } else if (type === 'ERROR') reject(new Error(payload));
                    else if (type === 'RPC_REQUEST') {
                        const { method, args } = payload;
                        if (method === 'readFileSegment') {
                            window.electronAPI!.readFileSegment(args).then(res =>
                                worker.postMessage({ type: 'RPC_RESPONSE', requestId: e.data.requestId, payload: res })
                            ).catch(err =>
                                worker.postMessage({ type: 'RPC_ERROR', requestId: e.data.requestId, payload: { error: err.message } })
                            );
                        }
                    }
                };
                const size = await window.electronAPI!.getFileSize(path);
                worker.postMessage({ type: 'INIT_LOCAL_FILE_STREAM', payload: { path, size } });
            });
        };

        const getMetrics = (worker: Worker, side: string) => {
            return new Promise<any>((resolve) => {
                const reqId = `cli-${side}-metrics`;
                const listener = (e: MessageEvent) => {
                    if (e.data.type === 'ANALYSIS_METRICS_RESULT' && e.data.requestId === reqId) {
                        worker.removeEventListener('message', listener);
                        resolve(e.data.payload);
                    } else if (e.data.type === 'ALIAS_EVENTS_RESULT' && e.data.requestId === `cli-${side}-alias`) {
                        // We'll handle this separately if needed, but metrics result usually carries both in some contexts
                    }
                };
                worker.addEventListener('message', listener);
                worker.postMessage({ type: 'GET_ANALYSIS_METRICS', payload: { side }, requestId: reqId });
            });
        };

        const getAliasEvents = (worker: Worker, side: string) => {
            return new Promise<any[]>((resolve) => {
                const reqId = `cli-${side}-alias`;
                const listener = (e: MessageEvent) => {
                    if (e.data.type === 'ALIAS_EVENTS_RESULT' && e.data.requestId === reqId) {
                        worker.removeEventListener('message', listener);
                        resolve(e.data.payload.events || []);
                    }
                };
                worker.addEventListener('message', listener);
                worker.postMessage({ type: 'GET_ALIAS_EVENTS', requestId: reqId });
            });
        };

        try {
            // Filter both logs in parallel
            await Promise.all([
                filterLog(leftWorker, leftPath, 'LEFT'),
                filterLog(rightWorker, rightPath, 'RIGHT')
            ]);

            stdout(`[Analyze Diff] Extracting metrics...`);
            const [leftData, rightData, leftAlias, rightAlias] = await Promise.all([
                getMetrics(leftWorker, 'left'),
                getMetrics(rightWorker, 'right'),
                getAliasEvents(leftWorker, 'left'),
                getAliasEvents(rightWorker, 'right')
            ]);

            stdout(`[Analyze Diff] Running comparison analysis...`);
            const analyzer = new SplitAnalysisWorker();
            const results = await new Promise<any>((resolve) => {
                analyzer.onmessage = (e) => {
                    if (e.data.type === 'SPLIT_ANALYSIS_COMPLETE') resolve(e.data.payload);
                };
                analyzer.postMessage({
                    leftMetrics: leftData.metrics,
                    rightMetrics: rightData.metrics,
                    leftPointMetrics: leftData.pointMetrics,
                    rightPointMetrics: rightData.pointMetrics,
                    leftAliasEvents: leftAlias,
                    rightAliasEvents: rightAlias
                });
            });

            // Calculate Summary (Copy logic from SplitAnalyzerPanel)
            const intervalResults = (results.results || []).filter((r: any) => (r.leftAvgDelta > 0 && r.rightAvgDelta > 0) || r.isAliasInterval);
            const pointResults = results.pointResults || [];

            const summary = {
                newErrors: intervalResults.filter((r: any) => r.isNewError).length,
                regressions: intervalResults.filter((r: any) => r.deltaDiff > 10).length,
                improvements: intervalResults.filter((r: any) => r.deltaDiff < -10).length,
                newLogs: pointResults.length,
                totalSegments: intervalResults.length
            };

            // 🐧🎯 CLI 결과 정렬: UI와 동일하게 시간 순서(라인 번호)로 정렬
            const sortedTimeline = [...results.results]
                .filter((r: any) => (r.leftAvgDelta > 0 && r.rightAvgDelta > 0) || r.isAliasInterval)
                .sort((a, b) => {
                    const aIdx = a.leftPrevLineNum || a.rightPrevLineNum || 0;
                    const bIdx = b.leftPrevLineNum || b.rightPrevLineNum || 0;
                    return aIdx - bIdx;
                })
                .map((r: any) => ({
                    key: r.key,
                    leftAvgDelta: r.leftAvgDelta,
                    rightAvgDelta: r.rightAvgDelta,
                    deltaDiff: r.deltaDiff
                }));

            const sortedPointResults = [...results.pointResults]
                .sort((a, b) => {
                    const aIdx = a.originalLineNums?.[0] || 0;
                    const bIdx = b.originalLineNums?.[0] || 0;
                    return aIdx - bIdx;
                })
                .map((r: any) => ({
                    sig: r.sig,
                    count: r.count
                }));

            const finalData = {
                filterName,
                timestamp: new Date().toISOString(),
                files: { left: leftPath, right: rightPath },
                summary,
                timeline: sortedTimeline,
                newLogs: sortedPointResults
            };

            const finalOutputPath = outputPath || `${cwd}\\diff_result_${Date.now()}.json`;
            stdout(`[Analyze Diff] Saving result to ${finalOutputPath}...`);

            const content = JSON.stringify(finalData, null, 2);
            const encoder = new TextEncoder();
            const uint8 = encoder.encode(content);
            await window.electronAPI!.saveFileDirect(uint8, finalOutputPath);

            stdout(`[Success] Analysis complete. Result saved to: ${finalOutputPath}`);

            leftWorker.terminate();
            rightWorker.terminate();
            analyzer.terminate();

        } catch (e: any) {
            stderr(`[Error] Analyze Diff failed: ${e.message}`);
            leftWorker.terminate();
            rightWorker.terminate();
            throw e;
        }
    };
    return (
        <div style={{ padding: 20, background: '#000', color: '#0f0', fontFamily: 'monospace', height: '100vh', width: '100vw' }}>
            <h1>HappyTool CLI Runner (Hidden window)</h1>
            <p>Status: {status}</p>
            <p>This window handles IndexedDB and WASM capabilities in the background.</p>
            {blockTestPayload && (
                <CliBlockTestWrapper
                    payload={blockTestPayload}
                    stdout={(msg) => window.electronAPI.cliStdout(msg + '\n')}
                    stderr={(msg) => window.electronAPI.cliStderr(msg + '\n')}
                    exit={(code) => window.electronAPI.cliExit(code)}
                />
            )}
        </div>
    );
};

export default CliApp;
