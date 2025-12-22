import { HappyPlugin } from '../types';
import * as Lucide from 'lucide-react';
import LogExtractor from '../../components/LogExtractor';
import PostTool from '../../components/PostTool';
import TpkExtractor from '../../components/TpkExtractor';
import JsonTools from '../../components/JsonTools';
import SmartThingsDevicesPane from '../../components/SmartThingsDevices/SmartThingsDevicesPane';
import ReverseEngineer from '../../components/ReverseEngineer';
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
    order: 2,
};

export const JsonToolsPlugin: HappyPlugin = {
    id: ToolId.JSON_TOOLS,
    name: 'JSON Tools',
    icon: Braces,
    component: JsonTools,
    order: 3,
};

export const TpkExtractorPlugin: HappyPlugin = {
    id: ToolId.TPK_EXTRACTOR,
    name: 'Tpk Extractor',
    icon: Archive,
    component: TpkExtractor,
    order: 4,
};

export const SmartThingsDevicesPlugin: HappyPlugin = {
    id: ToolId.SMARTTHINGS_DEVICES,
    name: 'SmartThings Devices',
    icon: Smartphone,
    component: SmartThingsDevicesPane,
    order: 5,
};

export const ReverseEngineerPlugin: HappyPlugin = {
    id: ToolId.REVERSE_ENGINEER,
    name: 'Reverse Engineer',
    icon: Pickaxe,
    component: ReverseEngineer,
    order: 6,
};
