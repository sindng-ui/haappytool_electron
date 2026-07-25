import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SmartThingsSection from '../../components/PostTool/SmartThingsSection';
import SmartThingsTreeView from '../../components/PostTool/SmartThingsTreeView';
import { STDiscoveryData } from '../../types';
import { DEFAULT_ST_SPECIAL_REQUESTS } from '../../utils/stDefaults';

describe('Device Search & Filter (Step 8)', () => {
    const mockData: STDiscoveryData = {
        locations: [{ locationId: 'loc-1', name: 'My Home', raw: {} }],
        rooms: [{ roomId: 'room-1', locationId: 'loc-1', name: 'Living Room', raw: {} }],
        devices: [
            { deviceId: 'dev-1', locationId: 'loc-1', roomId: 'room-1', label: 'Living Light', deviceTypeName: 'c2c-bulb', raw: {} },
            { deviceId: 'dev-2', locationId: 'loc-1', roomId: 'room-1', label: 'Bedroom Sensor', deviceTypeName: 'motion', raw: {} },
        ],
        fetchedAt: Date.now(),
    };

    const mockOnSelectNode = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('filters devices by label query in SmartThingsTreeView', () => {
        render(
            <SmartThingsTreeView
                data={mockData}
                onSelectNode={mockOnSelectNode}
                searchQuery="Light"
            />
        );

        expect(screen.getByText('Living Light')).toBeInTheDocument();
        expect(screen.queryByText('Bedroom Sensor')).not.toBeInTheDocument();
    });

    it('filters devices by deviceTypeName in SmartThingsTreeView', () => {
        render(
            <SmartThingsTreeView
                data={mockData}
                onSelectNode={mockOnSelectNode}
                searchQuery="motion"
            />
        );

        expect(screen.getByText('Bedroom Sensor')).toBeInTheDocument();
        expect(screen.queryByText('Living Light')).not.toBeInTheDocument();
    });

    it('shows no devices match message when search query has no results', () => {
        render(
            <SmartThingsTreeView
                data={mockData}
                onSelectNode={mockOnSelectNode}
                searchQuery="nonexistent"
            />
        );

        expect(screen.getByText('No devices match "nonexistent"')).toBeInTheDocument();
    });

    it('renders search input in SmartThingsSection and filters tree live', () => {
        render(
            <SmartThingsSection
                specialRequests={DEFAULT_ST_SPECIAL_REQUESTS}
                onUpdateSpecialRequests={vi.fn()}
                onLoadRequest={vi.fn()}
                isDiscovering={false}
                onDiscover={vi.fn()}
                discoveryData={mockData}
                discoveryError={null}
                onSelectNode={mockOnSelectNode}
                selectedNodeRaw={null}
            />
        );

        const searchInput = screen.getByTestId('st-search-input');
        expect(searchInput).toBeInTheDocument();

        fireEvent.change(searchInput, { target: { value: 'Light' } });

        expect(screen.getByText('Living Light')).toBeInTheDocument();
        expect(screen.queryByText('Bedroom Sensor')).not.toBeInTheDocument();
    });
});
