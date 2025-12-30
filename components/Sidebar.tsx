import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { HappyPlugin } from '../plugins/types';

const { GripVertical, Settings, Activity, FlaskConical, ChevronRight, ChevronDown } = Lucide;

interface SidebarProps {
  activePluginId: string;
  onSelectPlugin: (id: string) => void;
  pluginOrder: string[];
  onReorderPlugins: (order: string[]) => void;
  onOpenSettings: () => void;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ activePluginId, onSelectPlugin, pluginOrder, onReorderPlugins, onOpenSettings, plugins, enabledPlugins }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isLabExpanded, setIsLabExpanded] = useState(false);

  const activePlugins = pluginOrder
    .filter(id => enabledPlugins.includes(id))
    .map(id => plugins.find(p => p.id === id))
    .filter((p): p is HappyPlugin => !!p);

  const labPlugins = plugins.filter(p => !enabledPlugins.includes(p.id));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => setDraggedItem(null);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    // Only allow reordering within active plugins for now sidebar logic simplicity
    const currentIndex = pluginOrder.indexOf(draggedItem);
    const targetIndex = pluginOrder.indexOf(targetId);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newOrder = [...pluginOrder];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    onReorderPlugins(newOrder);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Collapse ONLY if focus moves outside the Sidebar
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsExpanded(false);
      setIsLabExpanded(false); // Optionally collapse lab too
    }
  };

  return (
    <div className="h-full relative shrink-0 z-50">
      {/* Placeholder to reserve layout space */}
      <div className="w-20 h-full" />

      {/* Floating Animated Sidebar */}
      <div
        className={`absolute top-0 left-0 h-full glass-morphism text-slate-400 transition-all duration-300 ease-in-out flex flex-col shadow-2xl overflow-hidden transform-gpu backface-hidden outline-none z-50 ${isExpanded ? 'w-72' : 'w-20'
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
                <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-100 to-white bg-clip-text text-transparent drop-shadow-sm">
                  HappyTool
                </span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-gradient-xy flex items-center justify-center shadow-lg shadow-indigo-500/40 ring-1 ring-white/20 group-hover:scale-110 transition-transform cursor-pointer relative overflow-hidden">
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>

                {/* Dynamic Icon */}
                <Activity className="text-white w-6 h-6 animate-pulse-fast drop-shadow-md" strokeWidth={3} />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 px-3 py-2 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {activePlugins.map((plugin) => {
            const Icon = plugin.icon;
            const isActive = activePluginId === plugin.id;
            const isDragging = draggedItem === plugin.id;

            return (
              <button
                key={plugin.id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, plugin.id)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, plugin.id)}
                onClick={() => onSelectPlugin(plugin.id)}
                className={`w-full flex items-center h-12 px-3 rounded-xl transition-all duration-200 group relative cursor-pointer outline-none border border-transparent ${isActive
                  ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-500/90 backdrop-blur-md text-white shadow-lg shadow-indigo-500/25 border-indigo-400/20 scale-[1.02]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:border-white/5 active:scale-95 hover:shadow-lg hover:shadow-indigo-500/10'
                  } ${isDragging ? 'opacity-20 border-dashed border-slate-600' : ''}`}
              >
                {isExpanded && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </div>
                )}
                <div className="min-w-[40px] flex items-center justify-center">
                  <Icon className={`w-[22px] h-[22px] transition-transform duration-200 ${isActive ? 'scale-110 icon-glow' : 'group-hover:scale-110 group-hover:text-indigo-300'
                    }`} />
                </div>
                <span className={`ml-3 font-medium text-[15px] whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 hidden'
                  }`}>
                  {plugin.name}
                </span>
                {!isExpanded && !isDragging && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-xl">
                    {plugin.name}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900/90 rotate-45 border-l border-b border-slate-700"></div>
                  </div>
                )}
              </button>
            );
          })}

          {/* Lab Section */}
          {labPlugins.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isExpanded) {
                    setIsExpanded(true);
                    setIsLabExpanded(true);
                  } else {
                    setIsLabExpanded(!isLabExpanded);
                  }
                }}
                className={`w-full flex items-center h-10 px-3 rounded-xl transition-all duration-200 group relative cursor-pointer outline-none ${isLabExpanded ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                <div className="min-w-[40px] flex items-center justify-center">
                  <FlaskConical className={`w-5 h-5 transition-transform duration-200 ${isLabExpanded ? 'text-indigo-400' : 'group-hover:text-indigo-300'}`} />
                </div>
                <span className={`ml-3 font-medium text-[13px] uppercase tracking-wider whitespace-nowrap transition-all duration-300 flex-1 text-left ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 hidden'}`}>
                  Lab
                </span>
                {isExpanded && (
                  <div className="border border-white/5 rounded p-0.5 bg-white/5">
                    {isLabExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                )}
                {!isExpanded && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-xl">
                    Lab Features
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900/90 rotate-45 border-l border-b border-slate-700"></div>
                  </div>
                )}
              </button>

              {/* Lab Items */}
              {isExpanded && isLabExpanded && (
                <div className="mt-2 space-y-1 pl-2 animate-in slide-in-from-top-2 duration-200">
                  {labPlugins.map(plugin => {
                    const Icon = plugin.icon;
                    const isActive = activePluginId === plugin.id;
                    return (
                      <button
                        key={plugin.id}
                        onClick={() => onSelectPlugin(plugin.id)}
                        className={`w-full flex items-center h-10 px-3 rounded-lg transition-all duration-200 group relative cursor-pointer outline-none border border-transparent ${isActive
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                          }`}
                      >
                        <div className="min-w-[30px] flex items-center justify-center">
                          <Icon size={16} />
                        </div>
                        <span className="ml-2 text-sm truncate">{plugin.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-3 pb-4 w-full mt-auto space-y-3">
          <div className={`h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent ${isExpanded ? 'opacity-100' : 'opacity-0'} transition-opacity`} />

          <button
            onClick={onOpenSettings}
            className={`w-full flex items-center h-12 px-3 rounded-xl transition-all duration-200 group relative cursor-pointer text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:border-white/5 border border-transparent active:scale-95 hover:shadow-lg hover:shadow-indigo-500/10`}
          >
            <div className="min-w-[40px] flex items-center justify-center">
              <Settings className="w-[22px] h-[22px] group-hover:rotate-90 transition-transform duration-500 ease-out group-hover:text-indigo-300" />
            </div>
            <span className={`ml-3 font-medium text-[15px] whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 hidden'
              }`}>
              Settings
            </span>
            {!isExpanded && (
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-xl">
                Settings
                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900/90 rotate-45 border-l border-b border-slate-700"></div>
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