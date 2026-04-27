import React, { useEffect, useState, useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { HappyPlugin } from '../plugins/types';

interface AppLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
  setEnabledPlugins: React.Dispatch<React.SetStateAction<string[]>>;
  pluginOrder: string[];
  onReorderPlugins: (order: string[]) => void;
  activePluginId: string;
  onSelectPlugin: (id: string) => void;
}

const AppLibraryModal: React.FC<AppLibraryModalProps> = ({
  isOpen,
  onClose,
  plugins,
  enabledPlugins,
  setEnabledPlugins,
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
      const timer = setTimeout(() => setRenderModal(false), 300);
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

  const corePlugins = useMemo(() => plugins.filter(p => enabledPlugins.includes(p.id)), [plugins, enabledPlugins]);
  const labPlugins = useMemo(() => plugins.filter(p => !enabledPlugins.includes(p.id)), [plugins, enabledPlugins]);

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledPlugins(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (!renderModal) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
      <div 
        className={`absolute inset-0 bg-[#020617]/90 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose} 
      />
      
      <div 
        className={`relative w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-700/50 rounded-[40px] shadow-2xl shadow-black/50 flex flex-col overflow-hidden transition-all duration-300 transform will-change-transform ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-10 border-b border-white/5 shrink-0 bg-slate-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-6">
             <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
               <Lucide.LayoutGrid size={32} className="text-white" />
             </div>
             <div>
               <h2 className="text-4xl font-black text-white tracking-tight">App Library</h2>
               <p className="text-slate-400 text-base mt-1 font-medium">Launch and manage your modules</p>
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
        <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar space-y-16">
          {/* Core Tools Section */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Lucide.Zap size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Core Tools</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-6" />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {corePlugins.map(plugin => (
                <AppCard 
                  key={plugin.id}
                  plugin={plugin}
                  isPinned={true}
                  isActive={plugin.id === activePluginId}
                  onSelect={() => {
                    onSelectPlugin(plugin.id);
                    onClose();
                  }}
                  onTogglePin={handleTogglePin}
                />
              ))}
            </div>
          </section>

          {/* Labs Apps Section */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                <Lucide.FlaskConical size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Labs & Experimental</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-6" />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {labPlugins.map(plugin => (
                <AppCard 
                  key={plugin.id}
                  plugin={plugin}
                  isPinned={false}
                  isActive={plugin.id === activePluginId}
                  onSelect={() => {
                    onSelectPlugin(plugin.id);
                    onClose();
                  }}
                  onTogglePin={handleTogglePin}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
};

const AppCard = ({ plugin, isActive, isPinned, onSelect, onTogglePin }: any) => {
  const Icon = plugin.icon || Lucide.Package;

  // 🐧 형님, 아이콘마다 개성 있는 컬러를 입혀서 지루함을 싹 날려버리겠슴다!
  const getIconTheme = (id: string) => {
    const themes: Record<string, string> = {
      'log-extractor': 'from-blue-500 to-indigo-600 shadow-indigo-500/20 text-white',
      'log-analysis-agent': 'from-purple-500 to-pink-600 shadow-pink-500/20 text-white',
      'gauss-chat-agent': 'from-rose-500 to-orange-600 shadow-rose-500/20 text-white',
      'everything-search': 'from-emerald-400 to-teal-600 shadow-emerald-500/20 text-white',
      'rag-analyzer-test': 'from-cyan-400 to-blue-600 shadow-cyan-500/20 text-white',
      'nupkg-signer': 'from-amber-400 to-orange-600 shadow-amber-500/20 text-white',
      'release-history': 'from-violet-500 to-fuchsia-600 shadow-violet-500/20 text-white',
      'net-traffic-analyzer': 'from-sky-400 to-indigo-500 shadow-sky-500/20 text-white',
      'post-tool': 'from-pink-400 to-rose-500 shadow-rose-500/20 text-white',
      'json-tools': 'from-slate-400 to-slate-600 shadow-slate-500/20 text-white',
      'block-test': 'from-indigo-400 to-purple-500 shadow-indigo-500/20 text-white',
    };
    return themes[id] || 'from-slate-700 to-slate-800 shadow-black/20 text-slate-400';
  };

  const themeClass = getIconTheme(plugin.id);

  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col items-center p-6 rounded-[32px] transition-all duration-500 border-2 ${
        isActive 
          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-2xl shadow-indigo-500/20 scale-[1.02]' 
          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/20 hover:scale-105 hover:shadow-2xl'
      }`}
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 bg-gradient-to-br shadow-lg group-hover:scale-110 group-hover:rotate-3 ${
        isActive ? 'from-indigo-500 to-purple-600 text-white scale-110 rotate-3' : themeClass
      }`}>
        <Icon size={32} strokeWidth={2.5} />
      </div>
      
      <span className={`text-[13px] font-black text-center tracking-tight transition-colors duration-300 uppercase ${
        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
      }`}>
        {plugin.name}
      </span>

      <button
        onClick={(e) => onTogglePin(plugin.id, e)}
        className={`absolute top-4 right-4 p-2 rounded-xl transition-all duration-300 ${
          isPinned 
            ? 'text-indigo-400 bg-indigo-500/10 opacity-100' 
            : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10'
        }`}
      >
        <Lucide.Pin size={14} fill={isPinned ? 'currentColor' : 'none'} className={isPinned ? '' : 'rotate-45'} />
      </button>
      
      {/* Decorative Glow */}
      <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-4 blur-2xl rounded-full transition-opacity duration-500 pointer-events-none ${
        isActive ? 'bg-indigo-500/40 opacity-100' : 'bg-white/10 opacity-0 group-hover:opacity-100'
      }`} />
    </button>
  );
};

export default AppLibraryModal;
