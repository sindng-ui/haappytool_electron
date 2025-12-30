import { LucideIcon } from 'lucide-react';
import * as Lucide from 'lucide-react';

export interface Device {
    id: string;
    name: string;
    subLabel: string;
    state: 'on' | 'off' | 'offline';
    type: 'refrigerator' | 'tv' | 'light' | 'dishwasher';
    isFavorite: boolean;
    location: string;
}

export const MOCK_DEVICES: Device[] = [
    {
        id: '1',
        name: 'Kitchen',
        subLabel: 'Refrigerator',
        state: 'on', // "Door closed" implies active monitoring/on state
        type: 'refrigerator',
        isFavorite: true,
        location: 'Kitchen'
    },
    {
        id: '2',
        name: 'Living room',
        subLabel: 'The Frame',
        state: 'on',
        type: 'tv',
        isFavorite: true,
        location: 'Living room'
    },
    {
        id: '3',
        name: 'Home Office',
        subLabel: 'Cono Lamp - Desk #1',
        state: 'on',
        type: 'light',
        isFavorite: true,
        location: 'Home Office'
    },
    {
        id: '4',
        name: 'Home Office',
        subLabel: 'Cono Lamp - Desk #2',
        state: 'off',
        type: 'light',
        isFavorite: true,
        location: 'Home Office'
    },
    {
        id: '5',
        name: 'Our Bedroom',
        subLabel: 'Bedroom Lamp',
        state: 'off',
        type: 'light',
        isFavorite: true,
        location: 'Our Bedroom'
    },
    {
        id: '6',
        name: 'Our Bedroom',
        subLabel: 'Cono Lamp - Table',
        state: 'off',
        type: 'light',
        isFavorite: true,
        location: 'Our Bedroom'
    },
    {
        id: '7',
        name: 'Our Bedroom',
        subLabel: 'Cono Lamp - Closet',
        state: 'offline',
        type: 'light',
        isFavorite: true,
        location: 'Our Bedroom'
    },
    {
        id: '8',
        name: 'Living room',
        subLabel: 'Floor Lamp',
        state: 'off',
        type: 'light',
        isFavorite: true,
        location: 'Living room'
    },
    {
        id: '9',
        name: 'Living room',
        subLabel: 'Floor Lamp #2',
        state: 'off',
        type: 'light',
        isFavorite: true,
        location: 'Living room'
    },
    {
        id: '10',
        name: 'Kitchen',
        subLabel: 'Dishwasher',
        state: 'off',
        type: 'dishwasher',
        isFavorite: true,
        location: 'Kitchen'
    }
];

export const STATUS_BAR_ITEMS = [
    { id: '1', label: 'Ring my phone', icon: 'Smartphone', subLabel: null, active: false },
    { id: '2', label: 'Offline', icon: 'CloudOff', subLabel: '1 device', active: false }, // Using CloudOff as proxy for offline
    { id: '3', label: 'Energy', icon: 'Zap', subLabel: '9.37 kWh', active: false },
    { id: '4', label: 'Lights', icon: 'Lightbulb', subLabel: '2 on', active: false },
];
