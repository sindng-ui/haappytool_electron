import React, { useMemo, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HappyPlugin } from '../plugins/types';
import Section from './Section';

interface AppLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
  setEnabledPlugins: React.Dispatch<React.SetStateAction<string[]>>;
  activePluginId: string;
  onSelectPlugin: (id: string) => void;
  onOpenSettings?: () => void;
  pluginSizes: Record<string, 'normal' | 'wide' | 'large'>;
  setPluginSizes: React.Dispatch<React.SetStateAction<Record<string, 'normal' | 'wide' | 'large'>>>;
}

const AppLibraryModal: React.FC<AppLibraryModalProps> = ({
  isOpen,
  onClose,
  plugins,
  enabledPlugins,
  setEnabledPlugins,
  activePluginId,
  onSelectPlugin,
  onOpenSettings,
  pluginSizes,
  setPluginSizes
}) => {
  // 🐧 Keyboard Interaction
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 🐧 Optimized States & Memoization
  const enabledSet = useMemo(() => new Set(enabledPlugins), [enabledPlugins]);

  const [isLabsCollapsed, setIsLabsCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('happy_app_hub_labs_collapsed');
    // 🐧 기본적으로 접힌 상태(true)로 시작하며, 사용자가 명시적으로 설정한 값을 우선합니다.
    return saved === null ? true : saved === 'true';
  });

  const toggleLabsCollapse = useCallback(() => {
    setIsLabsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('happy_app_hub_labs_collapsed', String(next));
      return next;
    });
  }, []);

  const togglePluginSize = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setPluginSizes(prev => {
      const current = prev[id] || 'normal';
      const next: 'normal' | 'wide' | 'large' =
        current === 'normal' ? 'wide' :
          current === 'wide' ? 'large' : 'normal';
      return { ...prev, [id]: next };
    });
  }, []);

  const corePlugins = useMemo(() =>
    plugins.filter(p => enabledSet.has(p.id)),
    [plugins, enabledSet]
  );

  const labPlugins = useMemo(() =>
    plugins.filter(p => !enabledSet.has(p.id)),
    [plugins, enabledSet]
  );

  const handleTogglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledPlugins(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }, [setEnabledPlugins]);

  const handleSelect = useCallback((id: string) => {
    onSelectPlugin(id);
    onClose();
  }, [onSelectPlugin, onClose]);

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
            className="absolute inset-0 bg-slate-950/80 pointer-events-auto"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20, originX: 0, originY: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 400,
              delayChildren: 0.15
            }}
            style={{ 
              willChange: 'transform, opacity'
            }}
            className="relative w-full max-w-2xl max-h-[90vh] mt-16 ml-2 bg-[#0C111D] border border-white/10 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="px-6 py-2.5 flex items-center justify-between border-b border-white/5 bg-slate-900/40">
              <div>
                <div className="flex items-center gap-2 mb-0">
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)] animate-pulse" />
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    APP HUB
                    <motion.span
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 15, -15, 0]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Lucide.Sparkles size={16} className="text-yellow-400 fill-yellow-400/30" />
                    </motion.span>
                  </h2>

                  {onOpenSettings && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
                      className="ml-3 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300 active:scale-90 group/settings"
                      title="Open Settings"
                    >
                      <Lucide.Settings size={22} className="group-hover/settings:rotate-90 transition-transform duration-500" />
                    </button>
                  )}
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

            {/* 🐧 Happy Aura Burst - 컨텐츠가 아닌 모달 배경에 고정하여 스크롤 유발 방지 */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.2 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] pointer-events-none z-0"
              style={{
                background: 'radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, transparent 70%)'
              }}
            />

            {/* Scrollable Content */}
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 scrollbar-stable relative z-10"
              style={{ scrollbarGutter: 'stable', transform: 'translateZ(0)' }}
            >
              <div className="pb-4 px-4" style={{ contentVisibility: 'auto' } as any}>
                <Section
                  title="Pinned Tools"
                  icon={<Lucide.Pin size={14} className="fill-current" />}
                  plugins={corePlugins}
                  activeId={activePluginId}
                  enabledSet={enabledSet}
                  onSelect={handleSelect}
                  onTogglePin={handleTogglePin}
                  onRightClick={togglePluginSize}
                  pluginSizes={pluginSizes}
                  isBento={true}
                  isGlassy={true}
                  startIndex={0}
                />

                <Section
                  title="Labs"
                  icon={<Lucide.LayoutGrid size={14} />}
                  plugins={labPlugins}
                  activeId={activePluginId}
                  enabledSet={enabledSet}
                  onSelect={handleSelect}
                  onTogglePin={handleTogglePin}
                  onRightClick={togglePluginSize}
                  pluginSizes={pluginSizes}
                  isBento={false}
                  isGlassy={false}
                  startIndex={corePlugins.length}
                  isCollapsed={isLabsCollapsed}
                  onToggleCollapse={toggleLabsCollapse}
                />
              </div>
            </div>

            {/* Bottom Accent */}
            <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent shrink-0" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AppLibraryModal;
