import React from 'react';
import { motion } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { HappyPlugin } from '../plugins/types';
import { ToolId } from '../types';

// 🐧 형님, 테마 컬러 정의를 여기로 옮겼습니다!
export const THEME_COLORS: Record<string, { base: string, glow: string, text: string, bg: string, border: string }> = {
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

interface AppCardProps {
  plugin: HappyPlugin;
  isActive: boolean;
  isPinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onRightClick: (id: string, e: React.MouseEvent) => void;
  variant?: 'normal' | 'wide' | 'large';
  idx?: number;
  isGlassy?: boolean;
}

// 🐧 형님, 성능을 위해 블러는 빼고 '애니메이션 곡선'의 정수로 승부합니다!
// 🐧 형님, 성능은 잡았으니 이제 '레이어의 깊이감'으로 고급짐을 더합니다!
export const getCardVariants = (idx: number) => ({
  hidden: {
    opacity: 0,
    y: 40,
    rotate: idx % 2 === 0 ? 4 : -4,
    scale: 0.85,
  },
  visible: {
    opacity: 1,
    y: 0,
    rotate: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 180, // 🐧 약간 더 느긋하게 (기존 280)
      damping: 22,    // 🐧 부드러운 감속 (기존 20)
      mass: 0.8,      // 🐧 묵직한 무게감 추가
      delay: Math.pow(idx, 0.7) * 0.05 // 🐧 정갈한 간격 확대
    }
  }
});

export const getIconVariants = (idx: number) => ({
  hidden: { scale: 0.7, opacity: 0, y: 10 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 220, // 🐧 동기화된 속도 (기존 300)
      damping: 20,
      delay: (Math.pow(idx, 0.7) * 0.05) + 0.15 // 🐧 카드 안착 후 여유 있게
    }
  }
});

// 🐧 형님, 과한 광택(Shine)은 걷어내고 '은은한 아우라 펄스'로 변경했습니다.
export const getAuraVariants = (idx: number) => ({
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: [0, 0.2, 0], 
    scale: [0.5, 1.2, 1],
    transition: {
      duration: 1.5, // 🐧 펄스도 조금 더 길게
      delay: (Math.pow(idx, 0.7) * 0.05) + 0.2
    }
  }
});

const AppCard: React.FC<AppCardProps> = ({
  plugin,
  isActive,
  isPinned,
  onSelect,
  onTogglePin,
  onRightClick,
  variant = 'normal',
  idx = 0,
  isGlassy = false
}) => {
  const Icon = plugin.icon || Lucide.Package;
  const theme = THEME_COLORS[plugin.id] || { base: 'from-slate-600 to-slate-800', glow: 'shadow-slate-500/30', text: 'text-slate-400', bg: 'bg-slate-700', border: 'border-slate-500' };

  const animationFactor = React.useMemo(() => {
    return {
      rotate: idx % 2 === 0 ? 4 : -4,
      x: idx % 2 === 0 ? 6 : -6
    };
  }, [idx]);

  const cardVariants = React.useMemo(() => getCardVariants(idx), [idx]);
  const iconVariants = React.useMemo(() => getIconVariants(idx), [idx]);
  const auraVariants = React.useMemo(() => getAuraVariants(idx), [idx]);

  const sizeClasses = {
    normal: 'col-span-1 row-span-1 h-28 flex-col justify-center gap-3 items-center text-center p-3',
    wide: 'col-span-2 row-span-1 h-28 flex-row items-center justify-start pl-6 pr-14 gap-5 text-left',
    large: 'col-span-2 row-span-2 h-[230px] flex-col justify-between p-8 items-center text-center'
  };

  return (
    <motion.button
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{
        y: -8,
        scale: 1.02,
        transition: { type: "spring", stiffness: 400, damping: 25 }
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(plugin.id)}
      onContextMenu={(e) => onRightClick(plugin.id, e)}
      style={{
        WebkitFontSmoothing: 'antialiased'
      }}
      className={`group relative flex transition-[background-color,border-color,box-shadow,z-index] duration-500 border overflow-hidden rounded-[40px] hover:z-50 ${sizeClasses[variant]} ${isActive
        ? `bg-slate-900 border-indigo-500 shadow-[0_30px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(99,102,241,0.3)]`
        : isGlassy
          ? `bg-white/[0.08] border-white/20 hover:border-white/40 hover:bg-white/[0.15] shadow-xl ring-1 ring-white/10`
          : `bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.05]`
        }`}
    >
      {/* 🐧 Entrance Aura Pulse - 등장 시 아주 미세하게 피어오르는 빛 */}
      <motion.div
        variants={auraVariants}
        className={`absolute inset-0 bg-gradient-to-br ${theme.base} blur-2xl pointer-events-none z-0`}
      />

      {/* 💎 Glass Shine - 상단 광택 효과 추가 */}
      {isGlassy && !isActive && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />
      )}
      {/* Glass Highlight */}
      {isGlassy && !isActive && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-30 pointer-events-none z-0" />
      )}

      {/* 💎 Liquid Shine - 마우스 호버 시 빛이 흐르는 효과 */}
      {!isActive && <div className="liquid-shine z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />}

      {/* Background Aura */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-30 bg-gradient-to-br ${theme.base} transition-opacity duration-200`} />

      {/* Ghost Typography */}
      {variant === 'large' && (
        <div className="absolute top-10 -left-6 text-white/[0.03] text-9xl font-black italic select-none pointer-events-none transform-gpu -rotate-12 uppercase whitespace-nowrap">
          {plugin.name}
        </div>
      )}

      {/* Icon Wrapper */}
      <motion.div 
        variants={iconVariants}
        className={`
          flex items-center justify-center transition-[background-color,box-shadow] duration-500 relative z-10 shrink-0 shadow-2xl transform-gpu
          ${variant === 'large' ? 'w-24 h-24 rounded-[36px]' : 'w-14 h-14 rounded-[20px]'}
          ${isActive ? `bg-gradient-to-br ${theme.base} text-white shadow-2xl ${theme.glow}` : `${theme.bg} ${theme.text} bg-opacity-80 group-hover:bg-opacity-100 group-hover:scale-105`}
        `}
      >
        <Icon size={variant === 'large' ? 48 : 24} strokeWidth={isActive ? 3 : 2.5} />
        <div className={`absolute inset-0 rounded-inherit opacity-0 group-hover:opacity-70 blur-3xl ${theme.base} -z-10 transition-opacity`} />
      </motion.div>

      <div className={`flex flex-col relative z-10 min-w-0 ${variant === 'wide' ? 'flex-1' : ''}`}>
        <span className={`font-extrabold tracking-normal transition-colors duration-300 uppercase leading-tight antialiased ${variant === 'large' ? 'text-2xl text-white mt-8' : (variant === 'wide' ? 'text-lg text-white' : 'text-[12.5px] text-slate-100')
          } ${isActive ? 'text-white' : 'group-hover:text-white'
          }`}>
          {plugin.name}
        </span>
      </div>

      {/* Pinned Marker */}
      <button
        onClick={(e) => onTogglePin(plugin.id, e)}
        className={`absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full transition-[transform,background-color,color] duration-300 z-30 transform-gpu ${isPinned
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

      {/* Selection Border - No LayoutId for performance */}
      {isActive && (
        <div
          className={`absolute inset-0 border-[3px] border-indigo-500/60 pointer-events-none z-20 ${variant === 'large' ? 'rounded-[40px]' : 'rounded-[32px]'}`}
        />
      )}
    </motion.button>
  );
};

export default React.memo(AppCard);
