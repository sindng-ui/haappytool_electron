import { useState, useEffect, useCallback, useRef } from 'react';

import { CommandBlock, Pipeline, TestResult, PipelineItem, ExecutionStats } from '../types';
import { PREDEFINED_BLOCKS, SPECIAL_BLOCKS, SPECIAL_BLOCK_IDS } from '../constants';
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
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
    const [activePipelineItemId, setActivePipelineItemId] = useState<string | null>(null);
    const [executionStats, setExecutionStats] = useState<ExecutionStats>({});

    // Socket ref
    const socketRef = useRef<Socket | null>(null);
    const fullLogsRef = useRef<string[]>([]);
    const activeLogIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        socketRef.current = io('http://localhost:3003');

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log("BlockTest connected to server");
            // Load initial data
            socket.emit('load_file', { filename: 'blocks.json' });
            socket.emit('load_file', { filename: 'pipelines.json' });
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

    const executePipeline = async (pipeline: Pipeline) => {
        if (isRunning) return;
        setIsRunning(true);
        setIsRunnerOpen(true);
        setActivePipelineId(pipeline.id);
        setExecutionLogs([]);
        fullLogsRef.current = []; // Clear full logs
        setExecutionStats({});
        setCompletedStepCount(0);

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
        } catch (e: any) {
            if (e.message === 'Pipeline Stopped') {
                log("!! Pipeline Stopped by User !!");
            } else {
                log(`Pipeline Failed: ${e.message}`);
            }
        } finally {
            setIsRunning(false);
            setCurrentBlockId(null);
            setActivePipelineItemId(null); // Clear active item so graph doesn't jump to it
            // activePipelineId remains set so view stays open
        }
    };

    const executeItems = async (items: PipelineItem[], log: (msg: string) => void, context: { loopIndex?: number, loopTotal?: number, timeStart: string }) => {
        for (const item of items) {
            if (abortController.current?.signal.aborted) {
                throw new Error('Pipeline Stopped');
            }

            setActivePipelineItemId(item.id);
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
                } catch (err) {
                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    // If stopped, maybe mark as error or just partial? User said "Error" if error.
                    // Stopped is technically not an error in logic, but execution stopped.
                    // Let's mark as Error for visual feedback if it was aborted mid-loop.
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], endTime, duration, status: 'error' }
                    }));
                    throw err;
                }

                log(`-- Loop Ended --`);
            } else if (item.type === 'block' && item.blockId) {
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
                    continue;
                } else if (item.blockId === SPECIAL_BLOCK_IDS.LOG_START) {
                    // Replace variables in filename
                    // Replace variables in filename
                    let filename = item.logFileName || 'log_$(time_current).txt';
                    // Use helper to replace all supported variables (loop_index, loop_total, time_current, time_start)
                    filename = replaceVariables(filename, context);

                    log(`[Block] Starting Background Log: ${item.logCommand} -> ${filename}`);
                    // if inside loop, replace loop_index needed?
                    // Currently we don't have easy context access here unless we pass it down.
                    // For now supporting time_current. 
                    // Prompt requested: "$(time_current).$(loop_index)".
                    // Loop index is harder as it's stateful in the recursive logic.
                    // Let's implement variable replacement in `processItem` arguments if possible, or context.
                    // Actually, `processItem` is recursive.
                    // Let's assume we use what we have. If context needed, we must pass it.
                    // I'll add `context: { loopIndices: Record<string, number> }` to processItem.

                    // Emitting event
                    // We need to store logId to stop it later.
                    // But where? Global ref map?
                    // We can use a ref in the hook: `activeLogIds`

                    if (!socketRef.current) {
                        log(`[Block] Log Start Failed: Socket not connected`);
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
                                resolve();
                            } else {
                                log(`[Block] Log Start Failed: ${data.error}`);
                                resolve();
                            }
                            socketRef.current?.off('start_background_log_result', handler);
                        };
                        socketRef.current?.on('start_background_log_result', handler);
                        // Add a timeout for the result in case the server doesn't respond
                        setTimeout(() => {
                            socketRef.current?.off('start_background_log_result', handler);
                            resolve();
                        }, 5000); // 5 seconds timeout
                    });
                    setCompletedStepCount(prev => prev + 1);
                    continue;

                } else if (item.blockId === SPECIAL_BLOCK_IDS.LOG_STOP) {
                    log(`[Block] Stopping Background Logs...`);
                    // Stop ALL? Or specific?
                    // Prompt doesn't specify linking. "Log Stop" suggests stopping the active one.
                    // We'll stop all active ones for now for simplicity, or last one?
                    // "Log stop command editable" implies we might want to run a command.

                    const logIds = Array.from(activeLogIds.current);
                    if (logIds.length === 0) {
                        log(`[Block] No active logs to stop.`);
                        setCompletedStepCount(prev => prev + 1);
                        continue;
                    }

                    if (!socketRef.current) {
                        log(`[Block] Log Stop Failed: Socket not connected`);
                        setCompletedStepCount(prev => prev + 1);
                        continue;
                    }

                    const promises = logIds.map(id => new Promise<void>(resolve => {
                        socketRef.current?.emit('stop_background_log', { logId: id, stopCommand: item.stopCommand });
                        // We assume it succeeds or we don't wait forever
                        // But we want to confirm?
                        // Let's just fire and forget or wait for one result?
                        // Easier to wait for result to clean up list.
                        const handler = (data: { success: boolean, logId?: string }) => {
                            if (data.logId === id) {
                                log(`[Block] Log Stopped ID: ${data.logId}`);
                                activeLogIds.current.delete(id);
                                socketRef.current?.off('stop_background_log_result', handler);
                                resolve();
                            }
                        };
                        socketRef.current?.on('stop_background_log_result', handler);
                        // Timeout fallback in case server doesn't reply
                        setTimeout(() => {
                            socketRef.current?.off('stop_background_log_result', handler);
                            resolve();
                        }, 2000);
                    }));

                    await Promise.all(promises).then(() => {
                        log(`[Block] All logs stopped.`);
                    });
                    setCompletedStepCount(prev => prev + 1);
                    continue;

                } else if (item.blockId === SPECIAL_BLOCK_IDS.WAIT_FOR_IMAGE) {
                    const timeoutMs = item.matchTimeout || 10000;
                    const templatePath = item.imageTemplatePath;

                    if (!templatePath) {
                        log(`[Wait Image] Error: No template image specified`);
                        // Fail or continue? Fail.
                        setExecutionStats(prev => ({
                            ...prev,
                            [item.id]: { startTime: Date.now(), endTime: Date.now(), duration: 0, status: 'error' }
                        }));
                        // Wait, we need to handle "continue on error" option later. For now, stop or just log?
                        // Current logic handles continue if catch block doesn't throw.
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
                        } else {
                            log(`[Wait Image] Failed: ${result.message || 'Timeout'}`);
                            setExecutionStats(prev => ({
                                ...prev,
                                [item.id]: { startTime, endTime, duration, status: 'error' }
                            }));
                            // Depending on rigorousness, maybe throw to stop pipeline?
                            // User request: "Judging point". Usually if judgment fails, test fails.
                            throw new Error(`Wait for Image Failed: ${result.message}`);
                        }
                    } catch (e: any) {
                        const endTime = Date.now();
                        setExecutionStats(prev => ({
                            ...prev,
                            [item.id]: { startTime, endTime, duration: endTime - startTime, status: 'error' }
                        }));
                        throw e; // Propagate up
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

                // Start tracking stats
                const startTime = Date.now();
                setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running' } }));

                let hasError = false;
                try {
                    for (const rawCmd of block.commands) {
                        if (abortController.current?.signal.aborted) throw new Error('Pipeline Stopped');

                        const cmd = replaceVariables(rawCmd, context);
                        log(`  $ ${cmd}`);

                        // Pass signal to runCommand
                        const output = await runCommand(cmd, abortController.current?.signal);
                        log(`  > ${output}`);
                        if (output.toLowerCase().includes('error')) {
                            hasError = true;
                        }
                    }
                } catch (e: any) {
                    if (e.message === 'Pipeline Stopped') throw e;
                    hasError = true;
                    // If timeout or other error
                    log(`  ! Error: ${e.message || e}`);
                }

                // End tracking stats
                const endTime = Date.now();
                const duration = endTime - startTime;
                setExecutionStats(prev => ({
                    ...prev,
                    [item.id]: { startTime, endTime, duration, status: hasError ? 'error' : 'success' }
                }));

                // Increment step count
                setCompletedStepCount(prev => prev + 1);

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
        executePipeline,
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
        setIsRunnerOpen
    };
};
