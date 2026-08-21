import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SmartThingsSection from '../../components/PostTool/SmartThingsSection';
import SpecialRequestCard from '../../components/PostTool/SpecialRequestCard';
import { DEFAULT_ST_SPECIAL_REQUESTS } from '../../utils/stDefaults';
import { STSpecialRequest } from '../../types';

describe('SpecialRequestCard Component', () => {
    const mockReq: STSpecialRequest = DEFAULT_ST_SPECIAL_REQUESTS[0]; // Locations
    const mockOnLoad = vi.fn();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders label, method badge, and ⚡ badge in 1-line compact style', () => {
        render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByText('Locations')).toBeInTheDocument();
        expect(screen.getByText('GET')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
        // 1줄 컴팩트 뷰: 사이드바 카드에 url 텍스트는 노출되지 않음 (우측 에디터에서 확인)
        expect(screen.queryByText('{{baseUrl}}/v1/locations')).not.toBeInTheDocument();
    });

    it('triggers onLoad when card is clicked', () => {
        render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                onUpdate={mockOnUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('st-card-locations'));
        expect(mockOnLoad).toHaveBeenCalledWith(mockReq);
    });

    it('applies active styling when isActive is true', () => {
        const { rerender } = render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                isActive={false}
            />
        );

        const card = screen.getByTestId('st-card-locations');
        expect(card.className).toContain('border-slate-700/30');

        rerender(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                isActive={true}
            />
        );

        expect(card.className).toContain('border-indigo-500/30');
    });
});

describe('SmartThingsSection Component', () => {
    const mockSpecialRequests = DEFAULT_ST_SPECIAL_REQUESTS;
    const mockOnUpdateSpecialRequests = vi.fn();
    const mockOnLoadRequest = vi.fn();
    const mockOnDiscover = vi.fn();
    const mockOnSelectNode = vi.fn();

    const defaultProps = {
        specialRequests: mockSpecialRequests,
        onUpdateSpecialRequests: mockOnUpdateSpecialRequests,
        onLoadRequest: mockOnLoadRequest,
        isDiscovering: false,
        onDiscover: mockOnDiscover,
        discoveryData: null,
        discoveryError: null,
        onSelectNode: mockOnSelectNode,
        selectedNodeRaw: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('is collapsed by default and expands on click, persisting state to localStorage', () => {
        render(<SmartThingsSection {...defaultProps} />);

        // 기본값: 접혀있음
        expect(screen.getByText('SmartThings')).toBeInTheDocument();
        expect(screen.queryByText('Locations')).not.toBeInTheDocument();

        // 헤더 클릭 시 펼쳐짐
        fireEvent.click(screen.getByTestId('st-section-toggle'));
        expect(screen.getByText('Locations')).toBeInTheDocument();
        expect(screen.getByText('Rooms')).toBeInTheDocument();
        expect(screen.getByText('Devices')).toBeInTheDocument();
        expect(screen.getByTestId('st-discover-btn')).toBeInTheDocument();
        expect(localStorage.getItem('happytool_st_section_collapsed')).toBe('false');

        // 다시 클릭 시 접힘
        fireEvent.click(screen.getByTestId('st-section-toggle'));
        expect(screen.queryByText('Locations')).not.toBeInTheDocument();
        expect(localStorage.getItem('happytool_st_section_collapsed')).toBe('true');
    });

    it('loads collapsed state from localStorage if previously stored', () => {
        localStorage.setItem('happytool_st_section_collapsed', 'false');
        render(<SmartThingsSection {...defaultProps} />);

        // localStorage에 false(펼침)로 저장되어 있었으므로 펼쳐져서 렌더링됨
        expect(screen.getByText('Locations')).toBeInTheDocument();
    });

    it('calls onDiscover when Discover button is clicked', () => {
        localStorage.setItem('happytool_st_section_collapsed', 'false');
        render(<SmartThingsSection {...defaultProps} />);

        fireEvent.click(screen.getByTestId('st-discover-btn'));
        expect(mockOnDiscover).toHaveBeenCalledTimes(1);
    });

    it('disables Discover button when isDiscovering is true', () => {
        localStorage.setItem('happytool_st_section_collapsed', 'false');
        render(<SmartThingsSection {...defaultProps} isDiscovering={true} />);

        const btn = screen.getByTestId('st-discover-btn');
        expect(btn).toBeDisabled();
        expect(screen.getAllByText(/Discovering.../i).length).toBeGreaterThan(0);
    });

    it('renders discovery error message when discoveryError is set', () => {
        localStorage.setItem('happytool_st_section_collapsed', 'false');
        render(<SmartThingsSection {...defaultProps} discoveryError="Network error failure" />);

        expect(screen.getByTestId('st-discover-error')).toBeInTheDocument();
        expect(screen.getByText('Network error failure')).toBeInTheDocument();
    });

    it('calls onLoadMockData when Mock Data button is clicked', () => {
        localStorage.setItem('happytool_st_section_collapsed', 'false');
        const mockFn = vi.fn();
        render(<SmartThingsSection {...defaultProps} onLoadMockData={mockFn} />);

        const mockBtn = screen.getByTestId('st-mock-btn');
        expect(mockBtn).toBeInTheDocument();
        fireEvent.click(mockBtn);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('renders treeViewSlot when treeViewSlot is provided', () => {
        localStorage.setItem('happytool_st_section_collapsed', 'false');
        render(
            <SmartThingsSection
                {...defaultProps}
                treeViewSlot={<div data-testid="custom-tree-slot">Custom Tree Slot</div>}
            />
        );

        expect(screen.getByTestId('custom-tree-slot')).toBeInTheDocument();
        expect(screen.getByText('Custom Tree Slot')).toBeInTheDocument();
    });
});
