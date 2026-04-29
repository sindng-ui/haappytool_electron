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

  // 🐧 퀵 메뉴는 이제 설정만 나오므로 앱 목록 로직은 삭제합니다!

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
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        </button>
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
            {/* Settings Button - 🐧 형님, 이제 이 녀석 하나만 깔끔하게 나옵니다! */}
            <motion.button
              variants={{
                hidden: { opacity: 0, x: -10, scale: 0.8 },
                visible: { opacity: 1, x: 0, scale: 1 }
              }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              onClick={onOpenSettings}
              className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-indigo-600 border border-white/10 rounded-xl shadow-lg text-slate-400 hover:text-white transition-all duration-300 ml-1"
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
