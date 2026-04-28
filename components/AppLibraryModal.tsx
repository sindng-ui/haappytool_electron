import React, { useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HappyPlugin } from '../plugins/types';
import { ToolId } from '../types';

interface AppLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
  setEnabledPlugins: React.Dispatch<React.SetStateAction<string[]>>;
  activePluginId: string;
  onSelectPlugin: (id: string) => void;
}

// 🐧 형님, ToolId 상수를 키로 사용하여 색상을 100% 매칭했습니다! 
// 아주 쨍하고 비비드한 컬러들로 선별했습니다.
const THEME_COLORS: Record<string, { base: string, glow: string, text: string, bg: string, border: string }> = {
  [ToolId.LOG_EXTRACTOR]: { base: 'from-blue-600 to-indigo-700', glow: 'shadow-blue-500/60', text: 'text-blue-300', bg: 'bg-blue-600', border: 'border-blue-400' },
  [ToolId.LOG_ANALYSIS_AGENT]: { base: 'from-purple-600 to-pink-700', glow: 'shadow-purple-500/60', text: 'text-purple-300', bg: 'bg-purple-600', border: 'border-purple-400' },
  [ToolId.GAUSS_CHAT_AGENT]: { base: 'from-rose-500 to-red-700', glow: 'shadow-rose-500/60', text: 'text-rose-300', bg: 'bg-rose-600', border: 'border-rose-400' },
  [ToolId.EVERYTHING_SEARCH]: { base: 'from-emerald-500 to-teal-700', glow: 'shadow-emerald-500/60', text: 'text-emerald-300', bg: 'bg-emerald-600', border: 'border-emerald-400' },
  [ToolId.RAG_ANALYZER_TEST]: { base: 'from-cyan-500 to-blue-700', glow: 'shadow-cyan-500/60', text: 'text-cyan-300', bg: 'bg-cyan-600', border: 'border-cyan-400' },
  [ToolId.NUPKG_SIGNER]: { base: 'from-amber-500 to-orange-700', glow: 'shadow-amber-500/60', text: 'text-amber-300', bg: 'bg-amber-600', border: 'border-amber-400' },
  [ToolId.RELEASE_HISTORY]: { base: 'from-violet-500 to-fuchsia-700', glow: 'shadow-violet-500/60', text: 'text-violet-300', bg: 'bg-violet-600', border: 'border-violet-400' },
  [ToolId.NET_TRAFFIC_ANALYZER]: { base: 'from-sky-500 to-blue-600', glow: 'shadow-sky-500/60', text: 'text-sky-300', bg: 'bg-sky-600', border: 'border-sky-400' },
  [ToolId.POST_TOOL]: { base: 'from-pink-500 to-rose-600', glow: 'shadow-pink-500/60', text: 'text-pink-300', bg: 'bg-pink-600', border: 'border-pink-400' },
  [ToolId.JSON_TOOLS]: { base: 'from-slate-500 to-slate-700', glow: 'shadow-slate-500/60', text: 'text-slate-300', bg: 'bg-slate-600', border: 'border-slate-400' },
  [ToolId.BLOCK_TEST]: { base: 'from-indigo-600 to-purple-800', glow: 'shadow-indigo-500/60', text: 'text-indigo-300', bg: 'bg-indigo-600', border: 'border-indigo-400' },
  [ToolId.SPEED_SCOPE]: { base: 'from-orange-500 to-red-600', glow: 'shadow-orange-500/60', text: 'text-orange-300', bg: 'bg-orange-600', border: 'border-orange-400' },
  [ToolId.EASY_POST]: { base: 'from-yellow-400 to-amber-600', glow: 'shadow-yellow-500/60', text: 'text-yellow-300', bg: 'bg-yellow-600', border: 'border-yellow-400' },
  [ToolId.SMARTTHINGS_LAB]: { base: 'from-lime-500 to-green-700', glow: 'shadow-lime-500/60', text: 'text-lime-300', bg: 'bg-lime-600', border: 'border-lime-400' },
  [ToolId.TIZEN_LAB]: { base: 'from-cyan-400 to-blue-600', glow: 'shadow-blue-500/60', text: 'text-blue-300', bg: 'bg-cyan-600', border: 'border-blue-400' },
  [ToolId.PERF_TOOL]: { base: 'from-red-500 to-rose-700', glow: 'shadow-red-500/60', text: 'text-red-300', bg: 'bg-red-600', border: 'border-red-400' },
  [ToolId.TPK_EXTRACTOR]: { base: 'from-blue-400 to-cyan-500', glow: 'shadow-blue-500/60', text: 'text-blue-200', bg: 'bg-blue-500', border: 'border-blue-300' },
  [ToolId.SMARTTHINGS_DEVICES]: { base: 'from-slate-400 to-blue-500', glow: 'shadow-slate-500/60', text: 'text-slate-200', bg: 'bg-slate-500', border: 'border-slate-300' },
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
  const [pluginSizes, setPluginSizes] = React.useState<Record<string, 'normal' | 'wide' | 'large'>>({});

  const togglePluginSize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setPluginSizes(prev => {
      const current = prev[id] || 'normal';
      const next: 'normal' | 'wide' | 'large' = 
        current === 'normal' ? 'wide' : 
        current === 'wide' ? 'large' : 'normal';
      return { ...prev, [id]: next };
    });
  };

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
            className="absolute inset-0 bg-slate-950/80 pointer-events-auto"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: -20, originX: 0, originY: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -20 }}
            transition={{ type: "spring", damping: 20, stiffness: 500 }}
            className="relative w-full max-w-2xl max-h-[90vh] mt-16 ml-2 bg-[#080B14] border border-white/10 rounded-[32px] shadow-[0_50px_120px_rgba(0,0,0,1)] flex flex-col overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-slate-900/40">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]" />
                  <h2 className="text-xl font-black text-white tracking-tight">APP HUB</h2>
                </div>
                <p className="text-slate-500 text-[10px] font-black tracking-[0.2em] uppercase">Vivid Workspace</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-rose-600 hover:text-white transition-all active:scale-90 border border-white/5"
              >
                <Lucide.X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } }
              }}
              className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar"
            >
              <div className="space-y-16">
                <Section 
                  title="Pinned Tools" 
                  icon={<Lucide.Pin size={14} className="fill-current" />} 
                  plugins={corePlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                  onRightClick={togglePluginSize}
                  pluginSizes={pluginSizes}
                  isBento={true}
                  startIndex={0}
                />
                
                <Section 
                  title="More Apps" 
                  icon={<Lucide.LayoutGrid size={14} />} 
                  plugins={labPlugins} 
                  activeId={activePluginId} 
                  enabledSet={enabledSet}
                  onSelect={(id: string) => { onSelectPlugin(id); onClose(); }} 
                  onTogglePin={handleTogglePin} 
                  onRightClick={togglePluginSize}
                  pluginSizes={pluginSizes}
                  isBento={false}
                  startIndex={corePlugins.length}
                />
              </div>
            </motion.div>

            <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Section = React.memo(({ title, icon, plugins, activeId, enabledSet, onSelect, onTogglePin, onRightClick, pluginSizes, isBento, startIndex }: any) => {
  if (plugins.length === 0) return null;
  
  return (
    <motion.section 
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
      }}
      className="relative"
    >
      <div className="flex items-center gap-3 mb-10">
        <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
          {icon}
        </div>
        <h3 className="text-[11px] font-black text-slate-400 tracking-[0.3em] uppercase">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/5 to-transparent ml-8" />
      </div>
      
      <motion.div layout className="grid grid-cols-4 gap-5 grid-flow-row-dense">
        {plugins.map((plugin: HappyPlugin, idx: number) => {
          let variant = pluginSizes[plugin.id];
          
          // 🐧 커스텀 사이즈가 없으면 기본 Bento 레이아웃 적용
          if (!variant && isBento) {
            if (idx === 0) variant = 'large';
            else if (idx === 1 || idx === 2) variant = 'wide';
          }
          
          variant = variant || 'normal';

          return (
            <AppCard 
              key={plugin.id}
              idx={startIndex + idx}
              plugin={plugin}
              variant={variant}
              isPinned={enabledSet.has(plugin.id)}
              isActive={plugin.id === activeId}
              onSelect={() => onSelect(plugin.id)}
              onTogglePin={onTogglePin}
              onRightClick={(e: any) => onRightClick(plugin.id, e)}
            />
          );
        })}
      </motion.div>
    </motion.section>
  );
});

const AppCard = React.memo(({ plugin, isActive, isPinned, onSelect, onTogglePin, onRightClick, variant = 'normal', idx = 0 }: any) => {
  const Icon = plugin.icon || Lucide.Package;
  // 🐧 형님, 테마가 없으면 기본값을 슬레이트로 주되, 있으면 아주 쨍하게 갑니다!
  const theme = THEME_COLORS[plugin.id] || { base: 'from-slate-600 to-slate-800', glow: 'shadow-slate-500/30', text: 'text-slate-400', bg: 'bg-slate-700', border: 'border-slate-500' };

  const sizeClasses = {
    normal: 'col-span-1 row-span-1 h-28 flex-col justify-center gap-3 items-center text-center p-3',
    wide: 'col-span-2 row-span-1 h-28 flex-row items-center justify-start pl-6 pr-14 gap-5 text-left',
    large: 'col-span-2 row-span-2 h-[230px] flex-col justify-between p-8 items-center text-center'
  };

  return (
    <motion.button
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { 
          opacity: 0, 
          y: 30, 
          x: plugin.id.length % 2 === 0 ? 15 : -15, // 🐧 ID 길이에 따른 미세한 좌우 오프셋
          rotate: plugin.id.length % 2 === 0 ? 3 : -3, // 🐧 미세한 회전으로 랜덤감 부여
          scale: 0.9 
        },
        visible: { 
          opacity: 1, 
          y: 0, 
          x: 0, 
          rotate: 0, 
          scale: 1,
          transition: {
            type: "spring",
            damping: 12 + (plugin.id.length % 5), // 🐧 앱마다 다른 댐핑
            stiffness: 90 + (plugin.id.length % 7) * 10, // 🐧 앱마다 다른 강도
            mass: 0.5 + (plugin.id.length % 3) * 0.15, // 🐧 더 가벼운 물리 법칙
            delay: idx * 0.01 + (plugin.id.length % 4) * 0.005, // 🐧 딜레이 대폭 축소
            velocity: 2
          }
        }
      }}
      whileHover={{ y: -8, scale: 1.03, rotate: 0 }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      onContextMenu={onRightClick}
      className={`group relative flex transition-all duration-500 border overflow-hidden rounded-[40px] ${sizeClasses[variant]} ${
        isActive 
          ? `bg-slate-900 border-indigo-500 shadow-[0_30px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(99,102,241,0.3)]` 
          : `bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.08]`
      }`}
    >
      {/* Background Aura - 🐧 비비드함의 극치! */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-30 bg-gradient-to-br ${theme.base} transition-opacity duration-500`} />
      
      {/* Ghost Typography */}
      {variant === 'large' && (
        <div className="absolute top-10 -left-6 text-white/[0.03] text-9xl font-black italic select-none pointer-events-none transform -rotate-12 uppercase whitespace-nowrap">
          {plugin.name}
        </div>
      )}

      {/* Icon Wrapper - 🐧 비활성 상태에서도 쨍한 색상 노출! */}
      <div className={`
        flex items-center justify-center transition-all duration-700 relative z-10 shrink-0 shadow-2xl
        ${variant === 'large' ? 'w-24 h-24 rounded-[36px]' : 'w-14 h-14 rounded-[20px]'}
        ${isActive ? `bg-gradient-to-br ${theme.base} text-white shadow-2xl ${theme.glow}` : `${theme.bg} ${theme.text} bg-opacity-80 group-hover:bg-opacity-100 group-hover:scale-105`}
      `}>
        <Icon size={variant === 'large' ? 48 : 24} strokeWidth={isActive ? 3 : 2.5} />
        {/* Extreme Glow */}
        <div className={`absolute inset-0 rounded-inherit opacity-0 group-hover:opacity-70 blur-3xl ${theme.base} -z-10 transition-opacity`} />
      </div>
      
      <div className={`flex flex-col relative z-10 min-w-0 ${variant === 'wide' ? 'flex-1' : ''}`}>
        <span className={`font-extrabold tracking-normal transition-colors duration-300 uppercase leading-tight antialiased ${
          variant === 'large' ? 'text-2xl text-white mt-8' : (variant === 'wide' ? 'text-lg text-white' : 'text-[12.5px] text-slate-100')
        } ${
          isActive ? 'text-white' : 'group-hover:text-white'
        }`}>
          {plugin.name}
        </span>
      </div>

      {/* Pinned Marker - 🐧 UX 힌트 강화: 고정 안 된 앱은 상시 노출 & 화살표 아이콘 */}
      <button
        onClick={(e) => onTogglePin(plugin.id, e)}
        className={`absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 z-30 ${
          isPinned 
            ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 shadow-inner' 
            : 'text-white/40 bg-white/10 group-hover:text-white group-hover:bg-white/20 hover:scale-110 active:scale-90'
        }`}
      >
        {isPinned ? (
          <Lucide.Pin size={11} fill="currentColor" />
        ) : (
          <Lucide.ChevronUp size={14} strokeWidth={3} />
        )}
      </button>

      {/* Selection Animated Border - 🐧 곡률 강제 적용으로 각진 현상 방지 */}
      {isActive && (
        <motion.div 
          layoutId="activeIndicator"
          className={`absolute inset-0 border-[3px] border-indigo-500/60 pointer-events-none z-20 ${
            variant === 'large' ? 'rounded-[40px]' : (variant === 'wide' ? 'rounded-[32px]' : 'rounded-[32px]')
          }`}
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </motion.button>
  );
});

export default AppLibraryModal;
