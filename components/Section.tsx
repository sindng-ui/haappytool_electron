import React from 'react';
import { motion } from 'framer-motion';
import AppCard from './AppCard';
import { HappyPlugin } from '../plugins/types';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  plugins: HappyPlugin[];
  activeId: string;
  enabledSet: Set<string>;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onRightClick: (id: string, e: React.MouseEvent) => void;
  pluginSizes: Record<string, 'normal' | 'wide' | 'large'>;
  isBento: boolean;
  isGlassy: boolean;
  startIndex: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

import * as Lucide from 'lucide-react';

const Section: React.FC<SectionProps> = ({ 
  title, 
  icon, 
  plugins, 
  activeId, 
  enabledSet, 
  onSelect, 
  onTogglePin, 
  onRightClick, 
  pluginSizes, 
  isBento, 
  isGlassy, 
  startIndex,
  isCollapsed = false,
  onToggleCollapse
}) => {
  if (plugins.length === 0) return null;

  const containerVariants = {
    hidden: { opacity: 0, height: 0, overflow: 'hidden' },
    visible: { opacity: 1, height: 'auto', overflow: 'visible' }
  };

  return (
    <motion.section
      className={`relative ${isCollapsed ? 'mb-0' : 'mb-8'}`}
    >
      <div 
        className={`flex items-center gap-3 mb-4 px-3 py-2 -mx-3 rounded-2xl transition-all duration-300 group/header ${onToggleCollapse ? 'cursor-pointer select-none hover:bg-white/[0.04]' : ''}`}
        onClick={onToggleCollapse}
      >
        <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/10 transition-transform group-hover/header:scale-110 group-hover/header:bg-indigo-500/30">
          {icon}
        </div>
        <div className="flex items-center gap-2.5">
          <h3 className="text-[11px] font-black text-slate-400 tracking-[0.3em] uppercase group-hover/header:text-slate-200 transition-colors">{title}</h3>
          <div className="px-1.5 py-0.5 rounded-md bg-slate-800/50 border border-white/5 text-[9px] font-bold text-slate-500 group-hover/header:text-indigo-400/80 group-hover/header:border-indigo-500/20 transition-all">
            {plugins.length}
          </div>
        </div>
        
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/5 to-transparent ml-2 opacity-30 group-hover/header:opacity-60 transition-opacity" />
        
        {onToggleCollapse && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-600 opacity-0 group-hover/header:opacity-100 transition-all translate-x-2 group-hover/header:translate-x-0 uppercase tracking-wider">
              {isCollapsed ? 'Expand' : 'Collapse'}
            </span>
            <motion.div
              animate={{ rotate: isCollapsed ? -90 : 0 }}
              className="text-slate-500 group-hover/header:text-indigo-400 transition-colors"
            >
              <Lucide.ChevronDown size={14} />
            </motion.div>
          </div>
        )}
      </div>

      <motion.div
        initial={false}
        animate={isCollapsed ? "hidden" : "visible"}
        variants={containerVariants}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <motion.div 
          layout
          className="grid grid-cols-4 gap-4 grid-flow-row-dense p-1"
        >
          {plugins.map((plugin: HappyPlugin, idx: number) => {
            let variant = pluginSizes[plugin.id];

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
                onSelect={onSelect}
                onTogglePin={onTogglePin}
                isGlassy={isGlassy}
                onRightClick={onRightClick}
              />
            );
          })}
        </motion.div>
      </motion.div>
    </motion.section>
  );
};

export default React.memo(Section);
