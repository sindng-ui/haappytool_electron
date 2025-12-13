import React from 'react';
import * as Lucide from 'lucide-react';

const { Box } = Lucide;

interface TpkDropZoneProps {
    dragActive: boolean;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}

export const TpkDropZone: React.FC<TpkDropZoneProps> = ({
    dragActive,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop
}) => {
    return (
        <div
            className={`flex-1 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer group relative overflow-hidden bg-slate-50/50 dark:bg-slate-900/50
            ${dragActive ? 'border-orange-500 bg-orange-500/10 scale-[0.98]' : 'border-slate-200 dark:border-slate-800 hover:border-orange-500/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className={`p-6 rounded-full mb-6 transition-all duration-500 ${dragActive ? 'bg-orange-500/20 rotate-12 scale-110' : 'bg-slate-100 dark:bg-slate-800 group-hover:scale-110'}`}>
                <Box size={48} className={dragActive ? 'text-orange-500' : 'text-slate-400 dark:text-slate-600 group-hover:text-orange-400'} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Drop RPM File</h3>
            <p className="text-slate-500 mt-2 text-sm font-medium">Drag & Drop to start magic extraction</p>

            {/* Decorative background elements */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/5 rounded-full pointer-events-none blur-2xl"></div>
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-orange-500/5 rounded-full pointer-events-none blur-2xl"></div>
        </div>
    );
};
