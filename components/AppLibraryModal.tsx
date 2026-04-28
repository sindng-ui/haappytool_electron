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

// 🐧 형님, 테마 로직은 렌더링 성능을 위해 밖으로 뺐습니다!
const ICON_THEMES: Record<string, string> = {
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

  const handleTogglePin = React.useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledPlugins(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }, [setEnabledPlugins]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-start p-4 overflow-hidden pointer-events-none">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] pointer-events-auto"
          />
          
          {/* Modal Container - 🐧 GPU 가속을 위해 will-change 추가! */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -20, originX: 0, originY: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="relative w-full max-w-2xl max-h-[85vh] mt-16 ml-2 bg-slate-900/98 border border-white/10 rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden backdrop-blur-xl pointer-events-auto will-change-transform"
          >
            {/* Header */}
            <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  <h2 className="text-xl font-black text-white tracking-tight">APP LIBRARY</h2>
                </div>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase opacity-60">Accelerate your workflow</p>
              </div>
              <button 
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90 border border-white/5"
              >
                <Lucide.X size={18} />
              </button>
            </div>

            {/* Scrollable Content - 🐧 staggerChildren으로 렌더링 부하 분산! */}
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.03 } }
              }}
              className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar"
            >
              <div className="space-y-10">
                <Section 
                  title="Pinned Tools" 
                  icon={<Lucide.Pin size={14} className="fill-current" />} 
                  plugins={corePlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                />
                
                <Section 
                  title="More Apps" 
                  icon={<Lucide.LayoutGrid size={14} />} 
                  plugins={labPlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                />
              </div>
            </motion.div>

            {/* Footer decoration */}
            <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 🐧 형님, 리렌더링 방지를 위해 React.memo 필수입니다!
const Section = React.memo(({ title, icon, plugins, activeId, enabledSet, onSelect, onTogglePin }: any) => {
  if (plugins.length === 0) return null;
  
  return (
    <motion.section 
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
      }}
      className="relative"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
          {icon}
        </div>
        <h3 className="text-sm font-black text-slate-300 tracking-widest uppercase">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
      </div>
      
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
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
    </motion.section>
  );
});

// 🐧 카드 하나하나도 소중하니까 메모이제이션!
const AppCard = React.memo(({ plugin, isActive, isPinned, onSelect, onTogglePin }: any) => {
  const Icon = plugin.icon || Lucide.Package;
  const themeClass = ICON_THEMES[plugin.id] || 'from-slate-700 to-slate-800 shadow-black/20 text-slate-400';

  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 }
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      className={`group relative flex flex-col items-center py-3 px-2 rounded-2xl transition-all duration-300 border overflow-hidden ${
        isActive 
          ? 'bg-indigo-600/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10' 
          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2 transition-all duration-500 bg-gradient-to-br shadow-md ${
        isActive ? 'from-indigo-500 to-purple-600 text-white' : themeClass
      }`}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      
      <span className={`text-[9px] font-black text-center leading-tight tracking-tighter uppercase truncate w-full px-1 ${
        isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
      }`}>
        {plugin.name}
      </span>

      <button
        onClick={(e) => onTogglePin(plugin.id, e)}
        className={`absolute top-1 right-1 p-1 rounded-lg transition-all duration-300 z-20 ${
          isPinned 
            ? 'text-indigo-400 opacity-100' 
            : 'text-slate-700 opacity-0 group-hover:opacity-100 hover:text-white'
        }`}
      >
        <Lucide.Pin size={10} fill={isPinned ? 'currentColor' : 'none'} className={isPinned ? '' : 'rotate-45'} />
      </button>
    </motion.button>
  );
});

export default AppLibraryModal;
