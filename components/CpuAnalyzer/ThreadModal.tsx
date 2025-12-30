
import React from 'react';
import { ThreadData } from './useCpuData';
import { X } from 'lucide-react';

interface Props {
    threads: ThreadData[];
    pid: string;
    onClose: () => void;
}

const ThreadModal: React.FC<Props> = ({ threads, pid, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#333] w-[600px] h-[500px] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#333]">
                    <h3 className="text-lg font-bold text-white">
                        Threads for PID: <span className="text-blue-400 font-mono">{pid}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex bg-[#2d2d2d] text-gray-300 font-bold px-4 py-2 text-sm">
                        <div className="w-20">TID</div>
                        <div className="w-24">User</div>
                        <div className="w-20 text-right">CPU %</div>
                        <div className="flex-1 ml-4">Name</div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {threads.length > 0 ? (
                            threads.map((thread) => (
                                <div key={thread.tid} className="flex px-4 py-2 text-sm text-gray-400 border-b border-[#333] last:border-0 hover:bg-[#2a2a2a]">
                                    <div className="w-20 font-mono text-gray-500">{thread.tid}</div>
                                    <div className="w-24 truncate">{thread.user}</div>
                                    <div className={`w-20 text-right font-mono ${thread.cpu > 10 ? 'text-orange-400 font-bold' : 'text-green-400'}`}>
                                        {thread.cpu}%
                                    </div>
                                    <div className="flex-1 ml-4 truncate" title={thread.name}>
                                        {thread.name}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 italic">
                                Loading threads or no active threads found...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThreadModal;
