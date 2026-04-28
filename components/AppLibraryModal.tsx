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

// 🐧 형님, 이번에는 진짜 눈이 아플 정도로(?) 선명하고 비비드한 컬러들을 골랐습니다!
const THEME_COLORS: Record<string, { base: string, glow: string, text: string, light: string }> = {
  'log-extractor': { base: 'from-blue-400 to-blue-600', glow: 'shadow-blue-500/50', text: 'text-blue-400', light: 'bg-blue-500/20' },
  'log-analysis-agent': { base: 'from-purple-400 to-purple-600', glow: 'shadow-purple-500/50', text: 'text-purple-400', light: 'bg-purple-500/20' },
  'gauss-chat-agent': { base: 'from-rose-400 to-rose-600', glow: 'shadow-rose-500/50', text: 'text-rose-400', light: 'bg-rose-500/20' },
  'everything-search': { base: 'from-emerald-400 to-emerald-600', glow: 'shadow-emerald-500/50', text: 'text-emerald-400', light: 'bg-emerald-500/20' },
  'rag-analyzer-test': { base: 'from-cyan-400 to-cyan-600', glow: 'shadow-cyan-500/50', text: 'text-cyan-400', light: 'bg-cyan-500/20' },
  'nupkg-signer': { base: 'from-amber-400 to-amber-600', glow: 'shadow-amber-500/50', text: 'text-amber-400', light: 'bg-amber-500/20' },
  'release-history': { base: 'from-violet-400 to-violet-600', glow: 'shadow-violet-500/50', text: 'text-violet-400', light: 'bg-violet-500/20' },
  'net-traffic-analyzer': { base: 'from-sky-400 to-sky-600', glow: 'shadow-sky-500/50', text: 'text-sky-400', light: 'bg-sky-500/20' },
  'post-tool': { base: 'from-pink-400 to-pink-600', glow: 'shadow-pink-500/50', text: 'text-pink-400', light: 'bg-pink-500/20' },
  'json-tools': { base: 'from-slate-400 to-slate-600', glow: 'shadow-slate-500/50', text: 'text-slate-400', light: 'bg-slate-500/20' },
  'block-test': { base: 'from-indigo-400 to-indigo-600', glow: 'shadow-indigo-500/50', text: 'text-indigo-400', light: 'bg-indigo-500/20' },
  'speed-scope': { base: 'from-orange-400 to-orange-600', glow: 'shadow-orange-500/50', text: 'text-orange-400', light: 'bg-orange-500/20' },
  'easy-post': { base: 'from-yellow-400 to-yellow-600', glow: 'shadow-yellow-500/50', text: 'text-yellow-400', light: 'bg-yellow-500/20' },
  'st-lab': { base: 'from-lime-400 to-lime-600', glow: 'shadow-lime-500/50', text: 'text-lime-400', light: 'bg-lime-500/20' },
  'tizen-lab': { base: 'from-cyan-300 to-blue-500', glow: 'shadow-blue-500/50', text: 'text-blue-300', light: 'bg-blue-500/20' },
  'perf-tool': { base: 'from-red-400 to-red-600', glow: 'shadow-red-500/50', text: 'text-red-400', light: 'bg-red-500/20' },
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
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const enabledSet = useMemo(() => new Set(enabledPlugins), [enabledPlugins]);

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
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 pointer-events-auto"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: -20, originX: 0, originY: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -20 }}
            transition={{ type: "spring", damping: 20, stiffness: 400 }}
            className="relative w-full max-w-2xl max-h-[90vh] mt-16 ml-2 bg-[#0B0F19] border border-white/10 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-slate-900/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                  <h2 className="text-xl font-black text-white tracking-tight">APP LIBRARY</h2>
                </div>
                <p className="text-slate-500 text-[10px] font-black tracking-[0.2em] uppercase opacity-80">Accelerate your workflow</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all active:scale-90 border border-white/5"
              >
                <Lucide.X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.04 } }
              }}
              className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar"
            >
              <div className="space-y-14">
                <Section 
                  title="Pinned Tools" 
                  icon={<Lucide.Pin size={14} className="fill-current" />} 
                  plugins={corePlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                  isBento={true}
                />
                
                <Section 
                  title="More Apps" 
                  icon={<Lucide.LayoutGrid size={14} />} 
                  plugins={labPlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                  isBento={false}
                />
              </div>
            </motion.div>

            <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Section = React.memo(({ title, icon, plugins, activeId, enabledSet, onSelect, onTogglePin, isBento }: any) => {
  if (plugins.length === 0) return null;
  
  return (
    <motion.section 
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 }
      }}
      className="relative"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
          {icon}
        </div>
        <h3 className="text-xs font-black text-slate-300 tracking-[0.2em] uppercase">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/5 to-transparent ml-6" />
      </div>
      
      <div className="grid grid-cols-6 gap-5 grid-flow-row-dense">
        {plugins.map((plugin: HappyPlugin, idx: number) => {
          let variant: 'normal' | 'wide' | 'large' = 'normal';
          if (isBento) {
            if (idx === 0) variant = 'large';
            else if (idx === 1 || idx === 2) variant = 'wide';
          }

          return (
            <AppCard 
              key={plugin.id}
              plugin={plugin}
              variant={variant}
              isPinned={enabledSet.has(plugin.id)}
              isActive={plugin.id === activeId}
              onSelect={() => onSelect(plugin.id)}
              onTogglePin={onTogglePin}
            />
          );
        })}
      </div>
    </motion.section>
  );
});

const AppCard = React.memo(({ plugin, isActive, isPinned, onSelect, onTogglePin, variant = 'normal' }: any) => {
  const Icon = plugin.icon || Lucide.Package;
  const theme = THEME_COLORS[plugin.id] || { base: 'from-slate-500 to-slate-700', glow: 'shadow-black/20', text: 'text-slate-400', light: 'bg-slate-500/20' };

  const sizeClasses = {
    normal: 'col-span-1 row-span-1 h-32 flex-col justify-center gap-4 items-center text-center',
    wide: 'col-span-2 row-span-1 h-32 flex-row items-center justify-start px-8 gap-6 text-left',
    large: 'col-span-2 row-span-2 h-[260px] flex-col justify-between p-10 items-center text-center'
  };

  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
      }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`group relative flex transition-all duration-500 border overflow-hidden rounded-[32px] ${sizeClasses[variant]} ${
        isActive 
          ? `bg-slate-900 border-indigo-500 shadow-[0_25px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(99,102,241,0.2)]` 
          : `bg-slate-900/40 border-white/5 hover:border-white/20 hover:bg-slate-800/60`
      }`}
    >
      {/* Background Aura - 🐧 더 강렬하게! */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 bg-gradient-to-br ${theme.base} transition-opacity duration-700`} />
      
      {/* Ghost Typography for Large Cards */}
      {variant === 'large' && (
        <div className="absolute -top-4 -left-4 text-white/[0.02] text-9xl font-black italic select-none pointer-events-none transform -rotate-12 uppercase whitespace-nowrap">
          {plugin.name}
        </div>
      )}

      {/* Icon Wrapper - 🐧 비비드한 배경색 적용 */}
      <div className={`
        flex items-center justify-center transition-all duration-500 relative z-10 shrink-0
        ${variant === 'large' ? 'w-28 h-28 rounded-[40px]' : 'w-14 h-14 rounded-[22px]'}
        ${isActive ? `bg-gradient-to-br ${theme.base} text-white shadow-2xl ${theme.glow}` : `${theme.light} ${theme.text} group-hover:scale-110`}
      `}>
        <Icon size={variant === 'large' ? 52 : 26} strokeWidth={isActive ? 2.5 : 2} />
        {/* Extreme Glow behind icon */}
        <div className={`absolute inset-0 rounded-inherit opacity-0 group-hover:opacity-60 blur-3xl ${theme.base} -z-10 transition-opacity`} />
      </div>
      
      <div className={`flex flex-col relative z-10 min-w-0 ${variant === 'wide' ? 'flex-1' : ''}`}>
        <span className={`font-black tracking-tighter uppercase transition-colors duration-300 ${
          variant === 'large' ? 'text-3xl text-white mt-6' : 'text-xs'
        } ${
          isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
        }`}>
          {plugin.name}
        </span>
        {variant !== 'normal' && (
          <div className={`flex flex-col gap-0.5 mt-2 ${variant === 'wide' ? 'items-start' : 'items-center'}`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
              {plugin.isLab ? 'Experimental Lab' : 'Core Integration'}
            </span>
            {variant === 'large' && <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Version 1.2.3</span>}
          </div>
        )}
      </div>

      {/* Pinned Marker - 🐧 위치를 더 구석으로! 겹침 방지! */}
      <button
        onClick={(e) => onTogglePin(plugin.id, e)}
        className={`absolute top-2 right-2 p-2.5 rounded-2xl transition-all duration-300 z-30 ${
          isPinned 
            ? 'text-indigo-400 opacity-100 bg-indigo-500/20 border border-indigo-500/20' 
            : 'text-slate-700 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10'
        }`}
      >
        <Lucide.Pin size={12} fill={isPinned ? 'currentColor' : 'none'} className={isPinned ? '' : 'rotate-45'} />
      </button>

      {/* Selection Border Indicator */}
      {isActive && (
        <motion.div 
          layoutId="activeBorder"
          className="absolute inset-0 border-[3px] border-indigo-500/60 rounded-inherit pointer-events-none z-20"
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </motion.button>
  );
});

export default AppLibraryModal;
