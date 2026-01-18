import { useState, useEffect, useCallback, useRef } from 'react';

import { CommandBlock, Pipeline, TestResult, PipelineItem, ExecutionStats, Scenario } from '../types';
import { PREDEFINED_BLOCKS, SPECIAL_BLOCKS, SPECIAL_BLOCK_IDS } from '../constants';
import { generateHtmlReport } from '../../../utils/reportGenerator';
import { io, Socket } from 'socket.io-client';

// We need a way to access the socket. usually passed via context or imported.
// In this project, it seems `useHappyTool` provides data, but does it provide socket?
// Checking `HappyToolContext.tsx` would be ideal, but based on `server/index.js` edits, the socket is global or we might need to connect.
// The `LogViewerPane` edits in previous tasks suggest `tizenSocket`.
// I'll assume I can get a socket or create one.
// EXISTING PATTERN: `const socket = io('http://localhost:3002');` in components.

export const useBlockTest = () => {
    const [blocks, setBlocks] = useState<CommandBlock[]>(() => {
        try {
            const saved = localStorage.getItem('happytool_blocks');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load blocks from localStorage", e);
        }
        return [...PREDEFINED_BLOCKS, ...SPECIAL_BLOCKS];
    });

    const [pipelines, setPipelines] = useState<Pipeline[]>(() => {
        try {
            const saved = localStorage.getItem('happytool_pipelines');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load pipelines from localStorage", e);
        }
        return [];
    });

    const [scenarios, setScenarios] = useState<Scenario[]>(() => {
        try {
            const saved = localStorage.getItem('happytool_scenarios');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load scenarios from localStorage", e);
        }
        return [];
    });
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
    const [activePipelineItemId, setActivePipelineItemId] = useState<string | null>(null);
    const [executionStats, setExecutionStatsState] = useState<ExecutionStats>({});
    // Ref for synchronous access during async execution
    const executionStatsRef = useRef<ExecutionStats>({});

    const setExecutionStats = (update: React.SetStateAction<ExecutionStats>) => {
        setExecutionStatsState(prev => {
            const next = typeof update === 'function' ? update(prev) : update;
            executionStatsRef.current = next;
            return next;
        });
    };

    // Scenario Execution State
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [scenarioStats, setScenarioStats] = useState<Record<string, { status: 'pending' | 'running' | 'success' | 'failed', error?: string }>>({});

    // Report State
    const [lastReportUrl, setLastReportUrl] = useState<string | null>(null);

    // Socket ref
    const socketRef = useRef<Socket | null>(null);
    const fullLogsRef = useRef<string[]>([]);
    const activeLogIds = useRef<Set<string>>(new Set());
    const lastItemSuccessRef = useRef<boolean>(true);

    useEffect(() => {
        socketRef.current = io('http://127.0.0.1:3003');

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log("BlockTest connected to server");
            // Load initial data
            socket.emit('load_file', { filename: 'blocks.json' });
            socket.emit('load_file', { filename: 'pipelines.json' });
            socket.emit('load_file', { filename: 'scenarios.json' });
        });

        socket.on('load_file_result', ({ filename, success, content, error }: any) => {
            if (!success) {
                console.warn(`Failed to load ${filename}:`, error);
                return;
            }
            try {
                if (filename === 'blocks.json') {
                    const loaded: CommandBlock[] = JSON.parse(content);

                    // Merge loaded blocks with predefined/special to ensure we have all required blocks,
                    // but prefer the loaded version if it exists (to persist edits).
                    const loadedMap = new Map(loaded.map(b => [b.id, b]));

                    const mergedPredefined = PREDEFINED_BLOCKS.map(b => loadedMap.get(b.id) || b);
                    const mergedSpecial = SPECIAL_BLOCKS.map(b => loadedMap.get(b.id) || b);
                    const custom = loaded.filter(b => b.type === 'custom');

                    setBlocks([...mergedPredefined, ...mergedSpecial, ...custom]);
                } else if (filename === 'pipelines.json') {
                    setPipelines(JSON.parse(content));
                } else if (filename === 'scenarios.json') {
                    setScenarios(JSON.parse(content));
                }
            } catch (e) {
                console.error(`Error parsing ${filename}`, e);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        const handleImport = () => {
            const b = localStorage.getItem('happytool_blocks');
            const p = localStorage.getItem('happytool_pipelines');
            if (b) {
                try {
                    const parsedBlocks = JSON.parse(b);
                    setBlocks(parsedBlocks);
                    socketRef.current?.emit('save_file', { filename: 'blocks.json', content: b });
                } catch (e) {
                    console.error("Failed to import blocks", e);
                }
            }
            if (p) {
                try {
                    const parsedPipelines = JSON.parse(p);
                    if (Array.isArray(parsedPipelines)) {
                        const validPipelines = parsedPipelines.filter((p: any) => p && p.id);
                        setPipelines(validPipelines);
                    }
                    socketRef.current?.emit('save_file', { filename: 'pipelines.json', content: p });
                } catch (e) {
                    console.error("Failed to import pipelines", e);
                }
            }
            const s = localStorage.getItem('happytool_scenarios');
            if (s) {
                try {
                    const parsed = JSON.parse(s);
                    setScenarios(parsed);
                    socketRef.current?.emit('save_file', { filename: 'scenarios.json', content: s });
                } catch (e) {
                    console.error("Failed to import scenarios", e);
                }
            }
        };
        window.addEventListener('happytool:settings-imported', handleImport);
        return () => window.removeEventListener('happytool:settings-imported', handleImport);
    }, []);

    const saveBlocks = useCallback((newBlocks: CommandBlock[]) => {
        setBlocks(newBlocks);
        localStorage.setItem('happytool_blocks', JSON.stringify(newBlocks));
        if (socketRef.current) {
            socketRef.current.emit('save_file', {
                filename: 'blocks.json',
                content: JSON.stringify(newBlocks, null, 2)
            });
        }
    }, []);

    const savePipelines = useCallback((newPipelines: Pipeline[]) => {
        // Double check for validity
        const validPipelines = newPipelines.filter(p => p && p.id);
        setPipelines(validPipelines);
        localStorage.setItem('happytool_pipelines', JSON.stringify(validPipelines));
        if (socketRef.current) {
            socketRef.current.emit('save_file', {
                filename: 'pipelines.json',
                content: JSON.stringify(validPipelines, null, 2)
            });
        }
    }, []);

    const saveScenarios = useCallback((newScenarios: Scenario[]) => {
        setScenarios(newScenarios);
        localStorage.setItem('happytool_scenarios', JSON.stringify(newScenarios));
        if (socketRef.current) {
            socketRef.current.emit('save_file', {
                filename: 'scenarios.json',
                content: JSON.stringify(newScenarios, null, 2)
            });
        }
    }, []);

    const addBlock = (block: CommandBlock) => {
        saveBlocks([...blocks, block]);
    };

    const updateBlock = (updatedBlock: CommandBlock) => {
        // Allow updates for all types, including predefined
        const nextBlocks = blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b);
        saveBlocks(nextBlocks);
    };

    const deleteBlock = (id: string) => {
        // Prevent deleting predefined
        if (PREDEFINED_BLOCKS.find(p => p.id === id) || SPECIAL_BLOCKS.find(s => s.id === id)) return;
        const nextBlocks = blocks.filter(b => b.id !== id);
        saveBlocks(nextBlocks);
    };

    const addPipeline = (pipeline: Pipeline) => {
        savePipelines([...pipelines, pipeline]);
    };

    const updatePipeline = (pipeline: Pipeline) => {
        if (!pipeline || !pipeline.id) return;
        const next = pipelines.map(p => (p && p.id === pipeline.id) ? pipeline : p).filter(Boolean);
        savePipelines(next);
    };

    const deletePipeline = (id: string) => {
        savePipelines(pipelines.filter(p => p.id !== id));
    };

    const addScenario = (scenario: Scenario) => {
        saveScenarios([...scenarios, scenario]);
    };

    const updateScenario = (scenario: Scenario) => {
        if (!scenario || !scenario.id) return;
        saveScenarios(scenarios.map(s => s.id === scenario.id ? scenario : s));
    };

    const deleteScenario = (id: string) => {
        saveScenarios(scenarios.filter(s => s.id !== id));
    };

    const [completedStepCount, setCompletedStepCount] = useState(0);
    const [isRunnerOpen, setIsRunnerOpen] = useState(false);

    // Abort Controller for stopping execution
    const abortController = useRef<AbortController | null>(null);

    const stopPipeline = useCallback(() => {
        if (abortController.current) {
            abortController.current.abort();
        }
    }, []);

    const closePipelineRunner = useCallback(() => {
        setActivePipelineId(null);
        setActivePipelineItemId(null);
        setExecutionStats({}); // Optional: clear stats on close? Or keep until next run? Let's keep stats until re-run.
        // Actually, maybe we only clear active IDs.
        setIsRunnerOpen(false);
    }, []);

    // Execution Logic
    const runCommand = (cmd: string, signal?: AbortSignal): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!socketRef.current) return reject(new Error("Socket not connected"));

            const requestId = Math.random().toString(36).substring(7);

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Command timed out (10s)"));
            }, 10000);

            const handleResult = (res: any) => {
                if (res.requestId === requestId) {
                    cleanup();
                    resolve(res.output);
                }
            };

            const handleDebug = (res: any) => {
                if (res.requestId === requestId) {
                    console.log(`[Server Process Debug]: ${res.message}`);
                }
            };

            const onAbort = () => {
                cleanup();
                reject(new Error("Pipeline Stopped"));
            };

            const cleanup = () => {
                clearTimeout(timeout);
                socketRef.current?.off('host_command_result', handleResult);
                socketRef.current?.off('host_command_debug', handleDebug);
                signal?.removeEventListener('abort', onAbort);
            };

            signal?.addEventListener('abort', onAbort);
            socketRef.current.on('host_command_result', handleResult);
            socketRef.current.on('host_command_debug', handleDebug);
            socketRef.current.emit('run_host_command', { command: cmd, requestId });
        });
    };

    const runWaitForImage = (templatePath: string, timeoutMs: number): Promise<{ success: boolean, message?: string, confidence?: number }> => {
        return new Promise((resolve, reject) => {
            if (!socketRef.current) return reject(new Error("Socket not connected"));

            // One-off listener might be tricky if multiple running, but for blocking pipeline it's fine.
            // Better to use a requestId if server supported it for this event, but currently server doesn't echo it for match.
            // Assumption: Sequential execution.

            const handleResult = (res: any) => {
                cleanup();
                resolve(res);
            };

            const cleanup = () => {
                socketRef.current?.off('wait_for_image_result', handleResult);
            };

            socketRef.current.on('wait_for_image_result', handleResult);
            socketRef.current.emit('wait_for_image_match', { templatePath, timeoutMs });
        });
    };

    const replaceVariables = (cmd: string, context: { loopIndex?: number, loopTotal?: number, timeStart: string }) => {
        const now = new Date();
        const timeCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

        return cmd
            .replace(/\$\(loop_total\)/g, String(context.loopTotal || 1))
            .replace(/\$\(loop_index\)/g, String(context.loopIndex || 1))
            .replace(/\$\(time_current\)/g, timeCurrent)
            .replace(/\$\(time_start\)/g, context.timeStart);
    };

    const saveReport = (pipelineName: string, stats: any, logs: string[], startTimeStr?: string, isFailure: boolean = false) => {
        const reportHtml = generateHtmlReport(pipelineName, stats, logs);
        const timestamp = startTimeStr || new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = pipelineName.replace(/[^a-z0-9]/gi, '_');
        let reportFilename = `report_${safeName}_${timestamp}.html`;

        if (isFailure) {
            reportFilename = `report_FAIL_${safeName}_${timestamp}.html`;
        }

        const fullPath = `reports/${reportFilename}`;

        if (socketRef.current) {
            socketRef.current.emit('save_file', {
                filename: fullPath,
                content: reportHtml
            });
            // Update UI
            setLastReportUrl(`http://127.0.0.1:3003/blocktest/${fullPath}`);
        }
    };

    const executePipeline = async (pipeline: Pipeline) => {
        if (isRunning) return;
        setIsRunning(true);
        setIsRunnerOpen(true);
        setActivePipelineId(pipeline.id);
        setExecutionLogs([]);
        fullLogsRef.current = []; // Clear full logs
        setExecutionStats({});
        executionStatsRef.current = {}; // Ensure ref is cleared
        setCompletedStepCount(0);
        lastItemSuccessRef.current = true;

        abortController.current = new AbortController();

        const logs: string[] = [];
        const log = (msg: string) => {
            fullLogsRef.current.push(msg); // Store in full logs
            setExecutionLogs(prev => {
                const next = [...prev, msg];
                if (next.length > 5000) return next.slice(next.length - 5000);
                return next;
            });
        };

        log(`Starting Pipeline: ${pipeline.name}`);

        try {
            // Initial Delay (Static View)
            setActivePipelineItemId(null);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Focus on start node briefly
            setActivePipelineItemId('start-node');
            await new Promise(resolve => setTimeout(resolve, 100)); // Quick tick to allow layout to capture 'start-node'

            const now = new Date();
            const startTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

            await executeItems(pipeline.items, log, { timeStart: startTimeStr });
            log("Pipeline Completed Successfully");

            // Generate Report
            saveReport(pipeline.name, executionStatsRef.current, fullLogsRef.current, startTimeStr);


        } catch (e: any) {
            if (e.message === 'Pipeline Stopped') {
                log("!! Pipeline Stopped by User !!");
            } else {
                log(`Pipeline Failed: ${e.message}`);
            }
            // Generate Report even on failure
            saveReport(pipeline.name, executionStatsRef.current, fullLogsRef.current, undefined, true);


        } finally {
            setIsRunning(false);
            setCurrentBlockId(null);
            setActivePipelineItemId(null); // Clear active item so graph doesn't jump to it
            // activePipelineId remains set so view stays open
        }
    };

    const executeScenario = async (scenario: Scenario) => {
        if (isRunning) return;
        setIsRunning(true);
        setIsRunnerOpen(true);
        setActiveScenarioId(scenario.id);
        setActivePipelineId(null); // Will set per step
        setExecutionLogs([]);
        fullLogsRef.current = [];
        setExecutionStats({}); // Clear detailed stats
        executionStatsRef.current = {};
        setCompletedStepCount(0); // Also need to clear this if used anywhere logically

        // Initialize Scenario Stats
        const initialStats: Record<string, { status: 'pending' | 'running' | 'success' | 'failed', error?: string }> = {};
        scenario.steps.forEach(s => initialStats[s.id] = { status: 'pending' });
        setScenarioStats(initialStats);

        abortController.current = new AbortController();

        const log = (msg: string) => {
            fullLogsRef.current.push(msg);
            setExecutionLogs(prev => {
                const next = [...prev, msg];
                if (next.length > 5000) return next.slice(next.length - 5000);
                return next;
            });
        };

        log(`Starting Scenario: ${scenario.name}`);
        const startTimeStr = new Date().toISOString().split('T')[0]; // Simple date for now or use formatted

        try {
            for (const step of scenario.steps) {
                if (!step.enabled) continue;
                if (abortController.current?.signal.aborted) break;

                const pipeline = pipelines.find(p => p.id === step.pipelineId);
                if (!pipeline) {
                    log(`Error: Pipeline ${step.pipelineId} not found`);
                    setScenarioStats(prev => ({ ...prev, [step.id]: { status: 'failed', error: 'Pipeline not found' } }));
                    continue;
                }

                log(`>> Starting Step: ${pipeline.name}`);
                setActivePipelineId(pipeline.id); // Update UI to show this pipeline
                setScenarioStats(prev => ({ ...prev, [step.id]: { status: 'running' } }));

                // Clear pipeline-specific stats for visualization
                setExecutionStats({});
                executionStatsRef.current = {};
                setCompletedStepCount(0);

                // Wait a bit for UI
                await new Promise(r => setTimeout(r, 500));

                const now = new Date();
                const stepStartTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

                try {
                    await executeItems(pipeline.items, log, { timeStart: stepStartTime });
                    setScenarioStats(prev => ({ ...prev, [step.id]: { status: 'success' } }));

                    log(`>> Step Completed: ${pipeline.name}`);

                    // Generate Report for this step
                    // Use Ref to get the stats accumulated during executeItems
                    saveReport(pipeline.name, executionStatsRef.current, fullLogsRef.current, stepStartTime);


                } catch (e: any) {
                    setScenarioStats(prev => ({ ...prev, [step.id]: { status: 'failed', error: e.message } }));

                    log(`>> Step Failed: ${pipeline.name} - ${e.message}`);
                    saveReport(pipeline.name, executionStatsRef.current, fullLogsRef.current, undefined, true);
                    throw e; // Stop scenario on failure

                }

                // Pause between steps?
                await new Promise(r => setTimeout(r, 1000));
            }
            log("Scenario Completed Successfully");
        } catch (e: any) {
            if (e.message === 'Pipeline Stopped') {
                log("!! Scenario Stopped by User !!");
            } else {
                log(`Scenario Failed: ${e.message}`);
            }
        } finally {
            setIsRunning(false);
            // Don't clear activeScenarioId immediately so user can see result
        }
    };

    const executeItems = async (items: PipelineItem[], log: (msg: string) => void, context: { loopIndex?: number, loopTotal?: number, timeStart: string }) => {
        for (const item of items) {
            if (abortController.current?.signal.aborted) {
                throw new Error('Pipeline Stopped');
            }

            setActivePipelineItemId(item.id);

            // --- CONDITIONAL ---
            if (item.type === 'conditional') {
                log(`[Conditional] Checking condition...`);
                const startTime = Date.now();
                setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running' } }));

                // Determine condition result
                let conditionMet = false;
                if (item.condition?.type === 'last_step_success' || !item.condition?.type) {
                    conditionMet = lastItemSuccessRef.current;
                    log(`  > Last Step Success? ${conditionMet ? 'YES' : 'NO'}`);
                }
                // Future: else if (item.condition?.type === 'variable_match') ...

                const endTime = Date.now();
                setExecutionStats(prev => ({
                    ...prev,
                    [item.id]: {
                        startTime,
                        endTime,
                        duration: endTime - startTime,
                        status: 'success',
                        result: conditionMet // Store result for UI
                    }
                }));

                if (conditionMet) {
                    log(`  > TRUE Branch`);
                    if (item.children && item.children.length > 0) {
                        await executeItems(item.children, log, context);
                    }
                } else {
                    log(`  > FALSE Branch`);
                    if (item.elseChildren && item.elseChildren.length > 0) {
                        await executeItems(item.elseChildren, log, context);
                    }
                }
                lastItemSuccessRef.current = true; // Conditional itself succeeded
                continue;
            }

            // --- LOOP ---
            if (item.type === 'loop') {
                const count = item.loopCount || 1;
                log(`-- Starting Loop (${count} times) --`);

                // Track Loop stats
                const startTime = Date.now();
                setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running', currentIteration: 0, totalIterations: count } }));

                try {
                    for (let i = 0; i < count; i++) {
                        if (abortController.current?.signal.aborted) throw new Error('Pipeline Stopped');
                        log(`Loop Iteration ${i + 1}/${count}`);

                        // Update loop progress
                        setExecutionStats(prev => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], currentIteration: i + 1 }
                        }));

                        if (item.children) await executeItems(item.children, log, { ...context, loopIndex: i + 1, loopTotal: count });
                    }

                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: { startTime, endTime, duration, status: 'success', currentIteration: count, totalIterations: count }
                    }));
                    lastItemSuccessRef.current = true; // Loop completed successfully
                } catch (err) {
                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], endTime, duration, status: 'error' }
                    }));
                    lastItemSuccessRef.current = false;
                    throw err;
                }

                log(`-- Loop Ended --`);
            }
            // --- BLOCK ---
            else if (item.type === 'block' && item.blockId) {
                // Sleep Handling
                if (item.blockId === SPECIAL_BLOCK_IDS.SLEEP) {
                    const duration = item.sleepDuration || 1000;
                    log(`[Sleep] Waiting ${duration}ms...`);

                    const startTime = Date.now();
                    setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running' } }));

                    await new Promise(resolve => setTimeout(resolve, duration));

                    const endTime = Date.now();
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: {
                            startTime,
                            endTime,
                            duration: endTime - startTime,
                            status: 'success'
                        }
                    }));
                    setCompletedStepCount(prev => prev + 1);
                    lastItemSuccessRef.current = true;
                    continue;
                } else if (item.blockId === SPECIAL_BLOCK_IDS.LOG_START) {
                    // Replace variables in filename
                    let filename = item.logFileName || 'log_$(time_current).txt';
                    filename = replaceVariables(filename, context);

                    log(`[Block] Starting Background Log: ${item.logCommand} -> ${filename}`);

                    if (!socketRef.current) {
                        log(`[Block] Log Start Failed: Socket not connected`);
                        lastItemSuccessRef.current = false;
                        continue;
                    }

                    // Update stats with resolved label (filename)
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: {
                            startTime: Date.now(),
                            status: 'running',
                            resolvedLabel: filename
                        }
                    }));

                    await new Promise<void>((resolve) => {
                        socketRef.current?.emit('start_background_log', { command: item.logCommand, filename });

                        const handler = (data: { success: boolean, logId?: string, error?: string }) => {
                            if (data.success) {
                                log(`[Block] Log Started ID: ${data.logId}`);
                                activeLogIds.current.add(data.logId!);
                                lastItemSuccessRef.current = true;
                                resolve();
                            } else {
                                log(`[Block] Log Start Failed: ${data.error}`);
                                lastItemSuccessRef.current = false;
                                resolve();
                            }
                            socketRef.current?.off('start_background_log_result', handler);
                        };
                        socketRef.current?.on('start_background_log_result', handler);
                        setTimeout(() => {
                            socketRef.current?.off('start_background_log_result', handler);
                            resolve();
                        }, 5000);
                    });
                    setCompletedStepCount(prev => prev + 1);
                    continue;

                } else if (item.blockId === SPECIAL_BLOCK_IDS.LOG_STOP) {
                    log(`[Block] Stopping Background Logs...`);

                    const logIds = Array.from(activeLogIds.current);
                    if (logIds.length === 0) {
                        log(`[Block] No active logs to stop.`);
                        setCompletedStepCount(prev => prev + 1);
                        lastItemSuccessRef.current = true;
                        continue;
                    }

                    if (!socketRef.current) {
                        log(`[Block] Log Stop Failed: Socket not connected`);
                        setCompletedStepCount(prev => prev + 1);
                        lastItemSuccessRef.current = false;
                        continue;
                    }

                    const promises = logIds.map(id => new Promise<void>(resolve => {
                        socketRef.current?.emit('stop_background_log', { logId: id, stopCommand: item.stopCommand });
                        const handler = (data: { success: boolean, logId?: string }) => {
                            if (data.logId === id) {
                                log(`[Block] Log Stopped ID: ${data.logId}`);
                                activeLogIds.current.delete(id);
                                socketRef.current?.off('stop_background_log_result', handler);
                                resolve();
                            }
                        };
                        socketRef.current?.on('stop_background_log_result', handler);
                        setTimeout(() => {
                            socketRef.current?.off('stop_background_log_result', handler);
                            resolve();
                        }, 2000);
                    }));

                    await Promise.all(promises).then(() => {
                        log(`[Block] All logs stopped.`);
                    });
                    setCompletedStepCount(prev => prev + 1);
                    lastItemSuccessRef.current = true;
                    continue;

                } else if (item.blockId === SPECIAL_BLOCK_IDS.WAIT_FOR_IMAGE) {
                    const timeoutMs = item.matchTimeout || 10000;
                    const templatePath = item.imageTemplatePath;

                    if (!templatePath) {
                        log(`[Wait Image] Error: No template image specified`);
                        setExecutionStats(prev => ({
                            ...prev,
                            [item.id]: { startTime: Date.now(), endTime: Date.now(), duration: 0, status: 'error' }
                        }));
                        lastItemSuccessRef.current = false;
                        continue;
                    }

                    log(`[Wait Image] Waiting for image match (max ${timeoutMs / 1000}s)...`);
                    const startTime = Date.now();
                    setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running' } }));

                    try {
                        const result = await runWaitForImage(templatePath, timeoutMs);

                        const endTime = Date.now();
                        const duration = endTime - startTime;

                        if (result.success) {
                            log(`[Wait Image] Match Found! Confidence: ${result.confidence?.toFixed(2)}`);
                            setExecutionStats(prev => ({
                                ...prev,
                                [item.id]: { startTime, endTime, duration, status: 'success' }
                            }));
                            lastItemSuccessRef.current = true;
                        } else {
                            log(`[Wait Image] Failed: ${result.message || 'Timeout'}`);
                            setExecutionStats(prev => ({
                                ...prev,
                                [item.id]: { startTime, endTime, duration, status: 'error' }
                            }));
                            lastItemSuccessRef.current = false;
                            // Don't throw, just let it continue with lastItemSuccess=false
                        }
                    } catch (e: any) {
                        const endTime = Date.now();
                        setExecutionStats(prev => ({
                            ...prev,
                            [item.id]: { startTime, endTime, duration: endTime - startTime, status: 'error' }
                        }));
                        lastItemSuccessRef.current = false;
                        log(`[Wait Image] Exception: ${e.message}`);
                    }

                    setCompletedStepCount(prev => prev + 1);
                    continue;
                }

                const block = blocks.find(b => b.id === item.blockId);
                if (!block) {
                    log(`Error: Block ${item.blockId} not found`);
                    continue;
                }
                setCurrentBlockId(block.id);
                log(`[${block.name}] Executing...`);

                const startTime = Date.now();
                setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running' } }));

                let hasError = false;
                try {
                    for (const rawCmd of block.commands) {
                        if (abortController.current?.signal.aborted) throw new Error('Pipeline Stopped');

                        const cmd = replaceVariables(rawCmd, context);
                        log(`  $ ${cmd}`);

                        const output = await runCommand(cmd, abortController.current?.signal);
                        log(`  > ${output}`);
                        if (output.toLowerCase().includes('error')) {
                            hasError = true;
                        }
                    }
                } catch (e: any) {
                    if (e.message === 'Pipeline Stopped') throw e;
                    hasError = true;
                    log(`  ! Error: ${e.message || e}`);
                }

                const endTime = Date.now();
                const duration = endTime - startTime;
                setExecutionStats(prev => ({
                    ...prev,
                    [item.id]: { startTime, endTime, duration, status: hasError ? 'error' : 'success' }
                }));

                setCompletedStepCount(prev => prev + 1);
                lastItemSuccessRef.current = !hasError;

                if (hasError) {
                    // Continuing despite error
                }
            }
        }
    };

    const downloadLogs = useCallback(() => {
        const content = fullLogsRef.current.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    return {
        blocks,
        pipelines,
        addBlock,
        updateBlock,
        deleteBlock,
        addPipeline,
        updatePipeline,
        deletePipeline,
        scenarios,
        addScenario,
        updateScenario,
        deleteScenario,
        executePipeline,
        executeScenario,
        activeScenarioId,
        scenarioStats,
        stopPipeline,
        closePipelineRunner,
        downloadLogs,
        uploadTemplate: (name: string, data: string) => {
            return new Promise<{ success: boolean, path: string, url?: string }>((resolve) => {
                if (!socketRef.current) return resolve({ success: false, path: '' });

                const handler = (res: any) => {
                    console.log("DEBUG: [useBlockTest] Upload Result:", res);
                    socketRef.current?.off('save_uploaded_template_result', handler);
                    resolve(res);
                };
                socketRef.current.on('save_uploaded_template_result', handler);
                socketRef.current.emit('save_uploaded_template', { name, data });
            });
        },
        isRunning,
        executionLogs,
        currentBlockId,
        activePipelineId, // This is now persistent
        activePipelineItemId,
        executionStats,
        completedStepCount, // Export this
        isRunnerOpen,
        setIsRunnerOpen,
        lastReportUrl // Export
    };
};
