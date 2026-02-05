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

    /**
     * Helper method to fetch all pages from a paginated API endpoint
     * SmartThings API returns { items: T[], _links?: { next?: string } }
     */
    private async fetchAllPages<T>(endpoint: string): Promise<T[]> {
        let allItems: T[] = [];
        let nextUrl: string | null = endpoint;

        while (nextUrl) {
            const response = await this.request<{ items: T[], _links?: { next?: string } }>(nextUrl);
            allItems = allItems.concat(response.items || []);

            // Check if there's a next page
            if (response._links?.next) {
                // Extract just the path and query from the full URL
                const url = new URL(response._links.next);
                nextUrl = url.pathname + url.search;
            } else {
                nextUrl = null;
            }
        }

        return allItems;
    }

    async getLocations(): Promise<STLocation[]> {
        return this.fetchAllPages<STLocation>('/locations');
    }

    async getRooms(locationId: string): Promise<STRoom[]> {
        return this.fetchAllPages<STRoom>(`/locations/${locationId}/rooms`);
    }

    async getDevices(locationId?: string): Promise<STDevice[]> {
        const query = locationId ? `?locationId=${locationId}` : '';
        return this.fetchAllPages<STDevice>(`/devices${query}`);
    }

    async getDeviceStatus(deviceId: string): Promise<STDeviceStatus> {
        return this.request<STDeviceStatus>(`/devices/${deviceId}/status`);
    }

    async getDeviceHealth(deviceId: string): Promise<{ state: 'ONLINE' | 'OFFLINE' | 'UNKNOWN', lastUpdatedDate?: string }> {
        return this.request(`/devices/${deviceId}/health`);
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

    // NEW: Virtual Device Management
    async createVirtualDevice(data: { name: string, ownerId: string, locationId: string, deviceProfileId?: string }): Promise<any> {
        return this.request('/devices', {
            method: 'POST',
            body: JSON.stringify({
                label: data.name,
                locationId: data.locationId,
                prototype: 'VIRTUAL',
                virtualDevice: {
                    name: data.name,
                    deviceProfileId: data.deviceProfileId
                }
            })
        });
    }

    async deleteDevice(deviceId: string): Promise<any> {
        return this.request(`/devices/${deviceId}`, {
            method: 'DELETE'
        });
    }
}
