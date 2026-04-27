import React from 'react';
import { HappyPlugin } from '../plugins/types';
import * as Lucide from 'lucide-react';

interface AppHubProps {
  activePlugin?: HappyPlugin;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  isFocusMode?: boolean;
}

const AppHub: React.FC<AppHubProps> = ({ activePlugin, onOpenLibrary, onOpenSettings, isFocusMode }) => {
  if (!activePlugin || isFocusMode) return null;

  return (
    <div className="absolute top-3 left-3 z-[110] flex items-center group">
      {/* App Library Button - Always Visible */}
      <button
        onClick={onOpenLibrary}
        className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white transition-all duration-300 active:scale-90 z-20 relative"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        title="Open App Library"
      >
        <Lucide.LayoutGrid size={20} className="group-hover:rotate-90 transition-transform duration-500" />
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-pink-500 rounded-full border border-slate-900 animate-pulse"></div>
      </button>

      {/* Settings Button - Revealed on Hover */}
      <div className="flex items-center overflow-hidden transition-all duration-500 ease-out max-w-0 group-hover:max-w-[60px] opacity-0 group-hover:opacity-100 group-hover:ml-2">
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg text-slate-400 hover:text-white transition-all duration-300 active:scale-90 transform -translate-x-4 group-hover:translate-x-0"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Settings"
        >
          <Lucide.Settings size={18} className="hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>
      
      {/* Subtle indicator background on hover */}
      <div className="absolute inset-y-0 -inset-x-2 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 backdrop-blur-sm pointer-events-none" />
    </div>
  );
};

export default AppHub;
