import React from 'react';
import {
    BaseEdge,
    EdgeProps,
    getBezierPath,
    EdgeLabelRenderer
} from '@xyflow/react';
import { useRxFlowStore } from '../RxFlowStore';
import { AnimatePresence, motion } from 'framer-motion';

// Duration for a marble to travel from source to target (in ms of simulation time)
const TRAVEL_DURATION = 1000;

const CustomEdge: React.FC<EdgeProps> = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}) => {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const { edgeEmissions, simulationTime } = useRxFlowStore();
    const emissions = edgeEmissions[id] || [];

    // Filter marbles that are currently "travelling" on this edge
    // A marble is visible if: emissionTime <= simTime < emissionTime + TRAVEL_DURATION
    const activeMarbles = emissions.filter(e => {
        const arrivalTime = e.time + TRAVEL_DURATION;
        return simulationTime >= e.time && simulationTime < arrivalTime;
    });

    if (activeMarbles.length > 0) {
        console.log('[CustomEdge] Active marbles:', { id, activeMarbles, simulationTime });
    }

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

            {/* Marble Animation Layer */}
            {activeMarbles.map((marble, i) => {
                const progress = (simulationTime - marble.time) / TRAVEL_DURATION;
                // Linear interpolation between source and target
                const x = sourceX + (targetX - sourceX) * progress;
                const y = sourceY + (targetY - sourceY) * progress;

                return (
                    <g key={`${id}-marble-${marble.time}-${i}`}>
                        <circle
                            cx={x}
                            cy={y}
                            r="6"
                            fill={marble.type === 'error' ? '#f43f5e' : marble.type === 'complete' ? '#64748b' : '#fbbf24'}
                            stroke="#78350f"
                            strokeWidth="2"
                            style={{
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                            }}
                        >
                            <title>{JSON.stringify(marble.value)}</title>
                        </circle>
                        {/* Data label */}
                        <text
                            x={x + 10}
                            y={y - 10}
                            fill="#fbbf24"
                            fontSize="10"
                            fontWeight="bold"
                            style={{
                                pointerEvents: 'none',
                                textShadow: '0 0 3px rgba(0,0,0,0.8)',
                            }}
                        >
                            {typeof marble.value === 'object' ? JSON.stringify(marble.value) : marble.value}
                        </text>
                    </g>
                );
            })}
        </>
    );
};

export default React.memo(CustomEdge);
