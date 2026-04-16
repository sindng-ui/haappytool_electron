import JSZip from 'jszip';

export interface SoFileItem {
    path: string;
    basename: string;
    originalBlob: Blob;
    signedBlob?: Blob;
    checked: boolean;
}

export type SignStep = 1 | 2 | 3 | 4 | 5;

export interface SignState {
    originalFile: File | null;
    originalZip: JSZip | null;
    soFiles: SoFileItem[];
    currentStep: SignStep;
    finalNupkgBlob: Blob | null;
    error: string | null;
    isProcessing: boolean;
    progress: number;
}
