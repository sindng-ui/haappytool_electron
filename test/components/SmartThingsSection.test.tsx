import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SmartThingsSection from '../../components/PostTool/SmartThingsSection';
import SpecialRequestCard from '../../components/PostTool/SpecialRequestCard';
import { DEFAULT_ST_SPECIAL_REQUESTS } from '../../utils/stDefaults';
import { STDiscoveryData, STSpecialRequest } from '../../types';

describe('SpecialRequestCard Component', () => {
    const mockReq: STSpecialRequest = DEFAULT_ST_SPECIAL_REQUESTS[0]; // Locations
    const mockOnLoad = vi.fn();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders label and method badge correctly', () => {
        render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByText('Locations')).toBeInTheDocument();
        expect(screen.getByText('GET')).toBeInTheDocument();
        expect(screen.getByText('{{baseUrl}}/v1/locations')).toBeInTheDocument();
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

    it('enters inline edit mode when pencil icon is clicked', () => {
        render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                onUpdate={mockOnUpdate}
            />
        );

        const editBtn = screen.getByTestId('st-card-edit-locations');
        fireEvent.click(editBtn);

        const input = screen.getByTestId('st-card-url-input-locations');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('{{baseUrl}}/v1/locations');
    });

    it('saves updated URL when save button is clicked', () => {
        render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                onUpdate={mockOnUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('st-card-edit-locations'));
        const input = screen.getByTestId('st-card-url-input-locations');
        fireEvent.change(input, { target: { value: 'https://api.custom.com/v1/locations' } });
        fireEvent.click(screen.getByTestId('st-card-save-locations'));

        expect(mockOnUpdate).toHaveBeenCalledWith({
            ...mockReq,
            url: 'https://api.custom.com/v1/locations',
        });
    });

    it('cancels editing when cancel button is clicked', () => {
        render(
            <SpecialRequestCard
                req={mockReq}
                onLoad={mockOnLoad}
                onUpdate={mockOnUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('st-card-edit-locations'));
        const input = screen.getByTestId('st-card-url-input-locations');
        fireEvent.change(input, { target: { value: 'https://cancelled.com' } });
        fireEvent.click(screen.getByTestId('st-card-cancel-locations'));

        expect(mockOnUpdate).not.toHaveBeenCalled();
        expect(screen.getByText('{{baseUrl}}/v1/locations')).toBeInTheDocument();
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

    it('renders header, 3 special request cards, and discover button', () => {
        render(<SmartThingsSection {...defaultProps} />);

        expect(screen.getByText('SmartThings')).toBeInTheDocument();
        expect(screen.getByText('Locations')).toBeInTheDocument();
        expect(screen.getByText('Rooms')).toBeInTheDocument();
        expect(screen.getByText('Devices')).toBeInTheDocument();
        expect(screen.getByTestId('st-discover-btn')).toBeInTheDocument();
    });

    it('toggles collapse state when section header is clicked', () => {
        render(<SmartThingsSection {...defaultProps} />);

        expect(screen.getByText('Locations')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('st-section-toggle'));
        expect(screen.queryByText('Locations')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('st-section-toggle'));
        expect(screen.getByText('Locations')).toBeInTheDocument();
    });

    it('calls onDiscover when Discover button is clicked', () => {
        render(<SmartThingsSection {...defaultProps} />);

        fireEvent.click(screen.getByTestId('st-discover-btn'));
        expect(mockOnDiscover).toHaveBeenCalledTimes(1);
    });

    it('disables Discover button when isDiscovering is true', () => {
        render(<SmartThingsSection {...defaultProps} isDiscovering={true} />);

        const btn = screen.getByTestId('st-discover-btn');
        expect(btn).toBeDisabled();
        expect(screen.getAllByText(/Discovering.../i).length).toBeGreaterThan(0);
    });

    it('renders discovery error message when discoveryError is set', () => {
        render(<SmartThingsSection {...defaultProps} discoveryError="Network error failure" />);

        expect(screen.getByTestId('st-discover-error')).toBeInTheDocument();
        expect(screen.getByText('Network error failure')).toBeInTheDocument();
    });

    it('renders tree view when discoveryData is provided', () => {
        const mockData: STDiscoveryData = {
            locations: [{ locationId: 'loc1', name: 'Home Location', raw: {} }],
            rooms: [{ roomId: 'room1', locationId: 'loc1', name: 'Living Room', raw: {} }],
            devices: [{ deviceId: 'dev1', locationId: 'loc1', roomId: 'room1', label: 'Smart Lamp', raw: {} }],
            fetchedAt: Date.now(),
        };

        render(<SmartThingsSection {...defaultProps} discoveryData={mockData} />);

        expect(screen.getByText('Home Location')).toBeInTheDocument();
        expect(screen.getByText('Living Room')).toBeInTheDocument();
        expect(screen.getByText('Smart Lamp')).toBeInTheDocument();
    });
});
