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
}

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
  startIndex 
}) => {
  if (plugins.length === 0) return null;

  // 🐧 Section 수준의 staggerChildren은 너무 정직하게 순서대로 나오므로 제거합니다!
  // 대신 AppCard 각각의 고유 delay가 뒤죽박죽 섞이도록 둡니다.
  const containerVariants = {
    hidden: { opacity: 1 },
    visible: { opacity: 1 }
  };

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-1.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
          {icon}
        </div>
        <h3 className="text-[11px] font-black text-slate-400 tracking-[0.3em] uppercase">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/5 to-transparent ml-5" />
      </div>

      <motion.div 
        className="grid grid-cols-4 gap-5 grid-flow-row-dense overflow-visible p-2"
      >
        {plugins.map((plugin: HappyPlugin, idx: number) => {
          let variant = pluginSizes[plugin.id];

          // 🐧 기본 Bento 레이아웃 규칙
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
              isGlassy={isGlassy}
              onRightClick={(e: React.MouseEvent) => onRightClick(plugin.id, e)}
            />
          );
        })}
      </motion.div>
    </motion.section>
  );
};

export default React.memo(Section);
