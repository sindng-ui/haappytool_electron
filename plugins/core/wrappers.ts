import { HappyPlugin } from '../types';
import * as Lucide from 'lucide-react';
import React from 'react';

// Lazy Load Components
const LogExtractor = React.lazy(() => import('../../components/LogExtractor'));
const PostTool = React.lazy(() => import('../../components/PostTool'));
const TpkExtractor = React.lazy(() => import('../../components/TpkExtractor'));
const JsonTools = React.lazy(() => import('../../components/JsonTools'));
const SmartThingsDevicesPane = React.lazy(() => import('../../components/SmartThingsDevices/SmartThingsDevicesPane'));
const SmartThingsLabPlugin = React.lazy(() => import('../SmartThingsLab/SmartThingsLabPlugin'));
const TizenLabPlugin = React.lazy(() => import('../TizenLab/TizenLabPlugin'));
const ReverseEngineer = React.lazy(() => import('../../components/ReverseEngineer'));
const PerfTool = React.lazy(() => import('../../components/PerfTool'));
const EverythingSearch = React.lazy(() => import('../../components/EverythingSearch'));
const RagAnalyzerTest = React.lazy(() => import('../../components/RagAnalyzerTest'));
const NupkgSigner = React.lazy(() => import('../../components/NupkgSigner'));
import { ToolId } from '../../types';
import { Network } from 'lucide-react';

const { FileText, Send, Braces, Archive, Smartphone, Pickaxe, Workflow, Activity, Search, SearchCode } = Lucide;

export const LogExtractorPlugin: HappyPlugin = {
    id: ToolId.LOG_EXTRACTOR,
    name: 'Log Extractor',
    icon: FileText,
    component: LogExtractor,
    order: 1,
};

export const PostToolPlugin: HappyPlugin = {
    id: ToolId.POST_TOOL,
    name: 'Post Tool',
    icon: Send,
    component: PostTool,
    order: 5,
};

export const JsonToolsPlugin: HappyPlugin = {
    id: ToolId.JSON_TOOLS,
    name: 'JSON Tools',
    icon: Braces,
    component: JsonTools,
    order: 4,
};

export const TpkExtractorPlugin: HappyPlugin = {
    id: ToolId.TPK_EXTRACTOR,
    name: 'Tpk Extractor',
    icon: Archive,
    component: TpkExtractor,
    order: 6,
};

export const SmartThingsDevicesPlugin: HappyPlugin = {
    id: ToolId.SMARTTHINGS_DEVICES,
    name: 'SmartThings Devices',
    icon: Smartphone,
    component: SmartThingsDevicesPane,
    order: 7,
};

export const SmartThingsLabPluginWrapper: HappyPlugin = {
    id: ToolId.SMARTTHINGS_LAB,
    name: 'ST Lab',
    icon: Smartphone,
    component: SmartThingsLabPlugin,
    order: 14,
    isLab: true,
};


export const ReverseEngineerPlugin: HappyPlugin = {
    id: ToolId.REVERSE_ENGINEER,
    name: 'Reverse Engineer',
    icon: Pickaxe,
    component: ReverseEngineer,
    order: 2,
};

const BlockTest = React.lazy(() => import('../../components/BlockTest'));
const { Blocks } = Lucide;

export const BlockTestPlugin: HappyPlugin = {
    id: ToolId.BLOCK_TEST,
    name: 'Block Test',
    icon: Blocks,
    component: BlockTest,
    order: 3,
};
const EasyUML = React.lazy(() => import('../../components/EasyUML'));
// Activity already destructured at top

export const EasyUMLPlugin: HappyPlugin = {
    id: ToolId.EASY_UML,
    name: 'Easy UML',
    icon: Activity,
    component: EasyUML,
    order: 8,
};

const CpuAnalyzer = React.lazy(() => import('../../components/CpuAnalyzer/CpuAnalyzer'));
const { Cpu } = Lucide;

export const CpuAnalyzerPlugin: HappyPlugin = {
    id: ToolId.CPU_ANALYZER,
    name: 'CPU Analyzer',
    icon: Cpu,
    component: CpuAnalyzer,
    order: 9,
};

const SmartHomeDashboard = React.lazy(() => import('../../components/SmartHomeDashboard/SmartHomeDashboard'));
const { LayoutDashboard } = Lucide;

export const SmartHomeDashboardPlugin: HappyPlugin = {
    id: ToolId.SMART_HOME_DASHBOARD,
    name: 'Smart Home',
    icon: LayoutDashboard,
    component: SmartHomeDashboard,
    order: 10,
};

const ScreenMatcher = React.lazy(() => import('../../components/ScreenMatcher/ScreenMatcher'));
const { Scan } = Lucide;

export const ScreenMatcherPlugin: HappyPlugin = {
    id: ToolId.SCREEN_MATCHER,
    name: 'Screen Matcher',
    icon: Scan,
    component: ScreenMatcher,
    order: 11,
};

const AiAssistant = React.lazy(() => import('../../components/AiAssistant'));
const { Bot } = Lucide;

export const AiAssistantPlugin: HappyPlugin = {
    id: ToolId.AI_ASSISTANT,
    name: 'AI Assistant',
    icon: Bot,
    component: AiAssistant,
    order: 12,
};



export const TizenLabPluginWrapper: HappyPlugin = {
    id: ToolId.TIZEN_LAB,
    name: 'Tizen Lab',
    icon: Network,
    component: TizenLabPlugin,
    order: 15,
    isLab: true,
};

const EasyPost = React.lazy(() => import('../../plugins/EasyPost/EasyPostPlugin'));
const { Zap } = Lucide;

export const EasyPostPlugin: HappyPlugin = {
    id: ToolId.EASY_POST,
    name: 'Easy Post',
    icon: Zap,
    component: EasyPost,
    order: 16,
};

const { Gauge } = Lucide;
export const PerfToolPlugin: HappyPlugin = {
    id: ToolId.PERF_TOOL,
    name: 'Perf Tool',
    icon: Gauge,
    component: PerfTool,
    order: 17,
};

const SpeedScope = React.lazy(() => import('../../components/SpeedScope/SpeedScopePlugin'));

export const SpeedScopePlugin: HappyPlugin = {
    id: ToolId.SPEED_SCOPE,
    name: 'Speed Scope',
    icon: Activity,
    component: SpeedScope,
    order: 18,
};

const NetTrafficAnalyzer = React.lazy(() => import('../../components/NetTrafficAnalyzer/NetTrafficAnalyzerPlugin'));

export const NetTrafficAnalyzerPluginWrapper: HappyPlugin = {
    id: ToolId.NET_TRAFFIC_ANALYZER,
    name: 'NetTraffic',
    icon: Network,
    component: NetTrafficAnalyzer,
    order: 19,
};

const LogAnalysisAgent = React.lazy(() => import('../LogAnalysisAgent/index'));
const { BrainCircuit } = Lucide;

export const LogAnalysisAgentPlugin: HappyPlugin = {
    id: ToolId.LOG_ANALYSIS_AGENT,
    name: 'Log Agent',
    icon: BrainCircuit,
    component: LogAnalysisAgent,
    order: 20,
};

const GaussChatAgent = React.lazy(() => import('../GaussChatAgent/index'));
const { MessageSquare } = Lucide;

export const GaussChatAgentPlugin: HappyPlugin = {
    id: ToolId.GAUSS_CHAT_AGENT,
    name: 'Gauss Chat',
    icon: MessageSquare,
    component: GaussChatAgent,
    order: 21,
};

export const EverythingSearchPlugin: HappyPlugin = {
    id: ToolId.EVERYTHING_SEARCH,
    name: 'Everything',
    icon: Search,
    component: EverythingSearch,
    order: 22,
};

export const RagAnalyzerTestPlugin: HappyPlugin = {
    id: ToolId.RAG_ANALYZER_TEST,
    name: 'RAG Test',
    icon: SearchCode,
    component: RagAnalyzerTest,
    order: 23,
};

export const NupkgSignerPlugin: HappyPlugin = {
    id: ToolId.NUPKG_SIGNER,
    name: 'Nupkg Signer',
    icon: Lucide.ShieldCheck,
    component: NupkgSigner,
    order: 24,
};

export const ALL_PLUGINS_MAP: Record<ToolId, HappyPlugin> = {
    [ToolId.LOG_EXTRACTOR]: LogExtractorPlugin,
    [ToolId.POST_TOOL]: PostToolPlugin,
    [ToolId.JSON_TOOLS]: JsonToolsPlugin,
    [ToolId.TPK_EXTRACTOR]: TpkExtractorPlugin,
    [ToolId.SMARTTHINGS_DEVICES]: SmartThingsDevicesPlugin,
    [ToolId.SMARTTHINGS_LAB]: SmartThingsLabPluginWrapper,
    [ToolId.REVERSE_ENGINEER]: ReverseEngineerPlugin,
    [ToolId.BLOCK_TEST]: BlockTestPlugin,
    [ToolId.EASY_UML]: EasyUMLPlugin,
    [ToolId.CPU_ANALYZER]: CpuAnalyzerPlugin,
    [ToolId.SMART_HOME_DASHBOARD]: SmartHomeDashboardPlugin,
    [ToolId.SCREEN_MATCHER]: ScreenMatcherPlugin,
    [ToolId.AI_ASSISTANT]: AiAssistantPlugin,
    [ToolId.TIZEN_LAB]: TizenLabPluginWrapper,
    [ToolId.EASY_POST]: EasyPostPlugin,
    [ToolId.PERF_TOOL]: PerfToolPlugin,
    [ToolId.SPEED_SCOPE]: SpeedScopePlugin,
    [ToolId.NET_TRAFFIC_ANALYZER]: NetTrafficAnalyzerPluginWrapper,
    [ToolId.LOG_ANALYSIS_AGENT]: LogAnalysisAgentPlugin,
    [ToolId.GAUSS_CHAT_AGENT]: GaussChatAgentPlugin,
    [ToolId.EVERYTHING_SEARCH]: EverythingSearchPlugin,
    [ToolId.RAG_ANALYZER_TEST]: RagAnalyzerTestPlugin,
    [ToolId.NUPKG_SIGNER]: NupkgSignerPlugin,
};
