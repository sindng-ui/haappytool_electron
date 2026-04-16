export interface SignState {
    originalFile: File | null;
    soFiles: SoFileItem[];
    currentStep: SignStep;
    finalNupkgBlob: Blob | null;
    error: string | null;
    isProcessing: boolean;
    progress: number;
}
