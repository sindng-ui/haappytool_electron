import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostTool from '../../components/PostTool';
import { HappyToolProvider } from '../../contexts/HappyToolContext';
import { DEFAULT_ST_SPECIAL_REQUESTS } from '../../utils/stDefaults';

// Mock ResponseViewer to avoid LogArchiveContext dependency in pure PostTool test
vi.mock('../../components/PostTool/ResponseViewer', () => ({
    default: ({ response }: any) => (
        <div data-testid="response-viewer">
            {response?.statusText && <div>{response.statusText}</div>}
            {response?.data && <pre data-testid="response-json">{JSON.stringify(response.data)}</pre>}
        </div>
    ),
}));

// Mock Electron API
const mockProxyRequest = vi.fn();

describe('PostTool SmartThings Integration (Step 5)', () => {
    let mockSetStSpecialRequests: any;
    let mockContextValue: any;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        (window as any).electronAPI = {
            proxyRequest: mockProxyRequest,
        };

        mockSetStSpecialRequests = vi.fn();
        mockContextValue = {
            savedRequests: [],
            setSavedRequests: vi.fn(),
            savedRequestGroups: [],
            setSavedRequestGroups: vi.fn(),
            requestHistory: [],
            setRequestHistory: vi.fn(),
            stSpecialRequests: DEFAULT_ST_SPECIAL_REQUESTS,
            setStSpecialRequests: mockSetStSpecialRequests,
            postGlobalVariables: [
                { id: '1', key: 'baseUrl', value: 'https://api.smartthings.com', enabled: true },
            ],
            setPostGlobalVariables: vi.fn(),
            envProfiles: [],
            setEnvProfiles: vi.fn(),
            activeEnvId: 'prod',
            setActiveEnvId: vi.fn(),
            postGlobalAuth: { enabled: true, type: 'bearer', bearerToken: 'test-pat-token' },
            setPostGlobalAuth: vi.fn(),
        };
    });

    it('renders SmartThings section in sidebar and opens on toggle click', () => {
        render(
            <HappyToolProvider value={mockContextValue}>
                <PostTool />
            </HappyToolProvider>
        );

        // Sidebar SmartThings Section Toggle 클릭 (기본 접힘 상태에서 펼침)
        fireEvent.click(screen.getByTestId('st-section-toggle'));

        expect(screen.getByText('Locations')).toBeInTheDocument();
        expect(screen.getByText('Rooms')).toBeInTheDocument();
        expect(screen.getByText('Devices')).toBeInTheDocument();
        expect(screen.getByTestId('st-discover-btn')).toBeInTheDocument();
    });

    it('loads Special Request into editor and debounces save to stSpecialRequests when edited', async () => {
        render(
            <HappyToolProvider value={mockContextValue}>
                <PostTool />
            </HappyToolProvider>
        );

        // Expand ST section
        fireEvent.click(screen.getByTestId('st-section-toggle'));

        // Click Locations card
        fireEvent.click(screen.getByTestId('st-card-locations'));

        // URL input should now have {{baseUrl}}/v1/locations
        const urlInput = screen.getByDisplayValue('{{baseUrl}}/v1/locations');
        expect(urlInput).toBeInTheDocument();

        // Edit URL
        fireEvent.change(urlInput, { target: { value: '{{baseUrl}}/v1/locations/custom' } });

        // Wait for debounce save (500ms)
        await waitFor(() => {
            expect(mockSetStSpecialRequests).toHaveBeenCalled();
        }, { timeout: 1500 });

        const updatedArgs = mockSetStSpecialRequests.mock.calls[0][0];
        const updatedLocationReq = updatedArgs.find((r: any) => r.id === 'locations');
        expect(updatedLocationReq.url).toBe('{{baseUrl}}/v1/locations/custom');
    });

    it('performs Discover All and renders tree view, and displays node JSON on node click', async () => {
        mockProxyRequest.mockImplementation(({ url }: { url: string }) => {
            if (url.includes('/locations') && !url.includes('/rooms')) {
                return Promise.resolve({
                    error: false,
                    status: 200,
                    data: { items: [{ locationId: 'loc-100', name: 'Smart Home Hub' }] },
                });
            }
            if (url.includes('/rooms')) {
                return Promise.resolve({
                    error: false,
                    status: 200,
                    data: { items: [{ roomId: 'room-100', name: 'Master Bedroom' }] },
                });
            }
            if (url.includes('/devices')) {
                return Promise.resolve({
                    error: false,
                    status: 200,
                    data: {
                        items: [
                            {
                                deviceId: 'dev-100',
                                locationId: 'loc-100',
                                roomId: 'room-100',
                                label: 'Smart Light 100',
                                deviceTypeName: 'c2c-bulb',
                            },
                        ],
                    },
                });
            }
            return Promise.resolve({ error: false, status: 200, data: { items: [] } });
        });

        render(
            <HappyToolProvider value={mockContextValue}>
                <PostTool />
            </HappyToolProvider>
        );

        // Open ST section and Click Discover All
        fireEvent.click(screen.getByTestId('st-section-toggle'));
        fireEvent.click(screen.getByTestId('st-discover-btn'));

        // Wait for Tree View to render in Drawer
        await waitFor(() => {
            expect(screen.getByText('Smart Home Hub')).toBeInTheDocument();
            expect(screen.getByText('Master Bedroom')).toBeInTheDocument();
            expect(screen.getByText('Smart Light 100')).toBeInTheDocument();
        });

        // Click Device Node in Tree View
        fireEvent.click(screen.getByTestId('st-tree-device-dev-100'));

        // Expect ResponseViewer area to display the node data
        await waitFor(() => {
            expect(screen.getByText('Discovered Node Data')).toBeInTheDocument();
        });
    });
});
