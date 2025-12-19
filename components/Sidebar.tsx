import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { ToolId } from '../types';

const { FileText, Send, Braces, Archive, Smile, GripVertical, Settings, Smartphone, Pickaxe, Activity, Zap, Atom } = Lucide;

interface SidebarProps {
  activeTool: ToolId;
  onSelectTool: (id: ToolId) => void;
  toolOrder: ToolId[];
  onReorderTools: (order: ToolId[]) => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTool, onSelectTool, toolOrder, onReorderTools, onOpenSettings }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedItem, setDraggedItem] = useState<ToolId | null>(null);

  const toolDefinitions = {
    [ToolId.LOG_EXTRACTOR]: { label: 'Log Extractor', icon: FileText },
    [ToolId.POST_TOOL]: { label: 'Post Tool', icon: Send },
    [ToolId.JSON_TOOLS]: { label: 'JSON Tools', icon: Braces },
    [ToolId.TPK_EXTRACTOR]: { label: 'Tpk Extractor', icon: Archive },
    [ToolId.SMARTTHINGS_DEVICES]: { label: 'SmartThings Devices', icon: Smartphone },
    [ToolId.REVERSE_ENGINEER]: { label: 'Reverse Engineer', icon: Pickaxe },
  };

  const handleDragStart = (e: React.DragEvent, id: ToolId) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => setDraggedItem(null);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDragEnter = (e: React.DragEvent, targetId: ToolId) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const currentIndex = toolOrder.indexOf(draggedItem);
    const targetIndex = toolOrder.indexOf(targetId);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newOrder = [...toolOrder];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    onReorderTools(newOrder);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Collapse ONLY if focus moves outside the Sidebar
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="h-full relative shrink-0 z-50">
      {/* Placeholder to reserve layout space */}
      <div className="w-20 h-full" />

      {/* Floating Animated Sidebar */}
      <div
        className={`absolute top-0 left-0 h-full bg-slate-900 border-r border-white/5 text-slate-400 transition-all duration-300 ease-in-out flex flex-col shadow-2xl overflow-hidden transform-gpu backface-hidden outline-none ${isExpanded ? 'w-72' : 'w-20'
          }`}
        tabIndex={0}
        onBlur={handleBlur}
        onClick={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="h-24 flex items-center justify-center relative">
          <div className={`transition-all duration-300 ${isExpanded ? 'scale-100' : 'scale-90'}`}>
            {isExpanded ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 relative z-10 group-hover:scale-105 transition-transform duration-300">
                  <span className="text-white font-black text-lg">H</span>
                </div>
                <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-100 to-white bg-clip-text text-transparent">
                  HappyTool
                </span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-gradient-xy flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/20 group-hover:scale-110 transition-transform cursor-pointer relative overflow-hidden">
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>

                {/* Dynamic Icon */}
                <Activity className="text-white w-6 h-6 animate-pulse-fast drop-shadow-md" strokeWidth={3} />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 px-3 py-2 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {toolOrder.map((toolId) => {
            const item = toolDefinitions[toolId];
            if (!item) return null;
            const Icon = item.icon;
            const isActive = activeTool === toolId;
            const isDragging = draggedItem === toolId;

            return (
              <button
                key={toolId}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, toolId)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, toolId)}
                onClick={() => onSelectTool(toolId)}
                className={`w-full flex items-center h-12 px-3 rounded-xl transition-all duration-200 group relative cursor-pointer outline-none border border-transparent ${isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 border-indigo-400/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:border-white/5 active:scale-95'
                  } ${isDragging ? 'opacity-20 border-dashed border-slate-600' : ''}`}
              >
                {isExpanded && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </div>
                )}
                <div className="min-w-[40px] flex items-center justify-center">
                  <Icon className={`w-[22px] h-[22px] transition-transform duration-200 ${isActive ? 'scale-110 icon-glow' : 'group-hover:scale-110'
                    }`} />
                </div>
                <span className={`ml-3 font-medium text-[15px] whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 hidden'
                  }`}>
                  {item.label}
                </span>
                {!isExpanded && !isDragging && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl">
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-slate-700"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-4 w-full mt-auto space-y-3">
          <div className={`h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent ${isExpanded ? 'opacity-100' : 'opacity-0'} transition-opacity`} />

          <button
            onClick={onOpenSettings}
            className={`w-full flex items-center h-12 px-3 rounded-xl transition-all duration-200 group relative cursor-pointer text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:border-white/5 border border-transparent active:scale-95`}
          >
            <div className="min-w-[40px] flex items-center justify-center">
              <Settings className="w-[22px] h-[22px] group-hover:rotate-90 transition-transform duration-500 ease-out" />
            </div>
            <span className={`ml-3 font-medium text-[15px] whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 hidden'
              }`}>
              Settings
            </span>
            {!isExpanded && (
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl">
                Settings
                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-slate-700"></div>
              </div>
            )}
          </button>
        </div>

        <div className={`p-4 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-[10px] text-slate-600 font-mono text-center">
            v{__APP_VERSION__} &bull; Build 2025
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;