import React from 'react';
import * as Lucide from 'lucide-react';
import { STSpecialRequest } from '../../types';

// ─── Icon Map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
    MapPin: Lucide.MapPin,
    Home: Lucide.Home,
    Cpu: Lucide.Cpu,
    Globe: Lucide.Globe,
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SpecialRequestCardProps {
    req: STSpecialRequest;
    onLoad: (req: STSpecialRequest) => void;
    onUpdate?: (req: STSpecialRequest) => void;
    isActive?: boolean;
}

const getMethodColor = (m: string) => {
    switch (m) {
        case 'GET': return 'text-emerald-500 bg-emerald-500/10';
        case 'POST': return 'text-blue-500 bg-blue-500/10';
        case 'PUT': return 'text-orange-500 bg-orange-500/10';
        case 'PATCH': return 'text-purple-500 bg-purple-500/10';
        case 'DELETE': return 'text-red-500 bg-red-500/10';
        default: return 'text-slate-400 bg-slate-400/10';
    }
};

// ─── Component ────────────────────────────────────────────────────────────────
const SpecialRequestCard: React.FC<SpecialRequestCardProps> = ({ req, onLoad, isActive }) => {
    const IconComponent = ICON_MAP[req.icon] ?? Lucide.Globe;

    return (
        <div
            data-testid={`st-card-${req.id}`}
            onClick={() => onLoad(req)}
            className={`group/item flex items-center justify-between p-2 pl-3 rounded-lg cursor-pointer transition-all border relative ${
                isActive
                    ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-700/30 bg-slate-800/30 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-indigo-500/30'
            }`}
        >
            {/* Left Info: Method Badge + Icon + Name */}
            <div className="flex items-center gap-2 overflow-hidden flex-1 pointer-events-none">
                <span className={`text-[10px] font-bold w-10 shrink-0 text-center py-0.5 rounded ${getMethodColor(req.method)}`}>
                    {req.method}
                </span>
                <div className="p-0.5 rounded bg-indigo-500/10 text-indigo-400 shrink-0">
                    <IconComponent size={12} />
                </div>
                <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">
                    {req.label}
                </span>
            </div>

            {/* Right Badge: ⚡ Special Request Indicator */}
            <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 leading-none shrink-0 ml-1"
                title="SmartThings Special Request"
            >
                ⚡
            </span>
        </div>
    );
};

export default React.memo(SpecialRequestCard);
