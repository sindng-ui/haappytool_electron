import { describe, it, expect } from 'vitest';
import {
    DEFAULT_ST_SPECIAL_REQUESTS,
    resolveSTSpecialRequests,
    createEmptyDiscoveryData,
} from '../../utils/stDefaults';
import type {
    STSpecialRequest,
    STLocation,
    STRoom,
    STDevice,
    STDiscoveryData,
    STSelectedNode,
} from '../../types';

// ─────────────────────────────────────────────
// 1단계 UT: SmartThings 타입 정의 & 기본값 유틸리티
// ─────────────────────────────────────────────

describe('DEFAULT_ST_SPECIAL_REQUESTS', () => {
    it('should contain exactly 3 items', () => {
        expect(DEFAULT_ST_SPECIAL_REQUESTS).toHaveLength(3);
    });

    it('should have ids: locations, rooms, devices in order', () => {
        const ids = DEFAULT_ST_SPECIAL_REQUESTS.map((r) => r.id);
        expect(ids).toEqual(['locations', 'rooms', 'devices']);
    });

    it('each request should have GET method', () => {
        DEFAULT_ST_SPECIAL_REQUESTS.forEach((req) => {
            expect(req.method).toBe('GET');
        });
    });

    it('each url should use {{baseUrl}} prefix', () => {
        DEFAULT_ST_SPECIAL_REQUESTS.forEach((req) => {
            expect(req.url).toMatch(/^\{\{baseUrl\}\}/);
        });
    });

    it('each request should have a non-empty label and description', () => {
        DEFAULT_ST_SPECIAL_REQUESTS.forEach((req) => {
            expect(req.label.length).toBeGreaterThan(0);
            expect(req.description.length).toBeGreaterThan(0);
        });
    });

    it('locations url should end with /v1/locations', () => {
        const loc = DEFAULT_ST_SPECIAL_REQUESTS.find((r) => r.id === 'locations')!;
        expect(loc.url).toContain('/v1/locations');
    });

    it('rooms url should contain /rooms', () => {
        const rooms = DEFAULT_ST_SPECIAL_REQUESTS.find((r) => r.id === 'rooms')!;
        expect(rooms.url).toContain('/rooms');
    });

    it('devices url should end with /v1/devices', () => {
        const devices = DEFAULT_ST_SPECIAL_REQUESTS.find((r) => r.id === 'devices')!;
        expect(devices.url).toContain('/v1/devices');
    });
});

// ─────────────────────────────────────────────
describe('resolveSTSpecialRequests', () => {
    it('should return defaults when saved is undefined', () => {
        const result = resolveSTSpecialRequests(undefined);
        expect(result).toEqual(DEFAULT_ST_SPECIAL_REQUESTS);
    });

    it('should return defaults when saved is empty array', () => {
        const result = resolveSTSpecialRequests([]);
        expect(result).toEqual(DEFAULT_ST_SPECIAL_REQUESTS);
    });

    it('should override url when user saves a custom url for locations', () => {
        const saved: STSpecialRequest[] = [
            {
                id: 'locations',
                label: 'Locations',
                icon: 'MapPin',
                method: 'GET',
                url: 'https://custom.url/v1/locations',
                description: 'Custom',
            },
        ];
        const result = resolveSTSpecialRequests(saved);
        const loc = result.find((r) => r.id === 'locations')!;
        expect(loc.url).toBe('https://custom.url/v1/locations');
    });

    it('should keep non-overridden items at default values', () => {
        const saved: STSpecialRequest[] = [
            {
                id: 'devices',
                label: 'Devices',
                icon: 'Cpu',
                method: 'GET',
                url: '{{baseUrl}}/v1/devices?locationId={{locationId}}',
                description: 'Custom devices',
            },
        ];
        const result = resolveSTSpecialRequests(saved);
        const loc = result.find((r) => r.id === 'locations')!;
        const rooms = result.find((r) => r.id === 'rooms')!;
        // locations, rooms should be default
        expect(loc.url).toBe(DEFAULT_ST_SPECIAL_REQUESTS[0].url);
        expect(rooms.url).toBe(DEFAULT_ST_SPECIAL_REQUESTS[1].url);
        // devices should be overridden
        const devices = result.find((r) => r.id === 'devices')!;
        expect(devices.url).toBe('{{baseUrl}}/v1/devices?locationId={{locationId}}');
    });

    it('should always return 3 items regardless of saved count', () => {
        const saved: STSpecialRequest[] = [
            {
                id: 'locations',
                label: 'L',
                icon: 'MapPin',
                method: 'GET',
                url: '{{baseUrl}}/v1/locations',
                description: '',
            },
        ];
        const result = resolveSTSpecialRequests(saved);
        expect(result).toHaveLength(3);
    });

    it('should preserve order: locations, rooms, devices', () => {
        const saved: STSpecialRequest[] = [
            { id: 'devices', label: 'D', icon: 'Cpu', method: 'GET', url: 'x', description: '' },
            { id: 'rooms', label: 'R', icon: 'Home', method: 'GET', url: 'y', description: '' },
            { id: 'locations', label: 'L', icon: 'MapPin', method: 'GET', url: 'z', description: '' },
        ];
        const result = resolveSTSpecialRequests(saved);
        expect(result[0].id).toBe('locations');
        expect(result[1].id).toBe('rooms');
        expect(result[2].id).toBe('devices');
    });
});

// ─────────────────────────────────────────────
describe('createEmptyDiscoveryData', () => {
    it('should return empty arrays for locations, rooms, devices', () => {
        const data = createEmptyDiscoveryData();
        expect(data.locations).toEqual([]);
        expect(data.rooms).toEqual([]);
        expect(data.devices).toEqual([]);
    });

    it('should have fetchedAt = 0', () => {
        const data = createEmptyDiscoveryData();
        expect(data.fetchedAt).toBe(0);
    });
});

// ─────────────────────────────────────────────
describe('STDiscoveryData type shape', () => {
    it('should allow constructing a valid STDiscoveryData object', () => {
        const location: STLocation = {
            locationId: 'loc-1',
            name: 'My Home',
            raw: { locationId: 'loc-1', name: 'My Home' },
        };
        const room: STRoom = {
            roomId: 'room-1',
            locationId: 'loc-1',
            name: 'Living Room',
            raw: { roomId: 'room-1' },
        };
        const device: STDevice = {
            deviceId: 'dev-1',
            locationId: 'loc-1',
            roomId: 'room-1',
            label: 'Main Light',
            deviceTypeName: 'c2c-rgbw-color-bulb',
            raw: { deviceId: 'dev-1' },
        };

        const data: STDiscoveryData = {
            locations: [location],
            rooms: [room],
            devices: [device],
            fetchedAt: Date.now(),
        };

        expect(data.locations[0].locationId).toBe('loc-1');
        expect(data.rooms[0].locationId).toBe('loc-1');
        expect(data.devices[0].roomId).toBe('room-1');
    });

    it('STDevice.roomId should be optional (undefined allowed)', () => {
        const device: STDevice = {
            deviceId: 'dev-2',
            locationId: 'loc-1',
            // roomId is intentionally omitted
            label: 'Unassigned Device',
            raw: {},
        };
        expect(device.roomId).toBeUndefined();
    });
});

// ─────────────────────────────────────────────
describe('STSelectedNode type shape', () => {
    it('should allow all STNodeType values', () => {
        const locationNode: STSelectedNode = { type: 'location', id: 'loc-1', raw: {} };
        const roomNode: STSelectedNode = { type: 'room', id: 'room-1', raw: {} };
        const deviceNode: STSelectedNode = { type: 'device', id: 'dev-1', raw: {} };

        expect(locationNode.type).toBe('location');
        expect(roomNode.type).toBe('room');
        expect(deviceNode.type).toBe('device');
    });
});
