import { STLocation, STRoom, STDevice, STDeviceStatus, STCommandRequest } from '../types';

const BASE_URL = 'https://api.smartthings.com/v1';

export class SmartThingsService {
    private token: string;
    private baseUrl: string;

    constructor(token: string, baseUrl: string = BASE_URL) {
        this.token = token;
        // Allows switching backend (e.g. stacceptance)
        this.baseUrl = baseUrl;
    }

    private get headers() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    public updateConfig(token: string, baseUrl?: string) {
        this.token = token;
        if (baseUrl) this.baseUrl = baseUrl;
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.headers,
                ...options?.headers
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        return response.json();
    }

    async getLocations(): Promise<STLocation[]> {
        const res = await this.request<{ items: STLocation[] }>('/locations');
        return res.items;
    }

    async getRooms(locationId: string): Promise<STRoom[]> {
        const res = await this.request<{ items: STRoom[] }>(`/locations/${locationId}/rooms`);
        return res.items;
    }

    async getDevices(locationId?: string): Promise<STDevice[]> {
        const query = locationId ? `?locationId=${locationId}` : '';
        const res = await this.request<{ items: STDevice[] }>(`/devices${query}`);
        return res.items;
    }

    async getDeviceStatus(deviceId: string): Promise<STDeviceStatus> {
        return this.request<STDeviceStatus>(`/devices/${deviceId}/status`);
    }

    async executeCommand(deviceId: string, commands: STCommandRequest[]): Promise<any> {
        return this.request(`/devices/${deviceId}/commands`, {
            method: 'POST',
            body: JSON.stringify({ commands })
        });
    }

    // New: Fetch device presentation for UI rendering
    async getDevicePresentation(deviceId: string): Promise<any> {
        return this.request(`/devices/${deviceId}/presentation`);
    }

    async getCapability(capabilityId: string, version: number): Promise<any> {
        return this.request(`/capabilities/${capabilityId}/${version}`);
    }
}
