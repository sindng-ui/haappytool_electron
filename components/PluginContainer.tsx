import React from 'react';
import { HappyPlugin } from '../plugins/types';

interface PluginContainerProps {
    plugin: HappyPlugin;
    isActive: boolean;
}

const PluginContainer: React.FC<PluginContainerProps> = ({ plugin, isActive }) => {
    const Component = plugin.component;

    return (
        <React.Suspense fallback={
            <div className={isActive ? "h-full w-full flex items-center justify-center text-slate-500" : "hidden"}>
                Loading Plugin...
            </div>
        }>
            <div className={isActive ? "h-full w-full" : "hidden"}>
                <Component isActive={isActive} />
            </div>
        </React.Suspense>
    );
};

export default PluginContainer;
