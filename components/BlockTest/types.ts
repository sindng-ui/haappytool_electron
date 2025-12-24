export interface CommandBlock {
    id: string;
    name: string;
    description?: string;
    commands: string[]; // List of commands to execute
    type: 'custom' | 'predefined';
}

export interface PipelineItem {
    id: string;
    type: 'block' | 'loop';
    blockId?: string; // If type is block
    loopCount?: number; // If type is loop
    children?: PipelineItem[]; // If type is loop
}

export interface Pipeline {
    id: string;
    name: string;
    items: PipelineItem[];
}

export interface TestResult {
    timestamp: string;
    pipelineName: string;
    logs: string[];
    status: 'success' | 'failure';
}

export interface ExecutionStats {
    [itemId: string]: {
        startTime: number;
        endTime?: number;
        duration?: number;
        status?: 'success' | 'error' | 'running';
    }
}
