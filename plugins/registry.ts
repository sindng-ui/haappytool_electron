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
    // SpeedScopePlugin, // 임시 주석: 물리 파일 누락 방지
    NetTrafficAnalyzerPluginWrapper
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
    // SpeedScopePlugin,
    NetTrafficAnalyzerPluginWrapper
];

export const getPluginById = (id: string): HappyPlugin | undefined => {
    return ALL_PLUGINS.find(p => p.id === id);
};
