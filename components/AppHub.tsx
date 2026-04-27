import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HappyPlugin } from '../plugins/types';
import * as Lucide from 'lucide-react';

interface AppHubProps {
  activePlugin?: HappyPlugin;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  isFocusMode?: boolean;
}

const AppHub: React.FC<AppHubProps> = ({ activePlugin, onOpenLibrary, onOpenSettings, isFocusMode }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  if (!activePlugin) return null;

  return (
    <motion.div 
      className="absolute top-0 left-3 h-16 z-[110] flex items-center gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* App Library Button - Always Visible */}
      <button
        onClick={onOpenLibrary}
        className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white transition-all duration-300 active:scale-90 z-20 relative group"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        title="Open App Library"
      >
        <Lucide.LayoutGrid size={20} className="group-hover:rotate-90 transition-transform duration-500" />
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-pink-500 rounded-full border border-slate-900 animate-pulse"></div>
      </button>

      {/* Settings Button - Revealed on Hover using Framer Motion */}
      <AnimatePresence>
        {isHovered && (
          <motion.button
            initial={{ opacity: 0, x: -10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.8 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={onOpenSettings}
            className="w-10 h-10 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg text-slate-400 hover:text-white transition-all duration-300 active:scale-90"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            title="Settings"
          >
            <Lucide.Settings size={18} className="hover:rotate-90 transition-transform duration-500" />
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Background Plate on Hover - 🐧 형님, 좌우로 시원하게 넓혔습니다! */}
      <motion.div 
        initial={false}
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="absolute -inset-x-2 inset-y-2 bg-white/5 rounded-2xl -z-10 backdrop-blur-sm border border-white/5 pointer-events-none transition-all duration-300" 
      />
    </motion.div>
  );
};

export default AppHub;
