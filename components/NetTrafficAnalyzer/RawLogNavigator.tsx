import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as Lucide from 'lucide-react';

interface RawLogNavigatorProps {
  file: File | null;
  lineIndices: number[];
  onClose: () => void;
  title: string;
}

// Detect if a line looks like a traffic/network request line
const isTrafficLine = (line: string): boolean => {
  return /\b(GET|POST|PUT|DELETE|PATCH|HEAD)\s+https?:\/\//i.test(line) || 
         /\bRequest>\s/i.test(line) ||
         /\bResponse>\s/i.test(line);
};

// Detect error/warning lines
const getLineType = (line: string): 'error' | 'warning' | 'traffic' | 'normal' => {
  if (/\b(error|exception|fail|crash|fatal)\b/i.test(line)) return 'error';
  if (/\b(warn|warning)\b/i.test(line)) return 'warning';
  if (isTrafficLine(line)) return 'traffic';
  return 'normal';
};

const LINE_TYPE_STYLES = {
  error:   { gutter: 'text-rose-400', text: 'text-rose-300/90', dot: 'bg-rose-500' },
  warning: { gutter: 'text-amber-400', text: 'text-amber-300/80', dot: 'bg-amber-500' },
  traffic: { gutter: 'text-cyan-400',  text: 'text-cyan-300/80',  dot: 'bg-cyan-500' },
  normal:  { gutter: 'text-slate-600', text: 'text-slate-400',    dot: '' },
};

// 🐧 팁: 개별 로그 라인을 별도의 컴포넌트로 분리하고 React.memo를 적용하여,
// 선택된 줄이 바뀔 때 주변의 다른 수백 줄이 불필요하게 리렌더링되는 것을 원천 차단합니다. ⚡
const LogLineItem = React.memo(({ 
  idx, 
  line, 
  isSelected, 
  isMatch, 
  lineType, 
  onRef 
}: { 
  idx: number, 
  line: string, 
  isSelected: boolean, 
  isMatch: boolean, 
  lineType: 'error' | 'warning' | 'traffic' | 'normal',
  onRef: (el: HTMLDivElement | null) => void
}) => {
  const typeStyle = LINE_TYPE_STYLES[lineType];
  
  return (
    <div 
      ref={onRef}
      className={`flex items-stretch transition-colors duration-0 ${
        isSelected 
          ? 'bg-indigo-600/30 relative z-10' 
          : isMatch 
            ? 'bg-indigo-500/10 hover:bg-indigo-500/15' 
            : 'hover:bg-slate-900/40'
      }`}
    >
      <div className={`w-1.5 shrink-0 ${isSelected ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : isMatch ? 'bg-indigo-500/40' : 'bg-transparent'}`} />
      <div className="w-5 shrink-0 flex items-center justify-center">
        {typeStyle.dot && <div className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot} shadow-sm`} />}
      </div>
      <span className={`w-16 shrink-0 text-right font-mono text-[11px] select-none pr-4 py-1 ${
        isSelected ? 'text-indigo-300 font-black' : isMatch ? 'text-indigo-400/60' : typeStyle.gutter
      }`}>{idx + 1}</span>
      <div className={`w-px shrink-0 ${isSelected ? 'bg-indigo-500/50' : 'bg-slate-800/80'}`} />
      <span className={`whitespace-pre pl-4 pr-12 flex-1 py-1 ${
        isSelected 
          ? 'text-white font-bold' 
          : isMatch 
            ? 'text-indigo-100/90' 
            : typeStyle.text
      }`}>{line || ' '}</span>
    </div>
  );
});

const RawLogNavigator: React.FC<RawLogNavigatorProps> = ({ file, lineIndices, onClose, title }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 🐧 팁: includes(O(N)) 대신 Set.has(O(1))를 사용하여 매칭 여부 확인 성능을 비약적으로 끌어올립니다.
  const lineIndicesSet = useMemo(() => new Set(lineIndices), [lineIndices]);

  useEffect(() => {
    if (file) {
      setLoading(true);
      file.text().then(text => {
        // CRLF와 LF를 통합 처리하여 줄바꿈 오차 방지 및 성능 확보
        setLines(text.split(/\r?\n/));
        setLoading(false);
      }).catch(err => {
        console.error('Failed to read log file', err);
        setLoading(false);
      });
    }
  }, [file]);

  useEffect(() => {
    if (!loading && lines.length > 0 && lineIndices.length > 0) {
      const targetLine = lineIndices[currentIndex];
      const timer = setTimeout(() => {
        const el = lineRefs.current[targetLine];
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, lines.length, loading, lineIndices]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentIndex(prev => Math.min(lineIndices.length - 1, prev + 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lineIndices.length, onClose]);

  const currentTargetLine = lineIndices[currentIndex];

  // 🐧 팁: 렌더링 범위를 현재 줄 기준 전후 100줄로 유지하되, 슬라이스된 라인들의 '타입'을 메모계산하여 
  // 렌더링 루프 내부의 정규식 연산을 제거합니다.
  const renderedRange = useMemo(() => {
    if (loading || lines.length === 0) return { start: 0, end: 0, items: [] };
    const start = Math.max(0, currentTargetLine - 100);
    const end = Math.min(lines.length, currentTargetLine + 100);
    
    // 윈도우 내의 라인들만 정규식 타입 검사를 수행합니다.
    const items = lines.slice(start, end).map((line, i) => ({
      idx: start + i,
      line,
      type: getLineType(line)
    }));
    
    return { start, end, items };
  }, [loading, lines, currentTargetLine]);

  // Copy current line
  const copyCurrentLine = useCallback(() => {
    const lineIdx = lineIndices[currentIndex];
    if (lines[lineIdx]) {
      navigator.clipboard.writeText(lines[lineIdx]);
    }
  }, [lines, lineIndices, currentIndex]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2">
      <style>{`
        #raw-log-container::-webkit-scrollbar { display: none; }
        #raw-log-container { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      <div className="bg-[#0a0e1a] border border-indigo-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[98vw] h-[94vh] flex flex-col overflow-hidden">
        {/* Header (생략...) */}
        <div className="h-14 border-b border-indigo-500/20 bg-[#0f172a] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/30 px-4 py-2 rounded-lg">
              <Lucide.Activity size={14} className="text-indigo-400 shrink-0" />
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] truncate">{title}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center space-x-3">
              <button 
                className="w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-all disabled:opacity-10 active:scale-95 shadow-lg"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              ><Lucide.ChevronLeft size={20} /></button>
              <div className="flex flex-col items-center min-w-[140px] bg-slate-900 border border-indigo-500/20 rounded-xl px-4 py-1.5 shadow-inner">
                <div className="text-[16px] font-black text-white tabular-nums leading-none mb-0.5">L{lineIndices[currentIndex] + 1}</div>
                <div className="text-[9px] font-bold text-indigo-400/80 uppercase tracking-widest">{currentIndex + 1} / {lineIndices.length}</div>
              </div>
              <button 
                className="w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-all disabled:opacity-10 active:scale-95 shadow-lg"
                onClick={() => setCurrentIndex(prev => Math.min(lineIndices.length - 1, prev + 1))}
                disabled={currentIndex === lineIndices.length - 1}
              ><Lucide.ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={copyCurrentLine} className="w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"><Lucide.Copy size={16} /></button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><Lucide.X size={20} /></button>
          </div>
        </div>

        {/* Content Area */}
        <div id="raw-log-container" className="flex-1 overflow-auto bg-[#0a0e1a] p-0 font-mono text-[13px] relative select-text" ref={containerRef}>
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
               <Lucide.Loader size={32} className="animate-spin text-indigo-500" />
               <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Optimizing Viewport Data...</span>
             </div>
          ) : (
             <div className="min-w-max pb-[60vh] pt-2">
               {renderedRange.items.map((item) => (
                 <LogLineItem 
                   key={item.idx}
                   idx={item.idx}
                   line={item.line}
                   lineType={item.type}
                   isSelected={currentTargetLine === item.idx}
                   isMatch={lineIndicesSet.has(item.idx)}
                   onRef={el => { lineRefs.current[item.idx] = el; }}
                 />
               ))}
             </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="h-9 border-t border-slate-900 bg-[#0f172a] px-6 flex items-center justify-between text-[11px] text-slate-500 shrink-0 select-none">
          <div className="flex items-center space-x-6">
            <span className="tabular-nums font-bold text-slate-400">{lines.length.toLocaleString()} <span className="text-[9px] font-normal text-slate-600 uppercase">Lines</span></span>
            <span className="opacity-20 text-slate-800">|</span>
            <span className="flex items-center space-x-2">
              <span className="w-1 h-1 rounded-full bg-indigo-500" />
              <span className="text-indigo-400 font-black">{lineIndices.length}</span> <span className="text-[9px] font-normal text-slate-600 uppercase">Matches</span>
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[9px] font-black uppercase tracking-widest text-slate-600">
             <div className="flex items-center space-x-1.5"><Lucide.Keyboard size={12} className="opacity-40" /><span>Performance Tuned</span></div>
             <span className="opacity-20">|</span>
             <span>Hyper Virtual Rendering</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RawLogNavigator;
