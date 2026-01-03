import { ExecutionStats } from '../components/BlockTest/types';

export const generateHtmlReport = (
    pipelineName: string,
    stats: ExecutionStats,
    logs: string[]
): string => {
    const totalSteps = Object.keys(stats).length;
    let passed = 0;
    let failed = 0;
    let totalDuration = 0;

    Object.values(stats).forEach(s => {
        if (s.status === 'success') passed++;
        if (s.status === 'error') failed++;
        if (s.duration) totalDuration += s.duration;
    });

    const passRate = totalSteps > 0 ? ((passed / totalSteps) * 100).toFixed(1) : '0.0';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Execution Report - ${pipelineName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #334155; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1e293b; color: white; padding: 24px; }
        .header h1 { margin: 0; font-size: 24px; }
        .meta { margin-top: 8px; font-size: 14px; opacity: 0.8; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px; border-bottom: 1px solid #e2e8f0; }
        .card { background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; }
        .card .value { font-size: 24px; font-weight: bold; color: #0f172a; }
        .card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-top: 4px; }
        .card.passed .value { color: #22c55e; }
        .card.failed .value { color: #ef4444; }
        .section-title { padding: 24px 24px 16px; font-size: 18px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; }
        .steps { padding: 0; margin: 0; list-style: none; }
        .step { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 16px; }
        .step:last-child { border-bottom: none; }
        .step-status { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
        .step-status.success { background: #22c55e; }
        .step-status.error { background: #ef4444; }
        .step-status.running { background: #3b82f6; }
        .step-info { flex: 1; }
        .step-name { font-weight: 600; font-size: 14px; }
        .step-meta { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .step-duration { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #64748b; }
        .logs { padding: 24px; background: #0f172a; color: #f1f5f9; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; margin: 24px; border-radius: 8px; max-height: 400px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${pipelineName}</h1>
            <div class="meta">Generated on ${new Date().toLocaleString()}</div>
        </div>
        
        <div class="summary">
            <div class="card passed">
                <div class="value">${passRate}%</div>
                <div class="label">Pass Rate</div>
            </div>
            <div class="card">
                <div class="value">${totalDuration}ms</div>
                <div class="label">Total Time</div>
            </div>
            <div class="card">
                <div class="value">${passed}</div>
                <div class="label">Passed Steps</div>
            </div>
            <div class="card failed">
                <div class="value">${failed}</div>
                <div class="label">Failed Steps</div>
            </div>
        </div>

        <div class="section-title">Execution Steps</div>
        <ul class="steps">
            ${Object.entries(stats).map(([id, stat]) => `
                <li class="step">
                    <div class="step-status ${stat.status}"></div>
                    <div class="step-info">
                        <div class="step-name">Step ID: ${id}</div>
                        <div class="step-meta">
                            ${stat.resolvedLabel ? `<div>Label: ${stat.resolvedLabel}</div>` : ''}
                            <div>Start: ${new Date(stat.startTime).toLocaleTimeString()}</div>
                        </div>
                    </div>
                    <div class="step-duration">${stat.duration ? `${stat.duration}ms` : '-'}</div>
                </li>
            `).join('')}
        </ul>

        <div class="section-title">Execution Logs</div>
        <div class="logs">${logs.join('\n')}</div>
    </div>
</body>
</html>
    `;
};
