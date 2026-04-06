import React, { useState, useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { FunctionDiffStat, DiffAnalysisResult, categoryColor } from '../../utils/performanceDiff';

// ─── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'deltaTotal' | 'deltaSelf' | 'deltaPercent' | 'targetTotalTime' | 'baseCallCount';
type SortDir = 'asc' | 'desc';
type FilterCat = FunctionDiffStat['category'] | 'all';

interface DiffStatsPanelProps {
    diffResult: DiffAnalysisResult;
    highlightName?: string | null;
    onHighlight?: (name: string | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMs = (ms: number): string => {
    if (!isFinite(ms)) return '—';
    if (Math.abs(ms) >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    if (Math.abs(ms) >= 0.01) return `${ms.toFixed(1)}ms`;
    return `${ms.toFixed(3)}ms`;
};
const sign = (v: number) => (v > 0 ? '+' : '');

const catLabel: Record<FunctionDiffStat['category'], string> = {
    regressed: 'Slower', improved: 'Faster',
    added: 'Added', removed: 'Removed', neutral: 'Same',
};
const catBg: Record<FunctionDiffStat['category'], string> = {
    regressed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    improved:  'bg-blue-500/10  text-blue-400  border-blue-500/20',
    added:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    removed:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
    neutral:   'bg-slate-700/20 text-slate-500 border-slate-600/20',
};

// ─── Summary Bar ──────────────────────────────────────────────────────────────
const SummaryBar: React.FC<{ diffResult: DiffAnalysisResult }> = ({ diffResult }) => {
    const { globalStats } = diffResult;
    const totalDelta = globalStats.totalDeltaMs;
    const deltaClass = totalDelta > 0
        ? 'text-rose-400'
        : totalDelta < 0 ? 'text-blue-400' : 'text-slate-400';

    const items: Array<{ label: string; value: string | number; color: string }> = [
        { label: 'Total Δ', value: `${sign(totalDelta)}${fmtMs(totalDelta)}`, color: totalDelta > 0 ? '#f87171' : '#60a5fa' },
        { label: 'Regressed', value: globalStats.regressedCount, color: '#f87171' },
        { label: 'Improved',  value: globalStats.improvedCount,  color: '#60a5fa' },
        { label: 'Added',     value: globalStats.addedCount,     color: '#34d399' },
        { label: 'Removed',   value: globalStats.removedCount,   color: '#9ca3af' },
    ];

    return (
        <div className="flex items-center gap-4 px-3 py-2 border-b border-white/5 bg-[#0e1420]/90 shrink-0">
            {items.map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase text-slate-500">{item.label}</span>
                    <span className="text-[11px] font-black" style={{ color: item.color }}>
                        {item.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const DiffStatsPanel: React.FC<DiffStatsPanelProps> = ({
    diffResult,
    highlightName,
    onHighlight,
}) => {
    const [sortKey, setSortKey] = useState<SortKey>('deltaTotal');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [filterCat, setFilterCat] = useState<FilterCat>('all');
    const [search, setSearch] = useState('');

    // ── Sort/Filter logic ─────────────────────────────────────────────────────
    const rows = useMemo(() => {
        let data = [...diffResult.functionStats];

        // Filter by category
        if (filterCat !== 'all') {
            data = data.filter(r => r.category === filterCat);
        }
        // Filter by search
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(r => r.name.toLowerCase().includes(q));
        }
        // Sort
        data.sort((a, b) => {
            const va = a[sortKey] as number;
            const vb = b[sortKey] as number;
            return sortDir === 'desc' ? vb - va : va - vb;
        });
        return data;
    }, [diffResult.functionStats, sortKey, sortDir, filterCat, search]);

    const handleSort = (key: SortKey) => {
        if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
        if (sortKey !== col) return <Lucide.ArrowUpDown size={9} className="opacity-20" />;
        return sortDir === 'desc'
            ? <Lucide.ArrowDown size={9} className="text-indigo-400" />
            : <Lucide.ArrowUp   size={9} className="text-indigo-400" />;
    };

    const sortBtn = (key: SortKey, label: string) => (
        <button
            onClick={() => handleSort(key)}
            className="flex items-center gap-0.5 hover:text-indigo-300 transition-colors"
        >
            {label}
            <SortIcon col={key} />
        </button>
    );

    // Category filter buttons
    const cats: FilterCat[] = ['all', 'regressed', 'improved', 'added', 'removed', 'neutral'];

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#090d16] border-t border-white/5">
            {/* Global summary */}
            <SummaryBar diffResult={diffResult} />

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 shrink-0 bg-[#0c111c]">
                {/* Search */}
                <div className="flex items-center gap-1.5 bg-slate-800/50 rounded px-2 py-1 flex-1 max-w-[200px]">
                    <Lucide.Search size={10} className="text-slate-500 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter functions..."
                        className="bg-transparent text-[10px] text-slate-300 outline-none w-full placeholder:text-slate-600"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300">
                            <Lucide.X size={10} />
                        </button>
                    )}
                </div>

                {/* Category chips */}
                <div className="flex items-center gap-1">
                    {cats.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCat(cat)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border transition-all ${
                                filterCat === cat
                                    ? 'bg-indigo-600 border-indigo-400 text-white'
                                    : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                            }`}
                        >
                            {cat === 'all' ? 'All' : catLabel[cat]}
                        </button>
                    ))}
                </div>

                <span className="text-[9px] text-slate-600 ml-auto font-mono">
                    {rows.length} functions
                </span>
            </div>

            {/* Table Header */}
            <div className="grid text-[9px] text-slate-500 font-black uppercase tracking-wider px-3 py-1 border-b border-white/5 shrink-0 bg-[#0a0e1a]"
                style={{ gridTemplateColumns: '1fr 80px 80px 72px 72px 64px 64px' }}>
                <span>Function</span>
                <span className="text-right">{sortBtn('deltaTotal',   'Δ Total')}</span>
                <span className="text-right">{sortBtn('deltaSelf',    'Δ Self')}</span>
                <span className="text-right">{sortBtn('deltaPercent', 'Δ%')}</span>
                <span className="text-right">{sortBtn('targetTotalTime', 'Target')}</span>
                <span className="text-right">{sortBtn('baseCallCount', 'Calls')}</span>
                <span className="text-right">Status</span>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {rows.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-slate-600 text-[10px]">
                        No functions match filter
                    </div>
                ) : (
                    rows.map(row => {
                        const isHighlighted = highlightName === row.name;
                        const deltaClass = row.deltaTotal > 0
                            ? 'text-rose-400' : row.deltaTotal < 0
                            ? 'text-blue-400' : 'text-slate-500';

                        return (
                            <div
                                key={row.name}
                                onClick={() => onHighlight?.(isHighlighted ? null : row.name)}
                                className={`grid items-center px-3 py-1 border-b border-white/[0.03] cursor-pointer transition-colors ${
                                    isHighlighted
                                        ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                                        : 'hover:bg-white/[0.02]'
                                }`}
                                style={{ gridTemplateColumns: '1fr 80px 80px 72px 72px 64px 64px' }}
                            >
                                {/* Function name */}
                                <div className="min-w-0 pr-2">
                                    <p className="text-[10px] text-slate-200 font-mono truncate" title={row.name}>
                                        {row.name}
                                    </p>
                                    {row.targetCallCount !== row.baseCallCount && (
                                        <p className="text-[8px] text-slate-500 mt-0.5">
                                            calls: {row.baseCallCount} → {row.targetCallCount}
                                        </p>
                                    )}
                                </div>

                                {/* Δ Total */}
                                <div className={`text-right text-[10px] font-mono font-bold ${deltaClass}`}>
                                    {row.baseCallCount > 0 || row.targetCallCount > 0
                                        ? `${sign(row.deltaTotal)}${fmtMs(row.deltaTotal)}`
                                        : '—'}
                                </div>

                                {/* Δ Self */}
                                <div className={`text-right text-[10px] font-mono ${
                                    row.deltaSelf > 1 ? 'text-rose-400/80' :
                                    row.deltaSelf < -1 ? 'text-blue-400/80' : 'text-slate-500'
                                }`}>
                                    {`${sign(row.deltaSelf)}${fmtMs(row.deltaSelf)}`}
                                </div>

                                {/* Δ% */}
                                <div className={`text-right text-[10px] font-mono ${deltaClass}`}>
                                    {row.baseCallCount > 0
                                        ? `${sign(row.deltaPercent)}${row.deltaPercent.toFixed(1)}%`
                                        : '—'}
                                </div>

                                {/* Target total */}
                                <div className="text-right text-[10px] font-mono text-slate-400">
                                    {fmtMs(row.targetTotalTime)}
                                </div>

                                {/* Calls diff */}
                                <div className="text-right text-[10px] font-mono text-slate-400">
                                    {row.targetCallCount}
                                </div>

                                {/* Status badge */}
                                <div className="text-right">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${catBg[row.category]}`}>
                                        {catLabel[row.category]}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
