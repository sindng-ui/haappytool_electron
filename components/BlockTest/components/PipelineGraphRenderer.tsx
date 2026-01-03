import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PipelineItem, CommandBlock, ExecutionStats } from '../types';
import * as Lucide from 'lucide-react';
import { THEME } from '../theme';

interface PipelineGraphRendererProps {
    items: PipelineItem[];
    blocks: CommandBlock[];
    activeItemId: string | null;
    stats: ExecutionStats;
    isRunning: boolean;
}

const PipelineGraphRenderer: React.FC<PipelineGraphRendererProps> = ({ items, blocks, activeItemId, stats, isRunning }) => {
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isAutoCentering, setIsAutoCentering] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Robust Auto-center on active item
    useLayoutEffect(() => {
        if (!activeItemId || !containerRef.current) return;

        setIsAutoCentering(true);
        let attempts = 0;
        const maxAttempts = 20;

        const centerNode = () => {
            if (!containerRef.current) return;
            const nodeElement = containerRef.current.querySelector(`[data-node-id="${activeItemId}"]`);

            if (nodeElement) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const nodeRect = nodeElement.getBoundingClientRect();

                if (nodeRect.width === 0 || nodeRect.height === 0) {
                    if (attempts < maxAttempts) {
                        attempts++;
                        requestAnimationFrame(centerNode);
                    } else {
                        setIsAutoCentering(false);
                    }
                    return;
                }

                const nodeCenterX = nodeRect.left + nodeRect.width / 2;
                const nodeCenterY = nodeRect.top + nodeRect.height / 2;
                const containerCenterX = containerRect.left + containerRect.width / 2;
                const containerCenterY = containerRect.top + containerRect.height / 2;

                const deltaX = containerCenterX - nodeCenterX;
                const deltaY = containerCenterY - nodeCenterY;

                if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
                    setIsAutoCentering(false);
                    return;
                }

                setPan(prev => ({
                    x: prev.x + deltaX,
                    y: prev.y + deltaY
                }));

                // Allow render to catch up before re-enabling transition
                setTimeout(() => setIsAutoCentering(false), 50);

            } else {
                if (attempts < maxAttempts) {
                    attempts++;
                    requestAnimationFrame(centerNode);
                } else {
                    setIsAutoCentering(false);
                }
            }
        };

        requestAnimationFrame(centerNode);

    }, [activeItemId]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const container = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - container.left;
        const mouseY = e.clientY - container.top;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(0.2, scale + delta), 4);
        const worldX = (mouseX - pan.x) / scale;
        const worldY = (mouseY - pan.y) / scale;
        const newPanX = mouseX - worldX * newScale;
        const newPanY = mouseY - worldY * newScale;
        setScale(newScale);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0 || e.button === 1) setIsPanning(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        }
    };

    const handleMouseUp = () => setIsPanning(false);

    const transitionClass = (isPanning || isAutoCentering) ? '' : 'transition-transform duration-300 ease-out';

    return (
        <div className={`overflow-hidden relative select-none w-full h-full ${THEME.editor.canvas.bg} ${THEME.editor.canvas.dots} ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ backgroundSize: `${20 * scale}px ${20 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            ref={containerRef}
        >
            <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
                <div className={`flex items-center gap-1 rounded-lg px-2 py-1 border font-mono text-xs bg-black/50 text-white backdrop-blur`}>
                    <span>{Math.round(scale * 100)}%</span>
                    <button onClick={() => { setPan({ x: 0, y: 0 }); setScale(1); }} className="ml-2 hover:text-green-400" title="Reset View">
                        <Lucide.Maximize size={12} />
                    </button>
                </div>
            </div>

            <div
                className={`w-full min-h-full flex justify-center pt-20 origin-top-left ${transitionClass}`}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
                <GraphFlowReadOnly
                    items={items}
                    blocks={blocks}
                    activeItemId={activeItemId}
                    stats={stats}
                    direction="row"
                    isRunning={isRunning}
                />
            </div>
        </div>
    );
};

const GraphFlowReadOnly: React.FC<{
    items: PipelineItem[];
    blocks: CommandBlock[];
    activeItemId: string | null;
    stats: ExecutionStats;
    direction?: 'row' | 'col';
    isNested?: boolean;
    isRunning?: boolean;
}> = ({ items, blocks, activeItemId, stats, direction = 'row', isNested = false, isRunning = false }) => {
    const isRow = direction === 'row';

    return (
        <div className={`flex ${isRow ? 'flex-row items-start' : 'flex-col items-center'} cursor-default`}>
            {!isNested && (
                <div className={`${isRow ? 'mr-2 mt-[calc(48px/2-28px)]' : 'mb-2'} relative z-10`} data-node-id="start-node">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${THEME.editor.node.start} border-2 border-green-500/50`}>
                        <Lucide.Play size={24} className="text-green-400 ml-1" />
                    </div>
                </div>
            )}

            {items.map((item, index) => (
                <div key={item.id} className={`flex ${isRow ? 'flex-row h-full items-start' : 'flex-col w-full items-center'} justify-center`}>
                    <div className={`${isRow ? '-mt-2' : ''}`}>
                        {/* Wire from previous node to this node */}
                        <WireReadOnly vertical={!isRow} active={!!stats[item.id]?.startTime} isRunning={isRunning && !!stats[item.id]?.startTime && !stats[item.id]?.endTime} />
                    </div>

                    <div className={`relative z-10 flex items-start justify-center node-appear-animation ${isRow ? 'px-1 h-full' : 'py-1 w-full'}`}>
                        {item.type === 'block' ? (
                            <BlockNodeReadOnly
                                item={item}
                                blocks={blocks}
                                isActive={item.id === activeItemId && isRunning}
                                stats={stats[item.id]}
                            />
                        ) : (
                            <LoopNodeReadOnly
                                item={item}
                                blocks={blocks}
                                activeItemId={activeItemId}
                                stats={stats}
                                isActive={item.id === activeItemId && isRunning}
                                isRunning={isRunning}
                            />
                        )}
                    </div>
                </div>
            ))}

            {!isNested && (
                <div className={`${isRow ? '-mt-2' : ''}`}>
                    <WireReadOnly vertical={!isRow} isLast active={items.length > 0 && !!stats[items[items.length - 1].id]?.endTime} />
                </div>
            )}

            {!isNested && (
                <div className={`${isRow ? 'ml-2 mt-[calc(48px/2-24px)]' : 'mt-2'} relative z-10 ${items.length > 0 && !!stats[items[items.length - 1].id]?.endTime ? 'opacity-100 scale-110' : 'opacity-80'} transition-all duration-500`}>
                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors duration-500
                        ${items.length > 0 && !!stats[items[items.length - 1].id]?.endTime
                            ? 'bg-green-100 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
                            : `border-slate-600 ${THEME.editor.node.end}`
                        }
                    `}>
                        <div className={`w-4 h-4 rounded-full transition-colors duration-500 ${items.length > 0 && !!stats[items[items.length - 1].id]?.endTime ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                    </div>
                </div>
            )}
        </div>
    );
};


const WireReadOnly = React.memo(({ isLast, vertical, active, isRunning }: { isLast?: boolean, vertical?: boolean, active?: boolean, isRunning?: boolean }) => {
    const containerClasses = vertical
        ? `w-4 ${isLast ? 'h-12' : 'h-8'} flex items-center justify-center relative`
        : `${isLast ? 'w-12' : 'w-8'} h-16 flex items-center justify-center relative`;

    const colorClass = active
        ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]'
        : 'bg-slate-700/50';

    // Add a pulsing glow if it's "running" (flowing)
    const activeFlowClass = isRunning ? 'animate-pulse ring-2 ring-green-400/50' : '';

    return (
        <div className={containerClasses}>
            {vertical ? (
                <div className={`h-full w-1 rounded-full transition-all duration-500 ${colorClass} ${activeFlowClass}`} />
            ) : (
                <div className={`w-full h-1 rounded-full transition-all duration-500 ${colorClass} ${activeFlowClass}`} />
            )}
        </div>
    );
});

const BlockNodeReadOnly = React.memo(({ item, blocks, isActive, stats }: { item: PipelineItem; blocks: CommandBlock[]; isActive: boolean; stats?: ExecutionStats[string]; }) => {
    const block = blocks.find(b => b.id === item.blockId);
    if (!block) return <div className="p-2 bg-red-900 text-white text-xs rounded">?</div>;

    const isPredefined = block.type === 'predefined';
    const isSpecial = block.type === 'special';

    const isCompleted = !!stats?.endTime;
    const isError = stats?.status === 'error';

    // Dynamic Styles for Execution State
    let borderClass = 'border-transparent';
    let shadowClass = '';
    let scaleClass = 'scale-100';
    let opacityClass = 'opacity-100';

    if (isActive) {
        borderClass = 'border-indigo-400 ring-2 ring-indigo-500/50';
        shadowClass = 'shadow-[0_0_30px_rgba(99,102,241,0.6)]';
        scaleClass = 'scale-110 z-20';
    } else if (isError) {
        borderClass = 'border-red-500';
        shadowClass = 'shadow-[0_0_20px_rgba(239,68,68,0.4)]';
    } else if (isCompleted) {
        borderClass = 'border-green-500/50';
        opacityClass = 'opacity-80'; // Slightly dim completed ones to focus on active
    } else {
        opacityClass = 'opacity-60 grayscale-[0.5]'; // Pending items
    }

    return (
        <div className={`relative w-56 rounded-xl border transition-all duration-500 h-[48px] overflow-hidden group
            ${THEME.editor.node.base} 
            ${isPredefined ? THEME.editor.node.predefined : isSpecial ? THEME.editor.node.special : THEME.editor.node.custom}
            ${borderClass} ${shadowClass} ${scaleClass} ${opacityClass}
        `}
            data-node-id={item.id}
        >
            {/* Status Indicator Overlay */}
            {isActive && (
                <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none" />
            )}

            {/* Click to focus/log? Future interactive feature */}
            <div className="absolute inset-0 cursor-pointer" title={block.name} />

            {/* Loading / Check icon absolute positioned */}
            <div className="absolute -top-2 -right-2 z-10">
                {isActive && (
                    <span className="relative flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-indigo-500 items-center justify-center">
                            <Lucide.Loader2 size={10} className="text-white animate-spin" />
                        </span>
                    </span>
                )}
                {!isActive && isCompleted && !isError && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md text-white">
                        <Lucide.Check size={12} strokeWidth={4} />
                    </div>
                )}
                {isError && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-md text-white">
                        <Lucide.X size={12} strokeWidth={4} />
                    </div>
                )}
            </div>

            <div className="p-3 flex items-center gap-3 h-full relative z-0 pointer-events-none">
                <div className={`p-1.5 rounded-lg transition-colors duration-300 ${isPredefined ? 'bg-slate-700 text-slate-300' : isSpecial ? 'bg-violet-900/50 text-violet-300' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'}`}>
                    {isSpecial ? (block.id === 'special_wait_image' ? <Lucide.Image size={16} /> : <Lucide.Moon size={16} />) : isPredefined ? <Lucide.Package size={16} /> : <Lucide.Terminal size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-100 truncate">
                        {block.name}
                        {item.blockId === 'special_sleep' && <span className="ml-1 text-violet-300 font-normal">({item.sleepDuration || 1000}ms)</span>}
                    </h4>
                    {isActive && <div className="text-[10px] text-indigo-300 font-mono leading-none mt-0.5">Running...</div>}
                    {!isActive && isCompleted && stats?.duration !== undefined && (
                        <div className="text-[10px] text-green-400 font-mono leading-none mt-0.5">{(stats.duration / 1000).toFixed(2)}s</div>
                    )}
                </div>
            </div>
        </div>
    );
});


const LoopNodeReadOnly = React.memo(({ item, blocks, activeItemId, stats, isActive, isRunning }: { item: PipelineItem; blocks: CommandBlock[]; activeItemId: string | null; stats: ExecutionStats; isActive: boolean; isRunning: boolean; }) => {

    // Collapsible State
    const [isOpen, setIsOpen] = useState(true);

    // Check if any child is active
    const hasActiveChild = (children: PipelineItem[]): boolean => {
        return children.some(c => (c.id === activeItemId && isRunning) || (c.children && hasActiveChild(c.children)));
    };

    const childIsActive = hasActiveChild(item.children || []);

    // Auto-open if running child inside
    useEffect(() => {
        if (childIsActive && !isOpen) {
            setIsOpen(true);
        }
    }, [childIsActive, isOpen]);

    return (
        <div className={`min-w-[200px] rounded-2xl border-2 backdrop-blur-sm relative flex flex-col transition-all duration-500
            ${THEME.editor.node.loop}
            ${childIsActive ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'border-slate-700/50 opacity-80'}
        `}
            data-node-id={item.id}
        >
            <div className="absolute -top-3 left-4 flex z-10">
                <div className={`px-2 py-0.5 rounded-l text-[10px] font-bold uppercase tracking-wider bg-orange-900 border border-orange-700 border-r-0 text-orange-200`}>
                    {stats[item.id]?.status === 'running'
                        ? `Running ${stats[item.id].currentIteration}/${stats[item.id].totalIterations || item.loopCount}`
                        : `Loop ${item.loopCount}x`}
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-1.5 py-0.5 rounded-r bg-orange-800 border border-orange-700 text-orange-200 hover:bg-orange-700 transition-colors"
                >
                    {isOpen ? <Lucide.ChevronUp size={12} /> : <Lucide.ChevronDown size={12} />}
                </button>
            </div>

            <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'p-4 pt-6 opacity-100' : 'h-0 opacity-0'}`}>
                {isOpen && (
                    <GraphFlowReadOnly
                        items={item.children || []}
                        blocks={blocks}
                        activeItemId={activeItemId}
                        stats={stats}
                        isNested
                        direction="col"
                        isRunning={isRunning}
                    />
                )}
            </div>

            {!isOpen && (
                <div className="p-4 text-center text-xs text-slate-500 italic">
                    {item.children?.length || 0} items hidden
                </div>
            )}
        </div>
    );
});

export default PipelineGraphRenderer;
