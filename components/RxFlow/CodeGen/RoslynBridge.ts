export interface ValidationResult {
    Id: string;
    Message: string;
    Line: number;
    Severity: string;
}

export const validateCode = async (code: string): Promise<ValidationResult[]> => {
    if (!code) return [];

    try {
        // Check if running in Electron
        // @ts-ignore
        if (typeof window.electronAPI === 'undefined') {
            return [{ Id: 'ERR_ENV', Message: 'RxFlow Validator requires Electron environment. (window.electronAPI is missing)', Line: 0, Severity: 'Error' }];
        }

        // @ts-ignore
        // Direct call to see if it works or throws "not a function"
        const results = await window.electronAPI.validateRoslyn(code);
        return results;
    } catch (e: any) {
        console.error('Validation failed', e);
        const msg = e.message || 'Unknown error';
        if (msg.includes('validateRoslyn is not a function')) {
            return [{ Id: 'ERR_BINDING', Message: 'Frontend cannot see validateRoslyn. Ensure Preload.js is updated and App Restarted.', Line: 0, Severity: 'Error' }];
        }
        return [{ Id: 'ERR_IPC', Message: `Validation failed: ${msg}`, Line: 0, Severity: 'Error' }];
    }
};
