import { STSpecialRequest } from '../types';

/**
 * SmartThings Special Request 기본값 3종 세트.
 * - 유저가 AppSettings에 stSpecialRequests를 저장하지 않은 경우 이 값이 fallback으로 사용됩니다.
 * - url 필드에는 환경 변수 {{baseUrl}} 을 사용하여 prod/acc 전환이 가능합니다.
 */
export const DEFAULT_ST_SPECIAL_REQUESTS: STSpecialRequest[] = [
    {
        id: 'locations',
        label: 'Locations',
        icon: 'MapPin',
        method: 'GET',
        url: '{{baseUrl}}/v1/locations',
        description: 'List all SmartThings locations',
        headers: [{ key: 'Accept', value: 'application/json' }, { key: '', value: '' }],
        body: '',
    },
    {
        id: 'rooms',
        label: 'Rooms',
        icon: 'Home',
        method: 'GET',
        url: '{{baseUrl}}/v1/locations/{{locationId}}/rooms',
        description: 'List rooms for a specific location',
        headers: [{ key: 'Accept', value: 'application/json' }, { key: '', value: '' }],
        body: '',
    },
    {
        id: 'devices',
        label: 'Devices',
        icon: 'Cpu',
        method: 'GET',
        url: '{{baseUrl}}/v1/devices',
        description: 'List all SmartThings devices',
        headers: [{ key: 'Accept', value: 'application/json' }, { key: '', value: '' }],
        body: '',
    },
];

/**
 * AppSettings에서 stSpecialRequests를 불러오되,
 * 없으면 기본값으로 채우고 순서를 보장합니다.
 */
export function resolveSTSpecialRequests(
    saved: STSpecialRequest[] | undefined
): STSpecialRequest[] {
    if (!saved || saved.length === 0) {
        return DEFAULT_ST_SPECIAL_REQUESTS;
    }

    return DEFAULT_ST_SPECIAL_REQUESTS.map((def) => {
        const userOverride = saved.find((s) => s.id === def.id);
        if (!userOverride) return def;
        return {
            ...def,
            ...userOverride,
            headers: userOverride.headers ?? def.headers,
            body: userOverride.body ?? def.body,
        };
    });
}

/**
 * STDiscoveryData 빈 초기값 생성 유틸리티
 */
export function createEmptyDiscoveryData() {
    return {
        locations: [],
        rooms: [],
        devices: [],
        fetchedAt: 0,
    };
}
