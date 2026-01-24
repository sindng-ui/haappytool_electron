import React from 'react';
import JsonFormatter from '../../components/JsonTools/JsonFormatter';

interface RawDataViewerProps {
    data: any;
    title?: string;
}

export const RawDataViewer: React.FC<RawDataViewerProps> = ({ data, title }) => {
    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            {title && (
                <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {title}
                </div>
            )}
            <div className="flex-1 overflow-hidden p-2">
                <JsonFormatter data={data} search="" />
            </div>
        </div>
    );
};
