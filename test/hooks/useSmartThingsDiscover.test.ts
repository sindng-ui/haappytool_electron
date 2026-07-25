import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    useSmartThingsDiscover,
    makeReplaceVariables,
    proxyGet,
} from '../../components/PostTool/useSmartThingsDiscover';
import type { STSpecialRequest, PostGlobalVariable, EnvironmentProfile } from '../../types';
import { DEFAULT_ST_SPECIAL_REQUESTS } from '../../utils/stDefaults';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_LOCATIONS = {
    items: [
        { locationId: 'loc-1', name: 'My Home' },
        { locationId: 'loc-2', name: 'Office' },
    ],
};

const MOCK_ROOMS_LOC1 = {
    items: [
        { roomId: 'room-1', name: 'Living Room' },
        { roomId: 'room-2', name: 'Bedroom' },
    ],
};

const MOCK_ROOMS_LOC2 = {
    items: [
        { roomId: 'room-3', name: 'Main Room' },
    ],
};

const MOCK_DEVICES = {
    items: [
        { deviceId: 'dev-1', locationId: 'loc-1', roomId: 'room-1', label: 'Main Light', deviceTypeName: 'c2c-rgbw-color-bulb' },
        { deviceId: 'dev-2', locationId: 'loc-1', roomId: 'room-2', label: 'Bed Sensor', deviceTypeName: 'c2c-temperature-measurement' },
        { deviceId: 'dev-3', locationId: 'loc-2', label: 'Unassigned Device' }, // roomId 없음
    ],
};

const MOCK_GLOBAL_VARS: PostGlobalVariable[] = [
    { id: '1', key: 'baseUrl', value: 'https://api.smartthings.com', enabled: true },
];

const MOCK_ENV_PROFILES: EnvironmentProfile[] = [];

const DEFAULT_PARAMS = {
    globalVariables: MOCK_GLOBAL_VARS,
    envProfiles: MOCK_ENV_PROFILES,
    activeEnvId: 'prod',
    globalAuth: null,
};

// ─── makeReplaceVariables Tests ───────────────────────────────────────────────

describe('makeReplaceVariables', () => {
    it('should replace {{baseUrl}} with global variable value', () => {
        const replace = makeReplaceVariables(MOCK_GLOBAL_VARS, []);
        expect(replace('{{baseUrl}}/v1/locations')).toBe('https://api.smartthings.com/v1/locations');
    });

    it('should replace multiple variables in one string', () => {
        const vars: PostGlobalVariable[] = [
            { id: '1', key: 'baseUrl', value: 'https://api.example.com', enabled: true },
            { id: '2', key: 'version', value: 'v2', enabled: true },
        ];
        const replace = makeReplaceVariables(vars, []);
        expect(replace('{{baseUrl}}/{{version}}/devices')).toBe('https://api.example.com/v2/devices');
    });

    it('should skip disabled variables', () => {
        const vars: PostGlobalVariable[] = [
            { id: '1', key: 'baseUrl', value: 'https://api.example.com', enabled: false },
        ];
        const replace = makeReplaceVariables(vars, []);
        expect(replace('{{baseUrl}}/v1')).toBe('{{baseUrl}}/v1');
    });

    it('should replace profile-scoped variables', () => {
        const profiles: EnvironmentProfile[] = [
            {
                id: 'p1',
                name: 'Prod',
                variables: [{ id: 'v1', key: 'token', value: 'abc123', enabled: true }],
            },
        ];
        const replace = makeReplaceVariables([], profiles);
        expect(replace('Bearer {{Prod.token}}')).toBe('Bearer abc123');
    });

    it('should not throw if str has no variables', () => {
        const replace = makeReplaceVariables(MOCK_GLOBAL_VARS, []);
        expect(replace('https://plain-url.com')).toBe('https://plain-url.com');
    });
});

// ─── proxyGet Tests ───────────────────────────────────────────────────────────

describe('proxyGet', () => {
    afterEach(() => {
        delete (window as any).electronAPI;
    });

    it('should use electronAPI.proxyRequest when available', async () => {
        const mockProxy = vi.fn().mockResolvedValue({
            error: false,
            status: 200,
            data: { items: [] },
        });
        (window as any).electronAPI = { proxyRequest: mockProxy };

        const result = await proxyGet('https://api.smartthings.com/v1/locations', null);
        expect(mockProxy).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'GET', url: 'https://api.smartthings.com/v1/locations' })
        );
        expect(result).toEqual({ items: [] });
    });

    it('should throw when proxyRequest returns error', async () => {
        (window as any).electronAPI = {
            proxyRequest: vi.fn().mockResolvedValue({ error: true, message: 'Network error' }),
        };
        await expect(proxyGet('https://api.smartthings.com/v1/locations', null)).rejects.toThrow('Network error');
    });

    it('should inject Bearer token from globalAuth', async () => {
        const mockProxy = vi.fn().mockResolvedValue({ error: false, data: {} });
        (window as any).electronAPI = { proxyRequest: mockProxy };

        await proxyGet('https://api.smartthings.com/v1/locations', {
            enabled: true,
            type: 'bearer',
            bearerToken: 'my-token',
        });

        expect(mockProxy).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
            })
        );
    });
});

// ─── useSmartThingsDiscover Tests ────────────────────────────────────────────

describe('useSmartThingsDiscover', () => {
    let mockProxy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // URL 기반으로 다른 응답 반환하는 mock
        mockProxy = vi.fn().mockImplementation(({ url }: { url: string }) => {
            if (url.includes('/locations') && !url.includes('/rooms')) {
                return Promise.resolve({ error: false, data: MOCK_LOCATIONS });
            }
            if (url.includes('/loc-1/rooms')) {
                return Promise.resolve({ error: false, data: MOCK_ROOMS_LOC1 });
            }
            if (url.includes('/loc-2/rooms')) {
                return Promise.resolve({ error: false, data: MOCK_ROOMS_LOC2 });
            }
            if (url.includes('/devices')) {
                return Promise.resolve({ error: false, data: MOCK_DEVICES });
            }
            return Promise.resolve({ error: false, data: { items: [] } });
        });
        (window as any).electronAPI = { proxyRequest: mockProxy };
    });

    afterEach(() => {
        delete (window as any).electronAPI;
        vi.clearAllMocks();
    });

    it('should start with default state', () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));
        expect(result.current.isDiscovering).toBe(false);
        expect(result.current.discoveryData).toBeNull();
        expect(result.current.discoveryError).toBeNull();
        expect(result.current.selectedNodeRaw).toBeNull();
    });

    it('should set isDiscovering true during fetch, then false after', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        expect(result.current.isDiscovering).toBe(false);
        expect(result.current.discoveryData).not.toBeNull();
    });

    it('should correctly normalize locations', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        const data = result.current.discoveryData!;
        expect(data.locations).toHaveLength(2);
        expect(data.locations[0].locationId).toBe('loc-1');
        expect(data.locations[0].name).toBe('My Home');
        expect(data.locations[0].raw).toEqual(MOCK_LOCATIONS.items[0]);
    });

    it('should correctly normalize devices with optional roomId', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        const data = result.current.discoveryData!;
        expect(data.devices).toHaveLength(3);

        const assignedDevice = data.devices.find(d => d.deviceId === 'dev-1')!;
        expect(assignedDevice.roomId).toBe('room-1');
        expect(assignedDevice.locationId).toBe('loc-1');

        const unassignedDevice = data.devices.find(d => d.deviceId === 'dev-3')!;
        expect(unassignedDevice.roomId).toBeUndefined();
    });

    it('should fetch rooms for each location and normalize with locationId', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        const data = result.current.discoveryData!;
        expect(data.rooms).toHaveLength(3); // 2 from loc-1, 1 from loc-2
        expect(data.rooms.filter(r => r.locationId === 'loc-1')).toHaveLength(2);
        expect(data.rooms.filter(r => r.locationId === 'loc-2')).toHaveLength(1);
    });

    it('should set discoveryError when locations API fails', async () => {
        mockProxy.mockRejectedValue(new Error('Network unreachable'));
        (window as any).electronAPI = { proxyRequest: mockProxy };

        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        expect(result.current.discoveryData).toBeNull();
        expect(result.current.discoveryError).not.toBeNull();
        expect(result.current.isDiscovering).toBe(false);
    });

    it('should NOT re-fetch if cache is valid (within 5 minutes)', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        // 첫 번째 discover
        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });
        const callCountAfterFirst = mockProxy.mock.calls.length;

        // 두 번째 discover (캐시 유효 → API 재호출 없음)
        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        expect(mockProxy.mock.calls.length).toBe(callCountAfterFirst); // 호출 횟수 동일
    });

    it('should re-fetch after clearDiscovery (cache invalidated)', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });
        const callCountAfterFirst = mockProxy.mock.calls.length;

        // 캐시 초기화
        act(() => {
            result.current.clearDiscovery();
        });
        expect(result.current.discoveryData).toBeNull();

        // 다시 discover → API 재호출
        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });
        expect(mockProxy.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
    });

    it('should update selectedNodeRaw when selectNode is called', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));
        const testRaw = { deviceId: 'dev-1', label: 'Main Light' };

        act(() => {
            result.current.selectNode(testRaw);
        });

        expect(result.current.selectedNodeRaw).toEqual(testRaw);
    });

    it('should clear selectedNodeRaw when selectNode(null) is called', async () => {
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        act(() => {
            result.current.selectNode({ some: 'data' });
        });
        act(() => {
            result.current.selectNode(null);
        });

        expect(result.current.selectedNodeRaw).toBeNull();
    });

    it('should clear error and data on clearDiscovery', async () => {
        // 먼저 에러 상태로 만들기
        mockProxy.mockRejectedValue(new Error('fail'));
        (window as any).electronAPI = { proxyRequest: mockProxy };

        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });
        expect(result.current.discoveryError).not.toBeNull();

        act(() => {
            result.current.clearDiscovery();
        });

        expect(result.current.discoveryData).toBeNull();
        expect(result.current.discoveryError).toBeNull();
        expect(result.current.selectedNodeRaw).toBeNull();
    });

    it('should set fetchedAt timestamp on success', async () => {
        const before = Date.now();
        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });
        const after = Date.now();

        expect(result.current.discoveryData?.fetchedAt).toBeGreaterThanOrEqual(before);
        expect(result.current.discoveryData?.fetchedAt).toBeLessThanOrEqual(after);
    });

    it('should continue even if one location rooms fetch fails (partial result)', async () => {
        mockProxy.mockImplementation(({ url }: { url: string }) => {
            if (url.includes('/locations') && !url.includes('/rooms')) {
                return Promise.resolve({ error: false, data: MOCK_LOCATIONS });
            }
            if (url.includes('/loc-1/rooms')) {
                // loc-1 rooms 실패
                return Promise.resolve({ error: true, message: 'Room fetch failed' });
            }
            if (url.includes('/loc-2/rooms')) {
                return Promise.resolve({ error: false, data: MOCK_ROOMS_LOC2 });
            }
            if (url.includes('/devices')) {
                return Promise.resolve({ error: false, data: MOCK_DEVICES });
            }
            return Promise.resolve({ error: false, data: { items: [] } });
        });

        const { result } = renderHook(() => useSmartThingsDiscover(DEFAULT_PARAMS));

        await act(async () => {
            await result.current.discover(DEFAULT_ST_SPECIAL_REQUESTS);
        });

        // loc-1 rooms 실패해도 전체 discover는 성공
        expect(result.current.discoveryData).not.toBeNull();
        expect(result.current.discoveryError).toBeNull();
        // loc-2 rooms만 있음
        expect(result.current.discoveryData?.rooms).toHaveLength(1);
    });
});
