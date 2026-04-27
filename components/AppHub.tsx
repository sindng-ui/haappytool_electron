import React from 'react';
import { HappyPlugin } from '../plugins/types';
import * as Lucide from 'lucide-react';

interface AppHubProps {
  activePlugin?: HappyPlugin;
  onOpenLibrary: () => void;
  isFocusMode?: boolean;
}

const AppHub: React.FC<AppHubProps> = ({ activePlugin, onOpenLibrary, isFocusMode }) => {
  if (!activePlugin || isFocusMode) return null;

  return (
    <div className="absolute top-3 left-3 z-[110]">
      <button
        onClick={onOpenLibrary}
        className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white transition-all duration-300 active:scale-90 group relative"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        title="Open App Library"
      >
        <Lucide.LayoutGrid size={20} className="group-hover:rotate-90 transition-transform duration-500" />
        {/* Subtle notification dot or glow if needed */}
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-pink-500 rounded-full border border-slate-900 animate-pulse"></div>
      </button>
    </div>
  );
};

export default AppHub;
