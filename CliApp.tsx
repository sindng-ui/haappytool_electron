import React, { useEffect, useState } from 'react';
import { useBlockTest } from './components/BlockTest/hooks/useBlockTest';
import { useCliHandlers } from './hooks/useCliHandlers';

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
    const {
        logOut,
        logErr,
        handleLogExtractor,
        handleJsonTool,
        handlePostTool,
        handleTpkExtractor,
        handleAnalyzeDiff
    } = useCliHandlers();

    useEffect(() => {
        if (!window.electronAPI || !window.electronAPI.onCliCommand) {
            console.error('[CLI] Electron API or onCliCommand is missing');
            return;
        }

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
    }, [handleAnalyzeDiff, handleJsonTool, handleLogExtractor, handlePostTool, handleTpkExtractor, logErr, logOut]);

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
