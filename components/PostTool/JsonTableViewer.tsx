import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

const { ChevronRight, ChevronDown } = Lucide;

interface JsonTableProps {
    data: any;
    name?: string; // Key name if part of parent
    isRoot?: boolean;
    depth?: number;
}

const JsonTableViewer: React.FC<JsonTableProps> = ({ data, name, isRoot = false, depth = 0 }) => {
    // Auto-collapse if deeper than level 1 (Root=0, Key=1)
    const [expanded, setExpanded] = useState(depth < 2);

    if (data === null) return <span className="text-slate-400 italic">null</span>;
    if (data === undefined) return <span className="text-slate-400 italic">undefined</span>;

    const isObject = typeof data === 'object' && !Array.isArray(data);
    const isArray = Array.isArray(data);

    if (!isObject && !isArray) {
        // Primitive
        const colorClass = typeof data === 'string' ? "text-emerald-600 dark:text-emerald-400" :
            typeof data === 'number' ? "text-blue-600 dark:text-blue-400" :
                typeof data === 'boolean' ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-slate-300";

        return <span className={`font-mono text-xs break-all ${colorClass}`}>{String(data)}</span>;
    }

    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;
    const count = isArray ? data.length : keys.length;
    const typeLabel = isArray ? `[${count}]` : `{${count}}`;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    // If it's a root object, we might just want to show the table directly?
    // But matching the screenshot, sections like "args {2}" are likely children of root.
    // If this IS root, we can just render the table without a header, or a generic Root header.
    // Let's render table directly if isRoot, otherwise collapsible header.

    const Content = (
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-white dark:bg-slate-900/50">
            <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                    <col className="w-[30%] min-w-[150px]" />
                    <col className="w-[70%]" />
                </colgroup>
                <tbody>
                    {keys.map((key) => (
                        <tr key={key} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="whitespace-nowrap truncate max-w-0 py-1 px-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 align-top select-text" title={key}>
                                {key}
                            </td>
                            <td className="py-1 px-2 text-xs align-top select-text break-all">
                                <JsonTableViewer data={data[key]} name={key} depth={depth + 1} />
                            </td>
                        </tr>
                    ))}
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
                {name && <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{name}</span>}
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{typeLabel}</span>
            </div>

            {expanded && !isEmpty && Content}
            {expanded && isEmpty && <div className="text-xs text-slate-400 italic ml-6">Empty</div>}
        </div>
    );
};

export default React.memo(JsonTableViewer);
