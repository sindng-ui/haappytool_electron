import React from 'react';
import { HappyPlugin } from '../plugins/types';

interface PluginContainerProps {
    plugin: HappyPlugin;
    isActive: boolean;
}

const PluginContainer: React.FC<PluginContainerProps> = ({ plugin, isActive }) => {
    const Component = plugin.component;

    return (
        <div className={isActive ? "h-full w-full" : "hidden"}>
            <Component />
        </div>
    );
};

export default PluginContainer;
