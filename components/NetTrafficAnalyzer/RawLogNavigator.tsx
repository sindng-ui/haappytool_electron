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

const RawLogNavigator: React.FC<RawLogNavigatorProps> = ({ file, lineIndices, onClose, title }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
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
      const timer = setTimeout(() => {
        const el = lineRefs.current[targetLine];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, lines, loading, lineIndices]);

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

  // Calculate context info around current match
  const contextInfo = useMemo(() => {
    if (lineIndices.length < 2) return null;
    const curr = lineIndices[currentIndex];
    const prev = currentIndex > 0 ? lineIndices[currentIndex - 1] : null;
    const next = currentIndex < lineIndices.length - 1 ? lineIndices[currentIndex + 1] : null;
    return { curr, prev, next, gapToPrev: prev !== null ? curr - prev : null, gapToNext: next !== null ? next - curr : null };
  }, [lineIndices, currentIndex]);

  // Copy current line
  const copyCurrentLine = useCallback(() => {
    const lineIdx = lineIndices[currentIndex];
    if (lines[lineIdx]) {
      navigator.clipboard.writeText(lines[lineIdx]);
    }
  }, [lines, lineIndices, currentIndex]);

  if (!file) return null;

  const currentTargetLine = lineIndices[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-[#0a0e1a] border border-indigo-500/25 rounded-2xl shadow-2xl w-[92vw] h-[88vh] flex flex-col overflow-hidden max-w-7xl">
        {/* Header */}
        <div className="h-14 border-b border-indigo-500/15 bg-[#0f172a] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4">
            {/* Title Badge */}
            <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg max-w-[400px]">
              <Lucide.Eye size={12} className="text-indigo-400 shrink-0" />
              <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider truncate">{title}</span>
            </div>
            
            <div className="h-5 w-px bg-slate-800" />
            
            {/* Navigation Controls */}
            <div className="flex items-center space-x-2">
              <button 
                className="w-9 h-9 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all disabled:opacity-20 active:scale-95"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                title="Previous match (←)"
              ><Lucide.ChevronLeft size={18} /></button>
              
              <div className="flex flex-col items-center min-w-[120px] bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1">
                <div className="text-[14px] font-black text-white tabular-nums leading-none">
                  L{lineIndices[currentIndex] + 1}
                </div>
                <div className="text-[9px] font-bold text-indigo-400/70 uppercase tracking-tight">
                  {currentIndex + 1} / {lineIndices.length}
                </div>
              </div>

              <button 
                className="w-9 h-9 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all disabled:opacity-20 active:scale-95"
                onClick={() => setCurrentIndex(prev => Math.min(lineIndices.length - 1, prev + 1))}
                disabled={currentIndex === lineIndices.length - 1}
                title="Next match (→)"
              ><Lucide.ChevronRight size={18} /></button>
            </div>

            <div className="h-5 w-px bg-slate-800" />

            {/* Context Gap Info */}
            {contextInfo && (
              <div className="flex items-center space-x-3 text-[9px] text-slate-500">
                {contextInfo.gapToPrev !== null && (
                  <span className="tabular-nums">↑ <span className="text-slate-400 font-bold">{contextInfo.gapToPrev}</span> lines</span>
                )}
                {contextInfo.gapToNext !== null && (
                  <span className="tabular-nums">↓ <span className="text-slate-400 font-bold">{contextInfo.gapToNext}</span> lines</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Copy button */}
            <button 
              onClick={copyCurrentLine}
              className="w-9 h-9 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90"
              title="Copy current line"
            ><Lucide.Copy size={14} /></button>
            {/* Close button */}
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-all active:scale-90" title="Close (Esc)"><Lucide.X size={18} /></button>
          </div>
        </div>

        {/* Match indicator minimap */}
        {lines.length > 0 && lineIndices.length > 1 && (
          <div className="h-1.5 bg-slate-950 shrink-0 relative">
            {lineIndices.map((li, i) => (
              <div 
                key={i}
                className={`absolute top-0 h-full transition-all ${i === currentIndex ? 'bg-indigo-400 w-1.5' : 'bg-indigo-500/30 w-0.5'}`}
                style={{ left: `${(li / lines.length) * 100}%` }}
                onClick={() => setCurrentIndex(i)}
              />
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#0a0e1a] custom-scrollbar p-0 font-mono text-[12px] relative" ref={containerRef}>
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
               <Lucide.Loader size={32} className="animate-spin text-indigo-500" />
               <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Loading Log Data...</span>
             </div>
          ) : (
             <div className="min-w-max pb-[40vh] pt-1">
               {lines.map((line, idx) => {
                 const isSelected = currentTargetLine === idx;
                 const isMatch = lineIndices.includes(idx);
                 // Render only ±500 lines around current target
                 if (!isSelected && Math.abs(currentTargetLine - idx) > 500) return null;
                 
                 const lineType = getLineType(line);
                 const typeStyle = LINE_TYPE_STYLES[lineType];
                 
                 return (
                   <div 
                     key={idx} 
                     ref={el => { lineRefs.current[idx] = el; }}
                     className={`flex items-stretch group transition-colors duration-100 ${
                       isSelected 
                         ? 'bg-indigo-600/25 relative z-10' 
                         : isMatch 
                           ? 'bg-indigo-500/8 hover:bg-indigo-500/12' 
                           : 'hover:bg-slate-900/30'
                     }`}
                   >
                     {/* Selected line accent */}
                     {isSelected && <div className="w-1 bg-indigo-400 shrink-0" />}
                     {!isSelected && isMatch && <div className="w-1 bg-indigo-500/40 shrink-0" />}
                     {!isSelected && !isMatch && <div className="w-1 shrink-0" />}
                     
                     {/* Line type indicator dot */}
                     <div className="w-4 shrink-0 flex items-center justify-center">
                       {typeStyle.dot && <div className={`w-1 h-1 rounded-full ${typeStyle.dot} opacity-60`} />}
                     </div>
                     
                     {/* Line number */}
                     <span className={`w-12 shrink-0 text-right font-mono text-[10px] select-none pr-2 py-[3px] ${
                       isSelected ? 'text-indigo-300 font-bold' : isMatch ? 'text-indigo-400/60' : typeStyle.gutter
                     }`}>{idx + 1}</span>
                     
                     {/* Gutter separator */}
                     <div className={`w-px shrink-0 ${isSelected ? 'bg-indigo-500/40' : 'bg-slate-800/60'}`} />
                     
                     {/* Content */}
                     <span className={`whitespace-pre pl-3 pr-8 flex-1 py-[3px] ${
                       isSelected 
                         ? 'text-white font-semibold' 
                         : isMatch 
                           ? 'text-indigo-200/80' 
                           : typeStyle.text
                     } ${!isSelected ? 'group-hover:text-slate-200' : ''}`}>{line || ' '}</span>
                   </div>
                 );
               })}
             </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="h-7 border-t border-slate-900 bg-[#0f172a] px-4 flex items-center justify-between text-[9px] text-slate-500 shrink-0 select-none">
          <div className="flex items-center space-x-4">
            <span className="tabular-nums">{lines.length.toLocaleString()} lines</span>
            <span className="opacity-20">|</span>
            <span><span className="text-indigo-400 font-bold">{lineIndices.length}</span> matches</span>
            <span className="opacity-20">|</span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" /> <span>Traffic</span></span>
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> <span>Error</span></span>
              <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> <span>Warning</span></span>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-slate-600">
            <span>← → Navigate</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RawLogNavigator;
