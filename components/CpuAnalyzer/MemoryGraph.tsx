import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MemoryDataPoint } from './useCpuData';

interface Props {
    data: MemoryDataPoint[];
}

const MemoryGraph: React.FC<Props> = ({ data }) => {
    const formattedData = data.map(d => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));

    return (
        <div style={{ width: '100%', height: '300px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '10px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100}>
                <LineChart data={formattedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="time" stroke="#aaa" fontSize={12} tick={{ fill: '#aaa' }} />
                    <YAxis stroke="#aaa" fontSize={12} tick={{ fill: '#aaa' }} unit=" KB" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px', color: '#fff' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="pss" stroke="#8884d8" name="PSS" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gemrss" stroke="#82ca9d" name="GEMRSS" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="swap" stroke="#ffc658" name="SWAP" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gpu" stroke="#ff7300" name="GPU" dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MemoryGraph;
