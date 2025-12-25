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

    useEffect(() => {
        socketRef.current = io('http://localhost:3002');

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
                    // Merge with predefined, ensuring predefined cannot be overwritten by file if conflict?
                    // Actually, if we save everything, we just load everything.
                    // But we want to ensure PREDEFINED are always present.
                    // Let's filter out predefined from loaded and re-merge PREDEFINED.
                    const custom = loaded.filter(b => b.type === 'custom');
                    setBlocks([...PREDEFINED_BLOCKS, ...SPECIAL_BLOCKS, ...custom]);
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
        // if (PREDEFINED_BLOCKS.find(b => b.id === updatedBlock.id)) return; // Allow updates
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
            await executeItems(pipeline.items, log);
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
            // activePipelineId remains set so view stays open

            // Save Result
            const resultFilename = `result_${pipeline.name}_${Date.now()}.txt`;
            if (socketRef.current) {
                socketRef.current.emit('save_file', {
                    filename: resultFilename,
                    content: logs.join('\n')
                });
            }
        }
    };

    const executeItems = async (items: PipelineItem[], log: (msg: string) => void) => {
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
                setExecutionStats(prev => ({ ...prev, [item.id]: { startTime, status: 'running' } }));

                try {
                    for (let i = 0; i < count; i++) {
                        if (abortController.current?.signal.aborted) throw new Error('Pipeline Stopped');
                        log(`Loop Iteration ${i + 1}/${count}`);
                        if (item.children) await executeItems(item.children, log);
                    }

                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: { startTime, endTime, duration, status: 'success' }
                    }));
                } catch (err) {
                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    // If stopped, maybe mark as error or just partial? User said "Error" if error.
                    // Stopped is technically not an error in logic, but execution stopped.
                    // Let's mark as Error for visual feedback if it was aborted mid-loop.
                    setExecutionStats(prev => ({
                        ...prev,
                        [item.id]: { startTime, endTime, duration, status: 'error' }
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
                    for (const cmd of block.commands) {
                        if (abortController.current?.signal.aborted) throw new Error('Pipeline Stopped');
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
