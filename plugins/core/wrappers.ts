import { HappyPlugin } from '../types';
import * as Lucide from 'lucide-react';
import React from 'react';

// Lazy Load Components
const LogExtractor = React.lazy(() => import('../../components/LogExtractor'));
const PostTool = React.lazy(() => import('../../components/PostTool'));
const TpkExtractor = React.lazy(() => import('../../components/TpkExtractor'));
const JsonTools = React.lazy(() => import('../../components/JsonTools'));
const SmartThingsDevicesPane = React.lazy(() => import('../../components/SmartThingsDevices/SmartThingsDevicesPane'));
const ReverseEngineer = React.lazy(() => import('../../components/ReverseEngineer'));
import { ToolId } from '../../types';

const { FileText, Send, Braces, Archive, Smartphone, Pickaxe } = Lucide;

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
const { Activity } = Lucide;

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
