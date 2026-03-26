import React from 'react';
import * as Lucide from 'lucide-react';
import NetTrafficAnalyzerView from './NetTrafficAnalyzerView';

const NetTrafficAnalyzerPlugin: React.FC = () => {
    return (
        <div className="flex flex-col h-full w-full">
            <NetTrafficAnalyzerView />
        </div>
    );
};

export default NetTrafficAnalyzerPlugin;
