import React, { useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HappyPlugin } from '../plugins/types';

interface AppLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
  setEnabledPlugins: React.Dispatch<React.SetStateAction<string[]>>;
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
  // 🐧 형님, ESC 누르면 쇽 하고 닫히게 기능 넣었습니다!
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const enabledSet = useMemo(() => new Set(enabledPlugins), [enabledPlugins]);

  // 🚀 형님, 핀 버튼을 누르면 위아래로 쇽쇽 이동하게 로직을 다시 바꿨슴다!
  const corePlugins = useMemo(() => 
    plugins.filter(p => enabledSet.has(p.id)), 
    [plugins, enabledSet]
  );
  
  const labPlugins = useMemo(() => 
    plugins.filter(p => !enabledSet.has(p.id)), 
    [plugins, enabledSet]
  );

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledPlugins(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 overflow-hidden">
          {/* Backdrop - 🐧 형님, 전체 화면 블러는 성능을 너무 잡아먹어서 제거하고 어둡게만 처리했슴다! */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90"
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="relative w-full max-w-6xl max-h-full bg-slate-900/80 border border-white/10 rounded-[48px] shadow-[0_32px_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="p-10 pb-6 flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter mb-2">APP HUB</h2>
                <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">Select a tool to accelerate your workflow</p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-95 border border-white/5"
              >
                <Lucide.X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
              <div className="space-y-12">
                {/* Core Tools Section */}
                <Section 
                  title="Core Tools" 
                  icon={<Lucide.Zap size={18} />} 
                  plugins={corePlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                />
                
                {/* Labs Section */}
                <Section 
                  title="Labs & Experiments" 
                  icon={<Lucide.FlaskConical size={18} />} 
                  plugins={labPlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                />
              </div>
            </div>

            {/* Bottom Glow Decoration */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-indigo-500/10 to-transparent pointer-events-none" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Section = ({ title, icon, plugins, activeId, enabledSet, onSelect, onTogglePin }: any) => {
  if (plugins.length === 0) return null;
  
  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
          {icon}
        </div>
        <h3 className="text-2xl font-bold text-slate-100 tracking-tight uppercase">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-6" />
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {plugins.map((plugin: HappyPlugin) => (
          <AppCard 
            key={plugin.id}
            plugin={plugin}
            isPinned={enabledSet.has(plugin.id)}
            isActive={plugin.id === activeId}
            onSelect={() => onSelect(plugin.id)}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </section>
  );
};

const AppCard = ({ plugin, isActive, isPinned, onSelect, onTogglePin }: any) => {
  const Icon = plugin.icon || Lucide.Package;

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
      className={`group relative flex flex-col items-center py-4 px-5 rounded-[24px] transition-all duration-300 border-2 overflow-hidden ${
        isActive 
          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-2xl shadow-indigo-500/20' 
          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/20 hover:shadow-2xl'
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isActive ? 'opacity-100' : ''}`} />
      
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 transition-all duration-500 bg-gradient-to-br shadow-lg transform group-hover:scale-110 group-hover:rotate-3 ${
        isActive ? 'from-indigo-500 to-purple-600 text-white scale-110 rotate-3' : themeClass
      }`}>
        <Icon size={28} strokeWidth={2.5} />
      </div>
      
      <div className="h-10 flex items-center justify-center px-2 relative z-10">
        <span className={`text-[11px] font-black text-center leading-tight tracking-tight transition-colors duration-300 uppercase antialiased ${
          isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
        }`}>
          {plugin.name}
        </span>
      </div>

      <button
        onClick={(e) => onTogglePin(plugin.id, e)}
        className={`absolute top-4 right-4 p-2 rounded-xl transition-all duration-300 z-20 ${
          isPinned 
            ? 'text-indigo-400 bg-indigo-500/10 opacity-100' 
            : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10'
        }`}
      >
        <Lucide.Pin size={14} fill={isPinned ? 'currentColor' : 'none'} className={isPinned ? '' : 'rotate-45'} />
      </button>
      
      <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-4 blur-2xl rounded-full transition-all duration-500 pointer-events-none group-hover:scale-150 ${
        isActive ? 'bg-indigo-500/40 opacity-100' : 'bg-white/10 opacity-0 group-hover:opacity-100'
      }`} />
    </button>
  );
};

export default AppLibraryModal;
