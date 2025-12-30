import React from 'react';
import * as Lucide from 'lucide-react';
import { Device } from './mockData';
import './styles.css';

interface DeviceTileProps {
    device: Device;
}

const DeviceTile: React.FC<DeviceTileProps> = ({ device }) => {
    const isOffline = device.state === 'offline';
    // const isOn = device.state === 'on'; // Unused in this version in favor of CSS classes

    let IconComponent = Lucide.Circle; // Default fallback
    if (device.type === 'refrigerator') IconComponent = Lucide.Refrigerator;
    if (device.type === 'tv') IconComponent = Lucide.Tv;
    if (device.type === 'light') IconComponent = Lucide.Lightbulb;
    if (device.type === 'dishwasher') IconComponent = Lucide.Eraser; // Approximation for dishwasher if not available

    const getStatusText = () => {
        if (device.state === 'offline') return 'Offline';
        if (device.subLabel.includes('Refrigerator')) return 'Door closed';
        if (device.subLabel.includes('Frame')) return 'SmartThings';
        return device.state === 'on' ? 'On' : 'Off';
    };

    // Determine CSS classes based on state
    // Screenshot: "Home Office Cono Lamp - Desk #1" is white (active/selected?)
    // Others on are Blue. Off are Dark Blue.
    const getTileClass = () => {
        let classes = 'sh-tile';
        if (device.state === 'offline') classes += ' offline';
        else if (device.state === 'off') classes += ' off';
        // Special case for the "active" white tile in screenshot
        if (device.subLabel === 'Cono Lamp - Desk #1') classes += ' active';
        return classes;
    };

    return (
        <button className={getTileClass()}>
            <div className="flex justify-between w-full">
                <IconComponent className="sh-icon" size={24} />
                {/* Power icon at top right for some tiles */}
                {device.type !== 'refrigerator' && device.type !== 'dishwasher' && (
                    <Lucide.Power size={18} className="opacity-50" />
                )}
            </div>

            <div className="flex flex-col text-left">
                <span className="sh-tile-location">{device.name}</span>
                <span className="sh-tile-sublabel sh-tile-label">{device.subLabel}</span>
                <span className="sh-tile-status mt-2 block">{getStatusText()}</span>
            </div>
        </button>
    );
};

export default DeviceTile;
