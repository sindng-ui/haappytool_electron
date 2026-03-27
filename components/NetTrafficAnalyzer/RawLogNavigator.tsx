import React, { useState, useRef, useEffect } from 'react';
import * as Lucide from 'lucide-react';

interface RawLogNavigatorProps {
  file: File | null;
  lineIndices: number[];
  onClose: () => void;
  title: string;
}

const RawLogNavigator: React.FC<RawLogNavigatorProps> = ({ file, lineIndices, onClose, title }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (file) {
      setLoading(true);
      file.text().then(text => {
        setLines(text.split('\n'));
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
      // DOM 렌더링 후 스크롤이 확실히 동작하도록 지연 추가
      const timer = setTimeout(() => {
        const el = lineRefs.current[targetLine];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, lines, loading, lineIndices]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-[#0b0f19] border border-indigo-500/30 rounded-xl shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden max-w-6xl">
        {/* Header */}
        <div className="h-14 border-b border-indigo-500/20 bg-[#0f172a] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest leading-none bg-indigo-500/10 px-2 py-1.5 rounded">{title}</span>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="flex items-center space-x-3">
              <button 
                className="w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-20 active:scale-95 shadow-lg"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              ><Lucide.ChevronLeft size={20} /></button>
              
              <div className="flex flex-col items-center min-w-[140px]">
                <div className="text-[16px] font-black text-white tabular-nums leading-none mb-1">
                  Line {lineIndices[currentIndex] + 1}
                </div>
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter opacity-70">
                  Match {currentIndex + 1} of {lineIndices.length}
                </div>
              </div>

              <button 
                className="w-10 h-10 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-20 active:scale-95 shadow-lg"
                onClick={() => setCurrentIndex(prev => Math.min(lineIndices.length - 1, prev + 1))}
                disabled={currentIndex === lineIndices.length - 1}
              ><Lucide.ChevronRight size={20} /></button>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all active:scale-90 shadow-lg"><Lucide.X size={20} /></button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#0b0f19] custom-scrollbar p-0 font-mono text-[12px] relative" ref={containerRef}>
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
               <Lucide.Loader size={32} className="animate-spin text-indigo-500" />
               <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Streaming Telemetry Data...</span>
             </div>
          ) : (
             <div className="space-y-0 min-w-max pb-[40vh]">
               {lines.map((line, idx) => {
                 const isSelected = lineIndices[currentIndex] === idx;
                 // 최적화를 위해 현재 위치 주변 천 줄만 렌더링 (가상화 대신 단순화)
                 if (!isSelected && Math.abs(lineIndices[currentIndex] - idx) > 500) return null;
                 
                 return (
                   <div 
                     key={idx} 
                     ref={el => { lineRefs.current[idx] = el; }}
                     className={`flex space-x-4 px-3 py-1 group transition-all ${isSelected ? 'bg-indigo-600/30 border-l-4 border-indigo-400 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)] z-10' : 'hover:bg-slate-900/40 opacity-90'}`}
                   >
                     <span className={`w-14 shrink-0 text-right font-mono text-[10px] select-none border-r border-slate-800 pr-3 ${isSelected ? 'text-indigo-300 font-bold' : 'text-slate-600'}`}>{idx + 1}</span>
                     <span className={`whitespace-pre pr-8 flex-1 ${isSelected ? 'text-white font-bold opacity-100' : 'text-slate-400 group-hover:text-slate-200 opacity-90'}`}>{line || ' '}</span>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawLogNavigator;
