import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PerfTool from '../../components/PerfTool';
import React from 'react';

// Mock Toast Context
vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        addToast: vi.fn(),
    }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => {
    const Component = ({ children, ...props }: any) => {
        const { initial, animate, exit, transition, variants, ...cleanProps } = props;
        return <div {...cleanProps}>{children}</div>;
    };
    return {
        motion: new Proxy({}, {
            get: () => Component
        }),
        AnimatePresence: ({ children }: any) => <>{children}</>,
    };
});

// Mock PerfDashboard
vi.mock('../LogViewer/PerfDashboard', () => ({
    PerfDashboard: ({ isOpen, result, isAnalyzing }: any) => {
        if (!isOpen) return null;
        return (
            <div data-testid="perf-dashboard">
                {isAnalyzing && <span>Analyzing...</span>}
                {result && <span>Result Ready</span>}
                {!result && !isAnalyzing && <span>Ready to Analyze</span>}
            </div>
        );
    }
}));

describe('PerfTool Component', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    it('should render initial state correctly', async () => {
        render(<PerfTool />);
        // Wait for isInitialLoadDone
        expect(await screen.findByText(/Performance Analysis/i)).toBeInTheDocument();
        expect(await screen.findByText(/Target Keyword/i)).toBeInTheDocument();
    });

    it('should update target keyword on input Change', async () => {
        render(<PerfTool />);
        const input = await screen.findByPlaceholderText(/Enter PID or Log Tag/i);
        fireEvent.change(input, { target: { value: 'MyTag' } });
        expect(input).toHaveValue('MyTag');
    });

    it('should update threshold on input change', async () => {
        const { container } = render(<PerfTool />);
        await screen.findByText(/Pass\/Fail Threshold/i);
        const thresholdInput = container.querySelector('input[type="number"]') as HTMLInputElement;
        fireEvent.change(thresholdInput!, { target: { value: '2500' } });
        expect(thresholdInput).toHaveValue(2500);
    });

    it('should allow adding risk levels', async () => {
        render(<PerfTool />);
        const addButton = await screen.findByTitle(/Add Level/i);
        fireEvent.click(addButton);
        const labels = await screen.findAllByPlaceholderText(/Label/i);
        expect(labels.length).toBe(3);
        expect(labels[2]).toHaveValue('Critical');
    });
});
