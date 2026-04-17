export type SignStep = 1 | 2 | 3 | 4 | 5;

export interface SoFileItem {
    path: string;
    basename: string;
    originalBlob: Blob;
    signedBlob?: File | Blob;
    checked: boolean;
    isSigned?: boolean;
}

export interface SignState {
    originalFile: File | null;
    soFiles: SoFileItem[];
    currentStep: SignStep;
    finalNupkgBlob: Blob | null;
    error: string | null;
    isProcessing: boolean;
    progress: number;
    isFinalized?: boolean;
}
