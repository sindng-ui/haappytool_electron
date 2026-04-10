import { HappyPlugin } from './types';
import { PLUGIN_CONFIG } from './config';
import { ToolId } from '../types';
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
    GaussChatAgentPlugin,
    EverythingSearchPlugin
} from './core/wrappers';

// Registry array to hold all registered plugins
const RAW_PLUGINS: HappyPlugin[] = [
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
    EverythingSearchPlugin,
];

// 필터링된 플러그인 목록 (실험실 플러그인 개별 제어 로직 적용)
export const ALL_PLUGINS: HappyPlugin[] = RAW_PLUGINS.filter(plugin => {
    // 설정값 매핑 테이블
    const visibilityMap: Record<string, boolean> = {
        [ToolId.SMARTTHINGS_DEVICES]: PLUGIN_CONFIG.SHOW_SMARTTHINGS_DEVICES,
        [ToolId.SMARTTHINGS_LAB]: PLUGIN_CONFIG.SHOW_SMARTTHINGS_LAB,
        [ToolId.TIZEN_LAB]: PLUGIN_CONFIG.SHOW_TIZEN_LAB,
        [ToolId.REVERSE_ENGINEER]: PLUGIN_CONFIG.SHOW_REVERSE_ENGINEER,
        [ToolId.EASY_UML]: PLUGIN_CONFIG.SHOW_EASY_UML,
        [ToolId.CPU_ANALYZER]: PLUGIN_CONFIG.SHOW_CPU_ANALYZER,
        [ToolId.SMART_HOME_DASHBOARD]: PLUGIN_CONFIG.SHOW_SMART_HOME_DASHBOARD,
        [ToolId.SCREEN_MATCHER]: PLUGIN_CONFIG.SHOW_SCREEN_MATCHER,
        [ToolId.AI_ASSISTANT]: PLUGIN_CONFIG.SHOW_AI_ASSISTANT,
        [ToolId.EASY_POST]: PLUGIN_CONFIG.SHOW_EASY_POST,
        [ToolId.PERF_TOOL]: PLUGIN_CONFIG.SHOW_PERF_TOOL,
        [ToolId.LOG_ANALYSIS_AGENT]: PLUGIN_CONFIG.SHOW_LOG_ANALYSIS_AGENT,
        [ToolId.GAUSS_CHAT_AGENT]: PLUGIN_CONFIG.SHOW_GAUSS_CHAT_AGENT,
        [ToolId.EVERYTHING_SEARCH]: PLUGIN_CONFIG.SHOW_EVERYTHING_SEARCH,
    };

    // 설정 테이블에 해당 플러그인의 ID가 있으면 설정값을 따름
    if (plugin.id in visibilityMap) {
        return visibilityMap[plugin.id];
    }

    // 설정 테이블에 없는 경우(코어 플러그인 등) 기본적으로 노출
    return true;
});

export const getPluginById = (id: string): HappyPlugin | undefined => {
    return ALL_PLUGINS.find(p => p.id === id);
};
