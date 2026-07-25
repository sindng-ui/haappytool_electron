import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CapabilityInspector, { sendDeviceCommand, COMMON_COMMAND_PRESETS } from '../../components/PostTool/CapabilityInspector';
import { STDevice } from '../../types';

describe('sendDeviceCommand helper', () => {
    afterEach(() => {
        delete (window as any).electronAPI;
    });

    it('sends command via proxy when available', async () => {
        const mockProxy = vi.fn().mockResolvedValue({ error: false, data: { results: [{ status: 'ACCEPTED' }] } });
        (window as any).electronAPI = { proxyRequest: mockProxy };

        const result = await sendDeviceCommand(
            'dev-1',
            'switch',
            'on',
            [],
            [{ id: '1', key: 'baseUrl', value: 'https://api.smartthings.com', enabled: true }],
            []
        );

        expect(mockProxy).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                url: 'https://api.smartthings.com/v1/devices/dev-1/commands',
                body: JSON.stringify({
                    commands: [{ component: 'main', capability: 'switch', command: 'on', arguments: [] }],
                }),
            })
        );
        expect(result).toEqual({ results: [{ status: 'ACCEPTED' }] });
    });
});

describe('CapabilityInspector Component', () => {
    const mockDevice: STDevice = {
        deviceId: 'dev-1',
        locationId: 'loc-1',
        label: 'Living Room Light',
        raw: {},
    };

    const mockGlobalVars = [{ id: '1', key: 'baseUrl', value: 'https://api.smartthings.com', enabled: true }];
    const mockOnExecuted = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (window as any).electronAPI = {
            proxyRequest: vi.fn().mockResolvedValue({ error: false, data: { status: 'OK' } }),
        };
    });

    it('renders preset command buttons', () => {
        render(
            <CapabilityInspector
                device={mockDevice}
                globalVariables={mockGlobalVars}
                envProfiles={[]}
                onCommandExecuted={mockOnExecuted}
            />
        );

        expect(screen.getByText('Capability Inspector')).toBeInTheDocument();
        expect(screen.getByText('Turn On')).toBeInTheDocument();
        expect(screen.getByText('Turn Off')).toBeInTheDocument();
    });

    it('triggers sendDeviceCommand when Turn On is clicked', async () => {
        render(
            <CapabilityInspector
                device={mockDevice}
                globalVariables={mockGlobalVars}
                envProfiles={[]}
                onCommandExecuted={mockOnExecuted}
            />
        );

        fireEvent.click(screen.getByTestId('cmd-btn-on'));

        await waitFor(() => {
            expect(mockOnExecuted).toHaveBeenCalledWith({ status: 'OK' });
        });
    });
});
