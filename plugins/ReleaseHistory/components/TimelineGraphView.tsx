import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ReleaseItem, getTagColor } from '../types';
import { ZoomIn, ZoomOut, Maximize, MousePointer2 } from 'lucide-react';

interface TimelineGraphViewProps {
    items: ReleaseItem[];
    onItemClick: (item: ReleaseItem) => void;
}

const TimelineGraphView: React.FC<TimelineGraphViewProps> = ({ items, onItemClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const miniMapRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<number>(1);
    const [scrollState, setScrollState] = useState({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0 });
    
    // Calculate timeline boundaries and dimensions
    const { minDate, maxDate, products, daySpan } = useMemo(() => {
        if (items.length === 0) return { minDate: 0, maxDate: 0, products: [], daySpan: 0 };
        
        let min = items[0].releaseDate;
        let max = items[0].releaseDate;
        const prods = new Set<string>();
        
        items.forEach(it => {
            if (it.releaseDate < min) min = it.releaseDate;
            if (it.releaseDate > max) max = it.releaseDate;
            prods.add(it.productName);
        });
        
        // Add padding (90 days before and after to prevent clipping)
        const padding = 90 * 24 * 60 * 60 * 1000; 
        min -= padding;
        max += padding;
        
        const span = Math.max(1, (max - min) / (1000 * 60 * 60 * 24));
        
        return { 
            minDate: min, 
            maxDate: max, 
            products: Array.from(prods).sort(),
            daySpan: span
        };
    }, [items]);

    const baseDayWidth = 5; // px per day at 1x zoom
    const dayWidth = baseDayWidth * zoom;
    const totalWidth = daySpan * dayWidth;
    
    const laneHeight = 140; // Increased to accommodate overlapping items

    const todayPos = useMemo(() => {
        const now = Date.now();
        if (now < minDate || now > maxDate) return null;
        return ((now - minDate) / (1000 * 60 * 60 * 24)) * dayWidth;
    }, [minDate, maxDate, dayWidth]);

    // Handle scroll syncing for MiniMap
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleScroll = () => {
            setScrollState({
                scrollLeft: el.scrollLeft,
                clientWidth: el.clientWidth,
                scrollWidth: el.scrollWidth
            });
        };

        el.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial
        return () => el.removeEventListener('scroll', handleScroll);
    }, [zoom, totalWidth]);

    const handleZoom = (delta: number) => {
        setZoom(z => Math.max(0.1, Math.min(5, z + delta)));
    };

    const handleResetZoom = () => setZoom(1);

    // MiniMap Click/Drag Logic
    const handleMiniMapNav = (e: React.MouseEvent | React.TouchEvent) => {
        const mm = miniMapRef.current;
        const main = containerRef.current;
        if (!mm || !main) return;

        const rect = mm.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const x = clientX - rect.left;
        const ratio = x / rect.width;
        
        // Center the viewport on the click
        const scrollTarget = (ratio * main.scrollWidth) - (main.clientWidth / 2);
        main.scrollLeft = scrollTarget;
    };

    // Generate axis labels (Months & Years)
    const timeLabels = useMemo(() => {
        if (daySpan === 0) return [];
        const labels = [];
        let curr = new Date(minDate);
        curr.setDate(1); 
        
        while (curr.getTime() <= maxDate) {
            labels.push({
                date: new Date(curr),
                label: curr.getMonth() === 0 ? curr.getFullYear().toString() : String(curr.getMonth() + 1).padStart(2, '0'),
                isYear: curr.getMonth() === 0,
                offsetDays: (curr.getTime() - minDate) / (1000 * 60 * 60 * 24)
            });
            curr.setMonth(curr.getMonth() + 1);
        }
        return labels;
    }, [minDate, maxDate, daySpan]);

    // Group items by product for rendering lanes
    const itemsByProduct = useMemo(() => {
        const map = new Map<string, ReleaseItem[]>();
        products.forEach(p => map.set(p, []));
        items.forEach(it => {
            map.get(it.productName)?.push(it);
        });
        return map;
    }, [items, products]);

    if (items.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
                No release history found. Add some or import JSON.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 relative selection:bg-indigo-500/30" id="timeline-export-container">
            {/* Toolbar Overlay */}
            <div className="absolute bottom-24 right-6 z-50 flex space-x-2 bg-slate-800/80 backdrop-blur p-2 rounded-xl shadow-2xl border border-slate-700">
                <button onClick={() => handleZoom(-0.2)} className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors" title="Zoom Out">
                    <ZoomOut size={18} />
                </button>
                <button onClick={handleResetZoom} className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors" title="Reset Zoom">
                    <Maximize size={18} />
                </button>
                <button onClick={() => handleZoom(0.2)} className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors" title="Zoom In">
                    <ZoomIn size={18} />
                </button>
            </div>

            {/* Scrollable Container */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-auto relative custom-scrollbar bg-[#020617]"
                style={{ 
                    cursor: 'grab',
                    backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
                    backgroundSize: '60px 60px'
                }}
                onWheel={(e) => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
                    setZoom(z => Math.max(0.1, Math.min(5, z + zoomDelta)));
                }
            }}
            onMouseDown={(e) => {
                    const el = containerRef.current;
                    if (!el) return;
                    let isDown = true;
                    let startX = e.pageX - el.offsetLeft;
                    let startY = e.pageY - el.offsetTop;
                    let scrollLeft = el.scrollLeft;
                    let scrollTop = el.scrollTop;

                    const mouseMoveHandler = (e: MouseEvent) => {
                        if (!isDown) return;
                        e.preventDefault();
                        const x = e.pageX - el.offsetLeft;
                        const y = e.pageY - el.offsetTop;
                        const walkX = (x - startX) * 1.5;
                        const walkY = (y - startY) * 1.5;
                        el.scrollLeft = scrollLeft - walkX;
                        el.scrollTop = scrollTop - walkY;
                    };
                    const mouseUpHandler = () => {
                        isDown = false;
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);
                    };
                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                }}
            >
                <div style={{ width: totalWidth, minWidth: '100%', position: 'relative', paddingBottom: '4rem', paddingLeft: '200px' }}>
                    
                    {/* Today Indicator (Vertical line) */}
                    {todayPos !== null && (
                        <div 
                            className="absolute top-0 bottom-0 w-px bg-rose-500/40 z-30 pointer-events-none"
                            style={{ left: todayPos }}
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-rose-500 text-[10px] text-white px-1.5 py-0.5 rounded-b font-bold whitespace-nowrap shadow-lg">
                                TODAY
                            </div>
                        </div>
                    )}

                    {/* X-Axis (Time Header) */}
                    <div className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800 h-14 shadow-xl">
                        {timeLabels.map((tl, i) => (
                            <div 
                                key={i}
                                className={`absolute top-0 bottom-0 border-l flex flex-col justify-end pb-3 pl-3 transition-colors ${tl.isYear ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800/80'}`}
                                style={{ left: tl.offsetDays * dayWidth }}
                            >
                                <div className="flex flex-col items-start">
                                    {tl.isYear && (
                                        <span className="text-[10px] text-indigo-500 font-black uppercase tracking-tighter leading-none mb-1">
                                            YEAR
                                        </span>
                                    )}
                                    <span className={`select-none leading-none tracking-tight ${tl.isYear ? 'text-white font-black text-base' : 'text-slate-300 font-bold text-sm opacity-60'}`}>
                                        {tl.label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Y-Axis & Grid (Lanes) */}
                    <div className="relative mt-4">
                        {/* Month Vertical Grid Lines (Background) */}
                        <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-0">
                            {timeLabels.map((tl, i) => (
                                <div 
                                    key={i}
                                    className={`absolute top-0 bottom-0 border-l ${tl.isYear ? 'border-slate-800' : 'border-slate-900/50'}`}
                                    style={{ left: tl.offsetDays * dayWidth }}
                                />
                            ))}
                        </div>

                        {/* Product Lanes */}
                        {products.map((prod, idx) => (
                            <div 
                                key={prod}
                                className="relative flex items-center border-b border-slate-800 group/lane transition-colors z-10"
                                style={{ height: laneHeight }}
                            >
                                {/* Lane Glow Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover/lane:opacity-100 transition-opacity pointer-events-none" />

                                {/* Sticky Product Label */}
                                <div className="sticky left-0 bg-slate-950 z-40 px-6 py-4 border-r border-slate-800 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.5)] w-48 shrink-0 flex flex-col justify-center">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Product</div>
                                    <span className="font-black text-slate-200 text-lg truncate drop-shadow-sm" title={prod}>{prod}</span>
                                    <div className="text-[10px] text-indigo-500/70 font-semibold mt-1">
                                        {itemsByProduct.get(prod)?.length || 0} Releases
                                    </div>
                                </div>

                                {/* Items Container */}
                                <div className="absolute top-0 bottom-0 left-0 right-0 overflow-visible">
                                    {/* App Tracks */}
                                    {(() => {
                                        const laneItems = itemsByProduct.get(prod) || [];
                                        const uniqueReleases = Array.from(new Set(laneItems.map(i => i.releaseName)));
                                        
                                        return uniqueReleases.map(rName => {
                                            const appItems = laneItems.filter(i => i.releaseName === rName).sort((a, b) => a.releaseDate - b.releaseDate);
                                            if (appItems.length < 2) return null;
                                            
                                            const firstPos = ((appItems[0].releaseDate - minDate) / (1000 * 60 * 60 * 24)) * dayWidth;
                                            const lastPos = ((appItems[appItems.length - 1].releaseDate - minDate) / (1000 * 60 * 60 * 24)) * dayWidth;
                                            
                                            const itemWithTag = appItems.find(i => i.tags && i.tags.length > 0);
                                            const accentColor = itemWithTag?.tags ? getTagColor(itemWithTag.tags[0]) : `hsl(${Math.abs(rName.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)) % 360}, 70%, 60%)`;

                                            return (
                                                <div 
                                                    key={rName}
                                                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full opacity-10 blur-[1px]"
                                                    style={{ 
                                                        left: firstPos, 
                                                        width: lastPos - firstPos,
                                                        backgroundColor: accentColor,
                                                        boxShadow: `0 0 20px 2px ${accentColor}`
                                                    }}
                                                />
                                            );
                                        });
                                    })()}

                                    {(() => {
                                        const laneItems = [...(itemsByProduct.get(prod) || [])].sort((a, b) => a.releaseDate - b.releaseDate);
                                        const renderedItems: any[] = [];
                                        
                                        laneItems.forEach(item => {
                                            const offsetDays = (item.releaseDate - minDate) / (1000 * 60 * 60 * 24);
                                            const leftPos = offsetDays * dayWidth;
                                            
                                            // Slotting logic for overlap
                                            let slot = 0;
                                            while (renderedItems.some(ri => 
                                                ri.slot === slot && 
                                                Math.abs(ri.leftPos - leftPos) < 220
                                            )) {
                                                slot = (slot === 0) ? 1 : (slot === 1) ? -1 : (slot > 0) ? slot + 1 : slot - 1;
                                                if (Math.abs(slot) > 2) break; // Max 5 levels
                                            }
                                            renderedItems.push({ ...item, leftPos, slot });
                                        });

                                        return renderedItems.map((item) => {
                                            const accentColor = item.tags && item.tags.length > 0 ? getTagColor(item.tags[0]) : `hsl(${Math.abs(item.releaseName.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)) % 360}, 70%, 60%)`;
                                            
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                                                    className="absolute top-1/2 group cursor-pointer z-10 transition-all duration-300"
                                                    style={{ 
                                                        left: item.leftPos,
                                                        transform: `translateY(calc(-50% + ${item.slot * 45}px))`
                                                    }}
                                                >
                                                    {/* Card-style Item */}
                                                    <div 
                                                        className="min-w-[170px] max-w-[220px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl hover:shadow-indigo-500/30 hover:border-indigo-500/50 transition-all group-hover:-translate-y-1.5 flex flex-col gap-3"
                                                    >
                                                        {/* Top Row: Release Name & Date */}
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-100 truncate max-w-[100px]">{item.releaseName}</span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-950/50 px-2 py-1 rounded-md border border-slate-800/50">
                                                                {new Date(item.releaseDate).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                                                            </span>
                                                        </div>

                                                        {/* Middle Row: Version */}
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}44` }} />
                                                            <span className="text-xl font-black text-white tracking-tight leading-none">v{item.version}</span>
                                                        </div>
                                                        
                                                        {/* Bottom Row: Tags */}
                                                        {item.tags && item.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.tags.map(t => (
                                                                    <span 
                                                                        key={t} 
                                                                        className="px-2 py-0.5 rounded-[4px] text-[8px] font-black text-white leading-none uppercase tracking-tight shadow-sm border border-white/10"
                                                                        style={{ backgroundColor: getTagColor(t) }}
                                                                    >
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Vertical Connector Line to Axis */}
                                                    <div 
                                                        className="absolute w-px bg-gradient-to-b from-indigo-500/50 to-transparent -z-10 group-hover:from-indigo-400 transition-all"
                                                        style={{ 
                                                            height: Math.abs(item.slot * 45) + 20,
                                                            top: item.slot >= 0 ? -Math.abs(item.slot * 45) : 100,
                                                            left: 0,
                                                            display: item.slot === 0 ? 'none' : 'block'
                                                        }}
                                                    />
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            {/* MiniMap Navigator */}
            <div className="flex-none h-16 bg-slate-950 border-t border-slate-800 flex items-center px-6 gap-6 z-50">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest rotate-180 [writing-mode:vertical-lr]">MINIMAP</div>
                
                <div 
                    ref={miniMapRef}
                    className="flex-1 h-8 bg-slate-900/50 rounded-lg relative overflow-hidden cursor-grab active:cursor-grabbing group/mm border border-slate-800"
                    onMouseDown={handleMiniMapNav}
                    onMouseMove={(e) => e.buttons === 1 && handleMiniMapNav(e)}
                >
                    {/* Render dots for each release on the minimap */}
                    {items.map(item => {
                        const ratio = (item.releaseDate - minDate) / (maxDate - minDate);
                        const accentColor = item.tags && item.tags.length > 0 ? getTagColor(item.tags[0]) : '#6366f1';
                        return (
                            <div 
                                key={item.id}
                                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-full opacity-60 group-hover/mm:opacity-100 transition-opacity"
                                style={{ 
                                    left: `${ratio * 100}%`,
                                    backgroundColor: accentColor,
                                    boxShadow: `0 0 8px ${accentColor}`
                                }}
                            />
                        );
                    })}

                    {/* Viewport Indicator */}
                    {scrollState.scrollWidth > 0 && (
                        <div 
                            className="absolute top-0 bottom-0 bg-indigo-500/20 border-x border-indigo-500/50 backdrop-blur-[1px] pointer-events-none"
                            style={{ 
                                left: `${(scrollState.scrollLeft / scrollState.scrollWidth) * 100}%`,
                                width: `${(scrollState.clientWidth / scrollState.scrollWidth) * 100}%`
                            }}
                        >
                            <div className="absolute inset-0 flex items-center justify-between px-1 opacity-40">
                                <div className="w-px h-4 bg-indigo-400" />
                                <div className="w-px h-4 bg-indigo-400" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2 text-slate-500">
                    <MousePointer2 size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Pan & Drag</span>
                </div>
            </div>
        </div>
    );
};

export default TimelineGraphView;
