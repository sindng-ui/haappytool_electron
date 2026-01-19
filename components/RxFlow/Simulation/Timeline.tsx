import React, { useEffect, useRef } from 'react';
import { useRxFlowStore } from '../RxFlowStore';
import { runSimulation } from './Engine';
import { Play, Pause, RotateCcw } from 'lucide-react';

const Timeline: React.FC = () => {
    const {
        nodes,
        edges,
        isPlaying,
        setIsPlaying,
        simulationTime,
        setSimulationTime,
        setEdgeEmissions,
        setSimulationDuration,
        updateNodeData
    } = useRxFlowStore();

    const requestRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);

    // Start Simulation
    const handlePlay = () => {
        if (!isPlaying) {
            // Run logic once
            const { edgeEmissions, maxTime, sinkEmissions } = runSimulation(nodes, edges);
            console.log('[RxFlow] Simulation complete:', {
                edgeCount: Object.keys(edgeEmissions).length,
                edgeEmissions,
                sinkEmissions,
                maxTime
            });
            setEdgeEmissions(edgeEmissions);
            setSimulationDuration(maxTime || 10000); // Default if empty

            // Update sink nodes with emissions
            Object.entries(sinkEmissions).forEach(([nodeId, emissions]) => {
                updateNodeData(nodeId, { emissions });
            });

            setIsPlaying(true);
            // Reset animation loop reference
            startTimeRef.current = performance.now() - simulationTime;
            requestRef.current = requestAnimationFrame(animate);
        } else {
            setIsPlaying(false);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
    };

    const handleReset = () => {
        setIsPlaying(false);
        setSimulationTime(0);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };

    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = time - startTimeRef.current;

        setSimulationTime(elapsed);
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Format time (mm:ss.ms)
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const milliseconds = Math.floor(ms % 1000).toString().padStart(3, '0');
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}.${milliseconds}`;
    };

    const duration = useRxFlowStore.getState().simulationDuration || 10000;
    const progress = Math.min((simulationTime / duration) * 100, 100);

    return (
        <div className="absolute bottom-4 left-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-xl p-4 flex items-center justify-between shadow-xl z-10">
            <div className="flex items-center gap-4">
                <button
                    onClick={handlePlay}
                    className={`p-2 rounded-full transition ${isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>
                <button
                    onClick={handleReset}
                    className="p-2 text-slate-400 hover:text-white transition"
                >
                    <RotateCcw size={20} />
                </button>
                <span className="text-sm font-mono text-indigo-300 w-24">
                    {formatTime(simulationTime)}
                </span>
            </div>

            <div className="flex-1 mx-4 h-2 bg-slate-700 rounded-full relative overflow-hidden cursor-pointer">
                <div
                    className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default Timeline;
