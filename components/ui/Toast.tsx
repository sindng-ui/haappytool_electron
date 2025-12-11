import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    duration?: number;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', duration = 3000, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColors = {
        success: 'bg-indigo-600',
        error: 'bg-red-600',
        info: 'bg-slate-700'
    };

    const icons = {
        success: <CheckCircle size={18} className="text-white" />,
        error: <AlertCircle size={18} className="text-white" />,
        info: <AlertCircle size={18} className="text-white" />
    };

    return (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl ${bgColors[type]} text-white animate-fade-in-up`}>
            {icons[type]}
            <span className="font-semibold text-sm">{message}</span>
            <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded p-0.5 transition-colors">
                <X size={14} />
            </button>
        </div>
    );
};

export default Toast;
