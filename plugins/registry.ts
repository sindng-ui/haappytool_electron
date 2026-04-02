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
    SpeedScopePlugin,
    NetTrafficAnalyzerPluginWrapper,
    LogAnalysisAgentPlugin,
    GaussChatAgentPlugin
} from './core/wrappers';

// Registry array to hold all registered plugins
export const ALL_PLUGINS: HappyPlugin[] = [

    LogExtractorPlugin,
    NetTrafficAnalyzerPluginWrapper,
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
    SpeedScopePlugin,
    LogAnalysisAgentPlugin,
    GaussChatAgentPlugin,
];

export const getPluginById = (id: string): HappyPlugin | undefined => {
    return ALL_PLUGINS.find(p => p.id === id);
};
