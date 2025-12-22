import { HappyPlugin } from './types';
import {
    LogExtractorPlugin,
    PostToolPlugin,
    JsonToolsPlugin,
    TpkExtractorPlugin,
    SmartThingsDevicesPlugin,
    ReverseEngineerPlugin
} from './core/wrappers';

// Registry array to hold all registered plugins
export const ALL_PLUGINS: HappyPlugin[] = [
    LogExtractorPlugin,
    PostToolPlugin,
    JsonToolsPlugin,
    TpkExtractorPlugin,
    SmartThingsDevicesPlugin,
    ReverseEngineerPlugin
];

export const getPluginById = (id: string): HappyPlugin | undefined => {
    return ALL_PLUGINS.find(p => p.id === id);
};
