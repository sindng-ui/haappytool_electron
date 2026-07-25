import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SmartThingsTreeView, { getDeviceIcon } from '../../components/PostTool/SmartThingsTreeView';
import { STDiscoveryData } from '../../types';
import * as Lucide from 'lucide-react';

describe('getDeviceIcon helper', () => {
    it('returns Lightbulb for light/bulb/lamp keywords', () => {
        expect(getDeviceIcon('c2c-color-bulb', 'Living Light')).toBe(Lucide.Lightbulb);
    });

    it('returns Zap for switch/plug keywords', () => {
        expect(getDeviceIcon('c2c-switch', 'Smart Plug')).toBe(Lucide.Zap);
    });

    it('returns Lock for lock/door keywords', () => {
        expect(getDeviceIcon('smart-lock', 'Front Door')).toBe(Lucide.Lock);
    });

    it('returns Thermometer for sensor/motion/temp keywords', () => {
        expect(getDeviceIcon('motion-sensor', 'Sensor')).toBe(Lucide.Thermometer);
    });

    it('returns Tv for tv/speaker keywords', () => {
        expect(getDeviceIcon('samsung-tv', 'Living TV')).toBe(Lucide.Tv);
    });

    it('returns Cpu for unknown types', () => {
        expect(getDeviceIcon('unknown-type', 'Custom Gadget')).toBe(Lucide.Cpu);
    });
});

describe('SmartThingsTreeView Component', () => {
    const mockOnSelectNode = vi.fn();

    const mockData: STDiscoveryData = {
        locations: [
            { locationId: 'loc-1', name: 'My Home', raw: { locationId: 'loc-1', name: 'My Home' } },
        ],
        rooms: [
            { roomId: 'room-1', locationId: 'loc-1', name: 'Living Room', raw: { roomId: 'room-1', name: 'Living Room' } },
        ],
        devices: [
            { deviceId: 'dev-1', locationId: 'loc-1', roomId: 'room-1', label: 'Main Light', deviceTypeName: 'light', raw: { deviceId: 'dev-1' } },
            { deviceId: 'dev-2', locationId: 'loc-1', label: 'Unassigned Motion', deviceTypeName: 'motion-sensor', raw: { deviceId: 'dev-2' } },
        ],
        fetchedAt: Date.now(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty message when data has no locations', () => {
        const emptyData: STDiscoveryData = { locations: [], rooms: [], devices: [], fetchedAt: 0 };
        render(<SmartThingsTreeView data={emptyData} onSelectNode={mockOnSelectNode} />);

        expect(screen.getByText('No location data discovered yet.')).toBeInTheDocument();
    });

    it('renders location, room, and device nodes', () => {
        render(<SmartThingsTreeView data={mockData} onSelectNode={mockOnSelectNode} />);

        expect(screen.getByText('My Home')).toBeInTheDocument();
        expect(screen.getByText('Living Room')).toBeInTheDocument();
        expect(screen.getByText('Main Light')).toBeInTheDocument();
        expect(screen.getByText('Unassigned Motion')).toBeInTheDocument();
    });

    it('calls onSelectNode with raw data when location node is clicked', () => {
        render(<SmartThingsTreeView data={mockData} onSelectNode={mockOnSelectNode} />);

        fireEvent.click(screen.getByTestId('st-tree-location-loc-1'));
        expect(mockOnSelectNode).toHaveBeenCalledWith(mockData.locations[0].raw, 'location', 'loc-1');
    });

    it('calls onSelectNode with raw data when room node is clicked', () => {
        render(<SmartThingsTreeView data={mockData} onSelectNode={mockOnSelectNode} />);

        fireEvent.click(screen.getByTestId('st-tree-room-room-1'));
        expect(mockOnSelectNode).toHaveBeenCalledWith(mockData.rooms[0].raw, 'room', 'room-1');
    });

    it('calls onSelectNode with raw data when device node is clicked', () => {
        render(<SmartThingsTreeView data={mockData} onSelectNode={mockOnSelectNode} />);

        fireEvent.click(screen.getByTestId('st-tree-device-dev-1'));
        expect(mockOnSelectNode).toHaveBeenCalledWith(mockData.devices[0].raw, 'device', 'dev-1');
    });

    it('renders ONLINE and OFFLINE healthState badges for devices', () => {
        const deviceStatusMap = {
            'dev-1': { healthState: 'ONLINE' as const },
            'dev-2': { healthState: 'OFFLINE' as const },
        };

        render(
            <SmartThingsTreeView
                data={mockData}
                onSelectNode={mockOnSelectNode}
                deviceStatusMap={deviceStatusMap}
            />
        );

        expect(screen.getByTestId('st-health-dev-1')).toHaveTextContent('ONLINE');
        expect(screen.getByTestId('st-health-dev-2')).toHaveTextContent('OFFLINE');
    });
});
