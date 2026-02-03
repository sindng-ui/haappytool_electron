
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CpuDataPoint } from './useCpuData';

interface Props {
    data: CpuDataPoint[];
}

const CpuGraph: React.FC<Props> = ({ data }) => {
    // Format timestamp for X-axis
    const formattedData = data.map(d => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));

    return (
        <div style={{ width: '100%', height: '300px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '10px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <LineChart data={formattedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="time" stroke="#aaa" fontSize={12} tick={{ fill: '#aaa' }} />
                    <YAxis domain={[0, 'auto']} stroke="#aaa" fontSize={12} tick={{ fill: '#aaa' }} unit="%" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', color: '#fff' }}
                        itemStyle={{ color: '#82ca9d' }}
                    />
                    <Line type="monotone" dataKey="total" stroke="#82ca9d" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default CpuGraph;
