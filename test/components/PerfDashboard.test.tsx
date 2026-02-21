import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerfDashboard } from '../../components/LogViewer/PerfDashboard';
import React from 'react';

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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Activity: () => <div data-testid="icon-activity" />,
    Search: () => <div data-testid="icon-search" />,
    ChevronDown: () => <div data-testid="icon-chevron-down" />,
    ChevronUp: () => <div data-testid="icon-chevron-up" />,
    X: () => <div data-testid="icon-x" />,
    Filter: () => <div data-testid="icon-filter" />,
    AlertCircle: () => <div data-testid="icon-alert" />,
    ChevronLeft: () => <div data-testid="icon-chevron-left" />,
    ChevronRight: () => <div data-testid="icon-chevron-right" />,
    AlignLeft: () => <div data-testid="icon-align-left" />,
    CheckCircle2: () => <div data-testid="icon-check" />,
    Timer: () => <div data-testid="icon-timer" />,
    Maximize2: () => <div data-testid="icon-maximize" />,
    MoveRight: () => <div data-testid="icon-move-right" />,
    Clock: () => <div data-testid="icon-clock" />,
    LayoutDashboard: () => <div data-testid="icon-layout" />,
    Maximize: () => <div data-testid="icon-maximize" />,
    Minimize: () => <div data-testid="icon-minimize" />,
    Play: () => <div data-testid="icon-play" />,
    Settings: () => <div data-testid="icon-settings" />,
}));

describe('PerfDashboard Component', () => {
    const mockResult = {
        fileName: 'test.log',
        totalDuration: 1000,
        startTime: 0,
        endTime: 1000,
        logCount: 100,
        passCount: 5,
        failCount: 0,
        perfThreshold: 500,
        segments: [
            {
                id: 'seg1',
                name: 'Segment 1',
                startTime: 100,
                endTime: 200,
                duration: 100,
                startLine: 1,
                endLine: 2,
                type: 'step',
                status: 'pass',
                logs: [],
                lane: 0,
                tid: 'Main'
            }
        ],
        bottlenecks: []
    };

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <PerfDashboard
                isOpen={false}
                onClose={() => { }}
                result={null}
                isAnalyzing={false}
                targetTime={500}
                isActive={true}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should show "Ready to Analyze" when no result and not analyzing', async () => {
        render(
            <PerfDashboard
                isOpen={true}
                onClose={() => { }}
                result={null}
                isAnalyzing={false}
                targetTime={500}
                isActive={true}
            />
        );
        expect(await screen.findByText(/Ready to Analyze/i)).toBeInTheDocument();
    });

    it('should render header with result summary when result is provided', async () => {
        render(
            <PerfDashboard
                isOpen={true}
                onClose={() => { }}
                result={mockResult as any}
                isAnalyzing={false}
                targetTime={500}
                isActive={true}
            />
        );

        // This is in the header summary line
        expect(await screen.findByText(/1,000ms • 1 segments • Limit: 500ms/i)).toBeInTheDocument();
    });

    it('should render scorecards in full screen mode', async () => {
        render(
            <PerfDashboard
                isOpen={true}
                onClose={() => { }}
                result={mockResult as any}
                isAnalyzing={false}
                targetTime={500}
                isActive={true}
                isFullScreen={true}
            />
        );

        expect(await screen.findByText(/Segments/i)).toBeInTheDocument();
        expect(await screen.findByText(/Total Time/i)).toBeInTheDocument();
        expect(await screen.findByText(/1,000ms/i)).toBeInTheDocument();
    });

    it('should show search input', async () => {
        render(
            <PerfDashboard
                isOpen={true}
                onClose={() => { }}
                result={mockResult as any}
                isAnalyzing={false}
                targetTime={500}
                isActive={true}
            />
        );

        expect(await screen.findByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
});
