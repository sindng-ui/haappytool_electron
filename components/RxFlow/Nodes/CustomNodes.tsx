import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { RxNodeData } from '../constants';
import BaseNode from './BaseNode';
import SubjectNode from './SubjectNode';
import { Clock, Play, MousePointer, Filter, ListFilter, PlayCircle, Combine, ArrowRightToLine } from 'lucide-react';

// Source Node
export const SourceNode = memo((props: NodeProps<RxNodeData>) => {
    // Basic icon logic based on label if needed
    let Icon = Play;
    if (props.data.label.includes('Interval') || props.data.label.includes('Timer')) Icon = Clock;
    if (props.data.label.includes('Click')) Icon = MousePointer;

    return <BaseNode {...props} category="source" icon={Icon} />;
});

// Operator Node (Pipe)
export const OperatorNode = memo((props: NodeProps<RxNodeData>) => {
    let Icon = Filter;
    if (props.data.label.includes('Select')) Icon = PlayCircle;
    if (props.data.label.includes('Scan')) Icon = ListFilter;

    return <BaseNode {...props} category="pipe" icon={Icon} />;
});

// Join Node
export const JoinNode = memo((props: NodeProps<RxNodeData>) => {
    return <BaseNode {...props} category="join" icon={Combine} />;
});

// Subject Node - Use specialized component
export { SubjectNode };

// Sink Node
export const SinkNode = memo((props: NodeProps<RxNodeData>) => {
    return <BaseNode {...props} category="sink" icon={ArrowRightToLine} />;
});
