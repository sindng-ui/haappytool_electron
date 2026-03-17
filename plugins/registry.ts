import { HappyPlugin } from './types';
import {
    LogExtractorPlugin,
    PostToolPlugin,
    JsonToolsPlugin,
    TpkExtractorPlugin,
    SmartThingsDevicesPlugin,
    ReverseEngineerPlugin,
    BlockTestPlugin,
    EasyUMLPlugin,
    CpuAnalyzerPlugin,
    SmartHomeDashboardPlugin,
    ScreenMatcherPlugin,
    AiAssistantPlugin,
    SmartThingsLabPluginWrapper,
    TizenLabPluginWrapper,
    EasyPostPlugin,
    PerfToolPlugin,
    SpeedScopePlugin
} from './core/wrappers';

// Registry array to hold all registered plugins
export const ALL_PLUGINS: HappyPlugin[] = [

    LogExtractorPlugin,
    PostToolPlugin,
    JsonToolsPlugin,
    TpkExtractorPlugin,
    SmartThingsDevicesPlugin,
    ReverseEngineerPlugin,
    BlockTestPlugin,
    EasyUMLPlugin,
    CpuAnalyzerPlugin,
    SmartHomeDashboardPlugin,
    ScreenMatcherPlugin,
    // AiAssistantPlugin, // Disabled - causes startup failure
    SmartThingsLabPluginWrapper,
    TizenLabPluginWrapper,
    EasyPostPlugin,
    PerfToolPlugin,
    SpeedScopePlugin
];

export const getPluginById = (id: string): HappyPlugin | undefined => {
    return ALL_PLUGINS.find(p => p.id === id);
};
