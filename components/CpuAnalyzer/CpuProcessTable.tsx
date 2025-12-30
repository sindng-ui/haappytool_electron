
import React from 'react';
import { ProcessData } from './useCpuData';

interface Props {
    processes: ProcessData[];
    onRowClick?: (pid: string) => void;
}

const CpuProcessTable: React.FC<Props> = ({ processes, onRowClick }) => {
    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] rounded-lg overflow-hidden">
            <div className="flex bg-[#2d2d2d] text-gray-300 font-bold px-4 py-2 text-sm">
                <div className="w-16">PID</div>
                <div className="w-24">User</div>
                <div className="w-20 text-right">CPU %</div>
                <div className="flex-1 ml-4">Command</div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {processes.map((proc) => (
                    <div
                        key={proc.pid}
                        onClick={() => onRowClick && onRowClick(proc.pid)}
                        className="flex px-4 py-2 text-sm text-gray-400 border-b border-[#333] hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                        title="Click to view threads"
                    >
                        <div className="w-16 font-mono text-blue-400 group-hover:underline">{proc.pid}</div>
                        <div className="w-24 truncate">{proc.user}</div>
                        <div className={`w-20 text-right font-mono ${proc.cpu > 20 ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                            {proc.cpu}%
                        </div>
                        <div className="flex-1 ml-4 truncate" title={proc.name}>
                            {proc.name}
                        </div>
                    </div>
                ))}
                {processes.length === 0 && (
                    <div className="flex items-center justify-center p-8 text-gray-500">
                        No active processes or waiting for data...
                    </div>
                )}
            </div>
        </div>
    );
};

export default CpuProcessTable;
