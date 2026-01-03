export interface CommandBlock {
    id: string;
    name: string;
    description?: string;
    commands: string[]; // List of commands to execute
    type: 'custom' | 'predefined' | 'special';
    // Log Start/Stop Defaults
    logCommand?: string;
    logFileName?: string;
    stopCommand?: string;
}

export interface PipelineItem {
    id: string;
    type: 'block' | 'loop' | 'conditional';
    blockId?: string; // If type is block
    sleepDuration?: number; // If block is Sleep type
    // Image Match Specific
    imageTemplatePath?: string; // Path (Server absolute)
    imageTemplateUrl?: string; // URL (Client relative)
    matchTimeout?: number; // ms

    // Log Start/Stop Specific
    logCommand?: string; // Command to start logging (e.g. sdb dlog)
    logFileName?: string; // Filename pattern
    stopCommand?: string; // Command to execute when stopping (optional)

    loopCount?: number; // If type is loop
    children?: PipelineItem[]; // If type is loop

    // Condition properties
    condition?: {
        type: 'last_step_success' | 'variable_match';
        variableName?: string;
        variableValue?: string;
    };
    elseChildren?: PipelineItem[]; // For 'false' branch of condition
    hint?: string; // User annotation
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
        currentIteration?: number; // For loops
        totalIterations?: number; // For loops
        resolvedLabel?: string; // e.g. "log_2024-01-01.txt"
    }
}

export interface ScenarioStep {
    id: string;
    pipelineId: string;
    enabled: boolean;
}

export interface Scenario {
    id: string;
    name: string;
    description?: string;
    steps: ScenarioStep[];
}
