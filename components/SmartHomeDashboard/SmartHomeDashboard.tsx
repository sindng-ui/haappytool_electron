import React from 'react';
import * as Lucide from 'lucide-react';
import StatusBar from './StatusBar';
import DeviceTile from './DeviceTile';
import { MOCK_DEVICES } from './mockData';
import './styles.css';

const SmartHomeDashboard: React.FC = () => {
    return (
        <div className="sh-container p-6">
            <div className="sh-header">
                <div className="flex items-center gap-2">
                    <span>Dashboard | House</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-normal">
                    <Lucide.CloudSun size={18} />
                    <span>73 °F</span>
                </div>
            </div>

            <StatusBar />

            <div className="mb-4">
                <h2 className="text-lg font-medium mb-3">Favorites</h2>
                <div className="sh-grid">
                    {MOCK_DEVICES.map((device) => (
                        <DeviceTile key={device.id} device={device} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SmartHomeDashboard;
