import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Radio } from 'lucide-react';
import { STDevice } from './types';

interface LiveMonitorProps {
    device: STDevice;
    sseEvents: any[];
}

interface DataPoint {
    time: string;
    timestamp: number;
    [key: string]: any;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ device, sseEvents }) => {
    const [selectedAttribute, setSelectedAttribute] = useState<string | 'ALL'>('ALL');
    const [chartData, setChartData] = useState<DataPoint[]>([]);

    // 1. Filter events for this device only
    const deviceEvents = useMemo(() => {
        return sseEvents.filter(e => e.deviceId === device.deviceId && e.value !== undefined);
    }, [sseEvents, device.deviceId]);

    // 2. Identify numeric attributes that we can graph
    const availableAttributes = useMemo(() => {
        const attrs = new Set<string>();
        deviceEvents.forEach(e => {
            if (!isNaN(Number(e.value))) {
                attrs.add(e.attribute);
            }
        });
        return Array.from(attrs);
    }, [deviceEvents]);

    // 3. Process events into Chart Data
    useEffect(() => {
        if (deviceEvents.length === 0) return;

        // Group by approximate timestamp (e.g., seconds) to handle simultaneous events
        // Or just map linearly. Linear mapping is better for stream.

        // We need to maintain a state of "current values" to fill gaps if we want a continuous multi-line chart,
        // OR we can just plot points. For Recharts multi-line, it's best to have shared objects.

        const data: DataPoint[] = [];
        const state: Record<string, number> = {};

        // Sort events by time just in case
        const sorted = [...deviceEvents].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        // Initial state from first events? No, start from 0 or just plot events.
        // Better approach: Create a data point for each event time, carrying over previous values.

        sorted.forEach(e => {
            if (availableAttributes.includes(e.attribute)) {
                const val = Number(e.value);
                state[e.attribute] = val; // Update current state for this attr

                const date = new Date(e.time);
                data.push({
                    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    timestamp: date.getTime(),
                    ...state // Spread all current attribute values
                });
            }
        });

        // Slice to keep performance (last 50 points)
        setChartData(data.slice(-50));

    }, [deviceEvents, availableAttributes]);

    // Defines colors for attributes
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F'];

    const getLineColor = (attr: string, index: number) => {
        if (attr === 'temperature') return '#ff7300';
        if (attr === 'humidity') return '#0088fe';
        if (attr === 'battery') return '#00C49F';
        if (attr === 'power') return '#ffc658';
        if (attr === 'switch') return '#8884d8'; // Switch usually not numeric but maybe 0/1?
        return colors[index % colors.length];
    };

    if (availableAttributes.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                    <Activity size={32} className="opacity-50" />
                </div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">No Numeric Data Yet</h3>
                <p className="text-xs mt-2 max-w-xs text-center leading-relaxed opacity-70">
                    Waiting for events with numeric values (temp, power, level...).
                    Make sure SSE is connected and events are incoming.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Live Sensor Monitor</h3>
                        <p className="text-[10px] text-slate-400">Real-time values from SSE stream</p>
                    </div>
                </div>

                {/* Attribute Toggles */}
                <div className="flex gap-2">
                    {availableAttributes.map((attr, idx) => (
                        <button
                            key={attr}
                            onClick={() => setSelectedAttribute(selectedAttribute === attr ? 'ALL' : attr)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border transition-all
                                ${selectedAttribute === 'ALL' || selectedAttribute === attr
                                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm opacity-100'
                                    : 'opacity-40 border-transparent hover:opacity-70'}`}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getLineColor(attr, idx) }} />
                            {attr.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full relative -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="time"
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            width={30}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#f1f5f9',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            itemStyle={{ padding: 0 }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        {availableAttributes.map((attr, idx) => (
                            (selectedAttribute === 'ALL' || selectedAttribute === attr) && (
                                <Line
                                    key={attr}
                                    type="monotone"
                                    dataKey={attr}
                                    stroke={getLineColor(attr, idx)}
                                    strokeWidth={2}
                                    dot={{ r: 2, strokeWidth: 0 }}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                    isAnimationActive={false} // Better for realtime updates
                                    connectNulls
                                />
                            )
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
