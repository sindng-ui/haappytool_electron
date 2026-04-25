import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NupkgSigner from '../../../components/NupkgSigner';
import { ToastProvider } from '../../../contexts/ToastContext';

// Mock framer-motion minimally
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => {
            const safeProps = { ...props };
            delete safeProps.animate;
            delete safeProps.initial;
            delete safeProps.exit;
            delete safeProps.transition;
            delete safeProps.layoutId;
            return <div {...safeProps}>{children}</div>;
        },
        header: ({ children }: any) => <header>{children}</header>,
        span: ({ children }: any) => <span>{children}</span>,
        button: ({ children }: any) => <button>{children}</button>,
        nav: ({ children }: any) => <nav>{children}</nav>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Worker globally since JSDOM doesn't support it
global.Worker = class mock {
    onmessage: any = null;
    postMessage(msg: any) {
        // Simulate async worker response
        setTimeout(() => {
            if (this.onmessage) {
                this.onmessage({
                    data: {
                        type: msg.type === 'EXTRACT_SO' ? 'EXTRACT_SO_COMPLETE' : 'REPACKAGE_COMPLETE',
                        requestId: msg.requestId,
                        payload: msg.type === 'EXTRACT_SO' ? [
                            { path: 'test.so', basename: 'test.so', originalBlob: new Blob([]), checked: true }
                        ] : new Blob([])
                    }
                });
            }
        }, 10);
    }
    terminate() {}
} as any;

// Mock Step components to keep the test focused on NupkgSigner's logic
vi.mock('../../../components/NupkgSigner/Step1_SourceUpload', () => ({
    default: ({ onFileSelect }: any) => <button onClick={() => onFileSelect(new File([], 'test.nupkg'))}>Select File</button>
}));
vi.mock('../../../components/NupkgSigner/Step2_3_FileList', () => ({
    default: ({ onProcess }: any) => <button onClick={onProcess}>Process</button>
}));
vi.mock('../../../components/NupkgSigner/Step4_Repackage', () => ({
    default: ({ onComplete }: any) => <button onClick={() => onComplete(new Blob([]))}>Complete</button>
}));
vi.mock('../../../components/NupkgSigner/Step5_FinalDownload', () => ({
    default: () => <div data-testid="step5">Final</div>
}));

describe('NupkgSigner Component Integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should navigate melalui all steps correctly', async () => {
        render(
            <ToastProvider>
                <NupkgSigner />
            </ToastProvider>
        );

        // Step 1 -> 2
        fireEvent.click(screen.getByText('Select File'));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        // Step 2 -> 4
        expect(screen.getByText('Process')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Process'));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        // Step 4 -> 5
        expect(screen.getByText('Complete')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Complete'));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        expect(screen.getByTestId('step5')).toBeInTheDocument();
    });
});
