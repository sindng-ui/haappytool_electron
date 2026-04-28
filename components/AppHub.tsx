import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HappyPlugin } from '../plugins/types';
import * as Lucide from 'lucide-react';

interface AppHubProps {
  activePlugin?: HappyPlugin;
  plugins: HappyPlugin[];
  enabledPlugins: string[];
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onSelectPlugin: (id: string) => void;
  isFocusMode?: boolean;
}

const AppHub: React.FC<AppHubProps> = ({ 
  activePlugin, 
  plugins, 
  enabledPlugins, 
  onOpenLibrary, 
  onOpenSettings, 
  onSelectPlugin,
  isFocusMode 
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  // 🐧 형님, 핀 고정된 앱들만 쏙 골라냅니다! (현재 활성 앱은 제외)
  const pinnedPlugins = React.useMemo(() => {
    const enabledSet = new Set(enabledPlugins);
    return plugins.filter(p => enabledSet.has(p.id) && p.id !== activePlugin?.id);
  }, [plugins, enabledPlugins, activePlugin?.id]);

  if (!activePlugin) return null;

  return (
    <motion.div 
      className="absolute top-0 left-3 h-16 z-[110] flex items-center gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* App Library Button - 🐧 형님, 더 화려하게 바꿨습니다! */}
      <div className="relative group">
        <button
          onClick={onOpenLibrary}
          className={`w-11 h-11 flex items-center justify-center rounded-2xl shadow-xl transition-all duration-500 active:scale-90 z-20 relative border border-white/10 ${
            isHovered ? 'bg-indigo-500 text-white scale-105' : 'bg-slate-900 text-indigo-400'
          }`}
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Open App Library"
        >
          <Lucide.LayoutGrid size={22} className={`${isHovered ? 'rotate-90' : ''} transition-transform duration-500`} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border-2 border-slate-950 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.5)]"></div>
        </button>
        
        {/* Active Tool Indicator - 🐧 현재 무슨 앱인지 살짝 보여주는 뱃지 (솔리드 배경) */}
        {!isHovered && (
          <motion.div 
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute left-full ml-3 px-3 py-1 bg-slate-900 border border-white/10 rounded-lg whitespace-nowrap pointer-events-none shadow-xl"
          >
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{activePlugin.name}</span>
          </motion.div>
        )}
      </div>

      {/* Quick Access Orbit - 🐧 솔리드 배경으로 변경! */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            className="flex items-center gap-2 pl-2"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } }
            }}
          >
            {pinnedPlugins.map((plugin) => {
              const Icon = plugin.icon || Lucide.Package;
              return (
                <motion.button
                  key={plugin.id}
                  variants={{
                    hidden: { opacity: 0, x: -15, scale: 0.5 },
                    visible: { opacity: 1, x: 0, scale: 1 }
                  }}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onSelectPlugin(plugin.id)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-indigo-600 border border-white/10 rounded-xl shadow-lg text-slate-300 hover:text-white transition-all duration-300 group/item"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                  title={plugin.name}
                >
                  <Icon size={18} className="group-hover/item:animate-bounce" />
                </motion.button>
              );
            })}

            {/* Separator */}
            <motion.div 
              variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1 } }}
              className="w-px h-6 bg-white/20 mx-1" 
            />

            {/* Settings Button */}
            <motion.button
              variants={{
                hidden: { opacity: 0, x: -15, scale: 0.5 },
                visible: { opacity: 1, x: 0, scale: 1 }
              }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              onClick={onOpenSettings}
              className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl shadow-lg text-slate-400 hover:text-white transition-all duration-300"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              title="Settings"
            >
              <Lucide.Settings size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Glow - 🐧 블러 제거! 솔리드 배경으로 변경 */}
      <motion.div 
        initial={false}
        animate={{ 
          opacity: isHovered ? 1 : 0,
          width: isHovered ? 'auto' : 0
        }}
        className="absolute -inset-x-3 inset-y-1.5 bg-slate-900/60 rounded-2xl -z-10 border border-white/10 pointer-events-none transition-all duration-500" 
      />
    </motion.div>
  );
};

export default AppHub;
