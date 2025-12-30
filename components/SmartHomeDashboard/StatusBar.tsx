import React from 'react';
import * as Lucide from 'lucide-react';
import { STATUS_BAR_ITEMS } from './mockData';
import './styles.css';

const StatusBar: React.FC = () => {
    return (
        <div className="sh-status-bar">
            {STATUS_BAR_ITEMS.map((item) => {
                const Icon = (Lucide as any)[item.icon];
                return (
                    <div key={item.id} className="sh-status-item">
                        {Icon && <Icon size={24} color="#ffffff" />}
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm">{item.label}</span>
                            {item.subLabel && <span className="text-xs opacity-75">{item.subLabel}</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default StatusBar;
