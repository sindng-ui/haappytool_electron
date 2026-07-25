import { useState, useCallback, useRef } from 'react';
import {
    STSpecialRequest,
    STDiscoveryData,
    STLocation,
    STRoom,
    STDevice,
    PostGlobalVariable,
    EnvironmentProfile,
    PostGlobalAuth,
} from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

// ─── Types ───────────────────────────────────────────────────────────────────
export interface UseSmartThingsDiscoverParams {
    globalVariables: PostGlobalVariable[];
    envProfiles: EnvironmentProfile[];
    activeEnvId: string;
    globalAuth?: PostGlobalAuth | null;
}

export interface STDeviceStatusSummary {
    healthState?: 'ONLINE' | 'OFFLINE' | 'UNHEALTHY';
    switch?: 'on' | 'off';
    temperature?: number;
    unit?: string;
    motion?: 'active' | 'inactive';
    level?: number;
    rawStatus?: any;
    loading?: boolean;
}

export interface UseSmartThingsDiscoverReturn {
    isDiscovering: boolean;
    discoveryData: STDiscoveryData | null;
    discoveryError: string | null;
    discover: (specialRequests: STSpecialRequest[]) => Promise<void>;
    clearDiscovery: () => void;
    selectedNodeRaw: any | null;
    selectNode: (raw: any | null) => void;
    deviceStatusMap: Record<string, STDeviceStatusSummary>;
    fetchDeviceStatus: (deviceId: string) => Promise<void>;
    loadMockData: () => void;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** 특수문자 이스케이프 (RegExp 안전) */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * globalVariables + envProfiles 기반 변수 치환 함수 생성.
 * PostTool.tsx의 replaceVariables와 동일한 로직.
 */
export function makeReplaceVariables(
    globalVariables: PostGlobalVariable[],
    envProfiles: EnvironmentProfile[],
): (str: string) => string {
    return (str: string): string => {
        let res = str;

        // Profile-scoped variables (e.g. {{ProfileName.varKey}})
        envProfiles.forEach((profile) => {
            profile.variables.forEach((v) => {
                if (v.enabled) {
                    const pattern = `{{${profile.name}.${v.key}}}`;
                    res = res.split(pattern).join(v.value);
                }
            });
        });

        // Global variables (e.g. {{baseUrl}})
        globalVariables.forEach((v) => {
            if (v.enabled) {
                res = res.replace(
                    new RegExp(`{{${escapeRegExp(v.key)}}}`, 'g'),
                    v.value,
                );
            }
        });

        return res;
    };
}

/**
 * Electron proxyRequest 또는 fetch를 통해 GET 요청을 수행하고
 * 응답 data(JSON)를 반환합니다.
 * @throws Error - 네트워크 오류 또는 proxy 오류 시
 */
export async function proxyGet(
    url: string,
    auth: PostGlobalAuth | null | undefined,
): Promise<any> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (auth?.enabled && auth.type === 'bearer' && auth.bearerToken) {
        headers['Authorization'] = `Bearer ${auth.bearerToken}`;
    } else if (auth?.enabled && auth.type === 'basic' && auth.basicUsername) {
        const encoded = btoa(`${auth.basicUsername}:${auth.basicPassword ?? ''}`);
        headers['Authorization'] = `Basic ${encoded}`;
    }

    // Electron Proxy 우선 (CORS 우회)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.proxyRequest) {
        const res = await (window as any).electronAPI.proxyRequest({
            method: 'GET',
            url,
            headers,
        });
        if (res.error) {
            throw new Error(res.message || `Proxy request failed: ${url}`);
        }
        return res.data;
    }

    // Fallback: browser fetch
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
    }
    return res.json();
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeLocations(items: any[]): STLocation[] {
    return items.map((item) => ({
        locationId: item.locationId ?? item.id ?? '',
        name: item.name ?? 'Unknown Location',
        raw: item,
    }));
}

function normalizeRooms(items: any[], locationId: string): STRoom[] {
    return items.map((item) => ({
        roomId: item.roomId ?? item.id ?? '',
        locationId,
        name: item.name ?? 'Unknown Room',
        raw: item,
    }));
}

function normalizeDevices(items: any[]): STDevice[] {
    return items.map((item) => ({
        deviceId: item.deviceId ?? item.id ?? '',
        locationId: item.locationId ?? '',
        roomId: item.roomId ?? undefined,
        label: item.label ?? item.name ?? 'Unknown Device',
        deviceTypeName: item.deviceTypeName ?? item.type ?? undefined,
        components: item.components ?? undefined,
        raw: item,
    }));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function parseDeviceStatus(statusRaw: any, healthRaw?: any): STDeviceStatusSummary {
    const summary: STDeviceStatusSummary = { rawStatus: statusRaw };

    // 1. Health state parsing (ONLINE, OFFLINE, UNHEALTHY)
    const rawState = healthRaw?.state || healthRaw?.healthStatus || statusRaw?.healthState || statusRaw?.state;
    if (rawState) {
        const upper = String(rawState).toUpperCase();
        if (upper === 'ONLINE' || upper === 'OFFLINE' || upper === 'UNHEALTHY') {
            summary.healthState = upper as any;
        }
    }

    if (!statusRaw?.components?.main) return summary;

    const main = statusRaw.components.main;
    if (main.switch?.switch?.value) {
        summary.switch = main.switch.switch.value;
    }
    if (main.temperatureMeasurement?.temperature?.value !== undefined) {
        summary.temperature = main.temperatureMeasurement.temperature.value;
        summary.unit = main.temperatureMeasurement.temperature.unit || '°C';
    }
    if (main.motionSensor?.motion?.value) {
        summary.motion = main.motionSensor.motion.value;
    }
    if (main.switchLevel?.level?.value !== undefined) {
        summary.level = main.switchLevel.level.value;
    }
    return summary;
}

export function useSmartThingsDiscover({
    globalVariables,
    envProfiles,
    activeEnvId,
    globalAuth,
}: UseSmartThingsDiscoverParams): UseSmartThingsDiscoverReturn {
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoveryData, setDiscoveryData] = useState<STDiscoveryData | null>(null);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);
    const [selectedNodeRaw, setSelectedNodeRaw] = useState<any | null>(null);
    const [deviceStatusMap, setDeviceStatusMap] = useState<Record<string, STDeviceStatusSummary>>({});

    // envId → STDiscoveryData 캐시 (컴포넌트 생명주기 동안 유지)
    const cacheRef = useRef<Map<string, STDiscoveryData>>(new Map());

    const fetchDeviceStatus = useCallback(
        async (deviceId: string) => {
            if (!deviceId) return;
            const replaceVars = makeReplaceVariables(globalVariables, envProfiles);
            const baseUrl = replaceVars('{{baseUrl}}');
            const statusUrl = `${baseUrl}/v1/devices/${deviceId}/status`;
            const healthUrl = `${baseUrl}/v1/devices/${deviceId}/health`;

            setDeviceStatusMap((prev) => ({
                ...prev,
                [deviceId]: { ...prev[deviceId], loading: true },
            }));

            try {
                const statusRaw = await proxyGet(statusUrl, globalAuth);
                const summary = parseDeviceStatus(statusRaw);
                setDeviceStatusMap((prev) => ({
                    ...prev,
                    [deviceId]: { ...summary, loading: false },
                }));
            } catch (err) {
                setDeviceStatusMap((prev) => ({
                    ...prev,
                    [deviceId]: { ...prev[deviceId], loading: false },
                }));
            }
        },
        [globalVariables, envProfiles, globalAuth],
    );

    const discover = useCallback(
        async (specialRequests: STSpecialRequest[]) => {
            // ① 캐시 확인 (5분 이내 동일 환경 호출 시 재사용)
            const cached = cacheRef.current.get(activeEnvId);
            if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
                setDiscoveryData(cached);
                return;
            }

            const locReq = specialRequests.find((r) => r.id === 'locations');
            const roomReq = specialRequests.find((r) => r.id === 'rooms');
            const devReq = specialRequests.find((r) => r.id === 'devices');

            if (!locReq || !devReq) {
                setDiscoveryError(
                    'Locations 또는 Devices Special Request가 설정되지 않았습니다.',
                );
                return;
            }

            setIsDiscovering(true);
            setDiscoveryError(null);

            try {
                const replaceVars = makeReplaceVariables(globalVariables, envProfiles);

                const locUrl = replaceVars(locReq.url);
                const devUrl = replaceVars(devReq.url);

                // ② Locations + Devices 병렬 호출
                const [locRaw, devRaw] = await Promise.all([
                    proxyGet(locUrl, globalAuth),
                    proxyGet(devUrl, globalAuth),
                ]);

                const locations = normalizeLocations(locRaw?.items ?? []);
                const devices = normalizeDevices(devRaw?.items ?? []);

                // ③ 각 Location에 대한 Rooms 병렬 호출
                let rooms: STRoom[] = [];
                if (roomReq && locations.length > 0) {
                    const roomsPerLocation = await Promise.all(
                        locations.map(async (loc) => {
                            // {{locationId}} 치환 후 글로벌 변수도 적용
                            const rawRoomUrl = roomReq.url.replace(
                                /\{\{locationId\}\}/g,
                                loc.locationId,
                            );
                            const roomUrl = replaceVars(rawRoomUrl);
                            try {
                                const roomRaw = await proxyGet(roomUrl, globalAuth);
                                return normalizeRooms(roomRaw?.items ?? [], loc.locationId);
                            } catch {
                                // 특정 location의 rooms 조회 실패는 무시하고 계속
                                return [];
                            }
                        }),
                    );
                    rooms = roomsPerLocation.flat();
                }

                const result: STDiscoveryData = {
                    locations,
                    rooms,
                    devices,
                    fetchedAt: Date.now(),
                };

                cacheRef.current.set(activeEnvId, result);
                setDiscoveryData(result);
            } catch (err: any) {
                setDiscoveryError(err.message ?? 'Discovery 중 알 수 없는 오류가 발생했습니다.');
            } finally {
                setIsDiscovering(false);
            }
        },
        [globalVariables, envProfiles, activeEnvId, globalAuth],
    );

    const clearDiscovery = useCallback(() => {
        setDiscoveryData(null);
        setDiscoveryError(null);
        setSelectedNodeRaw(null);
        setDeviceStatusMap({});
        cacheRef.current.delete(activeEnvId);
    }, [activeEnvId]);

    const selectNode = useCallback((raw: any | null) => {
        setSelectedNodeRaw(raw);
    }, []);

    const loadMockData = useCallback(() => {
        const mockLocations: STLocation[] = [
            {
                locationId: 'mock-loc-1',
                name: '🏠 Smart Home Hub',
                raw: { locationId: 'mock-loc-1', name: 'Smart Home Hub', countryCode: 'KR' },
            },
            {
                locationId: 'mock-loc-2',
                name: '🏢 Innovation Office',
                raw: { locationId: 'mock-loc-2', name: 'Innovation Office', countryCode: 'KR' },
            },
        ];

        const mockRooms: STRoom[] = [
            {
                roomId: 'mock-room-1',
                locationId: 'mock-loc-1',
                name: 'Living Room',
                raw: { roomId: 'mock-room-1', locationId: 'mock-loc-1', name: 'Living Room' },
            },
            {
                roomId: 'mock-room-2',
                locationId: 'mock-loc-1',
                name: 'Master Bedroom',
                raw: { roomId: 'mock-room-2', locationId: 'mock-loc-1', name: 'Master Bedroom' },
            },
            {
                roomId: 'mock-room-3',
                locationId: 'mock-loc-2',
                name: 'Meeting Room A',
                raw: { roomId: 'mock-room-3', locationId: 'mock-loc-2', name: 'Meeting Room A' },
            },
        ];

        const mockDevices: STDevice[] = [
            {
                deviceId: 'mock-dev-1',
                locationId: 'mock-loc-1',
                roomId: 'mock-room-1',
                label: 'Living Main Light',
                deviceTypeName: 'c2c-color-bulb',
                raw: { deviceId: 'mock-dev-1', label: 'Living Main Light', type: 'c2c-color-bulb' },
            },
            {
                deviceId: 'mock-dev-2',
                locationId: 'mock-loc-1',
                roomId: 'mock-room-1',
                label: 'Smart Air Conditioner',
                deviceTypeName: 'samsung-air-conditioner',
                raw: { deviceId: 'mock-dev-2', label: 'Smart Air Conditioner', type: 'samsung-air-conditioner' },
            },
            {
                deviceId: 'mock-dev-3',
                locationId: 'mock-loc-1',
                roomId: 'mock-room-2',
                label: 'Front Smart Doorlock',
                deviceTypeName: 'smart-lock',
                raw: { deviceId: 'mock-dev-3', label: 'Front Smart Doorlock', type: 'smart-lock' },
            },
            {
                deviceId: 'mock-dev-4',
                locationId: 'mock-loc-2',
                roomId: 'mock-room-3',
                label: 'Motion Sensor',
                deviceTypeName: 'motion-sensor',
                raw: { deviceId: 'mock-dev-4', label: 'Motion Sensor', type: 'motion-sensor' },
            },
            {
                deviceId: 'mock-dev-5',
                locationId: 'mock-loc-1',
                // Unassigned
                label: 'Robot Vacuum Cleaner',
                deviceTypeName: 'robot-cleaner',
                raw: { deviceId: 'mock-dev-5', label: 'Robot Vacuum Cleaner', type: 'robot-cleaner' },
            },
        ];

        setDiscoveryData({
            locations: mockLocations,
            rooms: mockRooms,
            devices: mockDevices,
            fetchedAt: Date.now(),
        });
        setDiscoveryError(null);

        // Populate Mock Statuses with Health States (ONLINE / OFFLINE)
        setDeviceStatusMap({
            'mock-dev-1': { healthState: 'ONLINE', switch: 'on', level: 80 },
            'mock-dev-2': { healthState: 'ONLINE', temperature: 22, unit: '°C' },
            'mock-dev-3': { healthState: 'OFFLINE', switch: 'off' },
            'mock-dev-4': { healthState: 'ONLINE', motion: 'active' },
            'mock-dev-5': { healthState: 'OFFLINE', switch: 'off' },
        });
    }, []);

    return {
        isDiscovering,
        discoveryData,
        discoveryError,
        discover,
        clearDiscovery,
        selectedNodeRaw,
        selectNode,
        deviceStatusMap,
        fetchDeviceStatus,
        loadMockData,
    };
}
