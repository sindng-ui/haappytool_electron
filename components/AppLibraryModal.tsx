import React, { useEffect, useState } from 'react';
import * as Lucide from 'lucide-react';
import { HappyPlugin } from '../plugins/types';

interface AppLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
  activePluginId: string;
  onSelectPlugin: (id: string) => void;
}

const AppLibraryModal: React.FC<AppLibraryModalProps> = ({
  isOpen,
  onClose,
  plugins,
  enabledPlugins,
  activePluginId,
  onSelectPlugin
}) => {
  const [renderModal, setRenderModal] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRenderModal(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setRenderModal(false), 300); // match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!renderModal) return null;

  const corePlugins = plugins.filter(p => enabledPlugins.includes(p.id));
  const labPlugins = plugins.filter(p => !enabledPlugins.includes(p.id));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-[#020617]/80 backdrop-blur-md transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div 
        className={`relative w-full max-w-5xl max-h-full bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-[32px] shadow-2xl shadow-black/50 flex flex-col overflow-hidden transition-all duration-300 transform ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-8 border-b border-white/5 shrink-0 bg-slate-900/50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 relative overflow-hidden">
               <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full animate-[shimmer_2s_infinite]"></div>
               <span className="text-white font-black text-2xl relative z-10">H</span>
             </div>
             <div>
               <h2 className="text-3xl font-extrabold text-white tracking-tight">App Library</h2>
               <p className="text-slate-400 text-sm mt-1 font-medium">Select a module to launch</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <Lucide.X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
          
          {/* Core Apps Section */}
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Lucide.Box size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-200 tracking-tight">Core Tools</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {corePlugins.map(plugin => {
                const Icon = plugin.icon || Lucide.Activity;
                const isActive = plugin.id === activePluginId;
                
                return (
                  <button
                    key={plugin.id}
                    onClick={() => {
                      onSelectPlugin(plugin.id);
                      onClose();
                    }}
                    className={`flex items-start p-5 text-left rounded-3xl transition-all duration-300 group border ${
                      isActive 
                        ? 'bg-gradient-to-br from-indigo-600/20 to-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10' 
                        : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl mr-4 flex-shrink-0 transition-colors duration-300 ${
                      isActive ? 'bg-indigo-500/30 text-indigo-300' : 'bg-black/40 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300'
                    }`}>
                      <Icon size={28} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 justify-center h-full">
                      <span className={`font-bold text-lg truncate ${isActive ? 'text-indigo-200' : 'text-slate-100 group-hover:text-white'}`}>
                        {plugin.name}
                      </span>
                      <span className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {plugin.id === 'log_extractor' ? 'Advanced log analysis and filtering' :
                         plugin.id === 'json_tools' ? 'JSON formatting and diffing' :
                         plugin.id === 'post_tool' ? 'API request testing and debugging' :
                         plugin.id === 'tpk_extractor' ? 'TPK package management' :
                         plugin.id === 'speed_scope' ? 'Performance profiling' :
                         plugin.id === 'net_traffic_analyzer' ? 'Network traffic inspection' :
                         'Launch and manage this module'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Labs Apps Section */}
          {labPlugins.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <Lucide.FlaskConical size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-200 tracking-tight">Labs / Experimental</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {labPlugins.map(plugin => {
                  const Icon = plugin.icon || Lucide.Activity;
                  const isActive = plugin.id === activePluginId;
                  
                  return (
                    <button
                      key={plugin.id}
                      onClick={() => {
                        onSelectPlugin(plugin.id);
                        onClose();
                      }}
                      className={`flex flex-col items-center p-6 text-center rounded-3xl transition-all duration-300 group border ${
                        isActive 
                          ? 'bg-purple-500/20 border-purple-500/40 shadow-lg shadow-purple-500/10' 
                          : 'bg-black/20 border-transparent hover:bg-white/5 hover:border-white/10 hover:scale-[1.03] hover:shadow-xl hover:shadow-black/20'
                      }`}
                    >
                      <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${
                        isActive ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 text-slate-400 group-hover:text-purple-300 group-hover:bg-purple-500/20 group-hover:scale-110'
                      }`}>
                        <Icon size={32} strokeWidth={1.5} />
                      </div>
                      <span className={`font-semibold text-[15px] ${isActive ? 'text-purple-200' : 'text-slate-300 group-hover:text-slate-100'}`}>
                        {plugin.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AppLibraryModal;
