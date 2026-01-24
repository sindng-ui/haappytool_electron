import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

const { ChevronRight, ChevronDown } = Lucide;

interface JsonTableProps {
    data: any;
    name?: string; // Key name if part of parent
    isRoot?: boolean;
    depth?: number;
    search?: string;
    activeMatch?: string; // "path:key" or "path:value"
    path?: string; // Current path identifier
}

const Highlight: React.FC<{ text: string; search?: string; isActive?: boolean; className?: string }> = ({ text, search, isActive, className }) => {
    if (!search || !text) return <span className={className}>{text}</span>;

    const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <span className={className}>
            {parts.map((part, i) => {
                const isMatch = part.toLowerCase() === search.toLowerCase();
                let highlightClass = "";
                if (isMatch) {
                    highlightClass = isActive
                        ? "bg-orange-500 text-white rounded px-0.5 shadow-sm font-bold animate-pulse"
                        : "bg-yellow-300 dark:bg-yellow-600/50 text-black dark:text-white rounded px-0.5";
                }

                return isMatch ?
                    <span key={i} className={highlightClass}>{part}</span>
                    : part;
            })}
        </span>
    );
};

const JsonTableViewer: React.FC<JsonTableProps> = ({ data, name, isRoot = false, depth = 0, search, activeMatch, path = "" }) => {
    const tableRef = React.useRef<HTMLDivElement>(null);
    const keyRef = React.useRef<HTMLTableCellElement>(null);

    const checkMatch = (val: any, query: string): boolean => {
        if (!query) return false;
        query = query.toLowerCase();
        if (typeof val === 'object' && val !== null) {
            return Object.keys(val).some(k => k.toLowerCase().includes(query) || checkMatch(val[k], query));
        }
        return String(val).toLowerCase().includes(query);
    };

    const hasMatch = React.useMemo(() => {
        if (!search) return false;
        if (name && name.toLowerCase().includes(search.toLowerCase())) return true;
        return checkMatch(data, search);
    }, [data, name, search]);

    // Check if this node OR its children contain the active match
    const containsActiveMatch = React.useMemo(() => {
        if (!activeMatch) return false;

        // Active match format: "path.to.key:key" or "path.to.key:value"
        const activePathPart = activeMatch.split(':')[0];

        // If current path is a prefix of active match path, we are in the chain
        if (activePathPart === path) return true; // Exact match (self)
        if (activePathPart.startsWith(path + ".")) return true; // Child match

        // Special case for root
        if (path === "" && activePathPart.length > 0) return true;

        return false;
    }, [activeMatch, path]);

    const [expanded, setExpanded] = useState(() => {
        if (search && hasMatch) return true;
        return depth < 2;
    });

    React.useEffect(() => {
        if (containsActiveMatch) {
            setExpanded(true);
        } else if (search && hasMatch) {
            setExpanded(true);
        }
    }, [search, hasMatch, containsActiveMatch]);

    // Scroll Into View Logic
    React.useEffect(() => {
        if (activeMatch) {
            const [matchPath, matchType] = activeMatch.split(':');

            // If WE are the match
            if (matchPath === path) {
                if (matchType === 'key' && keyRef.current) {
                    keyRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }, [activeMatch, path]);

    // Determine my own key/value identifiers
    const myValueId = path ? `${path}:value` : null;

    if (data === null) return <span className="text-slate-400 italic">null</span>;
    if (data === undefined) return <span className="text-slate-400 italic">undefined</span>;

    const isObject = typeof data === 'object' && !Array.isArray(data);
    const isArray = Array.isArray(data);

    if (!isObject && !isArray) {
        // Primitive
        const colorClass = typeof data === 'string' ? "text-emerald-600 dark:text-emerald-400" :
            typeof data === 'number' ? "text-blue-600 dark:text-blue-400" :
                typeof data === 'boolean' ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-slate-300";

        const isValueActive = activeMatch === myValueId;

        // Ref for primitive
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const primRef = React.useRef<HTMLElement>(null);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        React.useEffect(() => {
            if (isValueActive && primRef.current) {
                primRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, [isValueActive]);

        return (
            <span ref={primRef}>
                <Highlight text={String(data)} search={search} isActive={isValueActive} className={`font-mono text-xs break-all ${colorClass}`} />
            </span>
        );
    }

    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;
    const count = isArray ? data.length : keys.length;
    const typeLabel = isArray ? `[${count}]` : `{${count}}`;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const Content = (
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-white dark:bg-slate-900/50" ref={tableRef}>
            <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                    <col className="w-[30%] min-w-[150px]" />
                    <col className="w-[70%]" />
                </colgroup>
                <tbody>
                    {keys.map((key) => {
                        const childPath = path ? `${path}.${key}` : key;
                        const childKeyId = `${childPath}:key`;
                        const isKeyActive = activeMatch === childKeyId;

                        return (
                            <tr key={key} className={`border-b last:border-0 border-slate-100 dark:border-slate-800 transition-colors ${isKeyActive ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                <td
                                    className="whitespace-nowrap truncate max-w-0 py-1 px-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 align-top select-text"
                                    title={key}
                                    ref={isKeyActive ? keyRef : undefined}
                                >
                                    <Highlight text={key} search={search} isActive={isKeyActive} />
                                </td>
                                <td className="py-1 px-2 text-xs align-top select-text break-all">
                                    <JsonTableViewer
                                        data={data[key]}
                                        name={key}
                                        depth={depth + 1}
                                        search={search}
                                        activeMatch={activeMatch}
                                        path={childPath}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    if (isRoot) {
        return <div className="p-2">{Content}</div>;
    }

    return (
        <div className="w-full my-1">
            {/* Header */}
            <div
                className="flex items-center gap-2 cursor-pointer select-none mb-1 group"
                onClick={handleToggle}
            >
                <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                {name && <span className="text-xs font-bold text-slate-700 dark:text-slate-300"><Highlight text={name} search={search} /></span>}
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{typeLabel}</span>
            </div>

            {expanded && !isEmpty && Content}
            {expanded && isEmpty && <div className="text-xs text-slate-400 italic ml-6">Empty</div>}
        </div>
    );
};

export default React.memo(JsonTableViewer);
